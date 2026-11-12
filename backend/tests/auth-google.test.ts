import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
  staffUpsert: vi.fn(),
  staffFindUnique: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    user: {
      findFirst: mocks.userFindFirst,
      create: mocks.userCreate,
      update: mocks.userUpdate,
    },
    staffProfile: {
      upsert: mocks.staffUpsert,
      findUnique: mocks.staffFindUnique,
    },
  },
}));

vi.mock("../src/lib/audit.js", () => ({ writeAudit: mocks.audit }));
vi.mock("../src/lib/notify.js", () => ({
  fanoutToRole: vi.fn(),
  fanoutNotification: vi.fn(),
}));
vi.mock("argon2", () => ({
  default: { hash: vi.fn(async () => "hashed"), verify: vi.fn(async () => true) },
}));

beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon";
  process.env.JWT_ACCESS_SECRET = "a";
  process.env.JWT_REFRESH_SECRET = "b";
});

const { exchangeGoogleSession, completeGoogleSignup, completeGoogleStaffSignup } = await import(
  "../src/services/auth/google.service.js"
);
const { AppError } = await import("../src/lib/errors.js");
function supabaseResponds(payload: unknown, ok = true) {
  globalThis.fetch = vi.fn(async () =>
    ({
      ok,
      json: async () => payload,
    }) as unknown as Response,
  ) as unknown as typeof fetch;
}

const VERIFIED = {
  email: "juan@msat.edu",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  user_metadata: { full_name: "Juan Dela Cruz" },
};

async function expectAppError(promise: Promise<unknown>, status: number, code: string) {
  await expect(promise).rejects.toMatchObject({ status, code });
  await expect(promise).rejects.toBeInstanceOf(AppError);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("exchangeGoogleSession", () => {
  it("rejects a token Supabase does not recognise", async () => {
    supabaseResponds({}, false);
    await expectAppError(exchangeGoogleSession("bad", "student"), 401, "INVALID_GOOGLE_TOKEN");
    expect(mocks.userFindFirst).not.toHaveBeenCalled();
  });

  it("rejects an unverified email", async () => {
    supabaseResponds({ email: "x@msat.edu" });
    await expectAppError(exchangeGoogleSession("tok", "student"), 401, "EMAIL_NOT_VERIFIED");
  });

  it("rejects a non-Google Supabase identity", async () => {
    supabaseResponds({ ...VERIFIED, app_metadata: { provider: "email" } });
    await expectAppError(exchangeGoogleSession("tok", "student"), 401, "INVALID_GOOGLE_TOKEN");
    expect(mocks.userFindFirst).not.toHaveBeenCalled();
  });

  it("creates a pending parent account and notifies the desks", async () => {
    supabaseResponds(VERIFIED);
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue({ id: "u1", email: "juan@msat.edu", fullName: "Juan Dela Cruz", role: "parent", status: "pending" });

    const result = await exchangeGoogleSession("tok", "parent", "signup");

    expect(result).toEqual({ status: "pending" });
    expect(mocks.userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "juan@msat.edu", role: "parent", status: "pending", fullName: "Juan Dela Cruz" }),
    });
    expect(mocks.audit).toHaveBeenCalled();
  });

  it("asks a new student for the LRN before creating the notification", async () => {
    supabaseResponds(VERIFIED);
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue({ id: "u2", email: "juan@msat.edu", fullName: "Juan Dela Cruz", role: "student", status: "pending", lrn: null });

    expect(await exchangeGoogleSession("tok", "student", "signup")).toEqual({ status: "needsProfile", role: "student" });
  });

  it("shows no-account on sign-in when the Google email is unknown", async () => {
    supabaseResponds(VERIFIED);
    mocks.userFindFirst.mockResolvedValue(null);

    expect(await exchangeGoogleSession("tok", "staff")).toEqual({ status: "noAccount", portal: "staff" });
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("asks a new teacher for personal details before creating the account", async () => {
    supabaseResponds(VERIFIED);
    mocks.userFindFirst.mockResolvedValue(null);

    expect(await exchangeGoogleSession("tok", "staff", "signup")).toEqual({
      status: "needsProfile",
      role: "subject_teacher",
    });
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("sends a pending teacher with no staff profile back to the details step", async () => {
    supabaseResponds(VERIFIED);
    mocks.userFindFirst.mockResolvedValue({
      id: "u13",
      role: "subject_teacher",
      status: "pending",
      lrn: null,
      staffProfile: null,
    });

    expect(await exchangeGoogleSession("tok", "staff", "signup")).toEqual({
      status: "needsProfile",
      role: "subject_teacher",
    });
  });

  it("reports pending once a teacher has submitted their details", async () => {
    supabaseResponds(VERIFIED);
    mocks.userFindFirst.mockResolvedValue({
      id: "u14",
      role: "subject_teacher",
      status: "pending",
      lrn: null,
      staffProfile: { employeeId: "EMP-001" },
    });

    expect(await exchangeGoogleSession("tok", "staff")).toEqual({ status: "pending" });
  });

  it("reports pending for an existing unapproved account", async () => {
    supabaseResponds(VERIFIED);
    mocks.userFindFirst.mockResolvedValue({ id: "u3", role: "parent", status: "pending", lrn: null });
    expect(await exchangeGoogleSession("tok", "parent")).toEqual({ status: "pending" });
  });

  it("treats a pending student without an LRN as needing profile info", async () => {
    supabaseResponds(VERIFIED);
    mocks.userFindFirst.mockResolvedValue({ id: "u4", role: "student", status: "pending", lrn: null });
    expect(await exchangeGoogleSession("tok", "student")).toEqual({ status: "needsProfile", role: "student" });
  });

  it("rejects suspended accounts", async () => {
    supabaseResponds(VERIFIED);
    mocks.userFindFirst.mockResolvedValue({ id: "u5", role: "student", status: "suspended" });
    await expectAppError(exchangeGoogleSession("tok", "student"), 403, "ACCOUNT_SUSPENDED");
  });

  it("blocks signing in through the wrong portal", async () => {
    supabaseResponds({ ...VERIFIED, email: "teacher@msat.edu" });
    mocks.userFindFirst.mockResolvedValue({ id: "u6", role: "subject_teacher", status: "active" });
    await expectAppError(exchangeGoogleSession("tok", "parent"), 403, "ROLE_MISMATCH");
  });

  it("issues the app session for an active user in the matching portal", async () => {
    supabaseResponds(VERIFIED);
    mocks.userFindFirst.mockResolvedValue({ id: "u7", role: "student", status: "active" });

    const result = await exchangeGoogleSession("tok", "student");

    expect(result.status).toBe("active");
    if (result.status === "active") {
      expect(result.role).toBe("student");
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
    }
  });
});

describe("completeGoogleSignup", () => {
  it("404s when no pending sign-up exists", async () => {
    supabaseResponds(VERIFIED);
    mocks.userFindFirst.mockResolvedValue(null);
    await expectAppError(completeGoogleSignup("tok", { lrn: "123456789012" }), 404, "SIGNUP_NOT_FOUND");
  });

  it("refuses an account that is not a pending student", async () => {
    supabaseResponds(VERIFIED);
    mocks.userFindFirst.mockResolvedValue({ id: "u8", role: "student", status: "active", lrn: "1" });
    await expectAppError(completeGoogleSignup("tok", { lrn: "123456789012" }), 409, "SIGNUP_NOT_PENDING");
  });

  it("saves the LRN and keeps the account pending", async () => {
    supabaseResponds(VERIFIED);
    mocks.userFindFirst.mockResolvedValue({ id: "u9", role: "student", status: "pending", lrn: null, contactNumber: null });
    mocks.userUpdate.mockResolvedValue({ id: "u9", role: "student", status: "pending", lrn: "123456789012", fullName: "Juan", email: "juan@msat.edu" });

    expect(await completeGoogleSignup("tok", { lrn: " 123456789012 " })).toEqual({ status: "pending" });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "u9" },
      data: { lrn: "123456789012", contactNumber: null },
    });
  });
});

describe("completeGoogleStaffSignup", () => {
  it("creates a pending subject-teacher account with the submitted details", async () => {
    supabaseResponds(VERIFIED);
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue({
      id: "u11",
      email: "juan@msat.edu",
      fullName: "Juan Dela Cruz",
      role: "subject_teacher",
      status: "pending",
      contactNumber: "09171234567",
    });

    const result = await completeGoogleStaffSignup("tok", {
      fullName: "Juan Dela Cruz",
      suffix: "jr",
      contactNumber: "09171234567",
      employeeId: "EMP-001",
      department: "Math",
    });

    expect(result).toEqual({ status: "pending" });
    expect(mocks.userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "juan@msat.edu",
        fullName: "Juan Dela Cruz Jr.",
        role: "subject_teacher",
        status: "pending",
        staffProfile: { create: { employeeId: "EMP-001", department: "Math" } },
      }),
    });
    expect(mocks.audit).toHaveBeenCalled();
  });

  it("refuses to complete details for an already-active account", async () => {
    supabaseResponds(VERIFIED);
    mocks.userFindFirst.mockResolvedValue({ id: "u12", role: "subject_teacher", status: "active" });

    await expectAppError(
      completeGoogleStaffSignup("tok", { fullName: "Juan Dela Cruz" }),
      409,
      "ALREADY_ACTIVE",
    );
  });

  it("rejects an employee ID that belongs to another staff profile", async () => {
    supabaseResponds(VERIFIED);
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.staffFindUnique.mockResolvedValue({ userId: "someone-else" });

    await expectAppError(
      completeGoogleStaffSignup("tok", { fullName: "Juan Dela Cruz", employeeId: "EMP-001" }),
      409,
      "EMPLOYEE_ID_TAKEN",
    );
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });
});
