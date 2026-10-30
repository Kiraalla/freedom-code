---
id: freedom-code-scss-compile
type: module-design
title: Freedom Code — SCSS 编译模块
status: draft
parent: freedom-code-arch
---

# SCSS 编译模块

## 职责

用 dart-sass（`sass`）把 SCSS/SASS 编译为 CSS，支持自定义输出路径/扩展名（.css/.wxss/.acss），默认输出紧凑格式。

## 边界

- 允许依赖：`sass`、`fs`、`path`；日志通过注入的 `Logger`。
- 由 `extension.js` 的命令与保存钩子触发。

## 关键行为

- `formatCompact` / `formatExpanded` 先把 **CSS 字符串字面量替换成占位符**，再处理 `{}`，最后还原。之前这套花括号处理不是字符串感知的，`content: "}"` 或 SVG data URI 里的 `{}` 会被当成规则边界撕碎。新加字符串前不要绕过这两层保护。
- `ignoreUnderscoreFiles`（默认 true）跳过 `_` 前缀部分文件。
- 输出样式：默认 `outputCompact` 走 `formatCompact`（一规则一行，见架构「决策」）；`preserveComments` 时用 expanded 并保留注释。
- `outputPathFormat`：`same`（同目录）、`custom`、`relative`（相对工作区，保留相对目录结构）。
- `postProcessForCustomExtension`：输出非 `.css` 扩展名时改写 `@import`/`url()` 里的 `.css` 引用与换行。
