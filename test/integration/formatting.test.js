'use strict';

const assert = require('assert');
const vscode = require('vscode');

// B3 的端到端回归：<wxs> 里的 JS 曾被 Prettier 当 HTML 文本重排，
// 多行合并后 `//` 注释会吞掉后面所有代码。
const WXML = [
  '<view>before</view>',
  '<wxs module="m">',
  'var a = 1',
  '// 计算 b',
  'var b = a + 1',
  'module.exports = { b: b }',
  '</wxs>',
].join('\n');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

suite('格式化提供器（真实 VS Code 宿主）', () => {
  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension('Kiraalla.freedom-code');
    assert.ok(extension, '扩展应能被找到');
    await extension.activate();
  });

  test('extension.formatUnified 已在命令面板注册', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes('extension.formatUnified'),
      'formatUnified 应出现在已注册命令里'
    );
  });

  test('格式化 WXML 时 <wxs> 脚本块逐字符不变', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'wxml',
      content: WXML,
    });
    const editor = await vscode.window.showTextDocument(document);

    await vscode.commands.executeCommand('editor.action.formatDocument');
    await sleep(500);

    const formatted = editor.document.getText();

    assert.ok(
      formatted.includes('// 计算 b\nvar b = a + 1'),
      `<wxs> 内的换行与注释必须保留，实际得到：\n${formatted}`
    );
    assert.ok(
      !formatted.includes('// 计算 b var b'),
      '注释不得把后续代码吞进同一行'
    );
  });

  test('格式化后模板区域的 mustache 空格被规范化', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'wxml',
      content: '<view class="a">{{msg}}</view>',
    });
    const editor = await vscode.window.showTextDocument(document);

    await vscode.commands.executeCommand('editor.action.formatDocument');
    await sleep(500);

    assert.ok(
      editor.document.getText().includes('{{ msg }}'),
      `mustache 应被规范化为 {{ msg }}，实际：${editor.document.getText()}`
    );
  });
});
