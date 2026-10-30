'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  deriveEditorSettings,
  diffEditorSettings,
  languageFromPattern,
} = require('../../util/style-settings');

test('deriveEditorSettings: 缩进与空白相关键都从 prettierOptions 推导', () => {
  const derived = deriveEditorSettings({ tabWidth: 4, useTabs: false });

  assert.equal(derived.global['editor.tabSize'], 4);
  assert.equal(derived.global['editor.insertSpaces'], true);
  assert.equal(derived.global['editor.formatOnSave'], true);
  assert.equal(derived.global['files.insertFinalNewline'], true);
  assert.equal(derived.global['files.trimTrailingWhitespace'], true);
});

test('deriveEditorSettings: useTabs=true 时关闭 insertSpaces', () => {
  assert.equal(deriveEditorSettings({ useTabs: true }).global['editor.insertSpaces'], false);
});

test('deriveEditorSettings: 没有 tabWidth 时不写 editor.tabSize', () => {
  assert.ok(!('editor.tabSize' in deriveEditorSettings({}).global));
});

test('deriveEditorSettings: overrides 推导出语言级缩进', () => {
  const derived = deriveEditorSettings({
    tabWidth: 2,
    overrides: [
      { files: ['*.scss'], options: { tabWidth: 4 } },
      { files: ['*.wxml'], options: { tabWidth: 2, useTabs: false } },
    ],
  });

  assert.deepEqual(derived.languages.scss, { 'editor.tabSize': 4 });
  assert.deepEqual(derived.languages.wxml, { 'editor.tabSize': 2, 'editor.insertSpaces': true });
});

test('deriveEditorSettings: 语言级只含缩进，不含 formatOnSave / files.*', () => {
  const derived = deriveEditorSettings({ overrides: [{ files: ['*.vue'], options: { tabWidth: 2 } }] });
  assert.deepEqual(Object.keys(derived.languages.vue), ['editor.tabSize']);
});

test('deriveEditorSettings: 与缩进无关的 override 不产生语言条目', () => {
  const derived = deriveEditorSettings({
    overrides: [{ files: ['*.scss'], options: { singleQuote: true } }],
  });
  assert.deepEqual(derived.languages, {});
});

test('deriveEditorSettings: 不支持的 glob 形式被跳过', () => {
  const derived = deriveEditorSettings({
    overrides: [{ files: ['**/*.scss', 'styles/'], options: { tabWidth: 4 } }],
  });
  assert.deepEqual(derived.languages, {});
});

test('languageFromPattern: 只认 *.ext 形式', () => {
  assert.equal(languageFromPattern('*.js'), 'javascript');
  assert.equal(languageFromPattern('*.TS'), 'typescript');
  assert.equal(languageFromPattern('**/*.js'), null);
  assert.equal(languageFromPattern('*.unknown'), null);
  assert.equal(languageFromPattern(undefined), null);
});

test('diffEditorSettings: 完全一致时返回空数组', () => {
  const derived = deriveEditorSettings({ tabWidth: 2 });
  const changes = diffEditorSettings(derived, {
    global: { ...derived.global },
    languages: {},
  });

  assert.deepEqual(changes, []);
});

test('diffEditorSettings: editor.tabSize 为 auto 也算不一致（漂移的典型情形）', () => {
  const derived = deriveEditorSettings({ tabWidth: 2 });
  const changes = diffEditorSettings(derived, { global: { 'editor.tabSize': 'auto' } });

  const tabSize = changes.find((change) => change.key === 'editor.tabSize');
  assert.ok(tabSize, 'tabSize 应出现在差异里');
  assert.equal(tabSize.current, 'auto');
  assert.equal(tabSize.next, 2);
  assert.equal(tabSize.scope, 'global');
});

test('diffEditorSettings: 语言级差异带 language 与作用域', () => {
  const derived = deriveEditorSettings({ overrides: [{ files: ['*.scss'], options: { tabWidth: 4 } }] });
  const changes = diffEditorSettings(derived, { global: { ...derived.global } });

  assert.deepEqual(changes, [
    { scope: 'language', language: 'scss', key: 'editor.tabSize', current: undefined, next: 4 },
  ]);
});

test('diffEditorSettings: 只返回有差异的键', () => {
  const derived = deriveEditorSettings({ tabWidth: 2 });
  const changes = diffEditorSettings(derived, {
    global: { ...derived.global, 'editor.formatOnSave': false },
  });

  assert.equal(changes.length, 1);
  assert.equal(changes[0].key, 'editor.formatOnSave');
  assert.equal(changes[0].current, false);
  assert.equal(changes[0].next, true);
});
