# Distributed encoder

The browser build distributes @ffmpeg/ffmpeg 0.12.15 (MIT) and @ffmpeg/core 0.12.10 (GPL-2.0-or-later), without modification. Both releases are from upstream commit `71aa99d37c02a7b4c435275ca9ef50e612f6efa1` (tag `v12.15`). The lockfile records npm artifact integrity; encoder/manifest.json records the uncompressed WebAssembly SHA-256. Compression changes transport only.

Source and build instructions:
https://github.com/ffmpegwasm/ffmpeg.wasm/tree/71aa99d37c02a7b4c435275ca9ef50e612f6efa1
Source archive:
https://github.com/ffmpegwasm/ffmpeg.wasm/archive/71aa99d37c02a7b4c435275ca9ef50e612f6efa1.tar.gz

Upstream Dockerfile and build scripts identify FFmpeg and linked libraries and retrieve their sources. Included libraries have their own notices; see upstream Dockerfile and corresponding source trees. The core includes GPL components (including x264); do not label the core MIT. Before public binary distribution, retain a complete corresponding-source copy including all linked dependency sources and build scripts, and publish its download alongside the encoder or arrange a GPL-compliant source offer. Record that source location in release evidence; the release checker blocks promotion without it. A link to an upstream repository alone is not treated as proof of that distribution requirement.

Native FFmpeg packaging retains its existing notices and build process. No native executable is included in the static web build.
