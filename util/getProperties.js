const recast = require('recast');
const fs = require('fs');

function getProperties(filePath) {
  // 组件代码千奇百怪（键写法、现代语法、路径失效）：解析失败时静默退化为
  // "无补全项"，不能让异常穿透到 CompletionItemProvider 打断用户输入。
  try {
    return collectProperties(filePath);
  } catch (error) {
    return [];
  }
}

function collectProperties(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const ast = recast.parse(code);
  const events = [];
  let result = [];

  recast.visit(ast, {
    visitCallExpression(path) {
      const { node } = path;

      // 获取属性集合
      if (node.callee.name === 'Component') {
        const [argument] = node.arguments;

        if (argument) {
          const { type, properties, name } = argument;

          if (type === 'ObjectExpression') {
            result = findProperties(properties);
          } else if (type === 'Identifier') {
            const properties = findVariableDeclarator(ast, name);
            result = findProperties(properties);
          }
        }
      }

      // 获取事件集合
      if (
        node.callee.type === 'MemberExpression' &&
        node.callee.property.type === 'Identifier' &&
        node.callee.property.name === 'triggerEvent'
      ) {
        const [eventName] = node.arguments;
        const documentation = recast.print(node).code;

        if (eventName) {
          events.push({
            name: `bind:${eventName.value}`,
            documentation,
            insertText: `bind:${eventName.value}="$1"`,
          });
        }
      }

      // return false; // 停止遍历
      this.traverse(path); // 继续遍历
    },
  });

  return result.concat(events);
}

function findVariableDeclarator(ast, name) {
  let result;

  recast.visit(ast, {
    visitVariableDeclarator(path) {
      const { node } = path;

      if (node.id.name === name && node.init.type === 'ObjectExpression') {
        result = node.init.properties;
        return false; // 停止遍历
      }

      this.traverse(path); // 继续遍历
    },
  });

  return result;
}

function findProperties(properties) {
  if (!Array.isArray(properties)) {
    return [];
  }

  for (let i = 0, item; (item = properties[i++]); ) {
    if (
      item.key &&
      item.key.name === 'properties' &&
      item.value &&
      Array.isArray(item.value.properties)
    ) {
      return item.value.properties
        .filter((property) => property.key && property.key.name)
        .map((property) => ({
          name: property.key.name, // 属性名
          documentation: recast.print(property).code, // 说明
          insertText: `${property.key.name}="{{$1}}"`,
        }));
    }
  }

  return [];
}

module.exports = getProperties;
