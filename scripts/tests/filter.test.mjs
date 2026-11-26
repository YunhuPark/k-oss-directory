import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FILTERS,
  FILTER_KEYS,
  PAGE_SIZE,
  formatRelativeDate,
  formatStars,
  hasMcpSkill,
  isMcpOrSkill,
  matchesCategory,
  matchesQuery,
  nextVisibleCount,
  pageCount,
  passesFilters,
  queryTokens,
  remainingCount,
  selectRepos,
  sortRepos,
} from '../../public/lib/filter.mjs';

const base = {
  repo: 'toss/es-toolkit',
  name: 'es-toolkit',
  vendor: '토스',
  category: 'frontend',
  summary: 'lodash를 대체하는 모던 JS 유틸리티',
  description: 'A modern JavaScript utility library',
  tags: ['TypeScript', '유틸리티'],
  topics: [],
  language: 'TypeScript',
  stars: 11399,
  koreanDocs: true,
  commercialUse: true,
  docker: false,
  recent: true,
  pushedAt: '2026-11-14T10:26:04Z',
};

const repos = [
  base,
  {
    ...base,
    repo: 'kakao/khaiii',
    name: 'khaiii',
    vendor: '카카오',
    category: 'ai',
    summary: '한글 형태소 분석기',
    description: 'Kakao Hangul Analyzer III',
    tags: ['NLP', '형태소 분석'],
    language: 'Python',
    stars: 1455,
    docker: true,
  },
  {
    ...base,
    repo: 'nhn/tui.editor',
    name: 'tui.editor',
    vendor: 'NHN',
    category: 'tool',
    summary: '마크다운 WYSIWYG 에디터',
    description: 'Markdown WYSIWYG Editor',
    tags: ['마크다운'],
    stars: 17983,
    koreanDocs: false,
    docker: false,
    recent: false,
  },
  {
    ...base,
    repo: 'gyoogle/tech-interview',
    name: 'tech-interview-for-developer',
    vendor: '개인 개발자',
    category: 'learn',
    summary: '신입 개발자 기술 면접 백과사전',
    stars: 17704,
    commercialUse: false,
    koreanDocs: true,
    recent: false,
  },
];

test('FILTER_KEYS: 칩 5종', () => {
  assert.deepEqual(FILTER_KEYS, ['korean', 'commercial', 'docker', 'recent', 'mcp']);
  assert.equal(FILTERS.length, 5);
  assert.equal(FILTERS.at(-1).label, 'MCP · 스킬');
});

test('isMcpOrSkill: MCP 서버·클라이언트를 토픽·이름으로 찾는다', () => {
  // 토픽 mcp / mcp-server / model-context-protocol
  assert.equal(isMcpOrSkill({ ...base, repo: 'treesoop/hwp-mcp', name: 'hwp-mcp', tags: [], topics: ['mcp-server', 'model-context-protocol'] }), true);
  assert.equal(isMcpOrSkill({ ...base, name: 'anything', tags: ['MCP'], topics: [] }), true);
  // 이름이 mcp로 끝나는 저장소(토픽이 비어 있어도)
  assert.equal(isMcpOrSkill({ ...base, repo: 'ezyang/codemcp', name: 'codemcp', tags: [], topics: [], summary: 'Claude 데스크톱에서 코드를 다루게 해 주는 도구.' }), true);
  assert.equal(isMcpOrSkill({ ...base, repo: 'modelcontextprotocol/python-sdk', name: 'python-sdk', tags: [], topics: ['mcp-client'] }), true);
});

test('isMcpOrSkill: 코딩 에이전트용 스킬·플러그인을 찾는다', () => {
  assert.equal(isMcpOrSkill({ ...base, repo: 'addyosmani/agent-skills', name: 'agent-skills', tags: ['agent-skills'], topics: [] }), true);
  assert.equal(isMcpOrSkill({ ...base, repo: 'vmc-inner-circle/k-style-ui-ux', name: 'k-style-ui-ux', tags: [], topics: ['claude-code-plugin'] }), true);
  assert.equal(isMcpOrSkill({ ...base, repo: 'one/skills', name: 'my-design-skill', tags: [], topics: [] }), true);
  // 토픽에 없고 소개·설명에만 있어도, 에이전트 낱말과 붙어 있으면 스킬로 본다
  assert.equal(isMcpOrSkill({ ...base, name: 'hallmark', tags: ['CSS'], topics: [], description: 'Anti-AI-slop design skill for Claude Code, Cursor, and Codex.' }), true);
  assert.equal(isMcpOrSkill({ ...base, name: 'ccpm', tags: [], topics: [], summary: '병렬 에이전트 작업을 관리하는 PM 스킬 시스템.' }), true);
});

test('isMcpOrSkill: 일반 플러그인·MCP 언급만 하는 도구는 걸리지 않는다', () => {
  const plain = { ...base, tags: [], topics: [] };
  // 플러그인 구조를 쓰는 일반 프레임워크
  assert.equal(isMcpOrSkill({ ...plain, repo: 'ohmyzsh/ohmyzsh', name: 'ohmyzsh', tags: ['Shell'], topics: ['plugin-framework', 'plugins'], summary: '플러그인 300여 개와 테마를 바로 쓸 수 있다.' }), false);
  assert.equal(isMcpOrSkill({ ...plain, repo: 'eslint/eslint', name: 'eslint', tags: ['JavaScript'], topics: ['plugins'], summary: '플러그인으로 규칙을 조립해 팀 규칙을 코드로 강제한다.' }), false);
  assert.equal(isMcpOrSkill({ ...plain, repo: 'pytest-dev/pytest-xdist', name: 'pytest-xdist', topics: ['pytest-plugin'], summary: 'pytest를 여러 프로세스로 병렬 실행하는 플러그인.' }), false);
  // MCP를 설치 수단·지원 기능으로만 언급
  assert.equal(isMcpOrSkill({ ...plain, name: 'kokonutui', topics: ['ai', 'components'], description: '100+ React components for AI chat. Install with the shadcn CLI or MCP.' }), false);
  assert.equal(isMcpOrSkill({ ...plain, name: 'ccusage', tags: ['Rust'], summary: 'Claude Code 등 에이전트 사용량과 토큰 비용을 집계해 주는 CLI.' }), false);
  // 'skill'이 들어간 다른 낱말(링크드인 스킬 인증)
  assert.equal(isMcpOrSkill({ ...plain, name: 'the-endorser', topics: ['osint', 'linkedin'], summary: '링크드인 스킬 인증으로 사람 사이 관계를 그려 내는 OSINT 도구.' }), false);
  assert.equal(isMcpOrSkill(null), false);
});

test('hasMcpSkill: 데이터의 mcpSkill 값이 자동 판별을 덮어쓴다', () => {
  const mcpRepo = { ...base, repo: 'x/hwp-mcp', name: 'hwp-mcp', tags: [], topics: ['mcp-server'] };
  assert.equal(hasMcpSkill(mcpRepo), true);
  assert.equal(hasMcpSkill({ ...mcpRepo, mcpSkill: false }), false);
  const plain = { ...base, repo: 'x/plain', name: 'plain', tags: [], topics: [] };
  assert.equal(hasMcpSkill(plain), false);
  assert.equal(hasMcpSkill({ ...plain, mcpSkill: true }), true);
});

test('matchesQuery: 이름·소개·태그·영문 설명·대소문자 무시', () => {
  assert.equal(matchesQuery(base, ''), true);
  assert.equal(matchesQuery(base, '   '), true);
  assert.equal(matchesQuery(base, 'es-toolkit'), true);
  assert.equal(matchesQuery(base, 'ES-TOOLKIT'), true);
  assert.equal(matchesQuery(base, '유틸리티'), true);
  assert.equal(matchesQuery(base, 'javascript'), true); // 영문 설명으로도 찾힌다
  assert.equal(matchesQuery(base, '토스'), true);
  assert.equal(matchesQuery(base, '없는검색어'), false);
});

test('matchesQuery: 여러 단어는 모두 포함(AND)', () => {
  assert.equal(matchesQuery(base, '토스 lodash'), true);
  assert.equal(matchesQuery(base, '토스 파이썬'), false);
});

test('queryTokens: 하이픈·밑줄·슬래시·공백을 모두 구분자로 본다', () => {
  assert.deepEqual(queryTokens('k-ui-ux'), ['k', 'ui', 'ux']);
  assert.deepEqual(queryTokens('TanStack/query'), ['tanstack', 'query']);
  assert.deepEqual(queryTokens('snake_case name'), ['snake', 'case', 'name']);
  assert.deepEqual(queryTokens('  ---  '), []);
  assert.deepEqual(queryTokens(''), []);
});

test('matchesQuery: k-ui-ux로 k-style-ui-ux가 바로 걸린다', () => {
  const kStyle = {
    ...base,
    repo: 'vmc-inner-circle/k-style-ui-ux',
    name: 'k-style-ui-ux',
    vendor: 'VMC',
    summary: '한국형 UI/UX 스타일 시스템',
    description: 'Korean style UI/UX kit',
    tags: ['디자인 시스템'],
    language: 'TypeScript',
  };
  assert.equal(matchesQuery(kStyle, 'k-ui-ux'), true);
  assert.equal(matchesQuery(kStyle, 'K-UI-UX'), true);
  assert.deepEqual(selectRepos([base, kStyle], { query: 'k-ui-ux' }).map((repo) => repo.name), ['k-style-ui-ux']);
});

test('matchesQuery: 짧은 영문 토큰은 낱말 경계에서만 맞춘다', () => {
  // 'k'가 unsloth 같은 낱말 속 글자에 걸리면 k-ui-ux 검색이 흐려진다
  const unsloth = { ...base, name: 'unsloth', repo: 'unslothai/unsloth', summary: '적은 메모리로 미세조정', description: 'Finetune LLMs faster', tags: [] };
  assert.equal(matchesQuery(unsloth, 'k'), false);
  assert.equal(matchesQuery({ ...unsloth, name: 'k-tool', repo: 'x/k-tool', description: '' }, 'k'), true);
  // 한글 토큰은 조사가 붙어도 찾는다
  assert.equal(matchesQuery(base, '유틸리티'), true);
});

test('matchesQuery: 분류 이름으로도 찾는다', () => {
  assert.equal(matchesQuery(base, '프론트엔드'), true);
  assert.equal(matchesQuery({ ...base, category: 'ai' }, '프론트엔드'), false);
  assert.equal(matchesQuery({ ...base, category: 'ai' }, 'ai'), true);
});

test('페이지 나누기: 24개씩, 남은 수·다음 표시 수', () => {
  assert.equal(PAGE_SIZE, 24);
  assert.equal(pageCount(260), 24);
  assert.equal(pageCount(10), 10);
  assert.equal(pageCount(0), 0);
  assert.equal(remainingCount(260), 236);
  assert.equal(remainingCount(24), 0);
  assert.equal(remainingCount(10), 0);
  assert.equal(nextVisibleCount(24), 48);
  assert.equal(nextVisibleCount(0), 24);
  assert.equal(pageCount(30, 48), 30); // 끝을 넘기지 않는다
  assert.equal(remainingCount(30, 24), 6);
});

test('matchesCategory', () => {
  assert.equal(matchesCategory(base, 'all'), true);
  assert.equal(matchesCategory(base, 'frontend'), true);
  assert.equal(matchesCategory(base, 'ai'), false);
  assert.equal(matchesCategory(base, undefined), true);
});

test('passesFilters: 다중 선택은 AND', () => {
  assert.equal(passesFilters(base, []), true);
  assert.equal(passesFilters(base, ['korean']), true);
  assert.equal(passesFilters(base, ['korean', 'commercial']), true);
  assert.equal(passesFilters(base, ['korean', 'docker']), false);
  assert.equal(passesFilters(base, new Set(['docker'])), false);
});

test('passesFilters: MCP · 스킬도 다른 칩과 AND로 묶인다', () => {
  const skill = { ...base, repo: 'x/design-skill', name: 'design-skill', tags: [], topics: ['agent-skills'], docker: true };
  assert.equal(passesFilters(skill, ['mcp']), true);
  assert.equal(passesFilters(skill, ['mcp', 'docker']), true);
  assert.equal(passesFilters(skill, ['mcp', 'korean', 'recent']), true);
  assert.equal(passesFilters(base, ['mcp']), false);
  assert.deepEqual(
    selectRepos([base, skill], { filters: ['mcp'], sort: 'stars' }).map((repo) => repo.name),
    ['design-skill'],
  );
});

test('sortRepos: 스타순·업데이트순·이름순', () => {
  assert.deepEqual(
    sortRepos(repos, 'stars').map((repo) => repo.name),
    ['tui.editor', 'tech-interview-for-developer', 'es-toolkit', 'khaiii'],
  );
  assert.equal(sortRepos(repos, 'updated')[0].name, 'es-toolkit'); // 같은 pushedAt이면 이름순 tiebreak
  assert.equal(sortRepos(repos, 'name')[0].name, 'es-toolkit');
});

test('sortRepos: stars가 null인 항목은 뒤로', () => {
  const withNull = [...repos, { ...base, name: 'a-stale', stars: null }];
  assert.equal(sortRepos(withNull, 'stars').at(-1).name, 'a-stale');
});

test('selectRepos: 검색+카테고리+필터+정렬 한 번에', () => {
  const result = selectRepos(repos, { query: '', category: 'frontend', filters: ['korean'], sort: 'stars' });
  assert.deepEqual(
    result.map((repo) => repo.name),
    ['es-toolkit'],
  );

  const docker = selectRepos(repos, { filters: ['docker'], sort: 'stars' });
  assert.deepEqual(
    docker.map((repo) => repo.name),
    ['khaiii'],
  );

  const archives = selectRepos(repos, { query: 'tui', sort: 'stars' });
  assert.deepEqual(
    archives.map((repo) => repo.name),
    ['tui.editor'],
  );
});

test('formatStars', () => {
  assert.equal(formatStars(11399), '11.4k');
  assert.equal(formatStars(980), '980');
  assert.equal(formatStars(1000), '1k');
  assert.equal(formatStars(1_200_000), '1.2M');
  assert.equal(formatStars(0), '0');
  assert.equal(formatStars(null), '—');
});

test('formatRelativeDate', () => {
  const now = new Date('2026-11-26T00:00:00Z');
  assert.equal(formatRelativeDate('2026-11-26T00:00:00Z', now), '오늘');
  assert.equal(formatRelativeDate('2026-11-23T00:00:00Z', now), '3일 전');
  assert.equal(formatRelativeDate('2026-11-10T00:00:00Z', now), '2주 전');
  assert.equal(formatRelativeDate('2026-09-26T00:00:00Z', now), '2개월 전');
  assert.equal(formatRelativeDate('2022-03-23T00:00:00Z', now), '4년 전');
  assert.equal(formatRelativeDate(null, now), '정보 없음');
});
