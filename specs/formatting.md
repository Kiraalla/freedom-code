---
id: freedom-code-formatting
type: module-design
title: Freedom Code — 格式化模块
status: draft
parent: freedom-code-arch
---

# 格式化模块

## 职责

为 wxml / vue / wxss / scss / less / css / html / javascript / typescript 提供统一的文档与选区格式化，基于 Prettier，并补齐 Prettier 不支持的 WXML 语义（模板块、注释、`<text>` 空白、mustache 空格）。

`.sass`（缩进语法）不在此列：Prettier 没有对应 parser，见 `freedom-code-arch` 的决策。

## 边界

- 允许依赖：`vscode`、`prettier`、`path`、`./pipeline`、`./editor-contract`。
- 不拥有保存时机、缩进来源与命令入口 —— 那些归 `freedom-code-editor-integration`。
- 不触及任何兄弟模块；只被 `extension.js`（组合根）调用。
- 这是唯一一套格式化实现：`FormatWxml`/`saveFormat` 已删除，不再有"遗留兼容路径"。

## 结构

- `pipeline.js` —— 纯函数层，不 import `vscode`，是"文本怎么变"的唯一决策点：
  `findMarkupRanges`（标记区域）、`protectVerbatimBlocks`/`restoreVerbatimBlocks`（模板块哨兵）、`protectComments`/`restoreComments`、`applyMustacheSpacing`（带区间的空格规范化）、`compressTextTags`。
- `format_core.js` —— 编排：读配置、保护 → 包裹 → 调 Prettier → 解包 → 还原，并把 parser 映射与 `ConfigManager` 缓存留在宿主层。

## 关键流程

1. 超过 1MB 直接返回原文（快速模式）。
2. 不在 `parserMap` 且不是 vue/wxml → 原样返回（`.sass` 走这条路，让 VS Code 回退到其他格式化器）。
3. 合并配置时先把编辑器传入的 `FormattingOptions` 盖在 `freedomCode.prettierOptions` 之上（编辑器优先）。
4. 非 vue/wxml：清理 `overrides` 后交给 `prettier.format`。
5. wxml：`protectVerbatimBlocks(['template','wxs'])` → `protectComments` → 包进 `<template>` → Prettier（`vue` parser）→ 解包 → 区域内 mustache（单花括号规则关闭）→ 还原注释 → `compressTextTags` → 还原模板块。
6. vue：`protectComments` → Prettier → 区域内 mustache（仅 `<template>` 内容）→ 还原注释。

**顺序即契约**：mustache 必须在还原注释与模板块之前，否则 `<script>`/`<style>`/`<wxs>` 里的字符串与正则字面量会被改写；块保护必须在注释保护之前，否则块内注释会被单独抽走而无法随块还原。

## CSS 排版模式

纯函数 `util/css_formatter.js` 提供两种排版，`SCSSCompiler` 与格式化管线共用同一份实现：

- **compact**：一条规则一行，属性用空格分隔；**递归解析块结构**，`@media` / `@keyframes` 内部按层缩进（旧实现用 `{([^}]+)}` 正则会把它压平并错位换行）。
- **expanded**：每条属性一行（SCSS 编译的 `outputCompact: false` 走这条）。

`css` / `wxss` 的格式化模式由 `freedomCode.cssFormatStyle`（`normal` 默认 / `compact`）决定；未显式设置时读扩展自己记住的值；都没决定时用 `normal`，并在首次格式化后提示一次（不阻塞保存流程 —— 格式化提供器无法区分“主动格式化”与“保存时格式化”）。紧凑模式**必须保留注释**，格式化不得删用户内容。

## 已知限制

- `<text>` 的空白压缩（`compressTextTags`）把内部多行压成一行，会改变小程序渲染结果；这是既有特性，未纳入本轮修复。
- `ConfigManager` 的缓存键是 `fileType` 而非 `fileType + filePath`，带 `overrides` 的同类文件在 10 秒窗口内可能拿到彼此的配置。实际影响已发生过：验证 `singleAttributePerLine` 是否生效时，同一个 `fileType` 的缓存让首次对比结果失真，必须手动 `clearCache()` 才能看到真实行为。
- `forcedOptions` 只硬锁 `parser: 'vue'` 与 `htmlWhitespaceSensitivity: 'ignore'`（WXML 包裹方案必需）；`singleAttributePerLine` / `bracketSameLine` 已回归用户设置，默认值（`bracketSameLine: true`）保持默认输出不变。
