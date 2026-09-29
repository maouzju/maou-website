import { $, $$ } from './util.js';

// 静态文案：中文直接写在 HTML 里，这里只放英文；带 data-i18n 的元素切换时替换 textContent
const EN = {
  description: 'maou makes games. Former lead designer of Night of the Full Moon, now running a startup in Songjiang, Shanghai.',
  intro: 'I make games. Lead designer of Night of the Full Moon (2018–2025), now building a startup in Songjiang, Shanghai.',
  bilibili: 'Bilibili',
  games: 'Games',
  moon: 'Night of the Full Moon',
  moonRole: 'Lead designer · 2018–2025',
  moonDesc: 'A roguelike card adventure set in the world of Little Red Riding Hood.',
  archive: 'Earlier work',
  kubition: 'Kubition',
  cav1: 'Card Adventurer',
  cav2: 'Card Adventurer II',
  ta: 'Underground Expedition',
  moreItch: 'More small games on itch →',
  software: 'Software',
  chillVibe: ' — a lightweight IDE for running several AI coding workspaces side by side.',
  playlist: 'Playlist Wall',
  playlistDesc: ' — lays out a NetEase Cloud Music playlist as a draggable wall.',
  posts: 'Writing (in Chinese)',
  allPosts: 'All posts →',
};

const KEY = 'lang';
const zh = new Map();
const listeners = [];

function initial() {
  const query = new URLSearchParams(location.search).get('lang');
  if (query === 'zh' || query === 'en') return query;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    // 隐私模式下 localStorage 可能不可用
  }
  return /^zh\b/i.test(navigator.language || '') ? 'zh' : 'en';
}

export let lang = initial();
export const t = (zhText, enText) => (lang === 'en' ? enText : zhText);
export const onLang = (fn) => listeners.push(fn);

function apply() {
  document.documentElement.lang = t('zh-CN', 'en');
  for (const el of $$('[data-i18n]')) {
    if (!zh.has(el)) zh.set(el, el.textContent);
    el.textContent = lang === 'en' ? EN[el.dataset.i18n] ?? zh.get(el) : zh.get(el);
  }
  const meta = $('meta[name="description"]');
  if (!zh.has(meta)) zh.set(meta, meta.content);
  meta.content = lang === 'en' ? EN.description : zh.get(meta);
  const button = $('#lang');
  button.textContent = t('EN', '中文');
  button.setAttribute('aria-label', t('Switch to English', '切换到中文'));
  listeners.forEach((fn) => fn(lang));
}

export function setLang(next) {
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // 忽略
  }
  apply();
}

$('#lang').addEventListener('click', () => setLang(lang === 'en' ? 'zh' : 'en'));
apply();
