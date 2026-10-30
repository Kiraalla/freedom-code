'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// config.js 顶层 require('vscode')，只能先注入 stub 再加载。
// node --test 每个测试文件是独立进程，这个 patch 不会污染其他用例。
const handlers = { config: null, disposals: [], registrations: 0 };

const vscodeStub = {
  workspace: {
    getConfiguration: () => ({
      get: (_key, fallback) => fallback,
      inspect: () => undefined,
    }),
    onDidChangeConfiguration: (fn) => {
      handlers.config = fn;
      handlers.registrations++;
      return { dispose: () => handlers.disposals.push('config') };
    },
  },
  window: { activeTextEditor: undefined },
};

const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'vscode') return vscodeStub;
  return originalLoad.call(this, request, ...rest);
};

const config = require('../../wxml_plus/config');

Module._load = originalLoad;

test('configActivate: 只注册一个配置监听，配置变化不再叠加（B10）', () => {
  const activeText = { onChange: () => {} };

  config.configActivate(activeText);
  assert.equal(handlers.registrations, 1, '激活时应注册一次配置监听');

  for (let i = 0; i < 5; i++) {
    handlers.config({ affectsConfiguration: () => true });
  }

  assert.equal(handlers.registrations, 1, '配置变化不能重复注册监听');
});

test('configActivate: 与 freedomCode 无关的配置变化被忽略', () => {
  const refreshes = [];
  config.configActivate({ onChange: (_editor, reset) => refreshes.push(reset) });

  handlers.config({ affectsConfiguration: () => false });

  assert.deepEqual(refreshes, [], '无关配置变化不应触发高亮刷新');

  config.configDeactivate();
  assert.ok(handlers.disposals.includes('config'), 'deactivate 应释放配置监听');
});

test('configDeactivate: 重复调用不会抛异常', () => {
  config.configActivate({ onChange: () => {} });
  config.configDeactivate();
  assert.doesNotThrow(() => config.configDeactivate());
});
