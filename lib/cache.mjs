import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

// stale-while-revalidate：有数据就立刻返回，过期则后台刷新；冷启动优先读磁盘快照。
export function createSource({ name, ttl, fetcher, dir }) {
  const file = path.join(dir, `${name}.json`);
  let memory = null;
  let inflight = null;

  async function loadDisk() {
    try {
      const saved = JSON.parse(await readFile(file, 'utf8'));
      return { data: saved.data, updatedAt: Date.parse(saved.updatedAt) };
    } catch {
      return null;
    }
  }

  async function saveDisk(record) {
    await mkdir(dir, { recursive: true });
    const tmp = `${file}.tmp`;
    const body = JSON.stringify({ updatedAt: new Date(record.updatedAt).toISOString(), data: record.data }, null, 2);
    await writeFile(tmp, body);
    await rename(tmp, file);
  }

  function refresh() {
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const data = await fetcher();
        memory = { data, updatedAt: Date.now() };
        await saveDisk(memory).catch(() => {});
      } catch (error) {
        console.warn(`[${name}] 刷新失败: ${error.message}`);
        throw error;
      } finally {
        inflight = null;
      }
    })();
    inflight.catch(() => {});
    return inflight;
  }

  function envelope() {
    return {
      name,
      updatedAt: new Date(memory.updatedAt).toISOString(),
      stale: Date.now() - memory.updatedAt >= ttl,
      data: memory.data,
    };
  }

  async function get() {
    if (!memory) memory = await loadDisk();
    if (!memory) {
      await refresh();
    } else if (Date.now() - memory.updatedAt >= ttl) {
      refresh().catch(() => {});
    }
    return envelope();
  }

  return { name, get, refresh };
}
