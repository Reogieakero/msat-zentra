"use client";

import { Loader2 } from "lucide-react";
import styles from "./busy.module.css";

export function Busy({ busy }: { busy: boolean }) {
  if (!busy) return null;
  return <Loader2 className={styles.spin} aria-hidden="true" />;
}
