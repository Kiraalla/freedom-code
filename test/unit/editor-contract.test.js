'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  decideQuoteInsertion,
  applyEditorFormattingOptions,
  mapCursorAfterInsertions,
} = require('../../wxml_plus/editor-contract');

/** 模拟"用户刚在行尾键入 ="，返回决策 */
const afterTypingEquals = (linePrefix) =>
  decideQuoteInsertion(`${linePrefix}=`, linePrefix.length + 1);

test('decideQuoteInsertion: 标签内的属性名后补引号', () => {
  assert.deepEqual(afterTypingEquals('<view class'), { insertAt: 12, cursorOffset: 1 });
});

test('decideQuoteInsertion: Vue 的绑定/事件/动态属性写法都认', () => {
  assert.ok(afterTypingEquals('<view v-model'), 'v-model');
  assert.ok(afterTypingEquals('<view :src'), ':src');
  assert.ok(afterTypingEquals('<view @tap'), '@tap');
  assert.ok(afterTypingEquals('<view [prop]'), '[prop]');
});

test('decideQuoteInsertion: 等号前有空格不补（`a = 1`）', () => {
  assert.equal(decideQuoteInsertion('<view class =', 14), null);
});

test('decideQuoteInsertion: 已经在引号内不补', () => {
  const line = '<view :class="a =';
  assert.equal(decideQuoteInsertion(line, line.length), null);
});

test('decideQuoteInsertion: 等号后已经有引号不补', () => {
  const line = '<view class=""';
  assert.equal(decideQuoteInsertion(line, 12), null);
});

test('decideQuoteInsertion: 比较/复合运算符不介入（B4）', () => {
  // `==`：键入第二个等号时，等号后面是 = 的镜像场景
  assert.equal(decideQuoteInsertion('<view a==', 10), null, '==');
  assert.equal(decideQuoteInsertion('<view a===', 11), null, '===');
});

test('decideQuoteInsertion: Vue <script> 里的赋值不补（B4 回归）', () => {
  assert.equal(afterTypingEquals('  let a '), null, '带空格的赋值');
  assert.equal(afterTypingEquals('  const x=1; let b '), null);

  // 没有空格的紧凑赋值，靠"必须在起始标签内"这条守卫拦下
  assert.equal(decideQuoteInsertion('  let a=', 9), null);
  assert.equal(decideQuoteInsertion('  total+=', 9), null);
});

test('decideQuoteInsertion: 标签外的文本内容不补', () => {
  assert.equal(decideQuoteInsertion('<view>a=', 9), null);
  assert.equal(decideQuoteInsertion('普通文本 a=', 6), null);
});

test('decideQuoteInsertion: 同一行有多个标签时只看当前标签', () => {
  assert.ok(decideQuoteInsertion('<view></view><text class=', 25));
  assert.equal(decideQuoteInsertion('<view class="a"></view> text=', 31), null);
});

test('decideQuoteInsertion: 非法列坐标安全返回 null', () => {
  assert.equal(decideQuoteInsertion('', 0), null);
  assert.equal(decideQuoteInsertion('<view=', 0), null);
  assert.equal(decideQuoteInsertion('<view=', 999), null);
});

test('applyEditorFormattingOptions: 编辑器缩进覆盖 Prettier 配置', () => {
  const prettier = { tabWidth: 2, useTabs: false, semi: false };
  const merged = applyEditorFormattingOptions(prettier, { tabSize: 4, insertSpaces: true });

  assert.equal(merged.tabWidth, 4);
  assert.equal(merged.useTabs, false);
  assert.equal(merged.semi, false, '其余选项原样保留');
});

test('applyEditorFormattingOptions: insertSpaces=false 时用制表符', () => {
  const merged = applyEditorFormattingOptions({ tabWidth: 2 }, { tabSize: 8, insertSpaces: false });
  assert.equal(merged.useTabs, true);
  assert.equal(merged.tabWidth, 8);
});

test('applyEditorFormattingOptions: 无 options 时不改动，也不修改入参', () => {
  const prettier = { tabWidth: 2, useTabs: false };
  const merged = applyEditorFormattingOptions(prettier, undefined);

  assert.deepEqual(merged, prettier);
  assert.notEqual(merged, prettier, '应返回新对象');

  applyEditorFormattingOptions(prettier, { tabSize: 4, insertSpaces: true });
  assert.equal(prettier.tabWidth, 2, '入参不能被改写');
});

test('mapCursorAfterInsertions: 光标落进自己的引号中间', () => {
  const insertions = [{ line: 0, character: 12 }];
  assert.equal(mapCursorAfterInsertions(0, 12, insertions), 13, '插在光标处 → +1');
});

test('mapCursorAfterInsertions: 避开同一行里更早的插入', () => {
  const insertions = [
    { line: 0, character: 5 },
    { line: 0, character: 20 },
  ];
  assert.equal(mapCursorAfterInsertions(0, 20, insertions), 23, '前面那对引号推了 2 列，再加自己 1 列');
  assert.equal(mapCursorAfterInsertions(0, 5, insertions), 6, '第一个光标不受后面影响');
});

test('mapCursorAfterInsertions: 其他行的插入不影响本行', () => {
  const insertions = [{ line: 3, character: 2 }];
  assert.equal(mapCursorAfterInsertions(0, 10, insertions), 10);
});

test('mapCursorAfterInsertions: 没有插入时原样返回', () => {
  assert.equal(mapCursorAfterInsertions(1, 7, []), 7);
});

test('applyEditorFormattingOptions: 用户显式写的 tabWidth 不被编辑器覆盖', () => {
  const merged = applyEditorFormattingOptions(
    { tabWidth: 4, useTabs: false },
    { tabSize: 2, insertSpaces: true },
    { tabWidth: true },
  );

  assert.equal(merged.tabWidth, 4, '显式配置优先于编辑器');
  assert.equal(merged.useTabs, false);
});

test('applyEditorFormattingOptions: 用户显式写的 useTabs 不被编辑器覆盖', () => {
  const merged = applyEditorFormattingOptions(
    { tabWidth: 2, useTabs: true },
    { tabSize: 4, insertSpaces: true },
    { useTabs: true },
  );

  assert.equal(merged.useTabs, true);
  assert.equal(merged.tabWidth, 4, '未显式的 tabWidth 仍跟随编辑器');
});

test('applyEditorFormattingOptions: 两项都显式时完全无视编辑器', () => {
  const merged = applyEditorFormattingOptions(
    { tabWidth: 8, useTabs: true },
    { tabSize: 2, insertSpaces: true },
    { tabWidth: true, useTabs: true },
  );

  assert.equal(merged.tabWidth, 8);
  assert.equal(merged.useTabs, true);
});
