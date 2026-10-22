const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const msModule = require('magic-string');
const MagicString = msModule.default || msModule;

function cleanFile(filename) {
  const filePath = path.join(__dirname, '../routes', filename);
  if (!fs.existsSync(filePath)) return;
  const code = fs.readFileSync(filePath, 'utf-8');
  let ms = new MagicString(code);
  let ast;
  
  try {
    ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module' });
  } catch (err) {
    console.error(`Failed to parse ${filename}: ${err.message}`);
    return;
  }

  let fileModified = false;

  function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) {
      for (let n of node) walk(n);
      return;
    }
    
    // Find if statement: if (!isAdmin(req)) { return res.status(403)... }
    if (node.type === 'IfStatement' && node.test.type === 'UnaryExpression' && node.test.argument.type === 'CallExpression') {
      if (node.test.argument.callee.name === 'isAdmin') {
        ms.remove(node.start, node.end);
        fileModified = true;
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
  
  // Replace is_banned logic safely
  let str = ms.toString();
  if (str.includes('is_banned')) {
    str = str.replace(/is_banned = TRUE/g, "account_status = 'SUSPENDED'");
    str = str.replace(/is_banned/g, "account_status = 'SUSPENDED'"); // Some places just select is_banned
    fileModified = true;
  }

  if (fileModified) {
    fs.writeFileSync(filePath, str);
    console.log(`Cleaned ${filename}`);
  }
}

cleanFile('admin.js');
cleanFile('reports.js');
cleanFile('abuse.js');
