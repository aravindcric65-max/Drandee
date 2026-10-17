import { auth } from './firebase/config';

const originalFetch = window.fetch;

window.fetch = async (...args) => {
  let [resource, config] = args;
  
  if (!config) {
    config = {};
  }
  
  // Intercept requests to our own backend (relative or absolute)
  if (typeof resource === 'string' && (
    resource.startsWith('/') || 
    resource.includes('localhost:5000') || 
    resource.includes('localhost:3000') ||
    resource.includes(window.location.host)
  )) {
    if (auth.currentUser) {
      try {
        // getIdToken(false) gets the token, or refreshes it automatically if it's expired
        const token = await auth.currentUser.getIdToken();
        
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`
        };
      } catch (error) {
        console.error("Failed to get Firebase token for request:", error);
      }
    } else {
      // Fallback to localStorage token if auth.currentUser is not yet populated
      // (This handles the brief window during page load)
      const localToken = localStorage.getItem('token');
      if (localToken) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${localToken}`
        };
      }
    }
  }
  
  return originalFetch(resource, config);
};
