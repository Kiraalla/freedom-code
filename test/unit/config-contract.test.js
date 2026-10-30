'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SOURCE_DIRS = ['commands', 'features', 'providers', 'wxml_plus', 'util', 'vue_plus'];
const SOURCE_FILES = ['extension.js'];

const declared = Object.keys(
  require(path.join(ROOT, 'package.json')).contributes.configuration.properties,
);

/** 去掉注释，避免把注释里的示例键当成真实读取 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:'"])\/\/.*$/gm, '$1');
}

function collectSources() {
  const sources = [];

  for (const file of SOURCE_FILES) {
    sources.push({ file, text: fs.readFileSync(path.join(ROOT, file), 'utf8') });
  }

  for (const dir of SOURCE_DIRS) {
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

/**
 * 代码里引用到的设置键。
 * 两种写法都要覆盖：
 *   cfg.get('scssIncludePaths', [])            —— 短键，作用域由 getConfiguration('freedomCode') 决定
 *   readSetting(cfg, ['freedomCode.foo', ...]) —— 带作用域的全键
 */
function collectReferencedKeys() {
  const keys = new Set();

  for (const { text } of collectSources()) {
    const source = stripComments(text);

    for (const match of source.matchAll(/['"](freedomCode\.[A-Za-z0-9_-]+)['"]/g)) {
      keys.add(match[1]);
    }

    for (const match of source.matchAll(/\.(?:get|inspect)\(\s*['"]([A-Za-z0-9_-]+)['"]/g)) {
      keys.add(`freedomCode.${match[1]}`);
    }
  }

  return keys;
}

test('配置契约: 代码读取的每个键都必须在 package.json 里声明（B17 回归）', () => {
  const referenced = collectReferencedKeys();
  const undeclared = [...referenced].filter((key) => !declared.includes(key));

  assert.deepEqual(undeclared, [], '这些键被代码读取但没有声明，用户在设置里看不到');
});

test('配置契约: 每个声明的键都必须真的被读取（B18 回归）', () => {
  const referenced = collectReferencedKeys();
  const unused = declared.filter((key) => !referenced.has(key));

  assert.deepEqual(unused, [], '这些键声明了但代码从不读取，属于死开关');
});

test('配置契约: 旧连字符键仍然声明且带 deprecationMessage', () => {
  const properties = require(path.join(ROOT, 'package.json')).contributes.configuration.properties;
  const legacyKeys = Object.keys(properties).filter((key) => /-/.test(key.replace('freedomCode.', '')));

  assert.ok(legacyKeys.length > 0, '应保留旧键声明用于迁移');

  for (const key of legacyKeys) {
    assert.ok(
      properties[key].deprecationMessage,
      `${key} 是旧键，必须带 deprecationMessage 提示用户迁移`,
    );
  }
});

test('配置契约: contributes.configuration 只使用 VS Code 支持的键', () => {
  // 官方 schema（configurationExtensionPoint.ts）只有 title / id / order / properties。
  // 曾自行发明 groups 字段，导致旧版 VS Code 严格校验时整段配置贡献被丢弃，
  // 所有设置变成“未知设置”（但在 settings.json 里直接写依然生效，所以很隐蔽）。
  const configuration = require(path.join(ROOT, 'package.json')).contributes.configuration;
  const entries = Array.isArray(configuration) ? configuration : [configuration];
  const allowed = new Set(['title', 'id', 'order', 'properties']);

  for (const entry of entries) {
    const invalid = Object.keys(entry).filter((key) => !allowed.has(key));
    assert.deepEqual(invalid, [], `contributes.configuration 里有未知键：${invalid.join(', ')}`);
  }
});

test('配置契约: 每个设置项都声明了 type', () => {
  const configuration = require(path.join(ROOT, 'package.json')).contributes.configuration;
  const entries = Array.isArray(configuration) ? configuration : [configuration];
  const missing = [];

  for (const entry of entries) {
    for (const [key, property] of Object.entries(entry.properties || {})) {
      if (!property.type) missing.push(key);
    }
  }

  assert.deepEqual(missing, [], '缺 type 的设置项在 Settings UI 里无法正确渲染');
});
