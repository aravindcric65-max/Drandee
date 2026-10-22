const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '../routes/settings.js');
let code = fs.readFileSync(settingsPath, 'utf8');

// Insert Providers endpoints before the module export or at the end of the router definition
const providersCode = `

  /*
   * GET /api/settings/providers - Get linked auth providers
   */
  router.get("/providers", authMiddleware, async (req, res) => {
    try {
      const admin = require('firebase-admin');
      
      // Get the Firebase UID for the current user from our DB
      const userResult = await pool.query('SELECT firebase_uid FROM users WHERE id = $1', [req.user.id]);
      if (userResult.rows.length === 0) return res.status(404).json({ error: "User not found" });
      
      const firebaseUid = userResult.rows[0].firebase_uid;
      const userRecord = await admin.auth().getUser(firebaseUid);
      
      const providers = userRecord.providerData.map(p => p.providerId);
      
      return res.json({ success: true, providers });
    } catch (err) {
      console.error("Get providers error:", err.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  });

  /*
   * DELETE /api/settings/providers/:providerId - Unlink a provider
   */
  router.delete("/providers/:providerId", authMiddleware, async (req, res) => {
    try {
      const admin = require('firebase-admin');
      const providerId = req.params.providerId;
      
      const userResult = await pool.query('SELECT firebase_uid FROM users WHERE id = $1', [req.user.id]);
      const firebaseUid = userResult.rows[0].firebase_uid;
      
      const userRecord = await admin.auth().getUser(firebaseUid);
      
      if (userRecord.providerData.length <= 1) {
        return res.status(400).json({ success: false, error: "Cannot remove the only authentication provider." });
      }

      const updatedUser = await admin.auth().unlinkProvider(firebaseUid, [providerId]);
      
      await pool.query(
        "INSERT INTO login_history (user_id, provider, status) VALUES ($1, $2, $3)", 
        [req.user.id, providerId, 'UNLINKED']
      );

      return res.json({ success: true, providers: updatedUser.providerData.map(p => p.providerId) });
    } catch (err) {
      console.error("Unlink provider error:", err.message);
      return res.status(500).json({ success: false, error: "Failed to unlink provider" });
    }
  });

`;

if (!code.includes('/api/settings/providers')) {
  code = code.replace(/return router;\s*\}\s*$/g, `${providersCode}\n  return router;\n}`);
  
  // If the file exports module.exports = (pool) => { ... } without 'return router;' explicitly at the end, 
  // I need to be careful. Let's just append it before `  return router;` 
  const lines = code.split('\n');
  const returnRouterIndex = lines.findIndex(l => l.includes('return router;'));
  if (returnRouterIndex !== -1) {
    lines.splice(returnRouterIndex, 0, providersCode);
    fs.writeFileSync(settingsPath, lines.join('\n'));
    console.log("Added provider routes to settings.js");
  } else {
    // maybe it just ends with `  });\n}`
    fs.writeFileSync(settingsPath, code.substring(0, code.lastIndexOf('}')) + providersCode + '}');
    console.log("Appended provider routes to end of settings.js");
  }
}
