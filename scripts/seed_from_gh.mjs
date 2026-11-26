#!/usr/bin/env node
/**
 * 토큰 없이, 이미 로그인된 `gh` CLI로 catalog.json을 만든다(로컬 시드 생성용).
 * CI에서는 sync_repos.mjs를 쓴다. 결과 파일 형식은 완전히 같다.
 *
 *   node scripts/seed_from_gh.mjs [--dry-run]
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog, assertCatalog } from './lib/catalog.mjs';

const exec = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CURATED_PATH = path.join(ROOT, 'data', 'repos.json');
const CATALOG_PATH = path.join(ROOT, 'public', 'data', 'catalog.json');

async function gh(args) {
  try {
    const { stdout } = await exec('gh', args, { maxBuffer: 20 * 1024 * 1024 });
    return stdout;
  } catch (error) {
    const message = String(error.stderr ?? error.message ?? error);
    if (/Not Found|HTTP 404/.test(message)) return null;
    throw new Error(message.trim());
  }
}

const ghClient = {
  async getRepo(fullName) {
    const out = await gh(['api', `repos/${fullName}`]);
    return out ? JSON.parse(out) : null;
  },
  async getReadme(fullName) {
    return gh(['api', `repos/${fullName}/readme`, '-H', 'Accept: application/vnd.github.raw']);
  },
  async getRootNames(fullName) {
    const out = await gh(['api', `repos/${fullName}/contents`]);
    if (!out) return [];
    const items = JSON.parse(out);
    return Array.isArray(items) ? items.map((item) => item.name) : [];
  },
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const curated = JSON.parse(await readFile(CURATED_PATH, 'utf8'));
  const { catalog, errors } = await buildCatalog({ curatedList: curated.repos, client: ghClient, now: new Date() });

  assertCatalog(catalog);

  if (dryRun) {
    console.log(JSON.stringify(catalog, null, 2));
    return;
  }

  await mkdir(path.dirname(CATALOG_PATH), { recursive: true });
  const tmp = `${CATALOG_PATH}.tmp`;
  await writeFile(tmp, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  await rename(tmp, CATALOG_PATH);

  console.log(`✓ ${catalog.count}개 저장소 → ${path.relative(ROOT, CATALOG_PATH)}`);
  for (const error of errors) console.warn(`! ${error.repo} [${error.stage}] ${error.reason}`);
}

main().catch((error) => {
  console.error(`✗ 실패: ${error.message}`);
  process.exit(1);
});
