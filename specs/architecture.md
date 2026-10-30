---
id: freedom-code-arch
type: architecture-design
title: Freedom Code — 架构设计
status: draft
parent: freedom-code-goal
---

# Freedom Code — 架构设计

## 拓扑

单入口 VS Code 扩展。`extension.js` 只做组合根（~130 行）：建输出通道与 Logger、监听配置变更、按顺序调用各模块的 `register`。能力实现分布在 `commands/`、`features/`、`providers/` 下，每个模块导出 `register(context, deps)`，`deps` 只含跳模块共享的东西（目前是 `logger`）。

配置类功能分两层：**纯函数层**（不 import `vscode`，可在 `node --test` 下单测）与 **宿主层**（依赖 `vscode` API）。凡是"文本怎么变"的决策都下沉到纯函数层。

## 模块边界与依赖

| 模块 | 位置 | 职责 |
|---|---|---|
| 入口 | `extension.js` | 组合根：装配并注册所有能力（~130 行） |
| 命令层 | `commands/registry.js`、`commands/templates.js`、`commands/miniapp.js`、`commands/format.js`、`commands/scss.js`、`commands/style-settings.js` | 命令注册助手、模板/小程序/格式化/编译/风格同步命令 |
| 特性层 | `features/auto-quote.js`、`features/highlight.js`、`features/style-drift.js` | `=` 补引号、WXML 标签高亮、风格漂移提示 |
| 提供器层 | `providers/formatting.js`、`providers/definitions.js` | 格式化提供器、定义跳转与补全的注册 |
| 纯函数管线 | `wxml_plus/pipeline.js` | 区域切分、模板块保护、注释保护、mustache 作用域、text 压缩 —— 无 `vscode` 依赖 |
| 编辑器协同层 | `wxml_plus/editor-contract.js` + `extension.js` 的命令面 | 触发归属、缩进来源、`=` 补引号判定 —— 纯函数部分无 `vscode` 依赖（见 `freedom-code-editor-integration`） |
| 设置读取 | `util/settings.js` | 显式值优先、旧键回退、是否显式设置过 —— 无 `vscode` 依赖 |
| 风格推导 | `util/style-settings.js`（纯）+ `util/style-settings-host.js`（宿主） | prettierOptions → 编辑器设置的推导与差异；读当前值、写入工作区 |
| 页面路径 | `util/page-entry.js` | 小程序页面在 app.json 里的登记条目 —— 无 `vscode` 依赖 |
| 格式化 | `wxml_plus/format_core.js` | 编排管线与 Prettier |
| WXML 高亮 | `wxml_plus/ActiveText.js`、`wxml_plus/config.js` | 标签装饰高亮 |
| Vue 跳转 | `vue_plus/PeekFileDefinitionProvider.js` | Vue 组件名→文件跳转 |
| 小程序智能 | `util/wxmlDefinitionProvider.js`、`util/wxmlCompletionItemProvider.js`、`util/jsonDefinitionProvider.js`、`util/findComponentPath.js`、`util/findRootPath.js`、`util/getProperties.js`、`util/wxTags.js` | WXML/JSON 定义跳转与属性补全 |
| SCSS 编译 | `util/scss_compiler.js` | SCSS/SASS→CSS |
| Pug 支持 | `util/pug_compiler.js`、`commands/pug.js`（见 `freedom-code-pug`） | Pug→HTML；格式化由 `@prettier/plugin-pug` 提供 |
| 模板创建 | `template/*`、`util/fileCreator.js` | 脚手架文件与 app.json 注册 |
| 日志 | `util/logger.js` | 输出通道日志 |
| 声明资产 | `snippets/`、`syntaxes/`、`languages/`、`schemas/` | 片段、语法、语言配置、JSON Schema（纯声明数据，无代码；片段的数据契约见 `freedom-code-snippets`） |

依赖方向：`extension.js` → `commands/` / `features/` / `providers/` → 领域模块（`wxml_plus/`、`util/`、`vue_plus/`、`template/`）。`format_core` → `pipeline` 与 `editor-contract`（单向）。领域模块之间无直接 import。各模块只依赖 `vscode` API 与第三方库（`prettier`、`sass`、`recast`、`htmlparser2`）。

**分层约束**：纯函数层（`pipeline.js`、`editor-contract.js`、`settings.js`）不得 import `vscode`，否则单测无从下手；宿主装配只能出现在 `commands/` / `features/` / `providers/` 与 `format_core.js` 里。

## 不变量（代码强制）

- **格式规则必须知道自己作用于哪个区域**。mustache/花括号空格只作用于标记区（Vue 的 `<template>` 内容、WXML 全文）；`<script>`、`<style>` 完全交给 Prettier。字符串、正则、模板字符串字面量永不被改写。
- **WXML 的 `<template>` 与 `<wxs>` 整块原样保留**：格式化前替换为哨兵注释，格式化后逐字符还原。Prettier 会把 `<wxs>` 当 HTML 文本重排，行被合并后 `//` 注释会吞掉后续代码。
- **提供器静默退化**：定义跳转、补全这类每次输入都可能触发的路径，遇到异常返回空值（`[]` / `null` / `''`），只记日志，不抛异常、不弹窗。
- **编辑器拥有的东西交回编辑器**：保存时格式化归 `editor.formatOnSave`，缩进归 `FormattingOptions`，文档格式化命令归 `editor.action.formatDocument`；扩展不另建一套触发路径（见 `freedom-code-editor-integration`）。
- **声明与注册必须一致**：`package.json` 里声明的每个命令、每个设置项都要有对应实现；反之实现里不得出现从未声明的命令或设置。由 `test/unit/config-contract.test.js` 守望（扫描源码 `get`/`inspect` 与 `package.json` 声明的双向比对）。
- **设置键命名**：一律 `freedomCode.<lowerCamelCase>`。改名不得让已配置的用户静默失效：旧键保留声明、不设默认值、带 `deprecationMessage`，代码用 `util/settings.js` 的 `readSetting` 读新键并回退旧键。**用 `get()` 做回退是错的**——新键的默认值会永远挡住旧键，必须用 `inspect()` 判显式值。
- **激活事件由 `contributes` 推导**：不手写 `activationEvents`，避免与实际贡献脱节（曾只列 7 个 `onLanguage`、缺 `vue`/`wxss`）。
- 格式化统一走 `format_core.unifiedFormat`；非 vue/wxml 直接交给 Prettier，wxml 先包裹进 Vue `<template>` 再格式化后解包。
- 格式化配置由 `format_core.ConfigManager` 缓存，键为 `fileType + filePath`（不能只按 `fileType`，否则带 `overrides` 的同类型文件会串味）；失效完全依赖“配置变更 → `clearCache()`”，不再用 TTL 兜底。
- WXML 标签高亮仅对 `languageId === 'wxml'` 且 `freedomCode.wxmlActiveDisable` 为 false 时生效。
- `=` 补引号只在标记区的起始标签内生效，并且支持多光标（细节与理由见 `freedom-code-editor-integration`）。
- SCSS 编译跳过 `_` 前缀文件（`ignoreUnderscoreFiles` 默认 true）。
- 创建小程序页面会改写 app.json（`pages` 或 `subPackages[].pages`），写入前备份、失败回滚。
- 一切监听器与 decoration 实例都必须能随扩展卸载释放（`context.subscriptions` 或 `deactivate`）。
- 多根工作区里设置必须各写各的（`ConfigurationTarget.WorkspaceFolder`）；单根或无文件夹才写 `Workspace`。

## 决策

- **WXML 用 Vue 模板包裹交给 Prettier**：Prettier 无 WXML parser，故把 WXML 包进 `<template>` 用 `vue` parser 格式化后再解包（推断）。解包依赖"包裹标签的 `</template>` 永远在最后"这一事实，且 WXML 自身的 `<template>` 已先被哨兵替换。
- **`<wxs>`/`<template>` 用哨兵注释而非占位文本**：注释是 Prettier 唯一保证逐字符保留的结构，占位文本会被当作正文重新排版。
- **`.sass`（缩进语法）不做格式化**：Prettier 只有 `scss` parser。格式化请求返回原文，让 VS Code 回退到下一个提供器；编译（dart-sass）仍支持 `.sass`。
- **遗留格式化器已删除**：`FormatWxml`/`saveFormat` 已移除（它们早已是死代码），格式化只有 `unifiedFormat` 一条路径。
- **SCSS 默认紧凑格式**：`scss_compiler` 输出自定义「一规则一行」的 compact 格式而非 sass 的 expanded/compressed，贴合小程序 .wxss/.acss 习惯（已确认）。
- **统一 + 按文件类型两套 Prettier 配置合并**：`prettierOptions`（统一）与 `${fileType}PrettierOptions`（已废弃，仅兼容）合并，`overrides` 由 ConfigManager 手动匹配。
- **只强制 WXML 方案必需的 Prettier 选项**：`parser: 'vue'` 与 `htmlWhitespaceSensitivity: 'ignore'` 被硬锁；`singleAttributePerLine` / `bracketSameLine` 尊重用户设置，默认值调到与被强制时一致（`bracketSameLine: true`），所以默认输出不变。
- **SCSS 自动编译默认关闭**：保存时静默写 `.css` 是嗄嗄式副作用，改为显式开启。
- **小程序配置校验交给编辑器**：`contributes.jsonValidation` 挂三份 schema —— `app.json`、`**/pages/**/*.json`（页面）、`**/components/**/*.json`（组件）。三份都设 `additionalProperties: true`：基础库持续新增配置，宁可少报错不误报。自定义目录不获得校验。
- **组合根只做装配**：`extension.js` 不直接持有业务逻辑；新能力应该新增一个 `commands/`、`features/` 或 `providers/` 模块并导出 `register(context, deps)`，而不是继续往 `activate()` 里塞。

## 已知限制（已确认）

- **测试分层**：58 条纯 Node 单元测试覆盖纯函数管线、编辑器契约、设置读取、缓存、小程序工具与配置契约；`test/integration/` 有 3 条真实宿主用例（命令注册、`<wxs>` 块保真、mustache 规范化）。**SCSS 编译、模板创建、WXML 高亮仍无任何测试**，且集成测试不进 CI。
- **`overrides` 的 glob 能力有限**：`ConfigManager.matchesPattern` 只支持 `*.ext` 与精确文件名，`**/*.scss`、目录、`{a,b}` 会静默不匹配（已用用例固定该行为）。
- **`<text>` 空白压缩会改变渲染**：`compressTextTags` 把多行内容压成一行，属于既有行为、未修。
- **`${fileType}PrettierOptions` 兼容合并仍在**：无文档但合法，删除会让配置过它的用户静默失效。
