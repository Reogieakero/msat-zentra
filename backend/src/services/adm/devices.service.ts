import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { actorName, GRADE_LABEL } from "../../modules/adm/adm.repository.js";
import type { AdmContext } from "./adm.types.js";

export interface IssueDeviceInput {
  admLearnerProfileId: string;
  deviceType: string;
  deviceSerial: string;
  issuedDate?: string;
  conditionNotes?: string;
}

export async function issueDevice(ctx: AdmContext, input: IssueDeviceInput) {
  const serial = String(input.deviceSerial ?? "").trim();
  // Guard: one active issue per serial — a still-issued device holding
  // the same serial (case-insensitive) rejects with 409 so the dialog
  // can show an inline duplicate error instead of double-issuing.
  const clash = await prisma.admDevice.findFirst({
    where: {
      deviceSerial: { equals: serial, mode: "insensitive" },
      returnedDate: null,
    },
    select: { id: true },
  });
  if (clash) throw new AppError(409, "DEVICE_SERIAL_IN_USE", `Serial ${serial} is already issued and not yet returned`);
  const profile = await prisma.admLearnerProfile.findUnique({
    where: { id: String(input.admLearnerProfileId) },
    include: {
      student: { select: { user: { select: { fullName: true } } } },
      referral: { select: { id: true, referredBy: true } },
    },
  });
  if (!profile) throw new AppError(404, "NOT_FOUND", "ADM learner profile not found");
  const device = await prisma.admDevice.create({
    data: {
      admLearnerProfileId: profile.id,
      deviceType: input.deviceType,
      deviceSerial: serial,
      conditionNotes: input.conditionNotes,
      issuedBy: ctx.userId,
      issuedDate: input.issuedDate ? new Date(input.issuedDate) : new Date(),
    },
  });
  await writeAudit({ userId: ctx.userId, actionType: "adm_edit", sourceTable: "adm_devices", sourceId: device.id, reason: "ADM device issued" });
  // Realtime handoff: the referring adviser learns the device moved
  // without refreshing — naming the issuing coordinator. Best-effort —
  // never delays the response.
  const studentName = profile.student?.user?.fullName ?? "your student";
  const actor = await actorName(ctx.userId);
  if (profile.referral && profile.referral.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: profile.referral.referredBy,
      sourceTable: "adm_devices",
      action: "issue",
      message: `${actor} issued learning device ${serial} to ${studentName}.`,
      sourceId: device.id,
    });
  }
  void fanoutToRole("adm_coordinator", {
    sourceTable: "adm_devices",
    action: "issue",
    message: `Learning device ${serial} issued.`,
    sourceId: device.id,
    excludeUserId: ctx.userId,
    messageFor: (r) =>
      `${actor} issued learning device ${serial} to ${studentName} — sent to you, ${r.fullName}.`,
  });
  // The Principal signs every ADM case, so issuance is principal-visible
  // too: same realtime toast + badge + row on the principal desk.
  void fanoutToRole("principal", {
    sourceTable: "adm_devices",
    action: "issue",
    message: `Learning device ${serial} issued to ${studentName}.`,
    sourceId: device.id,
    messageFor: (r) =>
      `${actor} issued learning device ${serial} to ${studentName} — sent to you, ${r.fullName}.`,
  });
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "adm_devices",
    action: "issue_self",
    message: `You issued learning device ${serial} to ${studentName} — devices.`,
    sourceId: device.id,
  });
  return device;
}

export async function returnDevice(ctx: AdmContext, deviceId: string, returnedDate?: string) {
  const device = await prisma.admDevice.findUnique({
    where: { id: deviceId },
    include: {
      admLearnerProfile: {
        select: {
          referral: { select: { id: true, referredBy: true } },
          student: { select: { user: { select: { fullName: true } } } },
        },
      },
    },
  });
  if (!device) throw new AppError(404, "NOT_FOUND", "Device not found");
  if (device.returnedDate) throw new AppError(409, "ALREADY_RETURNED", "Device already returned");
  const updated = await prisma.admDevice.update({ where: { id: device.id }, data: { returnedDate: returnedDate ? new Date(returnedDate) : new Date() } });
  await writeAudit({ userId: ctx.userId, actionType: "adm_edit", sourceTable: "adm_devices", sourceId: device.id, reason: "ADM device returned" });
  // Realtime handoff: the referring adviser learns of the return
  // without refreshing — naming the coordinator. Best-effort — never
  // delays the response.
  const ref = device.admLearnerProfile?.referral;
  const studentName = device.admLearnerProfile?.student?.user?.fullName ?? "your student";
  const actor = await actorName(ctx.userId);
  if (ref && ref.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: ref.referredBy,
      sourceTable: "adm_devices",
      action: "return",
      message: `${actor} marked learning device ${device.deviceSerial} returned for ${studentName}.`,
      sourceId: device.id,
    });
  }
  void fanoutToRole("adm_coordinator", {
    sourceTable: "adm_devices",
    action: "return",
    message: `Learning device ${device.deviceSerial} marked returned.`,
    sourceId: device.id,
    excludeUserId: ctx.userId,
    messageFor: (r) =>
      `${actor} marked learning device ${device.deviceSerial} returned for ${studentName} — sent to you, ${r.fullName}.`,
  });
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "adm_devices",
    action: "return_self",
    message: `You marked learning device ${device.deviceSerial} returned for ${studentName} — devices.`,
    sourceId: device.id,
  });
  return updated;
}

export interface DeviceLedgerQuery {
  q: string;
  statusParam: string;
  hasPaging: boolean;
  limit: number;
  page: number;
  orderOldest: boolean;
}

// Device ledger for the ADM Coordinator Devices page. Read-only join of
// every issued device with its learner profile + student. Status is derived
// (returnedDate != null → returned) — never stored.
export async function listDevices(query: DeviceLedgerQuery) {
  const { q, statusParam, hasPaging, limit, page, orderOldest } = query;
  const skip = limit > 0 ? (page - 1) * limit : 0;
  // DB-level status + search filter so the ledger stays constant-time
  // instead of pulling every device row into memory.
  const where: Prisma.AdmDeviceWhereInput = {
    ...(statusParam === "issued"
      ? { returnedDate: null }
      : statusParam === "returned"
        ? { returnedDate: { not: null } }
        : {}),
    ...(q
      ? {
          OR: [
            { deviceSerial: { contains: q, mode: "insensitive" as const } },
            {
              admLearnerProfile: {
                student: { user: { fullName: { contains: q, mode: "insensitive" as const } } },
              },
            },
            { admLearnerProfile: { student: { lrn: { contains: q } } } },
          ],
        }
      : {}),
  };
  const deviceInclude = {
    admLearnerProfile: {
      select: {
        id: true,
        stage: true,
        student: {
          select: {
            lrn: true,
            gradeLevel: true,
            user: { select: { fullName: true } },
          },
        },
      },
    },
    issuer: { select: { fullName: true } },
  };
  const [devices, total, issued, returned] = await Promise.all([
    prisma.admDevice.findMany({
      where,
      include: deviceInclude,
      orderBy: { issuedDate: orderOldest ? "asc" : "desc" },
      ...(limit > 0 ? { skip, take: limit } : {}),
    }),
    prisma.admDevice.count({ where }),
    prisma.admDevice.count({ where: { returnedDate: null } }),
    prisma.admDevice.count({ where: { returnedDate: { not: null } } }),
  ]);
  const rows = devices.map((d) => ({
    id: d.id,
    admLearnerProfileId: d.admLearnerProfileId,
    student: d.admLearnerProfile.student.user.fullName,
    lrn: d.admLearnerProfile.student.lrn,
    grade: GRADE_LABEL[d.admLearnerProfile.student.gradeLevel] ?? d.admLearnerProfile.student.gradeLevel,
    stage: d.admLearnerProfile.stage,
    deviceType: d.deviceType,
    deviceSerial: d.deviceSerial,
    issuedBy: d.issuer.fullName,
    issuedDate: d.issuedDate.toISOString().slice(0, 10),
    returnedDate: d.returnedDate ? d.returnedDate.toISOString().slice(0, 10) : null,
    conditionNotes: d.conditionNotes,
    status: d.returnedDate ? ("returned" as const) : ("issued" as const),
  }));
  // `total` = filtered pager count; issued/returned stay GLOBAL
  // (unfiltered) so tiles never shrink under search.
  const unfiltered = await prisma.admDevice.count();
  return {
    rows,
    total,
    unfilteredTotal: unfiltered,
    complete: unfiltered,
    issued,
    returned,
    ...(limit > 0
      ? {
          page,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          limit,
          pageSize: limit,
        }
      : {}),
  };
}
