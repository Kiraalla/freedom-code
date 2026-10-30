'use strict';

/**
 * Pug 编译器：真实渲染、输出路径、美化开关、错误处理。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PugCompiler = require('../../util/pug_compiler');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fc-pug-'));
}

function writePug(dir, name, content) {
  const full = path.join(dir, name);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

test('compile: 渲染为 HTML，输出固定 .html', async () => {
  const dir = tempDir();
  const input = writePug(dir, 'a.pug', 'div\n  p hello\n');

  const outputPath = await new PugCompiler().compile(input, { pretty: false });

  assert.equal(outputPath, path.join(dir, 'a.html'));
  assert.ok(fs.readFileSync(outputPath, 'utf8').includes('<p>hello</p>'));
});

test('compile: pretty 默认用 Prettier 美化（缩进可配）', async () => {
  const dir = tempDir();
  const input = writePug(dir, 'a.pug', 'div\n  p hello\n  p world\n');

  const outputPath = await new PugCompiler().compile(input, {
    pretty: true,
    // 小 printWidth 强制换行，才能观察到缩进
    prettierOptions: { tabWidth: 4, printWidth: 20 },
  });
  const html = fs.readFileSync(outputPath, 'utf8');

  assert.ok(html.includes('\n    <p>hello</p>'), html);
});

test('compile: 跳过 _ 开头的部分文件', async () => {
  const dir = tempDir();
  const input = writePug(dir, '_part.pug', 'p x\n');

  const outputPath = await new PugCompiler().compile(input);

  assert.equal(outputPath, undefined);
  assert.ok(!fs.existsSync(path.join(dir, '_part.html')));
});

test('compile: ignoreUnderscoreFiles=false 时照常编译', async () => {
  const dir = tempDir();
  const input = writePug(dir, '_part.pug', 'p x\n');

  const outputPath = await new PugCompiler().compile(input, { ignoreUnderscoreFiles: false });

  assert.ok(fs.existsSync(outputPath));
});

test('compile: custom 输出目录', async () => {
  const dir = tempDir();
  const input = writePug(dir, 'src/a.pug', 'p x\n');

  const outputPath = await new PugCompiler().compile(input, {
    outputPathFormat: 'custom',
    outputPath: 'dist',
  });

  assert.equal(outputPath, path.join(dir, 'src', 'dist', 'a.html'));
});

test('compile: relative 保留层级', async () => {
  const dir = tempDir();
  const input = writePug(dir, 'views/sub/a.pug', 'p x\n');

  const outputPath = await new PugCompiler().compile(input, {
    outputPathFormat: 'relative',
    outputPath: 'out',
    workspacePath: dir,
  });

  assert.equal(outputPath, path.join(dir, 'out', 'views', 'sub', 'a.html'));
});

test('compile: include 按 basedir 解析', async () => {
  const dir = tempDir();
  writePug(dir, 'partials/_head.pug', 'title t\n');
  const input = writePug(dir, 'views/a.pug', 'include /partials/_head.pug\np x\n');

  const outputPath = await new PugCompiler().compile(input, {
    basedir: dir,
    pretty: false,
  });

  assert.ok(fs.readFileSync(outputPath, 'utf8').includes('<title>t</title>'));
});

test('compile: 语法错误会抛出且不留下产物', async () => {
  const dir = tempDir();
  const input = writePug(dir, 'bad.pug', 'div(\n');

  await assert.rejects(() => new PugCompiler().compile(input));
  assert.ok(!fs.existsSync(path.join(dir, 'bad.html')));
});

test('compile: 美化失败时退回未美化输出（不让编译失败）', async () => {
  const dir = tempDir();
  const input = writePug(dir, 'a.pug', 'p x\n');

  const logger = { info() {}, debug() {}, warn() {}, error() {} };
  const compiler = new PugCompiler();
  compiler.setLogger(logger);

  // 故意给一个非法的 prettier 选项，让美化抛错
  const outputPath = await compiler.compile(input, {
    pretty: true,
    prettierOptions: { parser: 'html', plugins: [{}] },
  });

  assert.ok(fs.existsSync(outputPath), '退回未美化输出仍应写出文件');
});

test('compile: logger 收到跳过与成功信息', async () => {
  const dir = tempDir();
  const messages = [];
  const logger = {
    info: (m) => messages.push(m),
    debug: () => {},
    warn: () => {},
    error: () => {},
  };

  const compiler = new PugCompiler();
  compiler.setLogger(logger);

  await compiler.compile(writePug(dir, '_part.pug', 'p x\n'));
  await compiler.compile(writePug(dir, 'a.pug', 'p x\n'), { pretty: false });

  assert.ok(messages.some((m) => m.includes('跳过')), JSON.stringify(messages));
  assert.ok(messages.some((m) => m.includes('已编译')), JSON.stringify(messages));
});

test('resolveBasedir: 显式 > 工作区 > 文件目录', () => {
  const compiler = new PugCompiler();
  const file = path.join('/ws', 'views', 'a.pug');

  assert.equal(compiler.resolveBasedir(file, '/abs/dir', '/ws'), '/abs/dir');
  assert.equal(compiler.resolveBasedir(file, 'rel', '/ws'), path.join('/ws', 'rel'));
  assert.equal(compiler.resolveBasedir(file, '', '/ws'), '/ws');
  assert.equal(compiler.resolveBasedir(file, '', null), path.join('/ws', 'views'));
});
