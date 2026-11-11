'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  ApiError,
  deleteAvatar,
  getProfile,
  updateProfile,
  uploadAvatar,
  type Profile,
} from './api';

export type ProfileState =
  | { status: 'loading' }
  | { status: 'ready'; profile: Profile }
  // `error` is an `ApiError` (a `401` means the session is gone) or a network
  // failure.
  | { status: 'error'; error: unknown };

const LOADING: ProfileState = { status: 'loading' };

// One profile for the whole tab, keyed by the token it was loaded with, so
// the header, dashboard and profile page share it and see a save at once.
// A different token (another sign-in) loads it again.
let current: { token: string; state: ProfileState } | null = null;
const listeners = new Set<() => void>();
// The fields a save changes. Each save shows only its own field, so a name
// save that answers with the old `avatarUrl` can't undo an upload running at
// the same time, and the other way round.
type SavedField = 'name' | 'avatarUrl';
// Numbers the saves per field, so an older save that answers late doesn't
// win, while a save still shows when a newer one fails.
const lastSave: Record<SavedField, number> = { name: 0, avatarUrl: 0 };
const lastApplied: Record<SavedField, number> = { name: 0, avatarUrl: 0 };

function setState(token: string, state: ProfileState) {
  current = { token, state };
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function load(token: string) {
  setState(token, LOADING);
  const loading = current;
  // Drop the answer when anything replaced the state meanwhile: a newer load,
  // another sign-in or a save (which is newer than this read).
  getProfile(token).then(
    (profile) => {
      if (current === loading) setState(token, { status: 'ready', profile });
    },
    (error: unknown) => {
      if (current === loading) setState(token, { status: 'error', error });
    },
  );
}

// Runs a change of one field and, on success, shows its new value to every
// reader. Resolves with that value.
async function save<F extends SavedField>(
  token: string | null | undefined,
  field: F,
  change: (token: string) => Promise<Profile[F]>,
): Promise<Profile[F]> {
  // A 401 like the api's, so callers sign out on the same path.
  if (!token) throw new ApiError(401, 'Not signed in');
  const save = ++lastSave[field];
  const value = await change(token);
  // Keep a newer save's result, and never write over another sign-in's
  // profile (its readers would wait for it forever).
  if (save > lastApplied[field] && (!current || current.token === token)) {
    lastApplied[field] = save;
    if (current?.state.status === 'ready') {
      const profile = { ...current.state.profile, [field]: value };
      setState(token, { status: 'ready', profile });
    } else {
      // No profile to update yet: read it, it already has this change.
      load(token);
    }
  }
  return value;
}

/**
 * The signed-in user's profile (`GET /users/me`), loaded once per token and
 * shared by every component that reads it. Pass `session?.token`; it stays
 * `loading` without one. `saveName` (`PATCH /users/me`), `saveAvatar`
 * (`PUT /users/me/avatar`) and `removeAvatar` (`DELETE /users/me/avatar`)
 * update every reader without a reload on success and resolve with the saved
 * `name` or `avatarUrl`, and reject with the api error otherwise. Readers stay in `error` until a reader mounts again or
 * calls `reload`, the retry after an error (it shows `loading` again while it
 * runs).
 */
export function useProfile(token: string | null | undefined): {
  state: ProfileState;
  reload: () => void;
  saveName: (name: string | null) => Promise<string | null>;
  saveAvatar: (file: File) => Promise<string | null>;
  removeAvatar: () => Promise<string | null>;
} {
  const state = useSyncExternalStore(
    subscribe,
    () => (token && current?.token === token ? current.state : LOADING),
    () => LOADING,
  );

  useEffect(() => {
    // A failed load is retried when a reader mounts again.
    if (
      token &&
      (current?.token !== token || current.state.status === 'error')
    ) {
      load(token);
    }
  }, [token]);

  const reload = useCallback(() => {
    if (token) load(token);
  }, [token]);

  const saveName = useCallback(
    (name: string | null) =>
      save(token, 'name', async (token) => {
        const profile = await updateProfile(token, { name });
        return profile.name;
      }),
    [token],
  );
  const saveAvatar = useCallback(
    (file: File) =>
      save(token, 'avatarUrl', async (token) => {
        const profile = await uploadAvatar(token, file);
        return profile.avatarUrl;
      }),
    [token],
  );
  // `DELETE /users/me/avatar` returns no body.
  const removeAvatar = useCallback(
    () =>
      save(token, 'avatarUrl', async (token) => {
        await deleteAvatar(token);
        return null;
      }),
    [token],
  );

  return { state, reload, saveName, saveAvatar, removeAvatar };
}
