# Pug 语法文件来源

`syntaxes/pug/pug.tmLanguage.json` 与 `languages/pug-language-configuration.json`
取自作者本人的另一个扩展 [Kiraalla/pug-compile](https://github.com/Kiraalla/pug-compile)
（MIT 许可，与本项目同作者），用于给本扩展提供 Pug 语法高亮与语言配置。

- `pug.tmLanguage.json`：`scopeName: text.pug`，内嵌 `text.html.basic` / `source.js` / `source.ts` 高亮。
- `pug-language-configuration.json`：注释（`//-`）、括号配对、自动闭合、`folding.offSide`（按缩进折叠）。

如需替换为其他语法，请同步更新本文件与 `package.json` 的 `contributes.grammars`。
