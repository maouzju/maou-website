import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSources } from '../lib/sources.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sources = createSources(path.join(root, 'public', 'data'));
const names = Object.keys(sources);

const results = await Promise.allSettled(names.map((name) => sources[name].refresh()));
results.forEach((result, index) => {
  console.log(result.status === 'fulfilled' ? `ok    ${names[index]}` : `FAIL  ${names[index]}: ${result.reason?.message}`);
});
process.exitCode = results.some((result) => result.status === 'rejected') ? 1 : 0;
