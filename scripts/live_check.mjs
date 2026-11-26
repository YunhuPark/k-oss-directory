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

    await page.click('#load-more');
    await page.waitForFunction(() => document.querySelectorAll('.card').length === 48);
    const after = await page.$eval('#load-more', (node) => node.textContent.trim());
    check(`[${viewport.name}] 더 보기 1회 → 48개`, true, after);

    // 유의어 검색: '화면' → UI·프론트엔드 항목이 관련도 순으로
    await typeQuery(page, '화면');
    await page.waitForFunction(() => document.querySelectorAll('.card').length === 24);
    const screenTitles = await page.$$eval('.card-title', (nodes) => nodes.map((node) => node.textContent.trim()));
    const screenCount = await page.$eval('#count b', (node) => node.textContent);
    const sortValue = await page.$eval('#sort', (node) => node.value);
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

    // 첫 화면으로 돌아와 캡처
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.card');
    await new Promise((resolve) => setTimeout(resolve, 1500));
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
