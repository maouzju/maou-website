import { decodeEntities, getJSON, getText, pool, request } from './http.mjs';

function apiHeaders() {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function viaApi(user) {
  const list = await getJSON(`https://api.github.com/users/${user}/repos?per_page=100&sort=pushed`, {
    headers: apiHeaders(),
    retries: 0,
  });
  return list
    .filter((repo) => !repo.fork)
    .map((repo) => ({
      name: repo.name,
      description: repo.description || '',
      stars: repo.stargazers_count,
      language: repo.language || null,
      pushedAt: repo.pushed_at,
      url: repo.html_url,
    }));
}

// API 被限流时的回落：直接解析仓库页面
async function viaHtml(user, names) {
  return pool(names, 3, async (name) => {
    const html = await getText(`https://github.com/${user}/${name}`);
    const og = /<meta property="og:description" content="([^"]*)"/.exec(html)?.[1] || '';
    let description = decodeEntities(og).replace(new RegExp(`\\s+-\\s+${user}/${name}\\s*$`, 'i'), '');
    if (/^Contribute to /i.test(description)) description = '';
    const stars = /id="repo-stars-counter-star"[^>]*title="([\d,]+)"/.exec(html)?.[1];
    return {
      name,
      description,
      stars: stars ? Number(stars.replace(/,/g, '')) : 0,
      language: null,
      pushedAt: null,
      url: `https://github.com/${user}/${name}`,
    };
  });
}

async function latestRelease(user, name) {
  const res = await request(`https://github.com/${user}/${name}/releases/latest`, { redirect: 'manual', retries: 0 });
  const tag = /\/releases\/tag\/([^/?#]+)/.exec(res.headers.get('location') || '')?.[1];
  if (!tag) return null;
  return { version: decodeURIComponent(tag), releaseUrl: `https://github.com/${user}/${name}/releases/tag/${tag}` };
}

export async function fetchGithub({ user, featured }) {
  let repos;
  let source = 'api';
  try {
    repos = await viaApi(user);
  } catch {
    source = 'html';
    repos = await viaHtml(user, featured);
  }
  await pool(
    repos.filter((repo) => featured.includes(repo.name)),
    3,
    async (repo) => Object.assign(repo, await latestRelease(user, repo.name).catch(() => null)),
  );
  return { user, profileUrl: `https://github.com/${user}`, source, repos };
}
