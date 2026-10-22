import { useContext, useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../context/UserContext";

const Search = () => {
  const { posts = [] } = useContext(UserContext) || {};
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState([]);
  const inputRef = useRef(null);
  const debounceTimer = useRef(null);

  // API search state
  const [apiResults, setApiResults] = useState({ users: [], posts: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Debounced API search
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const q = query.trim();
    if (!q) {
      setApiResults({ users: [], posts: [] });
      setSearchError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setSearchError(null);

    const controller = new AbortController();

    debounceTimer.current = setTimeout(async () => {
      try {
        const [usersRes, postsRes] = await Promise.all([
          fetch(`/api/search/users?q=${encodeURIComponent(q)}&limit=10`, { signal: controller.signal }),
          fetch(`/api/search/posts?q=${encodeURIComponent(q)}&limit=20`, { signal: controller.signal }),
        ]);

        const [usersData, postsData] = await Promise.all([
          usersRes.json(),
          postsRes.json(),
        ]);

        setApiResults({
          users: usersData.success ? (usersData.users || []) : [],
          posts: postsData.success ? (postsData.posts || []) : [],
        });

        if (!usersData.success && !postsData.success) {
          setSearchError("Search failed. Please try again.");
        }
      } catch (err) {
        if (err.name === 'AbortError') return; // stale request cancelled — do not update state
        setSearchError("Search failed. Please try again.");
        setApiResults({ users: [], posts: [] });
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      controller.abort();
    };
  }, [query]);

  const trendingTags = useMemo(() => {
    const tagMap = {};
    posts.forEach((p) => {
      (p.tags || []).forEach((t) => {
        tagMap[t] = (tagMap[t] || 0) + (p.totalRespects || 0);
      });
    });
    return Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [posts]);

  const suggestedCreators = useMemo(() => {
    const seen = new Map();
    posts
      .sort((a, b) => (b.totalRespects || 0) - (a.totalRespects || 0))
      .forEach((p) => {
        if (!seen.has(p.creatorId)) {
          seen.set(p.creatorId, {
            id: p.creatorId,
            name: p.creatorName,
            totalRespects: p.totalRespects || 0,
          });
        }
      });
    return Array.from(seen.values()).slice(0, 6);
  }, [posts]);

  const fmt = (n) => {
    if (!n) return "0";
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(n);
  };

  const handleSubmit = (term) => {
    if (!term.trim()) return;
    setRecent((prev) => [term, ...prev.filter((r) => r !== term)].slice(0, 8));
    setQuery(term);
  };

  const removeRecent = (term) =>
    setRecent((prev) => prev.filter((r) => r !== term));

  return (
    <div style={S.page}>

      {/* Search bar */}
      <div style={S.topbar}>
        <button type="button" aria-label="Back" style={S.backBtn} onClick={() => navigate(-1)}>
          <BackIcon />
        </button>
        <div style={S.searchBox}>
          <SearchIcon />
          {/* ✅ id + name + label fix */}
          <label htmlFor="search-input" style={S.srOnly}>Search creators, tags, posts</label>
          <input
            id="search-input"
            name="search"
            ref={inputRef}
            style={S.searchInput}
            placeholder="Search creators, tags, posts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit(query)}
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              style={S.clearBtn}
              onClick={() => setQuery("")}
            >
              <CloseIcon />
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label="Cancel search"
          style={S.cancelText}
          onClick={() => navigate(-1)}
        >
          Cancel
        </button>
      </div>

      <div style={S.scroll}>

        {query.trim() ? (
          <>
            {isLoading ? (
              <div style={S.resultsHdr}>Searching...</div>
            ) : searchError ? (
              <div style={S.emptyWrap}>
                <p style={S.emptyTitle}>Something went wrong</p>
                <p style={S.emptySub}>{searchError}</p>
              </div>
            ) : (
              <>
                <div style={S.resultsHdr}>
                  {apiResults.users.length + apiResults.posts.length} result{(apiResults.users.length + apiResults.posts.length) !== 1 ? "s" : ""} for "{query}"
                </div>
                {apiResults.users.length === 0 && apiResults.posts.length === 0 ? (
                  <div style={S.emptyWrap}>
                    <p style={S.emptyTitle}>No results found</p>
                    <p style={S.emptySub}>Try a different name or tag</p>
                  </div>
                ) : (
                  <>
                    {apiResults.users.map((user) => (
                      <div
                        key={`user-${user.id}`}
                        style={S.resultRow}
                        onClick={() => navigate(`/profile/${user.id}`)}
                      >
                        <div style={S.resultAv}>
                          {(user.name || user.username || "?").charAt(0).toUpperCase()}
                        </div>
                        <div style={S.resultInfo}>
                          <span style={S.resultName}>{user.name || user.username}</span>
                          <span style={S.resultCaption}>@{user.username}</span>
                        </div>
                      </div>
                    ))}
                    {apiResults.posts.map((post) => (
                      <div
                        key={`post-${post.id}`}
                        style={S.resultRow}
                        onClick={() => navigate(`/profile/${post.creatorId || post.user_id}`)}
                      >
                        <div style={S.resultAv}>
                          {(post.creatorName || post.creator_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div style={S.resultInfo}>
                          <span style={S.resultName}>@{post.creatorName || post.creator_name || post.creator_username}</span>
                          <span style={S.resultCaption}>
                            {post.caption || post.overlayText || post.overlay_text || "No caption"}
                          </span>
                        </div>
                        <span style={S.resultCount}>{fmt(post.totalRespects || post.total_respects)}</span>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {recent.length > 0 && (
              <>
                <div style={S.sectionRow}>
                  <span style={S.sectionLabel}>Recent</span>
                  <button
                    type="button"
                    aria-label="Clear all recent searches"
                    style={S.clearAllBtn}
                    onClick={() => setRecent([])}
                  >
                    Clear all
                  </button>
                </div>
                {recent.map((term) => (
                  <div
                    key={term}
                    style={S.recentRow}
                    onClick={() => handleSubmit(term)}
                  >
                    <ClockIcon />
                    <span style={S.recentText}>{term}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${term} from recent`}
                      style={S.clearBtn}
                      onClick={(e) => { e.stopPropagation(); removeRecent(term); }}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                ))}
              </>
            )}

            <div style={S.sectionLabel2}>Trending now</div>
            <div style={S.tagGrid}>
              {trendingTags.length === 0 ? (
                <p style={S.emptySub}>No trends yet</p>
              ) : (
                trendingTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    aria-label={`Search ${tag}`}
                    style={S.tagPill}
                    onClick={() => handleSubmit(tag)}
                  >
                    <TrendIcon />
                    <span style={S.tagText}>#{tag}</span>
                  </button>
                ))
              )}
            </div>

            <div style={S.sectionLabel2}>Suggested creators</div>
            {suggestedCreators.map((c) => (
              <div
                key={c.id}
                style={S.recentRow}
                onClick={() => navigate(`/profile/${c.id}`)}
              >
                <div style={S.creatorAv}>
                  {c.name?.charAt(0).toUpperCase()}
                </div>
                <span style={S.recentText}>@{c.name}</span>
                <span style={S.resultCount}>{fmt(c.totalRespects)}</span>
              </div>
            ))}
          </>
        )}

        <div style={{ height: "30px" }} />
      </div>
    </div>
  );
};

/* ===== ICONS ===== */
const SearchIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="11" cy="11" r="7" stroke="rgba(255,255,255,0.4)" strokeWidth="1.7" />
    <path d="M16.5 16.5L21 21" stroke="rgba(255,255,255,0.4)" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const CloseIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.4)" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
    <path d="M12 7v5l3 3" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const TrendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6"
      stroke="#7F77DD" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ===== STYLES ===== */
const S = {
  page: {
    background: "#080808", minHeight: "100vh", color: "#fff",
    fontFamily: "-apple-system,system-ui,sans-serif",
    display: "flex", flexDirection: "column",
  },
  topbar: {
    display: "flex", alignItems: "center", gap: "12px",
    padding: "14px 16px", borderBottom: "0.5px solid #111",
    position: "sticky", top: 0, background: "#080808", zIndex: 100,
  },
  backBtn: {
    background: "none", border: "none",
    cursor: "pointer", display: "flex", padding: 0,
    alignItems: "center", justifyContent: "center",
  },
  searchBox: {
    flex: 1, display: "flex", alignItems: "center", gap: "8px",
    background: "#1a1a1a", border: "0.5px solid #222",
    borderRadius: "10px", padding: "10px 12px",
  },
  searchInput: {
    flex: 1, background: "none", border: "none", outline: "none",
    color: "#fff", fontSize: "14px", width: "auto", padding: 0,
  },
  clearBtn: {
    background: "none", border: "none",
    cursor: "pointer", display: "flex", padding: 0,
  },
  cancelText: {
    background: "none", border: "none",
    fontSize: "14px", color: "#fff",
    cursor: "pointer", flexShrink: 0, padding: 0,
  },
  srOnly: {
    position: "absolute", width: "1px", height: "1px",
    padding: 0, margin: "-1px", overflow: "hidden",
    clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0,
  },
  scroll: { flex: 1, overflowY: "auto" },
  resultsHdr: {
    fontSize: "12px", color: "rgba(255,255,255,0.35)",
    padding: "14px 16px 6px",
  },
  resultRow: {
    display: "flex", alignItems: "center", gap: "12px",
    padding: "10px 16px", cursor: "pointer",
  },
  resultAv: {
    width: "44px", height: "44px", borderRadius: "50%",
    background: "#534AB7",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "15px", fontWeight: "500", color: "#fff", flexShrink: 0,
  },
  resultInfo: { flex: 1, minWidth: 0 },
  resultName: { fontSize: "14px", fontWeight: "500", color: "#fff", display: "block" },
  resultCaption: {
    fontSize: "12px", color: "rgba(255,255,255,0.4)",
    overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
    display: "block", marginTop: "2px",
  },
  resultCount: { fontSize: "12px", color: "rgba(255,255,255,0.35)", flexShrink: 0 },
  sectionRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 16px 8px",
  },
  sectionLabel: { fontSize: "14px", fontWeight: "600", color: "#fff" },
  sectionLabel2: {
    fontSize: "14px", fontWeight: "600", color: "#fff",
    padding: "18px 16px 10px",
  },
  clearAllBtn: {
    background: "none", border: "none",
    fontSize: "12px", color: "#7F77DD", cursor: "pointer", padding: 0,
  },
  recentRow: {
    display: "flex", alignItems: "center", gap: "12px",
    padding: "10px 16px", cursor: "pointer",
  },
  recentText: { flex: 1, fontSize: "14px", color: "rgba(255,255,255,0.8)" },
  tagGrid: { display: "flex", flexWrap: "wrap", gap: "8px", padding: "0 16px 8px" },
  tagPill: {
    display: "flex", alignItems: "center", gap: "6px",
    background: "#141414", border: "0.5px solid #1e1e1e",
    borderRadius: "18px", padding: "8px 14px", cursor: "pointer",
  },
  tagText: { fontSize: "13px", color: "rgba(255,255,255,0.8)" },
  creatorAv: {
    width: "38px", height: "38px", borderRadius: "50%",
    background: "#534AB7",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "13px", fontWeight: "500", color: "#fff", flexShrink: 0,
  },
  emptyWrap: { padding: "60px 20px", textAlign: "center" },
  emptyTitle: { fontSize: "15px", fontWeight: "500", color: "#fff", marginBottom: "6px" },
  emptySub: { fontSize: "13px", color: "rgba(255,255,255,0.4)" },
};

const BackIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export default Search;