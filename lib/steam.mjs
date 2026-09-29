import { decodeEntities, getJSON, getText, pool, stripTags } from './http.mjs';

const STORE = 'https://store.steampowered.com';
const AGE_COOKIE = 'birthtime=568022401; lastagecheckage=1-0-1988; wants_mature_content=1';

function parseDate(text = '') {
  const match = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(text);
  if (!match) return null;
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

async function appDetails(appid, lang, cc) {
  const json = await getJSON(`${STORE}/api/appdetails?appids=${appid}&l=${lang}&cc=${cc}`);
  const entry = json?.[appid];
  return entry?.success ? entry.data : null;
}

function normalize(zh, en) {
  const price = zh.price_overview;
  return {
    appid: String(zh.steam_appid),
    type: zh.type,
    name: decodeEntities(zh.name),
    nameEn: en?.name && en.name !== zh.name ? decodeEntities(en.name) : null,
    short: decodeEntities(stripTags(zh.short_description || '')).trim(),
    releaseDate: zh.release_date?.date || '',
    releaseISO: parseDate(zh.release_date?.date),
    comingSoon: !!zh.release_date?.coming_soon,
    isFree: !!zh.is_free,
    price: price?.final_formatted || null,
    discount: price?.discount_percent || 0,
    genres: (zh.genres || []).map((genre) => genre.description),
    developers: zh.developers || [],
    publishers: zh.publishers || [],
    header: zh.header_image || null,
    shots: (zh.screenshots || []).slice(0, 4).map((shot) => shot.path_full),
    url: `${STORE}/app/${zh.steam_appid}`,
    fullgame: zh.fullgame ? String(zh.fullgame.appid) : null,
    demo: null,
  };
}

async function loadApp(appid) {
  const zh = await appDetails(appid, 'schinese', 'cn');
  if (!zh) return null;
  const en = await appDetails(appid, 'english', 'us').catch(() => null);
  return normalize(zh, en);
}

function byRelease(a, b) {
  if (a.comingSoon !== b.comingSoon) return a.comingSoon ? -1 : 1;
  return (b.releaseISO || '').localeCompare(a.releaseISO || '');
}

export async function fetchSteam({ developer, extraAppIds = [] }) {
  const page = await getText(`${STORE}/developer/${encodeURIComponent(developer)}?l=schinese`, {
    headers: { Cookie: AGE_COOKIE },
  });
  const appids = [...new Set([...page.matchAll(/data-ds-appid="(\d+)"/g)].map((match) => match[1]))];
  if (!appids.length) throw new Error(`Steam 开发商页面未解析到任何作品: ${developer}`);

  const loaded = (await pool(appids, 2, loadApp)).filter(Boolean);
  const games = loaded.filter((app) => app.type !== 'demo');
  for (const demo of loaded.filter((app) => app.type === 'demo')) {
    const parent = games.find((game) => game.appid === demo.fullgame);
    if (parent) parent.demo = { appid: demo.appid, url: demo.url };
    else games.push({ ...demo, demoOnly: true });
  }
  games.sort(byRelease);

  const extras = (await pool(extraAppIds, 2, (appid) => loadApp(appid).catch(() => null))).filter(Boolean);

  return {
    developer,
    profileUrl: `${STORE}/developer/${developer}`,
    items: games,
    extras,
  };
}
