# dsh-personal-bundle

个人 DSH 桌面插件集：把背景、侧边栏、批注、悬停归档、上下文计量、BTW 六个插件
装成一个组合包，**一条 spec 装齐并自动挂载**。

已收录（版本即本机 desktop profile 实跑状态，全部 pin 死）：

| 插件 | 版本 | 作用 |
|---|---|---|
| [dsh-any-background](https://github.com/Tkingxiao/dsh-any-background) | 0.3.4 | 壁纸层：图片/视频/算法背景 + 布局编辑器 + 取色 + 轮换 |
| [dsh-better-sidebar](https://www.npmjs.com/package/dsh-better-sidebar) | 0.24.1 | 可扩展右侧栏（多个插件往它里面注册 tab） |
| [dsh-context](https://www.npmjs.com/package/dsh-context) | 0.63.0 | 上下文用量计量与展示 |
| [@changfenhuang/dsh-annotation](https://www.npmjs.com/package/@changfenhuang/dsh-annotation) | 1.4.11 | 批注 |
| [dsh-hover-archive](https://github.com/zhifengjiang/dsh-hover-archive) | 0.1.0 | 悬停归档 |
| [@michengai/dsh-btw](https://www.npmjs.com/package/@michengai/dsh-btw) | 0.1.15 | BTW 补充说明 |

壁纸与它的构图参数也在这个仓里（`background/`），见下面的「背景还原」——
插件装上了不等于背景回来了，这两件事分开做。

## 使用方式

**前置 1 — 放开子依赖里的 git 协议。** 两个插件只发在 GitHub 上（见上表的 commit pin），
而 pnpm 11 默认拒绝子依赖中的 git 协议。在你的 profile 目录里改
`pnpm-workspace.yaml`（`~/.dsh/profiles/<profile>/pnpm-workspace.yaml`）：

```yaml
blockExoticSubdeps: false
```

**前置 2 — 用干净的 profile，或先关掉这些插件的独立 bundle。**
每一行都按上游原文镜像，同一个 id 只能出现在一个启用的 bundle 层里；同时启用两处
会让 Loader 直接拒绝整棵树（`duplicate loader entry id`），profile 起不来。

安装：在 DSH 桌面「插件管理」里粘贴这一条，或命令行执行同一条。

```
github:gigaflw/dsh-personal-bundle
```

装完**刷新一次页面**（浏览器半是页面加载时取的），设置里的插件页会多出「个人桌面插件集」卡片。

- 更新：重贴同一 spec（git spec 取默认分支 HEAD）。
- 卸载：插件管理里移除该 bundle，六个插件随之卸载。

## 背景还原

any-background 的背景就是数据目录里的两个文件，没有数据库：

| 文件 | 内容 |
|---|---|
| `background/theme-config.json` | 配色、透明度、模糊、构图（`bgState` 的 `x/y/zoom/iw/ih`） |
| `background/wallpaper.jpg` | 图片本体，1200×740（换成视频时是 `wallpaper.mp4` 等） |

**路线 A — 一条命令（推荐）**，把两个文件铺到 `$DSH_HOME/.dsh-any-background-data/`。
壁纸和脚本都在插件包里，所以**装完 bundle 就能跑**，不用 clone 仓库：

```bash
sh ~/.dsh/profiles/<profile>/node_modules/dsh-personal-bundle/scripts/restore-background.sh
```

从 clone 出来的仓库跑也可以：`./scripts/restore-background.sh`（仓库里带可执行位）。

> 前缀 `sh` 不是多余的：npm 打包会把可执行位抹成 644（git 安装保留 755），`sh <脚本>` 两条路都成立。

先退出 DSH（运行中的客户端把配置放在内存里，下次改动会覆盖回去）；已存在的文件会被挪成
`*.bak.<时间戳>`，不会直接覆盖；脚本按 `$DSH_HOME`（空值视为未设、`~/` 展开）定位目标目录，
与宿主自身的一致。

**路线 B — 走插件自己的导入**，适合你手头已有 `dsh-any-theme.json`（含视频的自包含包）：
any-background 设置卡 →「导入配置」→ 选文件。插件导出格式是
`{version, config, wallpaper: data:image/…, video: data:video/…}`，和路线 A 是同一份状态。

## 开发方式

```bash
pnpm install
pnpm test
```

本仓是单包仓库，根目录即包本体。

- `cordis.patch.yml` 是组合层：只 insert 六个插件的行，无运行时 API。
- **每个插入行都是上游包 `cordis.patch.yml` 里的行的逐字拷贝**，理由与约束写在
  `cordis.patch.yml` 顶部注释里；`tests/mirrored-rows.test.mjs` 会把它和已安装的上游包
  逐字段 diff（含 `!!js` 表达式源码），上游一改就会红。
- 依赖 spec 一律 pin 死：registry 用精确版本，git 用 40 位 commit。升级某个插件 =
  改 `package.json` 的 spec + 同步 `cordis.patch.yml` 里对应的行。
- `index.js` 是手写的空入口（`export {}`），本包**不需要构建**——git 安装只送达
  git 跟踪的文件且不在安装期构建，手写入口就不存在"忘了提交 `lib/`"这个坑。
