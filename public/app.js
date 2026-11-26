import { FILTERS, SORTS, selectRepos, formatStars, formatRelativeDate, formatDate } from './lib/filter.mjs';

const REPO_URL = 'https://github.com/YunhuPark/k-oss-directory';
const ISSUE_NEW = `${REPO_URL}/issues/new`;
const THEME_KEY = 'koss-theme';

const CATEGORY_LABELS = {
  all: '전체',
  frontend: '프론트엔드',
  ai: 'AI·데이터',
  backend: '백엔드·인프라',
  tool: '개발 도구',
  learn: '학습·자료',
};

const CATEGORY_ORDER = ['all', 'frontend', 'ai', 'backend', 'tool', 'learn'];

const state = {
  repos: [],
  generatedAt: null,
  query: '',
  category: 'all',
  filters: new Set(),
  sort: 'stars',
};

const el = {
  q: document.getElementById('q'),
  sort: document.getElementById('sort'),
  tabs: document.getElementById('tabs'),
  chips: document.getElementById('chips'),
  count: document.getElementById('count'),
  reset: document.getElementById('reset'),
  resetEmpty: document.getElementById('reset-empty'),
  grid: document.getElementById('grid'),
  empty: document.getElementById('empty'),
  loadError: document.getElementById('load-error'),
  updated: document.getElementById('updated'),
  heroStats: document.getElementById('hero-stats'),
  detail: document.getElementById('detail'),
  detailInner: document.getElementById('detail-inner'),
  reportLink: document.getElementById('report-link'),
  themeToggle: document.getElementById('theme-toggle'),
  themeLabel: document.getElementById('theme-label'),
  themeColor: document.querySelector('meta[name="theme-color"]'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function issueUrl(title) {
  const params = new URLSearchParams({ template: 'submit-repo.yml', title });
  return `${ISSUE_NEW}?${params.toString()}`;
}

/* ── 라이트/다크 모드 (data-theme + localStorage) ── */
function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme, { persist = true } = {}) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (error) {
      /* 저장소를 쓸 수 없어도 화면은 바뀐다 */
    }
  }
  const toDark = next === 'light';
  el.themeToggle.setAttribute('aria-pressed', String(next === 'dark'));
  el.themeToggle.setAttribute('title', toDark ? '다크 모드로 전환' : '라이트 모드로 전환');
  el.themeLabel.textContent = toDark ? '다크 모드로 전환' : '라이트 모드로 전환';
  if (el.themeColor) el.themeColor.setAttribute('content', next === 'dark' ? '#0d0e10' : '#f6f6f3');
}

/* ── URL 해시 ⇄ 상태 (공유 가능한 링크) ─────────────── */
function readHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  state.query = params.get('q') ?? '';
  state.category = CATEGORY_ORDER.includes(params.get('cat')) ? params.get('cat') : 'all';
  state.filters = new Set((params.get('f') ?? '').split(',').filter((key) => FILTERS.some((f) => f.key === key)));
  state.sort = SORTS.some((s) => s.key === params.get('sort')) ? params.get('sort') : 'stars';
}

function writeHash() {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.category !== 'all') params.set('cat', state.category);
  if (state.filters.size) params.set('f', [...state.filters].join(','));
  if (state.sort !== 'stars') params.set('sort', state.sort);
  const next = params.toString();
  const url = next ? `#${next}` : location.pathname + location.search;
  history.replaceState(null, '', url);
}

function syncControls() {
  el.q.value = state.query;
  el.sort.value = state.sort;
  for (const button of el.tabs.querySelectorAll('.tab')) {
    button.setAttribute('aria-pressed', String(button.dataset.category === state.category));
  }
  for (const chip of el.chips.querySelectorAll('.chip')) {
    chip.setAttribute('aria-pressed', String(state.filters.has(chip.dataset.filter)));
  }
  const hasCondition = state.query !== '' || state.category !== 'all' || state.filters.size > 0;
  el.reset.hidden = !hasCondition;
}

/* ── 조각 렌더 ──────────────────────────────────── */
function buildTabs() {
  el.tabs.innerHTML = CATEGORY_ORDER.map(
    (key) =>
      `<button class="tab" type="button" data-category="${key}" aria-pressed="${
        key === state.category
      }">${escapeHtml(CATEGORY_LABELS[key])}</button>`,
  ).join('');

  el.chips.innerHTML = FILTERS.map(
    (filter) =>
      `<button class="chip" type="button" data-filter="${filter.key}" aria-pressed="${
        state.filters.has(filter.key) ? 'true' : 'false'
      }">${escapeHtml(filter.label)}</button>`,
  ).join('');

  el.sort.innerHTML = SORTS.map(
    (sort) => `<option value="${sort.key}">${escapeHtml(sort.label)}</option>`,
  ).join('');
  el.sort.value = state.sort;
}

/** 배지: 판정 + 검증 표시(✓ 실측 · ? 직접 확인/참고) */
function badge(label, kind, mark) {
  const markClass = mark === 'question' ? 'reference' : mark === 'verified' ? 'verified' : '';
  const classes = ['badge', kind ? `badge-${kind}` : '', markClass ? `badge-${markClass}` : '']
    .filter(Boolean)
    .join(' ');
  return `<span class="${classes}">${escapeHtml(label)}</span>`;
}

function licenseEvidence(repo) {
  if (repo.licenseSource === 'github') {
    return { mark: 'verified', text: `LICENSE ${repo.license} · GitHub 확인` };
  }
  if (repo.licenseSource === 'curated') {
    return { mark: 'question', text: `LICENSE ${repo.license} · 원문 직접 확인` };
  }
  return { mark: 'question', text: 'LICENSE 미지정 · 원문 확인 필요' };
}

function cardBadges(repo) {
  const license = licenseEvidence(repo);
  const commercial = repo.commercialUse
    ? badge('상업 무료', 'commercial', license.mark)
    : badge('라이선스 미지정', null, 'question');

  return [
    commercial,
    repo.koreanDocs ? badge('한국어 문서', 'korean', repo.koreanDocsSource === 'curated' ? 'question' : 'verified') : '',
    repo.docker ? badge('Docker', 'docker', repo.dockerSource === 'curated' ? 'question' : 'verified') : '',
    repo.archived ? badge('보관됨', 'archived') : '',
  ]
    .filter(Boolean)
    .join('');
}

function cardHtml(repo) {
  const meta = [
    ['LICENSE', repo.license ?? '미지정'],
    ['PUSHED', repo.pushedAt ? formatDate(repo.pushedAt) : '—'],
    ['LANG', repo.language ?? '—'],
  ]
    .map(([term, value]) => `<div><dt>${term}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join('');

  return `<article class="card" role="button" tabindex="0" data-repo="${escapeHtml(repo.repo)}" aria-label="${escapeHtml(
    `${repo.repo} 상세 보기`,
  )}">
      <div class="card-top">
        <h3 class="card-title">${escapeHtml(repo.name)}</h3>
        <span class="card-vendor">${escapeHtml(repo.vendor)}</span>
      </div>
      <p class="card-summary">${escapeHtml(repo.summary)}</p>
      <div class="badges">${cardBadges(repo)}</div>
      <dl class="card-meta">
        ${meta}
        <div class="card-stars"><dt>STARS</dt><dd>${formatStars(repo.stars)}</dd></div>
      </dl>
    </article>`;
}

function render() {
  const visible = selectRepos(state.repos, {
    query: state.query,
    category: state.category,
    filters: [...state.filters],
    sort: state.sort,
  });

  el.grid.innerHTML = visible.map((repo) => cardHtml(repo)).join('');
  el.empty.hidden = visible.length !== 0;
  el.grid.hidden = visible.length === 0;

  const parts = [`<b>${visible.length}</b>개 표시`];
  if (visible.length !== state.repos.length) parts.push(`전체 ${state.repos.length}개`);
  el.count.innerHTML = parts.join(' · ');

  syncControls();
  writeHash();
}

/* ── 상세 모달 ──────────────────────────────────── */
function evidenceItem(mark, key, text) {
  return `<li class="evidence-item" data-mark="${mark}">
      <span class="evidence-mark" aria-hidden="true">${mark === 'check' ? '✓' : '?'}</span>
      <span class="evidence-key">${escapeHtml(key)}</span>
      <span>${escapeHtml(text)}</span>
    </li>`;
}

function detailHtml(repo) {
  const now = state.generatedAt ? new Date(state.generatedAt) : new Date();
  const tags = (repo.tags ?? []).map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join('');

  const evidence = [
    evidenceItem(
      repo.licenseSource === 'github' ? 'check' : 'question',
      'LICENSE',
      repo.licenseSource === 'github'
        ? `${repo.license ?? '미지정'} · GitHub API 실측`
        : repo.licenseSource === 'curated'
          ? `${repo.license} · 원문 직접 확인`
          : '라이선스 파일 없음 · 상업 사용 전 확인 필요',
    ),
    evidenceItem(
      repo.koreanDocs ? (repo.koreanDocsSource === 'curated' ? 'question' : 'check') : 'question',
      'KOREAN',
      repo.koreanDocs
        ? repo.koreanDocsSource === 'curated'
          ? '한국어 문서 직접 확인'
          : '한국어 README 또는 README.ko.md'
        : '한국어 문서 없음(영어 문서)',
    ),
    evidenceItem(
      repo.docker ? (repo.dockerSource === 'curated' ? 'question' : 'check') : 'question',
      'DOCKER',
      repo.docker
        ? repo.dockerSource === 'curated'
          ? 'Dockerfile 직접 확인'
          : '루트 Dockerfile 또는 docker 토픽'
        : 'Dockerfile 없음',
    ),
    evidenceItem(
      repo.recent ? 'check' : 'question',
      'PUSHED',
      repo.pushedAt ? `${formatDate(repo.pushedAt)} · ${formatRelativeDate(repo.pushedAt, now)}` : '푸시 기록 없음',
    ),
    repo.archived ? evidenceItem('question', 'ARCHIVED', 'GitHub에서 보관된 저장소') : '',
  ]
    .filter(Boolean)
    .join('');

  const stats = [
    ['STARS', formatStars(repo.stars)],
    ['OPEN ISSUES', repo.openIssues === null ? '—' : String(repo.openIssues)],
    ['LICENSE', repo.license ?? '미지정'],
    ['PUSHED', repo.pushedAt ? formatDate(repo.pushedAt) : '정보 없음'],
    ['LANG', repo.language ?? '—'],
    ['BRANCH', repo.defaultBranch ?? '—'],
  ];

  return `<div class="detail-head">
      <div>
        <p class="detail-vendor">${escapeHtml(repo.vendor)} · ${escapeHtml(CATEGORY_LABELS[repo.category] ?? repo.category)}</p>
        <h2 class="detail-title" id="detail-title">${escapeHtml(repo.repo)}</h2>
      </div>
      <button class="detail-close" type="button" data-close aria-label="닫기">✕</button>
    </div>
    <p class="detail-summary">${escapeHtml(repo.summary)}</p>
    ${repo.description ? `<p class="detail-desc">저장소 원문 설명: ${escapeHtml(repo.description)}</p>` : ''}
    <div class="badges" style="margin-top:12px">${cardBadges(repo)}${tags}</div>
    <ul class="evidence" aria-label="판정 근거">
      ${evidence}
    </ul>
    ${repo.archived ? '<p class="detail-note">이 저장소는 GitHub에서 보관(archived) 상태입니다. 새 프로젝트에는 대체 라이브러리를 권장합니다.</p>' : ''}
    <dl class="detail-stats">
      ${stats.map(([term, value]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}
    </dl>
    <div class="detail-actions">
      <a class="button button-primary" href="${escapeHtml(repo.url)}" target="_blank" rel="noreferrer noopener">GitHub 열기 ↗</a>
      ${
        repo.homepage
          ? `<a class="button" href="${escapeHtml(repo.homepage)}" target="_blank" rel="noreferrer noopener">문서 보기 ↗</a>`
          : ''
      }
      <a class="button" href="${issueUrl(`[제보] ${repo.repo} 정보 수정`)}" target="_blank" rel="noreferrer noopener">정보가 틀렸어요</a>
    </div>
    <p class="detail-note">라이선스 판정은 참고용입니다. 사용 전 GitHub의 LICENSE 원문을 확인하세요.</p>`;
}

function openDetail(repoName) {
  const repo = state.repos.find((item) => item.repo === repoName);
  if (!repo) return;
  el.detailInner.innerHTML = detailHtml(repo);
  el.detail.showModal();
  el.detailInner.querySelector('[data-close]')?.focus();
}

/* ── 이벤트 ────────────────────────────────────── */
function bindEvents() {
  el.q.addEventListener('input', () => {
    state.query = el.q.value.trim();
    render();
  });

  el.sort.addEventListener('change', () => {
    state.sort = el.sort.value;
    render();
  });

  el.tabs.addEventListener('click', (event) => {
    const button = event.target.closest('.tab');
    if (!button) return;
    state.category = button.dataset.category;
    render();
  });

  el.chips.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    const key = chip.dataset.filter;
    if (state.filters.has(key)) state.filters.delete(key);
    else state.filters.add(key);
    render();
  });

  const resetAll = () => {
    state.query = '';
    state.category = 'all';
    state.filters = new Set();
    state.sort = 'stars';
    render();
    el.q.focus();
  };
  el.reset.addEventListener('click', resetAll);
  el.resetEmpty.addEventListener('click', resetAll);

  el.themeToggle.addEventListener('click', () => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });

  el.grid.addEventListener('click', (event) => {
    const card = event.target.closest('.card');
    if (card) openDetail(card.dataset.repo);
  });

  el.grid.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('.card');
    if (!card) return;
    event.preventDefault();
    openDetail(card.dataset.repo);
  });

  el.detail.addEventListener('click', (event) => {
    if (event.target === el.detail) el.detail.close();
    if (event.target.closest('[data-close]')) el.detail.close();
  });

  el.detail.addEventListener('close', () => {
    el.detailInner.innerHTML = '';
  });

  window.addEventListener('hashchange', () => {
    readHash();
    render();
  });
}

/* ── 시작 ──────────────────────────────────────── */
function renderHeroStats() {
  const korean = state.repos.filter((repo) => repo.koreanDocs).length;
  const commercial = state.repos.filter((repo) => repo.commercialUse).length;
  const docker = state.repos.filter((repo) => repo.docker).length;
  const metrics = [
    { value: state.repos.length, label: 'REPOS', note: '국산 저장소' },
    { value: korean, label: 'KOREAN DOCS', note: '한국어 문서' },
    { value: commercial, label: 'COMMERCIAL', note: '상업 무료 라이선스' },
    { value: docker, label: 'DOCKER', note: 'Dockerfile 확인' },
  ];
  el.heroStats.innerHTML = metrics
    .map(
      (metric) => `<div class="metric" role="group" aria-label="${escapeHtml(
        `${metric.note} ${metric.value}개`,
      )}">
        <span class="metric-value">${metric.value}</span>
        <span class="metric-label">${metric.label}</span>
        <span class="metric-note">${metric.note}</span>
      </div>`,
    )
    .join('');
}

async function init() {
  applyTheme(currentTheme(), { persist: false });
  el.reportLink.href = issueUrl('[제보] 새 저장소 추가');
  readHash();
  buildTabs();
  bindEvents();
  try {
    const response = await fetch('./data/catalog.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const catalog = await response.json();
    state.repos = Array.isArray(catalog.repos) ? catalog.repos : [];
    state.generatedAt = catalog.generatedAt ?? null;
    if (state.repos.length === 0) throw new Error('빈 카탈로그');
    el.updated.textContent = `데이터 ${formatDate(catalog.generatedAt)} 갱신`;
    renderHeroStats();
    render();
  } catch (error) {
    el.updated.textContent = '데이터 갱신 정보 없음';
    el.loadError.hidden = false;
    el.count.textContent = '';
    console.error('카탈로그 로드 실패', error);
  }
}

init();
