import { FILTERS, SORTS, selectRepos, formatStars, formatRelativeDate, formatDate } from './lib/filter.mjs';

const REPO_URL = 'https://github.com/YunhuPark/k-oss-directory';
const ISSUE_NEW = `${REPO_URL}/issues/new`;

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

function badge(label, kind) {
  return `<span class="badge${kind ? ` badge-${kind}` : ''}">${escapeHtml(label)}</span>`;
}

function cardHtml(repo, now) {
  const badges = [
    repo.commercialUse ? badge(repo.license ?? '상업 무료') : badge(repo.license ?? '라이선스 미지정'),
    repo.koreanDocs ? badge('한국어 문서', 'korean') : '',
    repo.docker ? badge('Docker', 'docker') : '',
    repo.archived ? badge('보관됨', 'archived') : '',
  ]
    .filter(Boolean)
    .join('');

  const meta = [
    `<span class="star">${formatStars(repo.stars)}</span>`,
    repo.pushedAt ? `<span>${formatRelativeDate(repo.pushedAt, now)} 업데이트</span>` : '<span>업데이트 정보 없음</span>',
    repo.language ? `<span>${escapeHtml(repo.language)}</span>` : '',
  ]
    .filter(Boolean)
    .join('');

  return `<article class="card" role="button" tabindex="0" data-repo="${escapeHtml(repo.repo)}" aria-label="${escapeHtml(
    `${repo.repo} 상세 보기`,
  )}">
      <div class="card-top">
        <h3 class="card-title">${escapeHtml(repo.name)}</h3>
        <span class="card-vendor">${escapeHtml(repo.vendor)}</span>
      </div>
      <p class="card-summary">${escapeHtml(repo.summary)}</p>
      <div class="badges">${badges}</div>
      <div class="card-meta">${meta}</div>
    </article>`;
}

function render() {
  const now = state.generatedAt ? new Date(state.generatedAt) : new Date();
  const visible = selectRepos(state.repos, {
    query: state.query,
    category: state.category,
    filters: [...state.filters],
    sort: state.sort,
  });

  el.grid.innerHTML = visible.map((repo) => cardHtml(repo, now)).join('');
  el.empty.hidden = visible.length !== 0;
  el.grid.hidden = visible.length === 0;

  const parts = [`<b>${visible.length}</b>개 표시`];
  if (visible.length !== state.repos.length) parts.push(`전체 ${state.repos.length}개`);
  el.count.innerHTML = parts.join(' · ');

  syncControls();
  writeHash();
}

/* ── 상세 모달 ──────────────────────────────────── */
function detailHtml(repo) {
  const now = state.generatedAt ? new Date(state.generatedAt) : new Date();
  const tags = (repo.tags ?? [])
    .map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`)
    .join('');

  const stats = [
    ['스타', formatStars(repo.stars)],
    ['오픈 이슈', repo.openIssues === null ? '—' : String(repo.openIssues)],
    ['라이선스', repo.license ?? '미지정'],
    ['최근 푸시', repo.pushedAt ? `${formatDate(repo.pushedAt)} (${formatRelativeDate(repo.pushedAt, now)})` : '정보 없음'],
    ['언어', repo.language ?? '—'],
    ['기본 브랜치', repo.defaultBranch ?? '—'],
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
    <div class="badges" style="margin-top:12px">
      ${repo.koreanDocs ? badge('한국어 문서', 'korean') : ''}
      ${repo.commercialUse ? badge('상업 무료', 'korean') : badge('상업 사용 주의')}
      ${repo.docker ? badge('Docker', 'docker') : ''}
      ${repo.recent ? badge('최근 3개월 업데이트', 'korean') : ''}
      ${repo.archived ? badge('보관된 저장소', 'archived') : ''}
      ${tags}
    </div>
    ${repo.archived ? '<p class="detail-note">이 저장소는 GitHub에서 보관(archived) 상태입니다. 새 프로젝트에는 대체 라이브러리를 권장합니다.</p>' : ''}
    ${
      repo.koreanDocs
        ? `<p class="detail-note">한국어 문서: ${repo.koreanDocsSource === 'readme' ? 'README에 한국어 설명이 포함되어 있습니다.' : '직접 확인한 한국어 문서가 있습니다.'}</p>`
        : '<p class="detail-note">한국어 문서가 확인되지 않았습니다. 문서는 영어일 수 있습니다.</p>'
    }
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
  const items = [
    `저장소 <b>${state.repos.length}</b>개`,
    `한국어 문서 <b>${korean}</b>`,
    `상업 무료 <b>${commercial}</b>`,
    `Docker <b>${docker}</b>`,
  ];
  el.heroStats.innerHTML = items.map((item) => `<li>${item}</li>`).join('');
}

async function init() {
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
