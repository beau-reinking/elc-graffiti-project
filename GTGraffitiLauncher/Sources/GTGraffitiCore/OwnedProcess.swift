import Foundation
import Darwin

/// A separate process group lets Stop reach npm, shells, and their child servers.
public final class OwnedProcess: @unchecked Sendable {
    public let pid: pid_t
    private let reader: FileHandle
    private let lock = NSLock()
    private var finished = false

    public init(folder: String, command: String, onOutput: @escaping @Sendable (String) -> Void, onExit: @escaping @Sendable (Int32) -> Void) throws {
        var descriptors: [Int32] = [0, 0]
        guard pipe(&descriptors) == 0 else { throw Self.error(errno) }
        var actions: posix_spawn_file_actions_t?
        var attributes: posix_spawnattr_t?
        posix_spawn_file_actions_init(&actions)
        posix_spawnattr_init(&attributes)
        defer {
            posix_spawn_file_actions_destroy(&actions)
            posix_spawnattr_destroy(&attributes)
            close(descriptors[1])
        }
        posix_spawn_file_actions_adddup2(&actions, descriptors[1], STDOUT_FILENO)
        posix_spawn_file_actions_adddup2(&actions, descriptors[1], STDERR_FILENO)
        posix_spawn_file_actions_addopen(&actions, STDIN_FILENO, "/dev/null", O_RDONLY, 0)
        posix_spawn_file_actions_addclose(&actions, descriptors[0])
        posix_spawn_file_actions_addclose(&actions, descriptors[1])
        let changedDirectory = posix_spawn_file_actions_addchdir_np(&actions, folder)
        guard changedDirectory == 0 else { close(descriptors[0]); throw Self.error(changedDirectory) }
        posix_spawnattr_setflags(&attributes, Int16(POSIX_SPAWN_SETPGROUP | POSIX_SPAWN_CLOEXEC_DEFAULT))
        posix_spawnattr_setpgroup(&attributes, 0)
        let arguments: [UnsafeMutablePointer<CChar>?] = ["/bin/zsh", "-lc", command].map { value in value.withCString { strdup($0) } }
        defer { arguments.forEach { free($0) } }
        var argv = arguments + [nil]
        let environment: [UnsafeMutablePointer<CChar>?] = ProcessInfo.processInfo.environment.map { key, value in "\(key)=\(value)".withCString { strdup($0) } }
        defer { environment.forEach { free($0) } }
        var envp = environment + [nil]
        var child: pid_t = 0
        let result = posix_spawn(&child, "/bin/zsh", &actions, &attributes, &argv, &envp)
        guard result == 0 else { close(descriptors[0]); throw Self.error(result) }
        pid = child
        reader = FileHandle(fileDescriptor: descriptors[0], closeOnDealloc: true)
        reader.readabilityHandler = { handle in
            let data = handle.availableData
            if !data.isEmpty { onOutput(String(decoding: data, as: UTF8.self)) }
        }
        DispatchQueue.global(qos: .utility).async { [self] in
            var status: Int32 = 0
            while waitpid(child, &status, 0) == -1 && errno == EINTR {}
            // Also reap descendants if the shell exits before its server does.
            kill(-child, SIGTERM)
            for _ in 0..<30 {
                if kill(-child, 0) != 0 { break }
                usleep(100_000)
            }
            lock.lock()
            if kill(-child, 0) == 0 { kill(-child, SIGKILL) }
            finished = true
            lock.unlock()
            reader.readabilityHandler = nil
            let remaining = reader.readDataToEndOfFile()
            if !remaining.isEmpty { onOutput(String(decoding: remaining, as: UTF8.self)) }
            onExit(status == 0 ? 0 : ((status & 0x7f) == 0 ? ((status >> 8) & 0xff) : 128 + (status & 0x7f)))
        }
    }

    public func stop() {
        lock.lock(); defer { lock.unlock() }
        guard !finished else { return }
        kill(-pid, SIGTERM)
        DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 3) { [self] in
            lock.lock(); defer { lock.unlock() }
            if !finished { kill(-pid, SIGKILL) }
        }
    }

    public func forceStop() {
        lock.lock(); defer { lock.unlock() }
        if !finished { kill(-pid, SIGKILL) }
    }

    private static func error(_ code: Int32) -> NSError {
        NSError(domain: NSPOSIXErrorDomain, code: Int(code), userInfo: [NSLocalizedDescriptionKey: String(cString: strerror(code))])
    }
}
