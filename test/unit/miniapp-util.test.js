'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const getProperties = require('../../util/getProperties');
const findComponentPath = require('../../util/findComponentPath');
const findRootPath = require('../../util/findRootPath');

function makeTree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-unit-'));
  for (const [relative, content] of Object.entries(files)) {
    const full = path.join(root, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  return root;
}

test('getProperties: 组件没有 properties 键时返回空数组（B5）', () => {
  const root = makeTree({
    'comp/index.js': 'Component({\n  data: { a: 1 },\n  methods: {}\n})\n',
  });
  assert.deepEqual(getProperties(path.join(root, 'comp/index.js')), []);
});

test('getProperties: 正常提取 properties 与 triggerEvent', () => {
  const root = makeTree({
    'comp/index.js': [
      'Component({',
      '  properties: {',
      '    title: { type: String },',
      '  },',
      '  methods: {',
      '    onTap() { this.triggerEvent("change"); },',
      '  },',
      '});',
      '',
    ].join('\n'),
  });

  const result = getProperties(path.join(root, 'comp/index.js'));
  const names = result.map((item) => item.name);
  assert.ok(names.includes('title'), '应包含属性 title');
  assert.ok(names.includes('bind:change'), '应包含事件 bind:change');
});

test('getProperties: 解析失败或文件不存在时返回空数组，不抛异常', () => {
  const root = makeTree({ 'bad/index.js': 'Component({ this is not js' });
  assert.deepEqual(getProperties(path.join(root, 'bad/index.js')), []);
  assert.deepEqual(getProperties(path.join(root, 'missing/index.js')), []);
});

test('findRootPath: 找到含 app.json 的目录', () => {
  const root = makeTree({
    'app.json': '{"pages":[]}',
    'pages/index/index.wxml': '<view></view>',
  });
  assert.equal(
    findRootPath(path.join(root, 'pages/index/index.wxml')),
    root,
  );
});

test('findRootPath: 一直到盘符根都找不到时返回 null（B7）', () => {
  const root = makeTree({ 'pages/index/index.wxml': '<view></view>' });
  assert.equal(findRootPath(path.join(root, 'pages/index/index.wxml')), null);
});

test('findComponentPath: wxml 没有同名 json 时返回空串（B6）', () => {
  const root = makeTree({
    'app.json': '{"pages":[]}',
    'pages/index/index.wxml': '<my-comp />',
  });
  const doc = { fileName: path.join(root, 'pages/index/index.wxml') };
  assert.equal(findComponentPath(doc, 'my-comp'), '');
});

test('findComponentPath: 回退到 app.json 的 usingComponents', () => {
  const root = makeTree({
    'app.json': JSON.stringify({
      pages: [],
      usingComponents: { 'my-comp': '/components/my/index' },
    }),
    'pages/index/index.wxml': '<my-comp />',
  });
  const doc = { fileName: path.join(root, 'pages/index/index.wxml') };
  assert.equal(
    findComponentPath(doc, 'my-comp'),
    path.join(root, 'components/my/index.js'),
  );
});

test('findComponentPath: 没有 app.json 也没有页面 json 时安全返回空串', () => {
  const root = makeTree({ 'pages/index/index.wxml': '<my-comp />' });
  const doc = { fileName: path.join(root, 'pages/index/index.wxml') };
  assert.equal(findComponentPath(doc, 'my-comp'), '');
});
