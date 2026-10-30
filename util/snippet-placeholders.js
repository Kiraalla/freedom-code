'use strict';

/**
 * 代码块占位符方言修正（纯函数，不依赖 vscode）。
 *
 * 背景：`snippets/basic/jq.json` 里有 126 条把 `${selector}`、`${url}` 当占位符写。
 * VS Code 的规则是：`${name}` 只有在内置变量表里才展开，否则**原样插入名字**。
 * 于是用户插入代码块得到的是字面文本 `selector`，不是可编辑占位。
 */

/** VS Code 内置的片段变量（出现在 `${}` 里时不应当成"占位符方言"） */
const KNOWN_VARIABLES = new Set([
  'TM_SELECTED_TEXT',
  'TM_CURRENT_LINE',
  'TM_CURRENT_WORD',
  'TM_LINE_INDEX',
  'TM_LINE_NUMBER',
  'TM_FILENAME',
  'TM_FILENAME_BASE',
  'TM_DIRECTORY',
  'TM_FILEPATH',
  'RELATIVE_FILEPATH',
  'CLIPBOARD',
  'WORKSPACE_NAME',
  'WORKSPACE_FOLDER',
  'CURRENT_YEAR',
  'CURRENT_YEAR_SHORT',
  'CURRENT_MONTH',
  'CURRENT_MONTH_NAME',
  'CURRENT_MONTH_NAME_SHORT',
  'CURRENT_DATE',
  'CURRENT_DAY_NAME',
  'CURRENT_DAY_NAME_SHORT',
  'CURRENT_HOUR',
  'CURRENT_MINUTE',
  'CURRENT_SECOND',
  'CURRENT_SECONDS_UNIX',
  'RANDOM',
  'RANDOM_HEX',
  'UUID',
  'BLOCK_COMMENT_START',
  'BLOCK_COMMENT_END',
  'LINE_COMMENT',
]);

/** `${名字}`，且名字不是变量的情形 */
const NAMED_PLACEHOLDER = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/**
 * 找出 body 里"被当成占位符的变量名"。
 * @param {string} body
 * @returns {string[]} 按出现顺序、去重
 */
function findNamedPlaceholders(body) {
  const found = [];
  for (const match of String(body).matchAll(NAMED_PLACEHOLDER)) {
    if (!KNOWN_VARIABLES.has(match[1]) && !found.includes(match[1])) {
      found.push(match[1]);
    }
  }
  return found;
}

/**
 * 把 `${名字}` 改写成带编号的可编辑占位 `${N:名字}`。
 *
 * 编号规则：
 * - 先扫描 body 里已有的数字占位（`${1}`、`${1:...}`、`$1`、`${0}` 等），从最大编号 + 1 开始；
 * - `$0`（最终光标）不参与编号；
 * - 同名占位复用同一个编号（用户在多个位置输入会同步，这是 VS Code 的预期行为）；
 * - 内置变量保持不动。
 *
 * @param {string} body
 * @returns {string}
 */
function normalizeNamedPlaceholders(body) {
  const text = String(body);
  const named = findNamedPlaceholders(text);

  if (named.length === 0) {
    return text;
  }

  let next = maxTabstop(text) + 1;
  const numbering = new Map();

  for (const name of named) {
    numbering.set(name, next);
    next++;
  }

  return text.replace(NAMED_PLACEHOLDER, (match, name) => {
    if (KNOWN_VARIABLES.has(name)) {
      return match;
    }
    return `\${${numbering.get(name)}:${name}}`;
  });
}

/**
 * body 里已用的最大编号（`$0` 不参与，因为它表示最终光标）。
 * @param {string} text
 * @returns {number}
 */
function maxTabstop(text) {
  let max = 0;

  for (const match of text.matchAll(/\$\{(\d+)(?::[^}]*)?\}/g)) {
    const value = Number(match[1]);
    if (value > 0 && value > max) max = value;
  }

  for (const match of text.matchAll(/(^|[^$\\])\$(\d+)/g)) {
    const value = Number(match[2]);
    if (value > 0 && value > max) max = value;
  }

  return max;
}

/**
 * 是否存在未闭合的占位（字符串感知，忽略转义写法）。
 * @param {string} body
 * @returns {boolean}
 */
function hasUnclosedPlaceholder(body) {
  const text = String(body);
  const DOLLAR = String.fromCharCode(36);
  const OPEN = String.fromCharCode(123);
  const CLOSE = String.fromCharCode(125);
  const BACKSLASH = String.fromCharCode(92);

  for (let i = 0; i < text.length; i++) {
    if (text[i] !== DOLLAR || text[i + 1] !== OPEN) continue;

    let j = i + 2;
    let closed = false;
    while (j < text.length) {
      if (text[j] === BACKSLASH) { j += 2; continue; }
      if (text[j] === CLOSE) { closed = true; break; }
      j++;
    }

    if (!closed) return true;
    i = j;
  }

  return false;
}

module.exports = {
  normalizeNamedPlaceholders,
  findNamedPlaceholders,
  maxTabstop,
  hasUnclosedPlaceholder,
};
