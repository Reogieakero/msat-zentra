"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import { RaiseFlagChat } from "./components/RaiseFlagChat";
import { FlagHistory } from "./components/FlagHistory";
import styles from "./components/grade-flags.module.css";

export default function TeacherGradeFlagsPage() {
  const [view, setView] = useState<"compose" | "history">("compose");

  return (
    <section className={styles.page}>
      {view === "compose" ? (
        <>
          <div className={styles.topbar}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setView("history")}
            >
              <History aria-hidden />
              History
            </Button>
          </div>
          <div className={styles.body}>
            <RaiseFlagChat />
          </div>
        </>
      ) : (
        <div className={styles.boardWrap}>
          <FlagHistory onBack={() => setView("compose")} />
        </div>
      )}
    </section>
  );
}
