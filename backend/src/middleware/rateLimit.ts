import rateLimit from "express-rate-limit";

// Brute-force guard for the auth surface (login / register / refresh).
// Counts per IP: 60 attempts per 15 minutes is generous for real users
// (failed logins are rare) but stops credential-stuffing floods. Draft/PATCH
// and data routes are authenticated + cheap and stay unlimited.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many attempts — try again in a few minutes.",
    },
  },
});
