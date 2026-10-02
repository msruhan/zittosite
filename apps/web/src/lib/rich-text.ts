/** Must match RICH_DESCRIPTION_MAX in the API. */
export const RICH_DESCRIPTION_MAX = 100_000;

/** True when a description carries markup (rich editor output or supplier HTML). */
export function isRichText(text: string): boolean {
  return /<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i.test(text);
}

/** Text-only view of a description, for table previews and search. */
export function descriptionToPlain(text: string): string {
  if (!isRichText(text)) return text;
  return text
    .replace(/<\/(p|h[1-4]|li|blockquote)>|<br\s*\/?>/gi, "$& ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Editor output with no visible content counts as empty. */
export function isBlankRichText(html: string): boolean {
  return !/<img\s/i.test(html) && descriptionToPlain(html).trim() === "";
}
