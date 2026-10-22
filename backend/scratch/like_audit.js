require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function auditDatabase() {
  const findings = [];
  
  // Tables and Columns
  const cols = await pool.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND (column_name ILIKE '%like%' OR table_name ILIKE '%like%')
  `);
  
  cols.rows.forEach(r => findings.push(`DB Column/Table: ${r.table_name}.${r.column_name}`));
  
  // Foreign Keys and Indexes
  const constraints = await pool.query(`
    SELECT conname 
    FROM pg_constraint 
    WHERE conname ILIKE '%like%'
  `);
  
  constraints.rows.forEach(r => findings.push(`DB Constraint: ${r.conname}`));

  const indexes = await pool.query(`
    SELECT indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname ILIKE '%like%'
  `);

  indexes.rows.forEach(r => findings.push(`DB Index: ${r.indexname}`));

  return findings;
}

function scanDirectory(dir, findings) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'scratch') {
        scanDirectory(fullPath, findings);
      }
    } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.sql')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (line.toLowerCase().match(/(?<![_a-z])(like|likes|liked)(?![_a-z])/i) || line.toLowerCase().includes('like')) {
          // ignore common false positives like "likely"
          if (!line.toLowerCase().includes('likely') && !line.toLowerCase().includes('unlike')) {
             findings.push(`Codebase [${fullPath}]:${i+1} -> ${line.trim().substring(0, 80)}`);
          }
        }
      });
    }
  }
}

async function run() {
  console.log("Starting Like Dependency Audit...");
  const dbFindings = await auditDatabase();
  console.log("\\n--- DATABASE FINDINGS ---");
  dbFindings.forEach(f => console.log(f));
  
  const codeFindings = [];
  scanDirectory(path.join(__dirname, '../..'), codeFindings);
  
  console.log("\\n--- CODEBASE FINDINGS ---");
  codeFindings.forEach(f => console.log(f));
  console.log(`Total DB Findings: ${dbFindings.length}`);
  console.log(`Total Code Findings: ${codeFindings.length}`);
  process.exit(0);
}

run();
