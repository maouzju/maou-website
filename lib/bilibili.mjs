import crypto from 'node:crypto';
import { getJSON, httpsUrl } from './http.mjs';

const API = 'https://api.bilibili.com';
const MIXIN_TABLE = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38,
  41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
  20, 34, 44, 52,
];

let session = null;

async function getSession() {
  if (session && Date.now() - session.at < 30 * 60_000) return session;
  const base = { Referer: 'https://www.bilibili.com/' };
  const spi = await getJSON(`${API}/x/frontend/finger/spi`, { headers: base });
  const cookie = `buvid3=${spi.data?.b_3 ?? ''}; buvid4=${spi.data?.b_4 ?? ''}`;
  const nav = await getJSON(`${API}/x/web-interface/nav`, { headers: { ...base, Cookie: cookie } });
  const keyOf = (url) => url.slice(url.lastIndexOf('/') + 1, url.lastIndexOf('.'));
  const raw = keyOf(nav.data.wbi_img.img_url) + keyOf(nav.data.wbi_img.sub_url);
  const mixin = MIXIN_TABLE.map((index) => raw[index]).join('').slice(0, 32);
  session = { cookie, mixin, at: Date.now() };
  return session;
}

function signQuery(params, mixin) {
  const signed = { ...params, wts: Math.floor(Date.now() / 1000) };
  const query = Object.keys(signed)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(signed[key]).replace(/[!'()*]/g, ''))}`)
    .join('&');
  return `${query}&w_rid=${crypto.createHash('md5').update(query + mixin).digest('hex')}`;
}

export async function fetchBilibili({ mid, pageSize = 12 }) {
  const headers = (cookie) => ({
    Referer: `https://space.bilibili.com/${mid}/article`,
    Origin: 'https://space.bilibili.com',
    ...(cookie ? { Cookie: cookie } : {}),
  });

  async function signedCall(path, params, canRetry = true) {
    const { cookie, mixin } = await getSession();
    const json = await getJSON(`${API}${path}?${signQuery(params, mixin)}`, { headers: headers(cookie) });
    if (json.code !== 0) {
      if (canRetry) {
        session = null;
        return signedCall(path, params, false);
      }
      throw new Error(`bilibili ${path} code=${json.code} ${json.message}`);
    }
    return json.data;
  }

  const query = { mid, pn: 1, ps: pageSize, sort: 'publish_time' };
  let data;
  try {
    data = await signedCall('/x/space/wbi/article', { ...query, web_location: 333.999 });
  } catch {
    const legacy = await getJSON(`${API}/x/space/article?${new URLSearchParams(query)}`, { headers: headers() });
    if (legacy.code !== 0) throw new Error(`bilibili 专栏接口不可用 code=${legacy.code}`);
    data = legacy.data;
  }

  const card = await getJSON(`${API}/x/web-interface/card?mid=${mid}`, { headers: headers() }).catch(() => null);
  const profile = card?.data?.card;

  const articles = (data.articles || []).map((item) => ({
    id: item.id,
    title: item.title,
    summary: (item.summary || '').trim(),
    category: item.category?.name || null,
    publishTime: new Date((item.publish_time || item.ctime) * 1000).toISOString(),
    views: item.stats?.view ?? null,
    likes: item.stats?.like ?? null,
    replies: item.stats?.reply ?? null,
    cover: httpsUrl(item.image_urls?.[0] || item.banner_url || null),
    url: `https://www.bilibili.com/read/cv${item.id}`,
  }));

  return {
    mid,
    profileUrl: `https://space.bilibili.com/${mid}`,
    articlesUrl: `https://space.bilibili.com/${mid}/article`,
    name: profile?.name || null,
    face: httpsUrl(profile?.face || null),
    fans: profile?.fans ?? null,
    total: data.count ?? articles.length,
    articles,
  };
}
