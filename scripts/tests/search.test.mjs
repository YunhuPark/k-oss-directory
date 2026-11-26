import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SYNONYM_GROUPS,
  SYNONYM_WEIGHT,
  expandTokens,
  matchesQuery,
  scoreRepo,
  searchRepos,
  selectRepos,
  synonymsOf,
} from '../../public/lib/filter.mjs';

/** 실제 카탈로그와 같은 모양의 작은 표본 */
const base = {
  repo: 'example/base',
  name: 'base',
  owner: 'example',
  vendor: 'Example',
  category: 'tool',
  summary: '기본 항목',
  description: '',
  tags: [],
  topics: [],
  language: null,
  stars: 10,
  koreanDocs: false,
  commercialUse: true,
  docker: false,
  recent: true,
  pushedAt: '2026-11-01T00:00:00Z',
};

const storybook = {
  ...base,
  repo: 'storybookjs/storybook',
  name: 'storybook',
  vendor: 'Storybook',
  category: 'frontend',
  summary: 'UI 컴포넌트를 문서로 정리하고 화면을 눈으로 확인하는 작업장',
  description: 'Storybook is a frontend workshop for building UI components',
  tags: ['UI', '컴포넌트', '문서화'],
  topics: ['components', 'design-system'],
  language: 'TypeScript',
  stars: 85000,
  koreanDocs: false,
};

const tailwind = {
  ...base,
  repo: 'tailwindlabs/tailwindcss',
  name: 'tailwindcss',
  vendor: 'Tailwind Labs',
  category: 'frontend',
  summary: '유틸리티 클래스로 화면을 빠르게 꾸미는 CSS 프레임워크',
  description: 'A utility-first CSS framework',
  tags: ['CSS', '스타일'],
  topics: ['css', 'design'],
  language: 'CSS',
  stars: 88000,
};

const khaiii = {
  ...base,
  repo: 'kakao/khaiii',
  name: 'khaiii',
  vendor: '카카오',
  category: 'ai',
  summary: '한글 문장을 형태소로 나눠 주는 분석기',
  description: 'Kakao Hangul Analyzer III',
  tags: ['NLP', '형태소 분석'],
  language: 'C++',
  stars: 1500,
};

const kStyle = {
  ...base,
  repo: 'vmc-inner-circle/k-style-ui-ux',
  name: 'k-style-ui-ux',
  vendor: 'VMC',
  category: 'frontend',
  summary: '한국형 UI/UX 스타일 시스템',
  description: 'Korean style UI/UX kit',
  tags: ['디자인 시스템'],
  topics: ['design-system'],
  stars: 400,
};

const dockerTool = {
  ...base,
  repo: 'docker/compose',
  name: 'compose',
  vendor: 'Docker',
  category: 'backend',
  summary: '도커 컨테이너를 한 파일로 정의하고 띄우는 도구',
  description: 'Define and run multi-container applications with Docker',
  tags: ['Docker', '컨테이너'],
  topics: ['docker', 'containers'],
  stars: 34000,
  docker: true,
};

const corpus = [storybook, tailwind, khaiii, kStyle, dockerTool];

test('유의어 사전: 40묶음 이상, 한·영 낱말이 같은 묶음에 있다', () => {
  assert.ok(SYNONYM_GROUPS.length >= 40, `묶음 ${SYNONYM_GROUPS.length}개`);
  const groupsWithBoth = SYNONYM_GROUPS.filter(
    (group) => group.some((term) => /[가-힣]/.test(term)) && group.some((term) => /[a-z]/.test(term)),
  );
  assert.ok(groupsWithBoth.length >= 40, `한·영 혼합 묶음 ${groupsWithBoth.length}개`);
});

test('유의어 조회: 화면·화면 관련 낱말과 ai·llm이 서로 이어진다', () => {
  const screen = synonymsOf('화면');
  for (const term of ['ui', 'ux', 'screen', '프론트엔드', '컴포넌트']) {
    assert.ok(screen.includes(term), `화면 → ${term}`);
  }
  assert.ok(synonymsOf('AI').includes('llm'));
  assert.ok(synonymsOf('크롤링').includes('scraping'));
  assert.deepEqual(synonymsOf('없는낱말'), []);
});

test('검색어 확장: 정확 일치 1.0, 유의어 0.5, 한 글자 영문은 확장하지 않는다', () => {
  const expanded = expandTokens('화면');
  const exact = expanded.find((item) => item.term === '화면');
  const synonym = expanded.find((item) => item.term === 'ui');
  assert.equal(exact.weight, 1);
  assert.equal(synonym.weight, SYNONYM_WEIGHT);
  assert.deepEqual(
    expandTokens('k').map((item) => item.term),
    ['k'],
  );
});

test('유의어 검색: 화면 → UI·프론트엔드 항목이 상위에 온다', () => {
  const result = selectRepos(corpus, { query: '화면' });
  const names = result.map((repo) => repo.name);
  assert.deepEqual(new Set(names), new Set(['tailwindcss', 'storybook', 'k-style-ui-ux']));
  assert.ok(
    result.every((repo) => repo.category === 'frontend'),
    '화면으로 찾은 항목은 모두 프론트엔드다',
  );
  // '화면'을 그대로 쓴 tailwind와 UI 이름을 가진 k-style-ui-ux가 형태소 분석기보다 위에 있다
  assert.ok(names.includes('tailwindcss'));
  assert.ok(!names.includes('khaiii'));
  assert.equal(names.at(-1), 'tailwindcss'); // 단어 하나만 걸린 항목이 마지막
});

test('유의어 검색: 크롤링으로 스크래핑 도구를 찾는다', () => {
  const scraper = {
    ...base,
    repo: 'scrapy/scrapy',
    name: 'scrapy',
    category: 'tool',
    summary: '파이썬 웹 스크래핑 프레임워크',
    description: 'A fast high-level web scraping framework',
    tags: ['crawler'],
  };
  const names = selectRepos([scraper, khaiii], { query: '크롤링' }).map((repo) => repo.name);
  assert.deepEqual(names, ['scrapy']);
});

test('BM25: 이름 일치가 요약 일치보다 높은 점수를 받는다', () => {
  const expanded = expandTokens('storybook');
  const byName = scoreRepo(storybook, expanded, undefined);
  const summaryOnly = scoreRepo(
    { ...tailwind, summary: 'storybook 대안으로 만든 도구', description: '' },
    expanded,
    undefined,
  );
  assert.ok(byName > summaryOnly, `${byName} > ${summaryOnly}`);
  assert.ok(scoreRepo(khaiii, expandTokens('storybook')) === 0); // 관련 없으면 0점
});

test('BM25: 필드 가중치 — 이름 > 태그 > 요약 순으로 점수가 높다', () => {
  const expanded = expandTokens('kafka');
  const nameOnly = { ...base, name: 'kafka', repo: 'x/kafka', summary: '메시지 브로커', tags: [] };
  const tagsOnly = { ...base, name: 'x-broker', repo: 'x/broker', summary: '메시지 브로커', tags: ['kafka'] };
  const summaryOnly = { ...base, name: 'y-broker', repo: 'x/y-broker', summary: 'kafka 같은 메시지 브로커', tags: [] };
  const byName = scoreRepo(nameOnly, expanded);
  const byTags = scoreRepo(tagsOnly, expanded);
  const bySummary = scoreRepo(summaryOnly, expanded);
  assert.ok(byName > byTags, `이름 ${byName} > 태그 ${byTags}`);
  assert.ok(byTags > bySummary, `태그 ${byTags} > 요약 ${bySummary}`);
});

test('관련도 정렬: 점수가 같으면 스타 많은 순', () => {
  const a = { ...base, name: 'a-tool', repo: 'x/a-tool', summary: 'docker 도구', stars: 10 };
  const b = { ...base, name: 'b-tool', repo: 'x/b-tool', summary: 'docker 도구', stars: 90 };
  assert.deepEqual(searchRepos([a, b], 'docker').map((repo) => repo.name), ['b-tool', 'a-tool']);
});

test('관련도 정렬: 이름 순·업데이트 순을 고르면 그 기준을 지킨다', () => {
  const byName = searchRepos(corpus, 'docker', { sort: 'name' }).map((repo) => repo.name);
  assert.deepEqual(byName, ['compose']);
  const all = searchRepos(corpus, 'ui', { sort: 'name' }).map((repo) => repo.name);
  assert.deepEqual(all, [...all].sort((x, y) => x.localeCompare(y, 'ko')));
});

test('검색어가 없으면 기존 정렬(스타 순)을 유지한다', () => {
  const names = selectRepos(corpus, { sort: 'relevance' }).map((repo) => repo.name);
  assert.deepEqual(names, ['tailwindcss', 'storybook', 'compose', 'khaiii', 'k-style-ui-ux']);
});

test('k-ui-ux → k-style-ui-ux 매칭은 그대로 유지된다', () => {
  assert.equal(matchesQuery(kStyle, 'k-ui-ux'), true);
  assert.deepEqual(
    selectRepos(corpus, { query: 'k-ui-ux' }).map((repo) => repo.name),
    ['k-style-ui-ux'],
  );
});

test('여러 낱말은 모두 걸려야 한다(AND), 유의어로도 걸린다', () => {
  assert.equal(matchesQuery(dockerTool, '도커 컨테이너'), true);
  assert.equal(matchesQuery(dockerTool, '도커 형태소'), false);
  assert.equal(matchesQuery(storybook, '화면 문서'), true); // 화면→컴포넌트, 문서→문서화
});
