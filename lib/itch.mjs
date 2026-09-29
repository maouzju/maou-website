import { decodeEntities, getText } from './http.mjs';

function parseCells(html, user) {
  const items = [];
  for (const chunk of html.split(/<div\b[^>]*\bdata-game_id="/).slice(1)) {
    const id = /^(\d+)"/.exec(chunk)?.[1];
    const titleTag = /<a\b((?=[^>]*\bclass="[^"]*\btitle\b)[^>]*)>([^<]*)<\/a>/.exec(chunk);
    const href = titleTag && /\bhref="([^"]+)"/.exec(titleTag[1])?.[1];
    if (!id || !href) continue;
    const link = [null, href, titleTag[2]];
    const author = /class="game_author"><a[^>]*>([^<]*)<\/a>/.exec(chunk)?.[1];
    if (author && author.trim().toLowerCase() !== user.toLowerCase()) continue;
    const thumb = /data-lazy_src="([^"]+)"/.exec(chunk)?.[1];
    items.push({
      id,
      url: decodeEntities(link[1]),
      title: decodeEntities(link[2]).trim(),
      thumb: thumb ? decodeEntities(thumb) : null,
      genre: decodeEntities(/<div class="game_genre">([^<]*)</.exec(chunk)?.[1] || '').trim(),
      web: /web_flag/.test(chunk),
    });
  }
  return items;
}

export async function fetchItch({ user, maxPages = 5 }) {
  const seen = new Map();
  for (let page = 1; page <= maxPages; page++) {
    const html = await getText(`https://${user}.itch.io/${page > 1 ? `?page=${page}` : ''}`);
    const fresh = parseCells(html, user).filter((item) => !seen.has(item.id));
    if (!fresh.length) break;
    for (const item of fresh) seen.set(item.id, item);
  }
  if (!seen.size) throw new Error(`itch 页面未解析到任何作品: ${user}`);
  const items = [...seen.values()];
  return { user, profileUrl: `https://${user}.itch.io`, total: items.length, items };
}
