'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  findMarkupRanges,
  protectVerbatimBlocks,
  restoreVerbatimBlocks,
  applyMustacheSpacing,
  protectComments,
  restoreComments,
} = require('../../wxml_plus/pipeline');

const VUE_FILE = [
  '<template>',
  '  <div class="box">{{msg}}</div>',
  '</template>',
  '',
  '<script>',
  'export default {',
  '  data() {',
  '    return {count:0};',
  '  }',
  '}',
  '</script>',
  '',
  '<style>',
  '.box{color:red}',
  '</style>',
  '',
].join('\n');

const markupOf = (text, fileType) =>
  findMarkupRanges(text, fileType)
    .map(([start, end]) => text.slice(start, end))
    .join('');

test('findMarkupRanges: vue 只返回 <template> 内容', () => {
  const markup = markupOf(VUE_FILE, 'vue');
  assert.ok(markup.includes('{{msg}}'), '模板区应在范围内');
  assert.ok(!markup.includes('count:0'), '<script> 不应在范围内');
  assert.ok(!markup.includes('color:red'), '<style> 不应在范围内');
});

test('findMarkupRanges: wxml 全文都是标记区', () => {
  const wxml = '<view>{{a}}</view><wxs module="m">module.exports={}</wxs>';
  assert.deepEqual(findMarkupRanges(wxml, 'wxml'), [[0, wxml.length]]);
  assert.deepEqual(findMarkupRanges('', 'wxml'), []);
});

test('findMarkupRanges: 非标记类文件没有标记区', () => {
  assert.deepEqual(findMarkupRanges('const a={b:1}', 'javascript'), []);
  assert.deepEqual(findMarkupRanges('.a{color:red}', 'css'), []);
});

test('applyMustacheSpacing: script/style 里的花括号永远不被改写（B1）', () => {
  const result = applyMustacheSpacing(VUE_FILE, {
    spacing: 'space',
    ranges: findMarkupRanges(VUE_FILE, 'vue'),
    singleBraces: true,
  });

  assert.ok(result.includes('return {count:0};'), 'script 里的对象字面量必须原样');
  assert.ok(result.includes('.box{color:red}'), 'style 里的规则必须原样');
  assert.ok(result.includes('{{ msg }}'), '模板区的 mustache 应被规范化');
});

test('applyMustacheSpacing: preserve 完全不动', () => {
  assert.equal(
    applyMustacheSpacing(VUE_FILE, {
      spacing: 'preserve',
      ranges: findMarkupRanges(VUE_FILE, 'vue'),
    }),
    VUE_FILE,
  );
});

test('applyMustacheSpacing: nospace 与展开运算符', () => {
  const text = '<view>{{ a }} {{...rest}}</view>';
  const result = applyMustacheSpacing(text, {
    spacing: 'nospace',
    ranges: [[0, text.length]],
  });
  assert.ok(result.includes('{{a}}'));
  assert.ok(result.includes('{{...rest}}'), '展开运算符不加空格');
});

test('applyMustacheSpacing: wxml 不处理单花括号', () => {
  const text = '<view data-x="{{b}}" style="{c}"></view>';
  const result = applyMustacheSpacing(text, {
    spacing: 'space',
    ranges: findMarkupRanges(text, 'wxml'),
    singleBraces: false,
  });
  assert.ok(result.includes('{{ b }}'));
  assert.ok(result.includes('{c}'), 'WXML 没有单花括号语法，不许动它');
});

test('protectVerbatimBlocks: WXML 的 template 与 wxs 块原样保留（B3）', () => {
  const wxml = [
    '<view>before</view>',
    '<template name="row">',
    '  <view class="row">{{ item.name }}</view>',
    '</template>',
    '<wxs module="utils">module.exports = { a: 1 }</wxs>',
    '<view>after</view>',
  ].join('\n');

  const { code, blocks } = protectVerbatimBlocks(wxml, ['template', 'wxs']);
  assert.equal(blocks.length, 2);
  assert.ok(!code.includes('<template'), 'template 块应被替换为哨兵');
  assert.ok(!code.includes('module.exports'), 'wxs 块应被替换为哨兵');
  assert.equal(restoreVerbatimBlocks(code, blocks), wxml, '还原必须逐字符相同');
});

test('protectVerbatimBlocks: 同名嵌套按整块保护', () => {
  const wxml =
    '<template name="outer"><template name="inner"><view>x</view></template></template>';
  const { code, blocks } = protectVerbatimBlocks(wxml, ['template']);
  assert.equal(blocks.length, 1, '嵌套不应拆成两块');
  assert.equal(restoreVerbatimBlocks(code, blocks), wxml);
});

test('protectVerbatimBlocks: 自闭合标签与注释内的标签不受影响', () => {
  const wxml = [
    '<wxs module="m" src="./m.wxs" />',
    '<!-- <template name="ghost"><view>x</view></template> -->',
    '<view>ok</view>',
  ].join('\n');

  const { code, blocks } = protectVerbatimBlocks(wxml, ['template', 'wxs']);
  assert.equal(blocks.length, 0);
  assert.equal(code, wxml);
});

test('protectVerbatimBlocks: 属性值里含 > 也能正确配对', () => {
  const wxml = '<template name="a>b"><view>1</view></template>';
  const { code, blocks } = protectVerbatimBlocks(wxml, ['template']);
  assert.equal(blocks.length, 1);
  assert.equal(restoreVerbatimBlocks(code, blocks), wxml);
});

test('块保护与注释保护的顺序必须可逆', () => {
  const wxml = [
    '<view><!-- 外层注释 --></view>',
    '<template name="t">',
    '  <!-- 块内注释 -->',
    '  <view>{{ x }}</view>',
    '</template>',
  ].join('\n');

  const blocks = protectVerbatimBlocks(wxml, ['template', 'wxs']);
  const comments = protectComments(blocks.code);

  assert.ok(!comments.code.includes('外层注释'), '块外注释应被保护');
  assert.ok(
    !comments.comments.some((c) => c.original.includes('块内注释')),
    '模板块哨兵不能被当成注释二次保护',
  );

  const restored = restoreVerbatimBlocks(
    restoreComments(comments.code, comments.comments),
    blocks.blocks,
  );
  assert.equal(restored, wxml);
});

test('protectComments: 含实体与引号的注释能逐字符还原', () => {
  const code = '<view><!-- a&amp;b "c" --></view>';
  const { code: protectedCode, comments } = protectComments(code);
  assert.equal(comments.length, 1);
  assert.equal(restoreComments(protectedCode, comments), code);
});
