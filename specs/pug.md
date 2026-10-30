---
id: freedom-code-pug
type: module-design
title: Freedom Code — Pug 支持（语法、格式化与编译）
status: draft
parent: freedom-code-arch
---

# Pug 支持

## 职责

为 `.pug` / `.jade` 提供**语法高亮**、**格式化**与**编译为 HTML**。

## 边界

- 允许依赖：`pug`（编译器）、`@prettier/plugin-pug`（格式化 parser）、`prettier`、`util/output-path.js`、`util/settings.js`。
- 格式化走统一管线（`freedom-code-formatting`），本模块只负责编译（`util/pug_compiler.js` + `commands/pug.js`）。

## 契约

- **格式化依赖插件**：Prettier 内核没有 pug parser，必须在 `parserMap` 里连同 `plugins: [pugPlugin]` 一起传，否则报 `Couldn't resolve parser "pug"`。选项全部走 `prettierOptions`（含 `overrides`）与编辑器缩进，不新增格式化开关。
- **编译产物固定 `.html`**：Pug 没有"自定义后缀"的语义；不复用 `scssOutputExtension`。
- **保存时识别按扩展名兜底**：装扩展**之前**就打开的 `.pug` 标签页，VS Code 仍将其语言记为 `plaintext`（语言关联不会自动刷新），只看 `languageId` 会直接跳过保存钩子 —— `isPugDocument` 同时检查扩展名。
- **输出路径**：与 SCSS 编译共用 `util/output-path.js` 的 `same` / `custom` / `relative` 策略（单一实现，避免两处漂移）。
- **HTML 美化**：渲染后交给 Prettier `html` parser，复用项目的格式化配置（去掉 `overrides` 与 `parser` 再传）；**美化失败不得让编译失败**，退回未美化输出并记 warn。
- **语言与语法由本扩展提供**：`contributes.languages` 声明 `pug`（`.pug` / `.jade` + 语言配置），`contributes.grammars` 挂 `text.pug`。
  - 语法与语言配置取自作者本人的 [Kiraalla/pug-compile](https://github.com/Kiraalla/pug-compile)（MIT），来源记录在 `syntaxes/pug/NOTICE.md`。
  - Vue 语法里 `text.pug` 的内嵌语言必须映射到 `pug`（曾映射到已废弃的 `jade`，导致 Vue 模板内的 Pug 段没有高亮）。
  - 装了其他 Pug 扩展时，两边的语法会争抢同一个 scope —— 本扩展的语法优先加载，但不影响格式化/编译。

## 已知限制

- 不处理 Pug 的 `include` 之外的构建能力（不替代真正的构建工具）。
- 语法文件为引入（非自写），后续若上游更新需手动同步。
- `pugAutoCompile` 默认关闭；保存时未开启会提示一次（可一键开启）。
