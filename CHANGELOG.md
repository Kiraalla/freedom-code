# Change Log

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)；格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [0.1.0] - 2026-10-30

自 **0.0.4**（上一个公开版本）以来的首次更新，内容较多，合并记录如下。含 **3 项破坏性变更**，迁移做法见每节标注。

主线是**让格式化不再改坏代码、让声明与实现一致、让行为可测**。

### 新增

- **Pug 支持**（`.pug` / `.jade`）
  - 自带 `text.pug` 语法与语言配置（取自同作者的 [pug-compile](https://github.com/Kiraalla/pug-compile)，MIT，来源见 `syntaxes/pug/NOTICE.md`）：标签、属性、内嵌 HTML / JS / TS、按缩进折叠。不再出现「未知语言 pug」的扩展警告，原有 50 条 pug 片段也不再是死配置。
  - 格式化由 `@prettier/plugin-pug` 提供（Prettier 内核没有 pug parser），选项与其他文件一样走 `prettierOptions` / `overrides` / 编辑器缩进。
  - 编译为 HTML：命令「编译 Pug 为 HTML」+ 保存自动编译（`freedomCode.pugAutoCompile`，默认关）。产物固定 `.html`，支持 `same` / `custom` / `relative` 与 `basedir`；HTML 可选交给 Prettier 美化（`freedomCode.pugPretty`，默认开），美化失败时退回未美化输出。
  - Vue 语法里 `text.pug` 的内嵌语言从已废弃的 `jade` 改为 `pug`，Vue 模板中的 Pug 段落恢复高亮。
- **CSS / WXSS 两种排版**：新增 `freedomCode.cssFormatStyle`（`normal` 默认 / `compact`）与命令「重选 CSS 格式化模式」。首次格式化 css/wxss 后会提示一次并可二选一，选择记在扩展状态里（不写用户 settings.json）。
- **风格统一**：命令「把格式化风格写入编辑器设置」把 `prettierOptions` 推导成 `editor.tabSize`、`editor.insertSpaces`、`editor.formatOnSave`、`files.insertFinalNewline`、`files.trimTrailingWhitespace` 及按 `overrides` 推导的语言级缩进，写入编辑器设置；写前逐项列出差异可取消。多根工作区下每个文件夹各写一份。
- **风格漂移提示**：工作区存在 `.wxml` / `.vue` 且编辑器缩进与扩展配置不一致时提示一次（`editor.tabSize: "auto"` 也算不一致），带「去同步」按钮。
- **配置校验**：`app.json`、`pages/**/*.json`、`components/**/*.json` 各挂一份 JSON Schema，获得补全、悬停与结构校验。
- **清单自检**：激活时比对自己清单里声明的设置与 VS Code 实际加载的设置；不一致（典型场景：装完新版但没重载窗口）时提示重载。
- **测试与 CI**：172 条纯 Node 单元测试 + 23 条真实 VS Code 宿主集成测试；GitHub Actions 在 push / PR 时跑 lint 与单元测试。

### 变更（破坏性）

- **`scssAutoCompile` 默认值由 `true` 改为 `false`**：保存 `.scss` 不再自动写 `.css`，需要时请显式开启。
- **`freedomCode.formatOnSave` 废弃**：保存时格式化改由 VS Code 的 `editor.formatOnSave` 负责；扩展不再自带保存钩子。旧设置仅在用户配置过时提示一次，不会改写你的 `settings.json`。
- **6 个设置键改为驼峰命名**（旧键仍会被读取，Settings 里标为已废弃）：
  `scss-compact-autoCompile` → `scssAutoCompile`、`wxml-activeDisable` → `wxmlActiveDisable`、`wxml-activeColor` → `wxmlActiveColor`、`wxml-tagNoActiveArr` → `wxmlTagNoActiveArr`、`vue-supportedLanguages` → `vueSupportedLanguages`、`vue-targetFileExtensions` → `vueTargetFileExtensions`。
- **`.sass`（缩进语法）不再声称支持格式化**：Prettier 没有对应 parser，格式化请求改为原样返回，让 VS Code 回退到其他格式化器；编译仍支持 `.sass`。
- **设置分类标题**从历史遗留的 `Freedom Helper` 改为 `Freedom Code`，与扩展显示名一致。

### 修复

格式化正确性：

- mustache / 花括号空格只作用于标记区域（Vue 的 `<template>`、WXML 全文）。此前字符串、正则字面量与空对象会被改写（如 `/{a}/` → `/{ a }/`）。
- WXML 的 `<template>` 与 `<wxs>` 块整体原样保留。此前 `<wxs>` 里的 JS 会被当 HTML 文本重排，多行合并后 `//` 注释会吞掉后续代码。
- 紧凑排版不再破坏 `@media` / `@keyframes`：旧实现用 `{([^}]+)}` 正则，容器块会被压平并错位换行；现在递归解析块结构。SCSS 编译产物同样受益。
- 修复 `ConfigManager` 缓存只按文件类型键控导致的 overrides 串味，并去掉 10 秒 TTL（改配置立即生效）。

编辑器协同：

- 编辑器缩进（含 `[vue]` 这类语言级设置）现在真正生效；优先级为**用户显式配置 > 编辑器 options > 扩展默认值**。此前 `prettierOptions.tabWidth` 与 `overrides` 里的缩进会被编辑器无条件覆盖。
- 在 wxml / html / vue 中键入 `=` 补 `""` 只在标记区的起始标签内生效，且改为最小插入、支持多光标。此前在 Vue `<script>` 里写 `let a = 1` 会变成 `let a ="" 1`。
- 修复 10 个 `extension.format*` 命令声明了但从未注册（命令面板调用报 "command not found"）；命令面板调用创建类命令时不再因缺少 `resource` 崩溃，退回工作区根目录。
- 修复监听器与 decoration 泄漏：保存钩子不再随配置变化叠加、关闭文件的标签高亮会被释放、扩展卸载时清理干净。

配置：

- **`freedomCode.scssAutoCompile: true` 设了却不编译**：读取设置时把带 scope 的全键传给了已带 scope 的配置对象，键被双重加前缀而永远退回默认。同一根因还让 `wxmlActiveColor`、`wxmlActiveDisable`、`wxmlTagNoActiveArr`、`vueSupportedLanguages`、`vueTargetFileExtensions` 全部失效，现已一并修好。
- **设置界面上看不到部分设置、settings.json 里标灰**：配置贡献里用了官方 schema 不认识的字段（`groups` 与设置项里的 `group`），严格校验的 VS Code 会丢弃整段配置贡献。

小程序与代码块：

- 定义跳转与补全遇到异常时静默返回空，不再崩溃或弹窗：组件无 `properties`、页面无同名 `.json`、找不到 `app.json`（原实现会无限递归）、任意 JSON 行不含冒号、Vue 跳转在 Windows 上失效。
- 小程序页面在非 `pages/` 目录创建时不再被登记成 `pages/undefined/index`：现在按相对小程序根的真实路径登记，分包按 `subPackages[].root` 最长前缀判定。
- 代码块：修正 126 条把 `${selector}` 当占位符的写法（VS Code 会插入字面文本）、3 处复制粘贴错误（`animation-left` 用了 `animation.height`、`jqLoadPost` 用了 GET、两个重复条目）、删除 68 条 body 与 prefix 相同的伪代码块并消除 10 处前缀冲突、补齐描述、删除已废弃的 `jade` 语言贡献。

### 移除

- 4 个从未生效的设置：`enableJQuerySnippets`、`enableLayuiSnippets`、`enableVantSnippets`、`enableWeappSnippets`（VS Code 没有运行时禁用已声明代码片段的能力）。
- 废弃命令 `extension.compileOff` / `extension.compileOn`。
- 死代码：`util/findComponentName.js`、`wxml_plus/FormatWxml.js`、`wxml_plus/saveFormat.js` 及若干未使用的内部函数。
- `activationEvents` 字段（交给 VS Code 从 `contributes` 推导）。
- 仓库根目录的 4 个 `.vsix` 构建产物移出版本控制。

### 内部

- 纯函数层抽出（不依赖 `vscode`，可单测）：`wxml_plus/pipeline.js`、`wxml_plus/editor-contract.js`、`util/settings.js`、`util/css_formatter.js`、`util/output-path.js`、`util/page-entry.js`、`util/style-settings.js`、`util/snippet-placeholders.js`。
- 组合根拆分：`extension.js` 从 852 行降到约 130 行，命令 / 特性 / 提供器分目录，各自导出 `register(context, deps)`。
- SCSS 编译与 CSS 紧凑排版共用同一份实现；输出路径策略与 Pug 编译共用。

## [0.0.4] 及更早

早期版本无系统记录。`0.0.1`–`0.0.4` 为模板创建、格式化、代码块与语法高亮的初版实现。
