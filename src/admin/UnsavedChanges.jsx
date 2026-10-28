import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Dialog } from "./Common";

const Context = createContext(null);
export function UnsavedChangesProvider({ children }) {
  const forms = useRef(new Map());
  const action = useRef(null);
  const bypass = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const register = useCallback((key, state) => {
    forms.current.set(key, state);
    return () => forms.current.delete(key);
  }, []);
  const requestLeave = useCallback(callback => {
    if (bypass.current) { callback(); return; }
    const states = [...forms.current.values()].map(get => get());
    if (states.some(state => state.busy)) return;
    if (!states.some(state => state.dirty)) { callback(); return; }
    action.current = callback;
    setConfirming(true);
  }, []);
  useEffect(() => {
    const beforeUnload = event => {
      if (![...forms.current.values()].some(get => get().dirty || get().busy)) return;
      event.preventDefault(); event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  const cancel = () => { action.current = null; setConfirming(false); };
  return <Context.Provider value={{ register, requestLeave }}>{children}{confirming && <Dialog title="有未保存的修改" onClose={cancel}>
    <p className="admin-discard-description">离开后，本次修改将被放弃。你可以继续编辑，或确认放弃修改。</p>
    <div className="admin-form-actions">
      <button className="admin-button" autoFocus onClick={cancel}>继续编辑</button>
      <button className="admin-button admin-button-secondary" onClick={() => {
        const callback = action.current; action.current = null; setConfirming(false);
        bypass.current = true;
        try { callback?.(); } finally { bypass.current = false; }
      }}>放弃修改</button>
    </div>
  </Dialog>}</Context.Provider>;
}
export function useLeaveGuard() { return useContext(Context).requestLeave; }
export function useUnsavedChanges(value, busy = false) {
  const { register, requestLeave } = useContext(Context);
  const key = useRef(Symbol("form"));
  const current = useRef(value);
  const baseline = useRef(JSON.stringify(value));
  const busyRef = useRef(busy);
  current.current = value; busyRef.current = busy;
  useEffect(() => register(key.current, () => ({ dirty: JSON.stringify(current.current) !== baseline.current, busy: busyRef.current })), [register]);
  const markSaved = next => { baseline.current = JSON.stringify(next === undefined ? current.current : next); busyRef.current = false; };
  return { requestLeave, markSaved };
}
