import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCatalog,
  buildCatalog,
  buildEntry,
  buildStaleEntry,
  countHangul,
  detectDocker,
  detectKoreanDocs,
  hasKoreanReadmeFile,
  isCommercialLicense,
  isRecent,
  monthsAgo,
} from '../lib/catalog.mjs';

const curated = {
  repo: 'toss/es-toolkit',
  vendor: '토스',
  category: 'frontend',
  summary: 'lodash 대체 유틸리티',
  tags: ['TypeScript'],
};

const now = new Date('2026-11-26T00:00:00Z');

const repoJson = {
  name: 'es-toolkit',
  owner: { login: 'toss' },
  description: 'A modern JavaScript utility library',
  stargazers_count: 11399,
  forks_count: 320,
  open_issues_count: 68,
  language: 'TypeScript',
  license: { spdx_id: 'MIT', name: 'MIT License' },
  homepage: 'https://es-toolkit.dev',
  pushed_at: '2026-11-14T10:26:04Z',
  updated_at: '2026-11-20T00:00:00Z',
  created_at: '2024-03-01T00:00:00Z',
  archived: false,
  default_branch: 'main',
  topics: ['typescript', 'lodash'],
};

test('isCommercialLicense: 허용 목록만 true', () => {
  assert.equal(isCommercialLicense('MIT'), true);
  assert.equal(isCommercialLicense('Apache-2.0'), true);
  assert.equal(isCommercialLicense('BSD-3-Clause'), true);
  assert.equal(isCommercialLicense('GPL-3.0'), false);
  assert.equal(isCommercialLicense('AGPL-3.0'), false);
  assert.equal(isCommercialLicense('NOASSERTION'), false);
  assert.equal(isCommercialLicense(null), false);
  assert.equal(isCommercialLicense(undefined), false);
});

test('isCommercialLicense: OFL-1.1 폰트 라이선스는 상업 무료', () => {
  // Pretendard·D2 Coding처럼 앱·웹에 임베드해 배포해도 되는 글꼴 라이선스
  assert.equal(isCommercialLicense('OFL-1.1'), true);
  assert.equal(isCommercialLicense('CC-BY-4.0'), false);
  assert.equal(isCommercialLicense('CC-BY-SA-4.0'), false);
});

test('buildEntry: GitHub이 라이선스를 못 읽으면 직접 확인한 OFL-1.1을 쓴다', () => {
  const entry = buildEntry({
    curated: { ...curated, repo: 'orioncactus/pretendard', category: 'frontend', license: 'OFL-1.1' },
    repo: { ...repoJson, name: 'pretendard', license: { spdx_id: 'NOASSERTION', name: 'Other' } },
    readmeText: null,
    rootNames: ['LICENSE'],
    now,
  });

  assert.equal(entry.license, 'OFL-1.1');
  assert.equal(entry.licenseSource, 'curated');
  assert.equal(entry.commercialUse, true);
});

test('buildEntry: 라이선스 출처를 github·none으로 남긴다', () => {
  const fromApi = buildEntry({ curated, repo: repoJson, readmeText: '', rootNames: [], now });
  assert.equal(fromApi.licenseSource, 'github');

  const none = buildEntry({ curated, repo: { ...repoJson, license: null }, readmeText: '', rootNames: [], now });
  assert.equal(none.license, null);
  assert.equal(none.licenseSource, 'none');
  assert.equal(none.commercialUse, false);
});

test('countHangul: 한글 글자만 센다', () => {
  assert.equal(countHangul('카카오 한글 Analyzer'), 5);
  assert.equal(countHangul('no korean here'), 0);
  assert.equal(countHangul(''), 0);
  assert.equal(countHangul(null), 0);
});

test('hasKoreanReadmeFile: 한국어 README 파일 이름 변형', () => {
  assert.equal(hasKoreanReadmeFile(['README.md', 'README-ko_kr.md']), true);
  assert.equal(hasKoreanReadmeFile(['README.ko.md']), true);
  assert.equal(hasKoreanReadmeFile(['readme_kr.md']), true);
  assert.equal(hasKoreanReadmeFile(['README.md', 'README-ja_jp.md']), false);
  assert.equal(hasKoreanReadmeFile([]), false);
});

test('detectKoreanDocs: 큐레이션 값 > 파일 > 본문 한글 수', () => {
  assert.deepEqual(detectKoreanDocs({ curated: false, readmeText: '한'.repeat(500) }), {
    value: false,
    source: 'curated',
  });
  assert.deepEqual(detectKoreanDocs({ curated: undefined, rootNames: ['README.ko.md'] }), {
    value: true,
    source: 'readme',
  });
  assert.deepEqual(detectKoreanDocs({ curated: undefined, readmeText: '한'.repeat(120) }), {
    value: true,
    source: 'readme',
  });
  assert.deepEqual(detectKoreanDocs({ curated: undefined, readmeText: '한'.repeat(99) }), {
    value: false,
    source: 'readme',
  });
  // 영어 README 기여자 이름에 한글이 몇 자 섞인 경우는 한국어 문서로 보지 않는다
  assert.equal(detectKoreanDocs({ readmeText: 'Thanks 김철수' }).value, false);
});

test('detectDocker: 큐레이션 > 루트 Dockerfile > topics', () => {
  assert.deepEqual(detectDocker({ curated: true }), { value: true, source: 'curated' });
  assert.deepEqual(detectDocker({ rootNames: ['Dockerfile', 'package.json'] }), {
    value: true,
    source: 'detected',
  });
  assert.deepEqual(detectDocker({ topics: ['docker', 'nlp'] }), { value: true, source: 'detected' });
  assert.deepEqual(detectDocker({ rootNames: ['package.json'], topics: ['react'] }), {
    value: false,
    source: 'none',
  });
});

test('monthsAgo: 말일 보정', () => {
  assert.equal(monthsAgo(new Date('2026-05-31T00:00:00Z'), 3).toISOString().slice(0, 10), '2026-02-28');
  assert.equal(monthsAgo(new Date('2026-11-26T00:00:00Z'), 3).toISOString().slice(0, 10), '2026-08-26');
  assert.equal(monthsAgo(new Date('2026-01-15T00:00:00Z'), 3).toISOString().slice(0, 10), '2025-10-15');
});

test('isRecent: 90일 경계', () => {
  assert.equal(isRecent('2026-08-26T00:00:00Z', now), true);
  assert.equal(isRecent('2026-08-25T23:59:59Z', now), false);
  assert.equal(isRecent(null, now), false);
  assert.equal(isRecent('이상한 값', now), false);
});

test('buildEntry: 실제 API 응답을 카탈로그 항목으로', () => {
  const entry = buildEntry({
    curated,
    repo: repoJson,
    readmeText: '한국어 문서입니다 '.repeat(20),
    rootNames: ['README.md', 'README-ko_kr.md'],
    now,
  });

  assert.equal(entry.repo, 'toss/es-toolkit');
  assert.equal(entry.name, 'es-toolkit');
  assert.equal(entry.owner, 'toss');
  assert.equal(entry.stars, 11399);
  assert.equal(entry.license, 'MIT');
  assert.equal(entry.commercialUse, true);
  assert.equal(entry.koreanDocs, true);
  assert.equal(entry.koreanDocsSource, 'readme');
  assert.equal(entry.docker, false);
  assert.equal(entry.recent, true);
  assert.equal(entry.archived, false);
  assert.equal(entry.url, 'https://github.com/toss/es-toolkit');
  assert.equal(entry.stale, false);
});

test('buildEntry: 라이선스 없음·보관됨·오래된 푸시', () => {
  const entry = buildEntry({
    curated: { ...curated, repo: 'someone/old-tool', docker: true },
    repo: { ...repoJson, license: null, archived: true, pushed_at: '2022-03-23T05:55:06Z', homepage: '  ' },
    readmeText: 'english only',
    rootNames: ['Dockerfile'],
    now,
  });

  assert.equal(entry.license, null);
  assert.equal(entry.commercialUse, false);
  assert.equal(entry.docker, true);
  assert.equal(entry.dockerSource, 'curated');
  assert.equal(entry.archived, true);
  assert.equal(entry.recent, false);
  assert.equal(entry.homepage, null);
});

test('buildStaleEntry: 조회 실패해도 큐레이션 정보는 남는다', () => {
  const entry = buildStaleEntry(curated, now);
  assert.equal(entry.stars, null);
  assert.equal(entry.stale, true);
  assert.equal(entry.summary, curated.summary);
  assert.equal(entry.category, 'frontend');
  assert.equal(entry.license, null);
  assert.equal(entry.licenseSource, 'none');
});

test('buildStaleEntry: 직접 확인한 라이선스는 실패해도 유지된다', () => {
  const entry = buildStaleEntry({ ...curated, license: 'OFL-1.1' }, now);
  assert.equal(entry.license, 'OFL-1.1');
  assert.equal(entry.licenseSource, 'curated');
  assert.equal(entry.commercialUse, true);
});

function fakeClient(responses) {
  return {
    async getRepo(fullName) {
      const value = responses[fullName];
      if (value instanceof Error) throw value;
      return value ?? null;
    },
    async getReadme() {
      return 'english readme';
    },
    async getRootNames() {
      return ['README.md'];
    },
  };
}

test('buildCatalog: 성공 항목을 모두 담는다', async () => {
  const { catalog, errors } = await buildCatalog({
    curatedList: [curated, { ...curated, repo: 'naver/billboard.js', category: 'frontend' }],
    client: fakeClient({
      'toss/es-toolkit': repoJson,
      'naver/billboard.js': { ...repoJson, name: 'billboard.js', stargazers_count: 6026 },
    }),
    now,
  });

  assert.equal(catalog.count, 2);
  assert.equal(errors.length, 0);
  assert.equal(catalog.recentSince, '2026-08-26T00:00:00.000Z');
  assert.equal(catalog.generatedAt, now.toISOString());
  assert.equal(assertCatalog(catalog), true);
});

test('buildCatalog: 일부 실패하면 직전 카탈로그 값을 유지하고 나머지는 갱신', async () => {
  const previous = [
    { ...buildStaleEntry({ ...curated, repo: 'prev/repo' }, now), stars: 10000, stale: false },
  ];
  const { catalog, errors } = await buildCatalog({
    curatedList: [curated, { ...curated, repo: 'prev/repo' }, { ...curated, repo: 'gone/repo' }],
    client: fakeClient({
      'toss/es-toolkit': repoJson,
      'prev/repo': new Error('GitHub 502'),
      'gone/repo': null,
    }),
    previousRepos: previous,
    now,
  });

  assert.equal(catalog.count, 3);
  assert.equal(errors.length, 2);
  assert.equal(catalog.repos[0].stars, 11399); // 새로 갱신
  assert.equal(catalog.repos[1].stars, 10000); // 직전 값 유지
  assert.equal(catalog.repos[1].stale, false);
  assert.equal(catalog.repos[2].stale, true); // 직전 값도 없으면 최소 항목
});

test('buildCatalog: 전부 실패하면 던진다(기존 파일 보호)', async () => {
  await assert.rejects(
    () =>
      buildCatalog({
        curatedList: [curated],
        client: fakeClient({ 'toss/es-toolkit': new Error('rate limit') }),
        now,
      }),
    /모든 저장소 조회에 실패/,
  );
});

test('buildCatalog: README 실패는 치명적이지 않다', async () => {
  const client = {
    async getRepo() {
      return repoJson;
    },
    async getReadme() {
      throw new Error('readme timeout');
    },
    async getRootNames() {
      throw new Error('contents timeout');
    },
  };
  const { catalog, errors } = await buildCatalog({ curatedList: [curated], client, now });
  assert.equal(catalog.count, 1);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].stage, 'readme');
  assert.equal(catalog.repos[0].stars, 11399);
});

test('assertCatalog: 깨진 데이터는 거부한다', () => {
  const good = {
    generatedAt: now.toISOString(),
    repos: [
      {
        repo: 'toss/es-toolkit',
        summary: '요약',
        stars: 1,
        category: 'frontend',
        koreanDocs: false,
        docker: false,
        commercialUse: true,
      },
    ],
  };
  assert.equal(assertCatalog(good), true);

  assert.throws(() => assertCatalog({ generatedAt: now.toISOString(), repos: [] }), /비어 있습니다/);
  assert.throws(
    () => assertCatalog({ generatedAt: now.toISOString(), repos: [{ ...good.repos[0], category: 'nope' }] }),
    /알 수 없는 카테고리/,
  );
  assert.throws(
    () => assertCatalog({ generatedAt: now.toISOString(), repos: [{ ...good.repos[0], stars: '1' }] }),
    /stars 형식/,
  );
  assert.throws(() => assertCatalog({ repos: good.repos }), /generatedAt/);
});
