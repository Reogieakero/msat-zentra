"use client";

import * as React from "react";
import { Sf10UploadPanel } from "./components/Sf10UploadPanel";
import { useSession } from "@/lib/auth/useSession";
import { uploadSf10 } from "./api";
import styles from "./sf10.module.css";

export default function RegistrarSf10Page() {
  const session = useSession();

  const handleUpload = async (file: File) => {
    const studentId = session?.sub ?? "";
    await uploadSf10(studentId, file);
  };

  return (
    <section className={styles.page}>
      <Sf10UploadPanel onUpload={handleUpload} />
    </section>
  );
}
