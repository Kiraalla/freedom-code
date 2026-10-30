---
id: freedom-code-snippets
type: module-design
title: Freedom Code — 代码块（snippets）模块
status: draft
parent: freedom-code-arch
---

# 代码块模块

## 职责

为 CSS/HTML/JS/TS/JSX/Pug、jQuery、Layui、Vant、Vue、小程序提供静态代码片段。**纯声明数据**，没有运行时代码：`contributes.snippets` 把 `snippets/**/*.json` 按语言挂上去，VS Code 直接读取。

## 边界

- 不依赖任何 JS 模块，也不受任何设置开关控制（VS Code 没有运行时禁用已声明片段的能力，所以不提供 `enable*Snippets` 开关）。
- 与格式化、高亮、跳转等模块无交互。

## 数据契约（由 `test/unit/snippets.test.js` 守护）

1. 每个文件都是合法 JSON；`package.json` 声明的文件都存在，且所有文件都被声明。
2. 每条都有 `description`（候选列表里靠它区分同名片段）。
3. **不得存在 body 与 prefix 相同的"伪代码块"**：输入什么就插回什么是零价值，而且会造成同语言同 prefix 冲突。
4. **同一语言内 prefix 必须唯一**：否则用户输入同一个词会看到两个不相关候选。
5. **占位符必须闭合**，且不得用 `${名字}` 冒充占位符——VS Code 对不在内置变量表里的 `${name}` 会**原样插入名字**，用户拿到的是字面文本而不是可编辑占位。原始文件里有 126 条这种写法（来自另一套片段方言），已用 `util/snippet-placeholders.js` 的 `normalizeNamedPlaceholders` 批量改写为 `${N:名字}`。
6. 不使用已废弃的语言 id（`jade` 已不是现代 VS Code 的语言 id，Pug 扩展贡献的是 `pug`）。

## 已知限制

- 1500+ 条片段的**语义正确性**（API 是否过时、参数顺序是否符合当前版本）没有系统性验证；已修的三处（`animation-left`、`jqLoadPost`、两个重复条目）来自内容去重与人工抽查。
- 部分描述是**生成的**（「文件族: 清洗后的 key」），足够区分候选，但不如手写说明准确。
