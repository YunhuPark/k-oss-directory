/**
 * 목록 필터·검색·정렬 로직. 브라우저(app.js)와 테스트(node --test)가 함께 쓴다.
 * React·프레임워크 없이 순수 함수만 둔다.
 */

/** 필터 칩 정의(화면과 URL에서 함께 사용) */
export const FILTERS = [
  { key: 'korean', label: '한국어 문서', test: (repo) => repo.koreanDocs === true },
  { key: 'commercial', label: '상업 무료', test: (repo) => repo.commercialUse === true },
  { key: 'docker', label: 'Docker', test: (repo) => repo.docker === true },
  { key: 'recent', label: '최근 3개월', test: (repo) => repo.recent === true },
];

export const FILTER_KEYS = FILTERS.map((filter) => filter.key);

export const CATEGORY_KEYS = ['all', 'frontend', 'ai', 'backend', 'tool', 'learn'];

export const SORTS = [
  { key: 'stars', label: '스타 많은 순' },
  { key: 'updated', label: '최신 업데이트 순' },
  { key: 'name', label: '이름 순' },
];

/** 한 번에 보여 주는 카드 수. '더 보기'를 누를 때마다 이만큼씩 늘어난다. */
export const PAGE_SIZE = 24;

export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 검색어 토큰: 하이픈·밑줄·슬래시·공백은 모두 구분자로 본다.
 * 'k-ui-ux' → ['k','ui','ux'] 이므로 'k-style-ui-ux'가 바로 걸린다.
 */
export function queryTokens(query) {
  return normalize(query)
    .split(/[\s\-_/]+/)
    .filter(Boolean);
}

/** 이번에 그릴 카드 수: 지금까지 펼친 수와 전체 중 작은 쪽. */
export function pageCount(total, visible = PAGE_SIZE) {
  const size = Number.isFinite(Number(visible)) ? Number(visible) : PAGE_SIZE;
  return Math.max(0, Math.min(Number(total) || 0, size));
}

/** 남은 카드 수(더 보기 버튼 문구용). */
export function remainingCount(total, visible = PAGE_SIZE) {
  return Math.max(0, (Number(total) || 0) - pageCount(total, visible));
}

/** 더 보기를 한 번 눌렀을 때의 표시 수 */
export function nextVisibleCount(visible = PAGE_SIZE) {
  return pageCount(Number.MAX_SAFE_INTEGER, Number(visible) + PAGE_SIZE);
}

/** 검색 대상: 이름·저장소 경로·만든 곳·한 줄 소개·원문 설명·태그·분류·언어 */
const CATEGORY_LABELS = {
  frontend: '프론트엔드',
  ai: 'AI·데이터',
  backend: '백엔드·인프라',
  tool: '개발 도구',
  learn: '학습·자료',
};

function haystack(repo) {
  return normalize(
    [
      repo.name,
      repo.repo,
      repo.owner,
      repo.vendor,
      repo.summary,
      repo.description,
      repo.category,
      CATEGORY_LABELS[repo.category],
      repo.language,
      (repo.tags ?? []).join(' '),
      (repo.topics ?? []).join(' '),
    ]
      .filter(Boolean)
      .join(' '),
  );
}

/**
 * 짧은 영문 토큰(k, ui 같은 1~2자)은 낱말 경계에서만 맞춰야 엉뚱한 결과가 안 쏟아진다.
 * 'k-ui-ux'의 k가 'unsloth' 속 글자에 걸리는 일을 막는다. 한글 토큰은 조사가 붙어도
 * 찾을 수 있도록 그대로 부분 일치로 본다.
 */
function containsToken(text, token) {
  if (!/^[a-z0-9]+$/.test(token) || token.length >= 3) return text.includes(token);
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(text);
}

export function matchesQuery(repo, query) {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return true;
  const text = haystack(repo);
  return tokens.every((token) => containsToken(text, token));
}

export function matchesCategory(repo, category) {
  if (!category || category === 'all') return true;
  return repo.category === category;
}

export function passesFilters(repo, activeFilters = []) {
  const active = activeFilters instanceof Set ? [...activeFilters] : activeFilters;
  return active.every((key) => {
    const filter = FILTERS.find((item) => item.key === key);
    return filter ? filter.test(repo) : true;
  });
}

export function sortRepos(repos, sort = 'stars') {
  const list = [...repos];
  if (sort === 'name') {
    return list.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
  }
  if (sort === 'updated') {
    return list.sort((a, b) => (Date.parse(b.pushedAt ?? 0) || 0) - (Date.parse(a.pushedAt ?? 0) || 0));
  }
  return list.sort(
    (a, b) => (b.stars ?? -1) - (a.stars ?? -1) || String(a.name).localeCompare(String(b.name), 'ko'),
  );
}

/** 화면이 필요로 하는 한 번의 계산 */
export function selectRepos(repos, { query = '', category = 'all', filters = [], sort = 'stars' } = {}) {
  return sortRepos(
    repos.filter(
      (repo) => matchesCategory(repo, category) && passesFilters(repo, filters) && matchesQuery(repo, query),
    ),
    sort,
  );
}

export function formatStars(stars) {
  if (stars === null || stars === undefined || Number.isNaN(Number(stars))) return '—';
  const value = Number(stars);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(value);
}

/** 한국어 상대 시간: 오늘 / 3일 전 / 2개월 전 / 1년 전 */
export function formatRelativeDate(iso, now = new Date()) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '정보 없음';
  const days = Math.floor((now.getTime() - time) / 86_400_000);
  if (days <= 0) return '오늘';
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

export function formatDate(iso) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '정보 없음';
  const d = new Date(time);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
