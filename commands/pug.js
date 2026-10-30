'use strict';

const vscode = require('vscode');

const PugCompiler = require('../util/pug_compiler');
const format_core = require('../wxml_plus/format_core');
const { readSetting } = require('../util/settings');
const { registerCommand } = require('./registry');

/** 「未开启自动编译」提示只弹一次 */
const NOTICE_KEY = 'freedom-code.notice.pugAutoCompile';

/**
 * 是否 Pug 文件。
 *
 * 不能只看 `languageId`：安装扩展**之前**就打开的 `.pug` 标签页，VS Code 仍把它当
 * `plaintext`（语言关联不会自动刷新），只看 languageId 会直接跳过保存钩子。
 * @param {vscode.TextDocument} document
 * @returns {boolean}
 */
function isPugDocument(document) {
  if (!document) return false;
  if (document.languageId === 'pug') return true;

  const filePath = document.uri && document.uri.fsPath ? document.uri.fsPath : '';
  return /\.(pug|jade)$/i.test(filePath);
}

/**
 * 编译选项。用根配置 + 全键（见 util/settings.js 的键名约定）。
 * @param {vscode.WorkspaceConfiguration} cfg
 * @param {import('vscode').WorkspaceFolder | undefined} workspaceFolder
 */
function compileOptions(cfg, workspaceFolder) {
  return {
    ignoreUnderscoreFiles: cfg.get('freedomCode.pugIgnoreUnderscore', true),
    pretty: cfg.get('freedomCode.pugPretty', true),
    outputPath: cfg.get('freedomCode.pugOutputPath', ''),
    outputPathFormat: cfg.get('freedomCode.pugOutputPathFormat', 'same'),
    basedir: cfg.get('freedomCode.pugBasedir', ''),
    workspacePath: workspaceFolder ? workspaceFolder.uri.fsPath : null,
  };
}

/**
 * 美化 HTML 用的 Prettier 配置：复用项目的格式化配置（含 overrides 解析），
 * 但去掉 overrides 与 parser（交给 Prettier 会报错）。
 * @param {string} filePath
 * @returns {Promise<object>}
 */
async function prettierOptionsFor(filePath) {
  try {
    const merged = await format_core.ConfigManager.getMergedPrettierConfig('html', filePath);
    const options = { ...merged };
    delete options.overrides;
    delete options.parser;
    return options;
  } catch (error) {
    return {};
  }
}

/**
 * @param {vscode.Uri} uri
 * @param {object} logger
 */
async function compileDocument(uri, logger) {
  const cfg = vscode.workspace.getConfiguration();
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);

  const compiler = new PugCompiler();
  compiler.setLogger(logger);

  const options = compileOptions(cfg, workspaceFolder);
  options.prettierOptions = await prettierOptionsFor(uri.fsPath);

  return compiler.compile(uri.fsPath, options);
}

/**
 * 保存时发现没开自动编译，提示一次（不写用户配置）。
 * @param {vscode.ExtensionContext} context
 * @param {object} logger
 */
async function noticeAutoCompileOff(context, logger) {
  try {
    if (context.globalState.get(NOTICE_KEY)) return;
    await context.globalState.update(NOTICE_KEY, true);

    const enable = '开启自动编译';
    const picked = await vscode.window.showInformationMessage(
      'Pug 文件已保存，但没有生成 HTML：自动编译当前是关闭的。',
      enable,
    );

    if (picked === enable) {
      await vscode.workspace
        .getConfiguration()
        .update('freedomCode.pugAutoCompile', true, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage('已开启 Pug 保存时自动编译（freedomCode.pugAutoCompile）。');
    }
  } catch (error) {
    logger.debug(`Pug 自动编译提示失败: ${error.message}`);
  }
}

/**
 * @param {vscode.ExtensionContext} context
 * @param {{ logger: object }} deps
 */
function register(context, deps) {
  const { logger } = deps;

  // 手动编译当前 Pug 文件
  registerCommand(context, 'extension.compilePug', async () => {
    logger.debug('编译 Pug 命令被触发');

    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('没有活动的编辑器');
        return;
      }

      if (!isPugDocument(editor.document)) {
        vscode.window.showWarningMessage('当前文件不是 Pug 文件');
        return;
      }

      const outputPath = await compileDocument(editor.document.uri, logger);
      if (outputPath) {
        vscode.window.showInformationMessage(`Pug 编译完成：${outputPath}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Pug 编译失败: ${error.message}`);
      logger.error('Pug 编译失败', error);
    }
  });

  // 保存后自动编译（默认关闭，未开启时提示一次）
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((event) => {
      try {
        const doc = event.document || vscode.window.activeTextEditor?.document;
        if (!isPugDocument(doc)) {
          return;
        }

        const cfg = vscode.workspace.getConfiguration();
        const autoCompile = readSetting(cfg, ['freedomCode.pugAutoCompile'], false);

        if (!autoCompile) {
          noticeAutoCompileOff(context, logger);
          return;
        }

        logger.debug('触发保存后 Pug 编译');
        compileDocument(doc.uri, logger).then(
          (outputPath) => {
            if (outputPath) {
              logger.info(`Pug 已编译: ${outputPath}`);
            }
          },
          (error) => {
            logger.error('保存后 Pug 编译失败', error);
            vscode.window.showErrorMessage(`Pug 编译失败: ${error.message}`);
          },
        );
      } catch (error) {
        logger.error('保存后 Pug 编译错误', error);
      }
    }),
  );
}

module.exports = { register, isPugDocument };
