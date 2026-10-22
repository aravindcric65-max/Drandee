// API helpers — auth is handled by apiInterceptor.js patching window.fetch

const normalizeBaseUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  return raw.replace(/\/+$/, "");
};

export const API_URL = normalizeBaseUrl(
  process.env.REACT_APP_API_URL || (process.env.NODE_ENV === "production" ? "" : "http://localhost:5000")
);

// Legacy helper — kept for compatibility with existing callers that pass tokens explicitly
export const auth = (token) => {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) {
    return {};
  }
  return {
    headers: { Authorization: `Bearer ${cleanToken}` },
  };
};

const getErrorMessage = (error, fallback) => {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
};

// Helper to build URL with query params
const buildUrl = (path, config) => {
  let url = `${API_URL}${path}`;
  if (config?.params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(config.params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    }
    const qs = searchParams.toString();
    if (qs) {
      url += `?${qs}`;
    }
  }
  return url;
};

// Core fetch wrapper
const doFetch = async (path, options, config = {}) => {
  const url = buildUrl(path, config);
  const headers = {
    "Content-Type": "application/json",
    ...(config.headers || {}),
  };

  const fetchOptions = {
    ...options,
    headers,
  };

  const response = await window.fetch(url, fetchOptions);
  
  let data = {};
  try {
    data = await response.json();
  } catch (err) {
    // Some endpoints might return empty body or plain text
  }

  if (!response.ok) {
    const error = new Error(data.error || data.message || `HTTP error ${response.status}`);
    error.response = { status: response.status, data };
    throw error;
  }

  return data;
};

export const apiGet = async (path, config = {}) => {
  return doFetch(path, { method: "GET" }, config);
};

export const apiPost = async (path, body = {}, config = {}) => {
  return doFetch(path, { method: "POST", body: JSON.stringify(body) }, config);
};

const apiPut = async (path, body = {}, config = {}) => {
  return doFetch(path, { method: "PUT", body: JSON.stringify(body) }, config);
};

const apiDelete = async (path, config = {}) => {
  return doFetch(path, { method: "DELETE" }, config);
};

/* ------------------------------------------------------------------
   FEED
------------------------------------------------------------------ */

export const getFeed = async (token, options = {}) => {
  const { limit = 20, offset = 0 } = options;

  try {
    return await apiGet("/api/feed", {
      ...auth(token),
      params: { limit, offset },
    });
  } catch (error) {
    console.error("Feed fetch error:", getErrorMessage(error, "Failed to load feed"));
    throw error;
  }
};

/* ------------------------------------------------------------------
   AUTH
------------------------------------------------------------------ */

export const loginUser = async (email, password) => {
  return apiPost("/api/login", { email, password });
};

export const registerUser = async (name, email, password) => {
  return apiPost("/api/register", { name, email, password });
};

/* ------------------------------------------------------------------
   SPOTLIGHT
------------------------------------------------------------------ */

export const getSpotlight = async (level) => {
  try {
    return await apiGet(`/api/spotlight/${encodeURIComponent(level)}`);
  } catch (error) {
    console.error("Spotlight fetch error:", getErrorMessage(error, "Failed to load spotlight"));
    return [];
  }
};

/* ------------------------------------------------------------------
   PROFILE — CURRENT USER
------------------------------------------------------------------ */

export const getMyProfile = async (token) => {
  return apiGet("/api/user/profile", auth(token));
};

export const updateProfile = async (data, token) => {
  return apiPut("/api/user/profile", data, auth(token));
};

/* ------------------------------------------------------------------
   PROFILE — OTHER USERS
------------------------------------------------------------------ */

export const getUserById = async (userId, token) => {
  const config = token ? auth(token) : {};
  return apiGet(`/api/user/${encodeURIComponent(userId)}`, config);
};

/* ------------------------------------------------------------------
   POSTS — BY USER
------------------------------------------------------------------ */

export const getUserPosts = async (userId, token) => {
  const config = token ? auth(token) : {};
  const data = await apiGet(`/api/user/${encodeURIComponent(userId)}/posts`, config);
  return data?.posts || data || [];
};

/* ------------------------------------------------------------------
   FOLLOW / UNFOLLOW
------------------------------------------------------------------ */

export const followUserAPI = async (targetId, token) => {
  return apiPost(`/api/user/follow/${encodeURIComponent(targetId)}`, {}, auth(token));
};

export const unfollowUserAPI = async (targetId, token) => {
  return apiDelete(`/api/user/follow/${encodeURIComponent(targetId)}`, auth(token));
};

/* ------------------------------------------------------------------
   FOLLOWERS / FOLLOWING
------------------------------------------------------------------ */

export const getFollowersList = async (userId, token, limit = 50, offset = 0) => {
  const data = await apiGet(`/api/user/${encodeURIComponent(userId)}/followers`, {
    ...(token ? auth(token) : {}),
    params: { limit, offset },
  });
  return data?.followers || data || [];
};

export const getFollowingList = async (userId, token, limit = 50, offset = 0) => {
  const data = await apiGet(`/api/user/${encodeURIComponent(userId)}/following`, {
    ...(token ? auth(token) : {}),
    params: { limit, offset },
  });
  return data?.following || data || [];
};

/* ------------------------------------------------------------------
   STAR FRIENDS
------------------------------------------------------------------ */

export const toggleStarFriend = async (targetId, token) => {
  return apiPost(`/api/user/star/${encodeURIComponent(targetId)}`, {}, auth(token));
};

/* ------------------------------------------------------------------
   UTILITY
------------------------------------------------------------------ */

export const calculateLevel = (respects) => {
  const value = Number(respects) || 0;
  if (value >= 50) return 5;
  if (value >= 20) return 4;
  if (value >= 5) return 3;
  if (value >= 2) return 2;
  return 1;
};

export const calculateRank = (level) => {
  const ranks = ["New Member", "Rising Creator", "Verified Creator", "Pro Creator", "Elite Creator"];
  const safeLevel = Math.max(1, Math.min(Number(level) || 1, 5));
  return ranks[safeLevel - 1] || "New Member";
};