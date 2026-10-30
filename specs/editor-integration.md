---
id: freedom-code-editor-integration
type: module-design
title: Freedom Code — 编辑器协同层
status: draft
parent: freedom-code-arch
---

# 编辑器协同层

## 职责

决定"哪些事交给编辑器、哪些事扩展自己做"。原则：触发时机、缩进来源、撤销粒度、命令入口一律归 VS Code；扩展只补编辑器做不到的部分（Prettier 不支持的 WXML 语义、标签内自动补引号）。

## 边界

- 纯函数部分在 `wxml_plus/editor-contract.js`（不 import `vscode`，可单测）；装配在 `extension.js`。
- 不拥有格式化算法（那是 `freedom-code-formatting` 的事），只决定参数与触发方式。

## 契约

- **保存时格式化只归 `editor.formatOnSave`**。扩展注册格式化提供器，不再自带 `onWillSaveTextDocument` 钩子——两个开关做同一件事会格式化两遍。`freedomCode.formatOnSave` 保留声明但标 `deprecationMessage`；仅当用户确实配置过它时提示一次（`globalState` 标记），**绝不改写用户的 settings.json**。
- **缩进优先级：用户显式配置 > 编辑器 options > 扩展默认值**。
  - 用户在 `prettierOptions`（或匹配的 `overrides[].options`、兼容的 `${fileType}PrettierOptions`）里**显式写了** `tabWidth` / `useTabs` → 用用户的值，编辑器不推翻；
  - 没写 → 用 `provideDocumentFormattingEdits(document, options)` 传来的 `FormattingOptions`；
  - 两者都没有 → 用 `package.json` 的默认值。

  判定“显式”必须用 `inspect()`（`ConfigManager.getExplicitIndentSetting`），不能用 `get()`：`prettierOptions` 有默认值，`get()` 永远有值。曾因无条件用编辑器值覆盖，导致“设了 `tabWidth: 4` 却不生效”。
- **写入方向仍只通过命令**：`extension.syncEditorStyleSettings` 把 `prettierOptions` 推导成编辑器设置写进工作区，使“手敲的缩进”与“格式化后的缩进”一致。先显式对齐，再让编辑器成为运行时来源。
- **配置读取必须用根配置 + 全键**：`readSetting(configuration, ['freedomCode.x', ...])` 内部走 `inspect()`，如果把带 scope 的全键传给 `getConfiguration('freedomCode')`，键会变成 `freedomCode.freedomCode.x`，静默退回默认值（曾导致 `scssAutoCompile: true` 不编译、WXML 高亮与 Vue 跳转设置全部失效）。由 `test/unit/settings-scope.test.js` 与 `test/integration/settings.test.js` 双重守望。
- **`=` 补引号**（`decideQuoteInsertion`）：只在 wxml/html/vue 的**起始标签内**、属性名后、光标紧跟 `=` 时插入一对 `""`，光标落进引号中间。必须是属性名字符（覆盖 `v-model`/`:src`/`@tap`/`[prop]`）、不在成对引号内、等号后不是 `=` 或已有引号。**必须位于未闭合的起始标签内**这一条同时排掉 `<script>`/`<style>` 正文、文本内容与 JS 赋值。
- **多光标**：`OnTypeFormattingEditProvider` 在 VS Code 里多光标时**直接不触发**（`formatActions.ts` 的 `_trigger` 早退），因此本功能走 `onDidChangeTextDocument`：按 `contentChanges` 逐个算插入点，**一次 `editor.edit` 只做最小插入**（不整行替换），光标用 `mapCursorAfterInsertions` 重算。
- **命令面**：package.json 声明的每个命令都必须注册；`extension.format*` 一律转调 `editor.action.formatDocument`，不自建格式化入口。`registerCommand` 必须 `return` handler 的结果，让异步命令可被 await、异常可被捕获。创建类命令走 `registerFolderCommand`：没有 `resource`（命令面板调用）时退回 `workspaceFolders[0]`，无工作区则提示后返回。
- **风格写入编辑器（只通过显式命令）**：`extension.syncEditorStyleSettings` 从 `prettierOptions` 推导 `editor.tabSize`/`editor.insertSpaces`/`editor.formatOnSave`/`files.insertFinalNewline`/`files.trimTrailingWhitespace`，以及 `overrides` 推导出的语言级缩进；写前必须逐项展示"键 / 当前值 → 新值 / 作用域"供确认，已一致项不出现。**不写 `editor.defaultFormatter`**（不抢用户已有的 Prettier 选择）。
- **写入作用域**：多根工作区下**每个文件夹各写一份**（`ConfigurationTarget.WorkspaceFolder`，各算各自差异、条目带文件夹名）；单根或无文件夹时写工作区层（`ConfigurationTarget.Workspace`），与引入多根支持前一致。
- **漂移提示**：只在工作区存在 `**/*.{wxml,vue}` 时检查；`editor.tabSize: 'auto'`（未显式设置）**也视为不一致**；`globalState` 记标记、只提示一次，失败不得阻塞激活。

## 已知限制

- 补引号依赖"同一行内能判断标签上下文"，跨行标签（属性名在上一行）不补。
- 语言 id 与 `unifiedFormat` 的 `fileType` 直接同名透传，新增语言需要两处同时改（`SUPPORTED_FORMATTING_LANGUAGES` 与 `format_core` 的 `parserMap`）。
