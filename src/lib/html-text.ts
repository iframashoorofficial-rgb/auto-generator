/**
 * Crude but dependency-free readable-text extraction.
 *
 * Lifted out of the research route so trend scraping can use the same code.
 * Deliberately not a parser: these pages are read to be summarised by a model,
 * which tolerates ragged input far better than it tolerates a new dependency.
 */

const MAX_CHARS = 14000;

export function extractText(html: string, maxChars = MAX_CHARS): { text: string; title: string } {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? "";

  const meta: string[] = [];
  const metaRe =
    /<meta[^>]+(?:name|property)=["'](description|og:description|og:site_name|og:title)["'][^>]+content=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRe.exec(html))) meta.push(`${m[1]}: ${m[2]}`);

  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();

  return { text: [title, ...meta, body].join("\n").slice(0, maxChars), title };
}
