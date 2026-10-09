import * as React from "react";
import { ZentraPageHeader } from "@/components/shared/zentra-page-header/ZentraPageHeader";

interface RecordKeeperPageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export function RecordKeeperPageHeader({
  title,
  description,
  actions,
}: RecordKeeperPageHeaderProps) {
  return <ZentraPageHeader title={title} description={description} actions={actions} />;
}
