import * as React from "react";
import { ZentraPageHeader } from "@/components/shared/zentra-page-header/ZentraPageHeader";

interface PrincipalPageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PrincipalPageHeader({
  title,
  description,
  actions,
}: PrincipalPageHeaderProps) {
  return <ZentraPageHeader title={title} description={description} actions={actions} />;
}
