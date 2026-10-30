# Change Log

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)；格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [0.2.4] - 2026-10-30

### 新增

- **清单自检**：激活时比对自己清单里声明的设置与 VS Code 实际加载的设置。若不一致（典型场景：装完新版 VSIX 但没重载窗口 —— 代码是新的、扩展元数据还是旧的），弹一次警告并提供「重载窗口」按钮。按版本记账，重载后不再提示。

### 变更

- 设置分类标题从历史遗留的 `Freedom Helper` 改为 **`Freedom Code`**，与扩展显示名一致。设置界面左侧不再显示旧名字。
## [0.2.3] - 2026-10-30

### 修复

- **所有设置项里的非标准 `group` 字段已移除**（31 处）。`contributes.configuration` 的官方 schema 只有 `title` / `id` / `order` / `properties`，设置项里也没有 `group` —— 它是历史遗留的死字段，真正的分组要用 `configuration` 的数组形式。与上一版移除的 `groups` 一起，配置贡献现在完全符合 schema。

> 影响说明：0.2.0–0.2.1 在严格校验的 VS Code 上会整段丢弃配置贡献。那种情况下**所有默认值都缺失**（例如 `prettierOptions` 退回 `{}`、`bracketSameLine` 不再默认为 `true`），装 0.2.3 后默认值才真正生效，格式化输出可能与之前略有不同。
## [0.2.2] - 2026-10-30

### 修复

- **扩展设置显示为「未知配置项」（灰色）**：`contributes.configuration` 里用了自造的 `groups` 字段，而 VS Code 官方 schema 只接受 `title` / `id` / `order` / `properties`。新版 VS Code 会忽略未知字段，旧版严格校验时会**丢弃整段配置贡献** —— 所有设置因此在设置界面消失、在 settings.json 里标灰。已移除该字段。
- 新增两条守卫：`contributes.configuration` 只能用官方支持的键；且每个声明的设置项在真实宿主里都必须能读到 `defaultValue`（配置贡献被整段丢弃时会失败）。
## [0.2.1] - 2026-10-30

### 新增

- **Pug 语法高亮**：自带 `text.pug` 语法与语言配置（取自同作者的 pug-compile，MIT；来源见 `syntaxes/pug/NOTICE.md`），内嵌 HTML / JS / TS 高亮，按缩进折叠。
- 保存 Pug 时若未开启自动编译，提示一次并可一键开启。

### 修复

- **装扩展前就打开的 `.pug` 标签页保存时不编译**：VS Code 不会为已打开的文档刷新语言关联，`languageId` 仍是 `plaintext`，保存钩子被直接跳过。现在按扩展名（`.pug` / `.jade`）兜底识别。
- Vue 语法里 `text.pug` 的内嵌语言从已废弃的 `jade` 改为 `pug`（此前 Vue 模板中的 Pug 段落没有高亮）。
## [0.2.0] - 2026-10-30

### 新增

- **Pug 支持**：声明 `.pug` / `.jade` 语言 —— 因此不再出现「未知语言 pug」的清单警告，那 50 条 pug 片段也不再是死配置。
  - 格式化由 `@prettier/plugin-pug` 提供（Prettier 内核没有 pug parser），选项与其他文件一样走 `prettierOptions` / `overrides` / 编辑器缩进。
  - 编译为 HTML：命令「编译 Pug 为 HTML」+ 保存自动编译（`freedomCode.pugAutoCompile`）；输出固定 `.html`，支持 `same` / `custom` / `relative` 与 `basedir`。
  - HTML 可选交给 Prettier 美化（`freedomCode.pugPretty`，默认开）；美化失败时退回未美化输出，不让编译失败。
  - **不提供** Pug 语法高亮：装了 Pug 扩展则沿用它的。
- **CSS 排版可选两种模式**：新增设置 `freedomCode.cssFormatStyle`（`normal` 默认 / `compact`）与命令「重选 CSS 格式化模式（标准 / 紧凑）」。首次格式化 css/wxss 后会提示一次并可二选一，选择记在扩展状态里（不写用户 settings.json）。

### 修复

- **紧凑排版不再破坏 `@media` / `@keyframes`**：旧实现用 `{([^}]+)}` 正则，容器块会被压平并错位换行。现在递归解析块结构、容器内按层缩进 —— SCSS 编译产物同样受益。

### 变更

- SCSS 编译与 CSS 紧凑排版共用同一份实现（`util/css_formatter.js`）；输出路径策略与 Pug 编译共用（`util/output-path.js`）。
## [0.1.1] - 2026-10-30

修两个 0.1.0 里被发现的问题。

### 修复

- **`freedomCode.scssAutoCompile: true` 设了却不编译**。`readSetting` 把带 scope 的全键传给了已带 scope 的配置对象，键被双重加前缀（`freedomCode.freedomCode.scssAutoCompile`），永远读不到显式值、一律退回默认。同一个根因还让 `wxmlActiveColor`、`wxmlActiveDisable`、`wxmlTagNoActiveArr`、`vueSupportedLanguages`、`vueTargetFileExtensions` 全部失效 —— 现已一并修好。
- **`prettierOptions.tabWidth` 与 `overrides` 里的缩进无效，只有 `editor.tabSize` 生效**。编辑器传入的 `FormattingOptions` 无条件覆盖了 `tabWidth` / `useTabs`。现在优先级为：**用户显式配置 > 编辑器 options > 扩展默认值**；只有你没显式写缩进时才跟随编辑器。

新增回归测试：`test/unit/scss-autocompile.test.js`（5 条，含旧键兼容）、`test/unit/settings-scope.test.js`（静态守卫）、`test/integration/settings.test.js`（6 条真实宿主用例，含“scoped + 全键”陷阱的记录）。

## [0.1.0] - 2026-10-30

这一版的主线是**让格式化不再改坏代码、让声明与实现一致、让行为可测**。含 3 项破坏性变更，见「变更」一节。

### 新增

- **风格统一**：新增命令「把格式化风格写入编辑器设置」（`extension.syncEditorStyleSettings`）。把 `freedomCode.prettierOptions` 推导成 `editor.tabSize`、`editor.insertSpaces`、`editor.formatOnSave`、`files.insertFinalNewline`、`files.trimTrailingWhitespace` 以及按 `overrides` 推导的语言级缩进，写入编辑器设置；写前逐项列出差异、可取消。多根工作区下每个文件夹各写一份。
- **风格漂移提示**：工作区里存在 `.wxml`/`.vue` 且编辑器缩进与扩展配置不一致时提示一次（`editor.tabSize: "auto"` 也算不一致），带「去同步」按钮。
- 页面与组件的 json 获得补全与校验：`pages/**/*.json`、`components/**/*.json` 各挂一份 schema。
- 新增 12 个 `extension.format*` 之外的命令注册修复、单元测试与 CI（详见「修复」）。

### 变更（破坏性）

- **`scssAutoCompile` 默认值由 `true` 改为 `false`**：保存 `.scss` 不再自动写 `.css`，需要时请显式开启。
- **`freedomCode.formatOnSave` 废弃**：保存时格式化改由 VS Code 的 `editor.formatOnSave` 负责。扩展不再自带保存钩子；旧设置仅在用户配置过时提示一次，不会改写你的 `settings.json`。
- **6 个设置键改为驼峰命名**（旧键仍会被读取，Settings 里标为已废弃）：
  `scss-compact-autoCompile` → `scssAutoCompile`、`wxml-activeDisable` → `wxmlActiveDisable`、`wxml-activeColor` → `wxmlActiveColor`、`wxml-tagNoActiveArr` → `wxmlTagNoActiveArr`、`vue-supportedLanguages` → `vueSupportedLanguages`、`vue-targetFileExtensions` → `vueTargetFileExtensions`。
- **`.sass`（缩进语法）不再声称支持格式化**：Prettier 没有对应 parser，格式化请求改为原样返回，让 VS Code 回退到其他格式化器；编译仍支持 `.sass`。

### 修复

- 格式化不再改坏非标记区域：mustache/花括号空格只作用于 Vue 的 `<template>` 与 WXML 全文。此前字符串、正则字面量与空对象会被改写（如 `/{a}/` → `/{ a }/`）。
- WXML 的 `<template>` 与 `<wxs>` 块整体原样保留。此前 `<wxs>` 里的 JS 会被当 HTML 文本重排，多行合并后 `//` 注释会吞掉后续代码。
- 在 wxml/html/vue 中键入 `=` 补 `""` 只在标记区的起始标签内生效，且改为最小插入、支持多光标。此前在 Vue `<script>` 里写 `let a = 1` 会变成 `let a ="" 1`。
- 编辑器缩进（含 `[vue]` 这类语言级设置）现在真正生效。
- 定义跳转与补全遇到异常时静默返回空，不再崩溃或弹窗：组件无 `properties`、页面无同名 `.json`、找不到 `app.json`（原实现会无限递归）、任意 JSON 行不含冒号、Vue 跳转在 Windows 上失效。
- 修复监听器与 decoration 泄漏：保存钩子不再随配置变化叠加、关闭文件的标签高亮会被释放、扩展卸载时清理干净。
- 修复 `ConfigManager` 缓存只按文件类型键控导致的 overrides 串味，并去掉 10 秒 TTL（改配置立即生效）。
- 修复小程序页面在非 `pages/` 目录创建时被登记成 `pages/undefined/index`：现在按相对小程序根的真实路径登记，分包按 `subPackages[].root` 最长前缀判定。
- 修复 10 个 `extension.format*` 命令声明了但从未注册（命令面板调用报 "command not found"）；命令面板调用创建类命令时不再因缺少 `resource` 崩溃，退回工作区根目录。
- 代码块：修正 126 条把 `${selector}` 当占位符的写法（VS Code 会插入字面文本）、3 处复制粘贴错误（`animation-left`、`jqLoadPost`、两个重复条目）、删除 68 条 body 与 prefix 相同的伪代码块并消除 10 处前缀冲突、补齐描述、删除已废弃的 `jade` 语言贡献。

### 移除

- 4 个从未生效的设置：`enableJQuerySnippets`、`enableLayuiSnippets`、`enableVantSnippets`、`enableWeappSnippets`（VS Code 没有运行时禁用已声明代码片段的能力）。
- 废弃命令 `extension.compileOff` / `extension.compileOn`。
- 死代码：`util/findComponentName.js`、`wxml_plus/FormatWxml.js`、`wxml_plus/saveFormat.js` 及若干未使用的内部函数。
- `activationEvents` 字段（交给 VS Code 从 `contributes` 推导）。
- 仓库根目录的 4 个 `.vsix` 构建产物移出版本控制。

## [0.0.4] 及更早

早期版本无系统记录。`0.0.1`–`0.0.4` 为模板创建、格式化、代码块与语法高亮的初版实现。
