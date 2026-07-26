import { z } from 'zod';

// Upserted "current state" projection for a Grepolis player — one document
// per {worldId, playerId} (Game.player_id — stable even if the player
// renames), overwritten by whichever report naming them comes in.
//
// submittedById links back to the `users` account that reported this
// player's city, when there is one — a player observed only via
// supportDetails.originPlayerId (someone supporting one of your cities, not
// a user of this tool) would have no submittedById at all. Right now every
// document here in fact comes from reports' own playerId (i.e. represents
// the reporting account itself), since that's the only source wired up —
// supportDetails observations aren't ingested into this collection yet.
export const PlayerDocument = z.object({
  worldId: z.string(),
  playerId: z.number().int(),
  playerName: z.string().optional(),
  submittedById: z.string().optional(),
  // Snapshot, refreshed on every report — not a live reference to `users`,
  // same tradeoff ReportSubmitterDocument makes and for the same reason
  // (a JWT-derived value, not something worth a live join for).
  username: z.string().optional(),
  currentAllianceId: z.number().int().optional(),
  lastCityId: z.number().int().optional(),
  lastCityName: z.string().optional(),
  lastReportedAt: z.date(),
});
