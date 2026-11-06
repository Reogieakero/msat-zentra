"use client";

import * as React from "react";

/**
 * Lets a page append one extra crumb to the shell breadcrumb (e.g. the
 * student list's currently selected section) without owning the breadcrumb
 * itself. The provider lives in the role layout; pages call
 * `useBreadcrumbExtra(label, onParentClick?)` and the crumb disappears on
 * unmount. `onParentClick` turns the parent crumb (e.g. "Students") into a
 * control that resets the page view instead of navigating.
 */
export interface BreadcrumbExtra {
  label: string;
  onParentClick?: () => void;
}

interface BreadcrumbExtraValue {
  extra: BreadcrumbExtra | null;
  setExtra: (value: BreadcrumbExtra | null) => void;
}

const BreadcrumbExtraContext = React.createContext<BreadcrumbExtraValue | null>(null);

export function BreadcrumbExtraProvider({ children }: { children: React.ReactNode }) {
  const [extra, setExtra] = React.useState<BreadcrumbExtra | null>(null);
  const value = React.useMemo<BreadcrumbExtraValue>(() => ({ extra, setExtra }), [extra]);
  return (
    <BreadcrumbExtraContext.Provider value={value}>{children}</BreadcrumbExtraContext.Provider>
  );
}

export function useBreadcrumbExtraContext(): BreadcrumbExtraValue | null {
  return React.useContext(BreadcrumbExtraContext);
}

/** Register the current page's extra crumb. Pass `null` to clear it. */
export function useBreadcrumbExtra(
  label: string | null | undefined,
  onParentClick?: () => void,
) {
  const context = React.useContext(BreadcrumbExtraContext);
  const setExtra = context?.setExtra;

  React.useEffect(() => {
    if (!setExtra) return;
    setExtra(label ? { label, onParentClick } : null);
    return () => setExtra(null);
  }, [setExtra, label, onParentClick]);
}
