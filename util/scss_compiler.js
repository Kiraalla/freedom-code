const fs = require('fs');
const path = require('path');
const sass = require('sass');
const cssFormatter = require('./css_formatter');

class SCSSCompiler {
  constructor() {
    this.logger = null;
  }

  setLogger(logger) {
    this.logger = logger;
  }

  compile(filePath, config = {}) {
    try {
      let {
        includePaths = [],
        ignoreUnderscoreFiles = true,
        outputCompact = true,
        preserveComments = false,
        removeCharset = true,
        outputPath = '',
        outputPathFormat = 'same',
        outputExtension = '.css',
        workspacePath = null
      } = config;

      const fileName = path.basename(filePath);

      if (ignoreUnderscoreFiles && fileName.startsWith('_')) {
        this.logger?.info(`跳过部分文件: ${fileName}`);
        return;
      }

      const result = sass.compile(filePath, {
        style: preserveComments ? 'expanded' : 'compressed',
        loadPaths: includePaths
      });

      let outputCss = outputCompact 
        ? this.formatCompact(result.css, preserveComments) 
        : this.formatExpanded(result.css, preserveComments);

      if (removeCharset) {
        outputCss = outputCss.replace(/@charset\s+["'][^"']*["']\s*;?\s*/gi, '');
      }

      outputCss = this.postProcessForCustomExtension(outputCss, outputExtension);

      let finalOutputPath = '';
      const fileExtension = path.extname(filePath);
      const fileNameWithoutExt = path.basename(filePath, fileExtension);

      switch (outputPathFormat) {
        case 'same':
          finalOutputPath = filePath.replace(/\.(scss|sass)$/, outputExtension);
          break;

        case 'custom':
          if (outputPath) {
            let targetOutputPath;
            if (path.isAbsolute(outputPath)) {
              targetOutputPath = outputPath;
            } else {
              targetOutputPath = path.join(path.dirname(filePath), outputPath);
            }
            if (!fs.existsSync(targetOutputPath)) {
              fs.mkdirSync(targetOutputPath, { recursive: true });
            }
            finalOutputPath = path.join(targetOutputPath, `${fileNameWithoutExt}${outputExtension}`);
          } else {
            finalOutputPath = filePath.replace(/\.(scss|sass)$/, outputExtension);
          }
          break;

        case 'relative':
          if (outputPath) {
            let targetOutputPath;
            // 使用传入的工作区路径,如果没有则使用文件所在目录
            const wsPath = workspacePath || path.dirname(filePath);
            
            if (path.isAbsolute(outputPath)) {
              targetOutputPath = outputPath;
            } else {
              if (outputPath.startsWith('/')) {
                outputPath = outputPath.substring(1);
              }
              targetOutputPath = path.join(wsPath, outputPath);
              if (!fs.existsSync(targetOutputPath)) {
                fs.mkdirSync(targetOutputPath, { recursive: true });
              }
            }

            const relativePath = path.relative(wsPath, path.dirname(filePath));
            const newOutputDir = path.join(targetOutputPath, relativePath);
            if (!fs.existsSync(newOutputDir)) {
              fs.mkdirSync(newOutputDir, { recursive: true });
            }
            finalOutputPath = path.join(newOutputDir, `${fileNameWithoutExt}${outputExtension}`);
          } else {
            finalOutputPath = filePath.replace(/\.(scss|sass)$/, '.css');
          }
          break;

        default:
          finalOutputPath = filePath.replace(/\.(scss|sass)$/, '.css');
      }

      const outputDir = path.dirname(finalOutputPath);
      this.logger?.debug(`输出目录: ${outputDir}`);
      
      if (!fs.existsSync(outputDir)) {
        this.logger?.debug(`创建输出目录: ${outputDir}`);
        fs.mkdirSync(outputDir, { recursive: true });
      }

      this.logger?.debug(`写入文件: ${finalOutputPath}, 内容长度: ${outputCss.length} 字符`);
      
      fs.writeFileSync(finalOutputPath, outputCss);
      
      this.logger?.debug(`文件写入完成`);
      this.logger?.info(`已成功编译 ${path.basename(filePath)} 到 ${finalOutputPath}`);
      return finalOutputPath;
    } catch (error) {
      this.logger?.error(`编译失败: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * 抽出顶层注释（委托给纯函数模块，保持旧接口）。
   * @param {string} css
   * @param {boolean} preserveComments
   * @returns {{ css: string, comments: string[] }}
   */
  extractCommentsOutsideBlocks(css, preserveComments) {
    return cssFormatter.extractCommentsOutsideBlocks(css, preserveComments);
  }

  /**
   * 紧凑排版：一条规则一行。嵌套感知 —— `@media` / `@keyframes` 内部按层缩进，
   * 不再被压平成一行。
   * @param {string} css
   * @param {boolean} [preserveComments]
   * @returns {string}
   */
  formatCompact(css, preserveComments = false) {
    return cssFormatter.formatCompact(css, { preserveComments });
  }

  /**
   * 展开排版：每条属性一行。
   * @param {string} css
   * @param {boolean} [preserveComments]
   * @returns {string}
   */
  formatExpanded(css, preserveComments = false) {
    return cssFormatter.formatExpanded(css, { preserveComments });
  }

  postProcessForCustomExtension(css, extension) {
    const normalizedExt = extension.startsWith('.') ? extension : `.${extension}`;

    if (normalizedExt !== '.css') {
      // 先在 @import url(...) 后添加换行符
      css = css.replace(/@import\s+url\(\s*(['"])(.*?)\1\s*\)\s*;/gi, "$&\n");
      // 处理 @import url(...) 的扩展名
      css = css.replace(/@import\s+url\(\s*(['"])(.*?)\1\s*\)\s*;/gi, "@import $1$2$1;");
      // 处理 @import 文件名的扩展名
      css = css.replace(/@import\s+(['"])([^'"]*?)\.css\1/gi, `@import $1$2${normalizedExt}$1`);
      // 处理 url() 的扩展名
      css = css.replace(/url\((['"]?)([^'")]*?)\.css\1\)/gi, `url($1$2${normalizedExt}$1)`);
    }

    return css;
  }
}

module.exports = SCSSCompiler;
