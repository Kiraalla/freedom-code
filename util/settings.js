'use strict';

/**
 * 设置读取：支持"新名为主、旧名兼容"的迁移。
 *
 * 为什么不能用 get() 回退：新键在 package.json 里带默认值，get() 永远返回默认值，
 * 旧键就永远读不到。必须用 inspect() 取"用户是否显式设置过"。
 */

/**
 * 按优先级读取设置项，取第一个被显式设置的值。
 * @param {{ inspect: (key: string) => any }} configuration `vscode.workspace.getConfiguration(scope)`
 * @param {string[]} keys 从新到旧的完整键名（含 scope，如 'freedomCode.scssAutoCompile'）
 * @param {*} fallback 都没有显式设置时返回的值
 * @returns {*} 生效值
 */
function readSetting(configuration, keys, fallback) {
  for (const key of keys) {
    const explicit = explicitValue(configuration.inspect(key));
    if (explicit !== undefined) {
      return explicit;
    }
  }

  return fallback;
}

/**
 * 从 inspect() 的结果里取用户显式设置的值（用户 > 工作区 > 工作区文件夹）。
 * @param {{ globalValue?: any, workspaceValue?: any, workspaceFolderValue?: any } | undefined} inspected
 * @returns {*} 显式值，没有则为 undefined
 */
function explicitValue(inspected) {
  if (!inspected) {
    return undefined;
  }

  const candidates = [
    inspected.workspaceFolderValue,
    inspected.workspaceValue,
    inspected.globalValue,
  ];

  for (const value of candidates) {
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

/**
 * 判断某个键是否被用户显式设置过（用于一次性迁移提示）。
 * @param {{ inspect: (key: string) => any }} configuration
 * @param {string} key
 * @returns {boolean}
 */
function isExplicitlySet(configuration, key) {
  return explicitValue(configuration.inspect(key)) !== undefined;
}

module.exports = {
  readSetting,
  isExplicitlySet,
};
