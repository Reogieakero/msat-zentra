"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";
import { apiErrorMessage } from "@/lib/api/errors";
import { uploadSf10Auto } from "@/services/registry/sf10.service";

export type Sf10QueueStatus = "queued" | "uploading" | "done" | "error" | "needs-grade";

export interface Sf10QueueItem {
  key: string;
  file: File;
  status: Sf10QueueStatus;
  gradeLevel: string;
  recordId?: string | null;
  learnerName?: string | null;
  lrn?: string | null;
  error?: string | null;
}

function apiErrorCode(e: unknown): string | null {
  const code = (e as { response?: { data?: { error?: { code?: unknown } } } })
    ?.response?.data?.error?.code;
  return typeof code === "string" ? code : null;
}

function isCancelError(e: unknown): boolean {
  const code = (e as { code?: unknown })?.code;
  const name = (e as { name?: unknown })?.name;
  return code === "ERR_CANCELED" || name === "CanceledError" || name === "AbortError";
}

function itemKey(file: File, salt: number): string {
  return `${file.name}::${file.size}::${file.lastModified}::${salt}`;
}

const INVALIDATE_KEYS: string[][] = [
  ["registrar-sf10"],
  ["record-keeper-sf10"],
  ["registrar-overview"],
  ["record-keeper-overview"],
  ["registrar-notifications"],
  ["record-keeper-notifications"],
  ["teacher-sf10-access"],
];

interface Sf10BulkUploadValue {
  items: Sf10QueueItem[];
  filedIds: string[];
  uploading: boolean;
  uploadStep: number;
  progress: { done: number; total: number };
  currentName: string;
  doneCount: number;
  filedFlash: boolean;
  minimized: boolean;
  setMinimized: (v: boolean) => void;
  enqueueFiles: (files: FileList | File[]) => void;
  removeItem: (key: string) => void;
  clearDone: () => void;
  clearAll: () => void;
  setItemGrade: (key: string, gradeLevel: string) => void;
  startUpload: () => void;
  cancelItem: (key: string) => void;
  dismissDock: () => void;
}

const Sf10BulkUploadContext = React.createContext<Sf10BulkUploadValue | null>(null);

export function useSf10BulkUpload(): Sf10BulkUploadValue {
  const ctx = React.useContext(Sf10BulkUploadContext);
  if (!ctx) throw new Error("useSf10BulkUpload must be used inside Sf10BulkUploadProvider");
  return ctx;
}

/**
 * SF10 bulk queue now reports each file into the single shared Dock.
 * The panel queue stays for picking files and grades; progress lives
 * in the shared Dock so it survives page jumps, new tabs and refresh.
 * Finished tasks stay until dismissed — no more auto-hide.
 */
export function Sf10BulkUploadProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const pathname = usePathname();
  const dock = useDock();
  const dockRef = React.useRef(dock);
  React.useEffect(() => {
    dockRef.current = dock;
  }, [dock]);
  const [items, setItems] = React.useState<Sf10QueueItem[]>([]);
  const [filedIds, setFiledIds] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [filedFlash, setFiledFlash] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [currentName, setCurrentName] = React.useState("");
  const [doneCount, setDoneCount] = React.useState(0);
  const [minimized, setMinimized] = React.useState(false);
  const salt = React.useRef(0);
  const abortRef = React.useRef<AbortController | null>(null);
  const itemsRef = React.useRef<Sf10QueueItem[]>([]);
  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  // Shared-Dock task id per queue item key.
  const taskIdsRef = React.useRef(new Map<string, string>());

  const dockTaskFor = React.useCallback((itemKeyValue: string, fileName: string): string => {
    const d = dockRef.current;
    const existingId = taskIdsRef.current.get(itemKeyValue);
    if (existingId) {
      const existing = d.tasks.find((t) => t.id === existingId);
      if (existing && (existing.status === "running" || existing.status === "waiting")) return existingId;
    }
    let id: string;
    try {
      id = d.startTask({ kind: "sf10-upload", title: fileName, description: "Queued for upload" });
      d.updateTask(id, { status: "waiting", description: "Waiting to upload" });
    } catch {
      return existingId ?? "";
    }
    taskIdsRef.current.set(itemKeyValue, id);
    return id;
  }, []);

  const settleDockTask = React.useCallback((itemKeyValue: string, fn: (id: string) => void) => {
    const id = taskIdsRef.current.get(itemKeyValue);
    if (!id) return;
    try {
      fn(id);
    } catch {
      /* ignore */
    }
  }, []);

  // Drop any previous session's queue on the login screen.
  React.useEffect(() => {
    if (pathname !== "/login") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- session reset on auth-route navigation
    setItems([]);
    setFiledIds([]);
    setFiledFlash(false);
    setProgress({ done: 0, total: 0 });
    setCurrentName("");
    setDoneCount(0);
    setMinimized(false);
    taskIdsRef.current.clear();
  }, [pathname]);

  const enqueueFiles = React.useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files);
      if (incoming.length === 0) return;
      const current = itemsRef.current;
      const newcomers: Sf10QueueItem[] = [];
      for (const file of incoming) {
        const dupe =
          current.some((p) => p.file.name === file.name && p.file.size === file.size && p.file.lastModified === file.lastModified) ||
          newcomers.some((p) => p.file.name === file.name && p.file.size === file.size && p.file.lastModified === file.lastModified);
        if (dupe) continue;
        salt.current += 1;
        newcomers.push({ key: itemKey(file, salt.current), file, status: "queued", gradeLevel: "" });
      }
      if (newcomers.length === 0) return;
      for (const n of newcomers) {
        try {
          const id = dockRef.current.startTask({ kind: "sf10-upload", title: n.file.name, description: `${(n.file.size / 1024).toFixed(0)} KB · queued` });
          dockRef.current.updateTask(id, { status: "waiting", description: "Waiting to upload" });
          taskIdsRef.current.set(n.key, id);
        } catch {
          /* shared Dock unavailable — queue still works */
        }
      }
      setItems((prev) => [...prev, ...newcomers]);
    },
    [],
  );

  const removeItem = React.useCallback(
    (key: string) => {
      if (uploading) return;
      setItems((prev) => prev.filter((p) => p.key !== key));
      const id = taskIdsRef.current.get(key);
      taskIdsRef.current.delete(key);
      if (id) {
        try {
          const t = dockRef.current.tasks.find((x) => x.id === id);
          if (t && (t.status === "running" || t.status === "waiting")) dockRef.current.cancelTask(id);
          else dockRef.current.dismissTask(id);
        } catch {
          /* ignore */
        }
      }
    },
    [uploading],
  );

  const clearDone = React.useCallback(() => {
    if (uploading) return;
    const doneKeys = new Set(itemsRef.current.filter((p) => p.status === "done").map((p) => p.key));
    setItems((prev) => prev.filter((p) => p.status !== "done"));
    for (const key of doneKeys) {
      const id = taskIdsRef.current.get(key);
      taskIdsRef.current.delete(key);
      if (id) {
        try {
          dockRef.current.dismissTask(id);
        } catch {
          /* ignore */
        }
      }
    }
  }, [uploading]);

  const clearAll = React.useCallback(() => {
    if (uploading) return;
    const keys = itemsRef.current.map((p) => p.key);
    setItems([]);
    for (const key of keys) {
      const id = taskIdsRef.current.get(key);
      taskIdsRef.current.delete(key);
      if (id) {
        try {
          const t = dockRef.current.tasks.find((x) => x.id === id);
          if (t && (t.status === "running" || t.status === "waiting")) dockRef.current.cancelTask(id);
          else dockRef.current.dismissTask(id);
        } catch {
          /* ignore */
        }
      }
    }
  }, [uploading]);

  const setItemGrade = React.useCallback((key: string, gradeLevel: string) => {
    setItems((prev) => prev.map((p) => (p.key === key ? { ...p, gradeLevel } : p)));
  }, []);

  const dismissDock = React.useCallback(() => {
    setFiledFlash(false);
    try {
      for (const t of dockRef.current.tasks) {
        if (t.kind === "sf10-upload" && t.status !== "running" && t.status !== "waiting") {
          dockRef.current.dismissTask(t.id);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const cancelItem = React.useCallback((key: string) => {
    const live = itemsRef.current.find((p) => p.key === key);
    if (!live) return;
    if (live.status === "uploading") {
      abortRef.current?.abort();
    } else {
      setItems((prev) => prev.filter((p) => p.key !== key));
      const id = taskIdsRef.current.get(key);
      taskIdsRef.current.delete(key);
      if (id) {
        try {
          dockRef.current.cancelTask(id);
        } catch {
          /* ignore */
        }
      }
    }
  }, []);

  const startUpload = React.useCallback(() => {
    if (uploading) return;
    const actionable = itemsRef.current.filter(
      (i) => i.status === "queued" || i.status === "error" || (i.status === "needs-grade" && i.gradeLevel),
    );
    if (actionable.length === 0) return;
    setFiledFlash(false);
    setMinimized(false);
    setUploading(true);
    setProgress({ done: 0, total: actionable.length });
    setDoneCount(0);
    void (async () => {
      let ok = 0;
      let fail = 0;
      try {
        for (let idx = 0; idx < actionable.length; idx++) {
          const item = actionable[idx];
          if (!itemsRef.current.some((p) => p.key === item.key)) {
            setProgress({ done: idx + 1, total: actionable.length });
            continue;
          }
          setCurrentName(item.file.name);
          const taskId = dockTaskFor(item.key, item.file.name);
          if (taskId) {
            try {
              dockRef.current.updateTask(taskId, { title: item.file.name, description: "Uploading…", status: "running", progress: { done: idx, total: actionable.length }, error: null });
            } catch {
              /* ignore */
            }
          }
          setItems((prev) => prev.map((p) => (p.key === item.key ? { ...p, status: "uploading", error: null } : p)));
          const controller = new AbortController();
          abortRef.current = controller;
          try {
            const result = await uploadSf10Auto(item.file, item.gradeLevel || null, controller.signal);
            ok += 1;
            setDoneCount(ok);
            setItems((prev) =>
              prev.map((p) =>
                p.key === item.key
                  ? { ...p, status: "done", recordId: result.id, learnerName: result.learner?.fullName ?? null, lrn: result.learner?.lrn ?? null, error: null }
                  : p,
              ),
            );
            setFiledIds((prev) => [...prev, result.id]);
            if (taskId) {
              try {
                const label = result.learner?.fullName ?? "Filed";
                dockRef.current.updateTask(taskId, { description: result.learner?.lrn ? `${label} · LRN ${result.learner.lrn}` : label, progress: { done: idx + 1, total: actionable.length } });
                dockRef.current.completeTask(taskId);
              } catch {
                /* ignore */
              }
            }
            for (const key of INVALIDATE_KEYS) {
              void qc.invalidateQueries({ queryKey: key });
            }
          } catch (e) {
            if (isCancelError(e)) {
              setItems((prev) => prev.filter((p) => p.key !== item.key));
              settleDockTask(item.key, (id) => dockRef.current.cancelTask(id));
              taskIdsRef.current.delete(item.key);
            } else {
              fail += 1;
              if (apiErrorCode(e) === "NO_GRADE_IN_FILE") {
                const msg = apiErrorMessage(e, "The record's grade level could not be read from the file.");
                setItems((prev) =>
                  prev.map((p) => (p.key === item.key ? { ...p, status: "needs-grade", error: msg } : p)),
                );
                settleDockTask(item.key, (id) => dockRef.current.failTask(id, "Needs grade — pick grade and upload again."));
              } else {
                const msg = apiErrorMessage(e, "Could not attach the SF10 file.");
                setItems((prev) => prev.map((p) => (p.key === item.key ? { ...p, status: "error", error: msg } : p)));
                settleDockTask(item.key, (id) => dockRef.current.failTask(id, msg));
              }
            }
          } finally {
            if (abortRef.current === controller) abortRef.current = null;
            setProgress({ done: idx + 1, total: actionable.length });
          }
        }
        if (ok > 0) {
          toast.success({
            title: ok === 1 ? "1 SF10 filed" : `${ok} SF10s filed`,
            description: fail > 0 ? `${fail} file${fail === 1 ? "" : "s"} need${fail === 1 ? "s" : ""} attention in the upload queue.` : "All files attached under this desk.",
          });
          // Stay visible until the teacher dismisses it — no auto-hide.
          setFiledFlash(true);
        } else if (fail > 0) {
          toast.error({
            title: "Bulk upload finished",
            description: `${fail} file${fail === 1 ? "" : "s"} need${fail === 1 ? "s" : ""} attention in the upload queue.`,
          });
          setFiledFlash(true);
        }
      } finally {
        setUploading(false);
        setCurrentName("");
      }
    })();
  }, [qc, uploading, dockTaskFor, settleDockTask]);

  const value = React.useMemo<Sf10BulkUploadValue>(
    () => ({
      items,
      filedIds,
      uploading,
      uploadStep: 0,
      progress,
      currentName,
      doneCount,
      filedFlash,
      minimized,
      setMinimized,
      enqueueFiles,
      removeItem,
      clearDone,
      clearAll,
      setItemGrade,
      startUpload,
      cancelItem,
      dismissDock,
    }),
    [items, filedIds, uploading, progress, currentName, doneCount, filedFlash, minimized, enqueueFiles, removeItem, clearDone, clearAll, setItemGrade, startUpload, cancelItem, dismissDock],
  );

  return <Sf10BulkUploadContext.Provider value={value}>{children}</Sf10BulkUploadContext.Provider>;
}
