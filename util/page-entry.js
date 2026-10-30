'use strict';

/**
 * 小程序页面路径推导：纯函数，不依赖 vscode。
 *
 * app.json 里的 `pages` 是**相对小程序根**的路径，并不要求以 `pages/` 开头；
 * 分包的 `pages` 则是相对该分包 `root` 的路径。以前用 `split('pages/')` 推导，
 * 非 `pages/` 目录会算出 `pages/undefined/index`。
 */

/**
 * @param {string} value
 * @returns {string} 统一为 / 分隔、无前导 ./ 或 /、无尾部 /
 */
function normalizePath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

/**
 * 推导页面在 app.json 里的登记条目。
 * @param {string} relativePathFromRoot 页面目录相对小程序根的路径
 * @param {string[]} [subPackageRoots] app.json 里 subPackages[].root
 * @returns {{ kind: 'main', entry: string } | { kind: 'sub', root: string, entry: string }}
 */
function derivePageEntry(relativePathFromRoot, subPackageRoots = []) {
  const pagePath = normalizePath(relativePathFromRoot);
  const entry = pagePath ? `${pagePath}/index` : 'index';

  // 取最长匹配的 root，避免 'sub' 与 'sub/inner' 同时命中时选错
  const matchedRoot = subPackageRoots
    .map(normalizePath)
    .filter((root) => root && (pagePath === root || pagePath.startsWith(`${root}/`)))
    .sort((a, b) => b.length - a.length)[0];

  if (!matchedRoot) {
    return { kind: 'main', entry };
  }

  const insideRoot = pagePath === matchedRoot ? '' : pagePath.slice(matchedRoot.length + 1);
  return {
    kind: 'sub',
    root: matchedRoot,
    entry: insideRoot ? `${insideRoot}/index` : 'index',
  };
}

module.exports = {
  derivePageEntry,
};
