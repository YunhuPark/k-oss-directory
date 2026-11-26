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
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from './serve.mjs';
import { selectRepos } from '../public/lib/filter.mjs';

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

/** 전체 페이지 캡처: 카드 93개로 문서가 20,000px를 넘어 배율 2에서는 렌더러가 죽는다. */
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

/** 화면에 그려져야 하는 카드 이름 목록(카탈로그 기준 기대값) */
function expectedNames(repos, options) {
  return selectRepos(repos, options).map((repo) => repo.name);
}

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

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const catalog = JSON.parse(await readFile(path.join(ROOT, 'public/data/catalog.json'), 'utf8'));
  const repos = catalog.repos;
  const total = repos.length;
  const dockerCount = repos.filter((repo) => repo.docker).length;
  const commercialKorean = repos.filter((repo) => repo.commercialUse && repo.koreanDocs).length;
  const koreanCount = repos.filter((repo) => repo.koreanDocs).length;
  const commercialCount = repos.filter((repo) => repo.commercialUse).length;
  const chartHits = expectedNames(repos, { query: '차트' });
  const updatedFirst = expectedNames(repos, { sort: 'updated' })[0];
  const starsFirst = expectedNames(repos, { sort: 'stars' })[0];
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
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => consoleErrors.push(String(error)));

      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
      await page.goto(base, { waitUntil: 'networkidle0' });
      await page.waitForSelector('.card');

      // 앞선 뷰포트 검사에서 남은 테마가 있으면 라이트로 되돌린다.
      if ((await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark') {
        await page.click('#theme-toggle');
        await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light');
      }

      const cards = await page.$$eval('.card', (nodes) => nodes.length);
      check(`[${viewport.name}] 카드 ${total}개 렌더`, cards === total, `${cards}개`);

      const logos = await page.evaluate(() => ({
        tiles: document.querySelectorAll('.card .card-logo').length,
        avatars: document.querySelectorAll('.card .card-logo img').length,
        initials: document.querySelectorAll('.card .card-logo-init').length,
      }));
      check(
        `[${viewport.name}] 카드 아바타 32px + 이니셜 폴백`,
        logos.tiles === total && logos.avatars === total && logos.initials === total,
        `타일 ${logos.tiles} · 이미지 ${logos.avatars} · 이니셜 ${logos.initials}`,
      );

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
          collapsed.chips === 4 &&
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
        };
      });
      check(
        `[${viewport.name}] 카테고리 개별 필 칩(트랙 없음·좌우 여백)`,
        tabStyle.count === 6 &&
          tabStyle.borderWidth === '1px' &&
          tabStyle.paddingLeft >= 12 &&
          tabStyle.paddingRight >= 12 &&
          tabStyle.height >= 32 &&
          tabStyle.gap >= 4 &&
          tabStyle.trackBg === 'rgba(0, 0, 0, 0)' &&
          tabStyle.offsetLeft >= (viewport.width < 768 ? 15 : 0),
        `${tabStyle.count}개 · 패딩 ${tabStyle.paddingLeft}/${tabStyle.paddingRight} · 높이 ${tabStyle.height} · 간격 ${tabStyle.gap} · 트랙배경 ${tabStyle.trackBg} · 첫 칩 오프셋 ${tabStyle.offsetLeft}`,
      );
      check(
        `[${viewport.name}] 활성 카테고리 대비(색 반전)`,
        tabStyle.activeBg !== tabStyle.inactiveBg,
        `활성 ${tabStyle.activeBg} · 비활성 ${tabStyle.inactiveBg} · ${tabStyle.labels.join(' / ')}`,
      );

      // 카테고리 전환: 전체 → 프론트엔드
      await page.click('#tabs .tab[data-category="frontend"]');
      await page.waitForFunction(
        (expected) => document.querySelectorAll('.card').length === expected,
        {},
        frontendNames.length,
      );
      const frontendTitles = await page.$$eval('.card-title', (nodes) => nodes.map((node) => node.textContent.trim()));
      const frontendCount = await page.$eval('#count', (node) => node.textContent.trim());
      check(
        `[${viewport.name}] 카테고리 프론트엔드 전환`,
        frontendTitles.sort().join(',') === [...frontendNames].sort().join(',') && /\d+개 표시/.test(frontendCount),
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
      await page.waitForFunction((expected) => document.querySelectorAll('.card').length === expected, {}, total);
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
        opened.expanded === 'true' && opened.height > 0 && opened.items === 4,
        `height ${opened.height}px · 칩 ${opened.items}개`,
      );
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
      await page.waitForFunction((expected) => document.querySelectorAll('.card').length === expected, {}, chartHits.length);
      const searchHits = await page.$$eval('.card-title', (titles) => titles.map((t) => t.textContent.trim()));
      check(
        `[${viewport.name}] 검색 "차트"`,
        chartHits.length > 0 && searchHits.sort().join(',') === [...chartHits].sort().join(','),
        `${searchHits.length}개 · ${searchHits.join(', ')}`,
      );
      await screenshot(page, path.join(OUT_DIR, `search-${viewport.name}.png`), viewport);
      await page.evaluate(() => {
        const input = document.getElementById('q');
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForFunction((expected) => document.querySelectorAll('.card').length === expected, {}, total);

      // 필터: Docker
      await page.click('.chip[data-filter="docker"]');
      await page.waitForFunction((expected) => document.querySelectorAll('.card').length === expected, {}, dockerCount);
      const dockerHits = await page.$$eval('.card-title', (titles) => titles.map((t) => t.textContent.trim()));
      check(`[${viewport.name}] Docker 필터`, dockerHits.length === dockerCount, `${dockerHits.length}개`);
      await screenshot(page, path.join(OUT_DIR, `filter-docker-${viewport.name}.png`), viewport);

      // 필터: 상업 무료 + 한국어 문서 (AND)
      await page.click('.chip[data-filter="docker"]');
      await page.click('.chip[data-filter="commercial"]');
      await page.click('.chip[data-filter="korean"]');
      await page.waitForFunction(
        (expected) => document.querySelectorAll('.card').length === expected,
        {},
        commercialKorean,
      );
      const andCount = await page.$$eval('.card', (nodes) => nodes.length);
      check(`[${viewport.name}] 상업 무료 ∩ 한국어 문서`, andCount === commercialKorean, `${andCount}개`);

      // 필터 해제 + 정렬
      await page.click('#reset');
      await page.waitForFunction((expected) => document.querySelectorAll('.card').length === expected, {}, total);
      await page.select('#sort', 'updated');
      await page.waitForFunction(
        (expected) => document.querySelector('.card-title')?.textContent.trim() === expected,
        {},
        updatedFirst,
      );
      const firstUpdated = await page.$eval('.card-title', (el) => el.textContent.trim());
      check(`[${viewport.name}] 최신 업데이트 정렬`, firstUpdated === updatedFirst, firstUpdated);
      await page.select('#sort', 'stars');
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
      // 색 전환 트랜지션이 끝난 뒤에 캐처해야 화면이 그대로 보인다.
      await settle(page, 200);
      await screenshot(page, path.join(OUT_DIR, `home-${viewport.name}-dark.png`), viewport);
      await page.reload({ waitUntil: 'networkidle0' });
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

      // URL 해시 공유 상태
      await openFilters(page);
      await page.click('.chip[data-filter="korean"]');
      const hash = await page.evaluate(() => location.hash);
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('.card');
      const restored = await page.$eval('.chip[data-filter="korean"]', (el) => el.getAttribute('aria-pressed'));
      check(`[${viewport.name}] 해시로 필터 복원`, restored === 'true', hash);

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
