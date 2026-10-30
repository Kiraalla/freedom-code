'use strict';

/**
 * 纯函数格式化管线：不 import vscode，因此可在 `node --test` 下直接单测。
 *
 * 设计要点（见 specs/formatting.md）：格式规则必须知道自己作用于哪个区域。
 * 标记区域（Vue 的 <template>、WXML 全文）才有 mustache/花括号空格规则；
 * <script>/<style> 完全交给 Prettier。
 *
 * 本文件在 B1/B3 修复中落地；此处先按用例约定导出契约。
 */

/**
 * 找出「标记区域」（可应用 mustache 空格规则的区间）。
 * @param {string} text
 * @param {string} fileType 'vue' | 'wxml' | 其他
 * @returns {Array<[number, number]>} 半开区间 [start, end)
 */
function findMarkupRanges(text, fileType) {
  if (fileType === 'wxml') {
    return text.length ? [[0, text.length]] : [];
  }
  if (fileType !== 'vue') {
    return [];
  }
  return findBlockContentRanges(text, 'template');
}

/**
 * 找出指定标签的块内容区间（顶层与嵌套都算）。
 * @param {string} text
 * @param {string} tagName
 * @returns {Array<[number, number]>}
 */
function findBlockContentRanges(text, tagName) {
  return scanBlocks(text, [tagName]).map((block) => [
    block.contentStart,
    block.contentEnd,
  ]);
}

/**
 * 把指定标签的整块（含起止标签）替换为哨兵注释，返回可安全交给 Prettier 的文本。
 * 用于 WXML 的 <template> / <wxs>：内容一字不改。
 * @param {string} text
 * @param {string[]} tagNames
 * @returns {{ code: string, blocks: Array<{ sentinel: string, original: string }> }}
 */
function protectVerbatimBlocks(text, tagNames) {
  const blocks = scanBlocks(text, tagNames).filter((block) => !block.selfClosing);
  const records = [];
  let code = '';
  let cursor = 0;

  blocks.forEach((block, index) => {
    const sentinel = `${BLOCK_SENTINEL_PREFIX}${index}__-->`;
    records.push({ sentinel, original: text.slice(block.start, block.end) });
    code += text.slice(cursor, block.start) + sentinel;
    cursor = block.end;
  });

  return { code: code + text.slice(cursor), blocks: records };
}

/**
 * @param {string} code
 * @param {Array<{ sentinel: string, original: string }>} blocks
 * @returns {string}
 */
function restoreVerbatimBlocks(code, blocks) {
  let restored = code;
  for (const { sentinel, original } of blocks) {
    restored = restored.split(sentinel).join(original);
  }
  return restored;
}

/**
 * 只在给定区间内规范化 mustache / 花括号空格。
 * @param {string} text
 * @param {{ spacing: string, ranges: Array<[number, number]>, singleBraces?: boolean }} options
 * @returns {string}
 */
function applyMustacheSpacing(text, { spacing, ranges, singleBraces = true }) {
  if (spacing === 'preserve' || !ranges || ranges.length === 0) {
    return text;
  }

  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  let result = '';
  let cursor = 0;

  for (const [start, end] of sorted) {
    if (start < cursor) continue;
    result += text.slice(cursor, start);
    result += transformBraces(text.slice(start, end), spacing, singleBraces);
    cursor = end;
  }

  return result + text.slice(cursor);
}

/**
 * @param {string} chunk
 * @param {string} spacing 'space' | 'nospace'
 * @param {boolean} singleBraces
 * @returns {string}
 */
function transformBraces(chunk, spacing, singleBraces) {
  let processed = chunk.replace(/{{\s*([^{}]*?)\s*}}/g, (match, inner) => {
    const trimmed = inner.trim();
    if (spacing === 'nospace' || trimmed.startsWith('...')) {
      return `{{${trimmed}}}`;
    }
    return `{{ ${trimmed} }}`;
  });

  if (singleBraces) {
    processed = processed.replace(/\{\s*([^{}]*?)\s*\}/g, (match, inner) => {
      const trimmed = inner.trim();
      if (spacing === 'nospace' || trimmed.startsWith('...')) {
        return `{${trimmed}}`;
      }
      return `{ ${trimmed} }`;
    });
  }

  return processed;
}

const BLOCK_SENTINEL_PREFIX = '<!--freedom-block:';

/**
 * 注释占位前缀，与模板块哨兵区分开。
 */
const COMMENT_SENTINEL_PREFIX = '<!--__COMMENT_PLACEHOLDER_';

/**
 * 扫描标签块：感知 HTML 注释、标签内的引号、自闭合与同名嵌套。
 * @param {string} text
 * @param {string[]} tagNames
 * @returns {Array<{ start: number, end: number, contentStart: number, contentEnd: number, selfClosing: boolean }>}
 */
function scanBlocks(text, tagNames) {
  const wanted = new Set(tagNames.map((name) => name.toLowerCase()));
  const blocks = [];
  let index = 0;

  while (index < text.length) {
    const open = text.indexOf('<', index);
    if (open === -1) break;

    if (text.startsWith('<!--', open)) {
      const close = text.indexOf('-->', open + 4);
      index = close === -1 ? text.length : close + 3;
      continue;
    }

    const tag = readTag(text, open);
    if (!tag || !wanted.has(tag.name)) {
      index = open + 1;
      continue;
    }

    if (tag.selfClosing) {
      blocks.push({
        start: open,
        end: tag.end,
        contentStart: tag.end,
        contentEnd: tag.end,
        selfClosing: true,
      });
      index = tag.end;
      continue;
    }

    const close = findMatchingClose(text, tag.name, tag.end);
    blocks.push({
      start: open,
      end: close === -1 ? text.length : close.end,
      contentStart: tag.end,
      contentEnd: close === -1 ? text.length : close.start,
      selfClosing: false,
    });
    index = close === -1 ? text.length : close.end;
  }

  return blocks;
}

/**
 * 读取从 `start` 开始的起始标签。
 * @param {string} text
 * @param {number} start
 * @returns {{ name: string, end: number, selfClosing: boolean } | null}
 */
function readTag(text, start) {
  const match = /^<([a-zA-Z][\w:-]*)/.exec(text.slice(start));
  if (!match) return null;

  let cursor = start + match[0].length;
  let quote = '';

  while (cursor < text.length) {
    const char = text[cursor];
    if (quote) {
      if (char === quote) quote = '';
      cursor++;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      cursor++;
      continue;
    }
    if (char === '>') {
      const selfClosing = text[cursor - 1] === '/';
      return { name: match[1].toLowerCase(), end: cursor + 1, selfClosing };
    }
    cursor++;
  }

  return null;
}

/**
 * 从 `from` 开始找同名闭合标签，带深度计数以支持嵌套。
 * @param {string} text
 * @param {string} name
 * @param {number} from
 * @returns {{ start: number, end: number } | null}
 */
function findMatchingClose(text, name, from) {
  const openPattern = new RegExp(`<${name}(?=[\\s/>])`, 'gi');
  const closePattern = new RegExp(`</${name}\\s*>`, 'gi');
  let depth = 1;
  let cursor = from;

  while (cursor < text.length) {
    openPattern.lastIndex = cursor;
    closePattern.lastIndex = cursor;
    const nextOpen = openPattern.exec(text);
    const nextClose = closePattern.exec(text);

    if (!nextClose) return null;
    if (nextOpen && nextOpen.index < nextClose.index) {
      const tag = readTag(text, nextOpen.index);
      if (tag && !tag.selfClosing) depth++;
      cursor = tag ? tag.end : nextOpen.index + nextOpen[0].length;
      continue;
    }

    depth--;
    if (depth === 0) {
      return { start: nextClose.index, end: nextClose.index + nextClose[0].length };
    }
    cursor = nextClose.index + nextClose[0].length;
  }

  return null;
}

/**
 * 把 HTML 注释替为占位符，避免 Prettier 重排注释内容。
 * 模板块哨兵本身也是注释，必须排除，否则会被二次保护。
 * @param {string} code
 * @returns {{ code: string, comments: Array<{ placeholder: string, original: string }> }}
 */
function protectComments(code) {
  const comments = [];
  let index = 0;

  const htmlparser2 = require('htmlparser2');

  // decodeEntities: false —— 重建的 original 必须与源码逐字符一致，否则替换会静默失败
  const parser = new htmlparser2.Parser(
    {
      oncomment: (data) => {
        if (data.startsWith('freedom-block:')) return;
        const original = `<!--${data}-->`;
        const placeholder = `${COMMENT_SENTINEL_PREFIX}${index}__-->`;
        comments.push({ placeholder, original });
        index++;
      },
    },
    { decodeEntities: false },
  );

  parser.write(code);
  parser.end();

  let protectedCode = code;
  for (const { placeholder, original } of comments) {
    protectedCode = protectedCode.split(original).join(placeholder);
  }

  return { code: protectedCode, comments };
}

/**
 * @param {string} code
 * @param {Array<{ placeholder: string, original: string }>} comments
 * @returns {string}
 */
function restoreComments(code, comments) {
  let restored = code;
  for (const { placeholder, original } of comments) {
    restored = restored.split(placeholder).join(original);
  }
  return restored;
}

/**
 * 压缩内部含换行的 text 标签（既有行为，保持原样）。
 * @param {string} code
 * @returns {string}
 */
function compressTextTags(code) {
  return code.replace(/<text(\s[^>]*)?>([\s\S]*?)<\/text>/gi, (match, attrs, content) => {
    if (!/[\r\n]/.test(content)) {
      return match;
    }
    const compressedContent = content.replace(/\s+/g, ' ').trim();
    return attrs
      ? `<text${attrs}>${compressedContent}</text>`
      : `<text>${compressedContent}</text>`;
  });
}

module.exports = {
  findMarkupRanges,
  protectVerbatimBlocks,
  restoreVerbatimBlocks,
  applyMustacheSpacing,
  protectComments,
  restoreComments,
  compressTextTags,
};
