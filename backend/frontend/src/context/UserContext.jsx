import React, { createContext, useState, useContext, useEffect } from "react";
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
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

  const [token, setToken] = useState(() => {
    return localStorage.getItem("token") || "";
  });

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
      const currentToken = localStorage.getItem('token') || token;
      if (!currentToken) return; // Skip if no token
      
      try {
        const res = await fetch("/api/events/velocity", {
          headers: { Authorization: `Bearer ${currentToken}` }
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
      const currentToken = localStorage.getItem('token') || token;
      if (!currentToken) return;

      try {
        const res = await fetch("/api/notifications?limit=20", {
          headers: { Authorization: `Bearer ${currentToken}` }
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

    fetchVelocity(); // initial fetch
    fetchNotifications();

    const vInterval = setInterval(fetchVelocity, 30000);
    const nInterval = setInterval(fetchNotifications, 10000); // 10s polling for real-time feel

    return () => {
      clearInterval(vInterval);
      clearInterval(nInterval);
      window.removeEventListener('user_updated', handleUserUpdate);
    };
  }, [token]);

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

  const addComment = async (postId, text, userId, username) => {
    if (!user) return;
    const newCmt = {
      id: Date.now(),
      userId,
      user: username,
      text: text.trim(),
    };
    setPostComments((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), newCmt],
    }));
    incrementComment(postId);
    
    // Sync with backend
    try {
      await fetch(`/api/engagement/comments/${postId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ text: text.trim() })
      });
    } catch (e) {
      console.error("Comment API failed", e);
    }
  };

  const markNotInterested = (postId) => {
    if (!user) return;
    setUserFeedback((prev) => ({
      ...prev,
      notInterested: [...prev.notInterested.filter((id) => id !== postId), postId],
    }));
  };

  const muteCreator = (creatorId) => {
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
  };

  const reportPost = (postId, reason) => {
    if (!user) return;
    setUserFeedback((prev) => ({
      ...prev,
      reported: [
        ...prev.reported,
        { postId, reason, time: new Date().toISOString() },
      ],
    }));
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

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      const currentToken = localStorage.getItem('token') || token;
      await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${currentToken}` }
      });
    } catch (err) {}
  };

  const markRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      const currentToken = localStorage.getItem('token') || token;
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${currentToken}` }
      });
    } catch (err) {}
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const giveRespect = async (videoId, forceAdd = false) => {
    if (!user) return;
    const respectedVideos = Array.isArray(user?.respectedVideos) ? user.respectedVideos : [];
    const alreadyRespected = respectedVideos.includes(videoId);
    
    if (alreadyRespected && forceAdd) return; // Prevent duplicate requests on double-tap

    if (!alreadyRespected) {
      const updatedRespects = (user?.respects || 0) + 1;
      setUser((prev) => ({
        ...prev,
        respects: updatedRespects,
        respectedVideos: [...(prev.respectedVideos || []), videoId],
      }));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === videoId
            ? { ...p, totalRespects: (p.totalRespects || 0) + 1 }
            : p
        )
      );
      checkMilestones(updatedRespects);
    } else {
      setUser((prev) => ({
        ...prev,
        respects: Math.max(0, (prev.respects || 0) - 1),
        respectedVideos: (prev.respectedVideos || []).filter((id) => id !== videoId),
      }));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === videoId
            ? { ...p, totalRespects: Math.max(0, (p.totalRespects || 0) - 1) }
            : p
        )
      );
    }
    
    // Sync with backend
    try {
      await fetch(`/api/engagement/respect/${videoId}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
    } catch (e) {
      console.error("Respect API failed", e);
    }
  };

  const followUser = (targetUserId) => {
    if (!user) return;
    if ((user?.following || []).includes(targetUserId)) return;
    setUser((prev) => ({
      ...prev,
      following: [...(prev.following || []), targetUserId],
    }));
  };

  const unfollowUser = (targetUserId) => {
    if (!user) return;
    setUser((prev) => ({
      ...prev,
      following: (prev.following || []).filter((id) => id !== targetUserId),
    }));
  };

  const savePost = async (postId, collectionName = "Saved") => {
    if (!user) return;
    const isSaved = (user?.savedPosts || []).includes(postId);

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
        prev.map((p) =>
          p.id === postId
            ? { ...p, saves: Math.max(0, (p.saves || 0) - 1) }
            : p
        )
      );
    } else {
      setUser((prev) => ({
        ...prev,
        savedPosts: [...(prev.savedPosts || []), postId],
        savedCollections: {
          ...(prev.savedCollections || {}),
          [postId]: collectionName,
        },
      }));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, saves: (p.saves || 0) + 1 }
            : p
        )
      );
    }

    // Sync with backend
    try {
      await fetch(`/api/engagement/save/${postId}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
    } catch (e) {
      console.error("Save API failed", e);
    }
  };

  const markWatched = (postId) => {
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
  };

  const incrementComment = (postId) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, comments: (p.comments || 0) + 1 }
          : p
      )
    );
  };

  const incrementShare = async (postId) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, shares: (p.shares || 0) + 1 }
          : p
      )
    );
    
    // Sync with backend
    try {
      await fetch(`/api/engagement/share/${postId}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
    } catch (e) {
      console.error("Share API failed", e);
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
    setUser((prevUser) => ({ ...prevUser, ...data }));
    
    if (data.token) {
      localStorage.setItem("token", data.token);
    }
    if (data.id || data.email) {
      localStorage.setItem("user", JSON.stringify({ ...user, ...data }));
    }
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
    setToken("");
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
        token,
        setToken,
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