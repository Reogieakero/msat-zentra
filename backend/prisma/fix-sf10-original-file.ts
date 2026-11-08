import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
import { getEnv } from "../src/config/env.js";
import { getSf10Bucket } from "../src/lib/storage.js";

/**
 * One-off repair for records whose `uploadedFileUrl` was replaced by a Bama
 * auto-fill render (the old behaviour). Auto-fill now keeps the original
 * upload; this restores the earliest stored file for each affected record so
 * the "Original" tab has the registrar/record-keeper document again.
 *
 * Dry-run by default. Pass `--apply` to write.
 */

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
const APPLY = process.argv.includes("--apply");
const env = getEnv();
const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY,
);
const bucket = getSf10Bucket();

function timestampOf(name: string): number {
  const m = name.match(/-(\d{10,})\./);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

async function main() {
  const records = await prisma.sf10Record.findMany({
    select: {
      id: true,
      studentId: true,
      uploadedFileUrl: true,
      versions: { select: { dataSnapshot: true } },
      student: { select: { lrn: true, user: { select: { fullName: true } } } },
    },
  });

  let touched = 0;
  for (const rec of records) {
    const generatedUrls = new Set(
      rec.versions
        .map((v) => (v.dataSnapshot as { generatedFileUrl?: string } | null)?.generatedFileUrl)
        .filter((u): u is string => typeof u === "string"),
    );
    if (!rec.uploadedFileUrl || !generatedUrls.has(rec.uploadedFileUrl)) continue;

    const { data, error } = await supabase.storage
      .from(bucket)
      .list("sf10", { search: rec.studentId, limit: 100 });
    if (error) {
      console.log(`! ${rec.student.user.fullName}: storage list failed — ${error.message}`);
      continue;
    }
    const files = (data ?? [])
      .map((o) => o.name)
      .filter((name) => name.startsWith(`${rec.studentId}-`))
      .sort((a, b) => timestampOf(a) - timestampOf(b));
    if (files.length === 0) {
      console.log(`! ${rec.student.user.fullName}: no stored files found for ${rec.studentId}`);
      continue;
    }
    const original = files[0];
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(`sf10/${original}`);
    touched += 1;
    console.log(
      `${APPLY ? "" : "[dry] "}${rec.student.user.fullName} (${rec.student.lrn}): restored original ${original}`,
    );
    if (APPLY) {
      await prisma.sf10Record.update({
        where: { id: rec.id },
        data: { uploadedFileUrl: pub.publicUrl },
      });
    }
  }

  console.log(
    `${APPLY ? "done" : "[dry] no writes performed"}: ${touched} record(s) ${APPLY ? "restored" : "need restore"}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
