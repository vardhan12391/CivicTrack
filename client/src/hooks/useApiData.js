import { useCallback, useEffect, useRef, useState } from 'react';

/** Unwrap an axios response to its payload (pass through raw data). */
function unwrap(result) {
  if (result && typeof result === 'object' && 'config' in result && 'data' in result) {
    return result.data;
  }
  return result;
}

/**
 * Minimal data-fetching hook: manages loading / error / data for one API call.
 * `fn` should be an async function returning an axios response (or plain data).
 */
export function useApiData(fn, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      // Accept either an axios response or raw data.
      const value = unwrap(result);
      setData(value);
      return value;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (immediate) execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // `immediate` is a dependency so pages gated on auth (e.g. /reports/mine)
    // fetch as soon as the session resolves, not only on later re-renders.
  }, [...deps, immediate]);

  return { data, error, loading, reload: execute, setData };
}

/**
 * Wrapper for mutations: loading + error + run().
 */
export function useApiMutation(fn) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (...args) => {
    setPending(true);
    setError(null);
    try {
      const result = await fnRef.current(...args);
      return unwrap(result);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setPending(false);
    }
  }, []);

  return { run, pending, error, clearError: () => setError(null) };
}

export default useApiData;
