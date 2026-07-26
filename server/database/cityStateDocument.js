import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { SupportDetail } from '../../shared/payload.js';
import { ReportSubmitterDocument } from './reportDocument.js';

// Upserted "current state" projection for a city — one document per
// {worldId, cityId}, overwritten by whichever report comes in for it,
// however old or new. Unlike `reports` (an immutable append-only log of
// every observation), this collection exists so a query can ask "what
// does this city look like right now" without re-deriving that from the
// full history every time. History still lives only in `reports`; this is
// a read-optimized mirror of its most recent row per city, not a second
// source of truth.
//
// `x`/`y` mirror CityReport's optional shape for forward compatibility, but
// as of this writing the client never actually sends them (see
// src/index.js#indexCurrentCity) — expect them absent on every real
// document until the scraper is extended to capture them. `playerId`/
// `playerName` (Game.player_id/Game.player_name) are sent.
export const CityStateDocument = z.object({
  worldId: z.string(),
  cityId: z.number().int(),
  cityName: z.string().optional(),
  playerId: z.number().int().optional(),
  playerName: z.string().optional(),
  allianceId: z.number().int().optional(),
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  troops: z.record(z.string(), z.number().int().nonnegative()),
  supportTroops: z.record(z.string(), z.number().int().nonnegative()).optional(),
  supportDetails: z.array(SupportDetail).optional(),
  // Timestamp the underlying report was scraped (client clock) vs. when the
  // server wrote it — same distinction `reports` draws between observedAt
  // and insertedAt.
  lastObservedAt: z.date(),
  lastReportedAt: z.date(),
  // Points at the `reports` document currently backing this projection.
  // Only set when that report actually exists as its own row — a
  // dedup-suppressed (duplicate-content) update still refreshes the other
  // fields here but leaves this pointing at whichever report last actually
  // got inserted.
  lastReportId: z.instanceof(ObjectId).optional(),
  lastReportedBy: ReportSubmitterDocument,
});
