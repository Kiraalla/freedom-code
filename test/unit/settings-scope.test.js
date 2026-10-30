'use strict';

/**
 * 回归守卫：`readSetting` 对"带 scope 的配置对象 + 带 scope 的全键"会双重加前缀，
 * 静默退回默认值（真实发生过：scssAutoCompile 设了 true 却不编译）。
 * 规则：凡是调用 readSetting 的文件，必须用根配置 `getConfiguration()`。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DIRS = ['commands', 'features', 'providers', 'util', 'wxml_plus'];
const FILES = ['extension.js'];

function collectSources() {
  const sources = FILES.map((f) => ({ file: f, text: fs.readFileSync(path.join(ROOT, f), 'utf8') }));

  for (const dir of DIRS) {
    const dirPath = path.join(ROOT, dir);
    for (const entry of fs.readdirSync(dirPath)) {
      if (!entry.endsWith('.js')) continue;
      sources.push({
        file: `${dir}/${entry}`,
        text: fs.readFileSync(path.join(dirPath, entry), 'utf8'),
      });
    }
  }

  return sources;
}

test('readSetting 的调用方必须使用根配置（避免键名双重加前缀）', () => {
  const offenders = [];

  for (const { file, text } of collectSources()) {
    if (!text.includes('readSetting(')) continue;

    // 先剥掉注释：解释性注释会提到这个写法，不应算违规
    const code = text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const scoped = /getConfiguration\(\s*['"]freedomCode['"]\s*\)/;
    if (scoped.test(code)) {
      offenders.push(file);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    '这些文件同时用了 readSetting 与 getConfiguration(\'freedomCode\')，全键会变成 freedomCode.freedomCode.*',
  );
});
