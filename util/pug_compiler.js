'use strict';

const fs = require('fs');
const path = require('path');
const pug = require('pug');
const prettier = require('prettier');

const { resolveOutputPath } = require('./output-path');

/**
 * Pug 编译器：把 `.pug` / `.jade` 渲染成 HTML。
 *
 * 与 SCSS 编译的区别：产物扩展名固定 `.html`（Pug 没有"自定义后缀"的语义）。
 * 美化走已有的 Prettier html 格式化，因此 `printWidth` / `tabWidth` / 语言级
 * `overrides` 与项目其他 HTML 保持一致。
 */
class PugCompiler {
  constructor() {
    this.logger = null;
  }

  setLogger(logger) {
    this.logger = logger;
  }

  /**
   * @param {string} filePath 源文件绝对路径
   * @param {{
   *   ignoreUnderscoreFiles?: boolean,
   *   pretty?: boolean,
   *   outputPath?: string,
   *   outputPathFormat?: 'same'|'custom'|'relative',
   *   basedir?: string,
   *   workspacePath?: string|null,
   *   prettierOptions?: object,
   * }} [config]
   * @returns {Promise<string|undefined>} 产物路径；跳过时返回 undefined
   */
  async compile(filePath, config = {}) {
    const {
      ignoreUnderscoreFiles = true,
      pretty = true,
      outputPath = '',
      outputPathFormat = 'same',
      basedir = '',
      workspacePath = null,
      prettierOptions = {},
    } = config;

    try {
      const fileName = path.basename(filePath);

      if (ignoreUnderscoreFiles && fileName.startsWith('_')) {
        this.logger?.info(`跳过部分文件: ${fileName}`);
        return undefined;
      }

      const html = pug.renderFile(filePath, {
        pretty: false,
        compileDebug: false,
        basedir: this.resolveBasedir(filePath, basedir, workspacePath),
      });

      let output = html;

      if (pretty) {
        try {
          output = await prettier.format(html, { ...prettierOptions, parser: 'html' });
        } catch (error) {
          // 美化失败不应让编译失败：退回未美化的 HTML
          this.logger?.warn(`HTML 美化失败，输出未美化的结果: ${error.message}`);
        }
      }

      const finalPath = resolveOutputPath(filePath, {
        outputPath,
        outputPathFormat,
        outputExtension: '.html',
        workspacePath,
      });

      fs.writeFileSync(finalPath, output);
      this.logger?.info(`已编译 ${fileName} 到 ${finalPath}`);
      return finalPath;
    } catch (error) {
      this.logger?.error(`编译失败: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * include / extends 的基准目录：显式 basedir > 工作区 > 源文件目录。
   * @param {string} filePath
   * @param {string} basedir
   * @param {string|null} workspacePath
   * @returns {string}
   */
  resolveBasedir(filePath, basedir, workspacePath) {
    if (basedir) {
      return path.isAbsolute(basedir)
        ? basedir
        : path.join(workspacePath || path.dirname(filePath), basedir);
    }

    return workspacePath || path.dirname(filePath);
  }
}

module.exports = PugCompiler;
