'use strict';

/**
 * CSS 排版器：两种模式 + 嵌套感知（旧实现用 `{([^}]+)}` 正则，at-rule 会被压平）。
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatCompact,
  formatExpanded,
  splitBlocks,
  extractCommentsOutsideBlocks,
} = require('../../util/css_formatter');

test('formatCompact: 一条规则一行，属性空格分隔', () => {
  assert.equal(
    formatCompact('.a {\n  color: red;\n  margin: 0;\n}\n'),
    '.a{ color:red; margin:0; }',
  );
});

test('formatCompact: 多条规则各占一行', () => {
  assert.equal(
    formatCompact('.a { color: red; } .b { color: blue; }'),
    '.a{ color:red; }\n.b{ color:blue; }',
  );
});

test('formatCompact: 空规则是 {}', () => {
  assert.equal(formatCompact('.a { }'), '.a{}');
});

test('formatCompact: 字符串里的花括号不被当块边界', () => {
  assert.equal(formatCompact('.a { content: "{x}"; }'), '.a{ content:"{x}"; }');
  assert.equal(formatCompact('.a { content: "}"; }'), '.a{ content:"}"; }');
});

test('formatCompact: 注释默认去掉，preserveComments 时保留', () => {
  const css = '/* 顶部 */\n.a { color: red; }';
  assert.equal(formatCompact(css), '.a{ color:red; }');
  assert.equal(formatCompact(css, { preserveComments: true }), '/* 顶部 */\n.a{ color:red; }');
});

test('formatCompact: @media 内部按层缩进（C1 回归）', () => {
  const output = formatCompact('@media (min-width: 600px) {\n  .a { color: red; }\n  .b { color: blue; }\n}');

  assert.equal(
    output,
    '@media (min-width:600px){\n    .a{ color:red; }\n    .b{ color:blue; }\n}',
  );
});

test('formatCompact: @keyframes 内部按层缩进（C2 回归）', () => {
  const output = formatCompact('@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }');

  assert.equal(
    output,
    '@keyframes spin{\n    from{ transform:rotate(0); }\n    to{ transform:rotate(360deg); }\n}',
  );
});

test('formatCompact: 容器块内的嵌套规则仍各自一行', () => {
  const output = formatCompact('@supports (display: grid) { .a { display: grid; } }');
  assert.ok(output.startsWith('@supports (display:grid){'), output);
  assert.ok(output.includes('    .a{ display:grid; }'), output);
});

test('formatCompact: 紧凑产物仍是合法 CSS（括号配平）', () => {
  const output = formatCompact('@media (min-width: 600px) { .a { color: red; } .b { color: blue; } }');
  const open = (output.match(/{/g) || []).length;
  const close = (output.match(/}/g) || []).length;
  assert.equal(open, close);
});

test('formatExpanded: 属性各占一行，容器块内递归', () => {
  const output = formatExpanded('@media (min-width: 600px) { .a { color: red; margin: 0; } }');

  assert.equal(
    output,
    '@media (min-width:600px){\n    .a{\n        color:red;\n        margin:0;\n    }\n}',
  );
});

test('formatExpanded: 空规则是 {}', () => {
  assert.equal(formatExpanded('.a { }'), '.a{}');
});

test('splitBlocks: 顶层切成 prelude/body，尾部裸语句单独成项', () => {
  const blocks = splitBlocks('.a{color:red}.b{color:blue}');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].prelude, '.a');
  assert.equal(blocks[0].body, 'color:red');
  assert.equal(blocks[1].prelude, '.b');

  const bare = splitBlocks('@charset "UTF-8";');
  assert.equal(bare.length, 1);
  assert.equal(bare[0].raw, '@charset "UTF-8";');
});

test('extractCommentsOutsideBlocks: 只提顶层注释', () => {
  const { css, comments } = extractCommentsOutsideBlocks('/* 顶层 */.a{/* 内层 */color:red}', true);
  assert.deepEqual(comments, ['/* 顶层 */']);
  assert.ok(css.includes('/* 内层 */'), css);
});

test('formatCompact: 同一份输入幂等', () => {
  const once = formatCompact('@media (min-width: 600px) { .a { color: red; } }');
  const twice = formatCompact(once);
  assert.equal(twice, once);
});
