#!/usr/bin/env node
/**
 * 라이브 사이트(k-oss-directory.pages.dev) 확인: HTTP 200 · 수록 수 · 더 보기 ·
 * 유의어 검색(화면) · k-ui-ux 검색 · 가로 넘침 0 · 콘솔 오류 0 · 스크린샷.
 *
 *   PUPPETEER_PATH=/path/to/puppeteer node scripts/live_check.mjs [--out downloads/k-oss-mvp] [--tag live-v7]
 *
 * 로컬 검증(scripts/ui_check.mjs)이 통과한 뒤 배포본까지 한 번 더 확인할 때 쓴다.
 */
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { hasMcpSkill } from '../public/lib/filter.mjs';
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer');

const BASE = process.env.LIVE_BASE || 'https://k-oss-directory.pages.dev/';
const argOf = (flag, fallback) => {
  const at = process.argv.indexOf(flag);
  return at > -1 ? process.argv[at + 1] : fallback;
};
const OUT = argOf('--out', 'downloads/k-oss-mvp');
const TAG = argOf('--tag', 'live');
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});

async function typeQuery(page, text) {
  await page.evaluate(() => {
    const input = document.getElementById('q');
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise((resolve) => setTimeout(resolve, 150));
  await page.click('#q');
  await page.type('#q', text, { delay: 15 });
}

await mkdir(OUT, { recursive: true });

/** 배포된 catalog.json으로 MCP · 스킬 항목 수를 센다(로컬 filter.mjs 판별과 같은 규칙). */
const liveCatalog = await (await fetch(new URL('./data/catalog.json', BASE))).json();
const mcpTotal = (liveCatalog.repos ?? []).filter((repo) => hasMcpSkill(repo)).length;

try {
  for (const viewport of [
    { name: '360', width: 360, height: 800, deviceScaleFactor: 2 },
    { name: '1280', width: 1280, height: 900, deviceScaleFactor: 2 },
  ]) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    const response = await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    check(`[${viewport.name}] HTTP ${response.status()}`, response.status() === 200, BASE);
    await page.waitForSelector('.card');

    // 아바타가 실제로 그려지는지(숨은 <img>만 있고 src가 비면 이니셜만 뜬다 — 회귀 방지)
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
    const avatars = await page.evaluate(() => {
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
        sample: images.slice(0, 2).map((image) => image.getAttribute('src')),
      };
    });
    check(
      `[${viewport.name}] 첫 화면 아바타 ${avatars.loaded}/${avatars.images} 실제 로드`,
      avatars.inView > 0 && avatars.loaded >= Math.ceil(avatars.images * 0.8),
      `화면 안 타일 ${avatars.inView} · ${avatars.sample.filter(Boolean).join(', ')}`,
    );

    const catalog = await page.evaluate(async () => {
      const res = await fetch('./data/catalog.json', { cache: 'no-store' });
      const json = await res.json();
      return { count: json.count, generatedAt: json.generatedAt };
    });
    const cards = await page.$$eval('.card', (nodes) => nodes.length);
    const moreText = await page.$eval('#load-more', (node) => node.textContent.trim());
    const stats = await page.$eval('#catalog-stats', (node) => node.textContent.replace(/\s+/g, ' ').trim());
    check(
      `[${viewport.name}] 수록 ${catalog.count}개 · 첫 화면 ${cards}개`,
      catalog.count >= 1300 && cards === 24,
      moreText,
    );
    check(`[${viewport.name}] 푸터 수록 현황`, stats.includes(String(catalog.count)), stats);

    // 칩 비율: 고정 min-width를 풀고 글자 길이에 맞춘 자연 폭·34~36px 높이·13.5px 글자
    const tabBalance = await page.evaluate(() => {
      const measure = (node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const box = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          label: node.textContent.trim(),
          w: Math.round(box.width * 10) / 10,
          t: Math.round(range.getBoundingClientRect().width * 10) / 10,
          h: Math.round(box.height * 10) / 10,
          pad: parseFloat(style.paddingLeft),
          font: parseFloat(style.fontSize),
          min: style.minWidth,
        };
      };
      return [...document.querySelectorAll('#tabs .tab')].map(measure);
    });
    const tabFits = tabBalance.every(
      (tab) =>
        tab.font >= 13.4 &&
        tab.h >= 33 &&
        tab.h <= 37 &&
        tab.w >= tab.t + tab.pad * 2 - 1 &&
        tab.w <= tab.t + tab.pad * 2 + 3 &&
        (!/^[\d.]+px$/.test(tab.min) || parseFloat(tab.min) === 0),
    );
    check(
      `[${viewport.name}] 카테고리 칩 글자 대비 박스 비율`,
      tabBalance.length === 6 && tabFits,
      `${tabBalance.map((tab) => `${tab.label} ${tab.w}/${tab.t}`).join(' · ')} · 높이 ${tabBalance[0]?.h} · 글자 ${tabBalance[0]?.font}`,
    );

    await page.click('#filter-toggle');
    await page.waitForFunction(() => !document.getElementById('filter-panel').hidden);
    const chipBalance = await page.evaluate(() => {
      const measure = (node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const box = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          label: node.textContent.trim(),
          w: Math.round(box.width * 10) / 10,
          t: Math.round(range.getBoundingClientRect().width * 10) / 10,
          h: Math.round(box.height * 10) / 10,
          pad: parseFloat(style.paddingLeft),
          font: parseFloat(style.fontSize),
        };
      };
      const track = getComputedStyle(document.getElementById('chips'));
      return { chips: [...document.querySelectorAll('#chips .chip')].map(measure), display: track.display, wrap: track.flexWrap };
    });
    const chipFits = chipBalance.chips.every(
      (chip) =>
        chip.font >= 13.4 &&
        chip.h >= 33 &&
        chip.h <= 37 &&
        chip.w >= chip.t + chip.pad * 2 &&
        chip.w <= chip.t + chip.pad * 2 + 18,
    );
    check(
      `[${viewport.name}] 필터 칩 자연 폭·높이 통일`,
      chipBalance.chips.length === 5 && chipBalance.display === 'flex' && chipBalance.wrap === 'wrap' && chipFits,
      `${chipBalance.chips.map((chip) => `${chip.label} ${chip.w}/${chip.t}`).join(' · ')} · 높이 ${chipBalance.chips[0]?.h}`,
    );
    await page.click('#filter-toggle');
    await page.waitForFunction(() => document.getElementById('filter-panel').hidden);


    await page.click('#load-more');
    await page.waitForFunction(() => document.querySelectorAll('.card').length === 48);
    const after = await page.$eval('#load-more', (node) => node.textContent.trim());
    check(`[${viewport.name}] 더 보기 1회 → 48개`, true, after);

    // 유의어 검색: '화면' → UI·프론트엔드 항목이 관련도 순으로
    await typeQuery(page, '화면');
    await page.waitForFunction(() => document.querySelectorAll('.card').length === 24);
    const screenTitles = await page.$$eval('.card-title', (nodes) => nodes.map((node) => node.textContent.trim()));
    const screenCount = await page.$eval('#count b', (node) => node.textContent);
    const sortValue = await page.$eval('#sort', (node) => node.dataset.value);
    check(
      `[${viewport.name}] 유의어 검색 "화면" → ${screenCount}개 표시`,
      screenTitles.includes('storybook') && screenTitles.includes('k-style-ui-ux') && sortValue === 'relevance',
      screenTitles.slice(0, 6).join(', '),
    );

    // 토큰 검색: 'k-ui-ux' → 'k-style-ui-ux'
    await typeQuery(page, 'k-ui-ux');
    await page.waitForFunction(() => document.querySelectorAll('.card').length === 1);
    const tokenTitles = await page.$$eval('.card-title', (nodes) => nodes.map((node) => node.textContent.trim()));
    check(
      `[${viewport.name}] k-ui-ux 검색 → k-style-ui-ux`,
      tokenTitles.length === 1 && tokenTitles[0] === 'k-style-ui-ux',
      tokenTitles.join(', '),
    );

    // MCP · 스킬 필터: 칩을 눌러 배지·개수·해시가 함께 따라오는지
    // 앞 단계의 'k-ui-ux' 검색을 이어받지 않도록 첫 화면부터 다시 연다.
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.card');
    await page.click('#filter-toggle');
    await page.waitForFunction(() => !document.getElementById('filter-panel').hidden);
    await page.click('.chip[data-filter="mcp"]');
    await page.waitForFunction(
      (expected) => document.getElementById('count').textContent.includes(String(expected)),
      {},
      mcpTotal,
    );
    const mcpState = await page.evaluate(() => ({
      hash: location.hash,
      cards: document.querySelectorAll('.card').length,
      badges: document.querySelectorAll('.card .badge-mcp').length,
      count: document.getElementById('count').textContent.replace(/\s+/g, ' ').trim(),
      chip: document.querySelector('.chip[data-filter="mcp"]').textContent.trim(),
      pressed: document.querySelector('.chip[data-filter="mcp"]').getAttribute('aria-pressed'),
    }));
    check(
      `[${viewport.name}] MCP · 스킬 필터 — ${mcpTotal}개 중 ${mcpState.cards}개 표시`,
      mcpState.chip === 'MCP · 스킬' &&
        mcpState.pressed === 'true' &&
        mcpState.cards === 24 &&
        mcpState.badges === 24 &&
        mcpState.hash.includes('f=mcp'),
      `${mcpState.count} · 배지 ${mcpState.badges} · ${mcpState.hash}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 400));
    await page.screenshot({ path: `${OUT}/${TAG}-mcp-${viewport.name}.png` });

    // 링크로 바로 들어와도 같게 열린다(#f=mcp)
    await page.goto(`${BASE}#f=mcp`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.card');
    const mcpHashState = await page.evaluate(() => ({
      panelOpen: !document.getElementById('filter-panel').hidden,
      pressed: document.querySelector('.chip[data-filter="mcp"]')?.getAttribute('aria-pressed'),
      badges: document.querySelectorAll('.card .badge-mcp').length,
      count: document.getElementById('count').textContent.replace(/\s+/g, ' ').trim(),
    }));
    check(
      `[${viewport.name}] #f=mcp 링크 복원 — ${mcpHashState.badges}개 카드 배지`,
      mcpHashState.panelOpen &&
        mcpHashState.pressed === 'true' &&
        mcpHashState.badges === 24 &&
        mcpHashState.count.includes(String(mcpTotal)),
      mcpHashState.count,
    );

    // 첫 화면으로 돌아와 정렬·칩 상태를 확인하고 캡처
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.card');
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // 정렬: 네이티브 select 대신 커스텀 드롭다운이 라이브에도 실려 있는지
    const starsTitle = await page.$eval('.card-title', (node) => node.textContent.trim());
    const sortClosed = await page.evaluate(() => ({
      nativeSelects: document.querySelectorAll('select').length,
      tag: document.getElementById('sort').tagName,
      value: document.getElementById('sort').dataset.value,
      label: document.getElementById('sort-value').textContent.trim(),
      hidden: document.getElementById('sort-menu').hidden,
      expanded: document.getElementById('sort').getAttribute('aria-expanded'),
    }));
    await page.click('#sort');
    await page.waitForFunction(() => !document.getElementById('sort-menu').hidden);
    await new Promise((resolve) => setTimeout(resolve, 320));
    const sortMenu = await page.evaluate(() => {
      const menu = document.getElementById('sort-menu');
      const box = menu.getBoundingClientRect();
      const options = [...menu.querySelectorAll('.sort-option')];
      return {
        role: menu.getAttribute('role'),
        expanded: document.getElementById('sort').getAttribute('aria-expanded'),
        options: options.length,
        roleOk: options.every((option) => option.getAttribute('role') === 'option'),
        checked: options
          .filter((option) => getComputedStyle(option.querySelector('.sort-check')).visibility === 'visible')
          .map((option) => option.textContent.trim()),
        selected: options
          .filter((option) => option.getAttribute('aria-selected') === 'true')
          .map((option) => option.textContent.trim()),
        radius: parseFloat(getComputedStyle(menu).borderTopLeftRadius),
        bg: getComputedStyle(menu).backgroundColor,
        pageBg: getComputedStyle(document.body).backgroundColor,
        font: parseFloat(getComputedStyle(options[0]).fontSize),
        inside: box.left >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight,
        above: Boolean(
          document
            .elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
            ?.closest('#sort-menu'),
        ),
      };
    });
    check(
      `[${viewport.name}] 정렬 커스텀 드롭다운(select 없음·listbox 4개)`,
      sortClosed.nativeSelects === 0 &&
        sortClosed.tag === 'BUTTON' &&
        sortClosed.value === 'stars' &&
        sortClosed.label === '스타 많은 순' &&
        sortClosed.hidden &&
        sortClosed.expanded === 'false' &&
        sortMenu.role === 'listbox' &&
        sortMenu.expanded === 'true' &&
        sortMenu.options === 4 &&
        sortMenu.roleOk &&
        sortMenu.checked.length === 1 &&
        sortMenu.selected[0] === '스타 많은 순' &&
        sortMenu.radius === 12 &&
        sortMenu.bg !== sortMenu.pageBg &&
        sortMenu.font >= 13.5 &&
        sortMenu.inside &&
        sortMenu.above,
      `select ${sortClosed.nativeSelects}개 · ${sortMenu.options}개 항목 · ✓ ${sortMenu.checked.join(',')} · radius ${sortMenu.radius} · ${sortMenu.font}px · 화면 안 ${sortMenu.inside} · 카드 위 ${sortMenu.above}`,
    );
    await page.screenshot({ path: `${OUT}/${TAG}-sort-open${viewport.name === '1280' ? '' : `-${viewport.name}`}.png` });

    // 항목을 고르면 정렬·해시가 바뀌고 메뉴가 닫힌다
    await page.click('.sort-option[data-sort="updated"]');
    await page.waitForFunction(() => document.getElementById('sort').getAttribute('aria-expanded') === 'false');
    const sortPicked = await page.evaluate(() => ({
      value: document.getElementById('sort').dataset.value,
      label: document.getElementById('sort-value').textContent.trim(),
      hash: location.hash,
      hidden: document.getElementById('sort-menu').hidden,
      first: document.querySelector('.card-title')?.textContent.trim(),
    }));
    check(
      `[${viewport.name}] 정렬 선택 → 최신 업데이트 순 반영`,
      sortPicked.value === 'updated' &&
        sortPicked.label === '최신 업데이트 순' &&
        sortPicked.hash.includes('sort=updated') &&
        sortPicked.hidden &&
        sortPicked.first !== starsTitle,
      `"${sortPicked.label}" · ${sortPicked.hash} · 첫 카드 ${starsTitle} → ${sortPicked.first}`,
    );
    await page.click('#sort');
    await page.waitForFunction(() => !document.getElementById('sort-menu').hidden);
    await page.click('.sort-option[data-sort="stars"]');
    await page.waitForFunction(
      (expected) => document.querySelector('.card-title')?.textContent.trim() === expected,
      {},
      starsTitle,
    );
    const sortRestored = await page.evaluate(() => ({
      value: document.getElementById('sort').dataset.value,
      hash: location.hash,
    }));
    check(
      `[${viewport.name}] 스타순으로 되돌림`,
      sortRestored.value === 'stars' && !sortRestored.hash.includes('sort='),
      `${sortRestored.value} · ${sortRestored.hash || '(해시 없음)'}`,
    );

    await page.screenshot({ path: `${OUT}/${TAG}-${viewport.name}.png` });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    check(`[${viewport.name}] 가로 넘침 0`, overflow);
    check(`[${viewport.name}] 콘솔 오류 0`, errors.length === 0, errors.join(' | '));
    await page.close();
  }

  const head = await fetch(BASE);
  check('라이브 index.html 200', head.status === 200, `content-type ${head.headers.get('content-type')}`);
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} 통과 · 스크린샷 ${OUT}/${TAG}-*.png`);
if (failed.length) process.exitCode = 1;
