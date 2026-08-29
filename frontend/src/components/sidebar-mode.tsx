"use client";

import * as React from "react";
import type { SidebarMode } from "@/components/registrar-sidebar";

export const SidebarModeContext = React.createContext<SidebarMode>("hover");

export function useSidebarMode(): SidebarMode {
  return React.useContext(SidebarModeContext);
}
