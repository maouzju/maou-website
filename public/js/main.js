import { CONFIG } from './config.js';
import { $, esc, fmtDate, imgUrl, loadSource, safeUrl } from './util.js';

const year = (g) => /\d{4}/.exec(g.releaseISO || g.releaseDate || '')?.[0] || '';

function renderSteam({ data }) {
  const rows = (data.items || []).map((g) => {
    const url = safeUrl(g.url);
    const note = g.comingSoon ? '即将推出' : g.demoOnly ? 'Demo' : year(g);
    return `<li class="work" data-steam>
      <a class="work__img" href="${url}" target="_blank" rel="noopener" tabindex="-1"><img src="${imgUrl(g.header)}" alt="" loading="lazy" referrerpolicy="no-referrer"></a>
      <div>
        <h3><a href="${url}" target="_blank" rel="noopener">${esc(g.name)}</a> <small>${esc(note)}</small></h3>
        ${g.short ? `<p>${esc(g.short)}</p>` : ''}
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

loadSource('steam', renderSteam).catch(() => {});
loadSource('bilibili', renderPosts).catch(() => {});

const { name } = CONFIG.wechat;
if (name) $('#wechat').textContent = `公众号 ${name}`;
$('#year').textContent = String(new Date().getFullYear());
