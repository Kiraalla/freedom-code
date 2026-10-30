'use strict';

/**
 * CSS 文本格式化（纯函数，不依赖 vscode）。
 *
 * 提供 CSS 的两种排版：
 *   - compact：一条规则一行，属性之间用空格分隔（`.a{ color:red; margin:0; }`）
 *   - expanded：每条属性一行
 *
 * 与旧实现的区别：**块结构是递归解析的**。旧版用 `{([^}]+)}` 正则，遇到
 * `@media` / `@supports` / `@keyframes` 这类容器块会把内层规则压平并错位换行。
 */

const COMMENT_SENTINEL = '__COMMENT_';
const STRING_SENTINEL = '__FC_STR_';
const BACKSLASH = String.fromCharCode(92);

/** 默认缩进单位（与历史 SCSS 编译产物保持一致） */
const DEFAULT_INDENT = '    ';

/**
 * 把字符串字面量换成占位符：后续的花括号扫描不是字符串感知的，
 * `content: "}"`、SVG data URI 里的 `{}` 会被当成块边界。
 * @param {string} css
 * @returns {{ css: string, strings: Array<{ placeholder: string, original: string }> }}
 */
function protectStrings(css) {
  const strings = [];
  let result = '';
  let index = 0;

  while (index < css.length) {
    const ch = css[index];

    if (ch !== '"' && ch !== "'") {
      result += ch;
      index++;
      continue;
    }

    let cursor = index + 1;
    while (cursor < css.length) {
      if (css[cursor] === BACKSLASH) { cursor += 2; continue; }
      if (css[cursor] === ch) break;
      cursor++;
    }

    const original = css.slice(index, cursor + 1);
    const placeholder = `${STRING_SENTINEL}${strings.length}__`;
    strings.push({ placeholder, original });
    result += placeholder;
    index = cursor + 1;
  }

  return { css: result, strings };
}

/**
 * @param {string} css
 * @param {Array<{ placeholder: string, original: string }>} strings
 * @returns {string}
 */
function restoreStrings(css, strings) {
  let restored = css;
  for (const { placeholder, original } of strings) {
    restored = restored.split(placeholder).join(original);
  }
  return restored;
}

/**
 * 抽出顶层注释（用占位符代替），块内注释保留原位。
 * @param {string} css
 * @param {boolean} preserveComments
 * @returns {{ css: string, comments: string[] }}
 */
function extractCommentsOutsideBlocks(css, preserveComments) {
  const comments = [];
  if (!preserveComments) {
    return { css: css.replace(/\/\*[\s\S]*?\*\//g, ''), comments };
  }

  let out = '';
  let i = 0;
  let depth = 0;
  let inString = false;
  let stringChar = '';

  while (i < css.length) {
    const ch = css[i];

    if (!inString && (ch === '"' || ch === "'")) {
      inString = true;
      stringChar = ch;
      out += ch;
      i++;
      continue;
    }

    if (inString) {
      out += ch;
      if (ch === BACKSLASH && i + 1 < css.length) {
        out += css[i + 1];
        i += 2;
        continue;
      }
      if (ch === stringChar) {
        inString = false;
        stringChar = '';
      }
      i++;
      continue;
    }

    if (ch === '/' && css[i + 1] === '*') {
      const start = i;
      const endIdx = css.indexOf('*/', i + 2);
      const end = endIdx === -1 ? css.length - 2 : endIdx + 1;
      const comment = css.slice(start, end + 1);

      if (depth === 0) {
        comments.push(comment);
        out += `${COMMENT_SENTINEL}${comments.length - 1}__`;
      } else {
        out += comment;
        let nextIdx = end + 1;
        while (nextIdx < css.length && /\s/.test(css[nextIdx])) nextIdx++;
        if (nextIdx > end + 1) {
          out += ' ';
          i = nextIdx;
          continue;
        }
      }
      i = end + 1;
      continue;
    }

    if (ch === '{') depth++;
    else if (ch === '}') depth = Math.max(0, depth - 1);

    out += ch;
    i++;
  }

  return { css: out, comments };
}

/**
 * 把块体拆成「声明」与「注释」两类 token。
 * @param {string} properties
 * @returns {Array<{ type: 'prop'|'comment', text: string }>}
 */
function parsePropertiesWithComments(properties) {
  const tokens = [];
  let i = 0;

  while (i < properties.length) {
    while (i < properties.length && /\s/.test(properties[i])) i++;
    if (i >= properties.length) break;

    if (properties.startsWith('/*', i)) {
      const endIdx = properties.indexOf('*/', i + 2);
      const end = endIdx === -1 ? properties.length : endIdx + 2;
      const comment = properties.slice(i, end);

      i = end;
      while (i < properties.length && /\s/.test(properties[i])) i++;

      if (i < properties.length && !properties.startsWith('/*', i)) {
        const semicolon = properties.indexOf(';', i);
        if (semicolon !== -1) {
          const chunk = properties.slice(i, semicolon).trim();
          if (chunk) {
            tokens.push({ type: 'comment', text: comment });
            tokens.push({ type: 'prop', text: chunk });
          }
          i = semicolon + 1;
          continue;
        }
      }

      let lastPropIdx = -1;
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].type === 'prop') { lastPropIdx = j; break; }
      }
      if (lastPropIdx !== -1) tokens.splice(lastPropIdx, 0, { type: 'comment', text: comment });
      else tokens.push({ type: 'comment', text: comment });

      continue;
    }

    const semicolon = properties.indexOf(';', i);
    if (semicolon === -1) {
      const chunk = properties.slice(i).trim();
      if (chunk) tokens.push({ type: 'prop', text: chunk });
      break;
    }
    const chunk = properties.slice(i, semicolon).trim();
    if (chunk) tokens.push({ type: 'prop', text: chunk });
    i = semicolon + 1;
  }

  return tokens;
}

/**
 * 在**已归一化空白**的 CSS 上按顶层花括号切块。
 * @param {string} css
 * @returns {Array<{ prelude: string, body: string } | { raw: string }>}
 */
function splitBlocks(css) {
  const blocks = [];
  let index = 0;
  let preludeStart = 0;

  while (index < css.length) {
    if (css[index] !== '{') {
      index++;
      continue;
    }

    let depth = 0;
    let cursor = index;
    for (; cursor < css.length; cursor++) {
      if (css[cursor] === '{') depth++;
      else if (css[cursor] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }

    blocks.push({
      prelude: css.slice(preludeStart, index).trim(),
      body: css.slice(index + 1, cursor),
    });
    index = cursor + 1;
    preludeStart = index;
  }

  const tail = css.slice(preludeStart).trim();
  if (tail) blocks.push({ raw: tail });

  return blocks;
}

/**
 * @param {Array} blocks
 * @param {{ compact: boolean, indentUnit: string, eol: string }} options
 * @param {number} level
 * @returns {string}
 */
function renderBlocks(blocks, options, level) {
  const rendered = [];
  for (const block of blocks) {
    const output = renderBlock(block, options, level);
    if (output) rendered.push(output);
  }
  return rendered.join(options.eol);
}

/**
 * @param {object} block
 * @param {{ compact: boolean, indentUnit: string, eol: string }} options
 * @param {number} level
 * @returns {string}
 */
function renderBlock(block, options, level) {
  const pad = options.indentUnit.repeat(level);

  if (block.raw !== undefined) {
    return pad + block.raw;
  }

  const children = splitBlocks(block.body);
  const hasNestedBlock = children.some((child) => child.raw === undefined);

  if (hasNestedBlock) {
    const inner = renderBlocks(children, options, level + 1);
    if (!inner) return `${pad}${block.prelude}{}`;
    return `${pad}${block.prelude}{${options.eol}${inner}${options.eol}${pad}}`;
  }

  const tokens = parsePropertiesWithComments(block.body);

  if (options.compact) {
    if (tokens.length === 0) return `${pad}${block.prelude}{}`;
    const parts = tokens.map((token) => (token.type === 'prop' ? `${token.text};` : token.text));
    return `${pad}${block.prelude}{ ${parts.join(' ')} }`;
  }

  if (tokens.length === 0) return `${pad}${block.prelude}{}`;

  const innerPad = options.indentUnit.repeat(level + 1);
  const lines = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'comment') {
      const next = tokens[i + 1];
      if (next && next.type === 'prop') {
        lines.push(`${innerPad}${token.text}  ${next.text};`);
        i++;
      } else {
        lines.push(`${innerPad}${token.text}`);
      }
    } else {
      lines.push(`${innerPad}${token.text};`);
    }
  }

  return `${pad}${block.prelude}{${options.eol}${lines.join(options.eol)}${options.eol}${pad}}`;
}

/**
 * @param {string} css
 * @param {{ preserveComments?: boolean, indentUnit?: string }} [options]
 * @returns {string}
 */
function formatCompact(css, options = {}) {
  return format(css, { ...options, compact: true });
}

/**
 * @param {string} css
 * @param {{ preserveComments?: boolean, indentUnit?: string }} [options]
 * @returns {string}
 */
function formatExpanded(css, options = {}) {
  return format(css, { ...options, compact: false });
}

/**
 * @param {string} css
 * @param {{ compact: boolean, preserveComments?: boolean, indentUnit?: string }} options
 * @returns {string}
 */
function format(css, options) {
  const preserveComments = Boolean(options.preserveComments);
  const indentUnit = options.indentUnit || DEFAULT_INDENT;

  const protectedStrings = protectStrings(String(css));
  const extracted = extractCommentsOutsideBlocks(protectedStrings.css, preserveComments);

  // 归一化空白：换行/制表符去掉，`{}:;,` 两侧不留空格
  let normalized = extracted.css
    .replace(/[\n\r\t]+/g, '')
    .replace(/\s*([{}:;,])\s*/g, '$1');

  const blocks = splitBlocks(normalized);
  let output = renderBlocks(blocks, { compact: options.compact, indentUnit, eol: '\n' }, 0);

  if (preserveComments && extracted.comments.length > 0) {
    output = output.replace(/__COMMENT_(\d+)__/g, (_match, index) => {
      return `\n${extracted.comments[Number(index)]}\n`;
    });
    output = output.replace(/\n{3,}/g, '\n\n');
  }

  return restoreStrings(output.trim(), protectedStrings.strings).trim();
}

module.exports = {
  formatCompact,
  formatExpanded,
  // 导出内部件便于单测与复用
  protectStrings,
  restoreStrings,
  extractCommentsOutsideBlocks,
  parsePropertiesWithComments,
  splitBlocks,
};
