import { useCallback, useEffect, useLayoutEffect, useRef, useState, type SetStateAction } from "react";

// Unsaved form work is kept per item in sessionStorage as the user types,
// so coming back to the form (after a reload, say) brings it back.
// Storage may be missing or full (private windows, quotas): then there is
// simply nothing to restore. Forms never put secrets in a draft.

const prefix = "ridr.draft.";

function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(prefix + key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.sessionStorage.setItem(prefix + key, value);
  } catch {
    // No storage: the draft lives only as long as the form.
  }
}

function remove(key: string) {
  try {
    window.sessionStorage.removeItem(prefix + key);
  } catch {
    // Nothing was stored.
  }
}

// hasStoredDraft tells whether unsaved work for `key` waits to be
// restored, so a screen can reopen the form that holds it.
export function hasStoredDraft(key: string): boolean {
  return read(key) !== null;
}

type Options<T> = {
  // Where the draft is kept: one key per item, such as `rule:<id>`.
  key: string;
  // The form's starting value: what it holds with nothing unsaved.
  initial: () => T;
  // Makes the draft storable as JSON (dropping what can't be, such as
  // protobuf messages); also what "unsaved" is judged on.
  toStored?: (draft: T) => unknown;
  // Rebuilds a draft from what was stored, or null when it no longer fits.
  fromStored?: (stored: unknown) => T | null;
};

export type UnsavedDraft<T> = {
  draft: T;
  setDraft: (next: SetStateAction<T>) => void;
  // The draft differs from what the form started with.
  dirty: boolean;
  // Read back as dirty right now, for checks made outside render, such as
  // a navigation blocker running after a save cleared the draft.
  isDirty: () => boolean;
  // The draft came back from storage when the form opened.
  restored: boolean;
  // Throws the unsaved work away: back to the starting value.
  discard: () => void;
  // Starts over from `value` with nothing unsaved: after a save, or when
  // edit mode opens or closes.
  reset: (value: T) => void;
};

const identity = (value: unknown) => value;

// useUnsavedDraft holds a form's draft, keeps it in sessionStorage while
// it differs from where the form started, and restores it when the form
// opens again.
export function useUnsavedDraft<T>({
  key,
  initial,
  toStored = identity,
  fromStored = (stored) => stored as T,
}: Options<T>): UnsavedDraft<T> {
  const [state, setState] = useState(() => {
    const baseline = initial();
    const stored = read(key);
    let restoredDraft: T | null = null;
    if (stored !== null) {
      try {
        restoredDraft = fromStored(JSON.parse(stored));
      } catch {
        restoredDraft = null;
      }
      if (restoredDraft === null) remove(key);
    }
    return {
      draft: restoredDraft ?? baseline,
      baseline,
      restored: restoredDraft !== null,
    };
  });

  const serialize = (value: T) => JSON.stringify(toStored(value) ?? null);
  const draftText = serialize(state.draft);
  const dirty = draftText !== serialize(state.baseline);
  const dirtyRef = useRef(dirty);
  useLayoutEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    if (dirty) write(key, draftText);
    else remove(key);
  }, [key, dirty, draftText]);

  const setDraft = useCallback((next: SetStateAction<T>) => {
    setState((s) => ({
      ...s,
      draft: typeof next === "function" ? (next as (prev: T) => T)(s.draft) : next,
    }));
  }, []);

  const reset = useCallback(
    (value: T) => {
      dirtyRef.current = false;
      remove(key);
      setState({ draft: value, baseline: value, restored: false });
    },
    [key],
  );

  const discard = useCallback(() => {
    dirtyRef.current = false;
    remove(key);
    setState((s) => ({ draft: s.baseline, baseline: s.baseline, restored: false }));
  }, [key]);

  const isDirty = useCallback(() => dirtyRef.current, []);

  return {
    draft: state.draft,
    setDraft,
    dirty,
    isDirty,
    restored: state.restored,
    discard,
    reset,
  };
}
