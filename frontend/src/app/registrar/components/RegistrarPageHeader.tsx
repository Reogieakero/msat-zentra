import * as React from "react";
import { ZentraPageHeader } from "@/components/shared/zentra-page-header/ZentraPageHeader";

interface RegistrarPageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export function RegistrarPageHeader({
  title,
  description,
  actions,
}: RegistrarPageHeaderProps) {
  return <ZentraPageHeader title={title} description={description} actions={actions} />;
}
