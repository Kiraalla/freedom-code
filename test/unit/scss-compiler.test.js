'use strict';

/**
 * SCSS 编译器测试：覆盖自定义 CSS 紧凑格式化、注释处理、输出路径策略与错误处理。
 * 这是仓库里算法最密的一块（388 行），此前零测试。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCSSCompiler = require('../../util/scss_compiler');

const compiler = new SCSSCompiler();

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fc-scss-'));
}

function writeFile(dir, name, content) {
  const full = path.join(dir, name);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

// ---------- 纯格式化方法 ----------

test('formatCompact: 每个规则一行，属性之间用单个空格分隔', () => {
  const css = '.a {\n  color: red;\n  margin: 0;\n}\n';
  assert.equal(compiler.formatCompact(css), '.a{ color:red; margin:0; }');
});

test('formatCompact: 多条规则各占一行', () => {
  const css = '.a { color: red; }\n.b { color: blue; }\n';
  assert.equal(compiler.formatCompact(css), '.a{ color:red; }\n.b{ color:blue; }');
});

test('formatCompact: 空规则输出为 {}', () => {
  assert.equal(compiler.formatCompact('.a { }'), '.a{}');
});

test('formatCompact: 默认去掉注释', () => {
  const css = '/* 顶部注释 */\n.a { color: red; }\n';
  assert.equal(compiler.formatCompact(css), '.a{ color:red; }');
});

test('formatCompact: preserveComments 时保留顶部注释', () => {
  const css = '/* 顶部注释 */\n.a { color: red; }\n';
  const output = compiler.formatCompact(css, true);
  assert.ok(output.includes('/* 顶部注释 */'), output);
  assert.ok(output.includes('.a{ color:red; }'), output);
});

test('formatCompact: 块内注释保留在属性前面', () => {
  const css = '.a { /* 说明 */ color: red; }';
  const output = compiler.formatCompact(css, true);
  assert.ok(output.includes('/* 说明 */'), output);
  assert.ok(output.includes('color:red;'), output);
});

test('formatCompact: 字符串里的花括号不被当成规则边界', () => {
  const css = '.a { content: "{x}"; }';
  const output = compiler.formatCompact(css);
  assert.equal(output, '.a{ content:"{x}"; }');
});

test('formatCompact: 字符串里的花括号不会被当成规则边界（回归）', () => {
  assert.equal(compiler.formatCompact('.a { content: "{x}"; }'), '.a{ content:"{x}"; }');
  assert.equal(compiler.formatCompact('.a { content: "}"; }'), '.a{ content:"}"; }');
  assert.equal(
    compiler.formatCompact('.a { background: url("data:image/svg+xml,<svg>{}</svg>"); }'),
    '.a{ background:url("data:image/svg+xml,<svg>{}</svg>"); }',
  );
});

test('formatCompact: 字符串里的转义引号保持完整', () => {
  const css = '.a { content: "a\\"b"; }';
  assert.ok(compiler.formatCompact(css).includes('"a\\"b"'), compiler.formatCompact(css));
});

test('formatCompact: 单引号字符串同样受保护', () => {
  assert.equal(compiler.formatCompact(".a { content: '{x}'; }"), ".a{ content:'{x}'; }");
});

test('formatExpanded: 属性各占一行', () => {
  const css = '.a { color: red; margin: 0; }';
  const output = compiler.formatExpanded(css);
  assert.ok(output.includes('.a{'), output);
  assert.ok(/\n {4}color:red;/.test(output), output);
  assert.ok(/\n {4}margin:0;/.test(output), output);
});

test('formatExpanded: 空规则输出为 {}', () => {
  assert.equal(compiler.formatExpanded('.a { }'), '.a{}');
});

// ---------- 注释抽取 ----------

test('extractCommentsOutsideBlocks: preserveComments=false 时直接剥掉所有注释', () => {
  const { css, comments } = compiler.extractCommentsOutsideBlocks('/* a */ .x { color: red; }', false);
  assert.deepEqual(comments, []);
  assert.ok(!css.includes('/* a */'), css);
});

test('extractCommentsOutsideBlocks: 只把顶层注释提为占位符', () => {
  const { css, comments } = compiler.extractCommentsOutsideBlocks(
    '/* 顶层 */\n.a { /* 块内 */ color: red; }\n',
    true,
  );
  assert.equal(comments.length, 1);
  assert.equal(comments[0], '/* 顶层 */');
  assert.ok(css.includes('__COMMENT_0__'), css);
  assert.ok(css.includes('/* 块内 */'), css);
});

test('extractCommentsOutsideBlocks: 字符串里的 /* 不算注释', () => {
  const { comments } = compiler.extractCommentsOutsideBlocks('.a { content: "/*x*/"; }', true);
  assert.deepEqual(comments, []);
});

// ---------- 扩展名后处理 ----------

test('postProcessForCustomExtension: .css 输出不做改写', () => {
  const css = "@import url('a.css');\n.a { background: url(b.css); }";
  assert.equal(compiler.postProcessForCustomExtension(css, '.css'), css);
});

test('postProcessForCustomExtension: 自定义扩展名改写 @import 与 url()', () => {
  const css = "@import url('a.css');\n.a { background: url(b.css); }";
  const output = compiler.postProcessForCustomExtension(css, '.wxss');
  assert.ok(output.includes('a.wxss'), output);
  assert.ok(output.includes('b.wxss'), output);
  assert.ok(!output.includes('.css'), output);
});

test('postProcessForCustomExtension: @import "x.css" 也会被改写', () => {
  const output = compiler.postProcessForCustomExtension('@import "x.css";', '.acss');
  assert.ok(output.includes('@import "x.acss";'), output);
});

test('postProcessForCustomExtension: 扩展名不带点也能工作', () => {
  const output = compiler.postProcessForCustomExtension("@import url('a.css');", 'wxss');
  assert.ok(output.includes('a.wxss'), output);
});

// ---------- compile：真实 sass ----------

test('compile: 默认输出到同目录、紧凑格式、去掉 charset', () => {
  const dir = makeTempDir();
  const input = writeFile(dir, 'a.scss', '$c: red;\n.a {\n  color: $c;\n}\n');

  const outputPath = compiler.compile(input);

  assert.equal(outputPath, path.join(dir, 'a.css'));
  const css = fs.readFileSync(outputPath, 'utf8');
  assert.equal(css, '.a{ color:red; }');
  assert.ok(!css.includes('@charset'), css);
});

test('compile: 跳过 `_` 开头的部分文件', () => {
  const dir = makeTempDir();
  const input = writeFile(dir, '_part.scss', '.a { color: red; }');

  const outputPath = compiler.compile(input);

  assert.equal(outputPath, undefined);
  assert.ok(!fs.existsSync(path.join(dir, '_part.css')));
});

test('compile: ignoreUnderscoreFiles=false 时照常编译部分文件', () => {
  const dir = makeTempDir();
  const input = writeFile(dir, '_part.scss', '.a { color: red; }');

  const outputPath = compiler.compile(input, { ignoreUnderscoreFiles: false });

  assert.ok(fs.existsSync(outputPath));
});

test('compile: 自定义输出扩展名', () => {
  const dir = makeTempDir();
  const input = writeFile(dir, 'a.scss', '.a { color: red; }');

  const outputPath = compiler.compile(input, { outputExtension: '.wxss' });

  assert.ok(outputPath.endsWith('a.wxss'), outputPath);
});

test('compile: custom 输出目录（相对源文件）', () => {
  const dir = makeTempDir();
  const input = writeFile(dir, 'src/a.scss', '.a { color: red; }');

  const outputPath = compiler.compile(input, {
    outputPathFormat: 'custom',
    outputPath: 'dist',
  });

  assert.equal(outputPath, path.join(dir, 'src', 'dist', 'a.css'));
  assert.ok(fs.existsSync(outputPath));
});

test('compile: relative 输出目录保留相对工作区的层级', () => {
  const dir = makeTempDir();
  const input = writeFile(dir, 'styles/sub/a.scss', '.a { color: red; }');

  const outputPath = compiler.compile(input, {
    outputPathFormat: 'relative',
    outputPath: 'out',
    workspacePath: dir,
  });

  assert.equal(outputPath, path.join(dir, 'out', 'styles', 'sub', 'a.css'));
  assert.ok(fs.existsSync(outputPath));
});

test('compile: outputCompact=false 时输出展开格式', () => {
  const dir = makeTempDir();
  const input = writeFile(dir, 'a.scss', '.a { color: red; }');

  const outputPath = compiler.compile(input, { outputCompact: false });
  const css = fs.readFileSync(outputPath, 'utf8');

  assert.ok(/\n {4}color:red;/.test(css), css);
});

test('compile: removeCharset=false 时保留 charset', () => {
  const dir = makeTempDir();
  const input = writeFile(dir, 'a.scss', '.a { content: "中"; }');

  const outputPath = compiler.compile(input, { removeCharset: false, preserveComments: true });
  const css = fs.readFileSync(outputPath, 'utf8');

  assert.ok(css.includes('@charset'), css);
});

test('compile: 语法错误会抛出，且不留下输出文件', () => {
  const dir = makeTempDir();
  const input = writeFile(dir, 'bad.scss', '.a { color: ; ');

  assert.throws(() => compiler.compile(input), /./);
  assert.ok(!fs.existsSync(path.join(dir, 'bad.css')));
});

test('compile: includePaths 能解析 @use', () => {
  const dir = makeTempDir();
  writeFile(dir, 'shared/_vars.scss', '$c: red;');
  const input = writeFile(dir, 'a.scss', '@use "vars";\n.a { color: vars.$c; }');

  const outputPath = compiler.compile(input, { includePaths: [path.join(dir, 'shared')] });

  assert.ok(fs.readFileSync(outputPath, 'utf8').includes('color:red'), '应解析到 includePaths 里的变量');
});

test('compile: logger 收到跳过提示', () => {
  const dir = makeTempDir();
  const input = writeFile(dir, '_part.scss', '.a { color: red; }');

  const messages = [];
  const local = new SCSSCompiler();
  local.setLogger({
    info: (message) => messages.push(message),
    debug: () => {},
    warn: () => {},
    error: () => {},
  });

  local.compile(input);

  assert.ok(messages.some((m) => m.includes('跳过')), JSON.stringify(messages));
});

test('compile: 编译失败时 logger.error 被调用', () => {
  const dir = makeTempDir();
  const input = writeFile(dir, 'bad.scss', '.a { color: ; ');

  const errors = [];
  const local = new SCSSCompiler();
  local.setLogger({
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: (message) => errors.push(message),
  });

  assert.throws(() => local.compile(input));
  assert.ok(errors.length > 0, '应记录错误');
});
