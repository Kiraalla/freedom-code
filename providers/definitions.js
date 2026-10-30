'use strict';

const vscode = require('vscode');

const PeekFileDefinitionProvider = require('../vue_plus/PeekFileDefinitionProvider');
const wxmlCompletionItemProvider = require('../util/wxmlCompletionItemProvider');
const wxmlDefinitionProvider = require('../util/wxmlDefinitionProvider');
const jsonDefinitionProvider = require('../util/jsonDefinitionProvider');
const { readSetting } = require('../util/settings');

const documentSelector = [
  { scheme: 'file', language: 'wxml', pattern: '**/*.wxml' },
];
const documentSelectorJson = [
  { scheme: 'file', language: 'json', pattern: '**/*.json' },
];

const languageConfiguration = {
  wordPattern: /(\w+((-\w+)+)?)/,
};

/**
 * 定义跳转与属性补全。
 * @param {vscode.ExtensionContext} context
 * @param {{ logger: object }} deps
 */
function register(context, deps) {
  const { logger } = deps;
  // 根配置 + 全键（见 util/settings.js 的键名约定）
  const configParams = vscode.workspace.getConfiguration();

  // Vue 组件名 → 文件
  const vueSupportedLanguages = readSetting(
    configParams,
    ['freedomCode.vueSupportedLanguages', 'freedomCode.vue-supportedLanguages'],
    ['vue', 'javascript', 'typescript']
  );
  const targetFileExtensions = readSetting(
    configParams,
    ['freedomCode.vueTargetFileExtensions', 'freedomCode.vue-targetFileExtensions'],
    ['.vue', '.js', '.ts']
  );

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      vueSupportedLanguages,
      new PeekFileDefinitionProvider(targetFileExtensions)
    )
  );
  context.subscriptions.push(
    vscode.languages.setLanguageConfiguration('vue', languageConfiguration)
  );
  logger.debug('Vue 定义跳转已注册');

  // WXML 组件 → 定义
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(documentSelector, wxmlDefinitionProvider)
  );
  logger.debug('WXML 定义跳转已注册');

  // app.json / 页面 json 的 usingComponents → 定义
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(documentSelectorJson, jsonDefinitionProvider)
  );
  logger.debug('JSON 定义跳转已注册');

  // WXML 组件属性与事件补全
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(documentSelector, wxmlCompletionItemProvider, ' ')
  );
  logger.debug('WXML 自动补全已注册');
}

module.exports = { register };
