#!/usr/bin/env node
/**
 * 헤드리스 브라우저 검증: 360px / 1280px에서
 *  - 카드 수·검색·필터·정렬·모달이 catalog.json과 일치하는지
 *  - 첫 화면 상단에 숫자판·사용법 안내 줄이 없고, 수록 현황은 푸터 한 줄인지
 *  - 헤더→제목→검색→카드 사이 여백과 카드 간격이 충분한지
 *  - 가로 넘침 0 (scrollWidth <= clientWidth)
 *  - 다크 모드 토글·localStorage 저장·새로고침 유지
 *  - 상세 모달 하단 버튼이 뷰포트 안에 완전히 보이는지(모바일 잘림 회귀 방지)
 *  - Pretendard 적용·라이트/다크 본문 대비 4.5:1 이상·원문 설명 미노출
 *  - 콘솔 오류 0, 접근성 기본 점검
 * 스크린샷을 --out(기본 downloads/k-oss-mvp)에 저장한다.
 *
 *   PUPPETEER_PATH=/path/to/node_modules/puppeteer node scripts/ui_check.mjs --out /workspace/downloads/k-oss-mvp
 */
import { createRequire } from 'node:module';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from './serve.mjs';
import { PAGE_SIZE, formatDate, formatStars, hasMcpSkill, selectRepos } from '../public/lib/filter.mjs';

const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv.indexOf('--out');
const OUT_DIR = path.resolve(outArg > -1 ? process.argv[outArg + 1] : 'downloads/k-oss-mvp');

const VIEWPORTS = [
  { name: '360', width: 360, height: 800, deviceScaleFactor: 2 },
  { name: '1280', width: 1280, height: 900, deviceScaleFactor: 2 },
];

const results = [];

/** 큰 화면 캡처가 메모리 한도에 걸리면 배율을 낮춰 한 번 더 시도한다. */
async function screenshot(page, file, viewport, options = {}) {
  try {
    await page.screenshot({ path: file, ...options });
  } catch (error) {
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
    await page.screenshot({ path: file, ...options });
    await page.setViewport(viewport);
  }
}

/** 전체 페이지 캡처: 카드가 많아 문서가 20,000px를 넘으면 배율 2에서는 렌더러가 죽는다. */
async function fullScreenshot(page, file, viewport) {
  await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
  await screenshot(page, file, { ...viewport, deviceScaleFactor: 1 }, { fullPage: true, captureBeyondViewport: false });
  await page.setViewport(viewport);
}
function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

/** 색·패널 전환 애니메이션이 끝난 뒤에 캐처한다. */
function settle(page, ms = 260) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 열려 있는 상세 모달의 글자 대비를 실제 색으로 계산한다(투명 배경은 부모 색을 따라간다). */
function dialogContrast(page) {
  return page.evaluate(() => {
    const parse = (value) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const alphaOf = (value) => {
      const parts = (value.match(/[\d.]+/g) ?? []).map(Number);
      return parts.length > 3 ? parts[3] : 1;
    };
    const luminance = (rgb) => {
      const [r, g, b] = rgb.map((channel) => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (foreground, background) => {
      const a = luminance(parse(foreground));
      const b = luminance(parse(background));
      return Number(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2));
    };
    const effectiveBg = (node) => {
      let current = node;
      while (current) {
        const bg = getComputedStyle(current).backgroundColor;
        if (alphaOf(bg) > 0.01) return bg;
        current = current.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    const read = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const style = getComputedStyle(node);
      const bg = effectiveBg(node);
      return { ratio: ratio(style.color, bg), color: style.color, bg };
    };
    return {
      title: read('dialog[open] .detail-title'),
      summary: read('dialog[open] .detail-summary'),
      note: read('dialog[open] .quickstart-note'),
      specTerm: read('dialog[open] .spec-grid dt'),
      specValue: read('dialog[open] .spec-grid dd'),
      mcpBadge: read('dialog[open] .judgment[data-kind="mcp"]'),
      primary: read('dialog[open] .detail-actions .button-primary'),
      secondary: read('dialog[open] .detail-actions .button:not(.button-primary)'),
      footNote: read('dialog[open] .detail-foot-note span'),
    };
  });
}

/** 열려 있는 상세 모달이 화면 밖으로 잘리거나 글자가 잘리지 않는지 본다. */
function dialogClip(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]');
    const box = dialog.getBoundingClientRect();
    const body = dialog.querySelector('.detail-body');
    const actions = dialog.querySelector('.detail-actions');
    const clippedLabels = [...dialog.querySelectorAll('.judgment, .detail-actions .button, .spec-grid dd')]
      .filter((node) => node.scrollWidth > node.clientWidth + 1)
      .map((node) => node.textContent.trim());
    const boxOf = (node) => {
      const rect = node.getBoundingClientRect();
      return { label: node.textContent.trim(), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    };
    const badges = [...dialog.querySelectorAll('.judgments > *')].map(boxOf);
    const buttons = [...actions.querySelectorAll('.button')].map(boxOf);
    return {
      dialogInside: box.left >= -0.5 && box.right <= window.innerWidth + 0.5 && box.top >= -0.5 && box.bottom <= window.innerHeight + 0.5,
      bodyNoHScroll: body.scrollWidth <= body.clientWidth + 1,
      shellNoHScroll: dialog.querySelector('.detail-shell').scrollWidth <= dialog.querySelector('.detail-shell').clientWidth + 1,
      clippedLabels,
      badgesInside: badges.every(
        (badge) => badge.left >= box.left - 1 && badge.right <= box.right + 1 && badge.top >= box.top - 1 && badge.bottom <= box.bottom + 1,
      ),
      buttonsInside: buttons.every(
        (button) =>
          button.left >= box.left - 1 &&
          button.right <= box.right + 1 &&
          button.bottom <= box.bottom + 1 &&
          button.bottom <= window.innerHeight + 0.5,
      ),
      buttons,
    };
  });
}

/** 화면에 그려져야 하는 카드 이름 목록(카탈로그 기준 기대값) */
function expectedNames(repos, options) {
  return selectRepos(repos, options).map((repo) => repo.name);
}

/** 첫 화면에 보이는 카드 수: 24개씩 '더 보기'로 늘어난다. */
const firstPage = (names) => names.slice(0, PAGE_SIZE);
const firstPageCount = (count) => Math.min(count, PAGE_SIZE);

/** 세부 필터는 기본적으로 접혀 있다. 칩을 누르기 전에 패널을 펼친다. */
async function openFilters(page) {
  const expanded = await page.$eval('#filter-toggle', (node) => node.getAttribute('aria-expanded'));
  if (expanded !== 'true') {
    await page.click('#filter-toggle');
    await page.waitForFunction(() => !document.getElementById('filter-panel').hidden);
  }
}

async function closeFilters(page) {
  const expanded = await page.$eval('#filter-toggle', (node) => node.getAttribute('aria-expanded'));
  if (expanded === 'true') {
    await page.click('#filter-toggle');
    await page.waitForFunction(() => document.getElementById('filter-panel').hidden);
  }
}

/** 정렬은 커스텀 드롭다운이다: 버튼을 눌러 열고, 항목을 눌러 고른다. */
const sortValue = (page) => page.$eval('#sort', (node) => node.dataset.value);

async function openSort(page) {
  const expanded = await page.$eval('#sort', (node) => node.getAttribute('aria-expanded'));
  if (expanded !== 'true') {
    await page.click('#sort');
    await page.waitForFunction(() => !document.getElementById('sort-menu').hidden);
  }
}

async function chooseSort(page, key) {
  await openSort(page);
  await page.click(`.sort-option[data-sort="${key}"]`);
  await page.waitForFunction(() => document.getElementById('sort').getAttribute('aria-expanded') === 'false');
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const catalog = JSON.parse(await readFile(path.join(ROOT, 'public/data/catalog.json'), 'utf8'));
  const repos = catalog.repos;
  const total = repos.length;
  const dockerCount = repos.filter((repo) => repo.docker).length;
  const commercialKorean = repos.filter((repo) => repo.commercialUse && repo.koreanDocs).length;
  const koreanCount = repos.filter((repo) => repo.koreanDocs).length;
  const commercialCount = repos.filter((repo) => repo.commercialUse).length;
  const mcpCount = repos.filter((repo) => hasMcpSkill(repo)).length;
  const mcpKoreanCount = repos.filter((repo) => hasMcpSkill(repo) && repo.koreanDocs).length;
  const chartHits = expectedNames(repos, { query: '차트' });
  const updatedFirst = expectedNames(repos, { sort: 'updated' })[0];
  const starsFirst = expectedNames(repos, { sort: 'stars' })[0];
  const nameFirst = expectedNames(repos, { sort: 'name' })[0];
  const frontendNames = expectedNames(repos, { category: 'frontend' });

  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });
  // 빠른 시작 '복사' 버튼을 실제 클립보드 권한으로 검증한다.
  await browser.defaultBrowserContext().overridePermissions(base, ['clipboard-read', 'clipboard-write']);

  try {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport(viewport);
      const consoleErrors = [];
      const imageFailures = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('requestfailed', (request) => {
        if (request.resourceType() === 'image') imageFailures.push(`${request.url()} ${request.failure()?.errorText ?? ''}`);
      });
      page.on('pageerror', (error) => consoleErrors.push(String(error)));

      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.card');

      // 앞선 뷰포트 검사에서 남은 테마가 있으면 라이트로 되돌린다.
      if ((await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark') {
        await page.click('#theme-toggle');
        await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light');
      }

      const cards = await page.$$eval('.card', (nodes) => nodes.length);
      const rendered = firstPageCount(total);
      check(
        `[${viewport.name}] 첫 화면 카드 ${rendered}개만 렌더(총 ${total}개)`,
        cards === rendered,
        `${cards}개`,
      );
      const moreState = await page.evaluate(() => {
        const button = document.getElementById('load-more');
        return {
          hidden: button.hidden,
          text: button.textContent.trim(),
          label: button.getAttribute('aria-label') ?? '',
          height: Math.round(button.getBoundingClientRect().height),
          afterGrid: button.getBoundingClientRect().top >= document.getElementById('grid').getBoundingClientRect().top,
        };
      });
      check(
        `[${viewport.name}] 더 보기 버튼 문구·위치`,
        !moreState.hidden &&
          moreState.text === `더 보기 (${total - rendered}개 남음)` &&
          /남음/.test(moreState.label) &&
          moreState.height >= 32 &&
          moreState.afterGrid,
        `"${moreState.text}" · ${moreState.height}px · 목록 아래 ${moreState.afterGrid}`,
      );

      const logos = await page.evaluate(() => ({
        tiles: document.querySelectorAll('.card .card-logo').length,
        avatars: document.querySelectorAll('.card .card-logo img').length,
        initials: document.querySelectorAll('.card .card-logo-init').length,
      }));
      check(
        `[${viewport.name}] 카드 아바타 32px + 이니셜 폴백`,
        logos.tiles === rendered && logos.avatars === rendered && logos.initials === rendered,
        `타일 ${logos.tiles} · 이미지 ${logos.avatars} · 이니셜 ${logos.initials}`,
      );

      // 아바타가 실제로 그려지는지: 숨은 <img>만 남고 src가 비면 이니셜(S·M·O)만 보인다(회귀 방지).
      const countAvatars = () =>
        page.evaluate(() => {
          const inView = (node) => {
            const box = node.getBoundingClientRect();
            return box.width > 0 && box.bottom > 0 && box.top < window.innerHeight;
          };
          const tiles = [...document.querySelectorAll('.card .card-logo')].filter(inView);
          const images = tiles.map((tile) => tile.querySelector('img')).filter(Boolean);
          return {
            inView: tiles.length,
            images: images.length,
            loaded: images.filter((image) => image.complete && image.naturalWidth > 0 && !image.hidden).length,
            withSrc: [...document.querySelectorAll('.card .card-logo img')].filter((image) => image.getAttribute('src')).length,
          };
        });
      await page
        .waitForFunction(
          () => {
            const inView = (node) => {
              const box = node.getBoundingClientRect();
              return box.width > 0 && box.bottom > 0 && box.top < window.innerHeight;
            };
            const images = [...document.querySelectorAll('.card .card-logo')]
              .filter(inView)
              .map((tile) => tile.querySelector('img'))
              .filter(Boolean);
            if (images.length === 0) return false;
            const ready = images.filter((image) => image.complete && image.naturalWidth > 0);
            return ready.length >= Math.ceil(images.length * 0.8);
          },
          { timeout: 20000 },
        )
        .catch(() => null);
      const avatars = await countAvatars();
      check(
        `[${viewport.name}] 첫 화면 보이는 아바타 실제 로드`,
        avatars.inView > 0 && avatars.loaded >= Math.ceil(avatars.images * 0.8),
        `화면 안 타일 ${avatars.inView} · 로드 ${avatars.loaded}/${avatars.images} · src ${avatars.withSrc}개`,
      );

      // 스크롤로 새로 나타난 카드도 아바타가 따라 붙는다(지연 로딩 경로).
      const srcBeforeScroll = avatars.withSrc;
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await page
        .waitForFunction(
          (before) =>
            [...document.querySelectorAll('.card .card-logo img')].filter((image) => image.getAttribute('src')).length > before,
          { timeout: 15000 },
          srcBeforeScroll,
        )
        .catch(() => null);
      await settle(page, 600);
      const scrolled = await countAvatars();
      check(
        `[${viewport.name}] 스크롤한 카드 아바타도 로드`,
        scrolled.withSrc > srcBeforeScroll && scrolled.loaded >= Math.ceil(scrolled.images * 0.8),
        `src ${srcBeforeScroll} → ${scrolled.withSrc}개 · 화면 안 로드 ${scrolled.loaded}/${scrolled.images}`,
      );
      await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
      await page.waitForFunction(() => window.scrollY === 0, { timeout: 5000 }).catch(() => null);
      await settle(page, 150);

      const topBand = await page.evaluate(() => {
        const hero = document.querySelector('.hero');
        // 검색·필터 위(main의 앞쪽 덩어리)에 보이는 글자만 모은다. noscript는 화면에 없다.
        let aboveControls = '';
        for (const node of document.querySelector('main').children) {
          if (node.classList.contains('controls')) break;
          if (node.tagName === 'NOSCRIPT') continue;
          aboveControls += ` ${node.textContent}`;
        }
        return {
          removedNodes: document.querySelectorAll('#hero-stats, .metrics, .metric, .howto-line, .howto-num').length,
          heroText: (hero?.textContent ?? '').replace(/\s+/g, ' ').trim(),
          aboveControls: aboveControls.replace(/\s+/g, ' ').trim(),
        };
      });
      check(
        `[${viewport.name}] 상단 숫자판·안내 줄 제거`,
        topBand.removedNodes === 0 &&
          !/REPOS|KOREAN DOCS|COMMERCIAL|DOCKER/.test(topBand.aboveControls) &&
          !/필터로 좁히고|판정 확인|GitHub 설치/.test(topBand.aboveControls),
        `제거 노드 ${topBand.removedNodes}개 · 검색 위 문구 "${topBand.aboveControls.slice(0, 80)}"`,
      );
      const heroLines = await page.evaluate(() => {
        const h1 = document.querySelector('.hero h1');
        const style = getComputedStyle(h1);
        const lines = Math.round(h1.getBoundingClientRect().height / parseFloat(style.lineHeight));
        return { lines, height: Math.round(h1.getBoundingClientRect().height) };
      });
      check(
        `[${viewport.name}] 제목 2줄 이내`,
        heroLines.lines <= 2,
        `${heroLines.lines}줄 · 높이 ${heroLines.height}px`,
      );

      // 수록 현황은 첫 화면에서 뺀 뒤 푸터에 조용한 한 줄로만 둔다.
      const footerStats = await page.evaluate(() => {
        const node = document.getElementById('catalog-stats');
        if (!node) return null;
        const style = getComputedStyle(node);
        return {
          text: node.textContent.replace(/\s+/g, ' ').trim(),
          fontSize: parseFloat(style.fontSize),
          color: style.color,
          inFooter: Boolean(node.closest('.site-footer')),
          belowGrid: node.getBoundingClientRect().top > document.querySelector('.grid').getBoundingClientRect().bottom,
        };
      });
      const expectedStats = `${total}개 저장소 · 한국어 문서 ${koreanCount} · 상업 무료 ${commercialCount} · Docker ${dockerCount}`;
      check(
        `[${viewport.name}] 수록 현황은 푸터 한 줄`,
        footerStats?.inFooter && footerStats.belowGrid && footerStats.text === expectedStats && footerStats.fontSize <= 13.5,
        `"${footerStats?.text}" · ${footerStats?.fontSize}px · 푸터 ${footerStats?.inFooter}`,
      );

      // 여백: 헤더→제목→검색→카드 사이, 카드와 카드 사이, 카드 내부
      const spacing = await page.evaluate(() => {
        const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect();
        const header = rect('.site-header');
        const hero = rect('.hero');
        const h1 = rect('.hero h1');
        const search = rect('.search');
        const controls = rect('.controls');
        const cards = [...document.querySelectorAll('.card')].map((node) => node.getBoundingClientRect());
        const card = cards[0];
        const top = rect('.card .card-top');
        const summary = rect('.card .card-summary');
        const badges = rect('.card .badges');
        const meta = rect('.card .card-meta');
        const cardStyle = getComputedStyle(document.querySelector('.card'));
        return {
          headerToTitle: Math.round(h1.top - header.bottom),
          titleToSearch: Math.round(search.top - h1.bottom),
          tabsToCards: Math.round(card.top - controls.bottom),
          cardGap: parseFloat(getComputedStyle(document.querySelector('.grid')).rowGap),
          cardPadX: parseFloat(cardStyle.paddingLeft),
          cardInnerGap: parseFloat(cardStyle.rowGap),
          topToSummary: Math.round(summary.top - top.bottom),
          summaryToBadges: Math.round(badges.top - summary.bottom),
          badgesToMeta: Math.round(meta.top - badges.bottom),
        };
      });
      const floor =
        viewport.width < 768
          ? { headerToTitle: 16, titleToSearch: 14, tabsToCards: 16, cardGap: 14, cardPadX: 14, cardInnerGap: 9 }
          : { headerToTitle: 40, titleToSearch: 24, tabsToCards: 22, cardGap: 16, cardPadX: 18, cardInnerGap: 11 };
      const spacingNotes = `헤더→제목 ${spacing.headerToTitle} · 제목→검색 ${spacing.titleToSearch} · 컨트롤→카드 ${spacing.tabsToCards} · 카드 간격 ${spacing.cardGap} · 카드 패딩 ${spacing.cardPadX} · 카드 내부 간격 ${spacing.cardInnerGap}`;
      check(
        `[${viewport.name}] 여백 넉넉함`,
        Object.keys(floor).every((key) => spacing[key] >= floor[key]),
        spacingNotes,
      );
      check(
        `[${viewport.name}] 카드 내부 숨쉬는 간격`,
        spacing.topToSummary >= 9 && spacing.summaryToBadges >= 9 && spacing.badgesToMeta >= 8,
        `제목줄→요약 ${spacing.topToSummary} · 요약→배지 ${spacing.summaryToBadges} · 배지→메타 ${spacing.badgesToMeta}`,
      );

      // 카드 박스 크기 통일: 제목 1줄·요약 2줄·배지 1줄 높이를 고정해 글자 길이와 무관하게 카드 높이가 같다.
      const cardShape = await page.evaluate(() => {
        const round = (value) => Math.round(value * 10) / 10;
        const linePx = (node) => {
          const style = getComputedStyle(node);
          return parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
        };
        return [...document.querySelectorAll('.card')].map((card) => {
          const title = card.querySelector('.card-title');
          const summary = card.querySelector('.card-summary');
          const badges = card.querySelector('.badges');
          const summaryStyle = getComputedStyle(summary);
          return {
            height: round(card.getBoundingClientRect().height),
            titleLine: round(linePx(title)),
            titleHeight: round(title.getBoundingClientRect().height),
            titleWhiteSpace: getComputedStyle(title).whiteSpace,
            summaryLine: round(linePx(summary)),
            summaryHeight: round(summary.getBoundingClientRect().height),
            summaryClamp: summaryStyle.webkitLineClamp,
            badgesHeight: round(badges.getBoundingClientRect().height),
            // 배지가 한 줄에 놓였는지(줄마다 top이 다르면 2줄로 접힌 것)
            badgeRows: new Set([...badges.children].map((badge) => Math.round(badge.getBoundingClientRect().top))).size,
          };
        });
      });
      {
        const heights = cardShape.map((item) => item.height);
        const heightSpread = Math.round((Math.max(...heights) - Math.min(...heights)) * 10) / 10;
        const summariesTwoLines = cardShape.every(
          (item) => Math.abs(item.summaryHeight - item.summaryLine * 2) <= 1 && item.summaryClamp === '2',
        );
        const titlesOneLine = cardShape.every(
          (item) => Math.abs(item.titleHeight - item.titleLine) <= 1 && item.titleWhiteSpace === 'nowrap',
        );
        const badgeRowsFixed = cardShape.every((item) => item.badgesHeight >= 24 && item.badgeRows === 1);
        check(
          `[${viewport.name}] 카드 박스 높이 균일(제목 1줄·요약 2줄·배지 줄 고정)`,
          cardShape.length > 10 && heightSpread <= 1 && summariesTwoLines && titlesOneLine && badgeRowsFixed,
          `카드 ${Math.min(...heights)}~${Math.max(...heights)}px(편차 ${heightSpread}px) · 요약 2줄 ${summariesTwoLines} · 제목 1줄 ${titlesOneLine} · 배지 한 줄 ${badgeRowsFixed}`,
        );
      }

      // 검색 돋보기 아이콘: 감싸는 상자와 입력창의 세로 중심에서 1px 안쪽, 입력창 밖으로 나가지 않아야 한다.
      // (상자가 입력창보다 높아지면 top:50%만으로는 아이콘이 아래로 처진다 — 회귀 방지)
      const searchIcon = await page.evaluate(() => {
        const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
        const icon = rect('.search-icon');
        const input = rect('#q');
        const wrap = rect('.search');
        const center = (box) => box.top + box.height / 2;
        return {
          iconCy: center(icon),
          inputCy: center(input),
          wrapCy: center(wrap),
          iconTop: icon.top,
          iconBottom: icon.bottom,
          inputTop: input.top,
          inputBottom: input.bottom,
          iconLeft: icon.left - wrap.left,
          iconWidth: icon.width,
          inputHeight: input.height,
          wrapHeight: wrap.height,
          controlHeight: rect('#sort').height,
        };
      });
      const iconOffset = Math.max(
        Math.abs(searchIcon.iconCy - searchIcon.inputCy),
        Math.abs(searchIcon.iconCy - searchIcon.wrapCy),
      );
      check(
        `[${viewport.name}] 검색 돋보기 아이콘 세로 중앙 정렬`,
        iconOffset <= 1 &&
          searchIcon.iconTop >= searchIcon.inputTop - 1 &&
          searchIcon.iconBottom <= searchIcon.inputBottom + 1,
        `아이콘 중심 ${searchIcon.iconCy.toFixed(2)} · 입력창 중심 ${searchIcon.inputCy.toFixed(2)} · 상자 중심 ${searchIcon.wrapCy.toFixed(2)} · 오차 ${iconOffset.toFixed(2)}px · 높이 입력창 ${searchIcon.inputHeight}/상자 ${searchIcon.wrapHeight}/정렬 버튼 ${searchIcon.controlHeight} · 아이콘 왼쪽 ${searchIcon.iconLeft}px · ${searchIcon.iconWidth}px`,
      );

      // 검색창·정렬 셀렉트·필터 버튼: 높이를 정확히 같게(오차 1px 이내), 모서리 라운딩도 같게.
      // 모바일 40px / 560px부터 46px. 정렬·필터는 같은 줄에서 위아래로 어긋나지 않아야 한다.
      const sizeMatch = await page.evaluate(() => {
        const box = (selector) => document.querySelector(selector).getBoundingClientRect();
        const radius = (selector) => parseFloat(getComputedStyle(document.querySelector(selector)).borderTopLeftRadius);
        const input = box('#q');
        const select = box('#sort');
        const toggle = box('#filter-toggle');
        return {
          input: { height: input.height, radius: radius('#q'), top: input.top },
          select: { height: select.height, radius: radius('#sort'), top: select.top },
          toggle: { height: toggle.height, radius: radius('#filter-toggle'), top: toggle.top },
          viewportWidth: window.innerWidth,
        };
      });
      const expectedHeight = sizeMatch.viewportWidth < 560 ? 40 : 46;
      const heightSpread =
        Math.max(sizeMatch.input.height, sizeMatch.select.height, sizeMatch.toggle.height) -
        Math.min(sizeMatch.input.height, sizeMatch.select.height, sizeMatch.toggle.height);
      const radiusSpread =
        Math.max(sizeMatch.input.radius, sizeMatch.select.radius, sizeMatch.toggle.radius) -
        Math.min(sizeMatch.input.radius, sizeMatch.select.radius, sizeMatch.toggle.radius);
      check(
        `[${viewport.name}] 검색창·정렬·필터 박스 높이 통일(${expectedHeight}px)`,
        heightSpread <= 1 &&
          [sizeMatch.input.height, sizeMatch.select.height, sizeMatch.toggle.height].every(
            (height) => Math.abs(height - expectedHeight) <= 1,
          ),
        `검색창 ${sizeMatch.input.height} · 정렬 ${sizeMatch.select.height} · 필터 ${sizeMatch.toggle.height} (기대 ${expectedHeight}px · 편차 ${heightSpread}px)`,
      );
      check(
        `[${viewport.name}] 검색창·정렬·필터 모서리·세로 정렬 일치`,
        radiusSpread <= 0.5 && Math.abs(sizeMatch.select.top - sizeMatch.toggle.top) <= 1,
        `라운딩 ${sizeMatch.input.radius}/${sizeMatch.select.radius}/${sizeMatch.toggle.radius} · 정렬·필터 윗변 ${sizeMatch.select.top.toFixed(1)}/${sizeMatch.toggle.top.toFixed(1)}`,
      );

      // 정렬은 네이티브 <select>가 아니라 사이트 토큰으로 만든 커스텀 드롭다운이다.
      const sortClosed = await page.evaluate(() => {
        const trigger = document.getElementById('sort');
        const menu = document.getElementById('sort-menu');
        const style = getComputedStyle(trigger);
        return {
          tag: trigger.tagName,
          nativeSelects: document.querySelectorAll('select').length,
          expanded: trigger.getAttribute('aria-expanded'),
          haspopup: trigger.getAttribute('aria-haspopup'),
          controls: trigger.getAttribute('aria-controls'),
          label: document.getElementById('sort-value')?.textContent.trim(),
          ariaLabel: trigger.getAttribute('aria-label'),
          value: trigger.dataset.value,
          menuHidden: menu.hidden,
          menuHeight: Math.round(menu.getBoundingClientRect().height),
          radius: parseFloat(style.borderTopLeftRadius),
          font: parseFloat(style.fontSize),
        };
      });
      check(
        `[${viewport.name}] 정렬은 커스텀 드롭다운(네이티브 select 없음)`,
        sortClosed.tag === 'BUTTON' &&
          sortClosed.nativeSelects === 0 &&
          sortClosed.expanded === 'false' &&
          sortClosed.haspopup === 'listbox' &&
          sortClosed.controls === 'sort-menu' &&
          sortClosed.label === '스타 많은 순' &&
          sortClosed.ariaLabel === '정렬: 스타 많은 순' &&
          sortClosed.value === 'stars' &&
          sortClosed.menuHidden &&
          sortClosed.menuHeight === 0 &&
          sortClosed.radius === 12 &&
          sortClosed.font >= 13.5,
        `${sortClosed.tag} · select ${sortClosed.nativeSelects}개 · aria-expanded ${sortClosed.expanded} · "${sortClosed.label}" · 메뉴 ${sortClosed.menuHidden ? '닫힘' : '열림'} · radius ${sortClosed.radius} · ${sortClosed.font}px`,
      );

      await openSort(page);
      await settle(page, 240);
      const sortMenu = await page.evaluate(() => {
        const trigger = document.getElementById('sort');
        const menu = document.getElementById('sort-menu');
        const box = menu.getBoundingClientRect();
        const triggerBox = trigger.getBoundingClientRect();
        const options = [...menu.querySelectorAll('.sort-option')];
        const selected = options.filter((option) => option.getAttribute('aria-selected') === 'true');
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return {
          expanded: trigger.getAttribute('aria-expanded'),
          hidden: menu.hidden,
          role: menu.getAttribute('role'),
          radius: parseFloat(getComputedStyle(menu).borderTopLeftRadius),
          background: getComputedStyle(menu).backgroundColor,
          pageBackground: getComputedStyle(document.body).backgroundColor,
          box: { top: Math.round(box.top), left: Math.round(box.left), right: Math.round(box.right), bottom: Math.round(box.bottom) },
          triggerBox: { top: Math.round(triggerBox.top), bottom: Math.round(triggerBox.bottom), right: Math.round(triggerBox.right) },
          options: options.map((option) => ({
            text: option.textContent.trim(),
            role: option.getAttribute('role'),
            selected: option.getAttribute('aria-selected'),
            check: getComputedStyle(option.querySelector('.sort-check')).visibility,
            height: Math.round(option.getBoundingClientRect().height),
            font: parseFloat(getComputedStyle(option).fontSize),
          })),
          focusedText: document.activeElement?.closest('.sort-option')?.textContent.trim() ?? '',
          aboveCards: Boolean(hit?.closest('#sort-menu')),
          selectedBackground: selected[0] ? getComputedStyle(selected[0]).backgroundColor : '',
          plainBackground: options.find((option) => option.getAttribute('aria-selected') === 'false')
            ? getComputedStyle(options.find((option) => option.getAttribute('aria-selected') === 'false')).backgroundColor
            : '',
        };
      });
      check(
        `[${viewport.name}] 정렬 메뉴 열림 — listbox 4개 항목·선택 표시`,
        !sortMenu.hidden &&
          sortMenu.expanded === 'true' &&
          sortMenu.role === 'listbox' &&
          sortMenu.options.length === 4 &&
          sortMenu.options.every(
            (option) =>
              option.role === 'option' &&
              option.height >= 32 &&
              option.font >= 13.5 &&
              ['true', 'false'].includes(option.selected),
          ) &&
          sortMenu.options.filter((option) => option.selected === 'true').length === 1 &&
          sortMenu.options.find((option) => option.selected === 'true').check === 'visible' &&
          sortMenu.options.filter((option) => option.selected === 'false').every((option) => option.check === 'hidden'),
        sortMenu.options.map((option) => `${option.text}(${option.selected === 'true' ? '✓' : ''}${option.check})`).join(' / '),
      );
      check(
        `[${viewport.name}] 정렬 메뉴가 버튼 아래에 떠서 카드 위로 보임`,
        sortMenu.box.top >= sortMenu.triggerBox.bottom + 4 &&
          sortMenu.box.bottom <= viewport.height &&
          sortMenu.box.left >= 0 &&
          sortMenu.box.right <= viewport.width &&
          sortMenu.aboveCards,
        `메뉴 ${sortMenu.box.top}~${sortMenu.box.bottom}px · 버튼 아래 ${sortMenu.box.top - sortMenu.triggerBox.bottom}px · 카드 위 ${sortMenu.aboveCards}`,
      );
      check(
        `[${viewport.name}] 정렬 메뉴 카드 스타일(표면·12px·선택 강조)`,
        sortMenu.radius === 12 &&
          sortMenu.background !== sortMenu.pageBackground &&
          sortMenu.selectedBackground !== sortMenu.plainBackground &&
          sortMenu.focusedText === '스타 많은 순',
        `radius ${sortMenu.radius} · 배경 ${sortMenu.background}/${sortMenu.pageBackground} · 선택 ${sortMenu.selectedBackground} · 포커스 "${sortMenu.focusedText}"`,
      );
      await screenshot(page, path.join(OUT_DIR, `sort-open-${viewport.name}.png`), viewport);

      // 항목을 고르면 상태·해시·정렬이 함께 바뀌고 메뉴가 닫힌다.
      await page.click('.sort-option[data-sort="updated"]');
      await page.waitForFunction(() => document.getElementById('sort').getAttribute('aria-expanded') === 'false');
      await page.waitForFunction(
        (expected) => document.querySelector('.card-title')?.textContent.trim() === expected,
        {},
        updatedFirst,
      );
      const sortPicked = await page.evaluate(() => ({
        value: document.getElementById('sort').dataset.value,
        label: document.getElementById('sort-value').textContent.trim(),
        hash: location.hash,
        focused: document.activeElement?.id,
        hidden: document.getElementById('sort-menu').hidden,
      }));
      check(
        `[${viewport.name}] 정렬 선택 → 최신 업데이트 순 반영`,
        sortPicked.value === 'updated' &&
          sortPicked.label === '최신 업데이트 순' &&
          sortPicked.hash.includes('sort=updated') &&
          sortPicked.hidden &&
          sortPicked.focused === 'sort',
        `"${sortPicked.label}" · ${sortPicked.hash} · 첫 카드 ${updatedFirst} · 포커스 ${sortPicked.focused}`,
      );

      // 키보드: Enter로 열고, 화살표로 옮기고, Enter로 고른다.
      await page.focus('#sort');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => !document.getElementById('sort-menu').hidden);
      const keyboardOpenFocus = await page.evaluate(
        () => document.activeElement?.closest('.sort-option')?.textContent.trim() ?? '',
      );
      await page.keyboard.press('ArrowDown');
      const keyboardMovedFocus = await page.evaluate(
        () => document.activeElement?.closest('.sort-option')?.textContent.trim() ?? '',
      );
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        (expected) => document.querySelector('.card-title')?.textContent.trim() === expected,
        {},
        nameFirst,
      );
      const keyboardPick = await page.evaluate(() => ({
        value: document.getElementById('sort').dataset.value,
        hash: location.hash,
      }));
      check(
        `[${viewport.name}] 정렬 키보드 조작(Enter·화살표·Enter)`,
        keyboardOpenFocus === '최신 업데이트 순' &&
          keyboardMovedFocus === '이름 순' &&
          keyboardPick.value === 'name' &&
          keyboardPick.hash.includes('sort=name'),
        `열 때 "${keyboardOpenFocus}" → 화살표 "${keyboardMovedFocus}" → 선택 ${keyboardPick.value}`,
      );

      // Escape로 닫히고 포커스는 버튼으로 돌아온다.
      await openSort(page);
      await page.keyboard.press('Escape');
      const sortEscape = await page.evaluate(() => ({
        hidden: document.getElementById('sort-menu').hidden,
        expanded: document.getElementById('sort').getAttribute('aria-expanded'),
        focused: document.activeElement?.id,
      }));
      check(
        `[${viewport.name}] 정렬 Escape로 닫힘`,
        sortEscape.hidden && sortEscape.expanded === 'false' && sortEscape.focused === 'sort',
        `닫힘 ${sortEscape.hidden} · 포커스 ${sortEscape.focused}`,
      );

      // 바깥 클릭으로도 닫힌다.
      await openSort(page);
      await page.mouse.click(8, viewport.height - 8);
      const sortOutside = await page.evaluate(() => document.getElementById('sort-menu').hidden);
      check(`[${viewport.name}] 정렬 메뉴 바깥 클릭으로 닫힘`, sortOutside, `닫힘 ${sortOutside}`);
      await chooseSort(page, 'stars');

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        const limit = doc.clientWidth;
        const offenders = [];
        for (const element of document.querySelectorAll('body *')) {
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          if (rect.right <= limit + 1 && rect.left >= -1) continue;
          let parent = element.parentElement;
          let scrollable = false;
          while (parent) {
            const overflowX = getComputedStyle(parent).overflowX;
            if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') {
              scrollable = true;
              break;
            }
            parent = parent.parentElement;
          }
          if (!scrollable) offenders.push(`${element.className || element.tagName} right=${Math.round(rect.right)}`);
        }
        return { scrollWidth: doc.scrollWidth, clientWidth: limit, offenders: offenders.slice(0, 4) };
      });
      check(
        `[${viewport.name}] 가로 넘침 0`,
        overflow.scrollWidth <= overflow.clientWidth && overflow.offenders.length === 0,
        `scrollWidth ${overflow.scrollWidth} / clientWidth ${overflow.clientWidth}${
          overflow.offenders.length ? ` · 넘치는 요소: ${overflow.offenders.join(', ')}` : ''
        }`,
      );

      await screenshot(page, path.join(OUT_DIR, `home-${viewport.name}.png`), viewport);
      await fullScreenshot(page, path.join(OUT_DIR, `home-${viewport.name}-full.png`), viewport);

      // 첫 화면: 세부 필터가 접혀 있고 카드가 몇 장 보이나
      const firstScreen = await page.evaluate(() => {
        const header = document.querySelector('.site-header').getBoundingClientRect();
        const cards = [...document.querySelectorAll('.card')].map((node) => node.getBoundingClientRect());
        return {
          viewport: window.innerHeight,
          firstTop: Math.round(cards[0].top),
          cardHeight: Math.round(cards[0].height),
          fullyVisible: cards.filter((card) => card.top >= header.bottom - 1 && card.bottom <= window.innerHeight + 0.5)
            .length,
        };
      });
      check(
        `[${viewport.name}] 첫 화면 카드 2장 이상 노출`,
        firstScreen.fullyVisible >= 2,
        `${firstScreen.fullyVisible}장 · 첫 카드 ${firstScreen.firstTop}px부터 · 카드 높이 ${firstScreen.cardHeight}px · 뷰포트 ${
          firstScreen.viewport
        }px`,
      );

      // '더 보기': 누를 때마다 24개씩 추가로 그린다
      const afterOne = Math.min(total, PAGE_SIZE * 2);
      await page.click('#load-more');
      await page.waitForFunction((expected) => document.querySelectorAll('.card').length === expected, {}, afterOne);
      const oneMore = await page.evaluate(() => ({
        count: document.querySelectorAll('.card').length,
        text: document.getElementById('load-more').textContent.trim(),
        label: document.getElementById('load-more').getAttribute('aria-label'),
      }));
      check(
        `[${viewport.name}] 더 보기 1회 → ${afterOne}개`,
        oneMore.count === afterOne && oneMore.text === `더 보기 (${total - afterOne}개 남음)` && /남음/.test(oneMore.label),
        `${oneMore.count}개 · "${oneMore.text}"`,
      );

      // 끝까지 누르면 전체가 그려지고 버튼이 사라진다.
      // 여기서는 클릭을 스크립트로 보낸다: 브라우저 클릭은 매번 버튼까지 스크롤해 1,321장의 아바타를
      // 몇 초 안에 몰아서 받게 만들어(실사용과 다른 부하·GitHub 요청 한도) 검증 대상을 흐린다.
      // 화면 이동에 따른 아바타 로딩은 위의 '스크롤한 카드 아바타도 로드' 항목이 따로 본다.
      let guard = 0;
      // 1,300여 개면 클릭 56번. 여유를 두고 넉넉히 돌린다.
      while (guard++ < Math.ceil(total / PAGE_SIZE) + 10) {
        const hidden = await page.$eval('#load-more', (node) => node.hidden);
        if (hidden) break;
        await page.evaluate(() => document.getElementById('load-more').click());
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      const allLoad = await page.evaluate(() => ({
        count: document.querySelectorAll('.card').length,
        hidden: document.getElementById('load-more').hidden,
      }));
      check(
        `[${viewport.name}] 끝까지 더 보기 → 전체 ${total}개·버튼 사라짐`,
        allLoad.count === total && allLoad.hidden,
        `${allLoad.count}개 · 버튼 ${allLoad.hidden ? '숨김' : '남음'}`,
      );
      // 전수 확인: 1,321장 모두 높이가 같아야 한다.
      // (배지 4개짜리 5장만 좁은 화면에서 배지가 두 줄로 접혀 한 줄만큼 높다 — 그 예외까지 허용한다.)
      const allHeights = await page.evaluate(() => {
        const groups = new Map();
        let badgeTwoRows = 0;
        for (const card of document.querySelectorAll('.card')) {
          const height = Math.round(card.getBoundingClientRect().height * 10) / 10;
          groups.set(height, (groups.get(height) || 0) + 1);
          const badges = card.querySelector('.badges');
          const rows = new Set([...badges.children].map((badge) => Math.round(badge.getBoundingClientRect().top))).size;
          if (rows > 1) badgeTwoRows += 1;
        }
        return { groups: [...groups.entries()].sort((a, b) => b[1] - a[1]), badgeTwoRows };
      });
      check(
        `[${viewport.name}] 전체 ${total}개 카드 높이 균일`,
        allHeights.groups.length <= 2 &&
          allHeights.groups[0][1] >= total - 6 &&
          allHeights.badgeTwoRows <= 6,
        `${allHeights.groups.map(([height, count]) => `${height}px×${count}`).join(', ')} · 배지 두 줄 ${
          allHeights.badgeTwoRows
        }장`,
      );
      // 1,321개를 펼쳐도 아바타 요청이 터지지 않아야 한다(ERR_INSUFFICIENT_RESOURCES 회귀 방지).
      check(
        `[${viewport.name}] 끝까지 펼쳐도 이미지 요청 실패 없음`,
        imageFailures.length === 0 && consoleErrors.length === 0,
        imageFailures.length === 0 ? '실패 0건' : `${imageFailures.length}건: ${imageFailures.slice(0, 3).join(' | ')}`,
      );
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction((expected) => document.querySelectorAll('.card').length === expected, {}, rendered);
      check(`[${viewport.name}] 새로고침하면 다시 ${rendered}개`, true, `${rendered}개`);

      // 세부 필터 기본값: 접힌 상태 + 배지 없음
      const collapsed = await page.evaluate(() => {
        const toggle = document.getElementById('filter-toggle');
        const panel = document.getElementById('filter-panel');
        return {
          expanded: toggle.getAttribute('aria-expanded'),
          hidden: panel.hidden,
          panelHeight: Math.round(panel.getBoundingClientRect().height),
          chips: document.querySelectorAll('#chips .chip').length,
          badgeHidden: document.getElementById('filter-count').hidden,
          searchVisible: document.getElementById('q').getBoundingClientRect().height > 0,
          sortVisible: document.getElementById('sort').getBoundingClientRect().height > 0,
        };
      });
      check(
        `[${viewport.name}] 세부 필터 기본 접힘`,
        collapsed.expanded === 'false' &&
          collapsed.hidden &&
          collapsed.panelHeight === 0 &&
          collapsed.chips === 5 &&
          collapsed.badgeHidden &&
          collapsed.searchVisible &&
          collapsed.sortVisible,
        `aria-expanded ${collapsed.expanded} · panel ${collapsed.panelHeight}px · 칩 ${collapsed.chips}개 · 배지 ${
          collapsed.badgeHidden ? '없음' : '있음'
        } · 검색/정렬 노출 ${collapsed.searchVisible}/${collapsed.sortVisible}`,
      );

      // 카테고리: 트랙 없는 개별 필 칩 + 활성 강조 + 왼쪽 여백(클리핑 없음)
      const tabStyle = await page.evaluate(() => {
        const tabs = [...document.querySelectorAll('#tabs .tab')];
        const active = document.querySelector('#tabs .tab[aria-pressed="true"]');
        const inactive = tabs.find((node) => node !== active);
        const a = getComputedStyle(active);
        const i = getComputedStyle(inactive);
        const track = document.getElementById('tabs');
        return {
          count: tabs.length,
          labels: tabs.map((node) => node.textContent.trim()),
          paddingLeft: parseFloat(i.paddingLeft),
          paddingRight: parseFloat(i.paddingRight),
          height: Math.round(inactive.getBoundingClientRect().height),
          borderWidth: i.borderTopWidth,
          gap: parseFloat(getComputedStyle(track).columnGap),
          trackBg: getComputedStyle(track).backgroundColor,
          inactiveBg: i.backgroundColor,
          activeBg: a.backgroundColor,
          offsetLeft: Math.round(tabs[0].getBoundingClientRect().left - track.getBoundingClientRect().left),
          trackOverflow: getComputedStyle(track).overflowX,
          widths: tabs.map((node) => Math.round(node.getBoundingClientRect().width * 10) / 10),
          justify: i.justifyContent,
          textAlign: i.textAlign,
          fontSize: parseFloat(i.fontSize),
          fontWeight: Number(i.fontWeight),
          minWidth: i.minWidth,
        };
      });
      check(
        `[${viewport.name}] 카테고리 개별 필 칩(트랙 없음·좌우 여백)`,
        tabStyle.count === 6 &&
          tabStyle.borderWidth === '1px' &&
          tabStyle.paddingLeft >= 13 &&
          tabStyle.paddingRight >= 13 &&
          tabStyle.height >= 33 &&
          tabStyle.height <= 37 &&
          tabStyle.gap >= 4 &&
          tabStyle.trackBg === 'rgba(0, 0, 0, 0)' &&
          tabStyle.fontSize >= 13.4 &&
          tabStyle.offsetLeft >= (viewport.width < 768 ? 15 : 0),
        `${tabStyle.count}개 · 패딩 ${tabStyle.paddingLeft}/${tabStyle.paddingRight} · 높이 ${tabStyle.height} · 글자 ${tabStyle.fontSize}px/${tabStyle.fontWeight} · 간격 ${tabStyle.gap} · 트랙배경 ${tabStyle.trackBg} · 첫 칩 오프셋 ${tabStyle.offsetLeft}`,
      );
      check(
        `[${viewport.name}] 활성 카테고리 대비(색 반전)`,
        tabStyle.activeBg !== tabStyle.inactiveBg,
        `활성 ${tabStyle.activeBg} · 비활성 ${tabStyle.inactiveBg} · ${tabStyle.labels.join(' / ')}`,
      );
      // 고정 min-width를 풀어 글자 길이에 맞춘 자연 폭이 됐는지: 박스가 글자보다 과하게 남지 않아야 한다.
      {
        const tabFit = await page.evaluate(() => {
          const measure = (node) => {
            const range = document.createRange();
            range.selectNodeContents(node);
            const style = getComputedStyle(node);
            const box = node.getBoundingClientRect();
            return {
              label: node.textContent.trim(),
              width: Math.round(box.width * 10) / 10,
              textWidth: Math.round(range.getBoundingClientRect().width * 10) / 10,
              height: Math.round(box.height * 10) / 10,
              pad: parseFloat(style.paddingLeft),
              minWidth: style.minWidth,
              justifyContent: style.justifyContent,
              textAlign: style.textAlign,
            };
          };
          return [...document.querySelectorAll('#tabs .tab')].map(measure);
        });
        const fitsText = tabFit.every(
          (tab) =>
            tab.width >= tab.textWidth + tab.pad * 2 - 1 && tab.width <= tab.textWidth + tab.pad * 2 + 3,
        );
        const noFixedWidth = tabFit.every((tab) => !/^[\d.]+px$/.test(tab.minWidth) || parseFloat(tab.minWidth) === 0);
        check(
          `[${viewport.name}] 카테고리 칩은 글자에 맞춘 자연 폭(빈 여백 없음)`,
          fitsText &&
            noFixedWidth &&
            tabFit.every((tab) => tab.height >= 33 && tab.height <= 37) &&
            tabFit.every((tab) => tab.justifyContent === 'center' && tab.textAlign === 'center'),
          `${tabFit.map((tab) => `${tab.label} ${tab.width}(글자 ${tab.textWidth})`).join(' / ')} · min-width ${tabFit[0].minWidth}`,
        );
      }

      // 카테고리 전환: 전체 → 프론트엔드
      const frontendPage = firstPageCount(frontendNames.length);
      await page.click('#tabs .tab[data-category="frontend"]');
      await page.waitForFunction(
        (expected) => document.querySelectorAll('.card').length === expected,
        {},
        frontendPage,
      );
      const frontendTitles = await page.$$eval('.card-title', (nodes) => nodes.map((node) => node.textContent.trim()));
      const frontendCount = await page.$eval('#count', (node) => node.textContent.trim());
      check(
        `[${viewport.name}] 카테고리 프론트엔드 전환(첫 ${frontendPage}개)`,
        frontendTitles.sort().join(',') === [...firstPage(frontendNames)].sort().join(',') &&
          /\d+개 표시/.test(frontendCount) &&
          new RegExp(`조건에 맞는 ${frontendNames.length}개`).test(frontendCount),
        `${frontendTitles.length}개 · ${frontendCount}`,
      );
      const frontendShot = await page.evaluate(() => {
        const active = document.querySelector('#tabs .tab[aria-pressed="true"]');
        const track = document.getElementById('tabs').getBoundingClientRect();
        const chip = active.getBoundingClientRect();
        return {
          label: active.textContent.trim(),
          visible: chip.left >= track.left - 1 && chip.right <= track.right + 1,
        };
      });
      check(
        `[${viewport.name}] 선택한 카테고리 칩이 스크롤 안에 보임`,
        frontendShot.visible,
        `${frontendShot.label} · ${frontendShot.visible ? '보임' : '가려짐'}`,
      );
      await settle(page);
      await screenshot(page, path.join(OUT_DIR, `category-frontend-${viewport.name}.png`), viewport);
      // 마지막 카테고리도 스크롤로 닿는지 + 초기화
      await page.click('#reset');
      await page.waitForFunction((expected) => document.querySelectorAll('.card').length === expected, {}, rendered);
      const lastTabVisible = await page.evaluate(() => {
        const tabs = [...document.querySelectorAll('#tabs .tab')];
        const track = document.getElementById('tabs');
        const last = tabs[tabs.length - 1];
        last.scrollIntoView({ inline: 'nearest', block: 'nearest' });
        const box = track.getBoundingClientRect();
        const chip = last.getBoundingClientRect();
        return { label: last.textContent.trim(), visible: chip.left >= box.left - 1 && chip.right <= box.right + 1 };
      });
      check(`[${viewport.name}] 마지막 카테고리 칩까지 스크롤`, lastTabVisible.visible, lastTabVisible.label);
      await page.evaluate(() => {
        document.getElementById('tabs').scrollLeft = 0;
      });

      // 세부 필터 펼치기/접기 + 선택 개수 배지
      await openFilters(page);
      const opened = await page.evaluate(() => ({
        expanded: document.getElementById('filter-toggle').getAttribute('aria-expanded'),
        height: Math.round(document.getElementById('filter-panel').getBoundingClientRect().height),
        items: document.querySelectorAll('#chips .chip').length,
      }));
      check(
        `[${viewport.name}] 세부 필터 펼침`,
        opened.expanded === 'true' && opened.height > 0 && opened.items === 5,
        `height ${opened.height}px · 칩 ${opened.items}개`,
      );

      // 필터 칩: 카테고리 칩과 같은 높이·글자 크기, 글자 길이에 맞춘 자연 폭(좁은 화면은 자연 줄바꿈).
      const chipShape = await page.evaluate(() => {
        const round = (value) => Math.round(value * 10) / 10;
        const chips = [...document.querySelectorAll('#chips .chip')];
        const boxes = chips.map((node) => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          const range = document.createRange();
          range.selectNodeContents(node);
          return {
            label: node.textContent.trim(),
            width: round(rect.width),
            textWidth: round(range.getBoundingClientRect().width),
            height: round(rect.height),
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            pad: parseFloat(style.paddingLeft),
            font: parseFloat(style.fontSize),
            weight: Number(style.fontWeight),
            justify: style.justifyContent,
            textAlign: style.textAlign,
          };
        });
        const track = getComputedStyle(document.getElementById('chips'));
        return { boxes, display: track.display, flexWrap: track.flexWrap };
      });
      {
        const boxes = chipShape.boxes;
        const heights = boxes.map((box) => box.height);
        const rows = [...new Set(boxes.map((box) => box.top))];
        const expectedRows = viewport.width < 560 ? 2 : 1;
        // 줄마다 첫 칩의 왼쪽 끝이 맞고, 같은 줄 칩은 높이가 같다.
        const rowStarts = rows.map((top) => boxes.find((box) => box.top === top).left);
        const aligned = new Set(rowStarts).size === 1;
        const fitsText = boxes.every(
          (box) => box.width >= box.textWidth + box.pad * 2 && box.width <= box.textWidth + box.pad * 2 + 18,
        );
        check(
          `[${viewport.name}] 필터 칩도 글자에 맞춘 자연 폭(${expectedRows}줄·같은 높이)`,
          boxes.length === 5 &&
            chipShape.display === 'flex' &&
            chipShape.flexWrap === 'wrap' &&
            rows.length === expectedRows &&
            aligned &&
            heights.every((height) => height >= 33 && height <= 37) &&
            boxes.every((box) => box.font >= 13.4 && box.weight <= 600) &&
            boxes.every((box) => box.justify === 'center' && box.textAlign === 'center') &&
            fitsText,
          `${boxes.map((box) => `${box.label} ${box.width}(글자 ${box.textWidth})`).join(' / ')} · 높이 ${Math.min(...heights)}~${Math.max(
            ...heights,
          )}px · ${chipShape.display}/${chipShape.flexWrap} ${rows.length}줄 · 글자 ${boxes[0].font}px`,
        );
        // 카테고리 칩과 필터 칩은 같은 치수, 위쪽 검색·정렬·필터(40/46px)보다 한 단계 작다.
        const hierarchy = await page.evaluate(() => ({
          chip: Math.round(document.querySelector('#chips .chip').getBoundingClientRect().height),
          tab: Math.round(document.querySelector('#tabs .tab').getBoundingClientRect().height),
          control: Math.round(document.getElementById('q').getBoundingClientRect().height),
        }));
        check(
          `[${viewport.name}] 칩 높이 위계(칩 = 카테고리 < 상단 컨트롤)`,
          hierarchy.chip === hierarchy.tab && hierarchy.chip <= hierarchy.control - 4,
          `칩 ${hierarchy.chip} · 카테고리 ${hierarchy.tab} · 상단 컨트롤 ${hierarchy.control}px`,
        );
      }
      await settle(page);
      await screenshot(page, path.join(OUT_DIR, `filter-open-${viewport.name}.png`), viewport);
      const openOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      check(`[${viewport.name}] 필터 펼친 상태 가로 넘침 0`, openOverflow);

      await page.click('.chip[data-filter="recent"]');
      await page.waitForFunction(() => document.getElementById('filter-count').textContent === '1');
      const badge = await page.evaluate(() => ({
        text: document.getElementById('filter-count').textContent,
        hidden: document.getElementById('filter-count').hidden,
        label: document.getElementById('filter-toggle').getAttribute('aria-label'),
      }));
      check(
        `[${viewport.name}] 선택 개수 배지`,
        !badge.hidden && badge.text === '1' && /1개/.test(badge.label),
        `${badge.text} · ${badge.label}`,
      );
      await closeFilters(page);
      const collapsedAgain = await page.evaluate(() => ({
        hidden: document.getElementById('filter-panel').hidden,
        badge: document.getElementById('filter-count').textContent,
      }));
      check(
        `[${viewport.name}] 접어도 선택 유지(배지)`,
        collapsedAgain.hidden && collapsedAgain.badge === '1',
        `panel hidden ${collapsedAgain.hidden} · 배지 ${collapsedAgain.badge}`,
      );
      await openFilters(page);
      await page.click('.chip[data-filter="recent"]');
      await page.waitForFunction(() => document.getElementById('filter-count').hidden);

      // 검색
      await page.click('#q');
      await page.type('#q', '차트', { delay: 20 });
      const chartPage = firstPageCount(chartHits.length);
      await page.waitForFunction((expected) => document.querySelectorAll('.card').length === expected, {}, chartPage);
      const searchHits = await page.$$eval('.card-title', (titles) => titles.map((t) => t.textContent.trim()));
      check(
        `[${viewport.name}] 검색 "차트"`,
        chartHits.length > 0 && searchHits.sort().join(',') === [...firstPage(chartHits)].sort().join(','),
        `${searchHits.length}개 · ${searchHits.join(', ')}`,
      );
      await screenshot(page, path.join(OUT_DIR, `search-${viewport.name}.png`), viewport);

      // 유의어 검색: '화면' 하나로 UI·프론트엔드 항목이 나오고, 정렬은 관련도 순이 된다
      const screenSorted = await sortValue(page);
      check(`[${viewport.name}] 검색하면 정렬이 관련도 순`, screenSorted === 'relevance', screenSorted);
      const screenHits = expectedNames(repos, { query: '화면' });
      await page.evaluate(() => {
        const input = document.getElementById('q');
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.click('#q');
      await page.type('#q', '화면', { delay: 20 });
      await page.waitForFunction(
        (expected) => document.querySelectorAll('.card').length === expected,
        {},
        firstPageCount(screenHits.length),
      );
      const screenTitles = await page.$$eval('.card-title', (titles) => titles.map((t) => t.textContent.trim()));
      check(
        `[${viewport.name}] 유의어 검색 "화면" → UI·프론트엔드 ${screenHits.length}건 중 관련도 순`,
        screenHits.length > 20 &&
          screenTitles.join(',') === firstPage(screenHits).join(',') &&
          screenTitles.includes('storybook'),
        `${screenTitles.length}개 · ${screenTitles.slice(0, 6).join(', ')}`,
      );
      await screenshot(page, path.join(OUT_DIR, `search-synonym-${viewport.name}.png`), viewport);
      await page.evaluate(() => {
        const input = document.getElementById('q');
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      const sortAfterClear = await sortValue(page);
      check(`[${viewport.name}] 검색을 지우면 스타순으로 복귀`, sortAfterClear === 'stars', sortAfterClear);
      await page.waitForFunction((expected) => document.querySelectorAll('.card').length === expected, {}, rendered);

      // 토큰 검색: 'k-ui-ux' → 'k-style-ui-ux'가 바로 나온다
      const tokenHits = expectedNames(repos, { query: 'k-ui-ux' });
      await page.click('#q');
      await page.type('#q', 'k-ui-ux', { delay: 20 });
      await page.waitForFunction(
        (expected) => document.querySelectorAll('.card').length === expected,
        {},
        firstPageCount(tokenHits.length),
      );
      const tokenTitles = await page.$$eval('.card-title', (titles) => titles.map((t) => t.textContent.trim()));
      check(
        `[${viewport.name}] 토큰 검색 "k-ui-ux" → k-style-ui-ux`,
        tokenHits.includes('k-style-ui-ux') &&
          tokenTitles.includes('k-style-ui-ux') &&
          tokenTitles.sort().join(',') === [...firstPage(tokenHits)].sort().join(','),
        `${tokenTitles.length}개 · ${tokenTitles.join(', ')}`,
      );
      await screenshot(page, path.join(OUT_DIR, `search-token-${viewport.name}.png`), viewport);
      await page.evaluate(() => {
        const input = document.getElementById('q');
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForFunction((expected) => document.querySelectorAll('.card').length === expected, {}, rendered);

      // 필터: Docker
      const dockerPage = firstPageCount(dockerCount);
      await page.click('.chip[data-filter="docker"]');
      await page.waitForFunction((expected) => document.querySelectorAll('.card').length === expected, {}, dockerPage);
      const dockerHits = await page.$$eval('.card-title', (titles) => titles.map((t) => t.textContent.trim()));
      check(`[${viewport.name}] Docker 필터`, dockerHits.length === dockerPage, `${dockerHits.length}개`);
      await screenshot(page, path.join(OUT_DIR, `filter-docker-${viewport.name}.png`), viewport);

      // 필터: MCP · 스킬 — 칩·카드 배지·해시가 같은 판별을 쓴다
      await page.click('.chip[data-filter="docker"]');
      await page.click('.chip[data-filter="mcp"]');
      const mcpPage = firstPageCount(mcpCount);
      await page.waitForFunction((expected) => document.querySelectorAll('.card').length === expected, {}, mcpPage);
      const mcpState = await page.evaluate(() => ({
        hash: location.hash,
        chips: document.querySelectorAll('#chips .chip').length,
        badgeCells: document.querySelectorAll('.card .badge-mcp').length,
        cards: document.querySelectorAll('.card').length,
        count: document.getElementById('count').textContent.replace(/\s+/g, ' ').trim(),
        label: document.querySelector('.chip[data-filter="mcp"]').textContent.trim(),
        pressed: document.querySelector('.chip[data-filter="mcp"]').getAttribute('aria-pressed'),
      }));
      const mcpNames = expectedNames(repos, { filters: ['mcp'], sort: 'stars' });
      const mcpTitles = await page.$$eval('.card-title', (titles) => titles.map((title) => title.textContent.trim()));
      check(
        `[${viewport.name}] MCP · 스킬 필터 — ${mcpCount}개 중 ${mcpPage}개 표시`,
        mcpState.chips === 5 &&
          mcpState.label === 'MCP · 스킬' &&
          mcpState.pressed === 'true' &&
          mcpState.hash.includes('f=mcp') &&
          mcpState.cards === mcpPage &&
          mcpState.badgeCells === mcpPage &&
          mcpState.count.includes(String(mcpCount)) &&
          mcpTitles.join(',') === firstPage(mcpNames).join(','),
        `${mcpState.cards}개 표시 · ${mcpState.count} · 배지 ${mcpState.badgeCells} · ${mcpState.hash}`,
      );
      await screenshot(page, path.join(OUT_DIR, `filter-mcp-${viewport.name}.png`), viewport);

      // MCP · 스킬 ∩ 한국어 문서 (AND) — 칩 두 개가 함께 걸린다
      await page.click('.chip[data-filter="korean"]');
      await page.waitForFunction(
        (expected) => document.querySelectorAll('.card').length === expected,
        {},
        firstPageCount(mcpKoreanCount),
      );
      const mcpKoreanState = await page.evaluate(() => ({
        cards: document.querySelectorAll('.card').length,
        badge: document.getElementById('filter-count').textContent,
        badges: document.querySelectorAll('.card .badge-mcp').length,
        hash: location.hash,
      }));
      check(
        `[${viewport.name}] MCP · 스킬 ∩ 한국어 문서`,
        mcpKoreanState.cards === firstPageCount(mcpKoreanCount) &&
          mcpKoreanState.badge === '2' &&
          mcpKoreanState.badges === firstPageCount(mcpKoreanCount) &&
          mcpKoreanState.hash.includes('mcp') &&
          mcpKoreanState.hash.includes('korean'),
        `${mcpKoreanState.cards}개 표시 · ${mcpKoreanCount}개 일치 · ${mcpKoreanState.hash}`,
      );
      await screenshot(page, path.join(OUT_DIR, `filter-mcp-korean-${viewport.name}.png`), viewport);
      await page.click('.chip[data-filter="korean"]');
      await page.waitForFunction((expected) => document.querySelectorAll('.card').length === expected, {}, mcpPage);
      await page.click('.chip[data-filter="mcp"]');
      await page.click('.chip[data-filter="docker"]');
      await page.waitForFunction(() => document.getElementById('filter-count').textContent === '1');

      // 필터: 상업 무료 + 한국어 문서 (AND)
      const commercialPage = firstPageCount(commercialKorean);
      await page.click('.chip[data-filter="docker"]');
      await page.click('.chip[data-filter="commercial"]');
      await page.click('.chip[data-filter="korean"]');
      await page.waitForFunction(
        (expected) => document.querySelectorAll('.card').length === expected,
        {},
        commercialPage,
      );
      const andCount = await page.$$eval('.card', (nodes) => nodes.length);
      check(
        `[${viewport.name}] 상업 무료 ∩ 한국어 문서`,
        andCount === commercialPage && /조건에 맞는 \d+개/.test(await page.$eval('#count', (node) => node.textContent)),
        `${andCount}개 표시`,
      );

      // 필터 해제 + 정렬
      await page.click('#reset');
      await page.waitForFunction((expected) => document.querySelectorAll('.card').length === expected, {}, rendered);
      await chooseSort(page, 'updated');
      await page.waitForFunction(
        (expected) => document.querySelector('.card-title')?.textContent.trim() === expected,
        {},
        updatedFirst,
      );
      const firstUpdated = await page.$eval('.card-title', (el) => el.textContent.trim());
      check(`[${viewport.name}] 최신 업데이트 정렬`, firstUpdated === updatedFirst, firstUpdated);
      await chooseSort(page, 'stars');
      await page.waitForFunction(
        (expected) => document.querySelector('.card-title')?.textContent.trim() === expected,
        {},
        starsFirst,
      );
      const firstStar = await page.$eval('.card-title', (el) => el.textContent.trim());
      check(`[${viewport.name}] 스타순 정렬`, firstStar === starsFirst, firstStar);

      // 배지 색 체계: 상업 무료(초록)·한국어(파랑)·Docker(보라)가 실제로 렌더된다
      const palette = await page.evaluate(() => {
        const pick = (selector) => {
          const node = document.querySelector(selector);
          if (!node) return null;
          const style = getComputedStyle(node);
          return `${style.color} / ${style.backgroundColor}`;
        };
        return {
          commercial: pick('.badge-commercial'),
          korean: pick('.badge-korean'),
          docker: pick('.badge-docker'),
          verified: pick('.badge-verified'),
        };
      });
      check(
        `[${viewport.name}] 배지 색 체계`,
        Boolean(palette.commercial && palette.korean && palette.verified),
        JSON.stringify(palette),
      );

      // 다크 모드 토글 + 저장
      await closeFilters(page);
      await page.evaluate(() => document.activeElement?.blur());
      const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      await page.click('#theme-toggle');
      await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark');
      const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const stored = await page.evaluate(() => localStorage.getItem('koss-theme'));
      check(
        `[${viewport.name}] 다크 모드 토글`,
        lightBg !== darkBg && stored === 'dark',
        `light ${lightBg} → dark ${darkBg} · 저장 ${stored}`,
      );
      // 색 전환 트랜지션이 끝난 뒤에야 실제 색이 측정된다.
      await settle(page, 420);
      // 다크 모드에서도 본문·보조 텍스트가 4.5:1 이상인지 확인한다.
      const darkContrast = await page.evaluate(() => {
        const parse = (value) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const alpha = (value) => {
          const parts = (value.match(/[\d.]+/g) ?? []).map(Number);
          return parts.length > 3 ? parts[3] : 1;
        };
        const luminance = (rgb) => {
          const [r, g, b] = rgb.map((channel) => {
            const c = channel / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const ratio = (foreground, background) => {
          const a = luminance(parse(foreground));
          const b = luminance(parse(background));
          return Number(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2));
        };
        // 투명 배경이면 부모를 거슬러 올라가 실제로 깔린 색을 쓴다.
        const effectiveBg = (node) => {
          let current = node;
          while (current) {
            const bg = getComputedStyle(current).backgroundColor;
            if (alpha(bg) > 0.01) return bg;
            current = current.parentElement;
          }
          return getComputedStyle(document.body).backgroundColor;
        };
        const body = getComputedStyle(document.body);
        const summary = document.querySelector('.card-summary');
        const card = summary?.closest('.card');
        const tab = document.querySelector('#tabs .tab:not([aria-pressed="true"])');
        return {
          bodyRatio: ratio(body.color, body.backgroundColor),
          cardTitleRatio: ratio(getComputedStyle(document.querySelector('.card-title')).color, effectiveBg(card)),
          summaryRatio: ratio(getComputedStyle(summary).color, effectiveBg(card)),
          tabRatio: ratio(getComputedStyle(tab).color, effectiveBg(tab)),
          statsRatio: ratio(getComputedStyle(document.getElementById('catalog-stats')).color, body.backgroundColor),
        };
      });
      check(
        `[${viewport.name}] 다크 모드 대비 4.5:1 이상`,
        Object.values(darkContrast).every((value) => value >= 4.5),
        Object.entries(darkContrast)
          .map(([key, value]) => `${key} ${value}:1`)
          .join(' · '),
      );
      // 다크 모드의 정렬 메뉴도 같은 토큰을 쓰는지(표면·선택 강조) + 대비 유지
      await page.click('#sort');
      await page.waitForFunction(() => !document.getElementById('sort-menu').hidden);
      await settle(page, 240);
      const darkMenu = await page.evaluate(() => {
        const parse = (value) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const luminance = (rgb) => {
          const [r, g, b] = rgb.map((channel) => {
            const c = channel / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const ratio = (fg, bg) => {
          const a = luminance(parse(fg));
          const b = luminance(parse(bg));
          return Number(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2));
        };
        const menu = document.getElementById('sort-menu');
        const menuBg = getComputedStyle(menu).backgroundColor;
        const plain = menu.querySelector('.sort-option[aria-selected="false"]');
        const selected = menu.querySelector('.sort-option[aria-selected="true"]');
        return {
          menuBg,
          pageBg: getComputedStyle(document.body).backgroundColor,
          plainRatio: ratio(getComputedStyle(plain).color, menuBg),
          selectedRatio: ratio(getComputedStyle(selected).color, getComputedStyle(selected).backgroundColor),
          label: selected.textContent.trim(),
        };
      });
      check(
        `[${viewport.name}] 다크 모드 정렬 메뉴 표면·대비`,
        darkMenu.menuBg !== darkMenu.pageBg && darkMenu.plainRatio >= 4.5 && darkMenu.selectedRatio >= 4.5,
        `메뉴 ${darkMenu.menuBg}/바탕 ${darkMenu.pageBg} · 항목 ${darkMenu.plainRatio}:1 · 선택 ${darkMenu.selectedRatio}:1`,
      );
      await screenshot(page, path.join(OUT_DIR, `sort-open-${viewport.name}-dark.png`), viewport);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.getElementById('sort-menu').hidden);

      // 색 전환 트랜지션이 끝난 뒤에 캐처해야 화면이 그대로 보인다.
      await settle(page, 200);
      await screenshot(page, path.join(OUT_DIR, `home-${viewport.name}-dark.png`), viewport);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.card');
      const persisted = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      check(`[${viewport.name}] 다크 모드 유지(새로고침)`, persisted === 'dark', String(persisted));
      const darkOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      check(`[${viewport.name}] 다크 모드 가로 넘침 0`, darkOverflow);
      await page.click('#theme-toggle');
      await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light');

      // 글꼴·대비: Pretendard 적용, 본문/보조 텍스트 4.5:1 이상
      const typography = await page.evaluate(() => {
        const parse = (value) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const luminance = (rgb) => {
          const [r, g, b] = rgb.map((channel) => {
            const c = channel / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const ratio = (foreground, background) => {
          const a = luminance(parse(foreground));
          const b = luminance(parse(background));
          return Number(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2));
        };
        const body = getComputedStyle(document.body);
        const lede = document.querySelector('.lede');
        const summary = document.querySelector('.card-summary');
        return {
          font: body.fontFamily,
          pretendard: /Pretendard/.test(body.fontFamily),
          loaded: document.fonts.check('16px "Pretendard Variable"'),
          bodyRatio: ratio(body.color, body.backgroundColor),
          ledeRatio: ratio(getComputedStyle(lede).color, body.backgroundColor),
          summaryRatio: summary ? ratio(getComputedStyle(summary).color, getComputedStyle(summary.closest('.card')).backgroundColor) : 0,
        };
      });
      check(
        `[${viewport.name}] Pretendard 적용`,
        typography.pretendard,
        `${typography.font.split(',')[0]} · 로드 ${typography.loaded ? 'ok' : '확인 불가'}`,
      );
      check(
        `[${viewport.name}] 본문 대비 4.5:1 이상`,
        typography.bodyRatio >= 4.5 && typography.ledeRatio >= 4.5 && typography.summaryRatio >= 4.5,
        `본문 ${typography.bodyRatio}:1 · 리드 ${typography.ledeRatio}:1 · 카드 요약 ${typography.summaryRatio}:1`,
      );

      // 상세 모달
      await page.click('.card');
      await page.waitForSelector('dialog[open]');
      const dialogTitle = await page.$eval('#detail-title', (el) => el.textContent.trim());
      const judgmentCount = await page.$$eval('.judgment', (nodes) => nodes.length);
      const specCount = await page.$$eval('.spec-grid > div', (nodes) => nodes.length);
      check(
        `[${viewport.name}] 상세 모달 열림`,
        dialogTitle.length > 0 && judgmentCount >= 3 && specCount === 6,
        `${dialogTitle} · 판정 ${judgmentCount} · 스펙 ${specCount}`,
      );
      const dialogOverflow = await page.evaluate(() => {
        const dialog = document.querySelector('dialog[open]');
        const rect = dialog.getBoundingClientRect();
        return rect.right <= window.innerWidth + 1 && rect.width <= window.innerWidth;
      });
      check(`[${viewport.name}] 모달이 화면 안에`, dialogOverflow);

      const removedBlocks = await page.evaluate(() => {
        const text = document.querySelector('dialog[open]')?.textContent ?? '';
        return {
          description: /저장소 원문 설명/.test(text),
          evidenceKeys: document.querySelectorAll('.evidence-item').length,
        };
      });
      check(
        `[${viewport.name}] 원문 설명·근거 박스 제거`,
        !removedBlocks.description && removedBlocks.evidenceKeys === 0,
        `원문 설명 ${removedBlocks.description ? '남음' : '없음'} · 근거 박스 ${removedBlocks.evidenceKeys}개`,
      );

      // 상세 모달 디테일: ① 빠른 시작 안내는 README 한 줄(LAST PUSH와 겹치는 날짜 문구 없음)
      // ② 스펙 값은 카탈로그와 같고 OPEN ISSUES는 천 단위 쉼표 ③ MCP · 스킬 배지는 카드와 같은 판별
      // ④ 하단 보조 버튼은 homepage 유무에 따라 README 보기 / 공식 사이트.
      const firstRepo = repos.find((repo) => repo.repo === dialogTitle);
      const expectedSpec = {
        STARS: formatStars(firstRepo?.stars),
        'OPEN ISSUES':
          firstRepo?.openIssues === null || firstRepo?.openIssues === undefined
            ? '—'
            : Number(firstRepo.openIssues).toLocaleString('en-US'),
        LICENSE: firstRepo?.license ?? '미지정',
        'LAST PUSH': firstRepo?.pushedAt ? formatDate(firstRepo.pushedAt) : '정보 없음',
        LANG: firstRepo?.language ?? '—',
        BRANCH: firstRepo?.defaultBranch ?? '—',
      };
      const firstDetail = await page.evaluate(() => {
        const spec = {};
        for (const row of document.querySelectorAll('.spec-grid > div')) {
          spec[row.querySelector('dt').textContent.trim()] = row.querySelector('dd').textContent.trim();
        }
        return {
          spec,
          note: document.querySelector('.quickstart-note')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
          staleNote: document.querySelector('.quickstart-warn')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
          judgments: [...document.querySelectorAll('.judgments > *')].map((node) => ({
            label: node.textContent.trim(),
            kind: node.getAttribute('data-kind'),
            state: node.getAttribute('data-state'),
          })),
          actions: [...document.querySelectorAll('.detail-actions .button')].map((node) => ({
            label: node.textContent.trim(),
            href: node.getAttribute('href') ?? '',
          })),
        };
      });
      check(
        `[${viewport.name}] 모달 빠른 시작은 README 한 줄(중복 날짜 문구 없음)`,
        firstDetail.note === '설치·사용법은 저장소 README를 참고하세요.' &&
          !/마지막 푸시/.test(firstDetail.note) &&
          !/\d{4}-\d{2}-\d{2}/.test(firstDetail.note) &&
          !/최근 3개월 내 변경이 있습니다/.test(firstDetail.note) &&
          Boolean(firstRepo) &&
          (firstRepo.recent ? firstDetail.staleNote === '' : firstDetail.staleNote.includes('최근 3개월 내 변경이 확인되지 않았습니다')),
        `"${firstDetail.note}"${firstDetail.staleNote ? ` · 경고 "${firstDetail.staleNote}"` : ' · 경고 없음'}`,
      );
      check(
        `[${viewport.name}] 모달 스펙 값·OPEN ISSUES 천 단위 쉼표`,
        Object.entries(expectedSpec).every(([term, value]) => firstDetail.spec[term] === value) &&
          /^\d{1,3}(,\d{3})*$/.test(firstDetail.spec['OPEN ISSUES']),
        Object.entries(firstDetail.spec)
          .map(([term, value]) => `${term} ${value}`)
          .join(' · '),
      );
      const expectedSecondary = firstRepo?.homepage
        ? { label: '공식 사이트 ↗', href: firstRepo.homepage }
        : { label: 'README 보기 ↗', href: `${firstRepo?.url}#readme` };
      check(
        `[${viewport.name}] 모달 하단 버튼 이름·링크(homepage ${firstRepo?.homepage ? '있음' : '없음'})`,
        firstDetail.actions.length === 2 &&
          firstDetail.actions[0].label === 'GitHub 열기 ↗' &&
          firstDetail.actions[1].label === expectedSecondary.label &&
          firstDetail.actions[1].href === expectedSecondary.href,
        firstDetail.actions.map((action) => `${action.label} ${action.href}`).join(' · '),
      );
      const firstMcp = firstDetail.judgments.find((judgment) => judgment.kind === 'mcp');
      check(
        `[${viewport.name}] 모달 MCP · 스킬 배지가 카드 판별과 일치`,
        hasMcpSkill(firstRepo) ? Boolean(firstMcp) && firstMcp.label === 'MCP · 스킬' && firstMcp.state === 'on' : !firstMcp,
        `카드 판별 ${hasMcpSkill(firstRepo)} · 모달 ${firstMcp ? firstMcp.label : '없음'} · 배지 줄 ${firstDetail.judgments
          .map((judgment) => judgment.label)
          .join(' / ')}`,
      );

      // 모달 레이아웃: 헤더·하단 버튼은 고정, 본문만 스크롤
      const modalLayout = await page.evaluate(() => {
        const dialog = document.querySelector('dialog[open]');
        const shell = dialog.querySelector('.detail-shell');
        const body = dialog.querySelector('.detail-body');
        const actions = dialog.querySelector('.detail-actions');
        const rect = dialog.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();
        const actionsRect = actions.getBoundingClientRect();
        return {
          display: getComputedStyle(shell).display,
          direction: getComputedStyle(shell).flexDirection,
          bodyOverflow: getComputedStyle(body).overflowY,
          dialogTop: Math.round(rect.top),
          dialogBottom: Math.round(rect.bottom),
          bodyScrollable: body.scrollHeight > body.clientHeight,
          actionsInsideDialog: actionsRect.bottom <= rect.bottom + 1,
          bodyInsideDialog: bodyRect.bottom <= actionsRect.top + 1,
        };
      });
      check(
        `[${viewport.name}] 모달 flex 고정 헤더/푸터`,
        modalLayout.display === 'flex' && modalLayout.direction === 'column' && modalLayout.bodyOverflow === 'auto',
        `${modalLayout.display}/${modalLayout.direction} · body overflow ${modalLayout.bodyOverflow} · 스크롤 ${modalLayout.bodyScrollable ? '발생' : '불필요'}`,
      );
      check(
        `[${viewport.name}] 하단 버튼이 모달·뷰포트 안` ,
        modalLayout.actionsInsideDialog && modalLayout.dialogBottom <= viewport.height && modalLayout.dialogTop >= -1,
        `모달 ${modalLayout.dialogTop}~${modalLayout.dialogBottom}px / 뷰포트 ${viewport.height}px`,
      );

      // 모바일 360px: 모달의 'GitHub 열기' 버튼이 뷰포트 안에 완전히 보이는가
      if (viewport.width === 360) {
        const primaryBox = await page.$eval('.detail-actions .button-primary', (node) => {
          const rect = node.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, height: rect.height };
        });
        const visibleInViewport =
          primaryBox.height > 0 &&
          primaryBox.bottom <= viewport.height &&
          primaryBox.top >= 0 &&
          primaryBox.left >= 0 &&
          primaryBox.right <= viewport.width;
        check(
          '[360] 모달 GitHub 열기 버튼 뷰포트 안 (boundingBox.bottom <= innerHeight)',
          visibleInViewport,
          `bottom ${Math.round(primaryBox.bottom)} <= ${viewport.height} · top ${Math.round(primaryBox.top)} · 높이 ${Math.round(primaryBox.height)}`,
        );

        // 본문을 끝까지 스크롤해도 하단 버튼이 그대로 보인다
        await page.evaluate(() => {
          const body = document.querySelector('dialog[open] .detail-body');
          body.scrollTop = body.scrollHeight;
        });
        const afterScroll = await page.$eval('.detail-actions .button-primary', (node) => {
          const rect = node.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom };
        });
        check(
          '[360] 본문 끝까지 스크롤해도 GitHub 열기 버튼 유지',
          afterScroll.bottom <= viewport.height && afterScroll.bottom > 0,
          `bottom ${Math.round(afterScroll.bottom)} <= ${viewport.height}`,
        );
        const footVisibleButtons = await page.$$eval('.detail-actions .button', (nodes) =>
          nodes.map((node) => {
            const rect = node.getBoundingClientRect();
            return { label: node.textContent.trim(), bottom: Math.round(rect.bottom), height: Math.round(rect.height) };
          }),
        );
        check(
          '[360] 하단 액션 버튼 모두 뷰포트 안',
          footVisibleButtons.length >= 1 && footVisibleButtons.every((button) => button.bottom <= viewport.height),
          footVisibleButtons.map((button) => `${button.label} ${button.bottom}/${button.height}`).join(' · '),
        );

        // 빠른 시작 명령 복사
        const cloneText = await page.$eval('.copy-row code', (node) => node.textContent.trim());
        await page.bringToFront();
        await page.focus('.copy-button');
        await page.click('.copy-button');
        await page
          .waitForFunction(() => {
            const button = document.querySelector('.copy-button');
            return button?.dataset.copied === 'true' || /실패/.test(button?.textContent ?? '');
          }, { timeout: 4000 })
          .catch(() => {});
        const copyState = await page.evaluate(async () => {
          const button = document.querySelector('.copy-button');
          let clipboard = '';
          try {
            clipboard = await navigator.clipboard.readText();
          } catch (error) {
            clipboard = `읽기 불가(${error.message})`;
          }
          return { copied: button?.dataset.copied, label: button?.textContent.trim(), clipboard };
        });
        check(
          '[360] 빠른 시작 복사 버튼',
          copyState.copied === 'true' &&
            cloneText === `git clone https://github.com/${dialogTitle}.git` &&
            (copyState.clipboard === cloneText || copyState.clipboard === ''),
          `${copyState.label} · 명령 ${cloneText} · 클립보드 읽기 ${
            copyState.clipboard === '' ? '헤드리스 제한' : copyState.clipboard === cloneText ? '일치' : `불일치(${copyState.clipboard})`
          }`,
        );
      }

      await page.evaluate(() => {
        const body = document.querySelector('dialog[open] .detail-body');
        if (body) body.scrollTop = 0;
      });
      await screenshot(page, path.join(OUT_DIR, `detail-${viewport.name}.png`), viewport);

      await page.click('.detail-close');
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      check(`[${viewport.name}] 모달 닫힘`, true);

      // 모달 스크린샷이 실제로 저장됐는지(열림 상태에서 찍은 파일)
      const detailShot = await stat(path.join(OUT_DIR, `detail-${viewport.name}.png`));
      check(
        `[${viewport.name}] 상세 모달 열림 스크린샷 저장`,
        detailShot.size > 5000,
        `detail-${viewport.name}.png · ${detailShot.size} bytes`,
      );

      // 대표 저장소(morluto/rea: homepage·MCP · 스킬·OPEN ISSUES 1,195)로 나머지 디테일을 확인한다.
      const featured = repos.find((repo) => repo.repo === 'morluto/rea');
      const featuredCard = await page.$(`.card[data-repo="${featured.repo}"]`);
      check(`[${viewport.name}] 대표 카드(morluto/rea) 찾음`, Boolean(featuredCard), featured.repo);
      if (featuredCard) {
        await featuredCard.click();
        await page.waitForSelector('dialog[open]');
        const featuredState = await page.evaluate(() => {
          const spec = {};
          for (const row of document.querySelectorAll('.spec-grid > div')) {
            spec[row.querySelector('dt').textContent.trim()] = row.querySelector('dd').textContent.trim();
          }
          const mcp = document.querySelector('.judgments [data-kind="mcp"]');
          const cardBadge = document.querySelector('.card[data-repo="morluto/rea"] .badge-mcp');
          const styleOf = (node) => (node ? `${getComputedStyle(node).color} / ${getComputedStyle(node).backgroundColor}` : '');
          return {
            spec,
            mcpLabel: mcp?.textContent.trim() ?? '',
            mcpStyle: styleOf(mcp),
            cardBadgeStyle: styleOf(cardBadge),
            actions: [...document.querySelectorAll('.detail-actions .button')].map((node) => ({
              label: node.textContent.trim(),
              href: node.getAttribute('href') ?? '',
            })),
          };
        });
        check(
          `[${viewport.name}] 모달 OPEN ISSUES 1,195 천 단위 쉼표`,
          featuredState.spec['OPEN ISSUES'] === '1,195' && /^\d{1,3}(,\d{3})+$/.test(featuredState.spec['OPEN ISSUES']),
          `OPEN ISSUES ${featuredState.spec['OPEN ISSUES']}`,
        );
        check(
          `[${viewport.name}] 모달 MCP · 스킬 배지(카드와 같은 teal)`,
          featuredState.mcpLabel === 'MCP · 스킬' &&
            Boolean(featuredState.cardBadgeStyle) &&
            featuredState.mcpStyle.split(' / ')[0] === featuredState.cardBadgeStyle.split(' / ')[0],
          `모달 "${featuredState.mcpLabel}" ${featuredState.mcpStyle} · 카드 ${featuredState.cardBadgeStyle}`,
        );
        check(
          `[${viewport.name}] homepage 있으면 공식 사이트 버튼`,
          featuredState.actions.length === 2 &&
            featuredState.actions[0].label === 'GitHub 열기 ↗' &&
            featuredState.actions[1].label === '공식 사이트 ↗' &&
            featuredState.actions[1].href === featured.homepage,
          featuredState.actions.map((action) => `${action.label} ${action.href}`).join(' · '),
        );

        const lightContrast = await dialogContrast(page);
        check(
          `[${viewport.name}] 모달 글자 대비 4.5:1 이상(라이트)`,
          Object.values(lightContrast).every((item) => item && item.ratio >= 4.5),
          Object.entries(lightContrast)
            .map(([key, item]) => `${key} ${item ? `${item.ratio}:1` : '없음'}`)
            .join(' · '),
        );
        const clip = await dialogClip(page);
        check(
          `[${viewport.name}] 모달 잘림 없음(배지·버튼·가로 스크롤)`,
          clip.dialogInside &&
            clip.bodyNoHScroll &&
            clip.shellNoHScroll &&
            clip.clippedLabels.length === 0 &&
            clip.badgesInside &&
            clip.buttonsInside,
          `화면 안 ${clip.dialogInside} · 스크롤 없음 ${clip.bodyNoHScroll}/${clip.shellNoHScroll} · 글자 잘림 ${
            clip.clippedLabels.length
          }개 · 배지/버튼 안 ${clip.badgesInside}/${clip.buttonsInside} · ${clip.buttons
            .map((button) => `${button.label} ${Math.round(button.bottom)}`)
            .join(', ')}`,
        );
        await screenshot(page, path.join(OUT_DIR, `detail-rea-${viewport.name}.png`), viewport);
        const reaShot = await stat(path.join(OUT_DIR, `detail-rea-${viewport.name}.png`));
        check(
          `[${viewport.name}] 대표 모달 스크린샷 저장`,
          reaShot.size > 5000,
          `detail-rea-${viewport.name}.png · ${reaShot.size} bytes`,
        );

        // 다크 모드에서도 같은 모달이 4.5:1 이상인지(닫고 테마를 바꿔 다시 연다)
        await page.click('.detail-close');
        await page.waitForFunction(() => !document.querySelector('dialog[open]'));
        await page.click('#theme-toggle');
        await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark');
        await page.click(`.card[data-repo="${featured.repo}"]`);
        await page.waitForSelector('dialog[open]');
        await settle(page, 320);
        const darkContrast = await dialogContrast(page);
        check(
          `[${viewport.name}] 모달 글자 대비 4.5:1 이상(다크)`,
          Object.values(darkContrast).every((item) => item && item.ratio >= 4.5),
          Object.entries(darkContrast)
            .map(([key, item]) => `${key} ${item ? `${item.ratio}:1` : '없음'}`)
            .join(' · '),
        );
        const darkClip = await dialogClip(page);
        check(
          `[${viewport.name}] 다크 모달 잘림 없음`,
          darkClip.dialogInside && darkClip.bodyNoHScroll && darkClip.clippedLabels.length === 0 && darkClip.buttonsInside,
          `화면 안 ${darkClip.dialogInside} · 글자 잘림 ${darkClip.clippedLabels.length}개 · 버튼 안 ${darkClip.buttonsInside}`,
        );
        await screenshot(page, path.join(OUT_DIR, `detail-rea-${viewport.name}-dark.png`), viewport);
        await page.click('.detail-close');
        await page.waitForFunction(() => !document.querySelector('dialog[open]'));
        await page.click('#theme-toggle');
        await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light');
      }

      // 오래된 저장소: 날짜를 되풀이하지 않고 경고 한 줄만 붙는다.
      const stale = selectRepos(repos, { sort: 'stars' })
        .slice(0, PAGE_SIZE)
        .find((repo) => !repo.recent && !repo.archived);
      if (stale) {
        await page.click(`.card[data-repo="${stale.repo}"]`);
        await page.waitForSelector('dialog[open]');
        const staleState = await page.evaluate(() => ({
          note: document.querySelector('.quickstart-note')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
          warn: document.querySelector('.quickstart-warn')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
          warnColor: document.querySelector('.quickstart-warn') ? getComputedStyle(document.querySelector('.quickstart-warn')).color : '',
        }));
        check(
          `[${viewport.name}] 오래된 저장소 경고 한 줄(날짜 중복 없음)`,
          staleState.note === '설치·사용법은 저장소 README를 참고하세요.' &&
            /최근 3개월 내 변경이 확인되지 않았습니다/.test(staleState.warn) &&
            !/\d{4}-\d{2}-\d{2}/.test(staleState.warn),
          `${stale.repo} · "${staleState.warn}" ${staleState.warnColor}`,
        );
        await page.click('.detail-close');
        await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      }

      // URL 해시 공유 상태
      await openFilters(page);
      await page.click('.chip[data-filter="korean"]');
      await page.click('.chip[data-filter="mcp"]');
      const hash = await page.evaluate(() => location.hash);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.card');
      const restored = await page.evaluate(() => ({
        korean: document.querySelector('.chip[data-filter="korean"]').getAttribute('aria-pressed'),
        mcp: document.querySelector('.chip[data-filter="mcp"]').getAttribute('aria-pressed'),
        badges: document.querySelectorAll('.card .badge-mcp').length,
        cards: document.querySelectorAll('.card').length,
      }));
      check(
        `[${viewport.name}] 해시로 필터 복원(한국어 문서 + MCP · 스킬)`,
        restored.korean === 'true' &&
          restored.mcp === 'true' &&
          restored.cards === firstPageCount(mcpKoreanCount) &&
          restored.badges === firstPageCount(mcpKoreanCount),
        hash,
      );

      // 키보드 접근 (Enter)
      await page.click('#reset');
      await page.focus('.card');
      await page.keyboard.press('Enter');
      await page.waitForSelector('dialog[open]');
      check(`[${viewport.name}] 키보드로 카드 열기`, true);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));

      check(`[${viewport.name}] 콘솔 오류 없음`, consoleErrors.length === 0, consoleErrors.join(' | '));

      // 접근성 기본 점검: 버튼 이름·h1 1개·lang·터치 타깃
      const a11y = await page.evaluate(() => {
        const namelessButtons = [...document.querySelectorAll('button')].filter(
          (button) => !button.textContent.trim() && !button.getAttribute('aria-label') && !button.querySelector('.sr-only'),
        ).length;
        const smallTargets = [...document.querySelectorAll('button, select, input, a.button')].filter(
          (node) => node.getBoundingClientRect().height > 0 && node.getBoundingClientRect().height < 32,
        ).length;
        return {
          namelessButtons,
          smallTargets,
          h1: document.querySelectorAll('h1').length,
          lang: document.documentElement.lang,
        };
      });
      check(`[${viewport.name}] 버튼 접근성 이름`, a11y.namelessButtons === 0, `${a11y.namelessButtons}개 누락`);
      check(`[${viewport.name}] h1 1개·lang=ko`, a11y.h1 === 1 && a11y.lang === 'ko', `h1=${a11y.h1}, lang=${a11y.lang}`);
      check(`[${viewport.name}] 터치 타깃 32px 이상`, a11y.smallTargets === 0, `${a11y.smallTargets}개 미달`);

      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter((result) => !result.ok);
  await writeFile(path.join(OUT_DIR, 'ui-check.json'), `${JSON.stringify({ results, failed: failed.length }, null, 2)}\n`);
  console.log(`\n${results.length - failed.length}/${results.length} 통과 · 스크린샷 ${OUT_DIR}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`✗ UI 검증 실패: ${error.message}`);
  process.exit(1);
});
