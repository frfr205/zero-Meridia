"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ApiResult, CaseState, StageId } from "@/lib/case-types";

type ToastTone = "info" | "success" | "error";
interface Toast { id: number; message: string; tone: ToastTone }
interface SubmitResult { correct: boolean; message: string }

interface CaseContextValue {
  state: CaseState | null;
  loading: boolean;
  error: string | null;
  toasts: Toast[];
  refresh: () => Promise<void>;
  start: (alias: string) => Promise<boolean>;
  submit: (stageId: StageId, payload: unknown) => Promise<SubmitResult>;
  revealHint: (stageId: StageId) => Promise<string | null>;
  saveNotes: (notes: string) => Promise<void>;
  reset: (confirm: string) => Promise<boolean>;
  notify: (message: string, tone?: ToastTone) => void;
}

const CaseContext = createContext<CaseContextValue | null>(null);

export function CaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CaseState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const notify = useCallback((message: string, tone: ToastTone = "info") => {
    const id = ++toastId.current;
    setToasts((items) => [...items.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4800);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/case", { cache: "no-store" });
      if (!response.ok) throw new Error("The dossier server is not responding");
      const result = await response.json() as ApiResult;
      if (!result.state) throw new Error("Empty server response");
      setState(result.state);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Connection error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const start = useCallback(async (alias: string) => {
    const response = await fetch("/api/case", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", alias }) });
    const result = await response.json() as ApiResult;
    if (result.state) setState(result.state);
    if (!response.ok || !result.ok) { notify(result.message ?? "Could not start the case", "error"); return false; }
    notify("Case accepted. The Watch Protocol is available.", "success");
    return true;
  }, [notify]);

  const submit = useCallback(async (stageId: StageId, payload: unknown): Promise<SubmitResult> => {
    const response = await fetch("/api/case/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stageId, payload }) });
    const result = await response.json() as ApiResult & { correct?: boolean };
    if (result.state) setState(result.state);
    const message = result.message ?? (response.ok ? "Answer checked." : "Could not check the answer.");
    if (!response.ok || !result.ok) { notify(message, "error"); return { correct: false, message }; }
    notify(message, result.correct ? "success" : "error");
    return { correct: Boolean(result.correct), message };
  }, [notify]);

  const revealHint = useCallback(async (stageId: StageId) => {
    const response = await fetch("/api/case/hint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stageId }) });
    const result = await response.json() as ApiResult;
    if (result.state) setState(result.state);
    if (!response.ok || !result.ok) { notify(result.message ?? "Hint unavailable", "error"); return null; }
    return result.hint ?? null;
  }, [notify]);

  const saveNotes = useCallback(async (notes: string) => {
    const response = await fetch("/api/case", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "notes", notes }) });
    const result = await response.json() as ApiResult;
    if (result.state) setState(result.state);
    if (!response.ok) throw new Error(result.message ?? "Notes were not saved");
  }, []);

  const reset = useCallback(async (confirm: string) => {
    const response = await fetch("/api/case", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset", confirm }) });
    const result = await response.json() as ApiResult;
    if (result.state) setState(result.state);
    if (!response.ok || !result.ok) { notify(result.message ?? "Reset failed", "error"); return false; }
    notify("Local progress fully reset.", "info");
    return true;
  }, [notify]);

  const value = useMemo(() => ({ state, loading, error, toasts, refresh, start, submit, revealHint, saveNotes, reset, notify }), [state, loading, error, toasts, refresh, start, submit, revealHint, saveNotes, reset, notify]);
  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>;
}

export function useCase(): CaseContextValue {
  const context = useContext(CaseContext);
  if (!context) throw new Error("useCase must be used inside CaseProvider");
  return context;
}
