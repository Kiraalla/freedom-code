### Freedom Code（自由代码）

一个面向微信小程序与 Vue 开发的 VS Code 扩展：统一格式化、模板创建、代码块、语法高亮、定义跳转、SCSS / Pug 编译。

> 当前版本 **0.1.0**（上一公开版本为 0.0.4）。完整变更见 [CHANGELOG.md](./CHANGELOG.md)；含 3 项破坏性变更，见 [配置迁移](#配置迁移)。

***

## 🚀 核心功能

### 模板创建

- **小程序开发**: 创建小程序页面和组件，自动配置 app.json
- **Vue 开发**: 支持 Vue 2 和 Vue 3 模板创建
- **状态管理**: 创建 Pinia、Vuex 模块
- **工具文件**: 快速创建工具类、Service 层文件
- **HTML 模板**: 标准 HTML 页面模板
- **属性输入优化**: 在 wxml、vue、html 中添加属性并键入等号时，自动补全双引号 `=""`（支持多光标/批量编辑，为每个匹配位置补全）

### 代码格式化

- **统一格式化器**: WXML、Vue、WXSS、HTML、CSS、SCSS、Less、JavaScript、TypeScript、Pug 共用一套基于 Prettier 的配置
- **与编辑器协同**: 缩进遵循编辑器（`editor.tabSize` 及 `[vue]` 这类语言级设置）；显式写在 `freedomCode.prettierOptions` 里的缩进优先
- **保存时格式化**: 由 VS Code 的 `editor.formatOnSave` 驱动（旧的 `freedomCode.formatOnSave` 已废弃）
- **风格统一**: 一条命令把扩展的格式化风格写进工作区设置，让手敲的缩进与格式化后的结果一致
- **CSS 两种排版**: 标准换行（每条属性一行）或单行紧凑（一条规则一行），可随时切换
- **调试模式**: 可选的详细日志输出，方便问题排查

### 代码智能

- **代码块支持**: 涵盖 CSS、HTML、JS、Vue、小程序等众多技术栈（完整清单见 [代码块对照表](./docs/snippets-reference.md)）
  - CSS 代码块支持所有样式预处理器（SCSS、Less、WXSS）
  - HTML 代码块支持 Vue 模板
  - JavaScript 代码块支持 TypeScript、JSX、TSX
  - Vant / Layui 代码块支持 Vue 模板
- **语法高亮**: WXML 标签自定义高亮，以及 Pug 语法高亮（内嵌 HTML / JS / TS、按缩进折叠）
- **定义跳转**: WXML 组件、`usingComponents` 配置、Vue 组件名均可跳转
- **自动补全**: 组件属性与事件补全；`app.json`、页面与组件的配置 json 有校验与补全（JSON Schema）
- **SCSS 编译**: 支持 SCSS/SASS 文件的编译为 CSS
  - 以紧凑 compact 的格式化输出
  - 支持自定义包含路径
  - 支持自定义输出扩展名（如 .wxss、.acss 等）
  - 自动处理非标准 CSS 扩展名的兼容性问题
  - 紧凑代码保留注释
- **Pug 支持**: `.pug` / `.jade` 的语法高亮、格式化与编译
  - 格式化由 `@prettier/plugin-pug` 提供，与项目其他文件的 Prettier 配置一致
  - 一键编译为 HTML（产物固定 `.html`），支持保存时自动编译
  - HTML 可选交给 Prettier 美化（尊重 `printWidth` / `tabWidth`）
  - 跳过 `_` 开头的部分文件；`include` / `extends` 支持 `basedir`

***

## ⚙️ 配置说明

### 快速开始

最常用的配置：

```json
{
  // 保存时自动格式化（推荐开启）
  "editor.formatOnSave": true
}
```

> 💡 **提示**: 本扩展只提供格式化器，保存时格式化由 VS Code 自带的 `editor.formatOnSave` 驱动。旧的 `freedomCode.formatOnSave` 已废弃。

### CSS / WXSS 的两种排版

CSS 类文件可以选两种排版：

| 模式 | 效果 |
| --- | --- |
| `normal`（默认） | 每条属性一行（Prettier 默认） |
| `compact` | 一条规则一行，属性用空格分隔；`@media` / `@keyframes` 内部仍按层缩进 |

```json
{
  "freedomCode.cssFormatStyle": "compact"
}
```

也可以不写设置：**首次格式化 css/wxss 后会提示一次**，点「选择模式」即可二选一，选完记住（存在扩展自己的状态里，不写你的 settings.json），之后不再打扰。随时可用命令面板的「重选 CSS 格式化模式（标准 / 紧凑）」切回。

> 💡 设置项显式写了就以它为准，且不会再弹提示。紧凑模式**不会删注释**。
> SCSS 的**编译产物**默认就是紧凑模式（`freedomCode.scssOutputCompact`），与这里的格式化选项互不影响。

### 让扩展统一你的编辑器风格

如果你担心编辑器自身的缩进/空白配置不合理，不必手改设置 —— 让扩展把自己的风格写进去：

1. 先在本扩展的 `freedomCode.prettierOptions` 里写你想要的风格（`tabWidth`、`useTabs`，可用 `overrides` 按文件类型覆盖）；
2. 命令面板执行 **“把格式化风格写入编辑器设置”**（`extension.syncEditorStyleSettings`）；
3. 勾选要写入的项 → 确认。

它会写进工作区 `.vscode/settings.json`：`editor.tabSize`、`editor.insertSpaces`、`editor.formatOnSave`、`files.insertFinalNewline`、`files.trimTrailingWhitespace`，以及 `overrides` 推导出的语言级缩进（如 `[scss]`）。不会改 `editor.defaultFormatter`，也不会在你未确认时写入任何东西。

工作区里存在 `.wxml`/`.vue` 文件且检测到不一致时，扩展会提示一次并给出“去同步”按钮。

多根工作区下每个文件夹各写一份自己的 `.vscode/settings.json`；预览列表会标注每一项属于哪个文件夹。

> 💡 **提示**: 详细的格式化配置请参考下方的 **格式化配置** 部分。

### 格式化配置

#### 统一配置（适用于所有文件）

```json
{
  "freedomCode.prettierOptions": {
    "printWidth": 80,
    "tabWidth": 2,
    "useTabs": false,
    "semi": false,
    "singleQuote": false,
    "singleAttributePerLine": false,
    "bracketSameLine": false,
    "htmlWhitespaceSensitivity": "ignore"
  },
  "freedomCode.mustacheSpacing": "space"
}
```

#### 单独配置不同文件类型（使用 overrides）

如果需要为不同文件类型设置不同的格式化规则,使用 `overrides` 配置:

```json
{
  "freedomCode.prettierOptions": {
    "printWidth": 80,
    "tabWidth": 2,
    "overrides": [
      {
        "files": ["*.scss", "*.sass"],
        "options": {
          "tabWidth": 4,
          "singleQuote": true,
          "printWidth": 120
        }
      },
      {
        "files": ["*.wxml", "*.wxss"],
        "options": {
          "tabWidth": 2,
          "printWidth": 120
        }
      },
      {
        "files": ["*.vue"],
        "options": {
          "singleQuote": true,
          "semi": true
        }
      }
    ]
  }
}
```

**常用配置示例**:

- **SCSS/SASS 单独配置** (4空格缩进,单引号):
  ```json
  {
    "freedomCode.prettierOptions": {
      "overrides": [
        {
          "files": ["*.scss", "*.sass"],
          "options": {
            "tabWidth": 4,
            "singleQuote": true
          }
        }
      ]
    }
  }
  ```
- **WXML/WXSS 单独配置** (2空格缩进,宽行):
  ```json
  {
    "freedomCode.prettierOptions": {
      "overrides": [
        {
          "files": ["*.wxml", "*.wxss"],
          "options": {
            "tabWidth": 2,
            "printWidth": 120
          }
        }
      ]
    }
  }
  ```

> 📝 **注意**: `overrides` 配置会覆盖统一配置中的相同选项。

### 高级配置

#### WXML 标签高亮

```json
{
  "freedomCode.wxmlActiveDisable": false,
  "freedomCode.wxmlActiveColor": {
    "color": "#00ffff"
  }
}
```

#### Vue 定义跳转

```json
{
  "freedomCode.vueSupportedLanguages": ["vue", "javascript", "typescript"],
  "freedomCode.vueTargetFileExtensions": [".vue", ".js", ".ts"]
}
```

#### SCSS / SASS 编译

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| `freedomCode.scssAutoCompile` | `false` | 保存 `.scss` / `.sass` 时自动编译 |
| `freedomCode.scssOutputExtension` | `.css` | 输出扩展名，如 `.wxss`、`.acss` |
| `freedomCode.scssOutputPathFormat` | `same` | `same` 同目录 / `custom` 固定目录 / `relative` 工作区相对目录 |
| `freedomCode.scssOutputPath` | `""` | 目录路径（配合 `custom` / `relative`） |
| `freedomCode.scssIncludePaths` | `[]` | 额外的 `@use` / `@import` 查找路径 |
| `freedomCode.scssIgnoreUnderscoreFiles` | `true` | 跳过 `_` 开头的部分文件（partial） |
| `freedomCode.scssOutputCompact` | `true` | 输出紧凑格式（一条规则一行） |
| `freedomCode.scssPreserveComments` | `false` | 在输出的 CSS 中保留注释 |
| `freedomCode.scssRemoveCharset` | `true` | 移除输出中的 `@charset` |

> 💡 **提示**：`scssAutoCompile` 默认**关闭**。升级后如果发现保存时不再自动编译，请显式把它设为 `true`。

#### Pug 编译

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| `freedomCode.pugAutoCompile` | `false` | 保存 `.pug` 时自动编译 |
| `freedomCode.pugPretty` | `true` | 用 Prettier 美化编译出的 HTML |
| `freedomCode.pugIgnoreUnderscore` | `true` | 跳过 `_` 开头的部分文件 |
| `freedomCode.pugOutputPath` | `""` | 输出目录（留空则同目录） |
| `freedomCode.pugOutputPathFormat` | `same` | `same` / `custom` / `relative` |
| `freedomCode.pugBasedir` | `""` | `include` / `extends` 的基准目录 |

编译产物固定为 **`.html`**（Pug 没有自定义后缀的语义）。命令面板可用「编译 Pug 为 HTML」。

缩进优先级：**显式配置 > 编辑器 > 默认值**。你在 `freedomCode.prettierOptions`（或 `overrides`）里写了的 `tabWidth`/`useTabs` 会盖过 `editor.tabSize`；没写才跟随编辑器。

### 调试模式

遇到问题时启用：

```json
{
  "freedomCode.debugMode": true
}
```

启用后可以在输出面板（查看 → 输出 → 选择"Freedom Code"）中查看详细的调试日志。

***

## 配置迁移

### 0.1.0 的变更（需注意）

| 变更 | 影响 | 怎么做 |
| --- | --- | --- |
| `freedomCode.formatOnSave` 废弃 | 不再由扩展负责保存时格式化 | 改用 VS Code 自带的 `editor.formatOnSave` |
| `scssAutoCompile` 默认改为 `false` | 保存 `.scss` 不再自动写 `.css` | 需要时显式开启 |
| 6 个设置键改为驼峰命名 | 旧键仍会被读取，Settings 里标为已废弃 | 换成新键：`scssAutoCompile`、`wxmlActiveDisable`、`wxmlActiveColor`、`wxmlTagNoActiveArr`、`vueSupportedLanguages`、`vueTargetFileExtensions` |
| `enable*Snippets` 四个开关移除 | 它们从未生效（VS Code 没有运行时禁用已声明代码片段的能力） | 从 settings.json 里删掉即可 |
| `.sass`（缩进语法）不再格式化 | Prettier 没有对应 parser | 格式化交给其他提供器；编译（.sass → .css）仍支持 |
| `compileOff` / `compileOn` 命令移除 | 它们只写一个已失效的设置 | 改用 `editor.formatOnSave` |

### 更早版本的废弃项

以下配置自 0.0.x 起已废弃，保留仅为兼容旧配置的读取：

- `freedomCode.vue-format-save-code`
- `freedomCode.wxml-format-save-code`
- `freedomCode.wxss-format-save-code`
- `freedomCode.html-format-save-code`
- `freedomCode.css-format-save-code`
- `freedomCode.scss-format-save-code`
- `freedomCode.sass-format-save-code`
- `freedomCode.less-format-save-code`
- `freedomCode.javascript-format-save-code`
- `freedomCode.typescript-format-save-code`
- `freedomCode.vuePrettierOptions`
- `freedomCode.wxmlPrettierOptions`
- `freedomCode.wxssPrettierOptions`
- `freedomCode.scssPrettierOptions`
- `freedomCode.sassPrettierOptions`
- `freedomCode.lessPrettierOptions`
- `freedomCode.cssPrettierOptions`
- `freedomCode.htmlPrettierOptions`
- `freedomCode.javascriptPrettierOptions`
- `freedomCode.typescriptPrettierOptions`

### 迁移到新配置

**之前 (旧配置)**:

```json
{
  "freedomCode.vue-format-save-code": true,
  "freedomCode.scssPrettierOptions": {
    "singleQuote": true,
    "printWidth": 120
  }
}
```

**现在 (新配置)**:

```json
{
  "freedomCode.prettierOptions": {
    "printWidth": 80,
    "tabWidth": 2,
    "overrides": [
      {
        "files": ["*.scss", "*.sass"],
        "options": {
          "singleQuote": true,
          "printWidth": 120
        }
      }
    ]
  }
}
```

### 配置对比

| 旧配置                                | 新配置                                     | 说明                                       |
| ---------------------------------- | --------------------------------------- | ---------------------------------------- |
| `freedomCode.vue-format-save-code` | `editor.formatOnSave`                   | 保存时格式化交给编辑器；本扩展旧开关已废弃                  |
| `freedomCode.scssPrettierOptions`  | `freedomCode.prettierOptions.overrides` | 使用 overrides 配置不同文件类型                   |
| `freedomCode.wxmlPrettierOptions`  | `freedomCode.prettierOptions.overrides` | 使用 overrides 配置不同文件类型                   |

> 💡 **提示**: 新配置更加简洁,通过 `overrides` 可以灵活配置任意文件类型的格式化规则。

***

## 📝 使用方法

### 命令面板

通过 `Ctrl+Shift+P` (Windows) 或 `Cmd+Shift+P` (Mac) 打开命令面板，搜索"Freedom Code"相关命令。

### 右键菜单

在资源管理器中右键点击文件夹，选择"Freedom Code - 创建模板"，然后选择需要的模板类型：

- **Vue 模板**: Vue2、Vue3、HTML
- **状态管理**: Pinia、Vuex、Service
- **小程序**: 页面、组件
- **工具文件**: 工具类集合

### 快捷键

- `Shift+Alt+F`: 格式化当前文档（支持所有文件类型）

***

## 🐛 问题反馈

如果遇到任何问题或有功能建议，请通过以下方式反馈：

- GitHub Issues: <https://github.com/Kiraalla/freedom-code/issues>

***

## 📚 代码块对照表

全部代码块按技术栈分组整理在单独文档里（含缩写与说明），避免 README 过长：

- 仓库内：[docs/snippets-reference.md](./docs/snippets-reference.md)
- GitHub 直接查看：https://github.com/Kiraalla/freedom-code/blob/main/docs/snippets-reference.md

## 📋 更新日志

各版本变更见 [CHANGELOG.md](./CHANGELOG.md)。0.1.0 的破坏性变更与迁移做法见上文「配置迁移」。
