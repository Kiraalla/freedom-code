'use strict';

const vscode = require('vscode');

/**
 * 清单自检：扩展的**代码**和 VS Code 内存里的**清单**可能不一致。
 *
 * 典型场景：装完新版 VSIX 但没重载窗口 —— 扩展首次激活时会从磁盘加载新代码，
 * 而 VS Code 的扩展元数据（contributes）还是启动时扫到的旧版。结果是
 * 新功能能跑（代码是新的），新设置却在设置界面里不存在（清单是旧的）。
 *
 * 判据很硬：自己 package.json 里声明的每个设置，在 `inspect()` 里都必须能读到
 * `defaultValue`；读不到就说明清单没被加载。此时提示重载一次（按版本记标记）。
 */

const NOTICE_KEY = 'freedom-code.notice.reloadForManifest';

/**
 * 取出本扩展在磁盘上的清单里声明的所有设置键。
 * @returns {string[]}
 */
function declaredSettingKeys(extension) {
  const configuration = extension?.packageJSON?.contributes?.configuration;
  if (!configuration) return [];

  const entries = Array.isArray(configuration) ? configuration : [configuration];
  return entries.flatMap((entry) => Object.keys(entry?.properties || {}));
}

/**
 * @param {vscode.ExtensionContext} context
 * @param {{ logger: object }} deps
 */
async function checkManifestLoaded(context, deps) {
  const { logger } = deps;

  try {
    const extension = vscode.extensions.getExtension('Kiraalla.freedom-code');
    const declared = declaredSettingKeys(extension);
    if (declared.length === 0) {
      return;
    }

    const config = vscode.workspace.getConfiguration();
    const missing = declared.filter((key) => {
      const inspected = config.inspect(key);
      return !inspected || inspected.defaultValue === undefined;
    });

    if (missing.length === 0) {
      return;
    }

    logger.debug(`清单未生效，缺少 ${missing.length} 个设置的默认值: ${missing.slice(0, 3).join(', ')}…`);

    const version = extension?.packageJSON?.version || 'unknown';
    const notified = context.globalState.get(NOTICE_KEY);
    if (notified === version) {
      return;
    }
    await context.globalState.update(NOTICE_KEY, version);

    const reload = '重载窗口';
    const picked = await vscode.window.showWarningMessage(
      `Freedom Code 的设置未在 VS Code 中生效（扩展清单仍是旧版）：设置界面里会缺少 ${missing.length} 项。重载窗口即可恢复。`,
      reload,
    );

    if (picked === reload) {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  } catch (error) {
    logger.debug(`清单自检失败: ${error.message}`);
  }
}

module.exports = { checkManifestLoaded, declaredSettingKeys, NOTICE_KEY };
