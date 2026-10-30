'use strict';

const vscode = require('vscode');

const { registerCommand } = require('./registry');
const cssStyle = require('../features/css-style');

/**
 * 命令面板里的格式化命令。全部转调编辑器自身的格式化动作 ——
 * 触发时机、撤销、多光标与进度提示都交给 VS Code，扩展不另建一套入口。
 */
const FORMAT_COMMANDS = [
  'extension.formatUnified',
  'extension.formatvue',
  'extension.formatwxml',
  'extension.formatwxss',
  'extension.formatscss',
  'extension.formatless',
  'extension.formatcss',
  'extension.formathtml',
  'extension.formatjavascript',
  'extension.formattypescript',
];

/**
 * @param {vscode.ExtensionContext} context
 */
function register(context) {
  // 重选 CSS 排版风格（normal / compact）
  registerCommand(context, cssStyle.COMMAND_ID, () => cssStyle.promptStyle(context));

  FORMAT_COMMANDS.forEach((command) => {
    registerCommand(context, command, () =>
      vscode.commands.executeCommand('editor.action.formatDocument')
    );
  });
}

module.exports = { register };
