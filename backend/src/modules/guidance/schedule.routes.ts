import { Router, type Request } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { getCalendar, getDaySchedule } from "../../services/guidance/schedule.service.js";

const router = Router();

function guidanceContext(req: Request) {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    termId: req.termScope?.termId ?? null,
    schoolYearId: null,
  };
}

router.get(
  "/schedule",
  requireAuth,
  requireRole("guidance_counselor"),
  async (req, res, next) => {
    try {
      const dateKey =
        typeof req.query.date === "string" ? req.query.date.trim() : "";
      res.json(await getDaySchedule(guidanceContext(req), dateKey));
    } catch (e) {
      next(e);
    }
  }
);

/**
 * The desk calendar: every booked session/meeting in a date window, one merged
 * payload. `from`/`to` are ISO instants (the client sends its local month/week
 * boundaries) so the range never clips a session at a timezone edge.
 */
router.get(
  "/calendar",
  requireAuth,
  requireRole("guidance_counselor"),
  cache({
    tags: [CACHE_TAGS.guidance, CACHE_TAGS.referrals, CACHE_TAGS.interventions],
    // The calendar is the desk's live booking board; a long cache TTL would
    // serve the poll a pre-booking payload for up to 30s. 4s keeps the 15s
    // poll effectively fresh while still absorbing bursts.
    ttl: CACHE_TTLS.counts,
  }),
  etag(),
  async (req, res, next) => {
    try {
      const from = typeof req.query.from === "string" ? req.query.from : "";
      const to = typeof req.query.to === "string" ? req.query.to : "";
      const status = req.query.status === "scheduled" ? "scheduled" : "all";
      res.json(await getCalendar(guidanceContext(req), { from, to, status }));
    } catch (e) {
      next(e);
    }
  }
);

export default router;
