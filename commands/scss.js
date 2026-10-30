'use strict';

const vscode = require('vscode');

const SCSSCompiler = require('../util/scss_compiler');
const { readSetting } = require('../util/settings');
const { registerCommand } = require('./registry');

/**
 * 收集编译选项：命令与保存钩子共用同一份，避免两处复制粘贴漂移。
 *
 * 这里用的是**根配置 + 全键**。用 getConfiguration('freedomCode') 再传全键会被
 * 双重加前缀（freedomCode.freedomCode.x），静默退回默认值。
 * @param {vscode.WorkspaceConfiguration} root
 * @param {import('vscode').WorkspaceFolder | undefined} workspaceFolder
 */
function compileOptions(root, workspaceFolder) {
  return {
    includePaths: root.get('freedomCode.scssIncludePaths', []),
    ignoreUnderscoreFiles: root.get('freedomCode.scssIgnoreUnderscoreFiles', true),
    outputCompact: root.get('freedomCode.scssOutputCompact', true),
    preserveComments: root.get('freedomCode.scssPreserveComments', false),
    removeCharset: root.get('freedomCode.scssRemoveCharset', true),
    outputPath: root.get('freedomCode.scssOutputPath', ''),
    outputPathFormat: root.get('freedomCode.scssOutputPathFormat', 'same'),
    outputExtension: root.get('freedomCode.scssOutputExtension', '.css'),
    workspacePath: workspaceFolder ? workspaceFolder.uri.fsPath : null,
  };
}

/**
 * @param {vscode.ExtensionContext} context
 * @param {{ logger: object }} deps
 */
function register(context, deps) {
  const { logger } = deps;

  // 编译 SCSS/SASS 命令
  registerCommand(context, 'extension.compileScss', async () => {
    logger.debug('编译 SCSS 命令被触发');

    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('没有活动的编辑器');
        return;
      }

      const languageId = editor.document.languageId;
      logger.debug(`编译语言: ${languageId}`);

      const cfg = vscode.workspace.getConfiguration();
      const compiler = new SCSSCompiler();
      compiler.setLogger(logger);
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
      compiler.compile(editor.document.uri.fsPath, compileOptions(cfg, workspaceFolder));

      vscode.window.showInformationMessage(`${languageId} 文件编译完成`);
      logger.debug(`${languageId} 文件编译完成`);
    } catch (error) {
      vscode.window.showErrorMessage(`编译失败: ${error.message}`);
      logger.error('编译失败', error);
    }
  });

  // 保存后自动编译 SCSS/SASS（默认关闭，需显式开启）
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((event) => {
      try {
        const doc = event.document || vscode.window.activeTextEditor?.document;

        if (!doc) {
          logger.debug('没有可用的文档对象，跳过编译');
          return;
        }

        const cfg = vscode.workspace.getConfiguration();
        const languageId = doc.languageId;
        logger.debug(`保存后事件触发: ${languageId}`);

        // 根配置 + 全键：readSetting 内部用 inspect，误用 scoped 配置会双重加前缀
        const autoCompile = readSetting(
          cfg,
          ['freedomCode.scssAutoCompile', 'freedomCode.scss-compact-autoCompile'],
          false
        );

        if ((languageId === 'scss' || languageId === 'sass') && autoCompile) {
          logger.debug(`触发保存后编译: ${languageId}`);
          const compiler = new SCSSCompiler();
          compiler.setLogger(logger);
          const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
          compiler.compile(doc.uri.fsPath, compileOptions(cfg, workspaceFolder));
        }
      } catch (error) {
        logger.error('保存后编译错误', error);
      }
    })
  );
}

module.exports = { register };
