'use strict';

const ActiveText = require('../wxml_plus/ActiveText').default;
const config = require('../wxml_plus/config');

/**
 * WXML 标签高亮：ActiveText 自己管理 decoration 与编辑器监听，
 * 必须进 context.subscriptions，否则扩展卸载后它们仍然活着。
 * @param {vscode.ExtensionContext} context
 * @param {{ logger: object }} deps
 */
function register(context, deps) {
  const { logger } = deps;

  const activeText = new ActiveText(config.config);
  context.subscriptions.push(activeText);

  config.getConfig();
  config.configActivate(activeText);
  context.subscriptions.push({ dispose: () => config.configDeactivate() });

  logger.debug('WXML 设置已初始化');
}

module.exports = { register };
