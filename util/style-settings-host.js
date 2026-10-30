'use strict';

const vscode = require('vscode');

const { deriveEditorSettings, diffEditorSettings } = require('./style-settings');

/**
 * 编辑器设置的宿主层：读当前生效值、算差异、写入。
 * 纯计算部分在 style-settings.js，这里只碰 vscode API。
 *
 * 多根工作区：每个文件夹各读各的当前值、各写各的 `.vscode/settings.json`
 * （`ConfigurationTarget.WorkspaceFolder`）；单根或无文件夹时行为与之前一致。
 */

/** 语言级设置只涉及 editor.*，取配置时需要去掉段名 */
function shortKey(key) {
  return key.replace(/^editor\./, '');
}

/**
 * 需要处理的文件夹列表。空数组表示"没有打开文件夹"（单文件模式）。
 * @returns {import('vscode').WorkspaceFolder[]}
 */
function targetFolders() {
  return vscode.workspace.workspaceFolders ? Array.from(vscode.workspace.workspaceFolders) : [];
}

/**
 * @param {{ global: Record<string, any>, languages: Record<string, Record<string, any>> }} derived
 * @param {import('vscode').WorkspaceFolder} [folder]
 * @returns {{ global: Record<string, any>, languages: Record<string, Record<string, any>> }}
 */
function readCurrentSettings(derived, folder) {
  const scope = folder ? folder.uri : undefined;
  const current = { global: {}, languages: {} };

  for (const key of Object.keys(derived.global)) {
    current.global[key] = vscode.workspace.getConfiguration(undefined, scope).get(key);
  }

  for (const [language, settings] of Object.entries(derived.languages)) {
    const languageConfig = vscode.workspace.getConfiguration('editor', scope
      ? { uri: scope, languageId: language }
      : { languageId: language });
    current.languages[language] = {};
    for (const key of Object.keys(settings)) {
      current.languages[language][key] = languageConfig.get(shortKey(key));
    }
  }

  return current;
}

/**
 * 推导 + 差异。返回按文件夹分组的结果。
 * @returns {{
 *   derived: object,
 *   groups: Array<{ folder: import('vscode').WorkspaceFolder | undefined, changes: Array<object> }>,
 *   totalChanges: number,
 * }}
 */
function collectStyleChanges() {
  const prettierOptions = vscode.workspace
    .getConfiguration('freedomCode')
    .get('prettierOptions', {});
  const derived = deriveEditorSettings(prettierOptions);

  const folders = targetFolders();
  const targets = folders.length > 0 ? folders : [undefined];

  const groups = targets.map((folder) => ({
    folder,
    changes: diffEditorSettings(derived, readCurrentSettings(derived, folder)),
  }));

  return {
    derived,
    groups,
    totalChanges: groups.reduce((sum, group) => sum + group.changes.length, 0),
  };
}

/**
 * 写入。多根时按文件夹写（WorkspaceFolder），单根或无文件夹时写工作区层（Workspace）。
 * @param {import('vscode').WorkspaceFolder | undefined} folder
 * @param {Array<{ scope: 'global'|'language', language?: string, key: string, next: any }>} changes
 * @param {{ multiRoot?: boolean }} [options]
 */
async function applyStyleChanges(folder, changes, options = {}) {
  const target = folder && options.multiRoot
    ? vscode.ConfigurationTarget.WorkspaceFolder
    : vscode.ConfigurationTarget.Workspace;
  const scope = folder ? folder.uri : undefined;

  for (const change of changes) {
    if (change.scope === 'global') {
      await vscode.workspace
        .getConfiguration(undefined, scope)
        .update(change.key, change.next, target);
      continue;
    }

    const languageConfig = vscode.workspace.getConfiguration('editor', scope
      ? { uri: scope, languageId: change.language }
      : { languageId: change.language });

    await languageConfig.update(shortKey(change.key), change.next, target, true);
  }
}

/**
 * @param {any} value
 * @returns {string}
 */
function formatValue(value) {
  if (value === undefined) {
    return '(未设置)';
  }
  return JSON.stringify(value);
}

module.exports = {
  collectStyleChanges,
  applyStyleChanges,
  formatValue,
};
