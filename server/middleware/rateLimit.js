import rateLimit from "express-rate-limit";

// Runs after requireAuth, so req.user is populated — key by account rather
// than IP so it actually stops a single spamming user, not just their NAT.
export const reportsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user.username,
  message: { error: "too many reports submitted, slow down" },
});

// No user identity yet at this point, so this is IP-keyed (rate-limit's
// default) to blunt credential-stuffing / brute force attempts.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too many login attempts, try again later" },
});
