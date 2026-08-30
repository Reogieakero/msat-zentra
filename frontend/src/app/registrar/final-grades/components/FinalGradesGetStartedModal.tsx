"use client";

import * as React from "react";
import { Sparkles, GraduationCap, UserCheck, FileCheck2, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Stepper, { Step } from "@/components/ui/stepper/Stepper";
import styles from "./FinalGradesGetStartedModal.module.css";

const DISMISS_KEY = "zentra.finalGrades.getStarted.dismissed";

function readDismissed(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(DISMISS_KEY) !== null;
}

export function FinalGradesGetStartedModal() {
  const [dismissed, setDismissed] = React.useState<boolean>(readDismissed);
  const [open, setOpen] = React.useState<boolean>(!readDismissed());

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      window.localStorage.setItem(DISMISS_KEY, "1");
      setDismissed(true);
    }
  };

  const replay = () => {
    setOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={styles.trigger}
          onClick={replay}
          style={dismissed ? undefined : { display: "none" }}
        >
          <Sparkles /> How it works
        </Button>
      </DialogTrigger>

      <DialogContent className={styles.content} showCloseButton>
        <DialogHeader className={styles.header}>
          <DialogTitle className={styles.title}>Final Grade Approvals</DialogTitle>
          <DialogDescription className={styles.description}>
            Every G11–G12 final grade moves through a three-stage pipeline before it is
            released. Here is the flow:
          </DialogDescription>
        </DialogHeader>

        <div className={styles.seedNote}>
          <ShieldCheck className={styles.seedIcon} aria-hidden />
          <p className={styles.seedText}>
            <strong>Your action is required.</strong> Grades only become official
            after you, the registrar, review and approve each adviser-approved final
            on this screen.
          </p>
        </div>

        <div className={styles.stepperWrap}>
          <Stepper
            initialStep={1}
            backButtonText="Previous"
            nextButtonText="Next"
            onFinalStepCompleted={() => {
              window.localStorage.setItem(DISMISS_KEY, "1");
              setDismissed(true);
              setOpen(false);
            }}
          >
            <Step>
              <div className={styles.step}>
                <div className={styles.stepIcon}>
                  <GraduationCap />
                </div>
                <h2 className={styles.stepTitle}>1 · Subject Teacher submits</h2>
                <p className={styles.stepBody}>
                  The subject teacher computes the final average and{" "}
                  <strong>locks</strong> the grade. It can no longer be edited and moves to
                  the adviser for review.
                </p>
              </div>
            </Step>

            <Step>
              <div className={styles.step}>
                <div className={styles.stepIcon}>
                  <UserCheck />
                </div>
                <h2 className={styles.stepTitle}>2 · Adviser approves</h2>
                <p className={styles.stepBody}>
                  The section adviser verifies the locked finals and grants{" "}
                  <strong>adviser approval</strong>. Only adviser-approved grades advance to
                  the registrar.
                </p>
              </div>
            </Step>

            <Step>
              <div className={styles.step}>
                <div className={styles.stepIcon}>
                  <FileCheck2 />
                </div>
                <h2 className={styles.stepTitle}>3 · Registrar final approval</h2>
                <p className={styles.stepBody}>
                  The registrar or record keeper validates the adviser-approved finals on
                  this screen and marks them <strong>finalized</strong> — the grade is then
                  officially released.
                </p>
              </div>
            </Step>
          </Stepper>
        </div>
      </DialogContent>
    </Dialog>
  );
}
