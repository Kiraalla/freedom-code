'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// ConfigManager 通过 vscode.workspace.getConfiguration 读配置，加载前先注入 stub。
const state = { prettierOptions: {}, reads: 0 };

const vscodeStub = {
  workspace: {
    getConfiguration: () => ({
      get: (key, fallback) => {
        state.reads++;
        return key === 'prettierOptions' ? state.prettierOptions : fallback;
      },
    }),
  },
};

const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'vscode') return vscodeStub;
  return originalLoad.call(this, request, ...rest);
};
const format_core = require('../../wxml_plus/format_core');
Module._load = originalLoad;

const { ConfigManager } = format_core;

const OVERRIDES = {
  tabWidth: 2,
  overrides: [
    { files: ['*.scss'], options: { tabWidth: 4 } },
    { files: ['*.wxml'], options: { tabWidth: 8 } },
  ],
};

test.beforeEach(() => {
  state.prettierOptions = { ...OVERRIDES };
  state.reads = 0;
  ConfigManager.clearCache();
});

test('缓存: 同类型但不同文件各自应用自己的 overrides（B23 回归）', async () => {
  const scss = await ConfigManager.getMergedPrettierConfig('scss', '/ws/a.scss');
  const wxml = await ConfigManager.getMergedPrettierConfig('scss', '/ws/b.wxml');

  assert.equal(scss.tabWidth, 4, 'a.scss 应命中 *.scss 的 overrides');
  assert.equal(wxml.tabWidth, 8, 'b.wxml 应命中 *.wxml 的 overrides，而不是复用 a.scss 的缓存');
});

test('缓存: 同一个文件第二次读取走缓存，不再读配置', async () => {
  await ConfigManager.getMergedPrettierConfig('scss', '/ws/a.scss');
  const readsAfterFirst = state.reads;

  await ConfigManager.getMergedPrettierConfig('scss', '/ws/a.scss');

  assert.equal(state.reads, readsAfterFirst, '第二次不应再读取配置');
});

test('缓存: 配置变更后 clearCache 立刻生效，不依赖 TTL（B24 回归）', async () => {
  const before = await ConfigManager.getMergedPrettierConfig('scss', '/ws/a.scss');
  assert.equal(before.tabWidth, 4);

  state.prettierOptions = {
    tabWidth: 2,
    overrides: [{ files: ['*.scss'], options: { tabWidth: 6 } }],
  };
  ConfigManager.clearCache();

  const after = await ConfigManager.getMergedPrettierConfig('scss', '/ws/a.scss');
  assert.equal(after.tabWidth, 6, '清缓存后应立刻拿到新配置');
});

test('缓存: 没有 filePath 时也能命中缓存', async () => {
  const first = await ConfigManager.getMergedPrettierConfig('wxml');
  const readsAfterFirst = state.reads;
  const second = await ConfigManager.getMergedPrettierConfig('wxml');

  assert.equal(state.reads, readsAfterFirst);
  assert.equal(second.tabWidth, first.tabWidth);
});

test('applyOverrides: 不支持的 glob 不匹配（已记录的已知限制）', async () => {
  state.prettierOptions = {
    tabWidth: 2,
    overrides: [{ files: ['**/*.scss'], options: { tabWidth: 4 } }],
  };
  ConfigManager.clearCache();

  const result = await ConfigManager.getMergedPrettierConfig('scss', '/ws/sub/a.scss');
  assert.equal(result.tabWidth, 2, '`**/` 形式目前不支持，会静默不匹配');
});
