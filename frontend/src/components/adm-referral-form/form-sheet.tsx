"use client";
import * as React from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import sheetStyles from "./adm-referral-form-sheet.module.css";
export function FormSheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Sheet open onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side="right"
        className="w-1/2 max-w-none data-[side=right]:w-1/2 data-[side=right]:sm:max-w-none"
      >
        <SheetTitle className="sr-only">Referral form</SheetTitle>
        <div className={sheetStyles.scrollBody}>{children}</div>
      </SheetContent>
    </Sheet>
  );
}
