'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeNamedPlaceholders,
  findNamedPlaceholders,
  maxTabstop,
} = require('../../util/snippet-placeholders');

test('findNamedPlaceholders: 找出被当成占位符的变量名', () => {
  assert.deepEqual(findNamedPlaceholders('$(${selector}).load("${url}")'), ['selector', 'url']);
});

test('findNamedPlaceholders: 同一名字只报一次，保持出现顺序', () => {
  assert.deepEqual(findNamedPlaceholders('${b} ${a} ${b}'), ['b', 'a']);
});

test('findNamedPlaceholders: 内置变量不算占位符', () => {
  assert.deepEqual(findNamedPlaceholders('// ${TM_FILENAME} by ${CURRENT_YEAR}'), []);
});

test('normalizeNamedPlaceholders: 无既有编号时从 1 开始', () => {
  assert.equal(
    normalizeNamedPlaceholders('$(${selector}).load("${url}")'),
    '$(${1:selector}).load("${2:url}")',
  );
});

test('normalizeNamedPlaceholders: 同名占位复用同一编号', () => {
  assert.equal(
    normalizeNamedPlaceholders('${value} ${value}'),
    '${1:value} ${1:value}',
  );
});

test('normalizeNamedPlaceholders: 避开已有的数字占位', () => {
  assert.equal(
    normalizeNamedPlaceholders('a(${1:x}, ${name})'),
    'a(${1:x}, ${2:name})',
  );
});

test('normalizeNamedPlaceholders: $1 与 $0 都不撞号', () => {
  assert.equal(
    normalizeNamedPlaceholders('a($1, ${name})$0'),
    'a($1, ${2:name})$0',
  );
});

test('maxTabstop: 忽略 $0 与转义写法', () => {
  assert.equal(maxTabstop('${3:x} $7 $0'), 7);
  assert.equal(maxTabstop('$0 only'), 0);
});

test('normalizeNamedPlaceholders: 内置变量保持原样', () => {
  const body = '// ${TM_FILENAME}\nconst ${name} = 1;';
  assert.equal(
    normalizeNamedPlaceholders(body),
    '// ${TM_FILENAME}\nconst ${1:name} = 1;',
  );
});

test('normalizeNamedPlaceholders: 已经正确的片段完全不变', () => {
  const body = '<div class="${1:name}">$0</div>';
  assert.equal(normalizeNamedPlaceholders(body), body);
});
