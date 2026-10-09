# Release Notes

按版本号倒序维护；内容由 commit msg 总结。

## 0.1.0

- feat: ship the personal desktop set as one installable bundle — `dsh-any-background`, `dsh-better-sidebar`, `dsh-context`, `@changfenhuang/dsh-annotation`, `dsh-hover-archive` and `@michengai/dsh-btw` are declared as pinned dependencies and mounted by a single insert list, so one spec (`github:gigaflw/dsh-personal-bundle`) installs and activates all six
- feat: mirror every row from its own package's patch — the loader composes only the layers named in `dsh.profile.bundles` and never loads a dependency's patch transitively, so a dependency-only bundle would leave all six rows dead
- test: diff each mirrored row against the installed package — field by field, with `!!js` scalars compared as source text and evaluated against a stand-in context, plus a check that the sidebar self-disable guard still backs off for an earlier aggregate mount
- test: assert the composition contract — unique row ids, one insert list, rows and dependencies in exact agreement, the wallpaper row first, and the icon/locale/exports/`files` metadata the plugin manager resolves
- fix: keep the bundle buildless — `index.js` is a hand-written empty entry instead of a `lib/` artifact, because a git install delivers only git-tracked files and never builds, so a forgotten artifact is silent
- docs: record the desktop profile inventory that fixed the scope — installed versus enabled are different states, and the three other background plugins are installed but switched off
- feat: carry the wallpaper with the bundle — the plugin stores its background as `theme-config.json` plus `wallpaper.jpg` under `$DSH_HOME/.dsh-any-background-data/`, so installing the plugin never restored it; both files now ship in `background/` and `scripts/restore-background.sh` copies them into place
- feat: resolve the restore target the way the host does — a blank `$DSH_HOME` counts as unset and a leading `~/` expands against `$HOME`, matching `@deepseek-ai/dsh-home-paths`; a restore into a directory nothing reads fails silently
- test: verify the background pair and the restore script — the config's `backgroundType` must match the image or video actually shipped, `bgState.iw`/`ih` must equal the JPEG's real frame size, and the script is run against a scratch `DSH_HOME` to prove both the copy and the `*.bak.<timestamp>` backup
- fix: ship `background/` and `scripts/` inside the package — an install through the plugin manager never clones the repository, so assets left outside `files` would not exist on the machine being migrated
