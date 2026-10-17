'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  clearAccessToken,
  getAccessToken,
  readSession,
  subscribeToAccessToken,
  type Session,
} from './auth-token';

/**
 * The signed-in user for client pages. `session` is `undefined` until
 * hydrated (the server can't see localStorage) and `null` when there is no
 * valid token; the page should then call `signOut`, which goes to `/login`.
 */
export function useSession(): {
  session: Session | null | undefined;
  signOut: () => void;
} {
  const router = useRouter();
  const token = useSyncExternalStore(
    subscribeToAccessToken,
    getAccessToken,
    () => undefined,
  );
  const session = useMemo(
    () => (token === undefined ? undefined : token ? readSession(token) : null),
    [token],
  );
  const signOut = useCallback(() => {
    clearAccessToken();
    router.replace('/login');
  }, [router]);
  return { session, signOut };
}
