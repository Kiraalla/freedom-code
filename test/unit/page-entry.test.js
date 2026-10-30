'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { derivePageEntry } = require('../../util/page-entry');

test('derivePageEntry: pages/ 下的页面登记进主包', () => {
  assert.deepEqual(derivePageEntry('pages/index'), {
    kind: 'main',
    entry: 'pages/index/index',
  });
});

test('derivePageEntry: 非 pages/ 目录不再产生 pages/undefined（回归）', () => {
  const result = derivePageEntry('src/views/foo', []);

  assert.deepEqual(result, { kind: 'main', entry: 'src/views/foo/index' });
  assert.ok(!JSON.stringify(result).includes('undefined'), '不得出现 undefined');
});

test('derivePageEntry: 分包内的页面相对 root 登记', () => {
  assert.deepEqual(derivePageEntry('sub/pages/detail', ['sub']), {
    kind: 'sub',
    root: 'sub',
    entry: 'pages/detail/index',
  });
});

test('derivePageEntry: 最长 root 前缀优先', () => {
  assert.deepEqual(derivePageEntry('sub/inner/detail', ['sub', 'sub/inner']), {
    kind: 'sub',
    root: 'sub/inner',
    entry: 'detail/index',
  });
});

test('derivePageEntry: 页面目录恰好等于 root', () => {
  assert.deepEqual(derivePageEntry('sub', ['sub']), {
    kind: 'sub',
    root: 'sub',
    entry: 'index',
  });
});

test('derivePageEntry: 相似前缀不算命中（sub 与 subtitle）', () => {
  assert.deepEqual(derivePageEntry('subtitle/detail', ['sub']), {
    kind: 'main',
    entry: 'subtitle/detail/index',
  });
});

test('derivePageEntry: 反斜杠与前导斜杠被归一化', () => {
  assert.deepEqual(derivePageEntry('/pages\\index\\', []), {
    kind: 'main',
    entry: 'pages/index/index',
  });
});

test('derivePageEntry: 空路径也能给出合法条目', () => {
  assert.deepEqual(derivePageEntry('', []), { kind: 'main', entry: 'index' });
});

test('derivePageEntry: 未配置分包时即便路径像分包也进主包', () => {
  assert.deepEqual(derivePageEntry('sub/pages/detail', []), {
    kind: 'main',
    entry: 'sub/pages/detail/index',
  });
});
