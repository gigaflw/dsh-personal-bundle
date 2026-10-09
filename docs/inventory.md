# 本机 desktop profile 插件清单（迁移基线）

> 抽查时点：DSH Desktop **0.2.0-rc.2**，profile 目录 `~/.dsh/profiles/desktop/`。
> 本文是 `dsh-personal-bundle` 的收录依据，也是"为什么只收 6 个"的答案。

## 0. 判定口径：已安装 ≠ 已使能

DSH 里这是三个独立状态，混起来会得出错误结论：

| 层 | 落点 | 语义 |
|---|---|---|
| 已安装 | profile `package.json` 的 `dependencies` | 代码在 `node_modules` 里 |
| **已使能** | profile `package.json` 的 `dsh.profile.bundles` | **只有列进去的名字才会被合成 patch 层** |
| 行级开关 | profile `cordis.patch.yml` 里 `disabled:` | 本机 0 条，即合成出的行全部启用 |

关键机制：`packages/boot/app-boot/src/profile.ts` 的 `loadProfileDirectory` 只遍历
`dsh.profile.bundles` 逐个解析 bundle 目录并加载其 `dsh.bundle.patch`；**依赖自己的 patch
永远不会被传递加载**。所以"装了但没写进 bundles"= 代码躺在 `node_modules` 里，一行都不生效。

## 1. 已使能：13 个 bundle 层

4 个官方层：`@deepseek-ai/dsh-base`、`dsh-web-app`、`dsh-experimental-voice-input-bundle`、
`dsh-experimental-agent-team-profile`。

9 个第三方层：

| 包 | 版本 | 来源 spec | 插入的行 id | 浏览器半 |
|---|---|---|---|---|
| `@ft/dsh-fft-bundle` | 0.1.0 | GitHub `#path:packages/dsh-fft-bundle` | `dsh-fft-settings` / `ft-research-cockpit` / `newapi-wechat-sso` | 组合包 |
| `@ftshare-lab/dsh-kline` | 0.3.4 | `github:FTShare-Lab/dsh_kline` | `mcp-dsh-kline` / `dsh-kline-sidebar` | web |
| `dsh-any-background` | 0.3.4 | `github:Tkingxiao/dsh-any-background` | `dsh-any-background` | web |
| `@changfenhuang/dsh-annotation` | 1.4.11 | npm `^1.4.11` | `dsh-annotation` | web |
| `dsh-hover-archive` | 0.1.0 | `github:zhifengjiang/dsh-hover-archive` | `dsh-hover-archive` | web |
| `dsh-better-sidebar` | 0.24.1 | npm `^0.24.1` | `better-sidebar` | web |
| `dsh-context` | 0.63.0 | npm `^0.63.0` | `dsh-context` | web |
| `@michengai/dsh-btw` | 0.1.15 | npm `^0.1.15` | `michengai-btw` | web |
| `dsh-at-file` | 0.6.3 | npm `^0.6.3` | `dsh-at-file` | web |

本 bundle 收录上表里的 6 个通用插件（背景 / better-sidebar / context / annotation /
hover-archive / btw）。**未收录**：

- `dsh-at-file` — 用户明确不需要。
- `@ft/dsh-fft-bundle`、`@ftshare-lab/dsh-kline` — 需要 FTShare API Key、uv 运行时，
  且前者依赖内网企业微信 SSO 插件，不能放进公开仓。

## 2. 已安装但未使能：11 个（全部不进本 bundle）

这些包在 `dependencies` 里但不在 `dsh.profile.bundles` 里，一行都不生效：

| 包 | 版本 | 类别 |
|---|---|---|
| `deepseek-harness-background` | 0.6.1 | 背景 |
| `dsh-ui-appearance` | 0.1.17 | 背景/外观 |
| `dsh-dream-skin` | 9.29.0 | 皮肤/背景 |
| `dsh-image-skin` | 1.1.0 | 皮肤 |
| `dsh-theme-endfield` | 1.1.9 | 主题 |
| `dsh-nico-theme` | 0.3.8 | 主题 |
| `@ash-qw/dsh-theme-prts` | 1.0.3 | 主题 |
| `dsh-sidenote` | 0.4.5 | 侧栏 |
| `dsh-status-rotator` | 0.34.1 | 状态栏 |
| `dsh-task-progress` | 0.3.0 | 进度 |
| `@nanmicoder/dsh-agent-teams` | 0.1.22 | Agent 团队 |

**背景类实际是"装 4 个、只开 1 个"**：只有 `dsh-any-background` 在跑；另外三个都是关掉的。
四款都插壁纸层，同时开启会互相抢 z-index，只能选一个 —— 这正是它们被关掉的原因
（能力对比见 `dsh-fft-bundle` 仓的 `docs/thirdparty/background-plugins.md`）。

## 3. 迁移相关的机制结论

1. **聚合包必须"镜像行"**。bundle 只在 `dsh.profile.bundles` 里被合成，依赖的 patch 是死文件，
   所以要把每个插件的行逐字抄进自己的 `cordis.patch.yml`，`dependencies` 只负责把代码放进
   `node_modules`。本仓用 `tests/mirrored-rows.test.mjs` 守着这份拷贝。
2. **一个 id 只能出现在一个启用的层里**。`vendor/loader` 的 `update()` 见到重复 id 会抛
   `duplicate loader entry id`，整棵树拒绝装载 → profile 起不来。
3. **git 来源要消费端放行**：pnpm 11 默认 `blockExoticSubdeps: true`，拒绝子依赖里的 git 协议，
   消费端 profile 的 `pnpm-workspace.yaml` 必须设 `false`。
4. **git spec 不带 ref 时取默认分支 HEAD**，不可复现；要 pin 就 pin 40 位 commit（"标签会移动，
   commit 不会"）。
5. **兼容门不是风险点**：用 DSH 自带的 semver 逐个实测这 20 个包对 `0.2.0-rc.2` 的
   `@deepseek-ai/dsh*` peer 范围，**无一被拒**。
6. **背景的"样子"是数据不是插件**：`~/.dsh/.dsh-any-background-data/`（`theme-config.json`
   + `wallpaper.jpg`）。插件装了不等于样式回来了；any-background 的 `dsh-any-theme.json`
   自包含导出（含壁纸）才是迁移路径。

## 4. 顺带发现（`dsh-fft-bundle` 仓）

- 本机装的 `@ft/dsh-fft-bundle@0.1.0` 是 GitHub 公开分支的旧快照：只有 3 行，
  **没有** kline 的两行，也没有 factor-intake 行，比该仓 `dev` 落后。
- 该仓 `dev` 版本的 patch 已镜像 kline 的 `mcp-dsh-kline` / `dsh-kline-sidebar` 两行，
  而 desktop profile **同时**把 `@ftshare-lab/dsh-kline` 选成了自己的 bundle 层 ⇒
  一旦该镜像版本经 GitHub 装到本机，两处会插入同样的两个 id，触发第 3 节第 2 条，
  profile 直接起不来。二者只应存在其一。
