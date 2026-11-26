import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/**
 * 실제 수록 데이터(public/data/catalog.json)의 약속을 지키는지 확인한다.
 * 별표·커뮤니티에서 모은 항목이 빠지거나, 라이선스 판정이 흔들리거나,
 * 한 줄 소개가 비는 일을 배포 전에 잡는다.
 */
const root = new URL('../../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('public/data/catalog.json', root), 'utf8'));
const curated = JSON.parse(await readFile(new URL('data/repos.json', root), 'utf8'));

const COMMERCIAL = new Set([
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'MPL-2.0',
  'CC0-1.0',
  'Unlicense',
  '0BSD',
  'OFL-1.1',
]);
const CATEGORIES = new Set(['frontend', 'ai', 'backend', 'tool', 'learn']);

test('카탈로그: 1,300개 이상, 중복 없음', () => {
  assert.ok(catalog.count >= 1300, `수록 ${catalog.count}개`);
  assert.equal(catalog.count, catalog.repos.length);
  const keys = catalog.repos.map((repo) => repo.repo.toLowerCase());
  assert.equal(new Set(keys).size, keys.length);
});

test('카탈로그: 모든 항목이 상업 무료 라이선스이고, 새로 넣은 항목은 보관 상태가 아니다', () => {
  const bad = catalog.repos.filter((repo) => !COMMERCIAL.has(repo.license));
  assert.deepEqual(bad.map((repo) => repo.repo), []);
  // 처음부터 큐레이션해 둔 항목 중에는 보관된 저장소도 있다(카드에 '보관됨' 배지로 표시).
  assert.ok(catalog.repos.filter((repo) => repo.archived).length <= 5);
  const added = new Set(
    curated.repos.filter((repo) => repo.addedVia).map((repo) => repo.repo.toLowerCase()),
  );
  const archivedAdded = catalog.repos.filter((repo) => added.has(repo.repo.toLowerCase()) && repo.archived);
  assert.deepEqual(archivedAdded.map((repo) => repo.repo), []);
});

test('카탈로그: 모든 항목에 한국어 한 줄 소개·분류·태그가 있다', () => {
  for (const repo of catalog.repos) {
    assert.ok(repo.summary && repo.summary.length >= 8, `${repo.repo} 소개 없음`);
    assert.match(repo.summary, /[가-힣]/, `${repo.repo} 한국어 아님`);
    assert.ok(CATEGORIES.has(repo.category), `${repo.repo} 분류 ${repo.category}`);
    assert.ok(Array.isArray(repo.tags), `${repo.repo} 태그`);
    assert.ok(typeof repo.koreanDocs === 'boolean', `${repo.repo} koreanDocs`);
    assert.ok(typeof repo.docker === 'boolean', `${repo.repo} docker`);
    assert.ok(repo.url === `https://github.com/${repo.repo}`, `${repo.repo} url`);
  }
});

test('카탈로그: 별표 719개와 커뮤니티 수집분이 모두 실려 있다', () => {
  const via = (name) => curated.repos.filter((repo) => repo.addedVia === name).length;
  assert.equal(via('starred'), 719);
  assert.ok(via('show_hn') + via('lobsters') >= 300, `커뮤니티 ${via('show_hn') + via('lobsters')}개`);
  const inCatalog = new Set(catalog.repos.map((repo) => repo.repo.toLowerCase()));
  const missing = curated.repos.filter((repo) => !inCatalog.has(repo.repo.toLowerCase()));
  assert.deepEqual(missing.map((repo) => repo.repo), []);
});

test('카탈로그: 수록 현황 집계가 실제와 맞는다', () => {
  const korean = catalog.repos.filter((repo) => repo.koreanDocs).length;
  const docker = catalog.repos.filter((repo) => repo.docker).length;
  const recent = catalog.repos.filter((repo) => repo.recent).length;
  assert.ok(korean > 60, `한국어 문서 ${korean}`);
  assert.ok(docker > 150, `Docker ${docker}`);
  assert.ok(recent > 700, `최근 3개월 ${recent}`);
  assert.ok(Date.parse(catalog.generatedAt) > 0);
});
