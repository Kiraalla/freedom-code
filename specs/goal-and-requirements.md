---
id: freedom-code-goal
type: goal-and-requirements
title: Freedom Code — 产品目标与需求
status: draft
---

# Freedom Code — 产品目标与需求

## 目标

Freedom Code 是一个 VS Code 扩展，为微信小程序（WXML/WXSS）与 Vue 开发者提供一套开箱即用的开发辅助能力：多语言代码格式化、模板/脚手架文件创建、代码片段、WXML 标签高亮、组件定义跳转、属性补全，以及 SCSS/SASS 编译为 CSS。

问题：微信小程序与 Vue 项目缺少一个统一、低配置的前端开发辅助扩展——格式化、片段、模板、跳转各成一体，配置分散。

## 受众

微信小程序（WXML/WXSS/JS）与 Vue 2/3 前端开发者，运行于 VS Code。

## 能力（代码已实现）

- **统一格式化**：通过 Prettier 为 wxml / vue / wxss / scss / less / css / html / javascript / typescript 提供一致的文档与选区格式化，保存时格式化由 VS Code 的 `editor.formatOnSave` 驱动，支持按文件类型 overrides 配置、mustache 空格风格。`.sass` 缩进语法不在其中（Prettier 无对应 parser），只支持编译为 CSS。
- **模板创建**：在资源管理器右键创建 Vue2/Vue3 组件、HTML、Pinia/Vuex 模块、Service、工具文件（polyfill/utils），以及小程序页面/组件（自动写入 app.json）。
- **代码片段**：CSS（及 SCSS/Less/WXSS）、HTML、JS/TS/JSX/TSX、jQuery、Layui、Vant、Vue、小程序代码片段。片段不受设置开关控制（VS Code 无运行时禁用能力）。
- **语法与语言**：提供 WXML/WXSS/Vue 语言定义、TextMate 语法高亮与 language-configuration。
- **WXML 标签高亮**：按配置高亮 WXML 标签（可禁用、可配颜色、可排除标签）。
- **定义跳转**：WXML 组件跳转（usingComponents）、JSON 配置跳转、Vue 组件名跳转。
- **属性补全**：WXML 组件属性/事件补全（解析组件 JS 的 properties 与 triggerEvent）。
- **属性引号补全**：在 wxml/html/vue 的起始标签内键入 `=` 自动补全 `=""`，支持多光标。
- **app.json 补全与校验**：为 `app.json` 提供 JSON Schema，编辑器据此给出补全、悬停与结构校验。
- **页面 / 组件配置补全与校验**：`pages/**/*.json` 与 `components/**/*.json` 各自获得对应 schema 的补全与校验。
- **风格统一**：把扩展的格式化风格（缩进、保存时格式化、末尾换行、行尾空白）一键写进工作区编辑器设置，使“手敲的代码”与“格式化后的代码”风格一致；发现不一致时提示一次。
- **SCSS/SASS 编译**：保存或命令触发编译为 CSS（自定义输出路径/扩展名，紧凑格式）。

## 非目标（推断，待确认）

- 不是语言服务器，也不做类型检查、lint 或诊断。
- 不是小程序构建工具（不做打包、压缩、上传）。
- 仅面向 VS Code，不支持其他编辑器。
- 不提供 CSS 之外的语言转译（如 Less→CSS、PostCSS 处理）。

## 原则

- 零配置优先：默认值即开箱可用，所有能力都可选开启/关闭。
- 面向小程序与 Vue 的约定：默认行为贴合小程序 .wxss/.acss 与 Vue 单文件组件习惯。
