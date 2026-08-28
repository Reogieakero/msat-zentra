import * as React from "react";
import { Check } from "lucide-react";
import { ADM_PIPELINE, type AdmPipelineStage } from "../mockData";
import pipeline from "./admPipeline.module.css";

export function PipelineStrip({
  currentStage,
}: {
  currentStage: AdmPipelineStage;
}) {
  const currentOrder = ADM_PIPELINE.find((s) => s.stage === currentStage)?.order ?? 1;
  return (
    <ol className={pipeline.track} aria-label="ADM intake pipeline">
      {ADM_PIPELINE.map((step, i) => {
        const done = step.order < currentOrder;
        const active = step.order === currentOrder;
        const last = i === ADM_PIPELINE.length - 1;
        return (
          <li
            key={step.stage}
            className={`${pipeline.step} ${done ? pipeline.done : ""} ${
              active ? pipeline.active : ""
            } ${step.principalAction ? pipeline.principal : ""}`}
          >
            <div className={pipeline.markerCol}>
              <span className={pipeline.marker}>
                {done ? (
                  <Check className={pipeline.markerIcon} aria-hidden />
                ) : (
                  <span className={pipeline.markerNum}>{step.order}</span>
                )}
              </span>
              {!last && <span className={pipeline.connector} aria-hidden />}
            </div>
            <div className={pipeline.body}>
              <div className={pipeline.line}>
                <span className={pipeline.label}>{step.label}</span>
                {step.principalAction && (
                  <span className={pipeline.badge}>Your action</span>
                )}
              </div>
              <span className={pipeline.owner}>{step.owner}</span>
              <p className={pipeline.desc}>{step.description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
