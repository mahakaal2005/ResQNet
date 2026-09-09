/**
 * Resolving the mission an incident belongs to.
 *
 * Rudra's `incidents` table carries a `sector_id` but no `mission_id`, so an
 * incident event cannot say which mission it belongs to on its own. Without
 * this, `GET /audit-logs?mission_id=` silently omits every incident row —
 * which would make the Week-3 "audit log completeness" goal false in the one
 * query the dashboard actually runs.
 *
 * Our `sectors` table is the missing link: it maps (mission_id, sector_id).
 * `sector_id` is only unique *within* a mission ('SECTOR-A' recurs in every
 * mission), so the mapping is one-to-many across the whole table and must be
 * narrowed before it can be trusted.
 *
 * Pure so the ambiguity rule is unit-testable without a database.
 */

/** One (mission, sector) pairing, as read from the `sectors` table. */
export interface SectorScope {
  missionId: string;
  /** The owning mission's status — 'completed' missions are already excluded. */
  missionStatus?: string;
}

/**
 * Returns the mission a sector label belongs to, or `null` when the answer is
 * not certain.
 *
 * Phase 1 runs one live mission at a time (Section 27 is a single-mission demo
 * script), so a label normally resolves to exactly one live mission. When two
 * live missions both define 'SECTOR-A' the answer is genuinely unknowable from
 * the sector label alone, and a null mission_id — the row still lands in the
 * unfiltered log — is the honest outcome. Guessing would attach an incident to
 * the wrong mission's trail, which is worse than omitting it from a filter.
 */
export function resolveMissionScope(candidates: SectorScope[]): string | null {
  const missionIds = [...new Set(candidates.map((candidate) => candidate.missionId))];
  return missionIds.length === 1 ? missionIds[0] : null;
}
