"use strict";
const prettier = require("prettier");
const vscode = require("vscode");
const path = require("path");
const {
  findMarkupRanges,
  protectVerbatimBlocks,
  restoreVerbatimBlocks,
  applyMustacheSpacing,
  protectComments,
  restoreComments,
  compressTextTags,
} = require("./pipeline");
const { applyEditorFormattingOptions } = require("./editor-contract");
const { formatCompact } = require("../util/css_formatter");
const pugPlugin = require("@prettier/plugin-pug");

/** WXML 中必须整块原样保留的标签：Prettier 会把 <wxs> 里的 JS 当 HTML 文本重排 */
const WXML_VERBATIM_BLOCKS = ["template", "wxs"];

/**
 * 去掉 overrides：它由 ConfigManager 手动匹配，直接交给 Prettier 会报
 * "Invalid host defined options"。
 * @param {object} options
 * @returns {object} 新对象
 */
function withoutOverrides(options) {
  const rest = { ...options };
  delete rest.overrides;
  return rest;
}

/**
 * @typedef {Object} CommentMapping
 * @property {string} placeholder - 注释占位符
 * @property {string} original - 原始注释内容
 */

/**
 * Prettier 配置管理器
 */
class ConfigManager {
  constructor() {
    ConfigManager.cachedConfig = null;
  }

  /**
   * 获取指定文件类型 + 文件的合并 Prettier 配置。
   *
   * 缓存键必须包含文件路径：`overrides` 是按文件名匹配的，只按 fileType 缓存会让
   * 两个带不同 overrides 的同类型文件互相拿到对方的配置（曾实际发生过）。
   * 失效交给 extension.js 的“配置变更 → clearCache”，不再用 TTL 兜底。
   * @param {string} fileType - 文件类型 'vue' 或 'wxml'
   * @param {string} filePath - 文件路径（用于 overrides 匹配）
   * @returns {Promise<object>} 合并后的配置对象
   */
  static async getMergedPrettierConfig(fileType, filePath = null) {
    const cacheKey = `${fileType}::${filePath || ''}`;

    if (this.cachedConfig && cacheKey in this.cachedConfig) {
      return this.cachedConfig[cacheKey];
    }

    const config = vscode.workspace.getConfiguration('freedomCode');
    
    // 获取统一配置
    const unifiedOptions = config.get('prettierOptions', {});
    
    // 获取独立配置（已废弃，仅保留兼容性）
    const specificOptions = config.get(`${fileType}PrettierOptions`, {});
    
    // 合并配置：统一配置 <- 独立配置
    const mergedConfig = {
      ...unifiedOptions,
      ...specificOptions,
      parser: 'vue'
    };

    // overrides 由自己按文件名匹配（Prettier 直接吃 overrides 会报错）
    const resolvedConfig = filePath && mergedConfig.overrides
      ? ConfigManager.applyOverrides(filePath, mergedConfig)
      : mergedConfig;

    if (!this.cachedConfig) {
      this.cachedConfig = {};
    }
    this.cachedConfig[cacheKey] = resolvedConfig;

    return resolvedConfig;
  }
  
  /**
   * 根据文件路径应用 overrides 配置
   * @param {string} filePath - 文件路径
   * @param {object} config - 包含 overrides 的配置对象
   * @returns {object} 应用 overrides 后的配置
   */
  static applyOverrides(filePath, config) {
    const { overrides = [], ...baseConfig } = config;
    const fileName = path.basename(filePath).toLowerCase();
    
    let result = { ...baseConfig };
    
    for (const override of overrides) {
      const { files, options } = override;
      
      // 检查文件是否匹配 override 的模式
      const matches = ConfigManager.matchesPattern(fileName, files);
      
      if (matches) {
        result = { ...result, ...options };
      }
    }
    
    return result;
  }
  
  /**
   * 检查文件名是否匹配 patterns
   * @param {string} fileName - 文件名
   * @param {string[]} patterns - 匹配模式数组
   * @returns {boolean} 是否匹配
   */
  static matchesPattern(fileName, patterns) {
    if (!patterns || !Array.isArray(patterns)) {
      return false;
    }
    
    for (const pattern of patterns) {
      // 处理 *.ext 模式
      if (pattern.startsWith('*.')) {
        const ext = pattern.slice(1).toLowerCase();
        if (fileName.endsWith(ext)) {
          return true;
        }
      }
      // 处理精确匹配
      else if (pattern.toLowerCase() === fileName) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 获取 mustache 空格配置
   * @returns {Promise<string>} 空格模式：'space' | 'preserve' | 'nospace'
   */
  static async getMustacheSpacingConfig() {
    const config = vscode.workspace.getConfiguration('freedomCode');
    const mustacheSpacing = config.get('mustacheSpacing', 'space');
    return mustacheSpacing;
  }

  /**
   * 用户在 `prettierOptions`（含 `overrides`、兼容的 `${fileType}PrettierOptions`）里
   * 是否**显式**写了缩进。没写时才允许编辑器的 `FormattingOptions` 接管。
   *
   * 不能用 `get()` 判断：`prettierOptions` 在 package.json 里有默认值，`get()` 永远有值。
   * @param {string} fileType
   * @param {string|null} filePath
   * @returns {{ tabWidth: boolean, useTabs: boolean }}
   */
  static getExplicitIndentSetting(fileType, filePath = null) {
    // 注意：readSetting 使用的是根配置 + 全键，这里 inspect 也必须走根配置
    const root = vscode.workspace.getConfiguration();
    const userOptions = ConfigManager.explicitObject(root, 'freedomCode.prettierOptions');

    const result = {
      tabWidth: Object.prototype.hasOwnProperty.call(userOptions, 'tabWidth'),
      useTabs: Object.prototype.hasOwnProperty.call(userOptions, 'useTabs'),
    };

    const fileName = filePath ? path.basename(filePath) : '';
    for (const override of userOptions.overrides || []) {
      if (!override || !ConfigManager.matchesPattern(fileName, override.files)) continue;
      const options = override.options || {};
      if (typeof options.tabWidth === 'number') result.tabWidth = true;
      if (typeof options.useTabs === 'boolean') result.useTabs = true;
    }

    const legacy = ConfigManager.explicitObject(root, `freedomCode.${fileType}PrettierOptions`);
    if (Object.prototype.hasOwnProperty.call(legacy, 'tabWidth')) result.tabWidth = true;
    if (Object.prototype.hasOwnProperty.call(legacy, 'useTabs')) result.useTabs = true;

    return result;
  }

  /**
   * 取用户显式设置的对象值（工作区文件夹 > 工作区 > 用户），忽略 package.json 默认值。
   * @param {vscode.WorkspaceConfiguration} root
   * @param {string} key 含 scope 的全键
   * @returns {object}
   */
  static explicitObject(root, key) {
    const inspected = root.inspect(key);
    if (!inspected) return {};

    return {
      ...(inspected.globalValue || {}),
      ...(inspected.workspaceValue || {}),
      ...(inspected.workspaceFolderValue || {}),
    };
  }

  /**
   * 清除缓存
   */
  static clearCache() {
    this.cachedConfig = null;
  }
}

function preprocessWxml(wxmlCode) {
  // 将 WXML 包装在 Vue 模板中，让 Prettier 将其视为 Vue 自定义组件
  const wrappedCode = `<template>\n${wxmlCode}\n</template>`;
  return wrappedCode;
}

/**
 * WXML 后处理：从 Vue 模板中提取格式化后的 WXML（优化版）
 * @param {string} formattedVueCode - 格式化后的 Vue 代码
 * @returns {string} 提取出的 WXML 代码
 */
function postprocessWxml(formattedVueCode) {
  // 提取 template 内容
  const templateMatch = formattedVueCode.match(/<template>([\s\S]*)<\/template>/);
  if (!templateMatch) {
    return formattedVueCode;
  }
  
  const content = templateMatch[1];
  const lines = content.split('\n');
  
  // 找到所有非空行的缩进
  const nonEmptyLines = lines.filter(line => line.trim() !== '');
  if (nonEmptyLines.length === 0) {
    return '';
  }
  
  // 计算统一的缩进（取第一个非空行的缩进）
  const firstNonEmptyLine = nonEmptyLines[0];
  const baseIndent = firstNonEmptyLine.match(/^(\s*)/)[1].length;
  
  // 移除统一的缩进
  const processedLines = lines.map(line => {
    if (line.trim() === '') {
      return '';
    } else if (line.length >= baseIndent) {
      return line.slice(baseIndent);
    } else {
      return line;
    }
  });
  
  return processedLines.join('\n').trim();
}

/**
 * 统一格式化函数
 * @param {string} code - 要格式化的代码
 * @param {string} fileType - 文件类型 'vue'、'wxml'、'wxss'、'less'、'css'、'html'、'javascript' 或 'typescript'
 *   （`sass` 缩进语法没有对应的 Prettier parser，会原样返回）
 * @param {string} filePath - 文件路径（用于 overrides 匹配）
 * @param {{ tabSize?: number, insertSpaces?: boolean }} [editorOptions] - 编辑器传入的 FormattingOptions；仅在用户未显式配置缩进时生效
 * @param {{ compactCss?: boolean }} [formatOptions] - css/wxss 是否用单行紧凑排版
 * @returns {Promise<string>} 格式化后的代码
 */
async function unifiedFormat(code, fileType, filePath = null, editorOptions = null, formatOptions = {}) {
  try {
    // 大文件优化：如果文件大小超过 1MB，使用快速格式化模式
    if (code.length > 1024 * 1024) {
      return code;
    }

    // 映射文件类型到对应的 parser 和扩展名
    const parserMap = {
      'wxss': { parser: 'css', ext: '.wxss' },
      'scss': { parser: 'scss', ext: '.scss' },
      'less': { parser: 'less', ext: '.less' },
      'css': { parser: 'css', ext: '.css' },
      'html': { parser: 'html', ext: '.html' },
      'javascript': { parser: 'babel', ext: '.js' },
      'typescript': { parser: 'typescript', ext: '.ts' },
      // Pug 由 @prettier/plugin-pug 提供 parser（Prettier 内核不含 pug）
      'pug': { parser: 'pug', ext: '.pug', plugins: [pugPlugin] }
    };

    // Prettier 没有 sass（缩进语法）的 parser。返回原文、不报错，
    // 让 VS Code 把格式化交给下一个提供器（如 Prettier 扩展）。
    if (!parserMap[fileType] && fileType !== 'vue' && fileType !== 'wxml') {
      return code;
    }

    // 快速格式化非 Vue/WXML 文件
    if (parserMap[fileType]) {
      // 确定文件路径，用于 overrides 匹配
      const effectiveFilePath = filePath || `temp${parserMap[fileType].ext}`;
      const prettierOptions = await ConfigManager.getMergedPrettierConfig(fileType, effectiveFilePath);
      // 优先级：用户显式配置 > 编辑器 options > 扩展默认值
      const explicitIndent = ConfigManager.getExplicitIndentSetting(fileType, effectiveFilePath);
      const editorAwareOptions = applyEditorFormattingOptions(prettierOptions, editorOptions, explicitIndent);
      
      const cleanOptions = withoutOverrides(editorAwareOptions);
      
      const finalOptions = {
        ...cleanOptions,
        parser: parserMap[fileType].parser,
        filepath: effectiveFilePath,
        ...(parserMap[fileType].plugins ? { plugins: parserMap[fileType].plugins } : {})
      };

      let output = await prettier.format(code, finalOptions);

      // css / wxss 可选用单行紧凑排版（保留注释：格式化不能删用户内容）
      if (formatOptions.compactCss && (fileType === 'css' || fileType === 'wxss')) {
        const tabSize = typeof editorOptions?.tabSize === 'number' && editorOptions.tabSize > 0
          ? editorOptions.tabSize
          : 2;
        output = formatCompact(output, {
          preserveComments: true,
          indentUnit: ' '.repeat(tabSize),
        });
      }

      return output;
    }
    
    let codeToFormat = code;
    let isWxml = false;
    let savedComments = [];
    let savedBlocks = [];
    let needCommentProtection = false;
    let prettierOptions = null;

    // WXML 预处理
    if (fileType === 'wxml') {
      // 模板块先整体保护：Prettier 会把 <wxs> 里的 JS 当 HTML 文本重排。
      // 顺序很重要 —— 块保护必须在注释保护之前，否则块内的注释会被单独抽走。
      const protectedBlocks = protectVerbatimBlocks(code, WXML_VERBATIM_BLOCKS);
      savedBlocks = protectedBlocks.blocks;

      const { code: protectedCode, comments } = protectComments(protectedBlocks.code);
      savedComments = comments;
      codeToFormat = preprocessWxml(protectedCode);
      isWxml = true;
      needCommentProtection = true;
    } else if (fileType === 'vue') {
      // Vue 也保护注释内容（预防性修复）
      const { code: protectedCode, comments } = protectComments(code);
      savedComments = comments;
      codeToFormat = protectedCode;
      needCommentProtection = true;
    }

    // 重新获取配置（带上文件路径，以便正确处理 overrides）
    const effectiveFilePath = filePath || (fileType === 'wxml' ? 'temp.wxml' : 'temp.vue');
    prettierOptions = await ConfigManager.getMergedPrettierConfig(fileType, effectiveFilePath);
    // 优先级：用户显式配置 > 编辑器 options > 扩展默认值
    const explicitIndent = ConfigManager.getExplicitIndentSetting(fileType, effectiveFilePath);
    prettierOptions = applyEditorFormattingOptions(prettierOptions, editorOptions, explicitIndent);

    const cleanPrettierOptions = withoutOverrides(prettierOptions);

    // 只强制 WXML 包裹方案必需的项：parser 必须是 vue；
    // htmlWhitespaceSensitivity 必须 ignore，否则包裹后的空白处理会破坏 WXML。
    // singleAttributePerLine / bracketSameLine 不再强制 —— 用户设什么就是什么
    // （默认值已调到与之前强制值一致，见 package.json 的 prettierOptions）。
    const forcedOptions = {
      htmlWhitespaceSensitivity: 'ignore',
      parser: 'vue'
    };

    const finalOptions = {
      ...cleanPrettierOptions,
      ...forcedOptions,
      // 添加文件路径，用于 overrides 匹配
      filepath: filePath || (fileType === 'wxml' ? 'temp.wxml' : 'temp.vue')
    };

    let formatted = await prettier.format(codeToFormat, finalOptions);

    // WXML 后处理
    if (isWxml) {
      formatted = postprocessWxml(formatted);
    }

    // mustache 空格只作用于标记区域（B1）：Vue 仅 <template>，WXML 全文。
    // 这一步必须在还原注释/模板块之前，否则 <script>、<style>、<wxs> 里的
    // 字符串与正则字面量会被误改。WXML 没有单花括号语法，不跑单括号规则。
    const mustacheSpacing = await ConfigManager.getMustacheSpacingConfig();
    formatted = applyMustacheSpacing(formatted, {
      spacing: mustacheSpacing,
      ranges: findMarkupRanges(formatted, fileType),
      singleBraces: fileType !== 'wxml',
    });

    // 恢复注释内容（WXML 和 Vue 都需要）
    if (needCommentProtection) {
      formatted = restoreComments(formatted, savedComments);
    }

    // 压缩内部有换行的 text 标签（仅 WXML）
    // 这样可以保证 Prettier 正常缩进，然后只处理有问题的 text 标签
    if (isWxml) {
      formatted = compressTextTags(formatted);
      // 模板块最后还原：内容逐字符回到原文
      formatted = restoreVerbatimBlocks(formatted, savedBlocks);
    }

    return formatted;
  } catch (error) {
    console.error(`[ERROR] 格式化失败: ${error.message}`, error);
    throw error;
  }
}

module.exports = {
  unifiedFormat,
  ConfigManager,
};