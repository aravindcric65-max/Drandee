import { useParams, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import DefaultAvatar from "../components/DefaultAvatar";
import { calculateRank, getRankProgress, getRespectsForNextLevel, formatRespects, LEVELS } from "../utils/badgeSystem";
import Navbar from "../components/Navbar";
import LinkInBio from "../components/LinkInBio";
import { CheckCircle2 } from "lucide-react";
import DrandeeWordmark from '../components/brand/DrandeeWordmark';
import DrandeeLogo from '../components/brand/DrandeeLogo';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';

/* ─── data ───────────────────────────────────────────── */
const NICHES = [
  "Art & Design","Music","Comedy","Education","Food & Cooking",
  "Travel","Technology","Fitness","Lifestyle","Gaming",
  "Fashion","Photography","Finance","Spirituality","Sports",
  "Dance","Science","Nature","Business","News & Media",
];

/* ─── Real QR Implementation ─────────────────────────── */
const QRView = ({ userId, size = 196 }) => {
  const safeSize = Number(size) || 196;
  return (
    <div style={{ position: 'relative', width: safeSize, height: safeSize, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <QRCodeSVG 
        value={userId || "https://drandee.app"} 
        size={safeSize} 
        level="H" 
        bgColor="#ffffff" 
        fgColor="#000000" 
        includeMargin={true}
        style={{ borderRadius: 14 }}
      />
      <div style={{ 
        position: 'absolute', 
        background: '#ffffff', 
        padding: Math.max(1, Math.floor(safeSize * 0.04)), 
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 0 2px #fff'
      }}>
        <DrandeeLogo style={{ width: Math.max(8, Math.floor(safeSize * 0.22)), height: Math.max(8, Math.floor(safeSize * 0.22)) }} className="" />
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════ */
const ProfilePostViewer = ({ posts, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowUp') {
        setCurrentIndex(prev => Math.max(0, prev - 1));
        e.preventDefault();
      }
      if (e.key === 'ArrowDown') {
        setCurrentIndex(prev => Math.min(posts.length - 1, prev + 1));
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [posts.length, onClose]);

  useEffect(() => {
    if (containerRef.current && containerRef.current.children[currentIndex]) {
      containerRef.current.children[currentIndex].scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentIndex]);

  const handleScroll = (e) => {
    const container = e.target;
    const index = Math.round(container.scrollTop / window.innerHeight);
    if (index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: '#000', zIndex: 9999, overflowY: 'scroll', scrollSnapType: 'y mandatory', overscrollBehaviorY: 'contain'
    }} ref={containerRef} onScroll={handleScroll}>
      
      <div style={{ position: 'fixed', top: 'max(env(safe-area-inset-top), 20px)', left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 16px', zIndex: 10000, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DrandeeLogo className="w-8 h-8" />
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
            {currentIndex + 1} / {posts.length}
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', pointerEvents: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      </div>

      {posts.map((post, i) => (
        <div key={post.id || i} style={{ width: '100vw', height: '100vh', scrollSnapAlign: 'start', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {Math.abs(i - currentIndex) <= 2 ? (
            post.videoUrl?.trim() ? (
              <video src={post.videoUrl} autoPlay={i === currentIndex} muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : post.image ? (
              <img src={post.image} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="" />
            ) : post.text ? (
              <div style={{ padding: 40, color: '#fff', fontSize: 24, textAlign: 'center' }}>{post.text}</div>
            ) : (
              <div style={{ width: '100%', height: '100%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                <span style={{color: '#fff'}}>Post Media</span>
              </div>
            )
          ) : (
             <div style={{ width: '100%', height: '100%', background: '#111' }} />
          )}
        </div>
      ))}
    </div>
  );
};

/* ══════════════════════════════════════════════════════ */
const Profile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [localUser, setLocalUser] = useState(() => JSON.parse(localStorage.getItem("user") || "{}"));
  const user = localUser;
  const targetId = id || user?.id;
  const [viewingPostIndex, setViewingPostIndex] = useState(null);

  useEffect(() => {
    const handleUserUpdated = () => {
      setLocalUser(JSON.parse(localStorage.getItem("user") || "{}"));
    };
    window.addEventListener('user_updated', handleUserUpdated);
    return () => window.removeEventListener('user_updated', handleUserUpdated);
  }, []);
  const isOwn = !id || id === user?.id;

  const [posts, setPosts] = useState([]);
  const [profileData, setProfileData] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/user/${targetId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setProfileData(data.user);
        }
      } catch (err) {
        console.error("Failed to fetch profile", err);
      }
    };
    if (targetId) fetchProfile();
  }, [targetId]);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/posts/user/${targetId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setPosts(data.posts || []);
        }
      } catch (err) {
        console.error("Failed to fetch posts", err);
      }
    };
    if (targetId) {
      fetchPosts();
    }
    
    // Listen for new posts
    const handleNewPost = (e) => {
      if (e.detail && (e.detail.creatorId === targetId || e.detail.user_id === targetId || isOwn)) {
        setPosts(prev => {
          if (prev.some(p => p.id === e.detail.id)) return prev;
          return [e.detail, ...prev];
        });
      }
    };
    window.addEventListener('new_post_published', handleNewPost);
    
    return () => {
      window.removeEventListener('new_post_published', handleNewPost);
    };
  }, [targetId, isOwn]);

  const crPosts   = posts.filter((p) => p.creatorId === targetId || p.user_id === targetId);
  const totalResp = crPosts.reduce((s, p) => s + (p.totalRespects || 0), 0) + (user?.respects || 0); // Include user respects
  const rank      = calculateRank(totalResp);
  const prog      = getRankProgress(totalResp);
  const { nextLevel, respectsNeeded } = getRespectsForNextLevel(totalResp);
  const nextRank = nextLevel ? calculateRank(nextLevel) : null;
  const crName    = isOwn ? (user?.name || "") : (crPosts[0]?.creatorName || "Unknown");
  const [isFollowing, setIsFollowing] = useState(false); // UI state
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);

  const handleFollowToggle = async () => {
    if (isFollowingLoading) return;
    setIsFollowingLoading(true);
    const prev = isFollowing;
    setIsFollowing(!prev);
    try {
      // Mock API transit time
      await new Promise(r => setTimeout(r, 600)); 
    } catch (err) {
      setIsFollowing(prev);
    } finally {
      setIsFollowingLoading(false);
    }
  };

  /* sheets: null | "edit"|"share"|"qr"|"followers"|"following"|"starred"|"picOpts" */
  const [sheet, setSheet]       = useState(null);
  const [gridTab, setGridTab]   = useState("posts");
  const lpTimer                  = useRef(null);
  const shareBusy                = useRef(false);
  const [copied, setCopied]     = useState(false);

  /* edit form */
  const [eN,  setEN]  = useState("");
  const [eU,  setEU]  = useState("");
  const [eNk, setENk] = useState("");
  const [eBio,setEBio]= useState("");
  const [eNi, setENi] = useState("");
  const [eBD, setEBD] = useState("");
  const [eCi, setECi] = useState("");
  const [ePic,setEPic]= useState("");
  const [uErr,setUErr]= useState("");
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);
  const quickPicRef = useRef(null);

  const openEdit = () => {
    setEN(user?.name || ""); setEU(user?.username || "");
    setENk(user?.nickname || ""); setEBio(user?.bio || "");
    setENi(user?.niche?.[0] || ""); setEBD(user?.birthday || ""); 
    setECi(user?.city || ""); setEPic(user?.profilePic || "");
    setUErr(""); setSheet("edit");
  };

  const saveEdit = async () => {
    if (!eN.trim()) return;
    const clean = eU.trim().toLowerCase().replace(/[^a-z0-9_.]/g, "");
    if (!clean) { setUErr("Username cannot be empty"); return; }
    
    setIsSaving(true);
    try {
      const currentToken = localStorage.getItem('token');
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentToken}`
        },
        body: JSON.stringify({
          name: eN.trim(),
          username: clean,
          bio: eBio.trim(),
          city: eCi.trim(),
          birthday: eBD,
          niche: eNi,
          profilePic: ePic
        })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("user", JSON.stringify(data.profile));
        
        // Dispatch custom event to notify other components (like Navbar) if needed
        window.dispatchEvent(new Event('user_updated'));
        
        setSheet(null);
        // Instant update without reload!
      } else {
        setUErr(data.error || "Failed to update profile");
      }
    } catch(err) {
      setUErr("Server error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const currentToken = localStorage.getItem('token');
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      const res = await fetch("/api/upload/avatar", {
        method: "POST",
        headers: { "Authorization": `Bearer ${currentToken}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        let finalUrl = data.url;
        // Foolproof fix: force the backend URL if the server returns frontend URL
        if (finalUrl && finalUrl.includes('localhost:3000/uploads/')) {
          finalUrl = finalUrl.replace('localhost:3000', 'localhost:5000');
        } else if (finalUrl && finalUrl.startsWith('/uploads/')) {
          finalUrl = `http://localhost:5000${finalUrl}`;
        }
        setEPic(finalUrl);
      } else {
        alert(data.error?.message || "Upload failed");
      }
    } catch(err) {
      alert("Upload failed");
    }
  };

  const quickChangePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setSheet(null);
    const currentToken = localStorage.getItem('token');
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      // 1. Upload the avatar
      const res = await fetch("/api/upload/avatar", {
        method: "POST",
        headers: { "Authorization": `Bearer ${currentToken}` },
        body: formData
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error?.message || "Upload failed");
        return;
      }
      
      let finalUrl = data.url;
      if (finalUrl && finalUrl.includes('localhost:3000/uploads/')) {
        finalUrl = finalUrl.replace('localhost:3000', 'localhost:5000');
      } else if (finalUrl && finalUrl.startsWith('/uploads/')) {
        finalUrl = `http://localhost:5000${finalUrl}`;
      }
      
      // Cache bust the new avatar
      finalUrl = `${finalUrl}?v=${Date.now()}`;
      
      // 2. Instantly save it to backend
      const putRes = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentToken}`
        },
        body: JSON.stringify({
          name: user?.name || "",
          username: user?.username || "",
          bio: user?.bio || "",
          city: user?.city || "",
          birthday: user?.birthday || "",
          niche: user?.niche || "",
          profilePic: finalUrl
        })
      });
      const putData = await putRes.json();
      if (putData.success) {
        localStorage.setItem("user", JSON.stringify(putData.profile));
        window.dispatchEvent(new Event('user_updated'));
      } else {
        alert("Failed to save new photo");
      }
    } catch(err) {
      alert("Upload error");
    }
  };

  const detectLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || data.address?.state || "";
          if (city) setECi(city);
        } catch(err) {
          console.error("Reverse geocoding failed", err);
        }
      }, (error) => {
        alert("Location access denied or unavailable.");
      });
    } else {
      alert("Geolocation is not supported by your browser");
    }
  };

  const doShare = async (platform) => {
    const url  = `https://drandee.app/u/${user?.username || user?.id}`;
    const text = `Check out @${user?.username || user?.name} on Drandee!`;
    const map  = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      twitter:  `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    };
    if (map[platform]) { window.open(map[platform], "_blank"); return; }
    if (platform === "native") {
      if (shareBusy.current) return;
      if (navigator.share) {
        try { shareBusy.current = true; await navigator.share({ title: "Drandee", text, url }); }
        catch { } finally { shareBusy.current = false; }
        return;
      }
    }
    navigator.clipboard?.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const fmt = (n) => {
    if (!n) return "0";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
    return String(n);
  };

  /* grid data */
  const videoPosts   = crPosts.filter((p) => p.post_type === 'video' || p.videoUrl?.trim());
  const textPosts    = crPosts.filter((p) => p.post_type === 'text');
  const imgPosts     = crPosts.filter((p) => p.post_type === 'photo' || p.post_type === 'image' || (!p.videoUrl?.trim() && p.post_type !== 'text'));
  const featPosts    = crPosts.filter((p) => displayUser?.featuredPosts?.includes(p.id));
  
  const gridData     = gridTab === "posts" ? imgPosts : gridTab === "reels" ? videoPosts : gridTab === "text" ? textPosts : featPosts;

  /* mock social graph */
  const mockFollowers = [
    { id: "u2", name: "Kavitha", bg: "#534AB7", star: true },
    { id: "u3", name: "Mani",    bg: "#1D7A5F", star: true },
    { id: "u4", name: "Priya",   bg: "#B74A4A", star: true },
    { id: "u5", name: "Rajan",   bg: "#7A6B1D", star: false },
    { id: "u6", name: "Deepika", bg: "#1D5C7A", star: false },
  ];
  const starFriends = mockFollowers.filter((f) => f.star);

  if (!isOwn && crPosts.length === 0) {
    return (
      <div style={{...S.page, background: '#ffffff', color: '#000000'}}>
        <div style={S.topbar}>
          <IBtn onClick={() => navigate(-1)}><BackIco color="#000" /></IBtn>
          <span style={{...S.tbTitle, color: '#000'}}>Profile</span>
          <div style={{ width: 34 }} />
        </div>
        <div style={S.notFound}>
          <span style={{...S.notFoundTxt, color: '#666'}}>User not found</span>
          <button style={{...S.goBack, background: '#f0f0f0', color: '#000'}} onClick={() => navigate(-1)}>Go back</button>
        </div>
      </div>
    );
  }

  /* Profile Customization */
  const displayUser = isOwn ? user : (profileData || {});
  const isVerified = displayUser.isVerified || displayUser.is_verified;
  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <div style={{ ...S.page, background: '#ffffff', color: '#000000' }}>

      {/* topbar */}
      <div style={{...S.topbar, borderBottom: '1px solid #eeeeee'}}>
        <IBtn onClick={() => navigate(-1)}><BackIco color="#000" /></IBtn>
        <span style={{...S.tbTitle, color: '#000'}}>
          @{isOwn ? (user?.username || user?.name) : crName}
        </span>
        {isOwn
          ? <IBtn onClick={() => navigate("/settings")}><SettingsIco color="#000" /></IBtn>
          : <div style={{ width: 34 }} />}
      </div>

      <div style={S.scroll}>

        {/* ── hero ── */}
        <div style={{...S.hero, background: '#ffffff', paddingTop: 24}}>

          {/* avatar */}
          <div style={{ position: "relative", marginBottom: 10 }}>
            {/* rank glow ring */}
            <div style={{ ...S.rankRing, borderColor: rank.color, boxShadow: `0 0 12px ${rank.color}30` }} />
            <div
              style={{...S.picWrap, background: '#f5f5f5'}}
              onContextMenu={(e) => { e.preventDefault(); setSheet("picOpts"); }}
              onTouchStart={() => { lpTimer.current = setTimeout(() => setSheet("picOpts"), 520); }}
              onTouchEnd={() => clearTimeout(lpTimer.current)}
              onMouseDown={() => { lpTimer.current = setTimeout(() => setSheet("picOpts"), 520); }}
              onMouseUp={() => clearTimeout(lpTimer.current)}
            >
              <DefaultAvatar
                size={84}
                src={displayUser?.profilePic || displayUser?.profile_pic}
              />
            </div>
            {isOwn && (
              <div style={{...S.camDot, background: '#fff', border: '1px solid #ddd'}} onClick={openEdit}><CamIco color="#000" /></div>
            )}
          </div>

          {/* name + username */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{...S.dispName, color: '#000'}}>
              {isOwn ? (user?.nickname || user?.name || "—") : (profileData?.name || crName)}
            </span>
            {isVerified && <CheckCircle2 size={16} color="#3B82F6" fill="#3B82F6" className="text-white" />}
          </div>
          <span style={{...S.dispUser, color: '#666'}}>
            @{isOwn ? (user?.username || "username") : crName}
          </span>

          {/* rank pill */}
          <div style={{ ...S.rankPill, borderColor: rank.color, color: rank.color, background: `${rank.color}14` }}>
            <StarTinyIco color={rank.color} />
            {rank.title} (Lv. {rank.level})
          </div>

          {/* bio + niche */}
          {displayUser?.bio && <p style={{...S.bio, color: '#444'}}>{displayUser.bio}</p>}
          {displayUser?.niche && <span style={{...S.nicheBadge, background: '#f0f0f0', color: '#000'}}>{displayUser.niche}</span>}

          {/* Link in bio */}
          <div style={{ width: '100%', maxWidth: '400px' }}>
            <LinkInBio userId={targetId} isOwn={isOwn} />
          </div>

          {/* stats */}
          <div style={{...S.statsRow, background: '#f8f9fa', borderRadius: 12, padding: '12px', border: '1px solid #eee'}}>
            <StatBox label="Posts" value={crPosts.length} onClick={() => {}} color="#000" labelColor="#666" />
            <StatBox label="Followers" value={fmt(mockFollowers.length)} onClick={() => setSheet("followers")} border color="#000" labelColor="#666" />
            <StatBox label="Following" value={fmt(mockFollowers.length - 2)} onClick={() => setSheet("following")} border color="#000" labelColor="#666" />
            <StatBox label="Respects" value={fmt(totalResp)} onClick={() => {}} border color="#000" labelColor="#666" />
          </div>

          {/* rank progress */}
          {nextRank && (
            <div style={{...S.progWrap, background: '#f8f9fa', border: '1px solid #eee'}}>
              <div style={{...S.progTrack, background: '#e0e0e0'}}>
                <div style={{ ...S.progFill, width: `${prog}%`, background: `linear-gradient(90deg, ${rank.color}, ${nextRank.color})` }} />
              </div>
              <span style={{...S.progLabel, color: '#666'}}>
                {formatRespects(respectsNeeded)} more respects to <span style={{ color: nextRank.color, fontWeight: 'bold' }}>{nextRank.title}</span>
              </span>
            </div>
          )}

          {/* achievements and badges */}
          {((rank.level > 1) || (displayUser?.customBadges?.length > 0)) && (
            <div style={{ width: '100%', marginTop: 20 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#666', marginLeft: 4 }}>Achievements & Badges</span>
              <div style={{ display: 'flex', gap: 10, marginTop: 8, overflowX: 'auto', paddingBottom: 6 }}>
                {LEVELS.slice(0, rank.level).map(lvl => (
                  <div key={lvl.level} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f8f9fa', borderRadius: 12, padding: '10px 14px', flexShrink: 0, border: `1px solid #eee`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#000', background: lvl.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{lvl.title}</span>
                    <span style={{ fontSize: 10, color: '#666', marginTop: 4 }}>Level {lvl.level}</span>
                  </div>
                ))}
                {displayUser?.customBadges?.map((badge, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '10px 14px', flexShrink: 0, border: `1px solid rgba(255,255,255,0.2)` }}>
                    <span style={{ fontSize: 20, marginBottom: 4 }}>{badge.icon || '🏆'}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{badge.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* action buttons */}
          <div style={S.actRow}>
            {isOwn ? (
              <>
                <button style={{ ...S.actBtn, ...S.actPrimary }} onClick={openEdit}>
                  <EditIco /> Edit profile
                </button>
                <button style={{ ...S.actBtn, ...S.actSecondary }} onClick={() => setSheet("share")}>
                  <ShareIco /> Share
                </button>
                <button style={{ ...S.actBtn, ...S.actSecondary, flex: "none", padding: "0 14px" }}
                  onClick={() => setSheet("qr")}>
                  <QRView userId={`https://drandee.app/creator/${user?.id}`} size={24} />
                </button>
              </>
            ) : (
              <>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  disabled={isFollowingLoading}
                  style={{
                    ...S.actBtn,
                    background: isFollowing ? "var(--bg-secondary)" : "#6366F1",
                    border: isFollowing ? "0.5px solid #252525" : "none",
                    color: isFollowing ? "var(--text-primary)" : "#ffffff", 
                    flex: 1,
                    opacity: isFollowingLoading ? 0.7 : 1
                  }}
                  onClick={handleFollowToggle}
                >
                  {isFollowingLoading ? "Loading..." : isFollowing ? "Following" : "+ Follow"}
                </motion.button>
                <button style={{ ...S.actBtn, ...S.actSecondary }}
                  onClick={() => setSheet("share")}>
                  <ShareIco /> Share
                </button>
              </>
            )}
          </div>

          {/* star friends */}
          {isOwn && starFriends.length > 0 && (
            <div style={S.starRow} onClick={() => setSheet("starred")}>
              <div style={{ display: "flex" }}>
                {starFriends.map((f, i) => (
                  <div key={f.id} style={{
                    ...S.sfAv, background: f.bg,
                    marginLeft: i > 0 ? -8 : 0, zIndex: 5 - i,
                  }}>
                    {f.name.charAt(0)}
                  </div>
                ))}
              </div>
              <span style={S.sfLabel}>
                Star friends · {starFriends.slice(0, 2).map((f) => f.name.split(" ")[0]).join(", ")}
              </span>
              <ChevIco />
            </div>
          )}
        </div>

        {/* ── featured posts ── */}
        {displayUser?.featuredPosts?.length > 0 && (
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderTop: '0.5px solid rgba(255,255,255,0.05)', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8, display: 'block' }}>Featured</span>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
              {crPosts.filter(p => displayUser.featuredPosts.includes(p.id)).map(fp => (
                <div 
                  key={`feat-${fp.id}`} 
                  onClick={() => setViewingPostIndex(crPosts.indexOf(fp))}
                  style={{ width: 120, height: 160, borderRadius: 12, flexShrink: 0, overflow: 'hidden', position: 'relative', cursor: 'pointer' }}
                >
                  <img src={fp.thumbnailUrl || fp.imageUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: 6, left: 6, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 8 }}>
                    <PlayIco width={10} height={10} />
                    <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>{fmt(fp.totalRespects)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── post grid ── */}
        <div style={S.gridSection}>
          <div style={S.gridTabRow}>
            {[
              { id: "posts",    icon: <GridIco color={gridTab === "posts" ? "#000" : "#888"} />,    label: "Posts",    count: imgPosts.length },
              { id: "reels",    icon: <ReelIco color={gridTab === "reels" ? "#000" : "#888"} />,    label: "Reels",    count: videoPosts.length },
              { id: "text",     icon: <TypeIco color={gridTab === "text" ? "#000" : "#888"} />,    label: "Text",     count: textPosts.length },
              { id: "featured", icon: <StarIco color={gridTab === "featured" ? "#000" : "#888"} />,    label: "Featured", count: featPosts.length },
            ].map((t) => (
              <button key={t.id} type="button"
                style={{
                  ...S.gridTab,
                  color: gridTab === t.id ? "#000" : "#888",
                  borderBottom: gridTab === t.id ? `2px solid #6366F1` : "2px solid transparent",
                }}
                onClick={() => setGridTab(t.id)}
              >
                {t.icon}
                {t.label}
                {t.count > 0 && <span style={S.tabBadge}>{t.count}</span>}
              </button>
            ))}
          </div>

          <div style={S.grid}>
            {gridData.length === 0 ? (
              <div style={S.noContent}>
                <span style={S.noTxt}>
                  {gridTab === "posts" ? "No posts yet"
                   : gridTab === "reels" ? "No reels yet"
                   : gridTab === "text" ? "No text posts yet"
                   : "No featured posts yet"}
                </span>
              </div>
            ) : (
              gridData.map((post, i) => (
                <div key={post.id} style={S.cell} onClick={() => setViewingPostIndex(i)}>
                  {post.videoUrl?.trim() ? (
                    <video src={post.videoUrl} style={S.cellMedia} muted playsInline />
                  ) : (
                    <div style={{ ...S.cellBg, background: CELL_BG[i % CELL_BG.length] }}>
                      {gridTab === "reels" ? <PlayIco /> : <ImgIco />}
                    </div>
                  )}
                  <div style={S.cellOv}>
                    {gridTab === "top" && (
                      <span style={S.cellRank}>#{i + 1}</span>
                    )}
                    <div style={S.cellStats}>
                      <EyeTinyIco />
                      <span style={S.cStat}>{fmt(post.watchCount || 0)}</span>
                      <HandTinyIco />
                      <span style={S.cStat}>{fmt(post.totalRespects || 0)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ height: 80 }} />
      </div>

      {viewingPostIndex !== null && (
        <ProfilePostViewer 
          posts={gridData} 
          initialIndex={viewingPostIndex} 
          onClose={() => setViewingPostIndex(null)} 
        />
      )}

      {/* ══════════ EDIT PROFILE ══════════ */}
      {sheet === "edit" && (
        <Ov onClose={() => setSheet(null)}>
          <div style={S.hdl} />
          <div style={S.shHdr}>
            <span style={S.shTitle}>Edit Profile</span>
            <button type="button" style={{ ...S.saveBtn, opacity: isSaving ? 0.7 : 1 }} onClick={saveEdit} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>

          {/* avatar in edit */}
          <div style={S.editAvRow}>
            {ePic ? (
              <DefaultAvatar size={60} src={ePic} />
            ) : (
              <DefaultAvatar size={60} src={user?.profilePic || user?.profile_pic} />
            )}
            <button type="button" style={S.chgPhotoBtn} onClick={() => fileInputRef.current?.click()}>
              Change photo
            </button>
            <input type="file" ref={fileInputRef} hidden accept="image/jpeg, image/png, image/webp" onChange={handleAvatarChange} />
          </div>

          <div style={S.editScroll}>
            <Sec label="Public Info">
              <Fld label="Name">
                <input style={S.inp} value={eN}
                  onChange={(e) => setEN(e.target.value)} placeholder="Full name" />
              </Fld>
              <Fld label="Username">
                <div style={S.pfxWrap}>
                  <span style={S.pfx}>@</span>
                  <input style={S.inpFlat} value={eU}
                    onChange={(e) => {
                      setEU(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""));
                      setUErr("");
                    }}
                    placeholder="username" />
                </div>
                {uErr && <span style={S.errTxt}>{uErr}</span>}
              </Fld>
              <Fld label="Nickname (shown as display name)">
                <input style={S.inp} value={eNk}
                  onChange={(e) => setENk(e.target.value)} placeholder="Optional display nickname" />
              </Fld>
              <Fld label="Bio">
                <textarea style={S.ta} rows={3}
                  value={eBio}
                  onChange={(e) => setEBio(e.target.value.slice(0, 150))}
                  placeholder="Tell people about yourself" />
                <span style={S.cc}>{eBio.length}/150</span>
              </Fld>
              <Fld label="Niche / Category">
                <div style={S.nicheGrid}>
                  {NICHES.map((n) => (
                    <button key={n} type="button"
                      style={{
                        ...S.nichBtn,
                        background: eNi === n ? "#6366F1" : "#f9f9f9",
                        borderColor: eNi === n ? "#6366F1" : "#e0e0e0",
                        color: eNi === n ? "#ffffff" : "#222222",
                      }}
                      onClick={() => setENi(eNi === n ? "" : n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </Fld>
            </Sec>

            <Sec label="Personal Info">
              <Fld label="City">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input style={{ ...S.inp, flex: 1 }} value={eCi}
                    onChange={(e) => setECi(e.target.value)} placeholder="Your city" />
                  <button type="button" onClick={detectLocation} style={{ background: '#f0f0f0', border: 'none', padding: '12px 14px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: '600', color: '#6366F1' }}>
                    Detect
                  </button>
                </div>
              </Fld>
              <Fld label="Birthday">
                <input type="date" style={S.inp} value={eBD}
                  onChange={(e) => setEBD(e.target.value)} />
              </Fld>
              <Fld label="Email (login)">
                <input style={{ ...S.inp, color: "#888", background: "#f5f5f5" }}
                  value={user?.email || ""} disabled />
                <span style={S.hintTxt}>Change in Settings → Account</span>
              </Fld>
            </Sec>

            <Sec label="Accounts on this device">
              <div style={S.accsWrap}>
                <div style={S.accRow}>
                  <DefaultAvatar size={34} src={user?.profilePic || user?.profile_pic} />
                  <div style={{ flex: 1 }}>
                    <span style={S.accName}>{user?.name}</span>
                    <span style={S.accSub}>@{user?.username} · Drandee</span>
                  </div>
                  <span style={S.accActive}>Active</span>
                </div>
                <button type="button" style={S.addAccBtn}>
                  <PlusSmIco /> Add account
                </button>
              </div>
            </Sec>

            <div style={{ height: 24 }} />
          </div>
        </Ov>
      )}

      {/* ══════════ SHARE PROFILE ══════════ */}
      {sheet === "share" && (
        <Ov onClose={() => setSheet(null)}>
          <div style={S.hdl} />
          <span style={S.shTitle}>Share profile</span>
          {copied && (
            <div style={S.toast}><ChkIco /> Link copied!</div>
          )}
          <div style={S.shareGrid}>
            {[
              { label: "WhatsApp", platform: "whatsapp", color: "#25D366" },
              { label: "Telegram", platform: "telegram", color: "#0088cc" },
              { label: "Twitter",  platform: "twitter",  color: "#1DA1F2" },
              { label: "More",     platform: "native",   color: "#6366F1" },
            ].map((s) => (
              <button key={s.label} type="button" style={S.shrOpt}
                onClick={() => doShare(s.platform)}>
                <div style={{ ...S.shrIco, background: `${s.color}16`, borderColor: `${s.color}30` }}>
                  <SharePfIco color={s.color} />
                </div>
                <span style={S.shrLabel}>{s.label}</span>
              </button>
            ))}
          </div>
          <button type="button" style={S.cpRow} onClick={() => doShare("copy")}>
            <LinkIco />
            <span style={S.cpUrl}>drandee.app/u/{user?.username || user?.id}</span>
            <span style={{ ...S.cpBtn, color: copied ? "#1D9E75" : "#6366F1" }}>
              {copied ? "Copied" : "Copy"}
            </span>
          </button>
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 12px" }}>
            <button type="button" style={S.qrHintBtn} onClick={() => setSheet("qr")}>
              <QRView userId={`https://drandee.app/creator/${user?.id}`} size={20} /> <span style={{ marginLeft: 6 }}>Show QR code</span>
            </button>
          </div>
        </Ov>
      )}

      {/* ══════════ QR CODE ══════════ */}
      {sheet === "qr" && (
        <Ov onClose={() => setSheet(null)}>
          <div style={S.hdl} />
          <span style={S.shTitle}>Your QR code</span>
          <p style={S.qrSub}>Scan to open this profile instantly — unique to your account</p>
          <div style={S.qrWrap}>
            <div className="flex flex-col items-center">
              <DrandeeWordmark className="text-2xl mb-4" showGradient={true} />
              <QRView userId={`https://drandee.app/creator/${user?.id}`} size={200} />
              <div style={{marginTop: 12, fontSize: 14, color: '#888', fontWeight: 500}}>Scan to view this profile</div>
            </div>
          </div>
          <div style={S.qrInfo}>
            <DefaultAvatar size={38} src={user?.profilePic || user?.profile_pic} />
            <div>
              <span style={S.qrName}>{user?.name}</span>
              <span style={S.qrUser}>
                {user?.username ? `@${user.username}` : <span className="text-[#00F0FF]">Choose username</span>}
              </span>
            </div>
          </div>
          <div style={S.qrFoot}>
            <span style={S.qrFootTxt}>drandee.app/u/{user?.username}</span>
          </div>
        </Ov>
      )}

      {/* ══════════ FOLLOWERS ══════════ */}
      {sheet === "followers" && (
        <Ov onClose={() => setSheet(null)}>
          <div style={S.hdl} />
          <span style={S.shTitle}>Followers · {mockFollowers.length}</span>
          <div style={S.listWrap}>
            {mockFollowers.map((f, i) => {
              const isFollowingBack = i % 2 === 0; // Mock following back state
              return (
                <div key={f.id} style={S.uRow}
                  onClick={() => { setSheet(null); navigate(`/profile/${f.id}`); }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9f9f9'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ ...S.uAv, background: f.bg }}>{f.name.charAt(0)}</div>
                  <div style={S.uInfo}>
                    <span style={S.uName}>
                      {f.name}
                      {f.star && <span style={S.starTag}> ★</span>}
                    </span>
                    <span style={S.uSub}>@{f.name.toLowerCase().replace(' ', '')}</span>
                  </div>
                  <button 
                    onClick={(e) => e.stopPropagation()} 
                    style={{ 
                      ...S.followBtn, 
                      background: isFollowingBack ? '#f0f0f0' : '#6366F1', 
                      color: isFollowingBack ? '#000' : '#fff' 
                    }}
                  >
                    {isFollowingBack ? 'Following' : 'Follow'}
                  </button>
                </div>
              );
            })}
          </div>
        </Ov>
      )}

      {/* ══════════ FOLLOWING ══════════ */}
      {sheet === "following" && (
        <Ov onClose={() => setSheet(null)}>
          <div style={S.hdl} />
          <span style={S.shTitle}>Following · {mockFollowers.length - 2}</span>
          <div style={S.listWrap}>
            {mockFollowers.slice(0, 3).map((f, i) => (
              <div key={f.id} style={S.uRow}
                onClick={() => { setSheet(null); navigate(`/profile/${f.id}`); }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f9f9f9'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ ...S.uAv, background: f.bg }}>{f.name.charAt(0)}</div>
                <div style={S.uInfo}>
                  <span style={S.uName}>{f.name}</span>
                  <span style={{ ...S.uSub, color: i < 2 ? "#FFD700" : "#666" }}>
                    {i < 2 ? "★ Star friend · " : ""}@{f.name.toLowerCase().replace(' ', '')}
                  </span>
                </div>
                <button 
                  onClick={(e) => e.stopPropagation()} 
                  style={{ ...S.followBtn, background: '#f0f0f0', color: '#000' }}
                >
                  Following
                </button>
              </div>
            ))}
          </div>
        </Ov>
      )}

      {/* ══════════ STAR FRIENDS ══════════ */}
      {sheet === "starred" && (
        <Ov onClose={() => setSheet(null)}>
          <div style={S.hdl} />
          <span style={S.shTitle}>Star friends</span>
          <p style={S.qrSub}>Your top connections — people you interact with most</p>
          <div style={S.listWrap}>
            {starFriends.map((f, i) => (
              <div key={f.id} style={S.uRow}
                onClick={() => { setSheet(null); navigate(`/profile/${f.id}`); }}>
                <div style={{ ...S.uAv, background: f.bg }}>{f.name.charAt(0)}</div>
                <div style={S.uInfo}>
                  <span style={S.uName}>{f.name}</span>
                  <span style={{ ...S.uSub, color: "#FFD700" }}>★ #{i + 1} Star friend</span>
                </div>
                <ChevIco />
              </div>
            ))}
          </div>
        </Ov>
      )}

      {/* ══════════ PIC OPTIONS ══════════ */}
      {sheet === "picOpts" && (
        <Ov onClose={() => setSheet(null)}>
          <div style={S.hdl} />
          <button type="button" style={S.picOpt} onClick={() => setSheet("viewPic")}>
            View Profile Photo
          </button>
          {isOwn && (
            <>
              <button type="button" style={S.picOpt} onClick={() => quickPicRef.current?.click()}>
                Change Photo
              </button>
              <input type="file" ref={quickPicRef} hidden accept="image/jpeg, image/png, image/webp" onChange={quickChangePhoto} />
            </>
          )}
          <button type="button" style={{ ...S.picOpt, color: "rgba(255,255,255,0.3)" }}
            onClick={() => setSheet(null)}>
            Cancel
          </button>
        </Ov>
      )}

      {/* ══════════ VIEW PROFILE PHOTO ══════════ */}
      {sheet === "viewPic" && (
        <Ov onClose={() => setSheet(null)}>
          <div style={S.hdl} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0 10px', width: '100%' }}>
            <DefaultAvatar size={220} src={displayUser?.profilePic || displayUser?.profile_pic} />
            <div style={{ marginTop: 32, width: '100%', padding: '0 20px' }}>
               <button type="button" style={{ ...S.saveBtn, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: '14px', borderRadius: 14 }} onClick={() => { setSheet(null); doShare("copy"); }}>
                 <SharePfIco color="#fff" />
                 <span style={{ fontSize: 16, fontWeight: '600' }}>Share Profile</span>
               </button>
            </div>
          </div>
        </Ov>
      )}

      <Navbar />
    </div>
  );
};

/* ─── helpers ───────────────────────────────────────── */
const Ov = ({ children, onClose }) => (
  <div style={S.ov} onClick={onClose}>
    <div style={S.shWrap} onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  </div>
);

const IBtn = ({ children, onClick }) => (
  <button type="button" style={S.iBtn} onClick={onClick}>{children}</button>
);

const Sec = ({ label, children }) => (
  <div style={S.sec}>
    <span style={S.secLbl}>{label}</span>
    {children}
  </div>
);

const Fld = ({ label, children }) => (
  <div style={S.fld}>
    <label style={S.fldLbl}>{label}</label>
    {children}
  </div>
);

const StatBox = ({ label, value, onClick, border, color, labelColor }) => (
  <div style={{ ...S.statBox, borderLeft: border ? "1px solid #ddd" : "none" }} onClick={onClick}>
    <span style={{...S.statN, color: color || "var(--text-primary)"}}>{value}</span>
    <span style={{...S.statL, color: labelColor || "rgba(255,255,255,0.55)"}}>{label}</span>
  </div>
);

/* ─── constants ─────────────────────────────────────── */
const CELL_BG = [
  "#0c0820","#080d1a","#0a1408","#120808","#0a0c08",
  "#08100a","#100c08","#080a10","#0c0808",
];

/* ─── icons ─────────────────────────────────────────── */
const si = (d, w = 20, c = "rgba(255,255,255,0.7)") => (
  <svg width={w} height={w} viewBox="0 0 24 24" fill="none">
    <path d={d} stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BackIco = ({ color = "#fff" }) => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 18l-6-6 6-6"/>
  </svg>
);
const SettingsIco = ({ color = "#fff" }) => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
    <path stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
);
const CamIco = ({ color = "#fff" }) => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
    <path stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
    <circle cx="12" cy="13" r="4" stroke={color} strokeWidth="2"/>
  </svg>
);
const ShareIco = ({ color = "#fff" }) => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
    <circle cx="18" cy="5" r="3" stroke={color} strokeWidth="2"/>
    <circle cx="6" cy="12" r="3" stroke={color} strokeWidth="2"/>
    <circle cx="18" cy="19" r="3" stroke={color} strokeWidth="2"/>
    <path stroke={color} strokeWidth="2" d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>
  </svg>
);
const EditIco = ({ color = "#fff" }) => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
    <path stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const GridIco = ({ color = "#fff" }) => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <rect width="7" height="7" x="3" y="3" stroke={color} strokeWidth="2" rx="1"/>
    <rect width="7" height="7" x="14" y="3" stroke={color} strokeWidth="2" rx="1"/>
    <rect width="7" height="7" x="14" y="14" stroke={color} strokeWidth="2" rx="1"/>
    <rect width="7" height="7" x="3" y="14" stroke={color} strokeWidth="2" rx="1"/>
  </svg>
);
const ReelIco = ({ color = "#fff" }) => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <rect width="18" height="18" x="3" y="3" stroke={color} strokeWidth="2" rx="2"/>
    <path stroke={color} strokeLinecap="round" strokeWidth="2" d="M9 3v18M15 3v18"/>
  </svg>
);
const TypeIco = ({ color = "#fff" }) => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7V4h16v3M9 20h6M12 4v16"/>
  </svg>
);
const StarIco = ({ color = "#fff" }) => (
  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
    <polygon stroke={color} strokeLinejoin="round" strokeWidth="2" points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const StarTinyIco = ({ color = "#fff" }) => (
  <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
    <polygon stroke={color} strokeLinejoin="round" strokeWidth="2" points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const ChevIco      = () => si("M9 18L15 12L9 6", 16, "rgba(255,255,255,0.3)");
const LinkIco      = () => si("M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71", 14, "rgba(255,255,255,0.4)");
const ChkIco       = () => si("M20 6L9 17l-5-5", 14, "#1D9E75");
const PlayIco      = () => si("M6 4L20 12L6 20V4Z", 22, "rgba(255,255,255,0.2)");
const ImgIco       = () => si("M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3l2-3h4l2 3h3a2 2 0 0 1 2 2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", 22, "rgba(255,255,255,0.2)");
const EyeTinyIco   = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="rgba(255,255,255,0.6)" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="rgba(255,255,255,0.6)" strokeWidth="2"/></svg>;
const HandTinyIco  = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M7 11v8a1 1 0 0 0 1 1h7.5a2.5 2.5 0 0 0 2.45-2L19 13.5a1.5 1.5 0 0 0-1.5-1.8h-3.6l.5-3A2 2 0 0 0 12.4 6.3L9 11H7zM3 11h4v9H3v-9z" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round"/></svg>;
const PlusSmIco    = () => si("M12 5v14M5 12h14", 15, "#6366F1");
const SharePfIco   = ({ color }) => si("M15 5L20 10M20 10L15 15M20 10H9C6.79 10 5 11.79 5 14V19", 22, color);

/* ─── styles ─────────────────────────────────────────── */
const S = {
  page:     { background:"#ffffff", minHeight:"100vh", color:"#000000", fontFamily:"-apple-system,system-ui,sans-serif", display:"flex", flexDirection:"column" },
  topbar:   { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px 8px", position:"sticky", top:0, background:"#ffffff", zIndex:50, borderBottom:"1px solid #eeeeee" },
  tbTitle:  { fontSize:15, fontWeight:"600", color:"#000", letterSpacing:"0.2px" },
  iBtn:     { width:34, height:34, background:"none", border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", padding:0 },
  scroll:   { flex:1, overflowY:"auto", paddingBottom:"calc(env(safe-area-inset-bottom) + 80px)" },
  notFound: { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, minHeight:"60vh" },
  notFoundTxt:{ fontSize:14, color:"#888" },
  goBack:   { background:"#f0f0f0", border:"1px solid #e0e0e0", borderRadius:10, padding:"9px 20px", color:"#000", fontSize:13, cursor:"pointer" },

  hero:     { display:"flex", flexDirection:"column", alignItems:"center", padding:"10px 20px 14px", background: '#ffffff', paddingTop: 24 },
  rankRing: { position:"absolute", inset:-5, borderRadius:"50%", border:"2.5px solid", pointerEvents:"none", zIndex:0 },
  picWrap:  { position:"relative", zIndex:1, cursor:"pointer", background: '#f5f5f5', borderRadius: '50%' },
  camDot:   { position:"absolute", bottom:0, right:-2, width:24, height:24, borderRadius:"50%", background:"#fff", border:"1px solid #ddd", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", zIndex:2 },
  dispName: { fontSize:18, fontWeight:"600", color:"#000", marginTop:10 },
  dispUser: { fontSize:13, color:"#666", marginTop:2 },
  rankPill: { display:"flex", alignItems:"center", gap:5, borderRadius:20, border:"1px solid", padding:"4px 11px", marginTop:9, fontSize:12, fontWeight:"500" },
  bio:      { fontSize:13, color:"#444", textAlign:"center", marginTop:9, lineHeight:"1.55", maxWidth:280 },
  nicheBadge:{ fontSize:11, color:"#000", background:"#f0f0f0", borderRadius:10, padding:"3px 10px", marginTop:7 },
  statsRow: { display:"flex", width:"100%", background:"#f8f9fa", border:"1px solid #eee", borderRadius:14, overflow:"hidden", marginTop:14 },
  statBox:  { flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"12px 6px", cursor:"pointer" },
  statN:    { fontSize:18, fontWeight:"600", color:"#000", lineHeight:1 },
  statL:    { fontSize:10, color:"#666", marginTop:3, letterSpacing:"0.3px" },
  progWrap: { width:"100%", marginTop:12, background: '#f8f9fa', border: '1px solid #eee', borderRadius: 8, padding: 8 },
  progTrack:{ height:4, background:"#e0e0e0", borderRadius:2, overflow:"hidden" },
  progFill: { height:"100%", borderRadius:2, transition:"width 0.6s" },
  progLabel:{ fontSize:10, color:"#666", marginTop:6, display:"block", textAlign:"center" },
  actRow:   { display:"flex", gap:10, marginTop:16, width:"100%", justifyContent:"center" },
  actBtn:   { display:"flex", alignItems:"center", justifyContent:"center", gap:6, height:42, borderRadius:24, fontSize:14, fontWeight:"600", cursor:"pointer", flex:1, transition: "all 0.2s ease" },
  actPrimary:{ background:"linear-gradient(135deg, #6366F1, #8B5CF6)", border:"none", color:"#fff", boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)" },
  actSecondary:{ background:"#f8f9fa", border:"1px solid #eee", color:"#000" },
  starRow:  { display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"#f8f9fa", border:"1px solid #eee", borderRadius:12, marginTop:12, cursor:"pointer", width:"100%" },
  sfAv:     { width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:"600", color:"#fff", border:"1.5px solid #fff", position:"relative" },
  sfLabel:  { flex:1, fontSize:12, color:"#666", fontWeight:"500" },

  gridSection:{ marginTop:16 },
  gridTabRow: { display:"flex", borderBottom:"1px solid #eee", padding:"0 12px", position: "relative" },
  gridTab:    { flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, fontSize:13, fontWeight:"600", background:"none", border:"none", padding:"12px 0", cursor:"pointer", transition: "color 0.2s ease" },
  tabBadge:   { fontSize:10, background:"#f0f0f0", color:"#333", borderRadius:10, padding:"2px 6px" },
  grid:       { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"2px" },
  cell:       { aspectRatio:"1", position:"relative", cursor:"pointer", overflow:"hidden", background: "#f5f5f5" },
  cellMedia:  { position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" },
  cellBg:     { width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" },
  cellOv:     { position:"absolute", inset:0, background:"linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)", display:"flex", flexDirection:"column", justifyContent:"flex-end", padding:"6px" },
  cellRank:   { fontSize:11, color:"#FFD700", fontWeight:"700", marginBottom:2 },
  cellStats:  { display:"flex", alignItems:"center", gap:4 },
  cStat:      { fontSize:10, color:"rgba(255,255,255,0.9)" },
  noContent:  { gridColumn:"1/-1", padding:"40px 0", display:"flex", justifyContent:"center" },
  noTxt:      { fontSize:14, color:"#888", fontWeight: "500" },

  ov:     { position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:200, display:"flex", alignItems:"flex-end" },
  shWrap: { background:"#ffffff", borderRadius:"24px 24px 0 0", width:"100%", borderTop:"1px solid #eee", paddingBottom:"max(24px,env(safe-area-inset-bottom))", maxHeight:"88vh", display:"flex", flexDirection:"column", boxShadow: "0 -4px 20px rgba(0,0,0,0.1)" },
  hdl:    { width:40, height:4, background:"#ddd", borderRadius:2, margin:"12px auto 16px", flexShrink:0 },
  shHdr:  { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 20px 12px", borderBottom:"1px solid #eee", flexShrink:0 },
  shTitle:{ fontSize:16, fontWeight:"700", color:"#000", padding:"0 20px 12px", display:"block", flexShrink:0 },
  saveBtn:{ background:"#6366F1", border:"none", borderRadius:20, padding:"8px 20px", fontSize:13, fontWeight:"600", color:"#fff", cursor:"pointer" },

  editAvRow: { display:"flex", alignItems:"center", gap:14, padding:"10px 20px 16px", borderBottom:"1px solid #eee", flexShrink:0 },
  chgPhotoBtn:{ background:"none", border:"none", color:"#6366F1", fontSize:13, fontWeight:"600", cursor:"pointer", padding:0 },
  editScroll: { overflowY:"auto", flex:1, paddingBottom:8 },

  sec:    { padding:"20px 20px 8px" },
  secLbl: { fontSize:12, fontWeight:"700", color:"#888", textTransform:"uppercase", letterSpacing:"0.5px", display:"block", marginBottom:14 },
  fld:    { marginBottom:16 },
  fldLbl: { fontSize:13, fontWeight:"600", color:"#444", display:"block", marginBottom:6 },
  inp:    { background:"#f9f9f9", border:"1px solid #e0e0e0", borderRadius:12, padding:"12px 16px", fontSize:14, color:"#000", outline:"none", width:"100%", boxSizing:"border-box", transition:"border-color 0.2s" },
  inpFlat:{ background:"none", border:"none", padding:"10px 4px", fontSize:14, color:"#000", outline:"none", flex:1 },
  ta:     { background:"#f9f9f9", border:"1px solid #e0e0e0", borderRadius:12, padding:"12px 16px", fontSize:14, color:"#000", outline:"none", width:"100%", resize:"none", fontFamily:"inherit", lineHeight:"1.5", boxSizing:"border-box" },
  cc:     { fontSize:12, color:"#888", textAlign:"right", display:"block", marginTop:4 },
  pfxWrap:{ display:"flex", alignItems:"center", background:"#f9f9f9", border:"1px solid #e0e0e0", borderRadius:12, padding:"0 16px" },
  pfx:    { color:"#666", fontSize:14, fontWeight:"500" },
  errTxt: { fontSize:12, color:"#e05555", marginTop:6, display:"block", fontWeight:"500" },
  hintTxt:{ fontSize:12, color:"#888", marginTop:6, display:"block" },
  nicheGrid:{ display:"flex", flexWrap:"wrap", gap:8 },
  nichBtn:  { borderRadius:20, padding:"8px 14px", fontSize:12, fontWeight:"500", cursor:"pointer", border:"1px solid" },
  gRow:   { display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderRadius:12, border:"1px solid", cursor:"pointer", background:"none", textAlign:"left", width:"100%" },
  radio:  { width:20, height:20, borderRadius:"50%", border:"2px solid", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  radioDot:{ width:10, height:10, borderRadius:"50%", background:"#6366F1" },
  accsWrap:{ background:"#f9f9f9", border:"1px solid #eee", borderRadius:12, overflow:"hidden" },
  accRow: { display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderBottom:"1px solid #eee" },
  accName:{ fontSize:14, fontWeight:"600", color:"#000", display:"block" },
  accSub: { fontSize:12, color:"#666", display:"block" },
  accActive:{ fontSize:11, fontWeight:"600", color:"#1D9E75", background:"rgba(29,158,117,0.1)", borderRadius:10, padding:"4px 10px" },
  addAccBtn:{ display:"flex", alignItems:"center", gap:8, padding:"14px 16px", background:"none", border:"none", color:"#6366F1", fontSize:14, fontWeight:"600", cursor:"pointer", width:"100%" },

  shareGrid:{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, padding:"16px 20px 12px" },
  shrOpt:   { display:"flex", flexDirection:"column", alignItems:"center", gap:8, cursor:"pointer", background:"none", border:"none", padding:0, transition:"transform 0.2s hover:scale-105" },
  shrIco:   { width:56, height:56, borderRadius:18, border:"1px solid", display:"flex", alignItems:"center", justifyContent:"center" },
  shrLabel: { fontSize:11, fontWeight:"600", color:"#444" },
  cpRow:    { display:"flex", alignItems:"center", gap:12, margin:"8px 20px 12px", background:"#f9f9f9", border:"1px solid #eee", borderRadius:14, padding:"14px 16px", cursor:"pointer" },
  cpUrl:    { flex:1, fontSize:13, color:"#666", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  cpBtn:    { fontSize:13, cursor:"pointer", whiteSpace:"nowrap", fontWeight:"700" },
  qrHintBtn:{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", color:"#666", fontSize:13, fontWeight:"600", cursor:"pointer" },

  qrSub:    { fontSize:14, color:"#666", textAlign:"center", padding:"0 20px 12px", display:"block" },
  qrWrap:   { display:"flex", justifyContent:"center", padding:"20px 0 16px" },
  qrInfo:   { display:"flex", alignItems:"center", gap:14, padding:"0 24px 12px", justifyContent:"center" },
  qrName:   { fontSize:16, fontWeight:"700", color:"#000", display:"block" },
  qrUser:   { fontSize:13, color:"#666", display:"block" },
  qrFoot:   { padding:"12px 24px 8px", borderTop:"1px solid #eee", textAlign:"center" },
  qrFootTxt:{ fontSize:12, fontWeight:"500", color:"#888" },

  listWrap: { overflowY:"auto", flex:1 },
  uRow:     { display:"flex", alignItems:"center", gap:14, padding:"14px 20px", cursor:"pointer", borderBottom:"1px solid #f5f5f5", transition:"background 0.2s" },
  uAv:      { width:48, height:48, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:"600", color:"#fff", flexShrink:0, boxShadow:"0 2px 8px rgba(0,0,0,0.1)" },
  uInfo:    { flex:1, minWidth:0 },
  uName:    { fontSize:15, fontWeight:"600", color:"#000", display:"block" },
  uSub:     { fontSize:13, color:"#666", display:"block", marginTop:2 },
  starTag:  { color:"#FFD700", fontSize:14 },
  followBtn:{ padding:"6px 16px", borderRadius:"20px", fontSize:13, fontWeight:"600", border:"none", cursor:"pointer", transition:"all 0.2s ease" },
  picOpt:   { background:"none", border:"none", borderBottom:"1px solid #eee", padding:"16px 20px", fontSize:15, color:"#000", cursor:"pointer", textAlign:"center", width:"100%" },
  toast:    { display:"flex", alignItems:"center", gap:8, margin:"0 18px 10px", padding:"10px 14px", background:"#e8f5e9", border:"1px solid #c8e6c9", borderRadius:10, fontSize:13, color:"#2e7d32", flexShrink:0 },
};

export default Profile;