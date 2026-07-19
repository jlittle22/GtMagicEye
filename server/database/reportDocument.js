import { z } from 'zod';
import { SupportDetail } from '../../shared/payload.js';

// Snapshot of the submitting user, embedded as-is from the JWT payload
// (req.user in requireAuth) — not a live reference. _id stays a string since
// BSON ObjectIds don't survive a JWT round trip; the date fields arrive as
// ISO strings for the same reason but get coerced back to real Dates here.
export const ReportSubmitterDocument = z.object({
  _id: z.string(),
  username: z.string(),
  approvedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

// Shape of a document in the `reports` collection. Each document is one
// CityReport flattened out of a batch ReportPayload — scriptVersion is
// carried down from the parent payload, observedAt is when the client
// scraped it, insertedAt is when the server stored it. _id is omitted here
// since MongoDB assigns it on insert.
export const ReportDocument = z.object({
  scriptVersion: z.string(),
  cityId: z.number().int(),
  cityName: z.string().optional(),
  playerId: z.number().int().optional(),
  allianceId: z.number().int().optional(),
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  troops: z.record(z.string(), z.number().int().nonnegative()),
  supportTroops: z.record(z.string(), z.number().int().nonnegative()).optional(),
  supportDetails: z.array(SupportDetail).optional(),
  observedAt: z.date(),
  insertedAt: z.date(),
  submittedBy: ReportSubmitterDocument,
});
