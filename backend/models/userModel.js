// models/userModel.js

const createUsernameBase = (name, email) => {
  const namePart = String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "");

  const emailPart = String(email || "")
    .toLowerCase()
    .split("@")[0]
    .replace(/[^a-z0-9]+/g, "");

  const base = namePart || emailPart || "user";

  return base.slice(0, 30);
};

const createUniqueUsername = async (pool, name, email) => {
  const base = createUsernameBase(name, email);

  let username = base;

  const existing = await pool.query(
    `
    SELECT username
    FROM users
    WHERE username = $1
    LIMIT 1
    `,
    [username]
  );

  if (existing.rows.length === 0) {
    return username;
  }

  const emailPrefix = String(email || "")
    .toLowerCase()
    .split("@")[0]
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);

  const safeEmailPrefix = emailPrefix || base;

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    username = `${safeEmailPrefix}_${attempt}`;

    const duplicate = await pool.query(
      `
      SELECT username
      FROM users
      WHERE username = $1
      LIMIT 1
      `,
      [username]
    );

    if (duplicate.rows.length === 0) {
      return username;
    }
  }

  // Very unlikely fallback
  return `${base}_${Date.now()}`;
};

// ✅ User create — Register
const createUser = async (
  pool,
  name,
  email,
  hashedPassword,
  role = "audience"
) => {
  const username = await createUniqueUsername(
    pool,
    name,
    email
  );

  const result = await pool.query(
    `
    INSERT INTO users (
      name,
      username,
      email,
      password,
      role,
      joined_since
    )
    VALUES ($1, $2, $3, $4, $5, NOW())
    RETURNING
      id,
      name,
      username,
      email,
      role,
      joined_since
    `,
    [
      name.trim(),
      username,
      email.trim().toLowerCase(),
      hashedPassword,
      role,
    ]
  );

  return result.rows[0];
};

// ✅ Email-ல் user find — Login
// Password தேவைப்படுவதால் இங்கு password return செய்கிறோம்.
const findUserByEmail = async (pool, email) => {
  const result = await pool.query(
    `
    SELECT
      id,
      name,
      username,
      email,
      password,
      role,
      profile_pic,
      bio,
      is_protected,
      identity_level,
      current_badge,
      joined_since
    FROM users
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1
    `,
    [email.trim()]
  );

  return result.rows[0] || null;
};

// ✅ ID-ல் user find — Auth middleware
const findUserById = async (pool, id) => {
  const result = await pool.query(
    `
    SELECT
      id,
      name,
      username,
      email,
      role,
      profile_pic,
      bio,
      gender,
      niche,
      city,
      state,
      country,
      is_protected,
      current_badge,
      identity_level,
      joined_since,
      current_streak,
      avg_dopamine_score,
      current_velocity_score
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
};

// ✅ User update — Profile edit
const updateUser = async (pool, id, data = {}) => {
  const allowedFields = {
    name: "name",
    username: "username",
    bio: "bio",
    gender: "gender",
    niche: "niche",
    birthday: "birthday",
    phone: "phone",
    profilePic: "profile_pic",
    frameStyle: "frame_style",
    city: "city",
    state: "state",
    country: "country",
  };

  const updates = [];
  const values = [];
  let parameterIndex = 1;

  for (const [inputField, databaseField] of Object.entries(
    allowedFields
  )) {
    if (data[inputField] === undefined) {
      continue;
    }

    let value = data[inputField];

    if (databaseField === "username") {
      value = String(value)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_.]/g, "");

      if (!value) {
        continue;
      }
    }

    if (databaseField === "name" && typeof value === "string") {
      value = value.trim();
    }

    if (databaseField === "bio" && typeof value === "string") {
      value = value.trim();
    }

    if (databaseField === "niche") {
      value = Array.isArray(value)
        ? JSON.stringify(value)
        : value;
    }

    updates.push(
      `${databaseField} = $${parameterIndex}`
    );

    values.push(value);
    parameterIndex += 1;
  }

  if (updates.length === 0) {
    const existing = await findUserById(pool, id);
    return existing;
  }

  updates.push("updated_at = NOW()");
  values.push(id);

  const result = await pool.query(
    `
    UPDATE users
    SET ${updates.join(", ")}
    WHERE id = $${parameterIndex}
    RETURNING
      id,
      name,
      username,
      email,
      role,
      bio,
      profile_pic,
      gender,
      niche,
      birthday,
      phone,
      frame_style,
      city,
      state,
      country,
      joined_since
    `,
    values
  );

  return result.rows[0] || null;
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  updateUser,
  createUniqueUsername,
};