---
id: freedom-code-wxml-highlight
type: module-design
title: Freedom Code — WXML 标签高亮模块
status: draft
parent: freedom-code-arch
---

# WXML 标签高亮模块

## 职责

为 WXML 文档的标签名着色：用 `TextEditorDecorationType` 高亮所有标签，并按 `wxml-activeColor` 为指定标签上色。

## 边界

- 允许依赖：`vscode`；内部 `config.js` 持有 `wxml-active*` 配置并监听变化。
- 仅处理 `languageId === 'wxml'`；`activeDisable` 为 true 时完全跳过。

## 结构

- `ActiveText.js`：计算标签范围、创建/缓存 decoration，监听可见编辑器与文本变化（500ms 防抖）。
- `config.js`：读取 `wxml-activeColor` / `wxml-activeDisable` / `wxml-tagNoActiveArr`，配置变化时刷新。

## 关键行为

- 排除 `wxml-tagNoActiveArr` 中的标签与注释内容。
- 排除 `{{ }}`、引号包裹、布尔/数字起始的 token（`shouldCreateRange`）。
