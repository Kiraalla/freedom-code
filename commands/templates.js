'use strict';

const vscode = require('vscode');

const FileCreator = require('../util/fileCreator');
const { registerFolderCommand } = require('./registry');

const createdPolyfill = require('../template/tools/polyfill');
const createdUtils = require('../template/tools/utils');
const createdVue2 = require('../template/vue2-component');
const createdVue3 = require('../template/vue3-component');
const createdPinia = require('../template/pinia-module');
const createdVuex = require('../template/vuex-module');
const createdHtml = require('../template/html-container');
const createdService = require('../template/service-module');

/**
 * 单文件模板命令：创建后打开新文件。
 * @param {vscode.Uri} resource
 * @param {{ prompt: string, defaultName: string, extension: string, content: string, message: string }} spec
 * @param {object} logger
 */
async function createAndOpen(resource, spec, logger) {
  const fileUri = await FileCreator.createTemplateFile(
    resource,
    spec.prompt,
    spec.defaultName,
    spec.extension,
    spec.content,
    spec.message,
    logger
  );

  if (!fileUri) {
    return;
  }

  const document = await vscode.workspace.openTextDocument(fileUri);
  await vscode.window.showTextDocument(document);
}

/**
 * @param {vscode.ExtensionContext} context
 * @param {{ logger: object }} deps
 */
function register(context, deps) {
  const { logger } = deps;

  // 创建工具文件（polyfill.js + utils.js）
  registerFolderCommand(context, 'extension.createdTools', async (resource) => {
    let toolsName = await vscode.window.showInputBox({
      prompt: '请输入工具文件夹名称',
      placeHolder: '请输入工具文件夹名称',
    });

    if (!toolsName) {
      vscode.window.showErrorMessage('工具文件夹名称不能为空，已设置为默认值 tools！');
      toolsName = 'tools';
    }

    const files = [
      { name: 'polyfill.js', content: createdPolyfill.contentFile },
      { name: 'utils.js', content: createdUtils.contentFile },
    ];

    await FileCreator.createFolderWithFiles(
      resource,
      '请输入工具文件夹名称',
      toolsName,
      files,
      '工具文件模板创建成功！',
      logger
    );
  });

  registerFolderCommand(context, 'extension.createdVue2', (resource) =>
    createAndOpen(resource, {
      prompt: '请输入 Vue2 文件模板名称',
      defaultName: 'vue2_module',
      extension: '.vue',
      content: createdVue2.componentFile,
      message: 'Vue2 文件模板创建成功！',
    }, logger)
  );

  registerFolderCommand(context, 'extension.createdVue3', (resource) =>
    createAndOpen(resource, {
      prompt: '请输入 Vue3 文件模板名称',
      defaultName: 'vue3_module',
      extension: '.vue',
      content: createdVue3.componentFile,
      message: 'Vue3 文件模板创建成功！',
    }, logger)
  );

  registerFolderCommand(context, 'extension.createdHtml', (resource) =>
    createAndOpen(resource, {
      prompt: '请输入 HTML 文件模板名称',
      defaultName: 'page',
      extension: '.html',
      content: createdHtml.containerFile,
      message: 'HTML 文件模板创建成功！',
    }, logger)
  );

  registerFolderCommand(context, 'extension.createdPinia', (resource) =>
    createAndOpen(resource, {
      prompt: '请输入 Pinia 文件模板名称',
      defaultName: 'pinia_module',
      extension: '.js',
      content: createdPinia.moduleFile,
      message: 'Pinia 文件模板创建成功！',
    }, logger)
  );

  registerFolderCommand(context, 'extension.createdVuex', (resource) =>
    createAndOpen(resource, {
      prompt: '请输入 Vuex 文件模板名称',
      defaultName: 'vuex_module',
      extension: '.js',
      content: createdVuex.moduleFile,
      message: 'Vuex 文件模板创建成功！',
    }, logger)
  );

  registerFolderCommand(context, 'extension.createdService', (resource) =>
    createAndOpen(resource, {
      prompt: '请输入 Service 文件模板名称',
      defaultName: 'service_module',
      extension: '.js',
      content: createdService.serviceFile,
      message: 'Service 文件模板创建成功！',
    }, logger)
  );
}

module.exports = { register };
