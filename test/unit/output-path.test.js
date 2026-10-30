'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { resolveOutputPath } = require('../../util/output-path');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fc-out-'));
}

test('resolveOutputPath: same 只换扩展名', () => {
  const dir = tempDir();
  assert.equal(
    resolveOutputPath(path.join(dir, 'a.scss'), { outputExtension: '.css' }),
    path.join(dir, 'a.css'),
  );
});

test('resolveOutputPath: same 支持自定义扩展名', () => {
  const dir = tempDir();
  assert.equal(
    resolveOutputPath(path.join(dir, 'a.scss'), { outputExtension: '.wxss' }),
    path.join(dir, 'a.wxss'),
  );
});

test('resolveOutputPath: custom 相对源文件目录', () => {
  const dir = tempDir();
  const output = resolveOutputPath(path.join(dir, 'src/a.scss'), {
    outputPathFormat: 'custom',
    outputPath: 'dist',
    outputExtension: '.css',
  });

  assert.equal(output, path.join(dir, 'src', 'dist', 'a.css'));
  assert.ok(fs.existsSync(path.join(dir, 'src', 'dist')), '目录应被创建');
});

test('resolveOutputPath: custom 绝对路径', () => {
  const dir = tempDir();
  const target = path.join(dir, 'abs-out');
  const output = resolveOutputPath(path.join(dir, 'a.scss'), {
    outputPathFormat: 'custom',
    outputPath: target,
    outputExtension: '.css',
  });

  assert.equal(output, path.join(target, 'a.css'));
});

test('resolveOutputPath: custom 未给 outputPath 时退回同目录', () => {
  const dir = tempDir();
  assert.equal(
    resolveOutputPath(path.join(dir, 'a.scss'), { outputPathFormat: 'custom', outputPath: '' }),
    path.join(dir, 'a.css'),
  );
});

test('resolveOutputPath: relative 保留相对工作区的层级', () => {
  const dir = tempDir();
  const output = resolveOutputPath(path.join(dir, 'styles/sub/a.scss'), {
    outputPathFormat: 'relative',
    outputPath: 'out',
    workspacePath: dir,
  });

  assert.equal(output, path.join(dir, 'out', 'styles', 'sub', 'a.css'));
});

test('resolveOutputPath: relative 的 outputPath 以 / 开头按工作区相对处理', () => {
  const dir = tempDir();
  const output = resolveOutputPath(path.join(dir, 'a.scss'), {
    outputPathFormat: 'relative',
    outputPath: '/out',
    workspacePath: dir,
  });

  assert.equal(output, path.join(dir, 'out', 'a.css'));
});

test('resolveOutputPath: relative 未给 outputPath 时退回同目录 .css', () => {
  const dir = tempDir();
  assert.equal(
    resolveOutputPath(path.join(dir, 'a.sass'), { outputPathFormat: 'relative' }),
    path.join(dir, 'a.css'),
  );
});

test('resolveOutputPath: 未知策略退回同目录', () => {
  const dir = tempDir();
  assert.equal(
    resolveOutputPath(path.join(dir, 'a.scss'), { outputPathFormat: 'weird' }),
    path.join(dir, 'a.css'),
  );
});

test('resolveOutputPath: pug 用 .html', () => {
  const dir = tempDir();
  assert.equal(
    resolveOutputPath(path.join(dir, 'a.pug'), { outputExtension: '.html' }),
    path.join(dir, 'a.html'),
  );
});
