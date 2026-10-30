const path = require('path')
const fs = require('fs')
const findRootPath = require('./findRootPath')

const appFile = 'app.json'

/**
 * 读取并解析 JSON；文件缺失或内容损坏时返回 null。
 * 以前这里直接 JSON.parse(readFileSync(...))，wxml 没有同名 .json 是常态，
 * 异常会穿透到 DefinitionProvider / CompletionItemProvider。
 * @param {string} filePath
 * @returns {object|null}
 */
function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    return null
  }
}

const findComponentPath = function(doc, componentName) {
  try {
    const filePath = doc.fileName
    const rootPath = findRootPath(filePath)
    let baseDir = path.dirname(filePath)
    let configFile = path.join(
      baseDir,
      `${path.basename(filePath, '.wxml')}.json`,
    )
    let componentConfig = readJson(configFile)
    let componentPath

    // 页面无配置时，查找全局配置
    if (
      !componentConfig ||
      !componentConfig.usingComponents ||
      !componentConfig.usingComponents[componentName]
    ) {
      if (!rootPath) {
        return ''
      }
      configFile = path.join(rootPath, appFile)
      componentConfig = readJson(configFile) || {}
      baseDir = rootPath
    }

    if (
      componentConfig.usingComponents &&
      componentConfig.usingComponents[componentName]
    ) {
      componentPath = `${componentConfig.usingComponents[componentName]}.js`
    }

    if (!componentPath) {
      return ''
    }

    if (componentPath.startsWith('/')) {
      // 为绝对路径时
      componentPath = path.join(rootPath, componentPath)
    } else {
      // 为相对路径时
      componentPath = path.resolve(baseDir, componentPath)
    }

    return componentPath
  } catch (error) {
    return ''
  }
}

module.exports = findComponentPath
