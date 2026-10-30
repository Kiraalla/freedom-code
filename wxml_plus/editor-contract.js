'use strict';

/**
 * 编辑器契约层：不 import vscode。
 *
 * 这里只回答两个问题：
 *   1. 用户在某个位置键入 `=` 时，该不该补 `""`、补在哪里（decideQuoteInsertion）。
 *   2. 编辑器给的缩进选项如何覆盖 Prettier 配置（applyEditorFormattingOptions）。
 *
 * 把这两件事放在纯函数层，是因为它们全是"判断"，一旦埋在 extension.js 里
 * 就只能靠真机手测（见 test/unit/README.md）。
 */

/** 属性名允许出现的字符：覆盖 v-model / :src / @tap / [prop] 等写法 */
const ATTRIBUTE_NAME_CHAR = /[A-Za-z0-9_:@\-.[\]]/;

/** 属性名为空但合法的开头字符（`<view =` 不应补引号，需要名字） */
const TAG_NAME_CHAR = /[A-Za-z/]/;

/**
 * 判断键入 `=` 后是否应该补一对引号。
 * @param {string} lineText 当前行文本（`=` 已写入）
 * @param {number} column 光标列，即紧跟在 `=` 之后的列（0 基）
 * @returns {{ insertAt: number, cursorOffset: number } | null}
 */
function decideQuoteInsertion(lineText, column) {
  if (typeof lineText !== 'string' || column <= 0 || column > lineText.length) {
    return null;
  }

  const equalIndex = column - 1;

  if (lineText[equalIndex] !== '=') {
    return null;
  }

  // `a = 1`：等号前是空格，不是属性名
  const nameChar = lineText[equalIndex - 1];
  if (!nameChar || !ATTRIBUTE_NAME_CHAR.test(nameChar)) {
    return null;
  }

  // `==` / `===`：等号后面还是等号
  if (lineText[column] === '=') {
    return null;
  }

  // 位于成对引号内部（例如已经在 `"..."` 里写表达式）
  if (isInsideQuotes(lineText, equalIndex)) {
    return null;
  }

  // 等号后面已经有引号（含空白后的引号）
  if (/^\s*["']/.test(lineText.slice(column))) {
    return null;
  }

  // 必须位于一个未闭合的起始标签内：排除 script/style 正文、文本内容与 JS 赋值
  if (!isInsideStartTag(lineText, equalIndex)) {
    return null;
  }

  return { insertAt: column, cursorOffset: 1 };
}

/**
 * @param {string} lineText
 * @param {number} index
 * @returns {boolean}
 */
function isInsideQuotes(lineText, index) {
  let double = 0;
  let single = 0;

  for (let i = 0; i < index; i++) {
    if (lineText[i] === '"') double++;
    else if (lineText[i] === "'") single++;
  }

  return double % 2 !== 0 || single % 2 !== 0;
}

/**
 * 从 index 向前找最后一个未被引号包裹的 `>`，其后必须出现 `<` + 标签名字符，
 * 且中间没有 `>` —— 即当前位于 `<view ... |` 这样的起始标签内部。
 * @param {string} lineText
 * @param {number} index
 * @returns {boolean}
 */
function isInsideStartTag(lineText, index) {
  let lastTagEnd = -1;
  let quote = '';

  for (let i = 0; i < index; i++) {
    const char = lineText[i];
    if (quote) {
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') lastTagEnd = i;
  }

  const segment = lineText.slice(lastTagEnd + 1, index);
  const open = segment.lastIndexOf('<');

  if (open < 0) {
    return false;
  }

  const afterOpen = segment[open + 1];
  return Boolean(afterOpen) && TAG_NAME_CHAR.test(afterOpen);
}

/**
 * 用编辑器的 FormattingOptions 覆盖 Prettier 配置：编辑器优先。
 * @param {object} prettierOptions
 * @param {{ tabSize?: number, insertSpaces?: boolean } | undefined} formattingOptions
 * @returns {object} 新对象，不修改入参
 */
/**
 * 用编辑器的 FormattingOptions 填补 Prettier 配置，优先级：
 *   **用户显式配置 > 编辑器 options > 扩展默认值**
 *
 * `explicit` 告诉本函数哪些键是用户在 `prettierOptions` / `overrides` 里显式写的：
 * 显式写了就尊重用户（否则“设了 tabWidth: 4 却不生效”）；没写才跟随编辑器缩进。
 *
 * @param {object} prettierOptions
 * @param {{ tabSize?: number, insertSpaces?: boolean } | undefined} formattingOptions
 * @param {{ tabWidth?: boolean, useTabs?: boolean }} [explicit]
 * @returns {object} 新对象，不修改入参
 */
function applyEditorFormattingOptions(prettierOptions, formattingOptions, explicit = {}) {
  const merged = { ...prettierOptions };

  if (!formattingOptions) {
    return merged;
  }

  if (
    !explicit.tabWidth &&
    typeof formattingOptions.tabSize === 'number' &&
    formattingOptions.tabSize > 0
  ) {
    merged.tabWidth = formattingOptions.tabSize;
  }

  if (!explicit.useTabs && typeof formattingOptions.insertSpaces === 'boolean') {
    merged.useTabs = !formattingOptions.insertSpaces;
  }

  return merged;
}

/**
 * 补引号后重新计算光标列：光标应落在自己那对引号中间，
 * 同时要避开同一行、光标之前发生的其他插入（多光标同行的情形）。
 * @param {number} line 光标所在行
 * @param {number} character 光标列（紧跟在 `=` 之后）
 * @param {Array<{ line: number, character: number }>} insertions 本次要插入的位置
 * @returns {number} 新的列
 */
function mapCursorAfterInsertions(line, character, insertions) {
  let shift = 0;
  let atInsertion = false;

  for (const insertion of insertions) {
    if (insertion.line !== line) continue;
    if (insertion.character < character) {
      shift += 2;
    } else if (insertion.character === character) {
      atInsertion = true;
    }
  }

  return character + shift + (atInsertion ? 1 : 0);
}

module.exports = {
  decideQuoteInsertion,
  applyEditorFormattingOptions,
  mapCursorAfterInsertions,
};
