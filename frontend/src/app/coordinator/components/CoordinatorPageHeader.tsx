import * as React from "react";
import { ZentraPageHeader } from "@/components/shared/zentra-page-header/ZentraPageHeader";

interface CoordinatorPageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export function CoordinatorPageHeader({
  title,
  description,
  actions,
}: CoordinatorPageHeaderProps) {
  return <ZentraPageHeader title={title} description={description} actions={actions} />;
}
