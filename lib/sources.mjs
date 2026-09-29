import { fetchBilibili } from './bilibili.mjs';
import { createSource } from './cache.mjs';
import { fetchGithub } from './github.mjs';
import { fetchItch } from './itch.mjs';
import { fetchSteam } from './steam.mjs';

export const PROFILE = {
  steamDeveloper: 'maou',
  steamExtraAppIds: ['769560'],
  itchUser: 'maougame',
  githubUser: 'maouzju',
  githubFeatured: ['chill-vibe-IDE', 'playlist-wall', 'plunger'],
  biliMid: 1791573,
};

const MINUTE = 60_000;

export function createSources(dir) {
  return {
    steam: createSource({
      name: 'steam',
      ttl: 30 * MINUTE,
      dir,
      fetcher: () => fetchSteam({ developer: PROFILE.steamDeveloper, extraAppIds: PROFILE.steamExtraAppIds }),
    }),
    bilibili: createSource({
      name: 'bilibili',
      ttl: 10 * MINUTE,
      dir,
      fetcher: () => fetchBilibili({ mid: PROFILE.biliMid }),
    }),
    github: createSource({
      name: 'github',
      ttl: 30 * MINUTE,
      dir,
      fetcher: () => fetchGithub({ user: PROFILE.githubUser, featured: PROFILE.githubFeatured }),
    }),
    itch: createSource({
      name: 'itch',
      ttl: 60 * MINUTE,
      dir,
      fetcher: () => fetchItch({ user: PROFILE.itchUser }),
    }),
  };
}
