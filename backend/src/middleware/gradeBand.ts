import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import type { GradeLevel } from "../generated/prisma/client.js";
import { bandAllowed, bandForGrade, isBandRole } from "../lib/roles.js";

export function gradeBandGuard(resolveStudentId: (req: Request) => string | Promise<string>) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
    if (!isBandRole(req.user.role)) return next();

    try {
      const studentId = await resolveStudentId(req);

      if (studentId.startsWith("roster:")) {
        const entry = await prisma.studentRoster.findUnique({
          where: { id: studentId.slice("roster:".length) },
          select: { gradeLevel: true },
        });
        if (!entry) return next(new AppError(404, "STUDENT_NOT_FOUND", "Student profile not found"));
        const band = bandForGrade(entry.gradeLevel);
        if (!bandAllowed(req.user.role, band)) {
          return next(new AppError(403, "GRADE_BAND_FORBIDDEN", `Role not authorized for grade band ${band}`));
        }
        return next();
      }

      const profile = await prisma.studentProfile.findUnique({
        where: { userId: studentId },
        select: { gradeLevel: true },
      });

      let grade: GradeLevel | null | undefined = profile?.gradeLevel;
      if (!grade) {
        const user = await prisma.user.findUnique({
          where: { id: studentId },
          select: { lrn: true },
        });
        if (user?.lrn) {
          const roster = await prisma.studentRoster.findFirst({
            where: { lrn: user.lrn },
            orderBy: { schoolYearId: "desc" },
          });
          grade = roster?.gradeLevel;
        }
      }
      if (!grade) return next(new AppError(404, "STUDENT_NOT_FOUND", "Student profile not found"));

      const band = bandForGrade(grade);
      if (!bandAllowed(req.user.role, band)) {
        return next(new AppError(403, "GRADE_BAND_FORBIDDEN", `Role not authorized for grade band ${band}`));
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}
