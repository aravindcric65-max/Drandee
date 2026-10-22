const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const msModule = require('magic-string');
const MagicString = msModule.default || msModule;

const routesDir = path.join(__dirname, '../routes');

function processFile(filename, roles) {
  const filePath = path.join(routesDir, filename);
  if (!fs.existsSync(filePath)) return;
  const code = fs.readFileSync(filePath, 'utf-8');
  const ms = new MagicString(code);
  let ast;
  
  try {
    ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module' });
  } catch (err) {
    console.error(`Failed to parse ${filename}: ${err.message}`);
    return;
  }

  let needsRequireRoleImport = true;
  let fileModified = false;

  function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) {
      for (let n of node) walk(n);
      return;
    }
    
    if (node.type === 'CallExpression' && node.callee.name === 'require') {
      if (node.arguments[0] && node.arguments[0].value && node.arguments[0].value.includes('middleware/role')) {
        needsRequireRoleImport = false;
      }
    }

    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
      const objName = node.callee.object.name;
      const propName = node.callee.property.name;
      
      if ((objName === 'router' || objName === 'app') && ['get', 'post', 'put', 'patch', 'delete'].includes(propName)) {
        // Find authMiddleware
        let authIdx = -1;
        let roleIdx = -1;
        for (let i = 1; i < node.arguments.length - 1; i++) {
          const arg = node.arguments[i];
          if (arg.type === 'Identifier' && arg.name === 'authMiddleware') authIdx = i;
          if (arg.type === 'CallExpression' && arg.callee.name === 'requireRole') roleIdx = i;
        }

        if (authIdx !== -1 && roleIdx === -1) {
          const authArg = node.arguments[authIdx];
          const roleStr = roles.map(r => `'${r}'`).join(', ');
          ms.appendRight(authArg.end, `, requireRole(${roleStr})`);
          fileModified = true;
        }
      }
    }

    for (let key in node) {
      if (key === 'parent') continue;
      if (typeof node[key] === 'object') {
        walk(node[key]);
      }
    }
  }

  walk(ast);

  if (fileModified) {
    if (needsRequireRoleImport) {
      ms.prepend(`const requireRole = require("../middleware/role");\n`);
    }
    fs.writeFileSync(filePath, ms.toString());
    console.log(`Injected requireRole into ${filename}`);
  }
}

processFile('admin.js', ['ADMIN']);
processFile('reports.js', ['ADMIN', 'MODERATOR']);
processFile('abuse.js', ['ADMIN', 'MODERATOR']);
