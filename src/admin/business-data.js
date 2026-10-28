import { useEffect, useState } from "react";

export function useDebounced(value, delay = 250) {
  const [settled, setSettled] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setSettled(value), delay); return () => clearTimeout(timer); }, [value, delay]);
  return settled;
}

export function businessQuery(values) {
  return new URLSearchParams(Object.entries(values).filter(([, value]) => value !== "" && value != null)).toString();
}

export function useBusinessResource(request, path, revision = 0) {
  const [state, setState] = useState({ path, loading: true, data: null, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    setState(previous => ({ path, data: previous.path === path ? previous.data : null, loading: true, error: "" }));
    request(path, { signal: controller.signal, force: revision > 0 }).then(data => {
      if (!controller.signal.aborted) setState({ path, data, loading: false, error: "" });
    }).catch(error => {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, error: error.message }));
    });
    return () => controller.abort();
  }, [request, path, revision]);
  return state.path === path ? state : { data: null, loading: true, error: "" };
}
