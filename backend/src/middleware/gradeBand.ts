import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import type { GradeLevel } from "@prisma/client";

const BAND_7_10: GradeLevel[] = ["G7", "G8", "G9", "G10"];
const BAND_11_12: GradeLevel[] = ["G11", "G12"];

function bandFor(grade: GradeLevel): "7-10" | "11-12" {
  return BAND_7_10.includes(grade) ? "7-10" : "11-12";
}

// Enforces grade-banded authority for record_keeper (7-10) and registrar (11-12).
// `resolveStudentId` returns the student whose grade band is being acted on.
export function gradeBandGuard(resolveStudentId: (req: Request) => string | Promise<string>) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
    if (req.user.role !== "record_keeper" && req.user.role !== "registrar") return next();

    try {
      const studentId = await resolveStudentId(req);
      const profile = await prisma.studentProfile.findUnique({
        where: { userId: studentId },
        select: { gradeLevel: true },
      });
      if (!profile) return next(new AppError(404, "STUDENT_NOT_FOUND", "Student profile not found"));

      const band = bandFor(profile.gradeLevel);
      const allowed =
        (req.user.role === "record_keeper" && band === "7-10") ||
        (req.user.role === "registrar" && band === "11-12");
      if (!allowed) {
        return next(new AppError(403, "GRADE_BAND_FORBIDDEN", `Role not authorized for grade band ${band}`));
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}
