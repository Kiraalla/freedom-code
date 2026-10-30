'use strict';

const vscode = require('vscode');

const FileCreator = require('../util/fileCreator');
const { registerFolderCommand } = require('./registry');
const { derivePageEntry } = require('../util/page-entry');

const createdWxPageJs = require('../template/wxjs-container');
const createdWxModuleJs = require('../template/wxjs-module');

/**
 * 把新建页面登记进 app.json（主包 pages 或对应分包的 pages）。
 * 写入前备份，写入失败时回滚；任何一步失败都只提示并返回，不抛异常给命令层。
 * @param {vscode.Uri} pageFolderUri 新建页面的目录
 * @param {object} logger
 */
async function addPageToAppJson(pageFolderUri, logger) {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      logger.warn('未找到工作区文件夹');
      return;
    }

    const workspaceFolderUri = workspaceFolders[0].uri;
    const appJsonUri = vscode.Uri.joinPath(workspaceFolderUri, 'app.json');

    let appJsonContent;
    try {
      appJsonContent = await vscode.workspace.fs.readFile(appJsonUri);
    } catch (readError) {
      vscode.window.showErrorMessage('未找到 app.json 文件，请确保在小程序项目根目录下');
      logger.error('读取 app.json 失败', readError);
      return;
    }

    const backupUri = vscode.Uri.joinPath(workspaceFolderUri, 'app.json.backup');
    try {
      await vscode.workspace.fs.writeFile(backupUri, appJsonContent);
      logger.debug('已创建 app.json 备份');
    } catch (backupError) {
      logger.warn('创建备份失败，继续执行', backupError);
    }

    let appJson;
    try {
      appJson = JSON.parse(appJsonContent.toString());
    } catch (parseError) {
      vscode.window.showErrorMessage('app.json 格式错误，请检查 JSON 语法');
      logger.error('解析 app.json 失败', parseError);
      return;
    }

    if (typeof appJson !== 'object' || appJson === null || Array.isArray(appJson)) {
      vscode.window.showErrorMessage('app.json 结构错误，根元素必须是对象');
      logger.error('app.json 结构验证失败');
      return;
    }

    // 页面路径必须读到 app.json 之后才能推导：分包判定依赖它自己的 subPackages
    const relativePath = vscode.workspace.asRelativePath(pageFolderUri);
    const subPackageRoots = (appJson.subPackages || [])
      .map((subPackage) => subPackage && subPackage.root)
      .filter(Boolean);
    const pageEntry = derivePageEntry(relativePath, subPackageRoots);

    let modified = false;

    if (pageEntry.kind === 'main') {
      // 主包页面
      if (!Array.isArray(appJson.pages)) {
        appJson.pages = [];
      }
      if (appJson.pages.includes(pageEntry.entry)) {
        vscode.window.showInformationMessage(`页面路径"${pageEntry.entry}"已存在于主包中`);
        return;
      }
      appJson.pages.push(pageEntry.entry);
      logger.info(`页面路径"${pageEntry.entry}"已添加到主包`);
      modified = true;
    } else {
      // 分包页面（pageEntry.root 是匹配到的 subPackages[].root）
      const targetSubPackage = (appJson.subPackages || []).find(
        (subPackage) => subPackage && subPackage.root === pageEntry.root
      );
      if (!targetSubPackage) {
        vscode.window.showWarningMessage(`未找到分包"${pageEntry.root}"，请先在 app.json 中配置该分包`);
        logger.warn(`未找到分包"${pageEntry.root}"`);
        return;
      }

      if (!Array.isArray(targetSubPackage.pages)) {
        targetSubPackage.pages = [];
      }
      if (targetSubPackage.pages.includes(pageEntry.entry)) {
        vscode.window.showInformationMessage(`分包"${pageEntry.root}"中已存在页面路径"${pageEntry.entry}"`);
        return;
      }
      targetSubPackage.pages.push(pageEntry.entry);
      logger.info(`页面路径"${pageEntry.entry}"已添加到分包"${pageEntry.root}"`);
      modified = true;
    }

    if (!modified) {
      return;
    }

    try {
      const newContent = JSON.stringify(appJson, null, 2);
      await vscode.workspace.fs.writeFile(appJsonUri, Buffer.from(newContent, 'utf8'));
      vscode.window.showInformationMessage(`路径"${pageEntry.entry}"已添加到 app.json 中`);
      logger.info('app.json 更新成功');

      try {
        await vscode.workspace.fs.delete(backupUri);
        logger.debug('已删除备份文件');
      } catch (deleteError) {
        logger.debug('删除备份文件失败（可忽略）', deleteError);
      }
    } catch (writeError) {
      vscode.window.showErrorMessage(`写入 app.json 失败: ${writeError.message}`);
      logger.error('写入 app.json 失败', writeError);

      try {
        await vscode.workspace.fs.writeFile(appJsonUri, appJsonContent);
        vscode.window.showInformationMessage('已从备份恢复 app.json');
        logger.info('已从备份恢复 app.json');
      } catch (restoreError) {
        vscode.window.showErrorMessage('恢复备份失败，请手动检查 app.json.backup 文件');
        logger.error('恢复备份失败', restoreError);
      }
    }
  } catch (error) {
    vscode.window.showErrorMessage(`更新 app.json 时发生未知错误: ${error.message}`);
    logger.error('更新 app.json 失败', error);
  }
}

/**
 * @param {vscode.ExtensionContext} context
 * @param {{ logger: object }} deps
 */
function register(context, deps) {
  const { logger } = deps;

  // 创建小程序组件
  registerFolderCommand(context, 'extension.createMiniappModule', async (resource) => {
    const componentName = await vscode.window.showInputBox({
      prompt: '请输入组件名称',
      placeHolder: '请输入组件名称',
    });

    if (!componentName) {
      vscode.window.showErrorMessage('组件名称不能为空！');
      return;
    }

    const wxmlContent = `<view class="wy-${componentName} {{customClass}}" style="{{customStyle}}">
  <!-- wy-${componentName}组件 -->
</view>`;

    const files = [
      { name: 'index.wxml', content: wxmlContent },
      { name: 'index.scss', content: '' },
      {
        name: 'index.json',
        content: {
          component: true,
          styleIsolation: 'apply-shared',
          usingComponents: {},
        },
      },
      { name: 'index.js', content: createdWxModuleJs.moduleFile },
    ];

    await FileCreator.createFolderWithFiles(
      resource,
      '请输入组件名称',
      componentName,
      files,
      '小程序组件模板创建成功！',
      logger
    );
  });

  // 创建小程序页面
  registerFolderCommand(context, 'extension.createMiniappPage', async (resource) => {
    const pageName = await vscode.window.showInputBox({
      prompt: '请输入页面名称',
      placeHolder: '请输入页面名称',
    });

    if (!pageName) {
      vscode.window.showErrorMessage('页面名称不能为空！');
      return;
    }

    const wxmlContent = `<view>
  <!-- ${pageName}页面 -->
</view>`;

    const files = [
      { name: 'index.wxml', content: wxmlContent },
      { name: 'index.scss', content: '' },
      {
        name: 'index.json',
        content: {
          navigationBarTitleText: '',
          usingComponents: {},
        },
      },
      { name: 'index.js', content: createdWxPageJs.containerFile },
    ];

    const folderUri = vscode.Uri.file(resource.fsPath);
    const pageFolderUri = vscode.Uri.joinPath(folderUri, pageName);

    const result = await FileCreator.createFolderWithFiles(
      resource,
      '请输入页面名称',
      pageName,
      files,
      '小程序页面模板创建成功！',
      logger
    );

    if (!result) {
      return;
    }

    await addPageToAppJson(pageFolderUri, logger);
  });
}

module.exports = { register };
