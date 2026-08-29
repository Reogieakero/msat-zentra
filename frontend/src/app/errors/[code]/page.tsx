import { notFound } from "next/navigation";
import { StatusPage, type StatusVariant } from "@/components/errors/StatusPage";

const VALID: StatusVariant[] = ["401", "403", "404", "500"];

// A 401 (auth failure) is surfaced using the 403 "access restricted" page.
const CODE_TO_PRESET: Record<string, StatusVariant> = {
  "401": "403",
  "403": "403",
  "404": "404",
  "500": "500",
};

export default async function ErrorCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  if (!VALID.includes(code as StatusVariant)) {
    notFound();
  }

  const preset = CODE_TO_PRESET[code];

  if (code === "401") {
    return <StatusPage code={preset} backHref="/login" />;
  }

  return <StatusPage code={preset} />;
}
