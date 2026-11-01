import { auth } from './firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

const originalFetch = window.fetch;

// Shared refresh promise — prevents concurrent 401s from each calling getIdToken(true) independently
let refreshPromise = null;

// Wait for Firebase Auth to initialize
export const waitForAuth = () => {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

/**
 * Drandee API Fetch Interceptor
 */
window.fetch = async (...args) => {
  let [resource, config] = args;

  const requestUrl =
    typeof resource === 'string'
      ? resource
      : resource instanceof Request
        ? resource.url
        : (resource && resource.href) ? resource.href : resource?.toString() || '';

  // Exclude Firebase Auth requests from interception completely
  const isFirebaseRequest = requestUrl.includes('identitytoolkit.googleapis.com') || 
                           requestUrl.includes('securetoken.googleapis.com') ||
                           requestUrl.includes('firebaseapp.com') ||
                           requestUrl.includes('accounts.google.com') ||
                           requestUrl.includes('googleapis.com');
  if (isFirebaseRequest) {
    return originalFetch(...args);
  }

  config = config ? { ...config } : {};

  const isBackendRequest =
    requestUrl.startsWith('/') ||
    requestUrl.includes('localhost:5000') ||
    requestUrl.includes('localhost:3000') ||
    requestUrl.includes(window.location.host);

  // Diagnostic variables accessible throughout
  const method = config?.method || 'GET';

  if (isBackendRequest) {
    
    let token = null;

    // Wait for auth to initialize
    const user = await waitForAuth();

    if (user) {
      try {
        token = await user.getIdToken();
      } catch (error) {
        console.error(`[API-DEBUG] ${method} ${requestUrl} - Token acquisition FAILED:`, error.code || error.message);
      }
    }

    // Attach Authorization header
    if (token) {
      const headers = new Headers(config.headers || {});
      if (!headers.get('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      config.headers = headers;
    }
  }

  // Execute request
  try {
    const response = await originalFetch(resource, config);

    // Handle 401 - retry once with fresh token
    if (response.status === 401 && isBackendRequest) {
      const user = await waitForAuth();
      
      if (user) {
        try {
          if (!refreshPromise) {
            refreshPromise = user.getIdToken(true).finally(() => {
              refreshPromise = null;
            });
          }
          const freshToken = await refreshPromise;
          
          if (freshToken) {
            
            const retryConfig = { ...config };
            const retryHeaders = new Headers(retryConfig.headers || {});
            retryHeaders.set('Authorization', `Bearer ${freshToken}`);
            retryConfig.headers = retryHeaders;

            const retryResponse = await originalFetch(resource, retryConfig);
            return retryResponse;
          }
        } catch (refreshError) {
          console.error('[API Auth] Token refresh failed:', refreshError);
          const isNetworkError = refreshError?.code === 'auth/network-request-failed' || refreshError?.message?.includes('network');
          if (isNetworkError) {
            throw refreshError; // Preserve network error, do not treat as auth failure
          }
          // Only redirect when Firebase session is genuinely gone
          if (!auth.currentUser) {
            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
            throw new Error('Authentication invalid or expired');
          }
          // Session is still alive (currentUser non-null) — fail this request without redirecting
          throw refreshError;
        }
      }
    }

    return response;
  } catch (error) {
    console.error(`[API-DEBUG] ${method} ${requestUrl} - FETCH EXCEPTION:`, {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      type: error?.constructor?.name
    });
    if (error?.name === 'TypeError' || error?.message === 'Failed to fetch') {
      throw new Error('Unable to connect to the server. Please check that the backend is running.');
    }
    throw error;
  }
};

export default window.fetch;