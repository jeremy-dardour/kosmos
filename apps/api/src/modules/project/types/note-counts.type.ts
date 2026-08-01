/** Note tallies per step id, produced inside the persistence seam and consumed
 * by DTO mapping — hence a home outside both. */
export type NoteCountsByStep = ReadonlyMap<string, number>;
