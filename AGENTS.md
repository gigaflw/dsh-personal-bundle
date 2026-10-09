# dsh-personal-bundle

个人 DSH 桌面插件组合包：根目录即包本体，唯一实质是 `cordis.patch.yml`。

## 硬约束

- **插入行必须是上游包 `cordis.patch.yml` 里那一行的逐字拷贝。** 理由与推论写在
  `cordis.patch.yml` 顶部注释里（本文件不重复）。改行 = 改上游拷贝，
  `tests/mirrored-rows.test.mjs` 会逐字段 diff（含 `!!js` 表达式源码）拦住漂移。
- **依赖 spec 一律 pin 死**：registry 用精确版本（`1.4.11`），git 用 40 位 commit
  （`github:owner/repo#<sha>`）。测试会拒绝 range 与分支名。
- **一个 id 只能出现在一个启用的 bundle 层里**，否则 Loader 抛
  `duplicate loader entry id`，profile 起不来。
- 本包**不构建**：`index.js` 是手写空入口，无需 `lib/`，也就没有"忘了提交产物"这个坑。

## 本机环境

- 插件本体：`~/.dsh/profiles/desktop/node_modules/<包名>`
- 依赖与使能：`~/.dsh/profiles/desktop/package.json`（`dependencies` + `dsh.profile.bundles`）
- 收录依据与本机插件全量清单：`docs/inventory.md`
- DSH 源码（只读参考）：`~/workspace/dsh-ft/submodules/deepseek-harness`，基线 0.2.0-rc.2

## 命令

```bash
pnpm install
pnpm test
```

升级某个插件：改 `package.json` 的 spec → 更新 `cordis.patch.yml` 里对应的行 → `pnpm install && pnpm test`。

## Commits

- `git commit -s` 签名
- English commit message，前缀：`feat:` / `fix:` / `bundle:` / `docs:`
- 不 push，由用户推送
