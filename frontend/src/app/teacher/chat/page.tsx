"use client";

import { Suspense } from "react";
import { BamaChat } from "./components/BamaChat";

export default function TeacherChatPage() {
  return (
    <Suspense>
      <BamaChat />
    </Suspense>
  );
}
