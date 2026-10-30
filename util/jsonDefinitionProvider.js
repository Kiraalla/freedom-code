const vscode = require('vscode')
const path = require('path')
const fs = require('fs')
const findRootPath = require('./findRootPath')

/**
 * app.json 里 usingComponents 的 `"path": "..."` 跳转到对应组件 JS。
 * 该提供器注册在所有 json 文件上，任意 JSON 的任意一行都会被问到，
 * 所以每一处取值都必须能安全失败（返回 null 而不是抛异常）。
 */
const provideDefinition = function(document, position) {
  try {
    const textLine = document.lineAt(position)
    const colonIndex = textLine.text.indexOf(':')

    if (colonIndex < 0) {
      return null
    }

    const rawPath = textLine.text.slice(colonIndex + 1).replace(/,|\s|'|"/gi, '')

    if (!rawPath) {
      return null
    }

    const filePath = document.fileName
    const rootPath = findRootPath(filePath)
    const baseDir = path.dirname(filePath)
    const textPath = `${rawPath}.js`

    let componentPath
    if (textPath.startsWith('/')) {
      // 为绝对路径时
      if (!rootPath) {
        return null
      }
      componentPath = path.join(rootPath, textPath)
    } else {
      // 为相对路径时
      componentPath = path.resolve(baseDir, textPath)
    }

    if (!componentPath || !fs.existsSync(componentPath)) {
      return null
    }

    return new vscode.Location(
      vscode.Uri.file(componentPath),
      new vscode.Position(0, 0),
    )
  } catch (error) {
    return null
  }
}

module.exports = {
  provideDefinition,
}
