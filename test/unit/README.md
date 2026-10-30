# 测试分层

- `test/unit/**/*.test.js` —— 纯 Node 测试，用内置 `node:test` + `node:assert`。
  只允许 import 不依赖 `vscode` 的模块（如 `wxml_plus/pipeline.js`），`npm test` 即跑，秒级、不下载 VS Code。
- `test/integration/**/*.test.js` —— 需要 VS Code 宿主（`@vscode/test-cli`），`npm run test:integration` 运行。

规则：凡是想被测试覆盖的格式化逻辑，都必须先抽成不 import `vscode` 的纯函数放进 unit 层。
