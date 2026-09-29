export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ENTITIES[ch]);

export function safeUrl(value) {
  try {
    const url = new URL(value, location.href);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '#';
  } catch {
    return '#';
  }
}
export const imgUrl = (value) => safeUrl(String(value ?? '').replace(/^http:\/\//i, 'https://'));

const shanghaiDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
export function fmtDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : shanghaiDate.format(date).replaceAll('-', '.');
}

export function ago(value, now = Date.now()) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '';
  const s = Math.max(0, (now - time) / 1000);
  if (s < 90) return '刚刚';
  if (s < 3600) return `${Math.round(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.round(s / 3600)} 小时前`;
  if (s < 86400 * 60) return `${Math.round(s / 86400)} 天前`;
  if (s < 86400 * 730) return `${Math.round(s / 86400 / 30)} 个月前`;
  return `${Math.round(s / 86400 / 365)} 年前`;
}

export function compact(value) {
  const n = Number(value) || 0;
  return n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, '')} 万` : String(n);
}

async function pull(url, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// 先取 /api（服务端缓存 + 实时刷新），失败回落到 /data 快照；数据偏旧时稍后再取一次
export async function loadSource(name, onData, refreshDelay = 5000) {
  let envelope;
  try {
    envelope = { ...(await pull(`api/${name}`)), origin: 'api' };
  } catch {
    envelope = { ...(await pull(`data/${name}.json`)), origin: 'snapshot' };
  }
  onData(envelope);
  if (envelope.origin === 'api' && envelope.stale) {
    setTimeout(async () => {
      try {
        const fresh = await pull(`api/${name}`);
        if (fresh.updatedAt !== envelope.updatedAt) onData({ ...fresh, origin: 'api' });
      } catch {
        // 保留已有内容
      }
    }, refreshDelay);
  }
  return envelope;
}

export function setLive(name, envelope) {
  const live = envelope.origin === 'api';
  for (const el of $$(`[data-live="${name}"]`)) {
    el.dataset.state = live ? 'live' : 'snap';
    el.textContent = live ? `实时同步 · ${ago(envelope.updatedAt)}` : `快照 · ${fmtDate(envelope.updatedAt)}`;
  }
}

export function setStat(key, value) {
  const el = $(`[data-stat="${key}"]`);
  if (el && value != null) el.textContent = String(value);
}

export function failed(name, target, href, label) {
  for (const el of $$(`[data-live="${name}"]`)) {
    el.dataset.state = 'off';
    el.textContent = '暂时离线';
  }
  if (!target) return;
  const tag = /^(OL|UL)$/.test(target.tagName) ? 'li' : 'p';
  target.innerHTML = `<${tag} class="status">暂时读不到数据。直接去 <a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)} ↗</a> 看。</${tag}>`;
}
