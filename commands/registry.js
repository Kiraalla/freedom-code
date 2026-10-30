'use strict';

const vscode = require('vscode');

/**
 * 注册命令，并把 handler 的结果（含 Promise）返回给 VS Code。
 * 不 return 的话，异步命令的失败会变成 unhandled rejection，命令也无法被 await。
 * @param {vscode.ExtensionContext} context
 * @param {string} command
 * @param {(param?: any) => any} func
 */
function registerCommand(context, command, func) {
  const disposable = vscode.commands.registerCommand(command, (param) => func(param));
  context.subscriptions.push(disposable);
}

/**
 * 注册"在某个文件夹里创建东西"的命令。
 * 从命令面板调用时没有 resource 参数，直接 resource.fsPath 会抛 TypeError；
 * 这里退回工作区根目录，没有工作区时给出提示。
 * @param {vscode.ExtensionContext} context
 * @param {string} command
 * @param {(folder: vscode.Uri) => any} handler
 */
function registerFolderCommand(context, command, handler) {
  registerCommand(context, command, (resource) => {
    const folder = resource && resource.fsPath
      ? resource
      : (vscode.workspace.workspaceFolders || [])[0]?.uri;

    if (!folder) {
      vscode.window.showErrorMessage('请先打开一个文件夹，再创建模板文件');
      return;
    }

    return handler(folder);
  });
}

module.exports = {
  registerCommand,
  registerFolderCommand,
};
