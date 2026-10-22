/**
 * scratch/validate_loadtest_yaml.js
 * Phase 6 Step 3 — YAML syntax validation for all load-test files.
 * Runs without needing Artillery to be installed.
 * Uses the built-in 'node:fs' + a minimal YAML parser.
 * 
 * We use js-yaml which is already a transitive dep via many packages.
 * If not available, falls back to basic structural checks.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const LT_DIR = path.resolve(__dirname, '../load-tests');
const FILES = ['feed.yml', 'events.yml', 'health.yml'];

console.log('\n=== PHASE 6 STEP 3 — YAML SYNTAX VALIDATION ===\n');

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

// Try to load js-yaml (may be a transitive dep)
let yaml;
try {
  yaml = require('js-yaml');
} catch (_) {
  // Artillery bundles its own YAML parser — if js-yaml isn't in node_modules,
  // we do structural text checks instead.
  yaml = null;
  console.log('  ℹ️  js-yaml not found as direct dep — running structural text checks.\n');
}

for (const file of FILES) {
  const filePath = path.join(LT_DIR, file);

  check(`${file} — file exists`, () => {
    const exists = fs.existsSync(filePath);
    if (!exists) throw new Error(`File not found: ${filePath}`);
  });

  const content = fs.readFileSync(filePath, 'utf8');

  check(`${file} — non-empty`, () => {
    if (content.trim().length === 0) throw new Error('File is empty');
  });

  if (yaml) {
    check(`${file} — valid YAML parse`, () => {
      yaml.load(content); // throws if invalid
    });

    check(`${file} — has 'config' key`, () => {
      const doc = yaml.load(content);
      if (!doc.config) throw new Error("Missing top-level 'config' key");
    });

    check(`${file} — has 'scenarios' key`, () => {
      const doc = yaml.load(content);
      if (!doc.scenarios || !Array.isArray(doc.scenarios)) {
        throw new Error("Missing or invalid 'scenarios' array");
      }
    });

    check(`${file} — has environments: smoke, load, stress`, () => {
      const doc = yaml.load(content);
      const envs = doc.config && doc.config.environments;
      if (!envs) throw new Error("Missing 'config.environments'");
      if (!envs.smoke) throw new Error("Missing 'smoke' environment");
      if (!envs.load) throw new Error("Missing 'load' environment");
      if (!envs.stress) throw new Error("Missing 'stress' environment");
    });

    check(`${file} — target is safe localhost default (Artillery 2.x literal required)`, () => {
      const doc = yaml.load(content);
      const target = doc.config && doc.config.target;
      if (!target) throw new Error("Missing 'config.target'");
      // Artillery 2.x does NOT interpolate $processEnvironment in config.target.
      // Correct pattern: literal localhost default + --target CLI flag for override.
      if (target.includes('$processEnvironment')) {
        throw new Error(
          "config.target uses $processEnvironment — Artillery 2.x does NOT interpolate this field. " +
          "Use a literal URL and override with: artillery run --target $URL"
        );
      }
      // Must default to localhost (safe — never a production URL)
      if (!target.includes('localhost') && !target.includes('127.0.0.1')) {
        throw new Error(
          `config.target ('${target}') is not localhost — hard-coded non-local URLs are unsafe. ` +
          "Use http://localhost:<port> and override with --target for staging/production."
        );
      }
    });

    check(`${file} — auth token injected via $processEnvironment in scenario flow`, () => {
      // Auth must NOT be in config.defaults (would be a literal string).
      // It must appear in scenario flow step headers via $processEnvironment.
      const raw = content;
      const hasProcessEnvInFlow = raw.includes('$processEnvironment.LOAD_TEST_AUTH_TOKEN');
      // health.yml has no auth requirement — skip that check
      if (!hasProcessEnvInFlow && !file.includes('health')) {
        throw new Error(
          "No $processEnvironment.LOAD_TEST_AUTH_TOKEN found in scenario flow headers. " +
          "Auth token must be injected per-request, not hard-coded."
        );
      }
    });


    check(`${file} — no hard-coded secrets in scenarios`, () => {
      // Scan all flow values for common secret patterns
      const raw = JSON.stringify(yaml.load(content));
      const secretPatterns = [
        /eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/,  // JWT
        /sk_[a-zA-Z0-9]{20,}/,                                        // API key
        /password\s*:\s*["'][^$].*["']/,                              // plain password
      ];
      for (const pattern of secretPatterns) {
        if (pattern.test(raw)) {
          throw new Error(`Possible hard-coded secret detected matching: ${pattern}`);
        }
      }
    });

  } else {
    // Fallback structural text checks
    check(`${file} — contains 'config:'`, () => {
      if (!content.includes('config:')) throw new Error("Missing 'config:' block");
    });
    check(`${file} — contains 'scenarios:'`, () => {
      if (!content.includes('scenarios:')) throw new Error("Missing 'scenarios:' block");
    });
    check(`${file} — contains 'smoke' environment`, () => {
      if (!content.includes('smoke:')) throw new Error("Missing 'smoke:' environment");
    });
    check(`${file} — uses $processEnvironment`, () => {
      if (!content.includes('$processEnvironment')) {
        throw new Error("No $processEnvironment reference — secrets may be hard-coded");
      }
    });
  }

  console.log('');
}

// Summary
console.log('══════════════════════════════════════════');
if (failed === 0) {
  console.log(`✅ ALL ${passed} CHECKS PASSED — load-test YAML files are valid`);
  console.log('\nNext: Set env vars and run:');
  console.log('  npm run loadtest:smoke:health');
  console.log('  npm run loadtest:smoke:feed');
  console.log('  npm run loadtest:smoke:events');
} else {
  console.log(`⚠️  ${passed} passed, ${failed} FAILED`);
  process.exit(1);
}
