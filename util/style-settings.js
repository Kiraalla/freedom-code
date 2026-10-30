'use strict';

/**
 * 把 `freedomCode.prettierOptions` 翻译成 VS Code 的编辑器设置（纯函数，不依赖 vscode）。
 *
 * 定位：扩展出"意图"，命令把它写进编辑器设置，运行时仍以编辑器值为准 ——
 * 但写完之后编辑器值就是扩展写的值，于是"手敲 Tab 的缩进"与"格式化后的缩进"才真正一致。
 */

/** Prettier `overrides.files` 的扩展名 → VS Code 语言 id */
const EXTENSION_TO_LANGUAGE = {
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  css: 'css',
  wxml: 'wxml',
  wxss: 'wxss',
  vue: 'vue',
  html: 'html',
  js: 'javascript',
  ts: 'typescript',
};

/**
 * 从 `*.ext` 形式的 pattern 取语言 id；其它 glob 形式（`**\/*.scss`、目录、`{a,b}`）
 * 目前不支持，返回 null（与 ConfigManager 的 overrides 匹配能力保持一致）。
 * @param {string} pattern
 * @returns {string|null}
 */
function languageFromPattern(pattern) {
  const match = /^\*\.([A-Za-z0-9]+)$/.exec(String(pattern || '').trim());
  if (!match) {
    return null;
  }
  return EXTENSION_TO_LANGUAGE[match[1].toLowerCase()] || null;
}

/**
 * 推导需要写入编辑器的设置。
 * @param {object} prettierOptions
 * @returns {{ global: Record<string, any>, languages: Record<string, Record<string, any>> }}
 */
function deriveEditorSettings(prettierOptions = {}) {
  const global = {};

  if (typeof prettierOptions.tabWidth === 'number') {
    global['editor.tabSize'] = prettierOptions.tabWidth;
  }
  if (typeof prettierOptions.useTabs === 'boolean') {
    global['editor.insertSpaces'] = !prettierOptions.useTabs;
  }

  // 让"手写结果"与"格式化结果"一致的三项：保存即格式化、末尾换行、不留行尾空白
  global['editor.formatOnSave'] = true;
  global['files.insertFinalNewline'] = true;
  global['files.trimTrailingWhitespace'] = true;

  const languages = {};

  for (const override of prettierOptions.overrides || []) {
    const options = (override && override.options) || {};
    const indentation = {};

    if (typeof options.tabWidth === 'number') {
      indentation['editor.tabSize'] = options.tabWidth;
    }
    if (typeof options.useTabs === 'boolean') {
      indentation['editor.insertSpaces'] = !options.useTabs;
    }

    // 语言级只写缩进；formatOnSave 与 files.* 是全局职责
    if (Object.keys(indentation).length === 0) {
      continue;
    }

    for (const pattern of (override && override.files) || []) {
      const language = languageFromPattern(pattern);
      if (!language) {
        continue;
      }
      languages[language] = { ...(languages[language] || {}), ...indentation };
    }
  }

  return { global, languages };
}

/**
 * 计算与当前编辑器设置的差异，只返回需要改的项。
 * @param {{ global: Record<string, any>, languages: Record<string, Record<string, any>> }} derived
 * @param {{ global?: Record<string, any>, languages?: Record<string, Record<string, any>> }} current
 * @returns {Array<{ scope: 'global'|'language', language?: string, key: string, current: any, next: any }>}
 */
function diffEditorSettings(derived, current = {}) {
  const changes = [];
  const currentGlobal = current.global || {};
  const currentLanguages = current.languages || {};

  for (const [key, next] of Object.entries(derived.global || {})) {
    if (isSame(currentGlobal[key], next)) {
      continue;
    }
    changes.push({ scope: 'global', key, current: currentGlobal[key], next });
  }

  for (const [language, settings] of Object.entries(derived.languages || {})) {
    for (const [key, next] of Object.entries(settings)) {
      const now = (currentLanguages[language] || {})[key];
      if (isSame(now, next)) {
        continue;
      }
      changes.push({ scope: 'language', language, key, current: now, next });
    }
  }

  return changes;
}

/**
 * `undefined` 与缺失视为相同；其余严格比较。
 * @param {any} left
 * @param {any} right
 * @returns {boolean}
 */
function isSame(left, right) {
  return left === right;
}

module.exports = {
  deriveEditorSettings,
  diffEditorSettings,
  languageFromPattern,
};
