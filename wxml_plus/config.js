"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const vscode_1 = require("vscode");
const { readSetting } = require('../util/settings');
let listener;
exports.config = {
    activeColor: {},
    // cache: false,
    // onSaveFormat: false,
    activeDisable: false,
    tagNoActiveArr: [],
};
function getConfig(e) {
    if (e && !e.affectsConfiguration('freedomCode'))
        return;
    // 必须用根配置 + 全键：readSetting 内部走 inspect()，
    // 若先 getConfiguration('freedomCode') 再传全键会变成 freedomCode.freedomCode.x，读不到显式值
    const wxml = vscode_1.workspace.getConfiguration();
    // 键名已改为驼峰；旧连字符键仍会被读取（见 util/settings.js）
    exports.config.activeColor = readSetting(wxml, ['freedomCode.wxmlActiveColor', 'freedomCode.wxml-activeColor'], {});
    exports.config.activeDisable = readSetting(wxml, ['freedomCode.wxmlActiveDisable', 'freedomCode.wxml-activeDisable'], false);
    exports.config.tagNoActiveArr = readSetting(wxml, ['freedomCode.wxmlTagNoActiveArr', 'freedomCode.wxml-tagNoActiveArr'], []);
    // exports.config.onSaveFormat = wxml.get('format-save-code', false);
    // exports.config.cache = false;
}
exports.getConfig = getConfig;
let pendingUpdate = null;
function configActivate(activeText) {
    listener = vscode_1.workspace.onDidChangeConfiguration((e) => {
        if (e && !e.affectsConfiguration('freedomCode'))
            return;
        getConfig(e);
        if (pendingUpdate) {
            clearTimeout(pendingUpdate);
        }
        pendingUpdate = setTimeout(() => {
            pendingUpdate = null;
            activeText.onChange(vscode_1.window.activeTextEditor, true);
        }, 500);
    });
}
exports.configActivate = configActivate;
function configDeactivate() {
    if (pendingUpdate) {
        clearTimeout(pendingUpdate);
        pendingUpdate = null;
    }
    if (listener) {
        listener.dispose();
        listener = null;
    }
}
exports.configDeactivate = configDeactivate;