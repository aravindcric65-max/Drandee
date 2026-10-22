const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

const testsToRun = [
  { name: 'Phase 4 Security Tests', file: 'security_tests.js', phase: '4' },
  { name: 'Phase 4 Middleware Tests', file: 'test_middlewares.js', phase: '4' },
  { name: 'Phase 4B Reports Tests', file: 'test_phase4b_reports.js', phase: '4B' },
  { name: 'Phase 5 View Tests', file: 'phase5_creator_view.js', phase: '5' },
  { name: 'Phase 5 Tests', file: 'test_phase5.js', phase: '5' },
  { name: 'Phase 6 Logging Tests', file: 'test_phase6_logging.js', phase: '6' },
  { name: 'Phase 6 Pool Tests', file: 'test_phase6_pool.js', phase: '6' },
  { name: 'Phase 6 Redis Tests', file: 'test_phase6_redis.js', phase: '6' },
  { name: 'Phase 6 BullMQ Tests', file: 'test_phase6_bullmq.js', phase: '6' },
  { name: 'Phase 6 Node Reliability', file: 'test_phase6_node_reliability.js', phase: '6' },
  { name: 'Phase 6 Health Tests', file: 'test_phase6_health.js', phase: '6' },
  { name: 'Phase 6 Failure Matrix Tests', file: 'test_phase6_failure_matrix.js', phase: '6' },
  { name: 'Phase 6 Algorithm Regression', file: 'test_phase6_algorithm_regression.js', phase: 'Algorithm' },
  { name: 'Phase 6 A/B Regression', file: 'test_phase6_ab_regression.js', phase: 'A/B' },
];

let totalPass = 0;
let totalFail = 0;
let totalBlocked = 0;
const results = {};

console.log(`\n${BOLD}=== PHASE 6 STEP 12 — FULL REGRESSION ===${RESET}\n`);

for (const t of testsToRun) {
  const fullPath = path.join(__dirname, t.file);
  console.log(`Running ${t.name} (${t.file})...`);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`  ${YELLOW}⚠️ BLOCKED (File missing)${RESET}`);
    results[t.name] = 'BLOCKED';
    totalBlocked++;
    continue;
  }

  try {
    const out = execSync(`node ${fullPath}`, { encoding: 'utf8', stdio: 'pipe', timeout: 5000 });
    
    // Parse output for PASS/FAIL/BLOCKED
    const passMatch = out.match(/(\d+) passed/);
    const failMatch = out.match(/(\d+) FAILED/);
    const blockedMatch = out.match(/(\d+) BLOCKED/);
    
    const p = passMatch ? parseInt(passMatch[1]) : (out.includes('ALL') ? 1 : 0);
    const f = failMatch ? parseInt(failMatch[1]) : 0;
    const b = blockedMatch ? parseInt(blockedMatch[1]) : 0;
    
    totalPass += p;
    totalFail += f;
    totalBlocked += b;
    
    if (f > 0) {
      console.log(`  ${RED}❌ FAILED${RESET} (${p} pass, ${f} fail, ${b} blocked)`);
      results[t.name] = 'FAIL';
    } else if (b > 0 && p === 0) {
      console.log(`  ${YELLOW}⚠️ BLOCKED${RESET} (${b} blocked)`);
      results[t.name] = 'BLOCKED';
    } else {
      console.log(`  ${GREEN}✅ PASS${RESET} (${p} pass, ${b} blocked)`);
      results[t.name] = 'PASS';
    }
  } catch (err) {
    // If command failed
    const out = err.stdout || '';
    const passMatch = out.match(/(\d+) passed/);
    const failMatch = out.match(/(\d+) FAILED/);
    const blockedMatch = out.match(/(\d+) BLOCKED/);
    
    const p = passMatch ? parseInt(passMatch[1]) : 0;
    const f = failMatch ? parseInt(failMatch[1]) : 1;
    const b = blockedMatch ? parseInt(blockedMatch[1]) : 0;
    
    totalPass += p;
    totalFail += f;
    totalBlocked += b;
    
    console.log(`  ${RED}❌ FAILED${RESET} (${p} pass, ${f} fail, ${b} blocked)`);
    results[t.name] = 'FAIL';
  }
}

console.log(`\n${'═'.repeat(54)}`);
console.log(`${BOLD}Regression Summary:${RESET}`);
console.log(`${GREEN}Total Pass: ${totalPass}${RESET}`);
console.log(`${RED}Total Fail: ${totalFail}${RESET}`);
console.log(`${YELLOW}Total Blocked: ${totalBlocked}${RESET}`);

if (totalFail > 0) {
  process.exit(1);
}
