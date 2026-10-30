'use strict';

const vscode = require('vscode');

const { collectStyleChanges, applyStyleChanges, formatValue } = require('../util/style-settings-host');
const { registerCommand } = require('./registry');

const COMMAND_ID = 'extension.syncEditorStyleSettings';

/**
 * 把 `freedomCode.prettierOptions` 的风格写进编辑器设置。
 * 写之前列出差异，用户确认后才落盘；已一致的项不出现。
 * 多根工作区下每个文件夹各写一份，条目会标注所属文件夹。
 * @param {object} logger
 */
async function syncStyleSettings(logger) {
  const { groups, totalChanges } = collectStyleChanges();

  if (totalChanges === 0) {
    vscode.window.showInformationMessage('编辑器设置已与扩展的格式化配置一致，无需写入。');
    return;
  }

  const multiRoot = groups.filter((group) => group.folder).length > 1;
  const items = [];

  for (const group of groups) {
    const folderName = group.folder ? group.folder.name : '工作区';
    for (const change of group.changes) {
      items.push({
        label: change.key,
        description: `${formatValue(change.current)} → ${formatValue(change.next)}`,
        detail: buildDetail(change, folderName, multiRoot),
        group,
        change,
      });
    }
  }

  const picked = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    title: '将写入编辑器设置的项',
    placeHolder: '取消勾选可跳过某项；Esc 放弃写入',
  });

  if (!picked || picked.length === 0) {
    return;
  }

  try {
    const byGroup = new Map();
    for (const item of picked) {
      if (!byGroup.has(item.group)) byGroup.set(item.group, []);
      byGroup.get(item.group).push(item.change);
    }

    for (const [group, changes] of byGroup) {
      await applyStyleChanges(group.folder, changes, { multiRoot });
    }

    const skipped = totalChanges - picked.length;
    vscode.window.showInformationMessage(
      skipped > 0
        ? `已写入 ${picked.length} 项编辑器设置，跳过 ${skipped} 项。`
        : `已写入 ${picked.length} 项编辑器设置。`,
    );
    logger.info(`风格同步：写入 ${picked.length} 项，跳过 ${skipped} 项`);
  } catch (error) {
    vscode.window.showErrorMessage(`写入编辑器设置失败: ${error.message}`);
    logger.error('写入编辑器设置失败', error);
  }
}

/**
 * @param {{ scope: 'global'|'language', language?: string }} change
 * @param {string} folderName
 * @param {boolean} multiRoot
 * @returns {string}
 */
function buildDetail(change, folderName, multiRoot) {
  const scope = change.scope === 'global' ? '全局' : `[${change.language}]`;
  return multiRoot ? `${folderName} · ${scope}` : scope;
}

/**
 * @param {vscode.ExtensionContext} context
 * @param {{ logger: object }} deps
 */
function register(context, deps) {
  const { logger } = deps;
  registerCommand(context, COMMAND_ID, () => syncStyleSettings(logger));
}

module.exports = { register };
