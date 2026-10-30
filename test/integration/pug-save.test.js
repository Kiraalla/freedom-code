'use strict';

/**
 * 真实宿主里保存 .pug 是否真的产出 HTML（用户报「改了保存没生成」）。
 * 这条用例直接驱动真实的保存事件，而不是调用内部函数。
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vscode = require('vscode');

const GLOBAL = vscode.ConfigurationTarget.Global;

async function setSetting(key, value) {
  await vscode.workspace.getConfiguration().update(key, value, GLOBAL);
}

async function waitFor(predicate, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

suite('Pug 保存时编译（真实宿主）', () => {
  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension('Kiraalla.freedom-code');
    assert.ok(extension);
    await extension.activate();
  });

  teardown(async () => {
    await vscode.workspace.getConfiguration().update('freedomCode.pugAutoCompile', undefined, GLOBAL);
    await vscode.workspace.getConfiguration().update('freedomCode.pugPretty', undefined, GLOBAL);
  });

  test('pugAutoCompile 为 true 时保存 .pug 会生成 .html', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-pug-save-'));
    const pugPath = path.join(dir, 'page.pug');
    const htmlPath = path.join(dir, 'page.html');
    fs.writeFileSync(pugPath, 'p hello\n');

    await setSetting('freedomCode.pugAutoCompile', true);

    const document = await vscode.workspace.openTextDocument(pugPath);
    assert.equal(document.languageId, 'pug', '扩展必须把 .pug 识别成 pug 语言');

    const editor = await vscode.window.showTextDocument(document);
    await editor.edit((builder) => builder.insert(new vscode.Position(0, 0), '//- touched\n'));
    await document.save();

    const created = await waitFor(() => fs.existsSync(htmlPath));
    assert.ok(created, `保存后应生成 ${htmlPath}`);
    assert.ok(fs.readFileSync(htmlPath, 'utf8').includes('<p>hello</p>'));
  });

  test('pugAutoCompile 关闭时不生成 .html', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-pug-save-off-'));
    const pugPath = path.join(dir, 'page.pug');
    const htmlPath = path.join(dir, 'page.html');
    fs.writeFileSync(pugPath, 'p hello\n');

    await setSetting('freedomCode.pugAutoCompile', false);

    const document = await vscode.workspace.openTextDocument(pugPath);
    const editor = await vscode.window.showTextDocument(document);
    await editor.edit((builder) => builder.insert(new vscode.Position(0, 0), '//- touched\n'));
    await document.save();

    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.ok(!fs.existsSync(htmlPath), '关闭时不应生成 .html');
  });
});

suite('Pug 识别与提示（真实宿主）', () => {
  test('扩展名兜底：languageId 为 plaintext 的 .pug 也识别为 Pug', async () => {
    const { isPugDocument } = require(path.join(__dirname, '..', '..', 'commands', 'pug.js'));

    assert.equal(isPugDocument({ languageId: 'pug', uri: { fsPath: '/ws/a.pug' } }), true);
    // 装扩展之前就打开的标签页，语言关联不会自动刷新
    assert.equal(isPugDocument({ languageId: 'plaintext', uri: { fsPath: '/ws/a.pug' } }), true);
    assert.equal(isPugDocument({ languageId: 'plaintext', uri: { fsPath: '/ws/a.jade' } }), true);
    assert.equal(isPugDocument({ languageId: 'plaintext', uri: { fsPath: '/ws/a.txt' } }), false);
    assert.equal(isPugDocument(undefined), false);
  });

  test('.pug 语言的语法贡献已注册（scopeName text.pug）', async () => {
    const pkg = require(path.join(__dirname, '..', '..', 'package.json'));
    const grammar = pkg.contributes.grammars.find((g) => g.scopeName === 'text.pug');

    assert.ok(grammar, '应声明 text.pug 语法');
    assert.equal(grammar.language, 'pug');
    assert.ok(fs.existsSync(path.join(__dirname, '..', '..', grammar.path.replace('./', ''))));
  });
});
