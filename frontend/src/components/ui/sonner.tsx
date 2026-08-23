"use client";

import { Toaster as SileoToaster, sileo } from "sileo";

const TOAST_STYLES = {
  title: "text-black!",
  description: "text-black/80!",
};

const Toaster = ({
  position = "top-right",
}: {
  position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
}) => {
  return <SileoToaster position={position} theme="dark" options={{ styles: TOAST_STYLES }} />;
};

type ToastInput = string | { title?: string; description?: string };

function normalize(input: ToastInput) {
  if (typeof input === "string") return { title: input, styles: TOAST_STYLES };
  return { ...input, styles: TOAST_STYLES };
}

const toast = {
  show: (input: ToastInput) => sileo.show(normalize(input)),
  success: (input: ToastInput) => sileo.success(normalize(input)),
  error: (input: ToastInput) => sileo.error(normalize(input)),
  warning: (input: ToastInput) => sileo.warning(normalize(input)),
  info: (input: ToastInput) => sileo.info(normalize(input)),
  action: (opts: Parameters<typeof sileo.action>[0]) => sileo.action(opts),
  promise: sileo.promise,
  dismiss: (id: string) => sileo.dismiss(id),
  message: (input: ToastInput) => sileo.show(normalize(input)),
};

export { Toaster, toast, sileo };
