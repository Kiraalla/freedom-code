'use strict';

const vscode = require('vscode');

/**
 * CSS 排版风格（normal / compact）的解析与记忆。
 *
 * 为什么不在格式化器里弹窗：`provideDocumentFormattingEdits` 无法区分"用户主动格式化"
 * 和"保存时格式化"，在编辑器里同步等待用户选择会卡住保存流程。因此改为
 * **不阻塞**：格式化按已解析出的模式执行（未决定时用 normal），随后弹一次
 * 一次性通知，点按钮再进选择。
 */

const COMMAND_ID = 'extension.pickCssFormatStyle';
const SETTING_KEY = 'freedomCode.cssFormatStyle';
/** globalState 里的记忆键（不写用户 settings.json） */
const MEMORY_KEY = 'freedom-code.cssFormatStyle';
/** 一次性提示的标记 */
const NOTICE_KEY = 'freedom-code.notice.cssFormatStyle';

const STYLES = {
  normal: { label: '标准换行', description: '每条属性一行（Prettier 默认）' },
  compact: { label: '单行紧凑', description: '一条规则一行，属性用空格分隔' },
};

/**
 * 解析当前生效的 CSS 排版风格。
 * 优先级：设置项显式值 > 记忆值 > 默认 normal。
 * @param {vscode.ExtensionContext} context
 * @returns {'normal'|'compact'}
 */
function resolveStyle(context) {
  const inspected = vscode.workspace.getConfiguration().inspect(SETTING_KEY);
  if (inspected) {
    const explicit = [
      inspected.workspaceFolderValue,
      inspected.workspaceValue,
      inspected.globalValue,
    ].find((value) => value !== undefined);
    if (explicit === 'compact' || explicit === 'normal') {
      return explicit;
    }
  }

  const remembered = context.globalState.get(MEMORY_KEY);
  return remembered === 'compact' ? 'compact' : 'normal';
}

/**
 * 用户是否已经做过选择（设置里显式指定，或记得过一次）。
 * @param {vscode.ExtensionContext} context
 * @returns {boolean}
 */
function isDecided(context) {
  const inspected = vscode.workspace.getConfiguration().inspect(SETTING_KEY);
  if (inspected) {
    const explicit = [
      inspected.workspaceFolderValue,
      inspected.workspaceValue,
      inspected.globalValue,
    ].find((value) => value !== undefined);
    if (explicit !== undefined) return true;
  }
  return context.globalState.get(MEMORY_KEY) !== undefined;
}

/**
 * 弹出二选一，选中后记住。
 * @param {vscode.ExtensionContext} context
 * @returns {Promise<'normal'|'compact'|undefined>}
 */
async function promptStyle(context) {
  const items = Object.entries(STYLES).map(([value, meta]) => ({
    label: meta.label,
    description: meta.description,
    value,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    title: 'CSS / WXSS 的排版风格',
    placeHolder: '标准换行：每条属性一行；单行紧凑：一条规则一行',
  });

  if (!picked) {
    return undefined;
  }

  await context.globalState.update(MEMORY_KEY, picked.value);
  vscode.window.showInformationMessage(
    `CSS / WXSS 已切换为「${picked.label}」，之后格式化按此模式执行。`,
  );
  return picked.value;
}

/**
 * 还没决定过风格时，提示一次（不阻塞、不打断保存流程）。
 * @param {vscode.ExtensionContext} context
 */
async function noticeOnceIfUndecided(context) {
  try {
    if (isDecided(context) || context.globalState.get(NOTICE_KEY)) {
      return;
    }

    await context.globalState.update(NOTICE_KEY, true);

    const pick = '选择模式';
    const picked = await vscode.window.showInformationMessage(
      'CSS / WXSS 目前使用「标准换行」排版。也可以改成「单行紧凑」（一条规则一行）。',
      pick,
    );

    if (picked === pick) {
      await promptStyle(context);
    }
  } catch (error) {
    // 提示失败不影响格式化
  }
}

module.exports = {
  COMMAND_ID,
  SETTING_KEY,
  MEMORY_KEY,
  NOTICE_KEY,
  STYLES,
  resolveStyle,
  isDecided,
  promptStyle,
  noticeOnceIfUndecided,
};
