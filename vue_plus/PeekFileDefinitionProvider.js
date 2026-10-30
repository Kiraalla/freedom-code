"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");

/**
 * Vue 组件名 → 文件的定义跳转。
 * 跳转源是编辑器里随手选中的词，可能不含任何单词字符（如 `-`、`$`），
 * 所以词提取与候选名生成都必须能空着返回。
 */
class PeekFileDefinitionProvider {
    constructor(targetFileExtensions = []) {
        this.targetFileExtensions = [];
        this.targetFileExtensions = targetFileExtensions;
        this.searchFilePath = this.searchFilePath.bind(this);
    }

    getComponentName(position, document) {
        const doc = document || (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document);
        if (!doc) {
            return [];
        }

        const selection = doc.getWordRangeAtPosition(position);
        if (!selection) {
            return [];
        }

        const selectedText = doc.getText(selection);
        const words = selectedText.match(/\w+/g);
        if (!words || words.length === 0) {
            return [];
        }

        const altName = words
            .map((str) => str[0].toUpperCase() + str.substring(1))
            .join("");

        let possibleFileNames = [];
        this.targetFileExtensions.forEach(ext => {
            possibleFileNames.push(selectedText + ext);
            possibleFileNames.push(selectedText + '/index' + ext);
            possibleFileNames.push(altName + ext);
            possibleFileNames.push(altName + '/index' + ext);
        });
        return possibleFileNames;
    }

    searchFilePath(fileName) {
        return vscode.workspace.findFiles(`**/${fileName}`, '**/node_modules'); // Returns promise
    }

    provideDefinition(document, position) {
        const componentNames = this.getComponentName(position, document);

        if (!componentNames.length) {
            return Promise.resolve(undefined);
        }

        const searchPromises = Promise.all(componentNames.map(this.searchFilePath));

        return searchPromises.then((paths) => {
            // findFiles 返回的已经是 vscode.Uri；此前对 Uri.path 再走一次
            // Uri.file() 会在 Windows 上产生 /c%3A/... 双重编码，跳转失效。
            const filePaths = [].concat.apply([], paths);

            if (!filePaths.length) {
                return undefined;
            }

            return filePaths.map((filePath) => new vscode.Location(filePath, new vscode.Position(0, 1)));
        }, () => {
            return undefined;
        });
    }
}

module.exports = PeekFileDefinitionProvider;
module.exports.default = PeekFileDefinitionProvider;
