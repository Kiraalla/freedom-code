'use strict';

const vscode = require('vscode');

const format_core = require('../wxml_plus/format_core');
const cssStyle = require('../features/css-style');

// 支持格式化的语言。语言 id 与 unifiedFormat 的 fileType 一一同名，直接透传。
const SUPPORTED_FORMATTING_LANGUAGES = [
  'wxml',
  'vue',
  'wxss',
  'scss',
  'less',
  'css',
  'html',
  'javascript',
  'typescript',
  'pug',
];

class FreedomDocumentFormattingEditProvider {
  /**
   * @param {vscode.ExtensionContext} [context] 用于读取/记忆 CSS 排版风格
   */
  constructor(context) {
    this.context = context;
  }

  /**
   * css / wxss 的排版风格（normal | compact）。
   * @param {string} fileType
   * @returns {{ compactCss: boolean }}
   */
  cssStyleOptions(fileType) {
    const isCss = fileType === 'css' || fileType === 'wxss';
    const compactCss = isCss && this.context
      ? cssStyle.resolveStyle(this.context) === 'compact'
      : false;

    return { compactCss };
  }

  /**
   * 首次格式化 css / wxss 后提示一次可选模式（不阻塞保存流程）。
   * @param {string} fileType
   */
  maybeNoticeCssStyle(fileType) {
    if (!this.context) return;
    if (fileType !== 'css' && fileType !== 'wxss') return;
    cssStyle.noticeOnceIfUndecided(this.context);
  }

  async provideDocumentFormattingEdits(document, options) {
    const fileType = document.languageId;

    if (!SUPPORTED_FORMATTING_LANGUAGES.includes(fileType)) {
      return [];
    }

    try {
      const text = document.getText();
      const formattedText = await format_core.unifiedFormat(
        text,
        fileType,
        document.uri.fsPath,
        options,
        this.cssStyleOptions(fileType)
      );

      this.maybeNoticeCssStyle(fileType);

      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(text.length)
      );

      return [vscode.TextEdit.replace(fullRange, formattedText)];
    } catch (error) {
      vscode.window.showErrorMessage(`${fileType} 格式化失败: ${error.message}`);
      return [];
    }
  }

  async provideDocumentRangeFormattingEdits(document, range, options) {
    const fileType = document.languageId;

    if (!SUPPORTED_FORMATTING_LANGUAGES.includes(fileType)) {
      return [];
    }

    try {
      const text = document.getText(range);
      const formattedText = await format_core.unifiedFormat(
        text,
        fileType,
        document.uri.fsPath,
        options,
        this.cssStyleOptions(fileType)
      );

      return [vscode.TextEdit.replace(range, formattedText)];
    } catch (error) {
      vscode.window.showErrorMessage(`${fileType} 格式化失败: ${error.message}`);
      return [];
    }
  }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function register(context) {
  const provider = new FreedomDocumentFormattingEditProvider(context);

  SUPPORTED_FORMATTING_LANGUAGES.forEach((language) => {
    context.subscriptions.push(
      vscode.languages.registerDocumentFormattingEditProvider({ language }, provider)
    );

    context.subscriptions.push(
      vscode.languages.registerDocumentRangeFormattingEditProvider({ language }, provider)
    );
  });
}

module.exports = { register };
