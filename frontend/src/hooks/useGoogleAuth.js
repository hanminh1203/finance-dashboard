import { useCallback, useEffect, useRef, useState } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const STORAGE_KEY = 'gsheets_token_v1';

function loadStoredToken() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.expiresAt > Date.now()) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function storeToken(accessToken, expiresInSeconds) {
  const record = { accessToken, expiresAt: Date.now() + (expiresInSeconds - 60) * 1000 };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  return record;
}

/**
 * Wraps Google Identity Services' OAuth token client (implicit flow).
 * No client secret involved — CLIENT_ID is a public identifier. The user
 * signs in with their own Google account and grants access to Sheets;
 * the resulting access token is kept in sessionStorage only (cleared on
 * tab close) and used as a Bearer token for Sheets API calls.
 */
export function useGoogleAuth() {
  const [token, setToken] = useState(() => loadStoredToken()?.accessToken || null);
  const [gsiReady, setGsiReady] = useState(false);
  const [error, setError] = useState(null);
  const tokenClientRef = useRef(null);

  useEffect(() => {
    if (!CLIENT_ID) {
      setError('VITE_GOOGLE_CLIENT_ID is not set. Create frontend/.env from .env.example.');
      return;
    }
    let cancelled = false;
    const check = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(check);
        if (cancelled) return;
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE,
          callback: (resp) => {
            if (resp.error) {
              setError(resp.error);
              return;
            }
            const rec = storeToken(resp.access_token, resp.expires_in);
            setToken(rec.accessToken);
            setError(null);
          },
        });
        setGsiReady(true);
      }
    }, 100);
    return () => { cancelled = true; clearInterval(check); };
  }, []);

  const signIn = useCallback((silent = false) => {
    if (!tokenClientRef.current) return;
    tokenClientRef.current.requestAccessToken({ prompt: silent ? '' : 'consent' });
  }, []);

  const signOut = useCallback(() => {
    if (token && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token, () => {});
    }
    sessionStorage.removeItem(STORAGE_KEY);
    setToken(null);
  }, [token]);

  // Try a silent sign-in once GSI is ready, in case the browser still has
  // an active Google session and prior consent (avoids the popup on every visit).
  useEffect(() => {
    if (gsiReady && !token) signIn(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gsiReady]);

  return { token, signedIn: !!token, gsiReady, error, signIn, signOut };
}
