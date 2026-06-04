"use strict";
const prettier = require("prettier");
const vscode = require("vscode");
const path = require("path");

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
    ConfigManager.cacheTimestamp = 0;
  }
  
  /**
   * 获取指定文件类型的合并后的 Prettier 配置
   * @param {string} fileType - 文件类型 'vue' 或 'wxml'
   * @param {string} filePath - 文件路径（用于 overrides 匹配）
   * @returns {Promise<object>} 合并后的配置对象
   */
  static async getMergedPrettierConfig(fileType, filePath = null) {
    const now = Date.now();
    // 缓存有效期 10 秒（减少缓存失效问题）
    if (this.cachedConfig && this.cachedConfig[fileType] && now - this.cacheTimestamp < 10 * 1000) {
      return this.cachedConfig[fileType];
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

    // 如果有文件路径和 overrides 配置，手动处理 overrides
    if (filePath && mergedConfig.overrides) {
      const resolvedConfig = ConfigManager.applyOverrides(filePath, mergedConfig);
      // 缓存配置
      if (!this.cachedConfig) {
        this.cachedConfig = {};
      }
      this.cachedConfig[fileType] = resolvedConfig;
      this.cacheTimestamp = now;
      return resolvedConfig;
    }

    // 缓存配置
    if (!this.cachedConfig) {
      this.cachedConfig = {};
    }
    this.cachedConfig[fileType] = mergedConfig;
    this.cacheTimestamp = now;

    return mergedConfig;
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
   * 解析 Prettier 配置，支持 overrides
   * @param {string} filePath - 文件路径
   * @param {object} options - Prettier 选项
   * @returns {Promise<object>} 解析后的配置
   */
  static async resolveConfig(filePath, options) {
    try {
      // 使用 prettier.resolveConfig 来正确处理 overrides
      const resolved = await prettier.resolveConfig(filePath, {
        config: options
      });
      return { ...options, ...resolved };
    } catch (error) {
      // 如果 resolveConfig 失败，返回原始选项
      console.warn(`[WARN] resolveConfig failed: ${error.message}`);
      return options;
    }
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
   * 清除缓存
   */
  static clearCache() {
    this.cachedConfig = null;
    this.cacheTimestamp = 0;
  }
}

/**
 * 保护注释内容：将注释替换为占位符
 * @param {string} code - 原始代码
 * @returns {object} { code: 处理后的代码, comments: 注释映射表 }
 */
function protectComments(code) {
  const comments = [];
  let index = 0;
  
  // 使用 htmlparser2 替代正则表达式处理注释
  const htmlparser2 = require('htmlparser2');
  
  // 先收集所有注释
  const parser = new htmlparser2.Parser({
    oncomment: (data) => {
      const original = `<!--${data}-->`;
      const placeholder = `<!--__COMMENT_PLACEHOLDER_${index}__-->`;
      comments.push({ placeholder, original });
      index++;
    }
  }, { decodeEntities: true });
  
  parser.write(code);
  parser.end();
  
  // 替换注释为占位符
  let protectedCode = code;
  comments.forEach(({ placeholder, original }) => {
    protectedCode = protectedCode.replace(original, placeholder);
  });
  
  return { code: protectedCode, comments };
}

/**
 * 恢复注释内容：将占位符替换回原始注释
 * @param {string} code - 处理后的代码
 * @param {Array} comments - 注释映射表
 * @returns {string} 恢复注释后的代码
 */
function restoreComments(code, comments) {
  let restoredCode = code;
  
  comments.forEach(({ placeholder, original }) => {
    restoredCode = restoredCode.replace(placeholder, original);
  });
  
  return restoredCode;
}

/**
 * WXML 预处理：将 WXML 包装在 Vue 模板中
 * @param {string} wxmlCode - 原始 WXML 代码
 * @returns {string} 包装后的 Vue 模板代码
 */
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
 * 保护 text 标签内容不被换行
 * @param {string} code - 原始代码
 * @returns {object} { code: 处理后的代码, textTags: text 标签列表 }
 */
function protectTextTags(code) {
  const textTags = [];
  let index = 0;
  // 匹配 text 标签，包括内部内容
  const textTagRegex = /<text(\s[^>]*)?>([\s\S]*?)<\/text>/gi;
  let processedCode = code;
  
  let match;
  while ((match = textTagRegex.exec(code)) !== null) {
    const originalTag = match[0];
    const placeholder = `__TEXT_TAG_${index}__`;
    textTags.push({ placeholder, original: originalTag });
    index++;
  }
  
  // 倒序替换，避免索引变化影响
  for (let i = textTags.length - 1; i >= 0; i--) {
    const { placeholder, original } = textTags[i];
    processedCode = processedCode.replace(original, placeholder);
  }
  
  return { code: processedCode, textTags };
}

/**
 * 恢复 text 标签内容
 * @param {string} code - 处理后的代码
 * @param {Array} textTags - text 标签列表
 * @returns {string} 恢复后的代码
 */
function restoreTextTags(code, textTags) {
  let restoredCode = code;
  textTags.forEach(({ placeholder, original }) => {
    restoredCode = restoredCode.replace(placeholder, original);
  });
  return restoredCode;
}

/**
 * 压缩 text 标签内容（仅当内部有换行时才压缩）
 * @param {string} code - 原始代码
 * @returns {string} 处理后的代码
 */
function compressTextTags(code) {
  // 匹配 text 标签
  return code.replace(/<text(\s[^>]*)?>([\s\S]*?)<\/text>/gi, (match, attrs, content) => {
    // 检查内部内容是否包含换行
    const hasNewline = /[\r\n]/.test(content);
    
    // 只有当内部有换行时才压缩，否则保持原样
    if (hasNewline) {
      // 压缩内部内容，将换行和多余空格替换为单个空格
      const compressedContent = content.replace(/\s+/g, ' ').trim();
      if (attrs) {
        return `<text${attrs}>${compressedContent}</text>`;
      }
      return `<text>${compressedContent}</text>`;
    }
    
    // 没有换行，保持原样
    return match;
  });
}

/**
 * 统一格式化函数
 * @param {string} code - 要格式化的代码
 * @param {string} fileType - 文件类型 'vue'、'wxml'、'wxss'、'scss'、'sass'、'less'、'css'、'html'、'javascript' 或 'typescript'
 * @param {string} filePath - 文件路径（用于 overrides 匹配）
 * @returns {Promise<string>} 格式化后的代码
 */
async function unifiedFormat(code, fileType, filePath = null) {
  try {
    console.log(`[DEBUG] 开始格式化文件类型: ${fileType}, 代码长度: ${code.length}`);
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
      'typescript': { parser: 'typescript', ext: '.ts' }
    };

    // 快速格式化非 Vue/WXML 文件
    if (parserMap[fileType]) {
      // 确定文件路径，用于 overrides 匹配
      const effectiveFilePath = filePath || `temp${parserMap[fileType].ext}`;
      const prettierOptions = await ConfigManager.getMergedPrettierConfig(fileType, effectiveFilePath);
      
      // 清理 Prettier 不支持的选项，避免 "Invalid host defined options" 错误
      const { overrides, ...cleanOptions } = prettierOptions;
      
      const finalOptions = {
        ...cleanOptions,
        parser: parserMap[fileType].parser,
        filepath: effectiveFilePath
      };
      return await prettier.format(code, finalOptions);
    }
    
    let codeToFormat = code;
    let isWxml = false;
    let savedComments = [];
    let needCommentProtection = false;
    let prettierOptions = null;

    // WXML 预处理
    if (fileType === 'wxml') {
      // 保护注释内容
      const { code: protectedCode, comments } = protectComments(code);
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

    // 清理 Prettier 不支持的选项，避免 "Invalid host defined options" 错误
    const { overrides, ...cleanPrettierOptions } = prettierOptions;

    // 强制覆盖关键配置，确保一致性
    const forcedOptions = {
      singleAttributePerLine: false,
      bracketSameLine: true,
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
    
    // 恢复注释内容（WXML 和 Vue 都需要）
    if (needCommentProtection) {
      formatted = restoreComments(formatted, savedComments);
    }
    
    // 压缩内部有换行的 text 标签（仅 WXML）
    // 这样可以保证 Prettier 正常缩进，然后只处理有问题的 text 标签
    if (isWxml) {
      formatted = compressTextTags(formatted);
    }

    // 应用 mustache 空格处理
    const mustacheSpacing = await ConfigManager.getMustacheSpacingConfig();
    formatted = formatMustacheSpacing(formatted, mustacheSpacing);

    return formatted;
  } catch (error) {
    console.error(`[ERROR] 格式化失败: ${error.message}`, error);
    throw error;
  }
}

/**
 * 处理 mustache 表达式的空格
 * @param {string} text - 原始文本
 * @param {string} spacing - 空格模式：'space' | 'preserve' | 'nospace'
 * @returns {string} 处理后的文本
 */
function formatMustacheSpacing(text, spacing) {
  if (spacing === 'preserve') {
    return text;
  }

  // 处理双花括号 {{ }}
  let processed = text.replace(/{{\s*([^{}]*?)\s*}}/g, (match, inner) => {
    const trimmed = inner.trim();

    if (spacing === 'nospace') {
      return `{{${trimmed}}}`;
    } else if (spacing === 'space') {
      // 展开运算符 ... 不加空格
      if (trimmed.startsWith('...')) {
        return `{{${trimmed}}}`;
      } else {
        return `{{ ${trimmed} }}`;
      }
    }

    return match;
  });

  // 处理单花括号 { }（用于 Vue 的 v-bind 简写）
  processed = processed.replace(/\{\s*([^{}]*?)\s*\}/g, (match, inner) => {
    const trimmed = inner.trim();

    if (spacing === 'nospace') {
      return `{${trimmed}}`;
    } else if (spacing === 'space') {
      // 展开运算符 ... 不加空格
      if (trimmed.startsWith('...')) {
        return `{${trimmed}}`;
      } else {
        return `{ ${trimmed} }`;
      }
    }

    return match;
  });

  return processed;
}

module.exports = {
  unifiedFormat,
  ConfigManager,
  formatMustacheSpacing
};