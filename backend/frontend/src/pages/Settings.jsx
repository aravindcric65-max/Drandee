import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../context/UserContext';
import ProfileContentViewer from '../components/profile/ProfileContentViewer';
import DefaultAvatar from '../components/DefaultAvatar';
import { PlaySmIcon, ReelNavIcon } from '../components/reels/ReelsIcons';
import {
  ArrowLeft, Search, User, ShieldAlert, Key, Bell, 
  Activity, Ban, VolumeX, DownloadCloud, CheckCircle2, Monitor, TrendingUp
} from 'lucide-react';

/* ─── API Helper ─── */
const apiCall = async (endpoint, method = 'GET', body = null) => {
  try {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';

    const res = await fetch(`/api${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    if (!res.ok) {
      // Try to parse body for error message; fall back to HTTP status text
      let errBody = {};
      try { errBody = await res.json(); } catch (_) {}
      return { success: false, error: errBody.error || res.statusText || 'Request failed' };
    }

    return res.json();
  } catch (err) {
    return { success: false, error: err.message || 'Network error' };
  }
};

/* ─── Styles ─── */
const S = {
  page: { background: "#121212", height: "100dvh", display: "flex", flexDirection: "column", color: "#fff", fontFamily: "Inter, sans-serif", overflowY: "auto", overflowX: "hidden", paddingBottom: "max(env(safe-area-inset-bottom), 24px)" },
  topbar: { display: "flex", alignItems: "center", padding: "16px 24px", background: "rgba(18,18,18,0.8)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid rgba(255,255,255,0.05)" },
  iBtn: { background: "none", border: "none", padding: 8, cursor: "pointer", display: "flex", color: "#fff" },
  tbTitle: { fontSize: 20, fontWeight: "700", marginLeft: 16 },
  
  container: { display: "flex", flexWrap: "wrap", flex: 1, maxWidth: 1200, margin: "0 auto", width: "100%", padding: "16px", gap: 24 },
  
  sidebar: { flex: "1 1 280px", maxWidth: "100%", display: "flex", flexDirection: "column", gap: 16 },
  searchWrap: { position: "relative", marginBottom: 16 },
  searchInput: { width: "100%", background: "#1E1E1E", border: "1px solid #333", borderRadius: 12, padding: "14px 16px 14px 44px", color: "#fff", outline: "none", fontSize: 15 },
  searchIcon: { position: "absolute", left: 14, top: 14, color: "#888" },
  
  navItem: { display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 12, cursor: "pointer", transition: "all 0.2s", border: "none", width: "100%", textAlign: "left" },
  navItemActive: { background: "#6366F1", color: "#fff" },
  navItemInactive: { background: "transparent", color: "#A0A0A0" },
  
  content: { flex: "3 1 300px", maxWidth: "100%", background: "#1E1E1E", borderRadius: 20, padding: "24px", border: "1px solid rgba(255,255,255,0.05)", minHeight: 600 },
  
  sectionTitle: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  sectionDesc: { color: "#A0A0A0", fontSize: 15, marginBottom: 32 },
  
  formGroup: { marginBottom: 24 },
  label: { display: "block", fontSize: 14, fontWeight: "600", color: "#A0A0A0", marginBottom: 8 },
  input: { width: "100%", background: "#121212", border: "1px solid #333", borderRadius: 12, padding: "14px 16px", color: "#fff", outline: "none", fontSize: 15 },
  
  toggleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid #333" },
  toggleBtn: { width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", transition: "all 0.2s", position: "relative" },
  toggleDot: { width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, transition: "all 0.2s" },
  
  btn: { background: "#6366F1", color: "#fff", border: "none", borderRadius: 12, padding: "14px 24px", fontSize: 15, fontWeight: "600", cursor: "pointer", transition: "opacity 0.2s" },
  dangerBtn: { background: "#FE2C55", color: "#fff", border: "none", borderRadius: 12, padding: "14px 24px", fontSize: 15, fontWeight: "600", cursor: "pointer", transition: "opacity 0.2s" },
  
  toastWrap: { position: "fixed", bottom: 40, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 9999, pointerEvents: "none" },
  toast: { background: "#333", color: "#fff", padding: "14px 24px", borderRadius: 30, fontSize: 14, fontWeight: "600", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }};

/* ─── Shared Components ─── */
const Toggle = ({ active, onChange }) => (
  <button onClick={onChange} style={{...S.toggleBtn, background: active ? "#6366F1" : "#444"}}>
    <div style={{...S.toggleDot, left: active ? 22 : 2}} />
  </button>
);

const Toast = ({ msg }) => (
  <div style={S.toastWrap}>
    <div style={S.toast}><CheckCircle2 size={18} color="#4ECDC4"/> {msg}</div>
  </div>
);

/* ─── Master Component ─── */
export default function Settings() {
  const navigate = useNavigate();
  const { logout } = useContext(UserContext) || {};
  
  const [activeTab, setActiveTab] = useState('account');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState({ show: false, msg: "" });

  const showToast = (msg) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: "" }), 3000);
  };

  const tabs = [
    { id: 'account', icon: <User size={20}/>, label: "Account Center", keywords: "profile name bio email phone provider" },
    { id: 'privacy', icon: <ShieldAlert size={20}/>, label: "Privacy", keywords: "private messages comments tags mentions" },
    { id: 'security', icon: <Key size={20}/>, label: "Security & Sessions", keywords: "password login devices sessions 2fa" },
    { id: 'notifications', icon: <Bell size={20}/>, label: "Notifications", keywords: "push email alerts respect comment" },
    { id: 'content', icon: <ReelNavIcon />, label: "Feed & Content", keywords: "autoplay sensitive hidden words language" },
    { id: 'activity', icon: <Activity size={20}/>, label: "Activity Log", keywords: "history respects comments saves searches" },
    { id: 'creator', icon: <TrendingUp size={20}/>, label: "Creator Tools", keywords: "creator analytics views respects stats" },
    { id: 'blocks', icon: <Ban size={20}/>, label: "Blocked Accounts", keywords: "unblock block list" },
    { id: 'mutes', icon: <VolumeX size={20}/>, label: "Muted Accounts", keywords: "unmute mute list" },
    { id: 'data', icon: <DownloadCloud size={20}/>, label: "Data & Privacy", keywords: "export download delete deactivate clear" },
  ];

  const filteredTabs = tabs.filter(t => t.label.toLowerCase().includes(search.toLowerCase()) || t.keywords.includes(search.toLowerCase()));

  return (
    <div style={S.page}>
      <div style={S.topbar}>
        <button style={S.iBtn} onClick={() => navigate(-1)}><ArrowLeft size={24} /></button>
        <div style={S.tbTitle}>Settings</div>
      </div>
      
      <div style={S.container}>
        <div style={S.sidebar}>
          <div style={S.searchWrap}>
            <Search size={18} style={S.searchIcon} />
            <input 
              style={S.searchInput} 
              placeholder="Search settings..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          
          <div style={{display: "flex", flexDirection: "column", gap: 4}}>
            {filteredTabs.map(tab => (
              <button 
                key={tab.id}
                style={{...S.navItem, ...(activeTab === tab.id ? S.navItemActive : S.navItemInactive)}}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                <span style={{fontWeight: 600}}>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={S.content}>
          {activeTab === 'account' && <AccountCenter showToast={showToast} />}
          {activeTab === 'privacy' && <PrivacyCenter showToast={showToast} />}
          {activeTab === 'security' && <SecurityCenter showToast={showToast} />}
          {activeTab === 'notifications' && <NotificationsCenter showToast={showToast} />}
          {activeTab === 'content' && <FeedContentCenter showToast={showToast} />}
          {activeTab === 'activity' && <ActivityCenter showToast={showToast} />}
          {activeTab === 'creator' && <CreatorToolsCenter showToast={showToast} />}
          {activeTab === 'blocks' && <BlocksCenter showToast={showToast} />}
          {activeTab === 'mutes' && <MutesCenter showToast={showToast} />}
          {activeTab === 'data' && <DataPrivacyCenter showToast={showToast} logout={logout} />}
        </div>
      </div>

      {toast.show && <Toast msg={toast.msg} />}
    </div>
  );
}

/* ─── Sub-Components ─── */

function CreatorToolsCenter({ showToast }) {
  const navigate = useNavigate();
  return (
    <div>
      <h2 style={S.sectionTitle}>Creator Tools</h2>
      <p style={S.sectionDesc}>Manage your creator profile and view performance.</p>

      <div 
        style={{...S.navItem, ...S.navItemInactive, padding: '16px', background: '#2A2A2A', marginBottom: 12}}
        onClick={() => navigate('/creator/analytics')}
      >
        <TrendingUp size={24} color="#6366F1" />
        <div style={{flex: 1}}>
          <div style={{fontWeight: 600, color: '#fff', fontSize: 16}}>Creator Analytics</div>
          <div style={{color: '#888', fontSize: 14}}>View engagement, impressions, and audience insights</div>
        </div>
      </div>
      
      <div 
        style={{...S.navItem, ...S.navItemInactive, padding: '16px', background: '#2A2A2A'}}
        onClick={() => navigate('/creator/dashboard')}
      >
        <Activity size={24} color="#6366F1" />
        <div style={{flex: 1}}>
          <div style={{fontWeight: 600, color: '#fff', fontSize: 16}}>Creator Dashboard</div>
          <div style={{color: '#888', fontSize: 14}}>Manage monetization and overview metrics</div>
        </div>
      </div>
    </div>
  );
}

function AccountCenter({ showToast }) {
  const [profile, setProfile] = useState({});
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [emailForm, setEmailForm] = useState({ newEmail: '', currentPassword: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  
  useEffect(() => {
    Promise.all([
      apiCall('/settings/profile'),
      apiCall('/settings/providers'),
    ]).then(([profileRes, provRes]) => {
      if (profileRes.success) setProfile(profileRes.profile);
      if (provRes.success) setProviders(provRes.providers);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
    const res = await apiCall('/settings/profile', 'PUT', profile);
    if (res.success) showToast("Profile updated");
  };

  const unlinkProvider = async (pid) => {
    if (providers.length <= 1) return showToast("Cannot remove your only sign-in method");
    const res = await apiCall(`/settings/providers/${pid}`, 'DELETE');
    if (res.success) {
      setProviders(res.providers);
      showToast(`${pid} unlinked`);
    } else {
      showToast(res.error || "Failed to unlink");
    }
  };

  const changePassword = async () => {
    if (!passwordForm.current || !passwordForm.new) {
      return showToast("Please fill all password fields");
    }
    if (passwordForm.new.length < 8) {
      return showToast("New password must be at least 8 characters");
    }
    if (passwordForm.new !== passwordForm.confirm) {
      return showToast("New passwords don't match");
    }
    
    setPasswordLoading(true);
    const res = await apiCall('/settings/password', 'PUT', {
      currentPassword: passwordForm.current,
      newPassword: passwordForm.new
    });
    setPasswordLoading(false);
    
    if (res.success) {
      setPasswordForm({ current: '', new: '', confirm: '' });
      showToast("Password updated successfully");
    } else {
      showToast(res.error || "Failed to update password");
    }
  };

  const changeEmail = async () => {
    if (!emailForm.newEmail || !emailForm.currentPassword) {
      return showToast("Please fill all fields");
    }
    if (!emailForm.newEmail.includes('@')) {
      return showToast("Please enter a valid email");
    }
    
    setEmailLoading(true);
    const res = await apiCall('/settings/account', 'PUT', {
      email: emailForm.newEmail,
      currentPassword: emailForm.currentPassword
    });
    setEmailLoading(false);
    
    if (res.success) {
      setProfile({...profile, email: emailForm.newEmail});
      setEmailForm({ newEmail: '', currentPassword: '' });
      showToast("Email updated successfully");
    } else {
      showToast(res.error || "Failed to update email");
    }
  };

  if (loading) return <div style={{color: '#888', padding: 16}}>Loading…</div>;

  return (
    <div>
      <h2 style={S.sectionTitle}>Account Center</h2>
      <p style={S.sectionDesc}>Manage your personal information and connected providers.</p>
      
      <div style={S.formGroup}>
        <label style={S.label}>Display Name</label>
        <input 
          style={S.input} 
          value={profile.name || ''} 
          onChange={e => setProfile({...profile, name: e.target.value})} 
          maxLength={50}
          placeholder="Your display name"
        />
        <span style={{fontSize: 11, color: (profile.name || '').length > 45 ? '#e05555' : '#666', marginTop: 4, display: 'block'}}>
          {(profile.name || '').length}/50
        </span>
      </div>
      <div style={S.formGroup}>
        <label style={S.label}>Bio</label>
        <input 
          style={S.input} 
          value={profile.bio || ''} 
          onChange={e => setProfile({...profile, bio: e.target.value})} 
          maxLength={150}
          placeholder="Tell people about yourself"
        />
        <span style={{fontSize: 11, color: (profile.bio || '').length > 140 ? '#e05555' : '#666', marginTop: 4, display: 'block'}}>
          {(profile.bio || '').length}/150
        </span>
      </div>
      
      <button style={S.btn} onClick={saveProfile}>Save Changes</button>

      <h3 style={{fontSize: 18, marginTop: 40, marginBottom: 16}}>Connected Accounts</h3>
      {['password', 'google.com', 'apple.com', 'phone'].map(p => {
        const isLinked = providers.includes(p);
        return (
          <div key={p} style={S.toggleRow}>
            <div>
              <div style={{fontWeight: 600, fontSize: 16, textTransform: 'capitalize'}}>{p.replace('.com', '')}</div>
              <div style={{color: '#888', fontSize: 14}}>{isLinked ? "Connected" : "Not connected"}</div>
            </div>
            {isLinked ? (
              <button style={{...S.dangerBtn, padding: "8px 16px"}} onClick={() => unlinkProvider(p)}>Unlink</button>
            ) : (
              <button style={{...S.btn, padding: "8px 16px", background: "#333"}}>Link</button>
            )}
          </div>
        );
      })}

      {/* Change Password Section */}
      <h3 style={{fontSize: 18, marginTop: 40, marginBottom: 16}}>Security</h3>

      <div style={{background: "#2A2A2A", padding: 20, borderRadius: 12, marginBottom: 16}}>
        <h4 style={{fontSize: 16, marginBottom: 12, fontWeight: 600}}>Change Password</h4>
        <div style={S.formGroup}>
          <label style={S.label}>Current Password</label>
          <input 
            type="password" 
            style={S.input} 
            placeholder="Enter current password"
            value={passwordForm.current}
            onChange={e => setPasswordForm({...passwordForm, current: e.target.value})}
          />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>New Password</label>
          <input 
            type="password" 
            style={S.input} 
            placeholder="At least 8 characters"
            value={passwordForm.new}
            onChange={e => setPasswordForm({...passwordForm, new: e.target.value})}
          />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Confirm New Password</label>
          <input 
            type="password" 
            style={S.input} 
            placeholder="Re-enter new password"
            value={passwordForm.confirm}
            onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})}
          />
        </div>
        <button 
          style={{...S.btn, padding: "10px 20px", opacity: passwordLoading ? 0.6 : 1}} 
          onClick={changePassword}
          disabled={passwordLoading}
        >
          {passwordLoading ? "Updating..." : "Update Password"}
        </button>
      </div>

      {/* Change Email Section */}
      <div style={{background: "#2A2A2A", padding: 20, borderRadius: 12, marginBottom: 16}}>
        <h4 style={{fontSize: 16, marginBottom: 12, fontWeight: 600}}>Change Email</h4>
        <div style={S.formGroup}>
          <label style={S.label}>Current Email</label>
          <input 
            type="email" 
            style={{...S.input, color: "#888", background: "#1A1A1A"}} 
            value={profile.email || ''} 
            disabled 
          />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>New Email</label>
          <input 
            type="email" 
            style={S.input} 
            placeholder="Enter new email address"
            value={emailForm.newEmail}
            onChange={e => setEmailForm({...emailForm, newEmail: e.target.value})}
          />
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>Current Password (for verification)</label>
          <input 
            type="password" 
            style={S.input} 
            placeholder="Enter current password"
            value={emailForm.currentPassword}
            onChange={e => setEmailForm({...emailForm, currentPassword: e.target.value})}
          />
        </div>
        <p style={{color: '#888', fontSize: 13, marginBottom: 12}}>
          Changing your email will update your login credentials.
        </p>
        <button 
          style={{...S.btn, padding: "10px 20px", opacity: emailLoading ? 0.6 : 1}}
          onClick={changeEmail}
          disabled={emailLoading}
        >
          {emailLoading ? "Updating..." : "Update Email"}
        </button>
      </div>

      {/* Add Account - Coming Soon */}
      <div style={{background: "#2A2A2A", padding: 20, borderRadius: 12}}>
        <h4 style={{fontSize: 16, marginBottom: 8, fontWeight: 600}}>Add Account</h4>
        <p style={{color: '#888', fontSize: 14, marginBottom: 12}}>
          Switch between multiple Drandee accounts on this device.
        </p>
        <button style={{...S.btn, padding: "10px 20px", background: "#333", cursor: "not-allowed", opacity: 0.6}}>
          Coming Soon
        </button>
      </div>
    </div>
  );
}

function PrivacyCenter({ showToast }) {
  const [privacy, setPrivacy] = useState({});
  
  useEffect(() => {
    apiCall('/privacy').then(res => res.success && setPrivacy(res.privacy));
  }, []);

  const updatePrivacy = async (key, val) => {
    const updated = { ...privacy, [key]: val };
    setPrivacy(updated); // Optimistic
    const res = await apiCall('/privacy', 'PUT', updated);
    if (!res.success) {
      setPrivacy(privacy); // Rollback
      showToast("Couldn't update this setting. Try again.");
    } else {
      showToast("Privacy settings updated");
    }
  };

  return (
    <div>
      <h2 style={S.sectionTitle}>Privacy Controls</h2>
      <p style={S.sectionDesc}>Manage who can interact with you on Drandee.</p>

      <div style={S.toggleRow}>
        <div><div style={{fontWeight: 600}}>Private Account</div><div style={{color: '#888', fontSize: 14}}>Only approved followers can see your posts.</div></div>
        <Toggle active={privacy.private_account} onChange={() => updatePrivacy('private_account', !privacy.private_account)} />
      </div>
      
      <div style={S.toggleRow}>
        <div><div style={{fontWeight: 600}}>Activity Status</div><div style={{color: '#888', fontSize: 14}}>Let followers see when you are active.</div></div>
        <Toggle active={privacy.activity_visibility} onChange={() => updatePrivacy('activity_visibility', !privacy.activity_visibility)} />
      </div>

      <div style={{marginTop: 32}}>
        {['messaging_control', 'comments_control', 'mentions_control', 'tags_control'].map(ctrl => (
          <div key={ctrl} style={S.formGroup}>
            <label style={S.label}>{ctrl.split('_')[0].toUpperCase()} ALLOWED FROM</label>
            <select 
              style={{...S.input, appearance: 'none', cursor: 'pointer'}} 
              value={privacy[ctrl] || 'EVERYONE'}
              onChange={e => updatePrivacy(ctrl, e.target.value)}
            >
              <option value="EVERYONE">Everyone</option>
              <option value="FOLLOWERS">People I follow</option>
              <option value="NOBODY">No one</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecurityCenter({ showToast }) {
  const [sessions, setSessions] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    apiCall('/security/sessions').then(res => res.success && setSessions(res.sessions));
    apiCall('/security/login-history').then(res => res.success && setHistory(res.history));
  }, []);

  const revokeAll = async () => {
    const res = await apiCall('/security/sessions/all', 'DELETE');
    if (res.success) {
      showToast("All other sessions revoked");
      apiCall('/security/sessions').then(r => r.success && setSessions(r.sessions));
    }
  };

  return (
    <div>
      <h2 style={S.sectionTitle}>Security & Sessions</h2>
      <p style={S.sectionDesc}>Review active sessions and login history.</p>

      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16}}>
        <h3 style={{fontSize: 18}}>Active Sessions</h3>
        <button style={{...S.dangerBtn, padding: "8px 16px"}} onClick={revokeAll}>Log out all other devices</button>
      </div>

      {sessions.map(s => (
        <div key={s.id} style={{background: "#2A2A2A", padding: 16, borderRadius: 12, marginBottom: 12, display: "flex", alignItems: "center", gap: 16}}>
          <Monitor size={24} color="#6366F1" />
          <div style={{flex: 1}}>
            <div style={{fontWeight: 600}}>{s.device || 'Unknown Device'} • {s.browser || 'Unknown Browser'}</div>
            <div style={{color: '#888', fontSize: 14}}>{s.ip_address} • Last active: {new Date(s.last_active).toLocaleString()}</div>
          </div>
        </div>
      ))}

      <h3 style={{fontSize: 18, marginTop: 40, marginBottom: 16}}>Recent Login History</h3>
      {history.map(h => (
        <div key={h.id} style={{padding: "12px 0", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between"}}>
          <div>
            <div style={{fontWeight: 600}}>{h.provider} Login</div>
            <div style={{color: '#888', fontSize: 13}}>{h.device} • {h.ip_address}</div>
          </div>
          <div style={{textAlign: "right"}}>
            <div style={{color: h.status === 'SUCCESS' ? '#4ECDC4' : '#888', fontSize: 14, fontWeight: 600}}>{h.status}</div>
            <div style={{color: '#888', fontSize: 12}}>{new Date(h.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NotificationsCenter({ showToast }) {
  const [notifs, setNotifs] = useState({});
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    apiCall('/settings/notifications').then(res => {
      if (res.success) setNotifs(res.notifications || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const updateNotif = async (key, val) => {
    const prev = notifs;
    const payload = { ...notifs, [key]: val };
    setNotifs(payload); // optimistic
    const res = await apiCall('/settings/notifications', 'PUT', payload);
    if (!res.success) {
      setNotifs(prev); // rollback
      showToast('Failed to update notification preference');
    }
  };

  const TOGGLES = [
    { key: 'respect',  label: 'Respect Notifications',  desc: 'When someone gives Respect to your content.' },
    { key: 'comment',  label: 'Comment Notifications',  desc: 'When someone comments on your post.' },
    { key: 'follow',   label: 'Follow Notifications',   desc: 'When someone starts following you.' },
    { key: 'mention',  label: 'Mention Notifications',  desc: 'When someone mentions you in a post or comment.' },
    { key: 'reply',    label: 'Reply Notifications',    desc: 'When someone replies to your comment.' },
    { key: 'system',   label: 'System Notifications',   desc: 'Important account and safety alerts from Drandee.' },
    { key: 'push',     label: 'Push Notifications',     desc: 'Allow Drandee to send push notifications to this device.' },
    { key: 'email',    label: 'Email Notifications',    desc: 'Receive notification summaries by email.' },
  ];

  if (loading) return <div style={{color: '#888', padding: 16}}>Loading…</div>;

  return (
    <div>
      <h2 style={S.sectionTitle}>Notification Settings</h2>
      <p style={S.sectionDesc}>Choose what you want to be notified about. Drandee uses Respects, never Likes.</p>
      
      {TOGGLES.map(({ key, label, desc }) => (
        <div key={key} style={S.toggleRow}>
          <div>
            <div style={{ fontWeight: 600 }}>{label}</div>
            {desc && <div style={{ color: '#888', fontSize: 14 }}>{desc}</div>}
          </div>
          <Toggle active={!!notifs[key]} onChange={() => updateNotif(key, !notifs[key])} />
        </div>
      ))}
    </div>
  );
}

function FeedContentCenter({ showToast }) {
  const [prefs, setPrefs] = React.useState({ autoplayVideos: true, dataSaverMode: false });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    apiCall('/settings/preferences').then(res => {
      if (res.success) setPrefs({
        autoplayVideos: res.preferences?.autoplayVideos !== false,
        dataSaverMode: !!res.preferences?.dataSaverMode,
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const updatePref = async (key, val) => {
    const updated = { ...prefs, [key]: val };
    setPrefs(updated);
    const res = await apiCall('/settings/preferences', 'PUT', updated);
    if (res.success) {
      showToast("Preference updated");
    } else {
      setPrefs(prefs);
      showToast("Failed to update preference");
    }
  };

  if (loading) return <div style={{color: '#888', padding: 16}}>Loading...</div>;

  return (
    <div>
      <h2 style={S.sectionTitle}>Feed & Content</h2>
      <p style={S.sectionDesc}>Personalize your Drandee feed experience.</p>
      
      <div style={S.toggleRow}>
        <div>
          <div style={{fontWeight: 600}}>Autoplay Videos</div>
          <div style={{color: '#888', fontSize: 14}}>Videos play automatically as you scroll.</div>
        </div>
        <Toggle active={prefs.autoplayVideos} onChange={() => updatePref('autoplayVideos', !prefs.autoplayVideos)} />
      </div>
      <div style={S.toggleRow}>
        <div>
          <div style={{fontWeight: 600}}>Data Saver Mode</div>
          <div style={{color: '#888', fontSize: 14}}>Reduces video quality to save mobile data.</div>
        </div>
        <Toggle active={prefs.dataSaverMode} onChange={() => updatePref('dataSaverMode', !prefs.dataSaverMode)} />
      </div>
    </div>
  );
}

function ActivityCenter({ showToast }) {
  const [activity, setActivity] = useState([]);
  const [type, setType] = useState('respected-posts');
  const [openPostIndex, setOpenPostIndex] = useState(null);
  const { giveRespect, savePost } = useContext(UserContext) || {};

  useEffect(() => {
    let isActive = true;
    setActivity([]);
    apiCall(`/user/${type}`).then(res => {
      if (isActive && res.success) setActivity(res.data || []);
    });
    return () => { isActive = false; };
  }, [type]);

  return (
    <div>
      <h2 style={S.sectionTitle}>Saved & Activity</h2>
      <p style={S.sectionDesc}>Review your historical interactions on Drandee.</p>

      <div style={{display: "flex", gap: 12, marginBottom: 24, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none"}}>
        {['respected-posts', 'respected-videos', 'commented-posts', 'commented-videos', 'saved-posts', 'saved-videos'].map(t => (
          <button 
            key={t}
            onClick={() => setType(t)}
            style={{...S.btn, background: type === t ? "#6366F1" : "#222", padding: "8px 16px", borderRadius: 20, whiteSpace: 'nowrap', fontSize: 14}}
          >
            {t.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          </button>
        ))}
      </div>

      <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2}}>
        {activity.length === 0 ? <p style={{color: '#888', gridColumn: "1/-1"}}>No activity found in this category.</p> : null}
        {activity.map((item, i) => (
          <div key={item.id != null ? item.id : i} style={{aspectRatio: "1/1", background: "#2A2A2A", cursor: "pointer", position: "relative", overflow: "hidden"}} onClick={() => setOpenPostIndex(i)}>
            {item.imageUrl || item.videoUrl ? (
              <img src={item.imageUrl || item.videoUrl} alt="Saved content" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
            ) : (
              <div style={{width: '100%', height: '100%', padding: 8, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: 'linear-gradient(to bottom right, #2a2a3a, #1a1a24)'}}>
                {item.caption?.slice(0, 50)}...
              </div>
            )}
            {item.contentType === 'video' || item.type === 'video' || item.videoUrl ? (
              <div style={{position: 'absolute', top: 6, right: 6}}><PlaySmIcon /></div>
            ) : null}
          </div>
        ))}
      </div>

      {openPostIndex !== null && activity[openPostIndex] && (
        <ProfileContentViewer
          posts={activity}
          selectedPostId={activity[openPostIndex].id}
          tab="all"
          onClose={() => setOpenPostIndex(null)}
          onEngagement={(postId, actionType, forceAdd) => {
            if (actionType === 'respect' && giveRespect) giveRespect(postId, forceAdd);
            if (actionType === 'save' && savePost) savePost(postId);
          }}
        />
      )}
    </div>
  );
}

function DataPrivacyCenter({ showToast, logout }) {
  const [password, setPassword] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [scheduledFor, setScheduledFor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    apiCall('/data/deletion/status').then(res => {
      if (res && res.success) {
        setIsPending(!!res.pending);
        setScheduledFor(res.scheduledFor);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const requestExport = async () => {
    const res = await apiCall('/data/export', 'POST');
    showToast(res.message || res.error || "Data export requested");
  };

  const scheduleDeletion = async () => {
    if (!password) return showToast("Password is required for security");
    
    setActionLoading(true);
    const res = await apiCall('/data/deletion/request', 'POST', { password });
    setActionLoading(false);
    if (res.success) {
      setIsPending(true);
      showToast("Account scheduled for deletion (30-day grace period)");
      if (typeof logout === 'function') {
        setTimeout(logout, 2000);
      }
    } else {
      showToast(res.error || "Failed to schedule deletion");
    }
  };

  const cancelDeletion = async () => {
    setActionLoading(true);
    const res = await apiCall('/data/deletion/cancel', 'POST');
    setActionLoading(false);
    if (res.success) {
      setIsPending(false);
      setScheduledFor(null);
      showToast("Account deletion cancelled successfully");
    } else {
      showToast(res.error || "Failed to cancel deletion");
    }
  };

  return (
    <div>
      <h2 style={S.sectionTitle}>Data & Privacy</h2>
      <p style={S.sectionDesc}>Download your data or manage your account lifecycle.</p>

      <div style={{background: "#2A2A2A", padding: 24, borderRadius: 16, marginBottom: 32}}>
        <h3 style={{fontSize: 18, marginBottom: 8}}>Download My Data</h3>
        <p style={{color: '#A0A0A0', fontSize: 14, marginBottom: 16}}>
          Request a copy of your information at any time. This process runs securely in the background and we will notify you when it's ready.
        </p>
        <button style={S.btn} onClick={requestExport}>Request Data Export</button>
      </div>

      <div style={{background: "rgba(254, 44, 85, 0.1)", border: "1px solid rgba(254, 44, 85, 0.2)", padding: 24, borderRadius: 16}}>
        <h3 style={{fontSize: 18, color: "#FE2C55", marginBottom: 8}}>Delete Account</h3>
        {loading ? (
          <p style={{color: '#888'}}>Checking status...</p>
        ) : isPending ? (
          <div>
            <p style={{color: '#FFB3B3', fontSize: 14, marginBottom: 16}}>
              Your account is currently <b>scheduled for deletion</b>
              {scheduledFor ? ` on ${new Date(scheduledFor).toLocaleDateString()}` : ''}. 
              During this 30-day grace period, you can cancel the request to restore full access.
            </p>
            <button 
              style={{...S.btn, background: '#6366F1'}} 
              onClick={cancelDeletion}
              disabled={actionLoading}
            >
              {actionLoading ? "Cancelling..." : "Cancel Deletion Request"}
            </button>
          </div>
        ) : (
          <div>
            <p style={{color: '#FFB3B3', fontSize: 14, marginBottom: 16}}>
              Deleting your account is permanent. However, we provide a <b>30-day grace period</b>. 
              If you log in within 30 days, your account will be fully restored. After 30 days, all data is erased forever.
            </p>
            
            <input 
              style={{...S.input, marginBottom: 16, background: "#111"}} 
              type="password" 
              placeholder="Enter password to confirm"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button 
              style={{...S.dangerBtn, opacity: actionLoading ? 0.6 : 1}} 
              onClick={scheduleDeletion}
              disabled={actionLoading}
            >
              {actionLoading ? "Scheduling..." : "Schedule Deletion"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function BlocksCenter({ showToast }) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadBlocks = useCallback(async () => {
    setLoading(true);
    const res = await apiCall('/engagement/block-list');
    if (res && res.success) setBlocks(res.blocks || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  const unblock = async (creatorId, username) => {
    const res = await apiCall(`/engagement/block/${creatorId}`, 'POST');
    if (res && res.success) {
      showToast(`Unblocked @${username}`);
      setBlocks(prev => prev.filter(b => b.id !== creatorId));
    } else {
      showToast(res?.error || 'Failed to unblock');
    }
  };

  return (
    <div>
      <h2 style={S.sectionTitle}>Blocked Accounts</h2>
      <p style={S.sectionDesc}>Blocked accounts cannot see your profile, posts, or message you.</p>

      {loading ? (
        <div style={{ color: '#888', padding: 16 }}>Loading...</div>
      ) : blocks.length === 0 ? (
        <div style={{ color: '#888', padding: '32px 0', textAlign: 'center' }}>No blocked accounts.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {blocks.map(b => (
            <div key={b.id} style={{ ...S.toggleRow, padding: '12px 16px', background: '#2A2A2A', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <DefaultAvatar size={40} src={b.profile_pic} creatorName={b.name || b.username} />
                <div>
                  <div style={{ fontWeight: 600, color: '#fff' }}>{b.name || b.username}</div>
                  <div style={{ color: '#888', fontSize: 13 }}>@{b.username}</div>
                </div>
              </div>
              <button
                style={{ ...S.dangerBtn, padding: '8px 16px', fontSize: 13, background: '#333', color: '#fff' }}
                onClick={() => unblock(b.id, b.username)}
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MutesCenter({ showToast }) {
  const [mutes, setMutes] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMutes = useCallback(async () => {
    setLoading(true);
    const res = await apiCall('/engagement/mute-list');
    if (res && res.success) setMutes(res.mutes || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMutes();
  }, [loadMutes]);

  const unmute = async (creatorId, username) => {
    const res = await apiCall(`/engagement/mute/${creatorId}`, 'POST');
    if (res && res.success) {
      showToast(`Unmuted @${username}`);
      setMutes(prev => prev.filter(m => m.id !== creatorId));
    } else {
      showToast(res?.error || 'Failed to unmute');
    }
  };

  return (
    <div>
      <h2 style={S.sectionTitle}>Muted Accounts</h2>
      <p style={S.sectionDesc}>Posts and stories from muted accounts are hidden from your feed.</p>

      {loading ? (
        <div style={{ color: '#888', padding: 16 }}>Loading...</div>
      ) : mutes.length === 0 ? (
        <div style={{ color: '#888', padding: '32px 0', textAlign: 'center' }}>No muted accounts.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mutes.map(m => (
            <div key={m.id} style={{ ...S.toggleRow, padding: '12px 16px', background: '#2A2A2A', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <DefaultAvatar size={40} src={m.profile_pic} creatorName={m.name || m.username} />
                <div>
                  <div style={{ fontWeight: 600, color: '#fff' }}>{m.name || m.username}</div>
                  <div style={{ color: '#888', fontSize: 13 }}>@{m.username}</div>
                </div>
              </div>
              <button
                style={{ ...S.btn, padding: '8px 16px', fontSize: 13, background: '#333' }}
                onClick={() => unmute(m.id, m.username)}
              >
                Unmute
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}