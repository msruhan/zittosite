/** Case-insensitive substring match of `query` against any of `values`; an empty query matches everything. */
export function matchesSearch(
  query: string,
  values: Array<string | number | null | undefined>,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) =>
    value == null ? false : String(value).toLowerCase().includes(needle),
  );
}
