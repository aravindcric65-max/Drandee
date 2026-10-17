const { Redis } = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const WINDOWS = {
  ONE_MIN: 60 * 1000,
  FIVE_MIN: 5 * 60 * 1000,
  FIFTEEN_MIN: 15 * 60 * 1000,
};

const ACTION_WEIGHTS = {
  watch: 1.0,
  scroll: 0.3,
  respect: 1.5,
  save: 2.0,
  share: 3.0,
  comment: 2.5,
  follow: 2.0,
};

// Rate limiting config - NEW!
const RATE_LIMITS = {
  MAX_ACTIONS_PER_MINUTE: 100,
  MAX_SESSIONS_PER_USER: 5,
};

// Session cleanup interval - NEW!
const SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 mins
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 mins

class VelocityTracker {
  constructor(pool) {
    this.pool = pool;
    this.userSessions = new Map();
    
    // Start background cleanup - NEW!
    this.startSessionCleanup();
    
    // Start batch persist - NEW!
    this.startBatchPersist();
  }

  // Background session cleanup - NEW!
  startSessionCleanup() {
    setInterval(() => {
      const now = Date.now();
      
      for (const [userId, session] of this.userSessions.entries()) {
        if (now - session.lastActiveAt > SESSION_TIMEOUT) {
          console.log(`Cleaning up inactive session for user ${userId}`);
          this.endSession(userId);
        }
      }
    }, SESSION_CLEANUP_INTERVAL);
  }

  // Background batch persist - NEW!
  startBatchPersist() {
    setInterval(async () => {
      for (const [userId, session] of this.userSessions.entries()) {
        if (session.lastActiveAt > Date.now() - 5 * 60 * 1000) {
          await this.persistSession(userId);
        }
      }
    }, 5 * 60 * 1000);
  }

  async startSession(userId, deviceId = 'default') {
    const sessionKey = `${userId}:${deviceId}`;
    
    // Check if session exists in Redis - NEW!
    const redisSession = await redis.get(`velocity:${sessionKey}:session`);
    
    if (redisSession) {
      const { sessionId, startedAt } = JSON.parse(redisSession);
      
      // Recover session - NEW!
      const session = {
        userId,
        deviceId,
        sessionId,
        startedAt,
        lastActiveAt: Date.now(),
        actions: [],
        scrolls: [],
        watches: [],
        interactions: [],
        dopamineScores: [],
      };
      
      this.userSessions.set(sessionKey, session);
      return sessionId;
    }
    
    // Check max sessions - NEW!
    const userSessionCount = Array.from(this.userSessions.keys())
      .filter(key => key.startsWith(`${userId}:`))
      .length;
    
    if (userSessionCount >= RATE_LIMITS.MAX_SESSIONS_PER_USER) {
      console.warn(`Max sessions reached for user ${userId}`);
      return null;
    }
    
    const sessionId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session = {
      userId,
      deviceId,
      sessionId,
      startedAt: Date.now(),
      lastActiveAt: Date.now(),
      actions: [],
      scrolls: [],
      watches: [],
      interactions: [],
      dopamineScores: [],
    };

    this.userSessions.set(sessionKey, session);

    await redis.setex(
      `velocity:${sessionKey}:session`,
      1800,
      JSON.stringify({
        sessionId,
        startedAt: session.startedAt,
        deviceId,
      })
    );

    return sessionId;
  }

  async trackAction(userId, actionType, metadata = {}, deviceId = 'default') {
    const sessionKey = `${userId}:${deviceId}`;
    const session = this.userSessions.get(sessionKey);
    
    if (!session) {
      // Auto-start session if not exists
      await this.startSession(userId, deviceId);
      return;
    }

    // Rate limiting check - NEW!
    const now = Date.now();
    const actions1min = session.actions.filter(a => now - a.timestamp < 60000);
    
    if (actions1min.length >= RATE_LIMITS.MAX_ACTIONS_PER_MINUTE) {
      console.warn(`Rate limit exceeded for user ${userId}`);
      return false;
    }

    const currentNow = Date.now();
    session.lastActiveAt = currentNow;

    session.actions.push({
      timestamp: currentNow,
      type: actionType,
      weight: ACTION_WEIGHTS[actionType] || 1.0,
      ...metadata,
    });

    if (actionType === 'scroll') {
      session.scrolls.push(currentNow);
    } else if (actionType === 'watch') {
      session.watches.push(currentNow);
    } else if (['respect', 'save', 'share', 'comment', 'follow'].includes(actionType)) {
      session.interactions.push(currentNow);
    }

    if (metadata.dopamineScore !== undefined) {
      session.dopamineScores.push({
        timestamp: currentNow,
        score: metadata.dopamineScore,
      });
    }

    const cutoff = currentNow - WINDOWS.FIFTEEN_MIN;
    session.actions = session.actions.filter(a => a.timestamp > cutoff);
    session.scrolls = session.scrolls.filter(t => t > cutoff);
    session.watches = session.watches.filter(t => t > cutoff);
    session.interactions = session.interactions.filter(t => t > cutoff);
    session.dopamineScores = session.dopamineScores.filter(d => d.timestamp > cutoff);

    await this._updateRedis(userId, session, deviceId);
    
    return true;
  }

  calculateVelocity(userId, deviceId = 'all') {
    // Multi-device support - NEW!
    if (deviceId === 'all') {
      const sessions = [];
      
      for (const [key, session] of this.userSessions.entries()) {
        if (key.startsWith(`${userId}:`)) {
          sessions.push(session);
        }
      }
      
      if (sessions.length === 0) {
        return { velocity: 0, intensity: 'low' };
      }
      
      // Merge sessions
      const merged = {
        actions: sessions.flatMap(s => s.actions),
        scrolls: sessions.flatMap(s => s.scrolls),
        watches: sessions.flatMap(s => s.watches),
        interactions: sessions.flatMap(s => s.interactions),
        dopamineScores: sessions.flatMap(s => s.dopamineScores),
        startedAt: Math.min(...sessions.map(s => s.startedAt)),
        lastActiveAt: Math.max(...sessions.map(s => s.lastActiveAt)),
      };
      
      return this._calculateVelocityFromSession(merged);
    }
    
    const sessionKey = `${userId}:${deviceId}`;
    const session = this.userSessions.get(sessionKey);
    
    if (!session) {
      return { velocity: 0, intensity: 'low' };
    }
    
    return this._calculateVelocityFromSession(session);
  }

  _calculateVelocityFromSession(session) {
    const now = Date.now();

    const actions1min = session.actions.filter(a => now - a.timestamp < WINDOWS.ONE_MIN);
    const actions5min = session.actions.filter(a => now - a.timestamp < WINDOWS.FIVE_MIN);
    const actions15min = session.actions.filter(a => now - a.timestamp < WINDOWS.FIFTEEN_MIN);

    const weightedScore1min = actions1min.reduce((sum, a) => sum + a.weight, 0);
    const weightedScore5min = actions5min.reduce((sum, a) => sum + a.weight, 0) / 5;
    const weightedScore15min = actions15min.reduce((sum, a) => sum + a.weight, 0) / 15;

    const velocity = (weightedScore1min * 0.6) + (weightedScore5min * 0.3) + (weightedScore15min * 0.1);

    const scrollVelocity = session.scrolls.length / 15;
    const watchVelocity = session.watches.length / 15;
    const interactionVelocity = session.interactions.length / 15;

    let dopamineVelocity = 0;
    if (session.dopamineScores.length >= 2) {
      const recent = session.dopamineScores.slice(-5);
      const first = recent[0].score;
      const last = recent[recent.length - 1].score;
      const timeDiffMin = (last.timestamp - first.timestamp) / 60000;
      dopamineVelocity = timeDiffMin > 0 ? (last.score - first.score) / timeDiffMin : 0;
    }

    let intensity = 'low';
    if (velocity > 8) intensity = 'very_high';
    else if (velocity > 5) intensity = 'high';
    else if (velocity > 3) intensity = 'medium';

    const isHighlyEngaged = velocity > 5 && interactionVelocity > 0.5;
    const isAtRiskChurn = velocity < 1.5 && watchVelocity < 0.3 && session.actions.length > 10;

    return {
      velocity: parseFloat(velocity.toFixed(2)),
      velocity1min: parseFloat(weightedScore1min.toFixed(2)),
      velocity5min: parseFloat(weightedScore5min.toFixed(2)),
      velocity15min: parseFloat(weightedScore15min.toFixed(2)),
      scrollVelocity: parseFloat(scrollVelocity.toFixed(2)),
      watchVelocity: parseFloat(watchVelocity.toFixed(2)),
      interactionVelocity: parseFloat(interactionVelocity.toFixed(2)),
      dopamineVelocity: parseFloat(dopamineVelocity.toFixed(2)),
      intensity,
      isHighlyEngaged,
      isAtRiskChurn,
      actionsCount: session.actions.length,
      sessionDurationMin: Math.floor((now - session.startedAt) / 60000),
    };
  }

  getVelocityBoost(userId, post, deviceId = 'default') {
    const velocity = this.calculateVelocity(userId, deviceId);
    let boost = 0;

    if (velocity.intensity === 'very_high' || velocity.intensity === 'high') {
      if (post.totalRespects > 10000 && post.avgCompletionRate > 75) {
        boost += 200;
      }
      if (post.shares > 500) {
        boost += 150;
      }
      if (post.duration < 20000) {
        boost += 100;
      }
    } else if (velocity.intensity === 'low' && velocity.watchVelocity < 0.3) {
      if (post.avgCompletionRate > 85) {
        boost += 300;
      }
      if (post.saves / (post.watchCount + 1) > 0.15) {
        boost += 250;
      }
    }

    if (velocity.dopamineVelocity > 5) {
      boost += 150;
    } else if (velocity.dopamineVelocity < -5) {
      boost -= 100;
    }

    return boost;
  }

  async _updateRedis(userId, session, deviceId = 'default') {
    const sessionKey = `${userId}:${deviceId}`;
    const velocityData = this.calculateVelocity(userId, deviceId);
    
    await redis.setex(
      `velocity:${sessionKey}:data`,
      300,
      JSON.stringify({
        ...velocityData,
        lastActiveAt: session.lastActiveAt,
        deviceId,
      })
    );
  }

  async persistSession(userId, deviceId = 'default') {
    const sessionKey = `${userId}:${deviceId}`;
    const session = this.userSessions.get(sessionKey);
    
    if (!session) return;

    const velocity = this.calculateVelocity(userId, deviceId);

    try {
      await this.pool.query(
        `INSERT INTO user_velocity_sessions (
          user_id, session_id, device_id, started_at, last_active_at,
          actions_last_1min, actions_last_5min, actions_last_15min,
          scroll_velocity, watch_velocity, interaction_velocity,
          dopamine_velocity, total_watch_time_ms, videos_watched,
          interactions_count, is_highly_engaged, is_at_risk_churn
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (user_id, session_id, device_id) DO UPDATE SET
          last_active_at = $5,
          actions_last_1min = $6,
          actions_last_5min = $7,
          actions_last_15min = $8,
          scroll_velocity = $9,
          watch_velocity = $10,
          interaction_velocity = $11,
          dopamine_velocity = $12,
          is_highly_engaged = $15,
          is_at_risk_churn = $16`,
        [
          userId,
          session.sessionId,
          deviceId,
          new Date(session.startedAt),
          new Date(session.lastActiveAt),
          velocity.velocity1min,
          velocity.velocity5min,
          velocity.velocity15min,
          velocity.scrollVelocity,
          velocity.watchVelocity,
          velocity.interactionVelocity,
          velocity.dopamineVelocity,
          session.watches.reduce((sum, t, i, arr) => sum + (arr[i+1] ? arr[i+1] - t : 0), 0),
          session.watches.length,
          session.interactions.length,
          velocity.isHighlyEngaged,
          velocity.isAtRiskChurn,
        ]
      );

      await this.pool.query(
        `UPDATE users 
         SET 
           current_velocity_score = $1,
           peak_velocity_24h = CASE WHEN $1 > peak_velocity_24h THEN $1 ELSE peak_velocity_24h END,
           avg_velocity_7d = (avg_velocity_7d * 6 + $1) / 7
         WHERE id = $2`,
        [velocity.velocity, userId]
      );
    } catch (err) {
      console.error('Velocity persist error:', err.message);
    }
  }

  async endSession(userId, deviceId = 'default') {
    const sessionKey = `${userId}:${deviceId}`;
    
    await this.persistSession(userId, deviceId);
    this.userSessions.delete(sessionKey);
    
    await redis.del(`velocity:${sessionKey}:session`);
    await redis.del(`velocity:${sessionKey}:data`);
  }

  // Get all active sessions for user - NEW!
  getActiveSessions(userId) {
    const sessions = [];
    
    for (const [key, session] of this.userSessions.entries()) {
      if (key.startsWith(`${userId}:`)) {
        sessions.push({
          deviceId: session.deviceId,
          sessionId: session.sessionId,
          startedAt: session.startedAt,
          lastActiveAt: session.lastActiveAt,
          actionsCount: session.actions.length,
        });
      }
    }
    
    return sessions;
  }

  // Clear all sessions - NEW!
  clearAllSessions() {
    this.userSessions.clear();
  }
}

module.exports = { createVelocityTracker: (pool) => new VelocityTracker(pool) };