'use strict';

/**
 * 保存时自动编译 SCSS 的端到端回归：用户设了 `scssAutoCompile: true` 却什么都不发生。
 * 根因是 readSetting 用了 scoped 配置 + 全键，键被双重加前缀后总退回默认值。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const disposable = () => ({ dispose() {} });

function buildStub(explicitSettings) {
  const state = { saveHandler: null, created: [], messages: [] };

  const rootConfig = {
    get: (key, fallback) => (key in explicitSettings ? explicitSettings[key] : fallback),
    inspect: (key) => ({
      key,
      defaultValue: undefined,
      globalValue: key in explicitSettings ? explicitSettings[key] : undefined,
      workspaceValue: undefined,
      workspaceFolderValue: undefined,
    }),
    update: async () => {},
  };

  const vscode = {
    ConfigurationTarget: { Workspace: 2, WorkspaceFolder: 3, Global: 1 },
    Uri: { file: (p) => ({ fsPath: p }), joinPath: (a, b) => ({ fsPath: `${a.fsPath}/${b}` }) },
    Position: class {}, Selection: class {}, Range: class {}, Location: class {},
    CompletionItem: class {}, CompletionItemKind: {}, SnippetString: class {},
    TextEdit: { replace: (r, t) => ({ range: r, newText: t }) },
    window: {
      activeTextEditor: undefined,
      visibleTextEditors: [],
      createOutputChannel: () => ({ appendLine() {}, dispose() {} }),
      createTextEditorDecorationType: () => disposable(),
      onDidChangeVisibleTextEditors: () => disposable(),
      showInformationMessage: (m) => state.messages.push(m),
      showErrorMessage: (m) => state.messages.push('ERR:' + m),
      showWarningMessage: () => {},
      showInputBox: async () => 'x',
      showQuickPick: async (items) => items,
      showTextDocument: async () => ({}),
    },
    workspace: {
      textDocuments: [],
      workspaceFolders: [{ name: 'ws', uri: { fsPath: '/ws' } }],
      fs: {
        readFile: async () => Buffer.from('{}'),
        writeFile: async () => {},
        stat: async () => { throw Object.assign(new Error('nf'), { code: 'FileNotFound' }); },
        createDirectory: async () => {},
        delete: async () => {},
      },
      getConfiguration: () => rootConfig,
      getWorkspaceFolder: () => ({ uri: { fsPath: '/ws' } }),
      onDidChangeTextDocument: () => disposable(),
      onDidChangeConfiguration: () => disposable(),
      onDidSaveTextDocument: (handler) => { state.saveHandler = handler; return disposable(); },
      onWillSaveTextDocument: () => disposable(),
      openTextDocument: async () => ({}),
      asRelativePath: () => 'pages/x',
      findFiles: async () => [],
    },
    languages: {
      registerDocumentFormattingEditProvider: () => disposable(),
      registerDocumentRangeFormattingEditProvider: () => disposable(),
      registerDefinitionProvider: () => disposable(),
      registerCompletionItemProvider: () => disposable(),
      setLanguageConfiguration: () => disposable(),
    },
    commands: {
      registered: new Map(),
      registerCommand(id, fn) { this.registered.set(id, fn); return disposable(); },
      executeCommand: async () => undefined,
    },
  };

  return { vscode, state };
}

function loadScssCommand(explicitSettings) {
  const { vscode, state } = buildStub(explicitSettings);
  const originalLoad = Module._load;
  Module._load = function (request, ...rest) {
    if (request === 'vscode') return vscode;
    return originalLoad.call(this, request, ...rest);
  };

  const modulePath = path.join(__dirname, '..', '..', 'commands', 'scss.js');
  delete require.cache[require.resolve(modulePath)];
  const scssCommand = require(modulePath);
  Module._load = originalLoad;

  const logger = { info() {}, debug() {}, warn() {}, error() {} };
  scssCommand.register({ subscriptions: [] }, { logger });

  return { state, handler: state.saveHandler };
}

function makeScssFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-autocompile-'));
  const file = path.join(dir, 'a.scss');
  fs.writeFileSync(file, '.a { color: red; }', 'utf8');
  return { dir, file };
}

test('scssAutoCompile: true 时保存会真的编译（回归）', () => {
  const { handler } = loadScssCommand({ 'freedomCode.scssAutoCompile': true });
  assert.ok(handler, '应注册保存钩子');

  const { dir, file } = makeScssFile();
  handler({ document: { languageId: 'scss', uri: { fsPath: file } } });

  const output = path.join(dir, 'a.css');
  assert.ok(fs.existsSync(output), '应生成 a.css');
  assert.equal(fs.readFileSync(output, 'utf8'), '.a{ color:red; }');
});

test('scssAutoCompile: 默认值关闭时不会编译', () => {
  const { handler } = loadScssCommand({});
  assert.ok(handler);

  const { dir, file } = makeScssFile();
  handler({ document: { languageId: 'scss', uri: { fsPath: file } } });

  assert.ok(!fs.existsSync(path.join(dir, 'a.css')), '默认不应编译');
});

test('scssAutoCompile: 非 scss 文件不会编译', () => {
  const { handler } = loadScssCommand({ 'freedomCode.scssAutoCompile': true });
  const { dir, file } = makeScssFile();

  handler({ document: { languageId: 'css', uri: { fsPath: file } } });

  assert.ok(!fs.existsSync(path.join(dir, 'a.css')));
});

test('scssAutoCompile: 旧键 scss-compact-autoCompile 仍能开启编译', () => {
  const { handler } = loadScssCommand({ 'freedomCode.scss-compact-autoCompile': true });
  const { dir, file } = makeScssFile();

  handler({ document: { languageId: 'scss', uri: { fsPath: file } } });

  assert.ok(fs.existsSync(path.join(dir, 'a.css')), '旧键应兼容');
});

test('scssOutputExtension 等编译选项能被读到', () => {
  const { handler } = loadScssCommand({
    'freedomCode.scssAutoCompile': true,
    'freedomCode.scssOutputExtension': '.wxss',
  });
  const { dir, file } = makeScssFile();

  handler({ document: { languageId: 'scss', uri: { fsPath: file } } });

  assert.ok(fs.existsSync(path.join(dir, 'a.wxss')), '应使用自定义扩展名输出');
});
