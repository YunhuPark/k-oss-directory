import {
  FILTERS,
  SORTS,
  PAGE_SIZE,
  selectRepos,
  pageCount,
  remainingCount,
  nextVisibleCount,
  formatStars,
  formatDate,
} from './lib/filter.mjs';

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
  filterOpen: false,
  // 지금까지 펼친 카드 수. 조건이 바뀌면 PAGE_SIZE로 돌아간다.
  visible: PAGE_SIZE,
  signature: '',
};

const el = {
  q: document.getElementById('q'),
  sort: document.getElementById('sort'),
  tabs: document.getElementById('tabs'),
  chips: document.getElementById('chips'),
  filterToggle: document.getElementById('filter-toggle'),
  filterPanel: document.getElementById('filter-panel'),
  filterCount: document.getElementById('filter-count'),
  count: document.getElementById('count'),
  statusRow: document.querySelector('.status-row'),
  reset: document.getElementById('reset'),
  resetEmpty: document.getElementById('reset-empty'),
  grid: document.getElementById('grid'),
  more: document.getElementById('load-more'),
  moreWrap: document.getElementById('load-more-wrap'),
  empty: document.getElementById('empty'),
  loadError: document.getElementById('load-error'),
  updated: document.getElementById('updated'),
  stats: document.getElementById('catalog-stats'),
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
  if (el.themeColor) el.themeColor.setAttribute('content', next === 'dark' ? '#0d0e10' : '#f4f5f7');
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
  // 조건이 없을 때는 푸터의 수록 현황과 같은 "93개 표시"를 반복하지 않는다.
  el.statusRow.hidden = !hasCondition;
  syncFilterBadge();
  revealActiveTab();
  updateTabFade();
}

/* ── 세부 필터 접기/펼치기 ────────────────────────── */
function setFilterOpen(open) {
  state.filterOpen = Boolean(open);
  el.filterPanel.hidden = !state.filterOpen;
  el.filterToggle.setAttribute('aria-expanded', String(state.filterOpen));
  el.filterToggle.classList.toggle('is-open', state.filterOpen);
}

function syncFilterBadge() {
  const count = state.filters.size;
  el.filterCount.textContent = count > 0 ? String(count) : '';
  el.filterCount.hidden = count === 0;
  el.filterToggle.classList.toggle('has-filters', count > 0);
  const label = count > 0 ? `세부 필터, ${count}개 선택됨` : '세부 필터 열기';
  el.filterToggle.setAttribute('aria-label', label);
  el.filterToggle.setAttribute('title', label);
}

/** 가로 스크롤이 남았는지에 따라 카테고리 칩 좌우 페이드를 켜고 끈다. */
function updateTabFade() {
  const node = el.tabs;
  const max = node.scrollWidth - node.clientWidth;
  node.dataset.fadeStart = String(node.scrollLeft > 2);
  node.dataset.fadeEnd = String(node.scrollLeft < max - 2);
}

/** 선택된 카테고리 칩이 잘려 보이지 않도록 스크롤 위치를 맞춘다. */
function revealActiveTab() {
  const button = el.tabs.querySelector('.tab[aria-pressed="true"]');
  if (!button) return;
  const box = el.tabs.getBoundingClientRect();
  const chip = button.getBoundingClientRect();
  if (chip.left < box.left + 2) {
    el.tabs.scrollLeft -= box.left - chip.left + 14;
  } else if (chip.right > box.right - 2) {
    el.tabs.scrollLeft += chip.right - box.right + 14;
  }
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

/** 32px GitHub 아바타. 이미지가 실패하면 아래 이니셜 타일이 그대로 보인다. */
function logoTile(repo, extraClass = '') {
  const initials = String(repo.owner || repo.vendor || repo.name || '?').slice(0, 1);
  const src = `https://github.com/${encodeURIComponent(repo.owner || '')}.png?size=64`;
  return `<span class="card-logo ${extraClass}" aria-hidden="true">
      <span class="card-logo-init">${escapeHtml(initials)}</span>
      <img src="${src}" alt="" width="32" height="32" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()" />
    </span>`;
}

function cardHtml(repo) {
  // 만든 곳과 GitHub 계정이 같으면(글로벌 개인·조직 저장소) 한 번만 보여 준다.
  const sourceLine =
    repo.vendor && String(repo.vendor).toLowerCase() !== String(repo.owner).toLowerCase()
      ? `${repo.vendor} · ${repo.owner}`
      : repo.owner || repo.vendor;

  const meta = [
    ['LICENSE', repo.license ?? '미지정'],
    ['UPDATED', repo.pushedAt ? formatDate(repo.pushedAt) : '—'],
    ['LANG', repo.language ?? '—'],
  ]
    .map(([term, value]) => `<div><dt>${term}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join('');

  return `<article class="card" role="button" tabindex="0" data-repo="${escapeHtml(repo.repo)}" aria-label="${escapeHtml(
    `${repo.repo} 상세 보기`,
  )}">
      <div class="card-top">
        ${logoTile(repo)}
        <div class="card-heading">
          <h3 class="card-title">${escapeHtml(repo.name)}</h3>
          <p class="card-vendor">${escapeHtml(sourceLine)}</p>
        </div>
        <span class="card-stars" title="GitHub 스타">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.6l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.4l-3.8 2 .7-4.3-3.1-3 4.3-.6z"/></svg>
          ${formatStars(repo.stars)}
        </span>
      </div>
      <p class="card-summary">${escapeHtml(repo.summary)}</p>
      <div class="badges">${cardBadges(repo)}</div>
      <dl class="card-meta">${meta}</dl>
    </article>`;
}

function render() {
  // 조건이 바뀌면 처음 24개부터 다시 보여 준다(정렬 포함).
  const signature = JSON.stringify([state.query, state.category, [...state.filters].sort(), state.sort]);
  if (signature !== state.signature) {
    state.signature = signature;
    state.visible = PAGE_SIZE;
  }

  const visible = selectRepos(state.repos, {
    query: state.query,
    category: state.category,
    filters: [...state.filters],
    sort: state.sort,
  });

  // 24개씩만 그리고, 남은 카드는 '더 보기' 버튼으로 이어 붙인다.
  const shown = visible.slice(0, pageCount(visible.length, state.visible));
  const remaining = remainingCount(visible.length, state.visible);

  el.grid.innerHTML = shown.map((repo) => cardHtml(repo)).join('');
  el.grid.hidden = visible.length === 0;
  el.empty.hidden = visible.length !== 0;

  el.more.hidden = remaining === 0;
  if (remaining > 0) {
    el.more.textContent = `더 보기 (${remaining}개 남음)`;
    el.more.setAttribute('aria-label', `더 보기, ${remaining}개 남음`);
  } else {
    el.more.textContent = '';
  }

  const parts = [`<b>${shown.length}</b>개 표시`];
  if (visible.length !== state.repos.length) parts.push(`조건에 맞는 ${visible.length}개`);
  else parts.push(`전체 ${state.repos.length}개`);
  el.count.innerHTML = parts.join(' · ');

  syncControls();
  writeHash();
}

/* ── 상세 모달 ──────────────────────────────────── */
function judgment(repo) {
  const commercialOn = Boolean(repo.commercialUse);
  const commercialTitle = !commercialOn
    ? '라이선스 미지정 또는 비상업 라이선스 — 원문 확인 필요'
    : repo.licenseSource === 'github'
      ? 'GitHub API로 라이선스 실측'
      : repo.licenseSource === 'curated'
        ? 'LICENSE 원문을 직접 확인한 값'
        : '라이선스 정보 없음';

  const koreanTitle = !repo.koreanDocs
    ? '한국어 문서 없음(영어 문서)'
    : repo.koreanDocsSource === 'curated'
      ? '한국어 문서를 직접 확인'
      : '한국어 README 또는 README.ko.md 확인';

  const dockerTitle = !repo.docker
    ? '루트에 Dockerfile 없음'
    : repo.dockerSource === 'curated'
      ? 'Dockerfile 직접 확인'
      : '루트 Dockerfile 또는 docker 토픽 확인';

  const chip = (kind, label, on, title) =>
    `<span class="judgment" data-kind="${kind}" data-state="${on ? 'on' : 'off'}" title="${escapeHtml(title)}">${escapeHtml(
      label,
    )}</span>`;

  return [
    chip('commercial', '상업 무료', commercialOn, commercialTitle),
    chip('korean', repo.koreanDocs ? '한국어 문서' : '한국어 문서 없음', Boolean(repo.koreanDocs), koreanTitle),
    chip('docker', repo.docker ? 'Docker' : 'Docker 없음', Boolean(repo.docker), dockerTitle),
    repo.archived ? `<span class="judgment" data-kind="archived">보관됨</span>` : '',
  ]
    .filter(Boolean)
    .join('');
}

function detailHtml(repo) {
  const now = state.generatedAt ? new Date(state.generatedAt) : new Date();
  const cloneCommand = `git clone https://github.com/${repo.repo}.git`;

  const stats = [
    ['STARS', formatStars(repo.stars)],
    ['OPEN ISSUES', repo.openIssues === null || repo.openIssues === undefined ? '—' : String(repo.openIssues)],
    ['LICENSE', repo.license ?? '미지정'],
    ['LAST PUSH', repo.pushedAt ? formatDate(repo.pushedAt) : '정보 없음'],
    ['LANG', repo.language ?? '—'],
    ['BRANCH', repo.defaultBranch ?? '—'],
  ];

  return `<div class="detail-head">
      ${logoTile(repo, 'detail-logo')}
      <div class="detail-heading">
        <p class="detail-vendor">${escapeHtml(repo.vendor)} · ${escapeHtml(
          CATEGORY_LABELS[repo.category] ?? repo.category,
        )}</p>
        <h2 class="detail-title" id="detail-title">${escapeHtml(repo.repo)}</h2>
      </div>
      <button class="detail-close" type="button" data-close aria-label="닫기">✕</button>
    </div>
    <div class="detail-body">
      <p class="detail-summary">${escapeHtml(repo.summary)}</p>
      <div class="judgments" aria-label="핵심 판정">${judgment(repo)}</div>
      <dl class="spec-grid">
        ${stats.map(([term, value]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}
      </dl>
      <section class="quickstart" aria-label="빠른 시작">
        <p class="block-label">QUICK START</p>
        <div class="copy-row">
          <code>${escapeHtml(cloneCommand).replaceAll('/', '/<wbr>')}</code>
          <button class="copy-button" type="button" data-copy="${escapeHtml(cloneCommand)}">복사</button>
        </div>
        <p class="quickstart-note">
          설치·사용법은 저장소 README를 따르세요. 마지막 푸시 ${
            repo.pushedAt ? `${formatDate(repo.pushedAt)}(으)로` : '기록 없음 ·'
          } 최근 3개월 내 변경${repo.recent ? '이 있습니다' : '은 확인되지 않았습니다'}.
        </p>
      </section>
      ${
        repo.archived
          ? '<p class="detail-foot-note">이 저장소는 GitHub에서 보관(archived) 상태입니다. 새 프로젝트에는 대체 라이브러리를 권장합니다.</p>'
          : ''
      }
      <p class="detail-foot-note">
        <span>라이선스 판정은 참고용입니다. 사용 전 LICENSE 원문을 확인하세요. · ${escapeHtml(
          `${formatDate(repo.pushedAt ?? new Date(now).toISOString())} 기준`,
        )}</span>
        <a href="${escapeHtml(issueUrl(`[제보] ${repo.repo} 정보 수정`))}" target="_blank" rel="noreferrer noopener">정보가 틀렸어요 ↗</a>
      </p>
    </div>
    <div class="detail-actions">
      <a class="button button-primary" href="${escapeHtml(repo.url)}" target="_blank" rel="noreferrer noopener">GitHub 열기 ↗</a>
      ${
        repo.homepage
          ? `<a class="button" href="${escapeHtml(repo.homepage)}" target="_blank" rel="noreferrer noopener">문서 보기 ↗</a>`
          : ''
      }
    </div>`;
}

function openDetail(repoName) {
  const repo = state.repos.find((item) => item.repo === repoName);
  if (!repo) return;
  el.detailInner.innerHTML = detailHtml(repo);
  el.detail.showModal();
  el.detailInner.querySelector('[data-close]')?.focus();
}

async function copyCommand(button) {
  const command = button.dataset.copy ?? '';
  const legacyCopy = () => {
    const area = document.createElement('textarea');
    area.value = command;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  };

  try {
    let done = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(command);
        done = true;
      } catch (error) {
        /* 권한·포커스가 없으면 아래 예비 방법으로 넘어간다 */
      }
    }
    if (!done && !legacyCopy()) throw new Error('clipboard unavailable');
    button.dataset.copied = 'true';
    button.textContent = '복사됨';
    setTimeout(() => {
      button.dataset.copied = 'false';
      button.textContent = '복사';
    }, 1600);
  } catch (error) {
    button.textContent = '복사 실패';
    setTimeout(() => {
      button.textContent = '복사';
    }, 1600);
  }
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

  el.tabs.addEventListener('scroll', updateTabFade, { passive: true });
  window.addEventListener('resize', updateTabFade);

  el.filterToggle.addEventListener('click', () => {
    setFilterOpen(!state.filterOpen);
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

  // '더 보기': 한 번에 PAGE_SIZE씩 추가로 그린다.
  el.more.addEventListener('click', () => {
    state.visible = nextVisibleCount(state.visible);
    render();
    el.more.focus({ preventScroll: true });
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
    const copyButton = event.target.closest('[data-copy]');
    if (copyButton) copyCommand(copyButton);
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
/** 첫 화면에서 뺀 수록 현황은 푸터 한 줄로만 남긴다. */
function renderCatalogStats() {
  const korean = state.repos.filter((repo) => repo.koreanDocs).length;
  const commercial = state.repos.filter((repo) => repo.commercialUse).length;
  const docker = state.repos.filter((repo) => repo.docker).length;
  el.stats.innerHTML = [
    `<b>${state.repos.length}</b>개 저장소`,
    `한국어 문서 <b>${korean}</b>`,
    `상업 무료 <b>${commercial}</b>`,
    `Docker <b>${docker}</b>`,
  ].join(' · ');
}

async function init() {
  applyTheme(currentTheme(), { persist: false });
  el.reportLink.href = issueUrl('[제보] 새 저장소 추가');
  readHash();
  // 공유된 링크에 필터가 걸려 있으면 왜 결과가 좁은지 보이도록 패널을 펼친다.
  setFilterOpen(state.filters.size > 0);
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
    renderCatalogStats();
    render();
  } catch (error) {
    el.updated.textContent = '데이터 갱신 정보 없음';
    el.loadError.hidden = false;
    el.count.textContent = '';
    console.error('카탈로그 로드 실패', error);
  }
}

init();
