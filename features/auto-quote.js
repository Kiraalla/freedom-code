'use strict';

const vscode = require('vscode');

const { decideQuoteInsertion, mapCursorAfterInsertions } = require('../wxml_plus/editor-contract');

const AUTO_QUOTE_LANGUAGES = ['wxml', 'html', 'vue'];

/**
 * 在 wxml/html/vue 的起始标签内、属性名后键入 `=` 时补一对引号。
 *
 * 只做最小插入（不整行替换），因此撤销粒度与其他编辑操作一致；
 * 多个光标同时键入 `=` 时逐个补全，光标各自落在自己的引号中间。
 * 判定逻辑全在 editor-contract.decideQuoteInsertion，可单测。
 *
 * 注意：这里不能用 OnTypeFormattingEditProvider —— VS Code 在多光标时
 * 直接跳过 on-type formatting（formatActions.ts 的 _trigger 早退）。
 *
 * @returns {vscode.Disposable}
 */
function setupAutoQuote() {
  return vscode.workspace.onDidChangeTextDocument((event) => {
    const document = event.document;

    if (!AUTO_QUOTE_LANGUAGES.includes(document.languageId)) {
      return;
    }

    const insertions = [];

    for (const change of event.contentChanges) {
      // 只认"键入了一个 ="；我们自己插入的 "" 会被这条过滤掉，不会自激
      if (change.text !== '=' || change.rangeLength !== 0) {
        continue;
      }

      const line = change.range.start.line;
      const column = change.range.start.character + 1;
      const decision = decideQuoteInsertion(document.lineAt(line).text, column);

      if (decision) {
        insertions.push({ line, character: decision.insertAt });
      }
    }

    if (insertions.length === 0) {
      return;
    }

    const editor = vscode.window.visibleTextEditors.find(
      (candidate) => candidate.document === document
    );

    if (!editor) {
      return;
    }

    const selectionsBefore = editor.selections.map((selection) => selection.active);

    editor.edit((builder) => {
      for (const insertion of insertions) {
        builder.insert(new vscode.Position(insertion.line, insertion.character), '""');
      }
    }).then((applied) => {
      if (!applied) {
        return;
      }

      editor.selections = selectionsBefore.map((position) => {
        const character = mapCursorAfterInsertions(
          position.line,
          position.character,
          insertions
        );
        const target = new vscode.Position(position.line, character);
        return new vscode.Selection(target, target);
      });
    });
  });
}

/**
 * @param {vscode.ExtensionContext} context
 */
function register(context) {
  context.subscriptions.push(setupAutoQuote());
}

module.exports = { register };
