'use strict';

/**
 * 配置优先级与读取（真实 VS Code 宿主）。
 * 这两条对应用户实际报过的缺陷：
 *   1. `scssAutoCompile: true` 却不编译 —— 因为 readSetting 读的是 scoped 配置 + 全键，
 *      键被双重加前缀，永远退回默认值 false。
 *   2. `prettierOptions.tabWidth: 4` 与 `overrides` 里的缩进无效 —— 因为编辑器 options
 *      无条件覆盖 tabWidth。
 */
const assert = require('assert');
const path = require('path');
const vscode = require('vscode');

const format_core = require(path.join(__dirname, '..', '..', 'wxml_plus', 'format_core'));
const { readSetting } = require(path.join(__dirname, '..', '..', 'util', 'settings'));

// 测试宿主没有打开文件夹，只能写用户设置（Global）
const WORKSPACE = vscode.ConfigurationTarget.Global;

async function setPrettierOptions(value) {
  await vscode.workspace.getConfiguration().update('freedomCode.prettierOptions', value, WORKSPACE);
  format_core.ConfigManager.clearCache();
}

async function setSetting(key, value) {
  await vscode.workspace.getConfiguration().update(key, value, WORKSPACE);
}

const NESTED_WXML = '<view>\n<text>a</text>\n</view>';

suite('配置读取与优先级（真实宿主）', () => {
  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension('Kiraalla.freedom-code');
    assert.ok(extension, '扩展应能被找到');
    await extension.activate();
  });

  teardown(async () => {
    await vscode.workspace.getConfiguration().update('freedomCode.prettierOptions', undefined, WORKSPACE);
    await vscode.workspace.getConfiguration().update('freedomCode.scssAutoCompile', undefined, WORKSPACE);
    format_core.ConfigManager.clearCache();
  });

  test('显式配置的 scssAutoCompile 能被读到（回归：曾因键名双前缀永远读不到）', async () => {
    await setSetting('freedomCode.scssAutoCompile', true);

    const root = vscode.workspace.getConfiguration();
    const value = readSetting(
      root,
      ['freedomCode.scssAutoCompile', 'freedomCode.scss-compact-autoCompile'],
      false,
    );

    assert.equal(value, true, '显式设为 true 必须读到 true，而不是退回默认的 false');
  });

  test('scoped 配置对象 + 全键是无效组合（记录该陷阱，防止再犯）', async () => {
    await setSetting('freedomCode.scssAutoCompile', true);

    const scoped = vscode.workspace.getConfiguration('freedomCode');
    const fullKeyOnScoped = scoped.inspect('freedomCode.scssAutoCompile');

    assert.ok(fullKeyOnScoped, 'inspect 仍返回对象，但只有 key');
    assert.equal(fullKeyOnScoped.key, 'freedomCode.freedomCode.scssAutoCompile');
    assert.equal(
      fullKeyOnScoped.globalValue,
      undefined,
      '双重前缀后读不到显式值 —— 这就是当初 bug 的形态',
    );
    assert.equal(fullKeyOnScoped.workspaceValue, undefined);
  });

  test('显式 prettierOptions.tabWidth 优先于编辑器 tabSize（回归）', async () => {
    await setPrettierOptions({ tabWidth: 4, useTabs: false });

    const formatted = await format_core.unifiedFormat(
      NESTED_WXML,
      'wxml',
      '/ws/a.wxml',
      { tabSize: 2, insertSpaces: true },
    );

    assert.ok(
      formatted.includes('\n    <text>'),
      `应使用显式配置的 4 空格缩进，实际：\n${formatted}`,
    );
  });

  test('overrides 里的 tabWidth 也优先于编辑器 tabSize（回归）', async () => {
    await setPrettierOptions({
      tabWidth: 2,
      overrides: [{ files: ['*.wxml'], options: { tabWidth: 4 } }],
    });

    const formatted = await format_core.unifiedFormat(
      NESTED_WXML,
      'wxml',
      '/ws/a.wxml',
      { tabSize: 8, insertSpaces: true },
    );

    assert.ok(
      formatted.includes('\n    <text>'),
      `overrides 的 4 空格应生效（编辑器是 8），实际：\n${formatted}`,
    );
  });

  test('未显式配置缩进时跟随编辑器 tabSize', async () => {
    await setPrettierOptions({ printWidth: 80 });

    const formatted = await format_core.unifiedFormat(
      NESTED_WXML,
      'wxml',
      '/ws/a.wxml',
      { tabSize: 3, insertSpaces: true },
    );

    assert.ok(
      formatted.includes('\n   <text>'),
      `没有显式配置时应跟随编辑器 3 空格，实际：\n${formatted}`,
    );
  });

  test('显式 useTabs 优先于编辑器 insertSpaces', async () => {
    await setPrettierOptions({ tabWidth: 4, useTabs: true });

    const formatted = await format_core.unifiedFormat(
      NESTED_WXML,
      'wxml',
      '/ws/a.wxml',
      { tabSize: 2, insertSpaces: true },
    );

    assert.ok(formatted.includes('\n\t<text>'), `应使用制表符，实际：\n${formatted}`);
  });
});

suite('设置声明被 VS Code 接受（真实宿主）', () => {
  test('每个声明的设置项都有 defaultValue（说明配置贡献真的加载了）', async () => {
    const pkg = require(path.join(__dirname, '..', '..', 'package.json'));
    const config = vscode.workspace.getConfiguration();
    const missing = [];

    for (const key of Object.keys(pkg.contributes.configuration.properties)) {
      const inspected = config.inspect(key);
      if (!inspected || inspected.defaultValue === undefined) {
        missing.push(key);
      }
    }

    assert.deepEqual(
      missing,
      [],
      '这些设置在 package.json 里声明了，但 VS Code 没加载到 —— 可能是配置贡献里有非法字段导致整段被丢弃',
    );
  });
});

suite('清单自检（真实宿主）', () => {
  test('磁盘清单声明的设置与 VS Code 已加载的一致（否则说明清单是旧的）', async () => {
    const { declaredSettingKeys } = require(path.join(__dirname, '..', '..', 'features', 'manifest-check.js'));
    const extension = vscode.extensions.getExtension('Kiraalla.freedom-code');

    const declared = declaredSettingKeys(extension);
    assert.ok(declared.length > 0, '应能从扩展清单里读到设置声明');

    const config = vscode.workspace.getConfiguration();
    const missing = declared.filter((key) => {
      const inspected = config.inspect(key);
      return !inspected || inspected.defaultValue === undefined;
    });

    assert.deepEqual(missing, [], '清单与运行中的 VS Code 不一致，需要重载窗口');
  });

  test('设置分类标题是 Freedom Code（不再是历史遗留的 Freedom Helper）', () => {
    const pkg = require(path.join(__dirname, '..', '..', 'package.json'));
    assert.equal(pkg.contributes.configuration.title, pkg.displayName);
  });
});
