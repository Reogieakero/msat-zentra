import { Router } from "express";import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { getOverview, getStudentList } from "../../services/teacher/overview.service.js";

const router = Router();

// Teacher / Adviser overview (TEACH-1). Live data only — no mocked rows.
// Classes come from TeacherSubjectAssignment, the advisory section from
// Section.adviserId, flags from AnecdotalRecord created by this teacher, and
// recent activity from AuditLog rows for this user. Risk is recomputed live so
// the overview agrees with the risk engine.
router.get(
  "/overview",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  // Longer-lived than the default 60s: repeated desk reads re-hit the
  // cache for minutes. Writes still purge via tags, so saves stay live.
  cache({ ttl: 300, tags: ["teacher", "overview"] }),
  async (req, res, next) => {
    try {
      // Scope narrows the payload so first paint stays light:
      // - `critical` skips assessments/standings/activity (heavy aggregations).
      // - `secondary` skips the advisory risk engine (heavy per-student scans).
      // - `gradebook` serves the grading landing in one round trip: classes +
      //   assessments + standings only (no risk scans, no advisory engine,
      //   no activity log).
      // - absent scope returns the full legacy shape (backward compatible).
      const scopeParam = req.query.scope;
      const scope =
        scopeParam === "critical" || scopeParam === "secondary" || scopeParam === "gradebook"
          ? scopeParam
          : "full";
      const termId = await resolveActiveTermId(req);
      res.json(
        await getOverview(
          {
            userId: req.user!.id,
            role: req.user!.role,
            termId,
            schoolYearId: req.termScope?.schoolYearId ?? null,
          },
          scope,
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

// Student list for the Overview → Student List page (regular teachers AND
// advisers, same display). Self-sufficient in one round-trip: it returns the
// handled-class rail, the advisory rail, AND the active roster, so the page
// never waits on the heavier overview payload first.
//
// Two roster modes share one student-row shape (name + LRN, attendance %,
// academic grade):
// - subject mode (`classId`: assignment id or `subjectId|sectionId`) — every
//   student in the section with attendance % and grade for that specific
//   subject (attendance-sheet basis: elapsed meetups with no take = absent).
// - advisory mode (`advisorySectionId`) — the teacher's advisees with the
//   per-subject-average attendance % (same definition as the advisory
//   attendance display) and the general-average academic grade across the
//   section's offered subjects.
// Omitted ids serve the teacher's first advisory section (advisers) or first
// handled class (regular teachers). Every id is verified against the
// caller's assignments + committed timetable links + advised sections.
router.get(
  "/overview/student-list",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  // Longer-lived than the default 60s: rail switches re-hit the cache for
  // minutes at a time. Writes still purge via the teacher/overview tags, so
  // attendance and grade saves stay live.
  cache({ ttl: 300, tags: ["teacher", "overview"] }),
  async (req, res, next) => {
    try {
      const classIdParam = String(req.query.classId ?? "").trim();
      const advisorySectionParam = String(req.query.advisorySectionId ?? "").trim();
      const termId = await resolveActiveTermId(req);
      res.json(
        await getStudentList(
          {
            userId: req.user!.id,
            role: req.user!.role,
            termId,
            schoolYearId: req.termScope?.schoolYearId ?? null,
          },
          { classId: classIdParam, advisorySectionId: advisorySectionParam },
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

export default router;
