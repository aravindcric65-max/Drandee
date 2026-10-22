const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

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

const inventory = [];

for (const file of files) {
  const filePath = path.join(routesDir, file);
  const code = fs.readFileSync(filePath, 'utf-8');
  let ast;
  try {
    ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module' });
  } catch (err) {
    console.error(`Failed to parse ${file}: ${err.message}`);
    continue;
  }

  walk(ast, (node) => {
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
      const objName = node.callee.object.name;
      const propName = node.callee.property.name;
      
      if ((objName === 'router' || objName === 'app') && ['get', 'post', 'put', 'patch', 'delete'].includes(propName)) {
        
        let endpoint = 'UNKNOWN';
        if (node.arguments[0] && (node.arguments[0].type === 'Literal' || node.arguments[0].type === 'TemplateLiteral')) {
          endpoint = node.arguments[0].value || (node.arguments[0].quasis && node.arguments[0].quasis[0].value.raw);
        }

        const method = propName.toUpperCase();
        
        // Check Middlewares
        let isAuth = false;
        let roleReq = null;
        for (let i = 1; i < node.arguments.length - 1; i++) {
          const arg = node.arguments[i];
          if (arg.type === 'Identifier' && arg.name === 'authMiddleware') isAuth = true;
          if (arg.type === 'CallExpression' && arg.callee.name === 'requireRole') {
            roleReq = arg.arguments.map(a => a.value);
          }
        }

        // Analyze Handler Body
        const handler = node.arguments[node.arguments.length - 1];
        let hasReqUser = false;
        let hasReqAuth = false;
        let hasBodyUserId = false;
        let hasParamsId = false;
        let hasDBUpdate = false;
        let hasDBDelete = false;

        walk(handler, (child) => {
          if (child.type === 'MemberExpression') {
            if (child.object.name === 'req' && child.property.name === 'user') hasReqUser = true;
            if (child.object.name === 'req' && child.property.name === 'auth') hasReqAuth = true;
            if (child.object.type === 'MemberExpression' && child.object.object && child.object.object.name === 'req' && child.object.property.name === 'body' && (child.property.name === 'user_id' || child.property.name === 'userId')) hasBodyUserId = true;
            if (child.object.type === 'MemberExpression' && child.object.object && child.object.object.name === 'req' && child.object.property.name === 'params' && (child.property.name === 'id' || child.property.name === 'userId')) hasParamsId = true;
          }
          if (child.type === 'TemplateLiteral' || child.type === 'Literal') {
            const val = child.value || (child.quasis && child.quasis[0].value.raw) || '';
            const upVal = typeof val === 'string' ? val.toUpperCase() : '';
            if (upVal.includes('UPDATE ') || upVal.includes('INSERT ')) hasDBUpdate = true;
            if (upVal.includes('DELETE FROM')) hasDBDelete = true;
          }
        });

        // Heuristic Classification
        let classification = 'UNKNOWN';
        if (!isAuth) {
           classification = 'PUBLIC';
        } else if (roleReq) {
           if (roleReq.includes('ADMIN')) classification = 'ADMIN';
           else if (roleReq.includes('MODERATOR')) classification = 'MODERATOR';
           else if (roleReq.includes('CREATOR')) classification = 'CREATOR';
           else classification = 'AUTHENTICATED';
        } else {
           if (hasDBUpdate || hasDBDelete || hasParamsId || hasReqUser || hasReqAuth) {
             classification = 'OWNER_ONLY'; // Needs manual verification
           } else {
             classification = 'AUTHENTICATED';
           }
        }

        inventory.push({
          file,
          method,
          endpoint,
          classification,
          isAuth,
          roleReq,
          hasReqUser,
          hasReqAuth,
          hasBodyUserId,
          hasParamsId,
          hasDBUpdate,
          hasDBDelete
        });
      }
    }
  });
}

fs.writeFileSync(path.join(__dirname, 'audit_report.json'), JSON.stringify(inventory, null, 2));
console.log(`Scan complete. Found ${inventory.length} routes.`);
