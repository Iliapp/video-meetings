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
// Numbers the saves, so an older save that answers late doesn't win, while a
// save still shows when a newer one fails.
let lastSave = 0;
let lastApplied = 0;

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

// Runs a change and, on success, shows its profile to every reader.
async function save(
  token: string | null | undefined,
  change: (token: string) => Promise<Profile>,
): Promise<Profile> {
  // A 401 like the api's, so callers sign out on the same path.
  if (!token) throw new ApiError(401, 'Not signed in');
  const save = ++lastSave;
  const profile = await change(token);
  // Keep a newer save's result, and never write over another sign-in's
  // profile (its readers would wait for it forever).
  if (save > lastApplied && (!current || current.token === token)) {
    lastApplied = save;
    setState(token, { status: 'ready', profile });
  }
  return profile;
}

// `DELETE /users/me/avatar` returns no body: clear the URL in the profile we
// have, or read it again when there is none yet.
async function removeAvatarOf(token: string): Promise<Profile> {
  await deleteAvatar(token);
  const state = current?.token === token ? current.state : undefined;
  return state?.status === 'ready'
    ? { ...state.profile, avatarUrl: null }
    : getProfile(token);
}

/**
 * The signed-in user's profile (`GET /users/me`), loaded once per token and
 * shared by every component that reads it. Pass `session?.token`; it stays
 * `loading` without one. `saveName` (`PATCH /users/me`), `saveAvatar`
 * (`PUT /users/me/avatar`) and `removeAvatar` (`DELETE /users/me/avatar`)
 * update every reader without a reload on success, and reject with the api
 * error otherwise. Readers stay in `error` until a reader mounts again or
 * calls `reload`, the retry after an error (it shows `loading` again while it
 * runs).
 */
export function useProfile(token: string | null | undefined): {
  state: ProfileState;
  reload: () => void;
  saveName: (name: string | null) => Promise<Profile>;
  saveAvatar: (file: File) => Promise<Profile>;
  removeAvatar: () => Promise<Profile>;
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
      save(token, (token) => updateProfile(token, { name })),
    [token],
  );
  const saveAvatar = useCallback(
    (file: File) => save(token, (token) => uploadAvatar(token, file)),
    [token],
  );
  const removeAvatar = useCallback(() => save(token, removeAvatarOf), [token]);

  return { state, reload, saveName, saveAvatar, removeAvatar };
}
