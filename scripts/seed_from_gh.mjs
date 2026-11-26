#!/usr/bin/env node
/**
 * 토큰 없이, 이미 로그인된 `gh` CLI로 catalog.json을 만든다(로컬 시드 생성용).
 * CI에서는 sync_repos.mjs를 쓴다. 결과 파일 형식은 완전히 같다.
 *
 *   node scripts/seed_from_gh.mjs [--dry-run] [--concurrency 6] [--refresh]
 *
 * 1,300개가 넘는 저장소를 매번 다시 조회하면 느리고 API 한도도 아깝다.
 * 그래서 응답을 .cache/gh 아래에 저장해 두고, 다음 실행에서는 그대로 쓴다.
 * --refresh를 주면 캐시를 무시하고 새로 받는다(캐시는 .gitignore에 있다).
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog, assertCatalog } from './lib/catalog.mjs';

const exec = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CURATED_PATH = path.join(ROOT, 'data', 'repos.json');
const CATALOG_PATH = path.join(ROOT, 'public', 'data', 'catalog.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'gh');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const refresh = argv.includes('--refresh');
const concurrencyFlag = argv.indexOf('--concurrency');
const CONCURRENCY = concurrencyFlag >= 0 ? Number(argv[concurrencyFlag + 1]) || 6 : 6;

const cachePath = (kind, fullName) => path.join(CACHE_DIR, kind, `${fullName.replace(/\//g, '__')}.txt`);

async function cached(kind, fullName, loader) {
  const file = cachePath(kind, fullName);
  if (!refresh && existsSync(file)) {
    return readFile(file, 'utf8');
  }
  const value = await loader();
  if (value !== null && value !== undefined) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, value, 'utf8');
  }
  return value;
}

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
    const out = await cached('repo', fullName, () => gh(['api', `repos/${fullName}`]));
    return out ? JSON.parse(out) : null;
  },
  async getReadme(fullName) {
    return cached('readme', fullName, () =>
      gh(['api', `repos/${fullName}/readme`, '-H', 'Accept: application/vnd.github.raw']),
    );
  },
  async getRootNames(fullName) {
    const out = await cached('contents', fullName, () => gh(['api', `repos/${fullName}/contents`]));
    if (!out) return [];
    const items = JSON.parse(out);
    return Array.isArray(items) ? items.map((item) => item.name) : [];
  },
};

async function main() {
  const curated = JSON.parse(await readFile(CURATED_PATH, 'utf8'));
  const previousRepos = existsSync(CATALOG_PATH)
    ? (JSON.parse(await readFile(CATALOG_PATH, 'utf8')).repos ?? [])
    : [];
  const { catalog, errors } = await buildCatalog({
    curatedList: curated.repos,
    client: ghClient,
    previousRepos,
    now: new Date(),
    concurrency: CONCURRENCY,
  });

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
