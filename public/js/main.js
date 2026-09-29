import { CONFIG } from './config.js';
import { onLang, t } from './i18n.js';
import { $, esc, fmtDate, imgUrl, loadSource, safeUrl } from './util.js';

const year = (g) => /\d{4}/.exec(g.releaseISO || g.releaseDate || '')?.[0] || '';

function renderSteam({ data }) {
  const rows = (data.items || []).map((g) => {
    const url = safeUrl(g.url);
    const note = g.comingSoon ? t('即将推出', 'Coming soon') : g.demoOnly ? 'Demo' : year(g);
    const short = t(g.short, g.shortEn || g.short);
    return `<li class="work" data-steam>
      <a class="work__img" href="${url}" target="_blank" rel="noopener" tabindex="-1"><img src="${imgUrl(t(g.header, g.headerEn || g.header))}" alt="" loading="lazy" referrerpolicy="no-referrer"></a>
      <div>
        <h3><a href="${url}" target="_blank" rel="noopener">${esc(t(g.name, g.nameEn || g.name))}</a> <small>${esc(note)}</small></h3>
        ${short ? `<p>${esc(short)}</p>` : ''}
      </div>
    </li>`;
  });
  document.querySelectorAll('[data-steam]').forEach((el) => el.remove());
  $('#games').insertAdjacentHTML('beforeend', rows.join(''));
}

function renderPosts({ data }) {
  $('#posts').innerHTML = (data.articles || []).slice(0, CONFIG.postsVisible).map((a) => `<li>
    <time>${esc(fmtDate(a.publishTime))}</time>
    <a href="${safeUrl(a.url)}" target="_blank" rel="noopener">${esc(String(a.title || '').trim())}</a>
  </li>`).join('');
}

let steam = null;
loadSource('steam', (envelope) => renderSteam((steam = envelope))).catch(() => {});
loadSource('bilibili', renderPosts).catch(() => {});

function renderWechat() {
  const { name } = CONFIG.wechat;
  if (name) $('#wechat').textContent = `${t('公众号', 'WeChat:')} ${name}`;
}
renderWechat();
onLang(() => {
  renderWechat();
  if (steam) renderSteam(steam);
});
$('#year').textContent = String(new Date().getFullYear());
