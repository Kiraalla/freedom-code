'use strict';

const vscode = require('vscode');

const Logger = require('./util/logger');
const format_core = require('./wxml_plus/format_core');

const formatting = require('./providers/formatting');
const definitions = require('./providers/definitions');
const autoQuote = require('./features/auto-quote');
const highlight = require('./features/highlight');
const styleDrift = require('./features/style-drift');
const manifestCheck = require('./features/manifest-check');
const formatCommands = require('./commands/format');
const scssCommands = require('./commands/scss');
const miniappCommands = require('./commands/miniapp');
const templateCommands = require('./commands/templates');
const pugCommands = require('./commands/pug');
const styleCommands = require('./commands/style-settings');

// 旧设置"提示一次"的标记位（存在 globalState 里，不写用户的 settings.json）
const DEPRECATED_FORMAT_ON_SAVE_KEY = 'freedom-code.deprecation.formatOnSave';

/**
 * 激活扩展：这是唯一的组合根，只负责把这些模块接起来。
 * 具体能力都在 providers/ features/ commands/ 下，各自导出 register(context, deps)。
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const outputChannel = vscode.window.createOutputChannel('Freedom Code');
  context.subscriptions.push(outputChannel);

  const config = vscode.workspace.getConfiguration('freedomCode');
  const logger = new Logger(outputChannel, config.get('debugMode', false));
  logger.info('扩展已激活');

  const deps = { logger };

  // 设置变更：更新调试模式并清空格式化配置缓存
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration('freedomCode')) {
        return;
      }

      const debugMode = vscode.workspace.getConfiguration('freedomCode').get('debugMode', false);
      logger.setDebugMode(debugMode);
      format_core.ConfigManager.clearCache();
      logger.debug('freedomCode 配置已变化，缓存已清除');

      if (e.affectsConfiguration('freedomCode.debugMode')) {
        logger.info(`调试模式已${debugMode ? '启用' : '禁用'}`);
      }
    })
  );

  // 编辑器契约：保存时格式化归 editor.formatOnSave，缩进归 FormattingOptions
  formatting.register(context);
  autoQuote.register(context);

  // 命令面
  formatCommands.register(context);
  scssCommands.register(context, deps);
  miniappCommands.register(context, deps);
  templateCommands.register(context, deps);
  pugCommands.register(context, deps);
  styleCommands.register(context, deps);

  // 语法高亮与跳转/补全
  highlight.register(context, deps);
  definitions.register(context, deps);

  // 风格漂移提示（仅当工作区里确实有 wxml/vue 文件）
  styleDrift.register(context, deps);

  // 清单自检：代码与 VS Code 内存里的清单不一致时（升级后未重载）提示重载
  manifestCheck.checkManifestLoaded(context, deps);

  warnDeprecatedFormatOnSave(context);

  logger.info('所有功能已初始化完成');
}

/**
 * 停用扩展：所有监听器与 decoration 都挂在 context.subscriptions 上，
 * 由 VS Code 统一释放，这里无需额外动作。
 */
function deactivate() {}

/**
 * `freedomCode.formatOnSave` 已废弃：保存时格式化交给 editor.formatOnSave。
 * 只在用户确实配置过它时提示一次，并给一个直达设置的按钮；不代用户改写 settings.json。
 * @param {vscode.ExtensionContext} context
 */
async function warnDeprecatedFormatOnSave(context) {
  try {
    const inspected = vscode.workspace.getConfiguration('freedomCode').inspect('formatOnSave');
    const explicitlySet = inspected && [
      inspected.globalValue,
      inspected.workspaceValue,
      inspected.workspaceFolderValue,
    ].some((value) => value !== undefined);

    if (!explicitlySet || context.globalState.get(DEPRECATED_FORMAT_ON_SAVE_KEY)) {
      return;
    }

    await context.globalState.update(DEPRECATED_FORMAT_ON_SAVE_KEY, true);

    const openSettings = '去设置';
    const picked = await vscode.window.showInformationMessage(
      'freedomCode.formatOnSave 已废弃：保存时格式化现在由 VS Code 的 editor.formatOnSave 负责。',
      openSettings
    );

    if (picked === openSettings) {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'editor.formatOnSave');
    }
  } catch (error) {
    // 提示失败不应影响扩展激活
  }
}

module.exports = {
  activate,
  deactivate,
};
