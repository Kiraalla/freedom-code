---
id: freedom-code-vue-jump
type: module-design
title: Freedom Code — Vue 定义跳转模块
status: draft
parent: freedom-code-arch
---

# Vue 定义跳转模块

## 职责

Vue 单文件组件内，把组件名（词）跳转到对应文件：按当前词生成候选文件名（`word.ext`、`word/index.ext`、以及 PascalCase 变体），用 `vscode.workspace.findFiles` 搜索并返回位置。

## 边界

- 允许依赖：`vscode`。
- 目标文件扩展名由 `freedomCode.vue-targetFileExtensions`（默认 .vue/.js/.ts）配置；支持的语言由 `vue-supportedLanguages` 配置。

## 结构

- `PeekFileDefinitionProvider.js`：`getComponentName` 生成候选名，`searchFilePath` 搜索，`provideDefinition` 汇总为 `Location[]`。

## 契约

- 跳转源是用户随手选中的词，可能不含任何单词字符（如 `-`、`$`），词提取与候选名生成必须能空着返回（`[]`）。
- 必须使用提供器收到的 `document`，不得读 `window.activeTextEditor`。
- `findFiles` 返回的已是 `vscode.Uri`，必须直接复用；经 `Uri.path` 再造 `Uri.file()` 会在 Windows 上双重编码（`/c%3A/...`）导致跳转失效。
