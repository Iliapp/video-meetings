const ACCESS_TOKEN_KEY = 'accessToken';

export function saveAccessToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getAccessToken() {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearAccessToken() {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // Storage is blocked, so there is nothing to clear.
  }
}

export interface Session {
  token: string;
  userId: string;
  email: string;
}

/** Notifies when another tab signs in or out. */
export function subscribeToAccessToken(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

/**
 * Decodes the token's claims. The payload is not verified: it is only used for
 * display and to skip expired tokens. The api verifies the signature on every
 * request.
 */
export function readSession(token: string): Session | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as {
      sub?: unknown;
      email?: unknown;
      exp?: unknown;
    };
    if (typeof claims.sub !== 'string' || typeof claims.email !== 'string') {
      return null;
    }
    if (typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now()) {
      return null;
    }
    return { token, userId: claims.sub, email: claims.email };
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  const token = getAccessToken();
  return token ? readSession(token) : null;
}
