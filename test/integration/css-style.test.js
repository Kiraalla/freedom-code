'use strict';

/**
 * CSS / WXSS 的两种排版（真实宿主）：设置项驱动 + 首次提示不阻塞。
 */
const assert = require('assert');
const path = require('path');
const vscode = require('vscode');

const format_core = require(path.join(__dirname, '..', '..', 'wxml_plus', 'format_core'));
const cssStyle = require(path.join(__dirname, '..', '..', 'features', 'css-style'));

const GLOBAL = vscode.ConfigurationTarget.Global;

const CSS = '.a {\n  color: red;\n  margin: 0;\n}\n.b {\n  color: blue;\n}\n';

/** 模拟 providers/formatting.js：解析风格后作为第 5 参传入 */
function styleOptions() {
  return { compactCss: cssStyle.resolveStyle(makeContext(undefined)) === 'compact' };
}

function makeContext(remembered) {
  const store = new Map();
  if (remembered) store.set(cssStyle.MEMORY_KEY, remembered);

  return {
    subscriptions: [],
    globalState: {
      get: (key) => store.get(key),
      update: async (key, value) => { store.set(key, value); },
    },
    store,
  };
}

suite('CSS 排版风格（真实宿主）', () => {
  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension('Kiraalla.freedom-code');
    assert.ok(extension);
    await extension.activate();
  });

  teardown(async () => {
    await vscode.workspace.getConfiguration().update('freedomCode.cssFormatStyle', undefined, GLOBAL);
    format_core.ConfigManager.clearCache();
  });

  test('默认（未选择）时用标准换行', async () => {
    const output = await format_core.unifiedFormat(CSS, 'css', '/ws/a.css', { tabSize: 2, insertSpaces: true }, styleOptions());
    assert.ok(output.includes('\n  color: red;'), `应是标准换行，实际：\n${output}`);
    assert.ok(!output.includes('.a{'), output);
  });

  test('设置项为 compact 时输出单行紧凑（且保留注释）', async () => {
    await vscode.workspace.getConfiguration().update('freedomCode.cssFormatStyle', 'compact', GLOBAL);

    const input = '/* 顶部注释 */\n' + CSS;
    const output = await format_core.unifiedFormat(input, 'css', '/ws/a.css', { tabSize: 2, insertSpaces: true }, styleOptions());

    assert.equal(output, '/* 顶部注释 */\n.a{ color:red; margin:0; }\n.b{ color:blue; }');
  });

  test('wxss 同样支持紧凑', async () => {
    await vscode.workspace.getConfiguration().update('freedomCode.cssFormatStyle', 'compact', GLOBAL);

    const output = await format_core.unifiedFormat(CSS, 'wxss', '/ws/a.wxss', { tabSize: 2, insertSpaces: true }, styleOptions());
    assert.ok(output.startsWith('.a{ color:red; margin:0; }'), output);
  });

  test('紧凑模式对 @media 仍按层缩进', async () => {
    await vscode.workspace.getConfiguration().update('freedomCode.cssFormatStyle', 'compact', GLOBAL);

    const input = '@media (min-width: 600px) {\n  .a { color: red; }\n}\n';
    const output = await format_core.unifiedFormat(input, 'css', '/ws/media.css', { tabSize: 2, insertSpaces: true }, styleOptions());

    assert.equal(output, '@media (min-width:600px){\n  .a{ color:red; }\n}');
  });

  test('scss 格式化不受 cssFormatStyle 影响', async () => {
    await vscode.workspace.getConfiguration().update('freedomCode.cssFormatStyle', 'compact', GLOBAL);

    const output = await format_core.unifiedFormat('.a { color: red; }', 'scss', '/ws/a.scss', { tabSize: 2, insertSpaces: true }, styleOptions());
    assert.ok(output.includes('\n  color: red;'), `scss 应保持 Prettier 标准排版，实际：\n${output}`);
  });

  test('记忆值生效；设置项显式值优先于记忆值', async () => {
    const context = makeContext('compact');
    assert.equal(cssStyle.resolveStyle(context), 'compact', '无显式设置时用记忆值');

    await vscode.workspace.getConfiguration().update('freedomCode.cssFormatStyle', 'normal', GLOBAL);
    assert.equal(cssStyle.resolveStyle(context), 'normal', '显式设置优先于记忆值');
  });

  test('isDecided: 有记忆值即视为已决定', () => {
    assert.equal(cssStyle.isDecided(makeContext('normal')), true);
    assert.equal(cssStyle.isDecided(makeContext(undefined)), false);
  });
});
