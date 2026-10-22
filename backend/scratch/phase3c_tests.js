const request = require('supertest');
const app = require('../server');
const { pool } = require('../config/database');
const generateToken = require('../utils/generateToken');
const { dataExportQueue, accountDeletionQueue } = require('../worker/index');

async function runTests() {
  console.log('--- Running Phase 3C Security & Integration Tests ---');
  let testUser1Id, testUser1Token;
  
  try {
    // If TEST_ENV is local_mock, we bypass Firebase Admin strictly for the test suite by proxying the middleware
    if (process.env.TEST_ENV === 'local_mock') {
      console.log('⚠️ Running with Local Firebase Mock');
      app.use((req, res, next) => {
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer mock_')) {
          req.auth = { firebaseUid: 'export_firebase_123', userId: testUser1Id, role: 'USER', accountStatus: 'ACTIVE' };
          return next();
        }
        next();
      });
    }

    // Setup test users
    const userRes = await pool.query(
      `INSERT INTO users (email, username, firebase_uid, role) VALUES 
       ('export_test@drandee.com', 'export_test', 'export_firebase_123', 'USER') 
       RETURNING id`
    );
    testUser1Id = userRes.rows[0].id;
    testUser1Token = process.env.TEST_ENV === 'local_mock' ? 'mock_token_123' : 'UNAVAILABLE';

    console.log('Test User Created:', testUser1Id);

    // 1. Data Export Tests
    console.log('\\n[TEST] Requesting Data Export...');
    const exportRes = await request(app)
      .post('/api/data/export')
      .set('Authorization', `Bearer ${testUser1Token}`)
      .send();

    if (exportRes.status === 200 && exportRes.body.success) {
      console.log('✅ Export successfully queued:', exportRes.body.job.id);
    } else {
      console.error('❌ Failed to queue export:', exportRes.body);
    }

    // Check duplicate
    const dupRes = await request(app)
      .post('/api/data/export')
      .set('Authorization', `Bearer ${testUser1Token}`)
      .send();
    if (dupRes.status === 429) {
      console.log('✅ Duplicate export prevented.');
    } else {
      console.error('❌ Failed to prevent duplicate export.');
    }

    // 2. Account Deletion Tests
    console.log('\\n[TEST] Requesting Account Deletion...');
    const delRes = await request(app)
      .post('/api/data/deletion/request')
      .set('Authorization', `Bearer ${testUser1Token}`)
      .send();
    
    if (delRes.status === 200) {
      console.log('✅ Account deletion successfully scheduled.');
    } else {
      console.error('❌ Failed to schedule account deletion:', delRes.body);
    }

    // Cancellation
    const cancelRes = await request(app)
      .post('/api/data/deletion/cancel')
      .set('Authorization', `Bearer ${testUser1Token}`)
      .send();
      
    if (cancelRes.status === 200) {
      console.log('✅ Account deletion successfully cancelled.');
    } else {
      console.error('❌ Failed to cancel account deletion.');
    }
    
    console.log('\\n--- Tests Completed ---');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    // Cleanup
    if (testUser1Id) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUser1Id]);
    }
    // Close worker connections to exit cleanly
    await dataExportQueue.close();
    await accountDeletionQueue.close();
    process.exit(0);
  }
}

runTests();
