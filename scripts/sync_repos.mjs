#!/usr/bin/env node
/**
 * data/repos.json → public/data/catalog.json
 *
 * GitHub Actions에서 매일 한 번 실행된다.
 *   GITHUB_TOKEN=<token> node scripts/sync_repos.mjs
 *
 * 한 저장소 조회가 실패해도 나머지는 갱신하고, 실패한 저장소는 직전 값을 유지한다.
 * 전부 실패하면 기존 파일을 덮어쓰지 않고 종료 코드 1로 끝난다.
 */
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog, assertCatalog } from './lib/catalog.mjs';
import { createGithubClient } from './lib/github.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CURATED_PATH = path.join(ROOT, 'data', 'repos.json');
const CATALOG_PATH = path.join(ROOT, 'public', 'data', 'catalog.json');

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function main() {
  const curated = await readJson(CURATED_PATH);
  if (!Array.isArray(curated.repos) || curated.repos.length === 0) {
    throw new Error('data/repos.json에 repos 배열이 비어 있습니다.');
  }

  let previousRepos = [];
  if (existsSync(CATALOG_PATH)) {
    try {
      previousRepos = (await readJson(CATALOG_PATH)).repos ?? [];
    } catch {
      previousRepos = [];
    }
  }

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  if (!token) {
    console.warn('! GITHUB_TOKEN이 없습니다. 인증 없이 진행합니다(시간당 60회 한도).');
  }

  const client = createGithubClient({ token });
  const { catalog, errors } = await buildCatalog({
    curatedList: curated.repos,
    previousRepos,
    client,
    now: new Date(),
    // Actions 러너에서 1,300여 개 저장소를 3회씩 순차 조회하면 오래 걸린다. 조금만 병렬로.
    concurrency: 4,
  });

  assertCatalog(catalog);

  await mkdir(path.dirname(CATALOG_PATH), { recursive: true });
  const tmp = `${CATALOG_PATH}.tmp`;
  await writeFile(tmp, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  await rename(tmp, CATALOG_PATH); // 검증을 통과한 뒤에만 교체

  const korean = catalog.repos.filter((r) => r.koreanDocs).length;
  const docker = catalog.repos.filter((r) => r.docker).length;
  const recent = catalog.repos.filter((r) => r.recent).length;
  console.log(
    `✓ ${catalog.count}개 저장소 동기화 (한국어 문서 ${korean} · Docker ${docker} · 최근 ${recent})`,
  );

  if (errors.length > 0) {
    console.warn(`! ${errors.length}건 경고`);
    for (const error of errors) {
      console.warn(`  - ${error.repo} [${error.stage}] ${error.reason}`);
    }
    // 직전 값 유지로 처리했으므로 워크플로 요약에만 남기고 성공으로 끝낸다.
    if (process.env.GITHUB_STEP_SUMMARY) {
      const lines = errors.map((e) => `- \`${e.repo}\` (${e.stage}): ${e.reason}`);
      await writeFile(
        process.env.GITHUB_STEP_SUMMARY,
        `\n### 동기화 경고 ${errors.length}건 (직전 값 유지)\n${lines.join('\n')}\n`,
        { flag: 'a' },
      );
    }
  }
}

main().catch((error) => {
  console.error(`✗ 동기화 실패: ${error.message}`);
  process.exit(1);
});
