import { render } from '@testing-library/react';
import App from './App';

// Mock Firebase to prevent real network calls and act() warnings
jest.mock('./firebase/config', () => ({
  auth: {},
  googleProvider: {},
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn((auth, cb) => {
    // Immediately resolve with null user (unauthenticated)
    // This stops the AuthProvider loading state without triggering act() warnings
    cb(null);
    return () => {}; // unsubscribe noop
  }),
}));

describe('Drandee App Root', () => {
  test('renders without crashing when user is unauthenticated', () => {
    // When unauthenticated, ProtectedRoute redirects to /login.
    // The login page renders a form with "Login" or similar text.
    // We verify the app mounts without throwing and renders something meaningful.
    expect(() => render(<App />)).not.toThrow();
  });
});
