const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const msModule = require('magic-string');
const MagicString = msModule.default || msModule;

const routesDir = path.join(__dirname, '../routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

function walk(node, visitor) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (let n of node) walk(n, visitor);
    return;
  }
  visitor(node);
  for (let key in node) {
    if (key === 'parent') continue;
    if (typeof node[key] === 'object') {
      walk(node[key], visitor);
    }
  }
}

let modifiedCount = 0;

for (const file of files) {
  const filePath = path.join(routesDir, file);
  const code = fs.readFileSync(filePath, 'utf-8');
  const ms = new MagicString(code);
  let ast;
  
  try {
    ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module' });
  } catch (err) {
    console.error(`Failed to parse ${file}: ${err.message}`);
    continue;
  }

  let fileModified = false;

  walk(ast, (node) => {
    // Replace `req.user.id` -> `req.auth.userId`
    if (node.type === 'MemberExpression' && node.object.type === 'MemberExpression') {
      if (node.object.object.name === 'req' && node.object.property.name === 'user' && node.property.name === 'id') {
        ms.overwrite(node.start, node.end, 'req.auth.userId');
        fileModified = true;
      }
    }
    
    // Replace `req.user.role` -> `req.auth.role`
    if (node.type === 'MemberExpression' && node.object.type === 'MemberExpression') {
      if (node.object.object.name === 'req' && node.object.property.name === 'user' && node.property.name === 'role') {
        ms.overwrite(node.start, node.end, 'req.auth.role');
        fileModified = true;
      }
    }

    // Replace `const { id: userId } = req.user;`
    // This looks like a VariableDeclarator with ObjectPattern
    if (node.type === 'VariableDeclarator' && node.id.type === 'ObjectPattern' && node.init && node.init.type === 'MemberExpression') {
      if (node.init.object.name === 'req' && node.init.property.name === 'user') {
        const props = node.id.properties;
        if (props.length === 1 && props[0].key.name === 'id' && props[0].value.name === 'userId') {
          // It's exactly `const { id: userId } = req.user`
          ms.overwrite(node.start, node.end, 'userId = req.auth.userId');
          fileModified = true;
        }
      }
    }
    
    // Replace `const userId = req.user.id;` -> covered by the MemberExpression rule, but wait, `req.user.id` rewrite takes care of the right side!
    
    // Remove explicitly bad req.body.user_id if used as actor identity (Needs careful manual review, we won't blindly auto-replace req.body.user_id for now as user requested)
  });

  if (fileModified) {
    fs.writeFileSync(filePath, ms.toString());
    modifiedCount++;
    console.log(`Modified ${file}`);
  }
}

console.log(`AST Modifier complete. Updated ${modifiedCount} files.`);
