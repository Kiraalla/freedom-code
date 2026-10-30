'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { readSetting, isExplicitlySet } = require('../../util/settings');

/** 构造一个假的 getConfiguration() 结果 */
function fakeConfiguration(values) {
  return {
    inspect(key) {
      if (!(key in values)) {
        return {
          key,
          defaultValue: undefined,
          globalValue: undefined,
          workspaceValue: undefined,
          workspaceFolderValue: undefined,
        };
      }
      return {
        key,
        defaultValue: undefined,
        globalValue: values[key],
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      };
    },
  };
}

const KEYS = ['freedomCode.scssAutoCompile', 'freedomCode.scss-compact-autoCompile'];

test('readSetting: 新键被显式设置时用新键', () => {
  const configuration = fakeConfiguration({
    'freedomCode.scssAutoCompile': false,
    'freedomCode.scss-compact-autoCompile': true,
  });
  assert.equal(readSetting(configuration, KEYS, true), false);
});

test('readSetting: 只设置了旧键时回退到旧键（关键：默认值不能挡住旧键）', () => {
  const configuration = fakeConfiguration({
    'freedomCode.scss-compact-autoCompile': true,
  });
  assert.equal(readSetting(configuration, KEYS, false), true);
});

test('readSetting: 都没设置时用 fallback', () => {
  assert.equal(readSetting(fakeConfiguration({}), KEYS, false), false);
});

test('readSetting: 显式 false 不能被当成"未设置"', () => {
  const configuration = fakeConfiguration({ 'freedomCode.scssAutoCompile': false });
  assert.equal(readSetting(configuration, KEYS, true), false);
});

test('readSetting: 工作区文件夹级的值优先于用户级', () => {
  const configuration = {
    inspect: () => ({
      defaultValue: 2,
      globalValue: 4,
      workspaceValue: 6,
      workspaceFolderValue: 8,
    }),
  };
  assert.equal(readSetting(configuration, ['freedomCode.x'], 2), 8);
});

test('readSetting: 数组与对象值原样返回', () => {
  const configuration = fakeConfiguration({
    'freedomCode.wxmlTagNoActiveArr': ['view', 'text'],
  });
  assert.deepEqual(readSetting(configuration, ['freedomCode.wxmlTagNoActiveArr'], []), ['view', 'text']);
});

test('readSetting: inspect 缺失时安全返回 fallback', () => {
  assert.equal(readSetting({ inspect: () => undefined }, KEYS, 'same'), 'same');
});

test('isExplicitlySet: 区分"用户设置过"与"只有默认值"', () => {
  assert.equal(isExplicitlySet(fakeConfiguration({}), 'freedomCode.formatOnSave'), false);
  assert.equal(
    isExplicitlySet(fakeConfiguration({ 'freedomCode.formatOnSave': true }), 'freedomCode.formatOnSave'),
    true,
  );
});
