import { z } from 'zod';

// Shape of a document in the `users` collection. _id is omitted here since
// MongoDB assigns it on insert.
export const UserDocument = z.object({
  username: z.string(),
  passwordHash: z.string(),
  createdAt: z.date(),
  approvedAt: z.date().nullable().default(null),
});
