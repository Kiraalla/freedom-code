const fs = require('fs');
const path = require('path');
const sass = require('sass');

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
            if (path.isAbsolute(outputPath)) {
              targetOutputPath = outputPath;
            } else {
              if (outputPath.startsWith('/')) {
                outputPath = outputPath.substring(1);
              }
              // 使用传入的工作区路径,如果没有则使用文件所在目录
              const wsPath = workspacePath || path.dirname(filePath);
              targetOutputPath = path.join(wsPath, outputPath);
              if (!fs.existsSync(targetOutputPath)) {
                fs.mkdirSync(targetOutputPath, { recursive: true });
              }
            }

            // 使用传入的工作区路径,如果没有则使用文件所在目录
            const wsPath = workspacePath || path.dirname(filePath);
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
      
      const fileExists = fs.existsSync(finalOutputPath);
      const stats = fs.statSync(finalOutputPath);
      const fileContent = fs.readFileSync(finalOutputPath, 'utf-8');
      
      this.logger?.debug(`文件存在: ${fileExists}, 大小: ${stats.size} 字节, 读取长度: ${fileContent.length} 字符`);

      this.logger?.info(`已成功编译 ${path.basename(filePath)} 到 ${finalOutputPath}`);
      return finalOutputPath;
    } catch (error) {
      this.logger?.error(`编译失败: ${error.message}`, error);
      throw error;
    }
  }

  extractCommentsOutsideBlocks(css, preserveComments) {
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
        if (ch === '\\') {
          if (i + 1 < css.length) {
            out += css[i + 1];
            i += 2;
            continue;
          }
        }
        if (ch === stringChar) {
          inString = false;
          stringChar = '';
        }
        i++;
        continue;
      }

      if (ch === '/' && i + 1 < css.length && css[i + 1] === '*') {
        const start = i;
        const endIdx = css.indexOf('*/', i + 2);
        const end = endIdx === -1 ? css.length - 2 : endIdx + 1;
        const comment = css.slice(start, end + 1);
        if (depth === 0) {
          comments.push(comment);
          out += `__COMMENT_${comments.length - 1}__`;
        } else {
          // 块内注释后面如果有换行符,转换为空格
          out += comment;
          let nextIdx = end + 1;
          while (nextIdx < css.length && /\s/.test(css[nextIdx])) {
            nextIdx++;
          }
          if (nextIdx > end + 1) {
            out += ' ';
            i = nextIdx;
            continue;
          }
        }
        i = end + 1;
        continue;
      }

      if (ch === '{') {
        depth++;
        out += ch;
        i++;
        continue;
      }
      if (ch === '}') {
        depth = Math.max(0, depth - 1);
        out += ch;
        i++;
        continue;
      }

      out += ch;
      i++;
    }

    return { css: out, comments };
  }

  parsePropertiesWithComments(properties) {
    const tokens = [];
    let i = 0;
    while (i < properties.length) {
      while (i < properties.length && /\s/.test(properties[i])) i++;
      if (i >= properties.length) break;
      
      if (properties.startsWith('/*', i)) {
        const endIdx = properties.indexOf('*/', i + 2);
        const end = endIdx === -1 ? properties.length : endIdx + 2;
        const comment = properties.slice(i, end);
        
        // 跳过注释后的空白(包括换行)
        i = end;
        while (i < properties.length && /\s/.test(properties[i])) i++;
        
        // 检查注释后面是否有属性
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
        
        // 注释后面没有属性,插入到最近的属性前面
        let lastPropIdx = -1;
        for (let j = tokens.length - 1; j >= 0; j--) {
          if (tokens[j].type === 'prop') {
            lastPropIdx = j;
            break;
          }
        }
        
        if (lastPropIdx !== -1) {
          tokens.splice(lastPropIdx, 0, { type: 'comment', text: comment });
        } else {
          tokens.push({ type: 'comment', text: comment });
        }
        i = end;
        continue;
      }

      const semicolon = properties.indexOf(';', i);
      if (semicolon === -1) {
        const chunk = properties.slice(i).trim();
        if (chunk) tokens.push({ type: 'prop', text: chunk });
        break;
      } else {
        const chunk = properties.slice(i, semicolon).trim();
        if (chunk) tokens.push({ type: 'prop', text: chunk });
        i = semicolon + 1;
      }
    }
    return tokens;
  }

  formatCompact(css, preserveComments = false) {
    const parsed = this.extractCommentsOutsideBlocks(css, preserveComments);
    const comments = parsed.comments;
    css = parsed.css;

    css = css.replace(/[\n\r\t]+/g, '');
    css = css.replace(/\*\/(?=\S)/g, '*/ ');
    css = css.replace(/(\S)\/\*/g, '$1 /*');
    css = css.replace(/\s*([{}:;,])\s*/g, '$1');

    css = css.replace(/}/g, '}\n');

    css = css.replace(/{([^}]+)}/g, (_match, properties) => {
      properties = properties.trim();
      if (!properties) {
        return '{}\n';
      }

      const tokens = this.parsePropertiesWithComments(properties);
      const parts = [];
      tokens.forEach((t) => {
        if (t.type === 'prop') {
          parts.push(`${t.text};`);
        } else {
          // 注释保持原样,不追加分号
          parts.push(t.text);
        }
      });

      const formattedProperties = parts.join(' ');

      return `{ ${formattedProperties} }`;
    });

    if (preserveComments) {
      css = css.replace(/__COMMENT_(\d+)__/g, (_match, index) => {
        return `\n${comments[parseInt(index)]}\n`;
      });
      css = css.replace(/\n{3,}/g, '\n\n');
    }

    return css.trim();
  }

  formatExpanded(css, preserveComments = false) {
    const parsed = this.extractCommentsOutsideBlocks(css, preserveComments);
    const comments = parsed.comments;
    css = parsed.css;

    css = css.replace(/[\n\r\t]+/g, '');
    css = css.replace(/\*\/(?=\S)/g, '*/ ');
    css = css.replace(/(\S)\/\*/g, '$1 /*');
    css = css.replace(/\s*([{}:;,])\s*/g, '$1');

    css = css.replace(/}/g, '}\n\n');

    css = css.replace(/{([^}]+)}/g, (_match, properties) => {
      properties = properties.trim();
      if (!properties) {
        return '{}\n';
      }

      const tokens = this.parsePropertiesWithComments(properties);
      let formattedProperties = '';
      for (let idx = 0; idx < tokens.length; idx++) {
        const t = tokens[idx];
        if (t.type === 'comment') {
          const next = tokens[idx + 1];
          if (next && next.type === 'prop') {
            // 注释在属性前面
            formattedProperties += `\n    ${t.text}  ${next.text};`;
            idx++;
          } else {
            formattedProperties += `\n    ${t.text}`;
          }
        } else {
          formattedProperties += `\n    ${t.text};`;
        }
      }

      return `{${formattedProperties}\n}`;
    });

    if (preserveComments) {
      css = css.replace(/__COMMENT_(\d+)__/g, (_match, index) => {
        return `\n${comments[parseInt(index)]}\n`;
      });
      css = css.replace(/\n{3,}/g, '\n\n');
    }

    return css.trim();
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
