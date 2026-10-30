---
id: freedom-code-miniapp-intel
type: module-design
title: Freedom Code — 小程序智能（定义跳转与补全）模块
status: draft
parent: freedom-code-arch
---

# 小程序智能模块

## 职责

为 WXML/JSON 提供组件定义跳转与组件属性/事件补全：把 WXML 里的组件名解析为组件 JS 文件，并解析其 `properties` 与 `triggerEvent`。

## 边界

- 允许依赖：`vscode`、`recast`、`fs`、`path`。
- 与 Vue 跳转（`vue_plus/`）是两套独立实现，互不引用。

## 结构

- `wxmlDefinitionProvider.js`：WXML 标签 → 组件 JS 定义；微信内置标签（`wxTags`）返回空。
- `wxmlCompletionItemProvider.js`：WXML 标签 → `properties`/`bind:事件` 补全项。
- `jsonDefinitionProvider.js`：app.json `usingComponents` 的 `"path": "..."` → 组件 JS。
- `findComponentPath.js`：组件名 → 路径，先查页面 `.json` 的 `usingComponents`，回退到 app.json。
- `findRootPath.js`：向上找含 `app.json` 的根目录。
- `getProperties.js`：用 recast 解析组件 JS 的 `Component({...})`，提取 `properties` 与 `triggerEvent`。
- `wxTags.js`：内置 WXML 标签名清单（静态数据）。

## 契约

- **静默退化**：组件无 `properties`、页面 `.json` 缺失、找不到 `app.json`、JS 解析失败、任意 JSON 行不含冒号——这些都不是错误状态，而是小程序工程的常态。对应提供器必须返回 `[]` / `null` / `''`，不得抛异常、不得弹窗。
- `findRootPath` 向上迭代到盘符根仍无 `app.json` 时返回 `null`，所有调用方必须先判空。
- `getProperties` 用 recast 的默认 parser（esprima），现代语法会解析失败并退化为空列表——即“有补全但缺高端语法支持”，换 babel parser 是已记的改进项而非 bug。
