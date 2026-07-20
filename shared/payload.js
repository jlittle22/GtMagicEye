import { z } from 'zod';

export const SupportDetail = z.object({
  supportId: z.number().int().optional(),
  originTownId: z.number().int().optional(),
  originTownName: z.string().optional(),
  originX: z.number().int().optional(),
  originY: z.number().int().optional(),
  originPlayerId: z.number().int().optional(),
  originPlayerName: z.string().optional(),
  troops: z.record(z.string(), z.number().int().nonnegative()),
});

export const CityReport = z.object({
  cityId: z.number().int(),
  cityName: z.string().optional(),
  // e.g. "us145", parsed from the game hostname (<world>.grepolis.com).
  worldId: z.string(),
  playerId: z.number().int().optional(),
  allianceId: z.number().int().optional(),
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  // Merged native+support totals when splitNativeSupport is off; native-only when on.
  troops: z.record(z.string(), z.number().int().nonnegative()),
  // Only present when splitNativeSupport is on and the scrape succeeded.
  supportTroops: z.record(z.string(), z.number().int().nonnegative()).optional(),
  supportDetails: z.array(SupportDetail).optional(),
  observedAt: z.coerce.date(),
});

export const ReportPayload = z.object({
  scriptVersion: z.string(),
  reports: z.array(CityReport).min(1),
});
