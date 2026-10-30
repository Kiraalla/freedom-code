---
id: freedom-code-templates
type: module-design
title: Freedom Code — 模板创建模块
status: draft
parent: freedom-code-arch
---

# 模板创建模块

## 职责

从内置模板创建文件/文件夹：Vue2/Vue3 组件、HTML、Pinia/Vuex 模块、Service、工具文件，以及小程序页面/组件（含写入 app.json 的 `pages`/`subPackages[].pages`）。

## 边界

- 允许依赖：`vscode`；模板内容来自 `template/*` 字符串模块；创建动作统一走 `util/fileCreator.js`。
- 小程序页面的 app.json 注册逻辑内联在 `extension.js` 的命令回调中（不在本模块的 fileCreator 内）。

## 结构

- `util/fileCreator.js`：`createTemplateFile`（单文件，覆盖确认）、`createFolderWithFiles`（多文件，已存在则拒绝）。

## 契约

创建类命令一律经 `registerFolderCommand` 注册：资源管理器右键传入 `resource` 就用它；命令面板调用没有 `resource` 时退回工作区根目录；连工作区都没有则提示后返回，不得因 `undefined.fsPath` 崩溃（细节见 `freedom-code-editor-integration`）。

**小程序页面的 app.json 登记路径**（`util/page-entry.js` 的 `derivePageEntry`）：

- `pages` 条目是**相对小程序根的真实路径**，不要求以 `pages/` 开头；
- 分包判定靠 app.json 自己的 `subPackages[].root`，且取**最长匹配前缀**（`sub` 与 `sub/inner` 同时命中时选后者）；分包内条目相对 root；
- 因此路径推导必须在**读到并解析 app.json 之后**才能进行 —— 以前的 `split('pages/')` 实现在非 `pages/` 目录下会写入 `pages/undefined/index`。
- `template/*`：各模板的内容字符串（html、pinia、service、polyfill、utils、vue2/vue3、vuex、wxjs-container/module）。
