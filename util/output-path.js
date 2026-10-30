'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 编译产物的输出路径解析（SCSS 与 Pug 共用同一份策略，避免两处漂移）。
 *
 * - `same`：与源文件同目录，只换扩展名
 * - `custom`：输出到 `outputPath`（相对源文件目录或绝对路径）
 * - `relative`：输出到 `workspacePath/outputPath` 下，并保留源文件相对工作区的目录层级
 *
 * @param {string} filePath 源文件绝对路径
 * @param {{
 *   outputPath?: string,
 *   outputPathFormat?: 'same'|'custom'|'relative',
 *   outputExtension?: string,
 *   workspacePath?: string|null,
 * }} [options]
 * @returns {string} 产物绝对路径（必要时已创建目录）
 */
function resolveOutputPath(filePath, options = {}) {
  const {
    outputPath = '',
    outputPathFormat = 'same',
    outputExtension = '.css',
    workspacePath = null,
  } = options;

  const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
  const sameDirectory = () => filePath.replace(/\.[^.\\/]+$/, outputExtension);

  switch (outputPathFormat) {
    case 'custom': {
      if (!outputPath) return sameDirectory();

      const targetDir = path.isAbsolute(outputPath)
        ? outputPath
        : path.join(path.dirname(filePath), outputPath);

      ensureDirectory(targetDir);
      return path.join(targetDir, `${fileNameWithoutExt}${outputExtension}`);
    }

    case 'relative': {
      if (!outputPath) return sameDirectory();

      const wsPath = workspacePath || path.dirname(filePath);
      // 以 `/` 或 `\` 开头按“工作区相对”理解；只有盘符/UNC 才算绝对路径。
      // （Windows 上 path.isAbsolute('/out') 为 true，但那不是用户想要的意思）
      const isDrivePath = /^[A-Za-z]:[\\/]/.test(outputPath) || outputPath.startsWith('\\\\');
      const relativePart = outputPath.replace(/^[\\/]+/, '');
      const targetDir = isDrivePath ? outputPath : path.join(wsPath, relativePart);

      if (!isDrivePath) ensureDirectory(targetDir);

      const relativePath = path.relative(wsPath, path.dirname(filePath));
      const outputDir = path.join(targetDir, relativePath);
      ensureDirectory(outputDir);

      return path.join(outputDir, `${fileNameWithoutExt}${outputExtension}`);
    }

    default:
      return sameDirectory();
  }
}

/**
 * @param {string} dir
 */
function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = { resolveOutputPath, ensureDirectory };
