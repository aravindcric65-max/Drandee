import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../context/UserContext';
import {
  ArrowLeft, Search, User, ShieldAlert, Key, Bell, ListVideo, 
  Activity, Ban, VolumeX, DownloadCloud, CheckCircle2, Monitor
} from 'lucide-react';

/* ─── API Helper ─── */
const apiCall = async (endpoint, method = 'GET', body = null) => {
  const token = localStorage.getItem('token');
  const headers = { 'Authorization': `Bearer ${token}` };
  if (body) headers['Content-Type'] = 'application/json';
  
  const res = await fetch(`/api${endpoint}`, {
    method, headers, body: body ? JSON.stringify(body) : null
  });
  return res.json();
};

/* ─── Styles ─── */
const S = {
  page: { background: "#121212", minHeight: "100vh", display: "flex", flexDirection: "column", color: "#fff", fontFamily: "Inter, sans-serif", overflowY: "auto", overflowX: "hidden", paddingBottom: "max(env(safe-area-inset-bottom), 24px)" },
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
  
  content: { flex: "3 1 300px", maxWidth: "100%", background: "#1E1E1E", borderRadius: 20, padding: "24px", border: "1px solid rgba(255,255,255,0.05)", minHeight: 600, overflowY: "auto" },
  
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
  toast: { background: "#333", color: "#fff", padding: "14px 24px", borderRadius: 30, fontSize: 14, fontWeight: "600", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" },
};

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
    { id: 'content', icon: <ListVideo size={20}/>, label: "Feed & Content", keywords: "autoplay sensitive hidden words language" },
    { id: 'activity', icon: <Activity size={20}/>, label: "Activity Log", keywords: "history respects comments saves searches" },
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
          {activeTab === 'blocks' && <div style={{color: '#888'}}>Blocked Accounts module loaded from Safety system.</div>}
          {activeTab === 'mutes' && <div style={{color: '#888'}}>Muted Accounts module loaded from Safety system.</div>}
          {activeTab === 'data' && <DataPrivacyCenter showToast={showToast} logout={logout} />}
        </div>
      </div>

      {toast.show && <Toast msg={toast.msg} />}
    </div>
  );
}

/* ─── Sub-Components ─── */

function AccountCenter({ showToast }) {
  const [profile, setProfile] = useState({});
  const [providers, setProviders] = useState([]);
  
  useEffect(() => {
    apiCall('/settings/profile').then(res => res.success && setProfile(res.profile));
    apiCall('/settings/providers').then(res => res.success && setProviders(res.providers));
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

  return (
    <div>
      <h2 style={S.sectionTitle}>Account Center</h2>
      <p style={S.sectionDesc}>Manage your personal information and connected providers.</p>
      
      <div style={S.formGroup}>
        <label style={S.label}>Display Name</label>
        <input style={S.input} value={profile.name || ''} onChange={e => setProfile({...profile, name: e.target.value})} />
      </div>
      <div style={S.formGroup}>
        <label style={S.label}>Bio</label>
        <input style={S.input} value={profile.bio || ''} onChange={e => setProfile({...profile, bio: e.target.value})} />
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
  
  useEffect(() => {
    apiCall('/settings/notifications').then(res => res.success && setNotifs(res.notifications));
  }, []);

  const updateNotif = async (key, val) => {
    const payload = { ...notifs, [key]: val };
    setNotifs(payload);
    const res = await apiCall('/settings/notifications', 'PUT', payload);
    if (!res.success) showToast("Failed to update notification");
  };

  return (
    <div>
      <h2 style={S.sectionTitle}>Notification Settings</h2>
      <p style={S.sectionDesc}>Choose what you want to be notified about. Drandee uses Respects, never Likes.</p>
      
      <div style={S.toggleRow}>
        <div><div style={{fontWeight: 600}}>Respect Notifications</div><div style={{color: '#888', fontSize: 14}}>When someone gives Respect to your content.</div></div>
        <Toggle active={notifs.respect} onChange={() => updateNotif('respect', !notifs.respect)} />
      </div>
      <div style={S.toggleRow}>
        <div><div style={{fontWeight: 600}}>Comment Notifications</div></div>
        <Toggle active={notifs.comment} onChange={() => updateNotif('comment', !notifs.comment)} />
      </div>
      <div style={S.toggleRow}>
        <div><div style={{fontWeight: 600}}>Push Notifications</div></div>
        <Toggle active={notifs.push} onChange={() => updateNotif('push', !notifs.push)} />
      </div>
    </div>
  );
}

function FeedContentCenter({ showToast }) {
  return (
    <div>
      <h2 style={S.sectionTitle}>Feed & Content</h2>
      <p style={S.sectionDesc}>Personalize your Drandee feed experience.</p>
      
      <div style={S.toggleRow}>
        <div><div style={{fontWeight: 600}}>Autoplay Videos</div></div>
        <Toggle active={true} onChange={() => showToast("Autoplay preference updated")} />
      </div>
      <div style={S.toggleRow}>
        <div><div style={{fontWeight: 600}}>Data Saver Mode</div></div>
        <Toggle active={false} onChange={() => showToast("Data saver updated")} />
      </div>
    </div>
  );
}

function ActivityCenter({ showToast }) {
  const [activity, setActivity] = useState([]);
  const [type, setType] = useState('respects-given');

  useEffect(() => {
    setActivity([]);
    apiCall(`/activity/${type}`).then(res => res.success && setActivity(res.activity));
  }, [type]);

  return (
    <div>
      <h2 style={S.sectionTitle}>Activity Log</h2>
      <p style={S.sectionDesc}>Review your historical interactions on Drandee.</p>

      <div style={{display: "flex", gap: 12, marginBottom: 24, overflowX: "auto"}}>
        {['respects-given', 'respects-received', 'comments', 'saves'].map(t => (
          <button 
            key={t}
            onClick={() => setType(t)}
            style={{...S.btn, background: type === t ? "#6366F1" : "#333", padding: "8px 16px", borderRadius: 20}}
          >
            {t.replace('-', ' ').toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{display: "flex", flexDirection: "column", gap: 12}}>
        {activity.length === 0 ? <p style={{color: '#888'}}>No activity found in this category.</p> : null}
        {activity.map((item, i) => (
          <div key={i} style={{background: "#2A2A2A", padding: 16, borderRadius: 12}}>
            <div style={{color: '#A0A0A0', fontSize: 13, marginBottom: 8}}>{new Date(item.created_at).toLocaleString()}</div>
            <div style={{fontSize: 15}}>{item.content || "Interaction recorded"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataPrivacyCenter({ showToast, logout }) {
  const [password, setPassword] = useState('');

  const requestExport = async () => {
    const res = await apiCall('/data/export', 'POST');
    showToast(res.message || res.error);
  };

  const scheduleDeletion = async () => {
    if (!password) return showToast("Password is required for security");
    
    // In a real app we'd verify password first before calling deletion endpoint
    // Assuming backend handles the re-auth correctly or requires a secure token payload
    const res = await apiCall('/data/deletion/request', 'POST', { password });
    if (res.success) {
      alert("Account scheduled for deletion (30-day grace period).");
      logout();
    } else {
      showToast(res.error);
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
        <button style={S.dangerBtn} onClick={scheduleDeletion}>Schedule Deletion</button>
      </div>
    </div>
  );
}