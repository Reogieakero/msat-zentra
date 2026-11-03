"use client";

import * as React from "react";
import { useDock } from "@/components/dock/dock-store";

interface DockActionInput {
  title: string;
  description: string;
}

interface DockActionOptions {
  /** Row detail once the action settles successfully. */
  doneDescription?: string;
  /** Plain-words fallback when the action fails without a useful message. */
  failDescription?: string;
}

function errorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/**
 * Reports every Settings mutation into the one shared bottom-right Dock
 * (`components/dock`) instead of a page-local spinner/panel. The action is
 * re-thrown so callers keep their inline error copy and toasts.
 */
export function useSettingsDockAction() {
  const dock = useDock();
  return React.useCallback(
    async (
      input: DockActionInput,
      action: () => Promise<void>,
      options?: DockActionOptions,
    ): Promise<void> => {
      const id = dock.startTask({
        kind: "generic",
        title: input.title,
        description: input.description,
      });
      try {
        await action();
        dock.completeTask(id, options?.doneDescription ?? "Done");
      } catch (err) {
        dock.failTask(
          id,
          errorMessage(err, options?.failDescription ?? "Please try again."),
        );
        throw err;
      }
    },
    [dock],
  );
}
