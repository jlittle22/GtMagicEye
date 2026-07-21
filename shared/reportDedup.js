// Deterministic regardless of key insertion order, so two objects with the
// same content always produce the same string even if built differently
// (e.g. a value round-tripped through JSON vs. read fresh off the DOM).
export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

// Two reports are "the same" for dedup purposes if their troop counts and
// support breakdown are identical — ignores cityName/allianceId/timestamps,
// which can vary (or be inconsistently present) without the underlying
// troop data having actually changed. Shared between client (comparing
// against what it last submitted) and server (comparing against what's
// already stored), so both sides agree on what counts as a duplicate.
export function reportContentSignature({ troops, supportTroops, supportDetails }) {
  return stableStringify({
    troops: troops ?? {},
    supportTroops: supportTroops ?? {},
    supportDetails: supportDetails ?? [],
  });
}
