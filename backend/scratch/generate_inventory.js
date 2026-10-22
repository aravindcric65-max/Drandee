const fs = require('fs');

const data = require('./audit_report.json');

const classes = {
  PUBLIC: 0,
  AUTHENTICATED: 0,
  OWNER_ONLY: 0,
  CREATOR: 0,
  MODERATOR: 0,
  ADMIN: 0,
  SYSTEM: 0,
  UNKNOWN: 0
};

data.forEach(r => {
  if (classes[r.classification] !== undefined) {
    classes[r.classification]++;
  } else {
    classes['UNKNOWN']++;
  }
});

let md = `# Phase 2.5 Audit Report\n\n## ROUTE INVENTORY\n\n`;
md += `Total routes: ${data.length}\n`;
Object.entries(classes).forEach(([key, val]) => {
  md += `${key}: ${val}\n`;
});

md += `\n### Detailed List\n`;
md += `| File | Method | Endpoint | Classification | Auth | Role Req |\n`;
md += `|---|---|---|---|---|---|\n`;

data.forEach(r => {
  const roleStr = r.roleReq ? r.roleReq.join(',') : 'none';
  md += `| ${r.file} | ${r.method} | ${r.endpoint} | ${r.classification} | ${r.isAuth} | ${roleStr} |\n`;
});

fs.writeFileSync('phase2_5_audit.md', md);
console.log('Generated phase2_5_audit.md');
