#!/usr/bin/env bash
# Copies the Wolvy iOS SDK's Swift sources into this package and records which commit they came from.
#
# React Native builds native modules through CocoaPods, and CocoaPods trunk takes no new pods
# (read-only since 2026-12-02), so the package carries a pinned copy of the core instead of
# depending on it. Usage: scripts/sync-ios-core.sh ../Wolvy-SDK-iOS
set -euo pipefail
src="${1:?usage: scripts/sync-ios-core.sh <path to a Wolvy-SDK-iOS checkout>}"
here="$(cd "$(dirname "$0")/.." && pwd)"
dest="$here/ios/WolvyCore"
[ -d "$src/Sources/WolvyPlayer" ] || { echo "No Sources/WolvyPlayer in $src" >&2; exit 1; }
rm -rf "$dest"
mkdir -p "$dest"
cp -R "$src/Sources/WolvyPlayer/." "$dest/"
(cd "$src" && echo "Wolvy-SDK-iOS $(git describe --tags --always 2>/dev/null || echo unknown) $(git rev-parse HEAD)") > "$here/ios/CORE_VERSION"
echo "Copied $(find "$dest" -name '*.swift' | wc -l | tr -d ' ') files; $(cat "$here/ios/CORE_VERSION")"
