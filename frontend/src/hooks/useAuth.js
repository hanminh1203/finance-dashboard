import { useCallback, useEffect, useState } from 'react';
import { fetchMe, loginUrl, logout as apiLogout } from '../lib/api';

/**
 * Session-based auth against the Django backend (Google OAuth code flow).
 */
export function useAuth() {
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const me = await fetchMe();
      setSignedIn(!!me.authenticated);
      setEmail(me.email || null);
      setError(null);
    } catch (err) {
      setSignedIn(false);
      setEmail(null);
      setError(err.message || String(err));
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('auth_error');
    if (authError) {
      setError(authError);
      window.history.replaceState({}, '', window.location.pathname);
    }
    refresh();
  }, [refresh]);

  const signIn = useCallback(() => {
    window.location.href = loginUrl();
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // clear local state even if revoke fails
    }
    setSignedIn(false);
    setEmail(null);
  }, []);

  return { signedIn, email, ready, error, signIn, signOut, refresh };
}
