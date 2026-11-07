#!/bin/zsh
set -euo pipefail
project="${0:A:h:h}"
npm --prefix "$project/workspace" run build
build_dir="${GT_GRAFFITI_BUILD_DIR:-$project/.build}"
destination="${1:-$project/../GT Graffiti Launcher.app}"
staging=$(mktemp -d /private/tmp/gt-graffiti-package.XXXXXX)
trap 'rm -rf "$staging"' EXIT
bundle="$staging/GT Graffiti Launcher.app"
export CLANG_MODULE_CACHE_PATH="$build_dir/module-cache"
export SWIFTPM_MODULECACHE_OVERRIDE="$build_dir/module-cache"
swift build --package-path "$project" --scratch-path "$build_dir" --cache-path "$build_dir/cache" --disable-sandbox -c release
binary_dir=$(swift build --package-path "$project" --scratch-path "$build_dir" --cache-path "$build_dir/cache" --disable-sandbox -c release --show-bin-path)
mkdir -p "$bundle/Contents/MacOS" "$bundle/Contents/Resources"
workspace="$bundle/Contents/Resources/workspace"
mkdir -p "$workspace"
cp "$project/workspace/server.mjs" "$project/workspace/media-jobs.mjs" "$workspace/"
ditto --norsrc --noextattr "$project/workspace/dist" "$workspace/dist"
if [[ -x "$project/workspace/.runtime/tools/bin/ffmpeg" && -x "$project/workspace/.runtime/tools/bin/node" ]]; then
    ditto --norsrc --noextattr "$project/workspace/.runtime/tools" "$workspace/tools"
else
    python3 "$project/scripts/bundle-tools.py" "$workspace/tools"
fi
env PATH=/usr/bin:/bin "$workspace/tools/bin/node" --version
env PATH=/usr/bin:/bin "$workspace/tools/bin/ffmpeg" -version > /dev/null
cp "$binary_dir/GTGraffitiLauncher" "$bundle/Contents/MacOS/GTGraffitiLauncher"
cp "$project/Info.plist" "$bundle/Contents/Info.plist"
cat "$project/Sources/GTGraffitiCore/GTArtwork.swift" "$project/scripts/make-icon.swift" > "$staging/make-icon.swift"
swift "$staging/make-icon.swift" "$bundle/Contents/Resources/AppIcon.icns"
codesign --force --sign - "$bundle"
codesign --verify --strict "$bundle"
# Archive before copying into folders whose file providers attach Finder metadata.
ditto --norsrc --noextattr -c -k --keepParent "$bundle" "${destination}.zip"
if [[ -e "$destination" ]]; then
    # ditto merges directories; preserve the old bundle instead of retaining stale hashed assets.
    previous="${destination}.previous.$(date +%s)"
    mv "$destination" "$previous"
fi
ditto --norsrc --noextattr "$bundle" "$destination"
codesign --verify --deep --strict "$destination"
echo "Built $destination"
