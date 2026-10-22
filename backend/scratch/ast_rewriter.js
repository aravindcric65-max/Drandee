const fs = require('fs');
const acorn = require('acorn');

const code = fs.readFileSync('../routes/profile.js', 'utf-8');
const ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module' });
const modifications = [];

function walk(node) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (let n of node) walk(n);
    return;
  }
  
  if (node.type === 'MemberExpression') {
    if (node.object.name === 'req' && node.property.name === 'user') {
      // It's `req.user`
      // Are we looking at `req.user.id`?
      let parent = null; // Need to track parent to see if it's .id
    }
  }

  for (let key in node) {
    if (key === 'parent') continue;
    if (typeof node[key] === 'object') {
      walk(node[key]);
    }
  }
}
