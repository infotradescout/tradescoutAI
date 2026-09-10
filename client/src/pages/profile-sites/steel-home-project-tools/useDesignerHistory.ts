import { useCallback, useEffect, useRef, useState } from "react";

export type DesignerHistory<T> = { present: T; past: T[]; future: T[] };
export function createDesignerHistory<T>(value: T): DesignerHistory<T> {
  return { present: structuredClone(value), past: [], future: [] };
}
export function stepDesignerHistory<T>(history: DesignerHistory<T>, action: "undo" | "redo" | { value: T }): DesignerHistory<T> {
  if (action === "undo") {
    if (!history.past.length) return history;
    return { present: history.past[history.past.length - 1], past: history.past.slice(0, -1), future: [history.present, ...history.future].slice(0, 80) };
  }
  if (action === "redo") {
    if (!history.future.length) return history;
    return { present: history.future[0], past: [...history.past, history.present].slice(-80), future: history.future.slice(1) };
  }
  if (JSON.stringify(action.value) === JSON.stringify(history.present)) return history;
  return { present: structuredClone(action.value), past: [...history.past, history.present].slice(-80), future: [] };
}
/** The existing parent remains the save authority; undo never creates another draft store. */
export function useDesignerHistory<T>(value: T, onChange: (value: T) => void) {
  const history = useRef<DesignerHistory<T>>(createDesignerHistory(value));
  const callback = useRef(onChange);
  callback.current = onChange;
  const [, refresh] = useState(0);
  useEffect(() => {
    if (JSON.stringify(value) !== JSON.stringify(history.current.present)) {
      // An imported/reopened external draft must not inherit another draft's undo stack.
      history.current = createDesignerHistory(value);
      refresh(count => count + 1);
    }
  }, [value]);
  const apply = useCallback((action: "undo" | "redo" | { value: T }) => {
    const next = stepDesignerHistory(history.current, action);
    if (next === history.current) return;
    history.current = next;
    callback.current(structuredClone(next.present));
    refresh(count => count + 1);
  }, []);
  return {
    change: useCallback((next: T) => apply({ value: next }), [apply]),
    undo: useCallback(() => apply("undo"), [apply]),
    redo: useCallback(() => apply("redo"), [apply]),
    canUndo: history.current.past.length > 0,
    canRedo: history.current.future.length > 0,
  };
}
