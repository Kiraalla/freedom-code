'use strict';

/**
 * 代码块数据契约：以后新增 snippet 时，下面这些问题会直接让测试失败。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { hasUnclosedPlaceholder, findNamedPlaceholders } = require('../../util/snippet-placeholders');

const ROOT = path.join(__dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const contributions = pkg.contributes.snippets || [];

const snippetFiles = fs
  .readdirSync(path.join(ROOT, 'snippets'), { recursive: true })
  .filter((f) => f.endsWith('.json'))
  .map((f) => 'snippets/' + f.split(path.sep).join('/'));

const bodyToText = (body) => (Array.isArray(body) ? body.join('\n') : String(body));

test('snippets: 每个文件都是合法 JSON', () => {
  for (const file of snippetFiles) {
    assert.doesNotThrow(
      () => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')),
      `${file} 不是合法 JSON`,
    );
  }
});

test('snippets: package.json 声明的文件都存在，且所有文件都被声明', () => {
  const declared = new Set(contributions.map((c) => c.path.replace('./', '')));

  for (const file of declared) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} 被声明但不存在`);
  }
  for (const file of snippetFiles) {
    assert.ok(declared.has(file), `${file} 没有在 package.json 里声明`);
  }
});

test('snippets: 没有已废弃的语言 id（如 jade）', () => {
  const deprecated = contributions.filter((c) => c.language === 'jade');
  assert.deepEqual(deprecated, [], 'jade 已不是 VS Code 语言 id，贡献不会生效');
});

test('snippets: 每条都有 description', () => {
  const missing = [];
  for (const file of snippetFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    for (const [key, entry] of Object.entries(data)) {
      if (!entry.description || !String(entry.description).trim()) missing.push(`${file}:${key}`);
    }
  }
  assert.deepEqual(missing, [], '缺 description 的条目');
});

test('snippets: 没有 body 与 prefix 相同的"伪代码块"', () => {
  const stubs = [];
  for (const file of snippetFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    for (const [key, entry] of Object.entries(data)) {
      if (bodyToText(entry.body).trim() === String(entry.prefix).trim()) {
        stubs.push(`${file}:${key}`);
      }
    }
  }
  assert.deepEqual(stubs, [], '插回原词的条目没有价值，应删除或改成真实代码');
});

test('snippets: 占位符必须闭合，且不能用 ${名字} 冒充占位符', () => {
  const problems = [];
  for (const file of snippetFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    for (const [key, entry] of Object.entries(data)) {
      const body = bodyToText(entry.body);
      if (hasUnclosedPlaceholder(body)) problems.push(`${file}:${key} 有未闭合的占位`);
      for (const name of findNamedPlaceholders(body)) {
        problems.push(`${file}:${key} 把 \${${name}} 当占位符用（应写成 \${1:${name}}）`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('snippets: 同一语言内没有重复 prefix', () => {
  const seen = new Map();
  const conflicts = [];

  for (const contribution of contributions) {
    const file = contribution.path.replace('./', '');
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

    for (const [key, entry] of Object.entries(data)) {
      const id = `${contribution.language}::${entry.prefix}`;
      if (seen.has(id)) {
        conflicts.push(`${id} ← ${seen.get(id)} 与 ${file}:${key}`);
      } else {
        seen.set(id, `${file}:${key}`);
      }
    }
  }

  assert.deepEqual(conflicts, [], '同一语言下同 prefix 会给出两个不相关候选');
});
