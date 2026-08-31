import { z } from 'zod';

// Shape of a document in the `users` collection. _id is omitted here since
// MongoDB assigns it on insert.
export const UserDocument = z.object({
  username: z.string(),
  passwordHash: z.string(),
  createdAt: z.date(),
  approvedAt: z.date().nullable().default(null),
  lastLoggedInAt: z.date().nullable().default(null),
  lastReportedAt: z.date().nullable().default(null),
  // When the user accepted the privacy policy. Not set by registerUser yet
  // (no route collects consent), so this defaults to null on every insert
  // until that flow exists.
  consentedAt: z.date().nullable().default(null),
  // Set manually (no admin route for this yet) to ban an account.
  bannedSince: z.date().nullable().default(null),
});
