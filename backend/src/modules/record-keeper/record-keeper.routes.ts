import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { validate } from "../../middleware/validate.js";
import { scopedYearId } from "../../lib/termScope.js";
import {
  GRADE_BAND_7_10,
} from "../registry/registry.repository.js";
import { RECORD_KEEPER_IDENTITY } from "../../services/registry/registry.types.js";
import {
  registryAccessRequestsQuerySchema,
  registryAccountsAuditQuerySchema,
  registryFinalGradesQuerySchema,
  registryPhotoSchema,
  registryProfileSchema,
} from "../registry/registry.schemas.js";
import { getOverview } from "../../services/registry/overview.service.js";
import { listFinalGrades } from "../../services/registry/finals.service.js";
import {
  buildRecordKeeperBreakdown,
  getAccountBreakdown,
  getAccountsAudit,
  listBandStudents,
} from "../../services/registry/accounts.service.js";
import {
  approveAccessLrn,
  approveAllMatched,
  checkAccessRecords,
  checkAccessRecordsStream,
  decideAccess,
  getAccessRecords,
  listAccessRequests,
  reportMissingAccessRecord,
  type CheckStreamEvent,
} from "../../services/registry/access.service.js";
import {
  readProfileSettings,
  updateProfilePhoto,
  updateProfileSettings,
} from "../../services/registry/settings.service.js";

const router = Router();

function ctxOf(req: { user?: { id: string; role: string } }) {
  return { userId: req.user!.id, role: req.user!.role, band: GRADE_BAND_7_10 };
}

router.get(
  "/overview",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: [CACHE_TAGS.recordKeeper, CACHE_TAGS.overview], ttl: CACHE_TTLS.dashboard }),
  etag(),
  async (req, res, next) => {
    try {
      const schoolYearId = req.termScope?.schoolYearId ?? null;
      res.json(await getOverview(ctxOf(req), { attachTake: 100 }, schoolYearId));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/final-grades",
  requireAuth,
  requireRole("record_keeper"),
  validate("query", registryFinalGradesQuerySchema),
  cache({ tags: [CACHE_TAGS.recordKeeper, CACHE_TAGS.academics, CACHE_TAGS.overview], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      const q = req.query as Record<string, unknown>;
      const page = Math.max(1, Number(q.page) || 1);
      const pageSize = Math.max(1, Math.min(Number(q.pageSize) || 15, 15));
      const search = typeof q.q === "string" ? q.q.trim().toLowerCase() : "";
      res.json(await listFinalGrades(ctxOf(req), { page, pageSize, q: search }));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/account-breakdown",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: [CACHE_TAGS.recordKeeper, "accounts"], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      const schoolYearId = req.termScope?.schoolYearId ?? (await scopedYearId(req));
      const { roster, statusByLrn } = await getAccountBreakdown(ctxOf(req), { schoolYearId });
      res.json({ data: await buildRecordKeeperBreakdown(GRADE_BAND_7_10, roster, statusByLrn) });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/accounts-audit",
  requireAuth,
  requireRole("record_keeper"),
  validate("query", registryAccountsAuditQuerySchema),
  cache({ tags: [CACHE_TAGS.recordKeeper, CACHE_TAGS.audit], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      const q = req.query as Record<string, unknown>;
      const page = Math.max(parseInt(String(q.page ?? "1"), 10) || 1, 1);
      const pageSize = Math.max(1, Math.min(parseInt(String(q.pageSize ?? "15"), 10) || 15, 15));
      res.json(await getAccountsAudit({ band: GRADE_BAND_7_10, page, pageSize }));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/adviser-access-requests",
  requireAuth,
  requireRole("record_keeper"),
  validate("query", registryAccessRequestsQuerySchema),
  cache({ tags: [CACHE_TAGS.recordKeeper, "adviser-access"], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      const q = req.query as Record<string, unknown>;
      const statusFilter = typeof q.status === "string" && q.status ? q.status : undefined;
      res.json(
        await listAccessRequests({ band: GRADE_BAND_7_10, scope: "request", status: statusFilter }),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/adviser-access-requests/:id/records",
  requireAuth,
  requireRole("record_keeper"),
  async (req, res, next) => {
    try {
      res.json(
        await getAccessRecords({
          requestId: String(req.params.id),
          band: GRADE_BAND_7_10,
          enforceBand: true,
        }),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/adviser-access-requests/:id/approve",
  requireAuth,
  requireRole("record_keeper"),
  (req, res, next) => {
    decideAccessRequestRK(req, res, next, true).catch(next);
  }
);

router.post(
  "/adviser-access-requests/:id/deny",
  requireAuth,
  requireRole("record_keeper"),
  (req, res, next) => {
    decideAccessRequestRK(req, res, next, false).catch(next);
  }
);

router.post(
  "/adviser-access-requests/:id/check",
  requireAuth,
  requireRole("record_keeper"),
  async (req, res, next) => {
    try {
      const result = await checkAccessRecords(ctxOf(req), {
        requestId: String(req.params.id),
        band: GRADE_BAND_7_10,
        enforceBand: true,
      });
      await invalidateTags(["record-keeper", "record-keeper-access", "adviser-access", "teacher", "overview"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

const reportMissingSchema = z.object({
  lrn: z.string().trim().min(1).max(32),
});

// Streamed verification: one event per advisee verdict as it is produced,
// then a done event with the summary — the desk dock flips rows live.
router.post(
  "/adviser-access-requests/:id/check-stream",
  requireAuth,
  requireRole("record_keeper"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      let finished = false;
      req.on("close", () => {
        finished = true;
      });
      const send = (event: CheckStreamEvent) => {
        if (finished) return;
        const { type, ...payload } = event;
        res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
      };
      await checkAccessRecordsStream(
        ctxOf(req),
        { requestId: id, band: GRADE_BAND_7_10, enforceBand: true },
        (event) => send(event),
        () => finished,
        async () => {
          await invalidateTags(["record-keeper", "record-keeper-access", "adviser-access", "teacher", "overview"]);
        },
      );
      await invalidateTags(["record-keeper", "record-keeper-access", "adviser-access", "teacher", "overview"]);
      finished = true;
      res.end();
    } catch (e) {
      if (!res.headersSent) {
        next(e);
        return;
      }
      try {
        const err = e as { message?: unknown; code?: unknown };
        res.write(
          `event: error\ndata: ${JSON.stringify({
            message: typeof err?.message === "string" ? err.message : "Check failed",
            code: typeof err?.code === "string" ? err.code : "CHECK_FAILED",
          })}\n\n`,
        );
      } catch {
        // Client already gone — nothing left to send to.
      }
      res.end();
    }
  }
);

// "Report as missing" for one requested student: stored mark + adviser notice.
router.post(
  "/adviser-access-requests/:id/report-missing",
  requireAuth,
  requireRole("record_keeper"),
  validate("body", reportMissingSchema),
  async (req, res, next) => {
    try {
      const body = req.body as { lrn: string };
      const result = await reportMissingAccessRecord(ctxOf(req), {
        requestId: String(req.params.id),
        lrn: body.lrn,
        band: GRADE_BAND_7_10,
        enforceBand: true,
        deskLabel: "record keeper",
      });
      await invalidateTags(["record-keeper", "record-keeper-access", "adviser-access", "teacher"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

const approveLrnSchema = z.object({
  lrn: z.string().trim().min(1).max(32),
});

// Per-student approval for one matched student (whole request untouched).
router.post(
  "/adviser-access-requests/:id/approve-lrn",
  requireAuth,
  requireRole("record_keeper"),
  validate("body", approveLrnSchema),
  async (req, res, next) => {
    try {
      const body = req.body as { lrn: string };
      const result = await approveAccessLrn(ctxOf(req), {
        requestId: String(req.params.id),
        lrn: body.lrn,
        band: GRADE_BAND_7_10,
        enforceBand: true,
      });
      await invalidateTags(["record-keeper", "record-keeper-access", "adviser-access", "teacher"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

// Bulk "approve all": every matched student, never reported/missing ones.
router.post(
  "/adviser-access-requests/:id/approve-all",
  requireAuth,
  requireRole("record_keeper"),
  async (req, res, next) => {
    try {
      const result = await approveAllMatched(ctxOf(req), {
        requestId: String(req.params.id),
        band: GRADE_BAND_7_10,
        enforceBand: true,
      });
      await invalidateTags(["record-keeper", "record-keeper-access", "adviser-access", "teacher"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

async function decideAccessRequestRK(req: any, res: any, next: any, approved: boolean) {
  try {
    const result = await decideAccess(ctxOf(req), {
      requestId: String(req.params.id),
      approved,
      denyReason: (req.body as { reason?: string })?.reason,
      enforceBand: true,
      denyDefault: "Denied by record keeper",
    });
    await invalidateTags(["record-keeper", "record-keeper-access", "record-keeper-overview", "adviser-access", "overview"]);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

router.get(
  "/students",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: [CACHE_TAGS.recordKeeper, "accounts"], ttl: CACHE_TTLS.list }),
  etag(),
  async (_req, res, next) => {
    try {
      res.json(await listBandStudents(GRADE_BAND_7_10));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/settings/profile",
  requireAuth,
  requireRole("record_keeper"),
  async (req, res, next) => {
    try {
      res.json(await readProfileSettings(req.user!.id));
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/settings/profile",
  requireAuth,
  requireRole("record_keeper"),
  validate("body", registryProfileSchema),
  async (req, res, next) => {
    try {
      const { fullName, primaryColor, secondaryColor } = req.body as {
        fullName?: string;
        primaryColor?: string | null;
        secondaryColor?: string | null;
      };
      const result = await updateProfileSettings(ctxOf(req), RECORD_KEEPER_IDENTITY, {
        fullName,
        primaryColor,
        secondaryColor,
      });
      await invalidateTags(["record-keeper", "overview"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/settings/photo",
  requireAuth,
  requireRole("record_keeper"),
  validate("body", registryPhotoSchema),
  async (req, res, next) => {
    try {
      const { photoUrl } = req.body as { photoUrl: string };
      const result = await updateProfilePhoto(ctxOf(req), RECORD_KEEPER_IDENTITY, photoUrl);
      await invalidateTags(["record-keeper", "overview"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
