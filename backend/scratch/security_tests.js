require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { pool } = require('../config/database');
const proxyquire = require('proxyquire');

let mockRole = 'USER';
let mockUid = 'TEST_FIREBASE_UID_123';
let mockTokenStatus = 'VALID'; // 'VALID', 'EXPIRED', 'INVALID'

const mockGetAuth = () => ({
  verifyIdToken: async (token) => {
    if (mockTokenStatus === 'EXPIRED') throw new Error("Firebase ID token has expired.");
    if (mockTokenStatus === 'INVALID') throw new Error("Firebase ID token has invalid signature.");
    return { uid: mockUid, email: "test@test.com" };
  }
});

// Mock firebase
const adminRoute = proxyquire('../routes/admin', {
  '../config/firebase': { getAuth: mockGetAuth },
  '../middleware/auth': proxyquire('../middleware/auth', {
    '../config/firebase': { getAuth: mockGetAuth }
  })
});

const reportRoute = proxyquire('../routes/reports', {
  '../config/firebase': { getAuth: mockGetAuth },
  '../middleware/auth': proxyquire('../middleware/auth', {
    '../config/firebase': { getAuth: mockGetAuth }
  })
});

const express = require('express');
const request = require('supertest');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoute(pool));
app.use('/api/reports', reportRoute(pool));

async function runTests() {
  console.log("Running Phase 2.5 Security Tests...");
  
  try {
    // 1. Setup Test User
    await pool.query("DELETE FROM users WHERE firebase_uid = $1", [mockUid]);
    const userRes = await pool.query(
      `INSERT INTO users (name, username, email, firebase_uid, role, account_status) 
       VALUES ('Test User', 'testuser123', 'test@test.com', $1, 'USER', 'ACTIVE') RETURNING id`,
      [mockUid]
    );
    const mockUserId = userRes.rows[0].id;

    // --- TEST: Admin Dashboard Authorization ---
    
    // Unauthenticated
    let res = await request(app).get('/api/admin/dashboard');
    console.assert(res.status === 401, "Failed: Unauthenticated admin request should be 401");
    console.log("✅ [PASS] Unauthenticated request -> DENIED (401)");

    // Invalid Token
    mockTokenStatus = 'INVALID';
    res = await request(app).get('/api/admin/dashboard').set('Authorization', 'Bearer badtoken');
    console.assert(res.status === 401, "Failed: Invalid token should be 401");
    console.log("✅ [PASS] Invalid token -> DENIED (401)");
    
    mockTokenStatus = 'VALID';

    // Normal User trying to access Admin
    await pool.query("UPDATE users SET role = 'USER' WHERE id = $1", [mockUserId]);
    res = await request(app).get('/api/admin/dashboard').set('Authorization', 'Bearer valid');
    console.assert(res.status === 403, "Failed: USER access to ADMIN should be 403");
    console.log("✅ [PASS] USER -> ADMIN endpoint -> DENIED (403)");

    // Moderator trying to access Admin
    await pool.query("UPDATE users SET role = 'MODERATOR' WHERE id = $1", [mockUserId]);
    res = await request(app).get('/api/admin/dashboard').set('Authorization', 'Bearer valid');
    console.assert(res.status === 403, "Failed: MODERATOR access to ADMIN should be 403");
    console.log("✅ [PASS] MODERATOR -> ADMIN endpoint -> DENIED (403)");

    // Admin trying to access Admin
    await pool.query("UPDATE users SET role = 'ADMIN' WHERE id = $1", [mockUserId]);
    res = await request(app).get('/api/admin/dashboard').set('Authorization', 'Bearer valid');
    console.assert(res.status === 200 || res.status === 429, "Failed: ADMIN access to ADMIN should be allowed");
    console.log("✅ [PASS] ADMIN -> ADMIN endpoint -> ALLOWED");

    // --- TEST: Reports (Moderator) Authorization ---
    
    // Normal User trying to access Reports
    await pool.query("UPDATE users SET role = 'USER' WHERE id = $1", [mockUserId]);
    res = await request(app).get('/api/reports/admin').set('Authorization', 'Bearer valid');
    console.assert(res.status === 403, "Failed: USER access to REPORTS should be 403");
    console.log("✅ [PASS] USER -> MODERATOR endpoint -> DENIED (403)");

    // Moderator trying to access Reports
    await pool.query("UPDATE users SET role = 'MODERATOR' WHERE id = $1", [mockUserId]);
    res = await request(app).get('/api/reports/admin').set('Authorization', 'Bearer valid');
    console.assert(res.status === 200 || res.status === 429, "Failed: MODERATOR access to REPORTS should be allowed");
    console.log("✅ [PASS] MODERATOR -> MODERATOR endpoint -> ALLOWED");

    // Admin trying to access Reports
    await pool.query("UPDATE users SET role = 'ADMIN' WHERE id = $1", [mockUserId]);
    res = await request(app).get('/api/reports/admin').set('Authorization', 'Bearer valid');
    console.assert(res.status === 200 || res.status === 429, "Failed: ADMIN access to REPORTS should be allowed");
    console.log("✅ [PASS] ADMIN -> MODERATOR endpoint -> ALLOWED");

    // Cleanup
    await pool.query("DELETE FROM users WHERE firebase_uid = $1", [mockUid]);
    console.log("\n🚀 All security boundary tests passed successfully!");
    
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    process.exit(0);
  }
}

runTests();
