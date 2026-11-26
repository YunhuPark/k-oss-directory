/**
 * 목록 필터·검색·정렬 로직. 브라우저(app.js)와 테스트(node --test)가 함께 쓴다.
 * React·프레임워크 없이 순수 함수만 둔다.
 *
 * 검색은 서버 없이 브라우저에서만 돈다:
 *   1) 한·영 유의어 사전으로 검색어를 확장하고(화면 → ui·ux·screen·레이아웃 …)
 *   2) BM25(필드 가중치 + 문서 길이 정규화)로 관련도를 매겨 정렬한다.
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
  { key: 'relevance', label: '관련도 순' },
  { key: 'stars', label: '스타 많은 순' },
  { key: 'updated', label: '최신 업데이트 순' },
  { key: 'name', label: '이름 순' },
];

export const SORT_KEYS = SORTS.map((sort) => sort.key);

/** 한 번에 보여 주는 카드 수. '더 보기'를 누를 때마다 이만큼씩 늘어난다. */
export const PAGE_SIZE = 24;

/** 카테고리 키 → 화면에 보이는 이름(검색 대상에 함께 넣는다) */
const CATEGORY_LABELS = {
  frontend: '프론트엔드',
  ai: 'AI·데이터',
  backend: '백엔드·인프라',
  tool: '개발 도구',
  learn: '학습·자료',
};

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

/* ── 한·영 유의어 사전 ────────────────────────────────────────────
 * 같은 개념을 가리키는 한국어·영어 낱말을 한 묶음으로 둔다.
 * 검색어 토큰 하나가 묶음 안의 다른 낱말까지 찾아 준다(가중치는 원래 토큰보다 낮다).
 * 50묶음·400여 낱말. 실무에서 자주 섞여 쓰는 말만 넣었다.
 */
export const SYNONYM_GROUPS = [
  ['화면', 'screen', 'ui', 'ux', '인터페이스', 'interface', '레이아웃', 'layout', '컴포넌트', 'component', '프론트엔드', 'frontend'],
  ['디자인', 'design', '피그마', 'figma', '스타일', 'style', '테마', 'theme', '디자인시스템', 'css'],
  ['크롤링', 'crawling', 'crawler', 'scraping', 'scraper', 'spider', '스크래핑', '파싱', 'parsing', '봇', 'bot'],
  ['문서', 'docs', 'document', 'documentation', 'pdf', 'hwp', '마크다운', 'markdown', '위키', 'wiki'],
  ['그림', 'image', '이미지', 'canvas', '캔버스', '다이어그램', 'diagram', '차트', 'chart', 'svg', '그래픽', 'graphics'],
  ['ai', 'llm', '에이전트', 'agent', 'rag', 'mcp', '임베딩', 'embedding', '인공지능', 'gpt', '모델', 'model'],
  ['배포', 'deploy', 'deployment', '도커', 'docker', '컨테이너', 'container', 'ci', 'cd', '인프라', 'infra', '클라우드', 'cloud'],
  ['db', 'database', '데이터베이스', 'sql', 'orm', '백엔드', 'backend', 'postgres', 'postgresql', 'mysql', 'sqlite', 'nosql'],
  ['서버', 'server', 'api', 'rest', 'graphql', 'http', '웹서버', 'was'],
  ['웹', 'web', '브라우저', 'browser', 'react', 'vue', 'svelte', 'spa', 'html'],
  ['성능', 'performance', '최적화', 'optimization', 'benchmark', '벤치마크', '속도', 'fast', '빠른', 'speed'],
  ['보안', 'security', '암호화', 'encryption', '취약점', 'vulnerability', '인증', 'auth', 'authentication', 'oauth', 'jwt', '비밀번호', 'password'],
  ['테스트', 'test', 'testing', 'qa', 'mock', 'e2e', '유닛', 'unit', 'jest', 'vitest', 'pytest'],
  ['자동화', 'automation', '자동화', 'script', '스크립트', '터미널', 'terminal', '커맨드', 'command'],
  ['번역', 'translation', 'translate', '번역', 'i18n', '다국어', 'localization', '로컬라이제이션'],
  ['음성', 'voice', 'speech', 'tts', 'stt', '음성', '오디오', 'audio', '사운드', 'sound'],
  ['영상', 'video', '비디오', '영상', 'ffmpeg', '스트리밍', 'streaming', 'media', '미디어'],
  ['이미지생성', 'diffusion', 'stable-diffusion', 'image-generation', 'text-to-image', '그림생성', '생성ai'],
  ['채팅', 'chat', '채팅', 'chatbot', '챗봇', '메신저', 'messenger', 'slack', 'discord'],
  ['데이터', 'data', '데이터', 'dataset', 'csv', 'parquet', 'etl', '파이프라인', 'pipeline', '분석', 'analytics'],
  ['시각화', 'visualization', '시각화', 'chart', '차트', 'graph', '그래프', '대시보드', 'dashboard', 'plot'],
  ['모니터링', 'monitoring', '모니터링', 'observability', '로그', 'log', 'logging', 'metrics', '메트릭', 'tracing', '추적'],
  ['검색', 'search', '검색', 'indexing', '인덱스', 'elasticsearch', 'retrieval', '랭킹', 'ranking'],
  ['파일', 'file', '파일', 'storage', '스토리지', '업로드', 'upload', 's3', '드라이브', 'drive'],
  ['메일', 'email', 'mail', '메일', 'smtp', '뉴스레터', 'newsletter', '이메일', 'gmail'],
  ['캘린더', 'calendar', '캘린더', '일정', 'schedule', '스케줄', 'ics'],
  ['노트', 'note', '노트', '메모', 'memo', 'obsidian', 'notion', '메모장'],
  ['게임', 'game', '게임', 'gamedev', '엔진', 'engine', '유니티', 'unity', '픽셀', 'pixel'],
  ['모바일', 'mobile', '모바일', 'android', '안드로이드', 'ios', '아이폰', '앱', 'app', 'flutter', 'react-native'],
  ['데스크톱', 'desktop', '데스크톱', 'electron', 'tauri', 'gui', '윈도우', 'windows', 'macos'],
  ['학습', 'learn', '학습', '강의', '튜토리얼', 'tutorial', '교육', 'course', '책', 'book', '로드맵', 'roadmap'],
  ['면접', 'interview', '면접', '취업', '채용', '알고리즘', 'algorithm', '코딩테스트'],
  ['오픈소스', 'open-source', 'opensource', '오픈소스', 'oss', 'awesome', '큐레이션', '리스트', 'list', '모음', 'collection'],
  ['라이선스', 'license', '라이선스', 'mit', 'apache', 'gpl'],
  ['쿠버네티스', 'kubernetes', 'k8s', 'helm', '클러스터', 'cluster', '오케스트레이션', 'orchestration'],
  ['서버리스', 'serverless', '서버리스', 'lambda', 'edge', 'workers', 'faas'],
  ['상태관리', 'state', '상태관리', 'redux', 'zustand', 'store', '스토어'],
  ['폼', 'form', '폼', '입력', 'input', 'validation', '유효성검사', '스키마', 'schema', 'zod'],
  ['애니메이션', 'animation', '애니메이션', 'motion', '모션', 'transition', 'lottie', 'gsap'],
  ['캐시', 'cache', '캐시', 'redis', '레디스', 'memoization', '큐', 'queue', 'kafka', '메시지큐'],
  ['로그인', 'login', '로그인', 'signup', '회원가입', '세션', 'session', 'sso'],
  ['결제', 'payment', '결제', 'billing', 'stripe', 'checkout', '커머스', 'commerce'],
  ['지도', 'map', '지도', 'geospatial', 'gis', '위치', 'location', 'gps', '좌표', '지리'],
  ['날씨', 'weather', '날씨', '기후', 'climate', 'forecast', '예보'],
  ['금융', 'finance', '금융', '주식', 'stock', 'trading', '트레이딩', '투자', 'crypto', '크립토', 'bitcoin'],
  ['의료', 'medical', '의료', 'health', '헬스', 'healthcare', '병원', '바이오', 'bio'],
  ['사진', 'photo', '사진', 'image-editing', '편집', 'editor', '에디터', '필터', 'filter'],
  ['터미널', 'shell', '쉘', 'tui', 'cli', '명령줄', '커맨드라인'],
  ['유틸리티', 'utility', '유틸', '유틸리티', 'tool', '도구', 'helper', 'toolkit'],
  ['파이썬', 'python', '파이썬'],
  ['자바스크립트', 'javascript', 'js', '타입스크립트', 'typescript', 'ts', 'node', 'nodejs'],
  ['자바', 'java', '자바', 'kotlin', '코틀린', 'spring', '스프링'],
  ['러스트', 'rust', '러스트'],
  ['고랭', 'go', 'golang', '고랭'],
  ['자동번역', 'transcribe', '자막', 'subtitle', 'caption'],
  ['프롬프트', 'prompt', '프롬프트', 'instruction', '지시문'],
  ['파인튜닝', 'finetune', 'fine-tuning', '파인튜닝', '학습시키기', 'train', 'training'],
  ['벡터', 'vector', '벡터', 'embedding', '임베딩', 'similarity', '유사도'],
];

/** 낱말 → 같은 묶음의 다른 낱말 목록 */
const SYNONYM_INDEX = new Map();
for (const group of SYNONYM_GROUPS) {
  for (const term of group) {
    const key = normalize(term);
    const bucket = SYNONYM_INDEX.get(key) ?? new Set();
    for (const other of group) if (normalize(other) !== key) bucket.add(normalize(other));
    SYNONYM_INDEX.set(key, bucket);
  }
}

/** 유의어 조회: 없으면 빈 배열 */
export function synonymsOf(token) {
  return [...(SYNONYM_INDEX.get(normalize(token)) ?? [])];
}

/** 유의어 일치에 주는 가중치(정확 일치 1.0) */
export const SYNONYM_WEIGHT = 0.5;

/**
 * 검색어 하나를 [{ term, weight }]로 확장한다.
 * 정확 일치 1.0, 유의어 0.5. 한 글자 영문('k')은 유의어를 붙이지 않는다.
 */
export function expandTokens(query) {
  const expansions = [];
  const seen = new Set();
  for (const token of queryTokens(query)) {
    if (!seen.has(token)) {
      seen.add(token);
      expansions.push({ term: token, weight: 1 });
    }
    if (token.length < 2) continue;
    for (const synonym of synonymsOf(token)) {
      const key = `syn:${synonym}`;
      if (seen.has(key)) continue;
      seen.add(key);
      expansions.push({ term: synonym, weight: SYNONYM_WEIGHT });
    }
  }
  return expansions;
}

/* ── BM25 채점 ──────────────────────────────────────────────────── */

/** 필드별 가중치: 이름·저장소 경로 > 태그·분류 > 요약 > 원문 설명 */
export const SEARCH_FIELDS = [
  { key: 'name', weight: 10, get: (repo) => repo.name },
  { key: 'repo', weight: 8, get: (repo) => repo.repo },
  { key: 'tags', weight: 5, get: (repo) => (repo.tags ?? []).join(' ') },
  { key: 'category', weight: 4, get: (repo) => `${repo.category ?? ''} ${CATEGORY_LABELS[repo.category] ?? ''}` },
  { key: 'topics', weight: 3, get: (repo) => (repo.topics ?? []).join(' ') },
  { key: 'vendor', weight: 3, get: (repo) => `${repo.vendor ?? ''} ${repo.owner ?? ''}` },
  { key: 'summary', weight: 3, get: (repo) => repo.summary },
  { key: 'description', weight: 2, get: (repo) => repo.description },
  { key: 'language', weight: 1.5, get: (repo) => repo.language },
];

const BM25_K1 = 1.2;
const BM25_B = 0.75;
const MAX_TF = 4;

const WORD_SPLIT = /[^\p{L}\p{N}]+/u;

/** 저장소 하나의 필드별 정규화 텍스트·낱말 목록(한 번만 만든다) */
const FIELD_CACHE = new WeakMap();

function fieldsOf(repo) {
  let cached = FIELD_CACHE.get(repo);
  if (cached) return cached;
  const fields = new Map();
  for (const field of SEARCH_FIELDS) {
    const text = normalize(field.get(repo));
    const words = text.split(WORD_SPLIT).filter(Boolean);
    fields.set(field.key, { text, words });
  }
  FIELD_CACHE.set(repo, fields);
  return fields;
}

const isShortAscii = (term) => /^[a-z0-9]+$/.test(term) && term.length < 3;

/** 필드 안에서 term이 몇 번 나오는지(0~MAX_TF) */
function termFrequency(field, term) {
  if (!field || !term) return 0;
  if (isShortAscii(term)) {
    let count = 0;
    for (const word of field.words) if (word === term) count += 1;
    return Math.min(count, MAX_TF);
  }
  // 한글은 조사가 붙어도 찾도록 부분 일치, 긴 영문은 낱말 경계와 무관하게 부분 일치
  let count = 0;
  let from = 0;
  for (;;) {
    const at = field.text.indexOf(term, from);
    if (at === -1) break;
    count += 1;
    if (count >= MAX_TF) return MAX_TF;
    from = at + term.length;
  }
  return count;
}

/**
 * 코퍼스 지표(IDF·평균 길이)를 저장소 배열마다 한 번 계산해 둔다.
 * 배열이 바뀌면 새로 만든다(WeakMap 키가 배열이라 가비지 컬렉션도 된다).
 */
const INDEX_CACHE = new WeakMap();

function indexOf(repos) {
  let index = INDEX_CACHE.get(repos);
  if (index) return index;

  const avgLen = new Map();
  for (const field of SEARCH_FIELDS) {
    let total = 0;
    for (const repo of repos) total += fieldsOf(repo).get(field.key).words.length;
    avgLen.set(field.key, repos.length ? total / repos.length : 1);
  }

  const df = new Map();
  index = {
    n: repos.length,
    avgLen,
    idf(term) {
      if (df.has(term)) return df.get(term);
      let docs = 0;
      for (const repo of repos) {
        const fields = fieldsOf(repo);
        for (const field of SEARCH_FIELDS) {
          if (termFrequency(fields.get(field.key), term) > 0) {
            docs += 1;
            break;
          }
        }
      }
      const value = Math.log(1 + (repos.length - docs + 0.5) / (docs + 0.5));
      df.set(term, value);
      return value;
    },
  };
  INDEX_CACHE.set(repos, index);
  return index;
}

/** 확장된 검색어 하나가 저장소에서 갖는 점수 */
function termScore(fields, index, term) {
  const idf = index.idf(term);
  if (idf <= 0) return 0;
  let score = 0;
  for (const field of SEARCH_FIELDS) {
    const bucket = fields.get(field.key);
    const tf = termFrequency(bucket, term);
    if (tf === 0) continue;
    const len = bucket.words.length || 1;
    const avg = index.avgLen.get(field.key) || 1;
    const saturated = (tf * (BM25_K1 + 1)) / (tf + BM25_K1 * (1 - BM25_B + BM25_B * (len / avg)));
    score += field.weight * idf * saturated;
  }
  return score;
}

/** 검색어와 저장소의 관련도(BM25 + 필드 가중치). index를 주지 않으면 이 저장소 하나로 IDF를 매긴다. */
export function scoreRepo(repo, expanded, index) {
  const scorer = index ?? indexOf([repo]);
  const fields = fieldsOf(repo);
  let score = 0;
  for (const { term, weight } of expanded) score += weight * termScore(fields, scorer, term);
  return score;
}

function fieldsHave(fields, term) {
  for (const field of SEARCH_FIELDS) {
    if (termFrequency(fields.get(field.key), term) > 0) return true;
  }
  return false;
}

/** 검색어 토큰이 모두 걸리는지(AND). 각 토큰은 정확 일치 또는 유의어로 걸리면 된다. */
export function matchesQuery(repo, query) {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return true;
  const fields = fieldsOf(repo);
  return tokens.every(
    (token) => fieldsHave(fields, token) || synonymsOf(token).some((synonym) => fieldsHave(fields, synonym)),
  );
}

/** 걸리면 true와 점수를 함께 돌려준다. */
function matchAndScore(repo, tokens, expanded, index) {
  const fields = fieldsOf(repo);
  const matched = tokens.every(
    (token) => fieldsHave(fields, token) || synonymsOf(token).some((synonym) => fieldsHave(fields, synonym)),
  );
  if (!matched) return { matched: false, score: 0 };
  return { matched: true, score: scoreRepo(repo, expanded, index) };
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

/**
 * 검색어가 있을 때의 정렬: 관련도(점수) 높은 순, 같으면 스타 많은 순.
 * 검색어가 없을 때는 기존 정렬(스타·업데이트·이름)을 그대로 쓴다.
 */
export function searchRepos(repos, query, { sort = 'relevance' } = {}) {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return sortRepos(repos, sort === 'relevance' ? 'stars' : sort);
  const index = indexOf(repos);
  const expanded = expandTokens(query);
  const scored = [];
  for (const repo of repos) {
    const { matched, score } = matchAndScore(repo, tokens, expanded, index);
    if (matched) scored.push({ repo, score });
  }
  // 명시적으로 이름·업데이트 순을 골랐으면 그 기준을 지킨다.
  if (sort === 'name' || sort === 'updated') return sortRepos(scored.map((hit) => hit.repo), sort);
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (b.repo.stars ?? -1) - (a.repo.stars ?? -1) ||
      String(a.repo.name).localeCompare(String(b.repo.name), 'ko'),
  );
  return scored.map((hit) => hit.repo);
}

/** 화면이 필요로 하는 한 번의 계산 */
export function selectRepos(repos, { query = '', category = 'all', filters = [], sort = 'relevance' } = {}) {
  const filtered = repos.filter((repo) => matchesCategory(repo, category) && passesFilters(repo, filters));
  if (queryTokens(query).length === 0) return sortRepos(filtered, sort === 'relevance' ? 'stars' : sort);
  // 검색어가 있으면 관련도 순이 기본이다.
  return searchRepos(filtered, query, { sort: sort || 'relevance' });
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
