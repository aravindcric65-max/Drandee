const {
  calculateVariant,
} = require("../utils/feedExperiment");

/*
|--------------------------------------------------------------------------
| Get or create experiment
|--------------------------------------------------------------------------
*/
const getOrCreateExperiment = async (pool, userId) => {
  const existing = await pool.query(
    `
    SELECT
      user_id,
      variant
    FROM feed_experiments
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const variant = calculateVariant(userId);

  await pool.query(
    `
    INSERT INTO feed_experiments (
      user_id,
      variant
    )
    VALUES ($1, $2)
    ON CONFLICT (user_id)
    DO NOTHING
    `,
    [userId, variant]
  );

  const result = await pool.query(
    `
    SELECT
      user_id,
      variant
    FROM feed_experiments
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  return (
    result.rows[0] || {
      user_id: userId,
      variant,
    }
  );
};

/*
|--------------------------------------------------------------------------
| Reassign variant (admin override) - NEW!
|--------------------------------------------------------------------------
*/
const reassignVariant = async (pool, userId, newVariant) => {
  await pool.query(
    `
    UPDATE feed_experiments
    SET variant = $1, reassigned_at = NOW(), reassigned_by = 'admin'
    WHERE user_id = $2
    `,
    [newVariant, userId]
  );
  
  return { user_id: userId, variant: newVariant };
};

/*
|--------------------------------------------------------------------------
| Record feed impressions
|--------------------------------------------------------------------------
*/
const recordFeedImpressions = async (pool, { userId, variant, posts, offset = 0 }) => {
  if (!userId || !variant || !Array.isArray(posts) || posts.length === 0) {
    return 0;
  }

  const values = [];
  const placeholders = [];

  posts.forEach((post, index) => {
    const base = index * 5;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`
    );
    values.push(
      userId,
      post.id,
      variant,
      offset + index + 1,
      Number(post.score) || 0
    );
  });

  // Add deduplication - NEW!
  await pool.query(
    `
    INSERT INTO feed_impressions (
      user_id,
      post_id,
      variant,
      position,
      score
    )
    VALUES ${placeholders.join(", ")}
    ON CONFLICT (user_id, post_id, DATE(created_at)) DO UPDATE SET
      position = EXCLUDED.position,
      score = EXCLUDED.score
    `,
    values
  );

  return posts.length;
};

/*
|--------------------------------------------------------------------------
| Record feed outcome
|--------------------------------------------------------------------------
*/
const recordFeedOutcome = async (pool, {
  userId,
  postId,
  watched,
  skipped,
  completionPercent,
  watchTime,
  respected,
  shared,
  commented,
}) => {
  const result = await pool.query(
    `
    WITH latest AS (
      SELECT id
      FROM feed_impressions
      WHERE user_id = $1
        AND post_id = $2
        AND created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 1
    )
    UPDATE feed_impressions fi
    SET
      watched =
        CASE
          WHEN $3::boolean IS NULL
          THEN COALESCE(fi.watched, false)
          ELSE $3
        END,
      skipped =
        CASE
          WHEN $4::boolean IS NULL
          THEN COALESCE(fi.skipped, false)
          ELSE $4
        END,
      completion_percent =
        GREATEST(
          COALESCE(fi.completion_percent, 0),
          COALESCE($5::numeric, 0)
        ),
      watch_time =
        GREATEST(
          COALESCE(fi.watch_time, 0),
          COALESCE($6::numeric, 0)
        ),
      respected =
        COALESCE(fi.respected, false)
        OR COALESCE($7::boolean, false),
      shared =
        COALESCE(fi.shared, false)
        OR COALESCE($8::boolean, false),
      commented =
        COALESCE(fi.commented, false)
        OR COALESCE($9::boolean, false)
    FROM latest
    WHERE fi.id = latest.id
    RETURNING fi.id
    `,
    [
      userId,
      postId,
      watched ?? null,
      skipped ?? null,
      completionPercent ?? 0,
      watchTime ?? 0,
      respected ?? false,
      shared ?? false,
      commented ?? false,
    ]
  );

  return result.rows.length > 0;
};

/*
|--------------------------------------------------------------------------
| Get feed exposure metrics with time filter - NEW!
|--------------------------------------------------------------------------
*/
const getFeedExposureMetrics = async (pool, period = 'all') => {
  let timeFilter = '';
  
  if (period === '24h') {
    timeFilter = "WHERE created_at >= NOW() - INTERVAL '24 hours'";
  } else if (period === '7d') {
    timeFilter = "WHERE created_at >= NOW() - INTERVAL '7 days'";
  } else if (period === '30d') {
    timeFilter = "WHERE created_at >= NOW() - INTERVAL '30 days'";
  }

  const result = await pool.query(
    `
    SELECT
      variant,
      COUNT(*)::INTEGER AS impressions,
      COUNT(DISTINCT user_id)::INTEGER AS unique_users,
      COUNT(*) FILTER (WHERE watched = TRUE)::INTEGER AS watched_count,
      COUNT(*) FILTER (WHERE skipped = TRUE)::INTEGER AS skipped_count,
      COUNT(*) FILTER (WHERE respected = TRUE)::INTEGER AS respected_count,
      COUNT(*) FILTER (WHERE shared = TRUE)::INTEGER AS shared_count,
      COUNT(*) FILTER (WHERE commented = TRUE)::INTEGER AS commented_count,
      ROUND(AVG(COALESCE(completion_percent, 0))::NUMERIC, 2) AS average_completion,
      ROUND(AVG(COALESCE(watch_time, 0))::NUMERIC, 2) AS average_watch_time,
      ROUND(AVG(COALESCE(score, 0))::NUMERIC, 2) AS average_score,
      ROUND((COUNT(*) FILTER (WHERE watched = TRUE) * 100.0) / NULLIF(COUNT(*), 0), 2) AS watch_rate_percent,
      ROUND((COUNT(*) FILTER (WHERE skipped = TRUE) * 100.0) / NULLIF(COUNT(*), 0), 2) AS skip_rate_percent,
      ROUND((COUNT(*) FILTER (WHERE respected = TRUE) * 100.0) / NULLIF(COUNT(*), 0), 2) AS respect_rate_percent,
      ROUND((COUNT(*) FILTER (WHERE shared = TRUE) * 100.0) / NULLIF(COUNT(*), 0), 2) AS share_rate_percent,
      ROUND((COUNT(*) FILTER (WHERE commented = TRUE) * 100.0) / NULLIF(COUNT(*), 0), 2) AS comment_rate_percent
    FROM feed_impressions
    ${timeFilter}
    GROUP BY variant
    ORDER BY variant
    `
  );

  return result.rows;
};

/*
|--------------------------------------------------------------------------
| Calculate statistical significance - NEW!
|--------------------------------------------------------------------------
*/
const calculateSignificance = (level6, control) => {
  if (!level6 || !control) {
    return { significant: false, pValue: 1, t: 0 };
  }

  const n1 = level6.unique_users || 1;
  const n2 = control.unique_users || 1;
  const mean1 = level6.average_watch_time || 0;
  const mean2 = control.average_watch_time || 0;
  
  // Simplified variance (use watch_time as proxy)
  const var1 = (level6.average_watch_time || 0) * 0.5;
  const var2 = (control.average_watch_time || 0) * 0.5;

  const pooledSE = Math.sqrt(var1 / n1 + var2 / n2);
  
  if (pooledSE === 0) {
    return { significant: false, pValue: 1, t: 0 };
  }

  const t = (mean1 - mean2) / pooledSE;
  
  // Simplified p-value (two-tailed)
  const pValue = 2 * (1 - normalCDF(Math.abs(t)));

  return {
    t,
    pValue,
    significant: pValue < 0.05, // 95% confidence
    confidence: (1 - pValue) * 100,
  };
};

// Standard normal CDF approximation
const normalCDF = (x) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  
  if (x > 0) {
    return 1 - prob;
  }
  
  return prob;
};

/*
|--------------------------------------------------------------------------
| Calculate combined score - NEW!
|--------------------------------------------------------------------------
*/
const calculateCombinedScore = (metrics) => {
  if (!metrics) {
    return 0;
  }

  return (
    (metrics.watch_rate_percent || 0) * 0.3 +
    (metrics.respect_rate_percent || 0) * 0.25 +
    (metrics.share_rate_percent || 0) * 0.2 +
    (metrics.comment_rate_percent || 0) * 0.15 +
    ((metrics.average_completion || 0) / 100) * 0.1
  );
};

/*
|--------------------------------------------------------------------------
| Get metrics with comparison - NEW!
|--------------------------------------------------------------------------
*/
const getMetricsWithComparison = async (pool, period = 'all') => {
  const metrics = await getFeedExposureMetrics(pool, period);
  
  const level6 = metrics.find(row => row.variant === 'level6') || null;
  const control = metrics.find(row => row.variant === 'control') || null;
  
  const level6Score = calculateCombinedScore(level6);
  const controlScore = calculateCombinedScore(control);
  
  const significance = calculateSignificance(level6, control);
  
  let winner = null;
  if (level6Score > controlScore) {
    winner = 'level6';
  } else if (controlScore > level6Score) {
    winner = 'control';
  } else {
    winner = 'tie';
  }

  return {
    metrics,
    comparison: {
      level6,
      control,
      level6Score: parseFloat(level6Score.toFixed(2)),
      controlScore: parseFloat(controlScore.toFixed(2)),
      winner,
      scoreDifference: parseFloat((level6Score - controlScore).toFixed(2)),
      percentageImprovement: controlScore > 0 
        ? parseFloat(((level6Score - controlScore) / controlScore * 100).toFixed(2))
        : 0,
      significance,
    },
    period,
  };
};

module.exports = {
  getOrCreateExperiment,
  reassignVariant, // NEW!
  recordFeedImpressions,
  recordFeedOutcome,
  getFeedExposureMetrics,
  getMetricsWithComparison, // NEW!
  calculateSignificance, // NEW!
  calculateCombinedScore, // NEW!
  normalCDF, // NEW!
};