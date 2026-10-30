const path = require('path')
const fs = require('fs')

const appFile = 'app.json'

/**
 * 向上查找包含 app.json 的小程序根目录。
 * 到达盘符根仍找不到时返回 null —— 递归版本会在根目录无限自调用直至栈溢出。
 * @param {string} filePath
 * @returns {string|null}
 */
module.exports = function findRootPath(filePath) {
  let dir = path.dirname(filePath)

  while (true) {
    let files
    try {
      files = fs.readdirSync(dir)
    } catch (error) {
      return null
    }

    if (files.includes(appFile)) {
      return dir
    }

    const parent = path.dirname(dir)
    if (parent === dir) {
      return null
    }
    dir = parent
  }
}
