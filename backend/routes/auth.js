const express = require("express");
const { getAuth } = require("../config/firebase");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many login attempts. Try again later",
  },
});

function cleanUser(user) {
  let interestsArray = [];
  if (user.interests) {
    try {
      interestsArray = typeof user.interests === 'string' ? JSON.parse(user.interests) : user.interests;
    } catch (e) {}
  }
  
  return {
    id: user.id,
    name: user.name,
    username: user.username || "",
    email: user.email,
    role: user.role || "audience",
    bio: user.bio || "",
    profilePic: user.profile_pic || null,
    respects: user.respects || 0,
    level: user.level || 1,
    tier: user.tier || "free",
    onboardingCompleted: Boolean(user.onboarding_completed),
    interests: interestsArray
  };
}

router.post("/firebase-login", loginLimiter, async (req, res) => {
  try {
    const pool = req.app.get("db");
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "No token provided" });
    }
    
    const token = authHeader.split(" ")[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (err) {
      console.error("Firebase token verification failed:", err);
      return res.status(401).json({ success: false, error: "Invalid Firebase token" });
    }
    
    const { uid, email, name, picture } = decodedToken;
    const clientName = req.body.displayName || name || "User";
    const clientPic = req.body.photoURL || picture || null;
    
    // Check if user exists by firebase_uid EXCLUSIVELY
    let userResult = await pool.query("SELECT * FROM users WHERE firebase_uid = $1 LIMIT 1", [uid]);
    
    if (userResult.rows.length > 0) {
      let user = userResult.rows[0];
      
      // Log successful login
      await pool.query(
        "INSERT INTO login_history (user_id, provider, status) VALUES ($1, $2, $3)", 
        [user.id, 'FIREBASE', 'SUCCESS']
      );

      return res.json({ success: true, user: cleanUser(user) });
    } else {
      // Create new user
      
      // Generate collision-safe username
      let baseUsername = "";
      if (email) {
        baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      }
      
      if (!baseUsername) {
        baseUsername = 'user';
      }

      // Generate a short 6-char random suffix (using Math.random for simplicity, or crypto)
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      let uniqueUsername = `${baseUsername}_${randomSuffix}`;
      
      let isUnique = false;
      let counter = 1;
      while (!isUnique) {
        const check = await pool.query("SELECT id FROM users WHERE username = $1", [uniqueUsername]);
        if (check.rows.length === 0) {
          isUnique = true;
        } else {
          uniqueUsername = `${baseUsername}_${randomSuffix}${counter}`;
          counter++;
        }
      }
      
      const insertResult = await pool.query(`
        INSERT INTO users (name, email, username, firebase_uid, role, profile_pic, account_status) 
        VALUES ($1, $2, $3, $4, 'USER', $5, 'ACTIVE') RETURNING *
      `, [clientName, email || null, uniqueUsername, uid, clientPic]);
      
      const newUser = insertResult.rows[0];

      // Log registration
      await pool.query(
        "INSERT INTO login_history (user_id, provider, status) VALUES ($1, $2, $3)", 
        [newUser.id, 'FIREBASE', 'REGISTERED']
      );

      return res.status(201).json({ success: true, user: cleanUser(newUser) });
    }
  } catch (err) {
    console.error("Firebase login error:", err);
    return res.status(500).json({ success: false, error: "Server error during login" });
  }
});

module.exports = router;