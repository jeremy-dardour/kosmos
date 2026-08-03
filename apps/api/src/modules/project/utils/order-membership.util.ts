/** True when `ids` lists every member of `memberIds` exactly once and nothing else. */
export function isExactMembership(
  ids: readonly string[],
  memberIds: readonly string[],
): boolean {
  const submitted = new Set(ids);

  return (
    submitted.size === ids.length &&
    submitted.size === memberIds.length &&
    memberIds.every((memberId) => submitted.has(memberId))
  );
}
