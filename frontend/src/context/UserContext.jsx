import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { dispatchEngagementUpdated } from '../utils/engagementSync';
export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("user");
      return savedUser ? JSON.parse(savedUser) : {
        id: "",
        name: "",
        username: "",
        nickname: "",
        email: "",
        bio: "",
        city: "", state: "", country: "",
        joinedSince: "",
        respects: 0,
        level: 1,
        rank: "New Member",
        role: "",
        isProtected: false,
        following: [],
        followers: [],
        respectedVideos: [],
        milestones: [],
        watchedPosts: [],
        savedPosts: [],
        savedCollections: {},
        profileTheme: "dark",
        tier: "free",
        isVerified: false,
        featuredPosts: [],
        customBadges: [],
        currentStreak: 0,
        lastActiveAt: null,
        gender: "male",
        privateAccount: false,
        allowSharing: true,
        respectAlerts: true,
        commentAlerts: true,
        spotlightAlerts: true,
        followerAlerts: false,
        whoCanFollow: "Everyone",
        whoCanComment: "Everyone",
        mfaEnabled: false,
        mfaMethod: null,
        biometricLock: false,
        loginAlerts: false,
        twoFactor: false,
        sanctuaryMode: false,
        calmPresence: true,
        locationAccess: "off",
        blockedUsers: [],
        fadedUsers: [],
        keywordFilters: [],
        tagApprovalRequired: true,
        e2eeEnabled: true,
        connectedApps: [],
        contactSyncEnabled: false,
        dataExportRequested: false,
        dataExportRequestedAt: null,
        permanentDeleteRequested: false,
      };
    } catch {
      return {
        id: "",
        name: "",
        username: "",
        nickname: "",
        email: "",
        bio: "",
        city: "", state: "", country: "",
        joinedSince: "",
        respects: 0,
        level: 1,
        rank: "New Member",
        role: "",
        isProtected: false,
        following: [],
        followers: [],
        respectedVideos: [],
        milestones: [],
        watchedPosts: [],
        savedPosts: [],
        savedCollections: {},
        profileTheme: "dark",
        tier: "free",
        isVerified: false,
        featuredPosts: [],
        customBadges: [],
        currentStreak: 0,
        lastActiveAt: null,
        gender: "male",
        privateAccount: false,
        allowSharing: true,
        respectAlerts: true,
        commentAlerts: true,
        spotlightAlerts: true,
        followerAlerts: false,
        whoCanFollow: "Everyone",
        whoCanComment: "Everyone",
        mfaEnabled: false,
        mfaMethod: null,
        biometricLock: false,
        loginAlerts: false,
        twoFactor: false,
        sanctuaryMode: false,
        calmPresence: true,
        locationAccess: "off",
        blockedUsers: [],
        fadedUsers: [],
        keywordFilters: [],
        tagApprovalRequired: true,
        e2eeEnabled: true,
        connectedApps: [],
        contactSyncEnabled: false,
        dataExportRequested: false,
        dataExportRequestedAt: null,
        permanentDeleteRequested: false,
      };
    }
  });

  // Legacy token state removed - Firebase auth handled by apiInterceptor

  const [posts, setPosts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [registeredUsernames, setRegisteredUsernames] = useState([]);
  const [spotlight, setSpotlight] = useState({ active: false, remainingTime: 0 });
  const [velocity, setVelocity] = useState(null);

  // Poll velocity every 30 seconds
  useEffect(() => {
    // Listen for manual user updates (e.g., from Profile save)
    const handleUserUpdate = () => {
      try {
        const savedUser = localStorage.getItem("user");
        if (savedUser) setUser(JSON.parse(savedUser));
      } catch (err) {}
    };
    window.addEventListener('user_updated', handleUserUpdate);

    const fetchVelocity = async () => {
      // Use token from state (Firebase auth via apiInterceptor)
      if (!auth.currentUser) return; // Skip if not authenticated
      
      try {
        const res = await fetch("/api/events/velocity", {
          });
        if (res.status === 401) {
          console.warn("Velocity API returned 401. Token expired, logging out.");
          localStorage.removeItem('token');
          localStorage.removeItem('userId');
          localStorage.removeItem('user');
          if (auth.currentUser) {
            signOut(auth).catch(console.error);
          }
          return;
        }
        const data = await res.json();
        if (data.success) {
          setVelocity(data.velocity);
        }
      } catch (err) {}
    };

    const fetchNotifications = async () => {
      // Use token from state (Firebase auth via apiInterceptor)
      if (!auth.currentUser) return;

      try {
        const res = await fetch("/api/notifications?limit=20", {
          });
        const data = await res.json();
        if (data.success) {
          setNotifications(prev => {
            // Check for new notifications to trigger toast
            if (prev.length > 0) {
              const newNotifs = data.notifications.filter(n => 
                new Date(n.createdAt) > new Date(prev[0].createdAt)
              );
              if (newNotifs.length > 0) {
                // Dispatch event for Push Notification Toast
                newNotifs.forEach(n => {
                  window.dispatchEvent(new CustomEvent('new_notification', { detail: n }));
                });
              }
            }
            return data.notifications;
          });
        }
      } catch (err) {}
    };

    // Listen for post deletions to prune the shared posts array.
    // This covers Discover, Feed, and any other consumer of UserContext.posts.
    const handlePostDeleted = (e) => {
      const { postId } = e.detail || {};
      if (postId) {
        setPosts((prev) => prev.filter((p) => String(p.id) !== String(postId)));
      }
    };
    window.addEventListener('post_deleted', handlePostDeleted);

    fetchVelocity(); // initial fetch
    fetchNotifications();

    const vInterval = setInterval(fetchVelocity, 30000);
    const nInterval = setInterval(fetchNotifications, 10000); // 10s polling for real-time feel

    return () => {
      clearInterval(vInterval);
      clearInterval(nInterval);
      window.removeEventListener('user_updated', handleUserUpdate);
      window.removeEventListener('post_deleted', handlePostDeleted);
    };
  }, [user.id]);

  const [postComments, setPostComments] = useState({});
  const [userFeedback, setUserFeedback] = useState({
    notInterested: [],
    muted: [],
    reported: [],
  });

  const isUsernameAvailable = (username) => {
    const clean = username.toLowerCase().trim();
    return !(registeredUsernames || [])
      .filter((u) => u !== (user?.username || ""))
      .includes(clean);
  };

  const claimUsername = (username) => {
    const clean = username.toLowerCase().trim();
    if (!isUsernameAvailable(clean)) return false;
    setRegisteredUsernames((prev) => [
      ...prev.filter((u) => u !== user?.username),
      clean,
    ]);
    setUser((prev) => ({ ...prev, username: clean }));
    return true;
  };

  const addComment = async (postId, text, userId, username, replyToId) => {
    if (!user) return;
    const newCmt = {
      id: Date.now(),
      userId,
      user: username,
      text: text.trim(),
      parent_comment_id: replyToId || null,
    };
    setPostComments((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), newCmt],
    }));
    // Sync with backend
    try {
      // Only send parent_comment_id if it looks like a real server DB id
      // (not a Date.now() temporary optimistic id, which would be ~13 digits)
      const safeParentId = replyToId && typeof replyToId === 'number' && replyToId < 1e12 ? replyToId : null;
      const res = await fetch(`/api/engagement/comments/${postId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          },
        body: JSON.stringify({ text: text.trim(), parent_comment_id: safeParentId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.comment) {
          // Replace optimistic comment id with server-assigned id
          setPostComments((prev) => {
            const currentPostComments = prev[postId] || [];
            return {
              ...prev,
              [postId]: currentPostComments.map((c) => 
                c.id === newCmt.id ? { ...c, id: data.comment.id } : c
              ),
            };
          });
          // Use server canonical count as the single source of truth.
          // Do NOT also call incrementComment() — that would double-fire
          // engagement_updated and cause the displayed count to jump twice.
          if (typeof data.commentCount === 'number') {
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: data.commentCount } : p));
            dispatchEngagementUpdated(postId, { commentCount: data.commentCount });
          } else {
            // Fallback: server didn't return canonical count — increment once
            incrementComment(postId);
          }
        }
      }
    } catch (e) {
      // Rollback optimistic comment on failure
      setPostComments((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((c) => c.id !== newCmt.id),
      }));
      console.error("Comment API failed", e);
    }
  };

  const markNotInterested = async (postId) => {
    if (!user) return;
    setUserFeedback((prev) => ({
      ...prev,
      notInterested: [...prev.notInterested.filter((id) => id !== postId), postId],
    }));
    try {
      await fetch(`/api/engagement/not-interested/${postId}`, { method: 'POST' });
    } catch (err) {
      console.error("Failed to mark not interested", err);
    }
  };

  const muteCreator = async (creatorId) => {
    if (!user) return;
    setUserFeedback((prev) => {
      const isMuted = prev.muted.includes(creatorId);
      return {
        ...prev,
        muted: isMuted
          ? prev.muted.filter((id) => id !== creatorId)
          : [...prev.muted, creatorId],
      };
    });
    try {
      // Assuming a mute endpoint exists or will exist; fail gracefully if not
      await fetch(`/api/user/mute/${creatorId}`, { method: 'POST' });
    } catch (err) {
      console.error("Failed to mute creator", err);
    }
  };

  const reportPost = async (postId, reason) => {
    if (!user) return;
    setUserFeedback((prev) => ({
      ...prev,
      reported: [
        ...prev.reported,
        { postId, reason, time: new Date().toISOString() },
      ],
    }));
    try {
      await fetch(`/api/reports/post/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'Inappropriate', category: reason, description: 'Reported from Reels' })
      });
    } catch (err) {
      console.error("Failed to report post", err);
    }
  };

  const addNotification = (message, type = "general", fromUser = null) => {
    const newNotif = {
      id: Date.now().toString(),
      type,
      message,
      fromUser,
      time: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PUT',
        });
    } catch (err) {}
  }, []);

  const markRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        });
    } catch (err) {}
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const pendingRespects = React.useRef(new Set());
  const pendingSaves = React.useRef(new Set());

  const giveRespect = async (videoId, forceAdd = false) => {
    if (!user) return;
    if (pendingRespects.current.has(videoId)) return; // Prevent concurrent requests
    
    const respectedVideos = Array.isArray(user?.respectedVideos) ? user.respectedVideos : [];
    const alreadyRespected = respectedVideos.includes(videoId);
    
    if (alreadyRespected && forceAdd) return; // Prevent duplicate requests on double-tap

    pendingRespects.current.add(videoId);

    // Optimistic UI update via functional updaters
    const wasRespected = alreadyRespected;
    
    setUser((prev) => {
      const prevRespected = Array.isArray(prev.respectedVideos) ? prev.respectedVideos : [];
      const updatedRespects = wasRespected 
        ? Math.max(0, (prev.respects || 0) - 1)
        : (prev.respects || 0) + 1;
        
      const updatedRespectedVideos = wasRespected
        ? prevRespected.filter(id => id !== videoId)
        : [...prevRespected, videoId];

      if (!wasRespected) {
        checkMilestones(updatedRespects);
      }
      
      return {
        ...prev,
        respects: updatedRespects,
        respectedVideos: updatedRespectedVideos,
      };
    });

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== videoId) return p;
        const newCount = wasRespected
          ? Math.max(0, (p.totalRespects || 0) - 1)
          : (p.totalRespects || 0) + 1;
        return {
          ...p,
          totalRespects: newCount,
          stats: { ...(p.stats || {}), respects: newCount },
        };
      })
    );

    // Dispatch delta event to all surfaces without relying on stale closures
    dispatchEngagementUpdated(videoId, null, 'respect', wasRespected ? -1 : 1);
    
    // Sync with backend and rollback on failure
    try {
      const response = await fetch(`/api/engagement/respect/${videoId}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        }
      });
      
      if (!response.ok) {
        throw new Error('Server rejected respect action');
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Respect failed');
      }
      // Reconcile with server truth
      const serverTotal = data.totalRespects;
      if (typeof serverTotal === 'number') {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === videoId
              ? { ...p, totalRespects: serverTotal, stats: { ...(p.stats || {}), respects: serverTotal } }
              : p
          )
        );
        dispatchEngagementUpdated(videoId, {
          respectCount: serverTotal,
          hasRespected: data.respected,
        });
      }
    } catch (err) {
      console.error("Respect API failed:", err);
      // Rollback Optimistic UI
      setUser((prev) => {
        const prevRespected = Array.isArray(prev.respectedVideos) ? prev.respectedVideos : [];
        return {
          ...prev,
          respects: wasRespected 
            ? (prev.respects || 0) + 1
            : Math.max(0, (prev.respects || 0) - 1),
          respectedVideos: wasRespected
            ? [...prevRespected, videoId]
            : prevRespected.filter(id => id !== videoId),
        };
      });
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== videoId) return p;
          const rollbackCount = wasRespected
            ? (p.totalRespects || 0) + 1
            : Math.max(0, (p.totalRespects || 0) - 1);
          return {
            ...p,
            totalRespects: rollbackCount,
            stats: { ...(p.stats || {}), respects: rollbackCount },
          };
        })
      );
      
      // Rollback engagement event via delta
      dispatchEngagementUpdated(videoId, null, 'respect', wasRespected ? 1 : -1);
    } finally {
      pendingRespects.current.delete(videoId);
    }
  };

  const followUser = async (targetUserId) => {
    if (!user) return;
    if ((user?.following || []).includes(targetUserId)) return;
    setUser((prev) => ({
      ...prev,
      following: [...(prev.following || []), targetUserId],
    }));
    try {
      await fetch(`/api/user/follow/${targetUserId}`, { method: 'POST' });
      window.dispatchEvent(new Event('profile_updated'));
    } catch (e) {
      setUser((prev) => ({
        ...prev,
        following: (prev.following || []).filter(id => id !== targetUserId),
      }));
    }
  };

  const unfollowUser = async (targetUserId) => {
    if (!user) return;
    setUser((prev) => ({
      ...prev,
      following: (prev.following || []).filter((id) => id !== targetUserId),
    }));
    try {
      await fetch(`/api/user/follow/${targetUserId}`, { method: 'DELETE' });
      window.dispatchEvent(new Event('profile_updated'));
    } catch (e) {
      setUser((prev) => ({
        ...prev,
        following: [...(prev.following || []), targetUserId],
      }));
    }
  };

  const savePost = async (postId, collectionName = "Saved") => {
    if (!user) return;
    if (pendingSaves.current.has(postId)) return;
    pendingSaves.current.add(postId);

    const isSaved = (user?.savedPosts || []).includes(postId);

    // Optimistic UI
    if (isSaved) {
      setUser((prev) => {
        const newCols = { ...(prev.savedCollections || {}) };
        delete newCols[postId];
        return {
          ...prev,
          savedPosts: (prev.savedPosts || []).filter((id) => id !== postId),
          savedCollections: newCols,
        };
      });
      setPosts((prev) =>
        prev.map((p) => p.id === postId ? { ...p, saves: Math.max(0, (p.saves || 0) - 1) } : p)
      );
    } else {
      setUser((prev) => ({
        ...prev,
        savedPosts: [...(prev.savedPosts || []), postId],
        savedCollections: { ...(prev.savedCollections || {}), [postId]: collectionName },
      }));
      setPosts((prev) =>
        prev.map((p) => p.id === postId ? { ...p, saves: (p.saves || 0) + 1 } : p)
      );
    }

    dispatchEngagementUpdated(postId, null, 'save', isSaved ? -1 : 1);

    // Sync with backend
    try {
      const res = await fetch(`/api/engagement/save/${postId}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ collectionName })
      });
      if (res.status === 429) {
        window.dispatchEvent(new CustomEvent('new_notification', { detail: { id: Date.now().toString(), type: 'system', title: 'Slow down', message: 'Please wait a moment.' } }));
        throw new Error('Rate limited');
      }
      if (!res.ok) throw new Error('Save failed');
      const saveData = await res.json();
      // Reconcile save state with server truth (server may have de-duped)
      if (saveData.success && typeof saveData.saved === 'boolean' && saveData.saved !== !isSaved) {
        // Server state differs from what we expected — apply server truth
        if (saveData.saved) {
          setUser((prev) => ({
            ...prev,
            savedPosts: (prev.savedPosts || []).includes(postId)
              ? prev.savedPosts
              : [...(prev.savedPosts || []), postId],
            savedCollections: { ...(prev.savedCollections || {}), [postId]: collectionName },
          }));
          setPosts((prev) =>
            prev.map((p) => p.id === postId ? { ...p, saves: (p.saves || 0) + 1 } : p)
          );
        } else {
          setUser((prev) => {
            const newCols = { ...(prev.savedCollections || {}) };
            delete newCols[postId];
            return {
              ...prev,
              savedPosts: (prev.savedPosts || []).filter((id) => id !== postId),
              savedCollections: newCols,
            };
          });
          setPosts((prev) =>
            prev.map((p) => p.id === postId ? { ...p, saves: Math.max(0, (p.saves || 0) - 1) } : p)
          );
        }
      }
    } catch (e) {
      console.error("Save API failed", e);
      // Rollback
      if (isSaved) {
        setUser((prev) => ({
          ...prev,
          savedPosts: [...(prev.savedPosts || []), postId],
          savedCollections: { ...(prev.savedCollections || {}), [postId]: collectionName },
        }));
        setPosts((prev) =>
          prev.map((p) => p.id === postId ? { ...p, saves: (p.saves || 0) + 1 } : p)
        );
      } else {
        setUser((prev) => {
          const newCols = { ...(prev.savedCollections || {}) };
          delete newCols[postId];
          return {
            ...prev,
            savedPosts: (prev.savedPosts || []).filter((id) => id !== postId),
            savedCollections: newCols,
          };
        });
        setPosts((prev) =>
          prev.map((p) => p.id === postId ? { ...p, saves: Math.max(0, (p.saves || 0) - 1) } : p)
        );
      }
      dispatchEngagementUpdated(postId, null, 'save', isSaved ? 1 : -1);
    } finally {
      pendingSaves.current.delete(postId);
    }
  };

  const markWatched = async (postId) => {
    if (!postId) return;
    if ((user?.watchedPosts || []).includes(postId)) return;
    setUser((prev) => ({
      ...prev,
      watchedPosts: [...(prev.watchedPosts || []), postId],
    }));
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, watchCount: (p.watchCount || 0) + 1 }
          : p
      )
    );
    try {
      // Feed algorithm signal — keep
      fetch('/api/home/impression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, action: 'view' }),
      }).catch(() => {});

      // View count — updates posts.watch_count on first unique watch
      fetch('/api/watch/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, watch_time: 0 }),
      }).catch(() => {});
    } catch (err) {
      // Both fire-and-forget
    }
  };

  const incrementComment = (postId) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, comments: (p.comments || 0) + 1 }
          : p
      )
    );
    dispatchEngagementUpdated(postId, null, 'comment', 1);
  };

  const pendingShares = React.useRef(new Set());

  const incrementShare = async (postId) => {
    if (pendingShares.current.has(postId)) return;
    pendingShares.current.add(postId);
    
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, share_count: (p.share_count || 0) + 1 }
          : p
      )
    );

    dispatchEngagementUpdated(postId, null, 'share', 1);
    
    // Sync with backend
    try {
      const res = await fetch(`/api/engagement/share/${postId}`, {
        method: "POST"
      });
      if (!res.ok) throw new Error('Share API returned error');
      const data = await res.json();
      if (data.success && typeof data.shareCount === 'number') {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, share_count: data.shareCount } : p
          )
        );
        dispatchEngagementUpdated(postId, {
          shareCount: data.shareCount,
        });
      }
    } catch (e) {
      console.error("Share API failed", e);
      // Rollback
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, share_count: Math.max(0, (p.share_count || 0) - 1) }
            : p
        )
      );
      dispatchEngagementUpdated(postId, null, 'share', -1);
    } finally {
      pendingShares.current.delete(postId);
    }
  };

  const checkMilestones = (respects) => {
    const milestonesList = [10, 50, 100, 500, 1000, 10000];
    if (
      milestonesList.includes(respects) &&
      !(user?.milestones || []).includes(respects)
    ) {
      setUser((prev) => ({
        ...prev,
        milestones: [...(prev.milestones || []), respects],
      }));
      addNotification(
        `Milestone: ${respects} respects!`,
        "milestone"
      );
    }
  };

  const updateUser = (data) => {
    setUser((prevUser) => {
      const merged = { ...prevUser, ...data };
      // Write to localStorage inside the functional updater so we always
      // use the current state — never a stale closure snapshot.
      if (merged.id || merged.email) {
        try { localStorage.setItem("user", JSON.stringify(merged)); } catch (_) {}
      }
      return merged;
    });
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("user");
    // Token managed by Firebase auth
    setPosts([]);
    setNotifications([]);
    setPostComments({});
    setUserFeedback({ notInterested: [], muted: [], reported: [] });
    setUser({
      id: "",
      name: "",
      username: "",
      nickname: "",
      email: "",
      bio: "",
      city: "", state: "", country: "",
      joinedSince: "",
      respects: 0,
      level: 1,
      rank: "New Member",
      role: "",
      isProtected: false,
      following: [],
      followers: [],
      respectedVideos: [],
      milestones: [],
      watchedPosts: [],
      savedPosts: [],
      savedCollections: {},
      profileTheme: "dark",
      tier: "free",
      isVerified: false,
      featuredPosts: [],
      customBadges: [],
      currentStreak: 0,
      lastActiveAt: null,
      gender: "male",
      privateAccount: false,
      allowSharing: true,
      respectAlerts: true,
      commentAlerts: true,
      spotlightAlerts: true,
      followerAlerts: false,
      whoCanFollow: "Everyone",
      whoCanComment: "Everyone",
      mfaEnabled: false,
      mfaMethod: null,
      biometricLock: false,
      loginAlerts: false,
      twoFactor: false,
      sanctuaryMode: false,
      calmPresence: true,
      locationAccess: "off",
      blockedUsers: [],
      fadedUsers: [],
      keywordFilters: [],
      tagApprovalRequired: true,
      e2eeEnabled: true,
      connectedApps: [],
      contactSyncEnabled: false,
      dataExportRequested: false,
      dataExportRequestedAt: null,
      permanentDeleteRequested: false,
    });
  };

  const blockUser = (userId) => {
    setUser((prev) => ({
      ...prev,
      blockedUsers: (prev.blockedUsers || []).includes(userId)
        ? prev.blockedUsers
        : [...(prev.blockedUsers || []), userId],
      following: (prev.following || []).filter((id) => id !== userId),
      followers: (prev.followers || []).filter((id) => id !== userId),
    }));
  };

  const unblockUser = (userId) => {
    setUser((prev) => ({
      ...prev,
      blockedUsers: (prev.blockedUsers || []).filter((id) => id !== userId),
    }));
  };

  const fadeUser = (userId) => {
    setUser((prev) => ({
      ...prev,
      fadedUsers: (prev.fadedUsers || []).includes(userId)
        ? prev.fadedUsers
        : [...(prev.fadedUsers || []), userId],
    }));
  };

  const unfadeUser = (userId) => {
    setUser((prev) => ({
      ...prev,
      fadedUsers: (prev.fadedUsers || []).filter((id) => id !== userId),
    }));
  };

  const updateSpotlight = (data) => setSpotlight(data);

  const updateStreak = () => {
    const now = new Date();
    const last = user.lastActiveAt ? new Date(user.lastActiveAt) : null;

    if (!last) {
      setUser((prev) => ({
        ...prev,
        currentStreak: 1,
        lastActiveAt: now.toISOString(),
      }));
      return;
    }

    const diffHours = (now - last) / (1000 * 60 * 60);

    if (diffHours < 24) {
      setUser((prev) => ({ ...prev, lastActiveAt: now.toISOString() }));
    } else if (diffHours < 48) {
      const newStreak = user.currentStreak + 1;
      setUser((prev) => ({
        ...prev,
        currentStreak: newStreak,
        lastActiveAt: now.toISOString(),
      }));
      if (newStreak % 7 === 0) {
        addNotification(`${newStreak} day streak! You're on fire! 🔥`, "milestone");
      }
    } else {
      setUser((prev) => ({
        ...prev,
        currentStreak: 1,
        lastActiveAt: now.toISOString(),
      }));
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        updateUser,
        logout,
        posts,
        setPosts,
        giveRespect,
        followUser,
        unfollowUser,
        savePost,
        markWatched,
        markNotInterested,
        muteCreator,
        reportPost,
        incrementComment,
        incrementShare,
        updateStreak,
        checkMilestones,
        postComments,
        addComment,
        notifications,
        addNotification,
        markRead,
        markAllRead,
        unreadCount,
        spotlight,
        setSpotlight,
        updateSpotlight,
        isUsernameAvailable,
        claimUsername,
        userFeedback,
        blockUser,
        unblockUser,
        fadeUser,
        unfadeUser,
        velocity,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
};