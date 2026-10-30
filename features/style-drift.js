'use strict';

const vscode = require('vscode');

const { collectStyleChanges } = require('../util/style-settings-host');

/** 只提示一次的标记位（存在 globalState，不写用户配置） */
const NOTIFIED_KEY = 'freedom-code.notice.styleDrift';

/**
 * 编辑器缩进/空白设置与扩展的格式化配置不一致时，提示一次并给出同步入口。
 *
 * 刻意把 `editor.tabSize: 'auto'`（未显式设置）也算作漂移 ——
 * 那正是"编辑器自身配置未必合理"的典型情形。
 * 只在工作区里确实有 wxml/vue 文件时才检查，避免对无关项目打扰。
 *
 * @param {vscode.ExtensionContext} context
 * @param {{ logger: object }} deps
 */
async function checkStyleDrift(context, deps) {
  const { logger } = deps;

  try {
    if (context.globalState.get(NOTIFIED_KEY)) {
      return;
    }

    const sample = await vscode.workspace.findFiles('**/*.{wxml,vue}', '**/node_modules/**', 1);
    if (!sample || sample.length === 0) {
      return;
    }

    // 多根工作区：任一份文件夹有差异就提示
    const { totalChanges } = collectStyleChanges();
    if (totalChanges === 0) {
      return;
    }

    await context.globalState.update(NOTIFIED_KEY, true);

    const sync = '去同步';
    const picked = await vscode.window.showInformationMessage(
      `编辑器设置与扩展的格式化风格有 ${totalChanges} 项不一致，可一键写入工作区设置。`,
      sync
    );

    if (picked === sync) {
      await vscode.commands.executeCommand('extension.syncEditorStyleSettings');
    }
  } catch (error) {
    logger.debug(`风格漂移检查失败: ${error.message}`);
  }
}

/**
 * @param {vscode.ExtensionContext} context
 * @param {{ logger: object }} deps
 */
function register(context, deps) {
  checkStyleDrift(context, deps);
}

module.exports = { register };
