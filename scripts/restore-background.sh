#!/bin/sh
# Restore the any-background wallpaper and its composition onto this machine.
#
# The plugin keeps everything under $DSH_HOME/.dsh-any-background-data/:
#
#   theme-config.json   colors, opacities, blur and the composition (x/y/zoom)
#   wallpaper.jpg       the image itself (a video would be wallpaper.<ext>)
#   rotation/           the rotation pool, when one is configured
#
# Copying these files in IS the migration — the host reads them at startup, so
# no plugin code and no RPC is involved. This is the same state the plugin's
# own "export/import dsh-any-theme.json" round-trips through the RPC, minus the
# base64 step.
#
#   scripts/restore-background.sh
#
# Existing files are moved aside to *.bak.<timestamp> rather than overwritten,
# so a wrong target directory costs nothing.
set -eu

here=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
src="$here/background"

# Mirror @deepseek-ai/dsh-home-paths, which is what the plugin resolves its
# store with: a blank $DSH_HOME counts as unset, a leading ~/ expands against
# $HOME, and the result is absolute. Restoring into a directory nothing reads
# fails silently, so the resolution is reproduced rather than approximated.
home=${DSH_HOME:-}
if [ -z "$(printf '%s' "$home" | tr -d '[:space:]')" ]; then
  home="$HOME/.dsh"
fi
case "$home" in
  '~') home="$HOME" ;;
  '~/'*) home="$HOME/${home#\~/}" ;;
esac
target="$home/.dsh-any-background-data"

if [ ! -f "$src/theme-config.json" ]; then
  printf 'error: %s/theme-config.json not found\n' "$src" >&2
  exit 1
fi

# A running client holds the config in memory and writes it back on the next
# change, which would undo this restore. Warn rather than refuse: quitting the
# app is the user's call, and the backup below keeps the previous state.
if pgrep -f 'DeepSeek Harness' >/dev/null 2>&1; then
  printf 'note: DeepSeek Harness appears to be running.\n' >&2
  printf '      Quit it and rerun, otherwise a later settings change overwrites this restore.\n' >&2
fi

mkdir -p -- "$target"
stamp=$(date +%Y%m%d%H%M%S)

for entry in "$src"/*; do
  name=$(basename -- "$entry")
  if [ -e "$target/$name" ]; then
    mv -- "$target/$name" "$target/$name.bak.$stamp"
    printf 'kept the previous %s as %s.bak.%s\n' "$name" "$name" "$stamp"
  fi
  cp -R -- "$entry" "$target/$name"
  printf 'restored %s\n' "$name"
done

printf 'done: %s\n' "$target"
printf 'Start (or refresh) DeepSeek Harness to see the wallpaper.\n'
