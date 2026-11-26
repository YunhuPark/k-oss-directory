#!/usr/bin/env node
/**
 * 헤드리스 브라우저 검증: 360px / 1280px에서
 *  - 가로 넘침 0 (scrollWidth <= clientWidth)
 *  - 검색·필터·정렬·상세 모달 동작
 *  - 콘솔 오류 0
 * 스크린샷을 --out(기본 downloads/k-oss-mvp)에 저장한다.
 *
 *   PUPPETEER_PATH=/path/to/node_modules/puppeteer node scripts/ui_check.mjs --out /workspace/downloads/k-oss-mvp
 */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from './serve.mjs';

const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer');

const outArg = process.argv.indexOf('--out');
const OUT_DIR = path.resolve(outArg > -1 ? process.argv[outArg + 1] : 'downloads/k-oss-mvp');

const VIEWPORTS = [
  { name: '360', width: 360, height: 800, deviceScaleFactor: 2 },
  { name: '1280', width: 1280, height: 900, deviceScaleFactor: 2 },
];

const results = [];
function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });

  try {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport(viewport);
      const consoleErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => consoleErrors.push(String(error)));

      await page.goto(base, { waitUntil: 'networkidle0' });
      await page.waitForSelector('.card');

      const total = await page.$$eval('.card', (cards) => cards.length);
      check(`[${viewport.name}] 카드 16개 렌더`, total === 16, `${total}개`);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        const limit = doc.clientWidth;
        const offenders = [];
        for (const element of document.querySelectorAll('body *')) {
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          if (rect.right <= limit + 1 && rect.left >= -1) continue;
          // 탭처럼 자체적으로 가로 스크롤되는 영역 안의 요소는 페이지 넘침이 아니다
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

      await page.screenshot({ path: path.join(OUT_DIR, `home-${viewport.name}.png`), fullPage: false });
      await page.screenshot({ path: path.join(OUT_DIR, `home-${viewport.name}-full.png`), fullPage: true });

      // 검색
      await page.click('#q');
      await page.type('#q', '차트', { delay: 20 });
      await page.waitForFunction(() => document.querySelectorAll('.card').length < 16);
      const searchHits = await page.$$eval('.card-title', (titles) => titles.map((t) => t.textContent.trim()));
      check(`[${viewport.name}] 검색 "차트"`, searchHits.includes('billboard.js'), searchHits.join(', '));
      await page.screenshot({ path: path.join(OUT_DIR, `search-${viewport.name}.png`) });
      await page.evaluate(() => {
        const input = document.getElementById('q');
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForFunction(() => document.querySelectorAll('.card').length === 16);

      // 필터: Docker
      await page.click('.chip[data-filter="docker"]');
      await page.waitForFunction(() => document.querySelectorAll('.card').length === 3);
      const dockerHits = await page.$$eval('.card-title', (titles) => titles.map((t) => t.textContent.trim()));
      check(`[${viewport.name}] Docker 필터`, dockerHits.length === 3, dockerHits.join(', '));
      await page.screenshot({ path: path.join(OUT_DIR, `filter-docker-${viewport.name}.png`) });

      // 필터: 상업 무료 + 한국어 문서 (AND)
      await page.click('.chip[data-filter="docker"]');
      await page.click('.chip[data-filter="commercial"]');
      await page.click('.chip[data-filter="korean"]');
      const andCount = await page.$$eval('.card', (cards) => cards.length);
      check(`[${viewport.name}] 상업 무료 ∩ 한국어 문서`, andCount === 6, `${andCount}개`);

      // 필터 해제 + 정렬
      await page.click('#reset');
      await page.waitForFunction(() => document.querySelectorAll('.card').length === 16);
      await page.select('#sort', 'updated');
      const firstUpdated = await page.$eval('.card-title', (el) => el.textContent.trim());
      check(`[${viewport.name}] 최신 업데이트 정렬`, firstUpdated === 'billboard.js' || firstUpdated === 'seed-design', firstUpdated);
      await page.select('#sort', 'stars');
      const firstStar = await page.$eval('.card-title', (el) => el.textContent.trim());
      check(`[${viewport.name}] 스타순 정렬`, firstStar === 'tui.editor', firstStar);

      // 상세 모달
      await page.click('.card');
      await page.waitForSelector('dialog[open]');
      const dialogTitle = await page.$eval('#detail-title', (el) => el.textContent.trim());
      check(`[${viewport.name}] 상세 모달 열림`, dialogTitle.length > 0, dialogTitle);
      const dialogOverflow = await page.evaluate(() => {
        const dialog = document.querySelector('dialog[open]');
        const rect = dialog.getBoundingClientRect();
        return rect.right <= window.innerWidth + 1 && rect.width <= window.innerWidth;
      });
      check(`[${viewport.name}] 모달이 화면 안에`, dialogOverflow);
      await page.screenshot({ path: path.join(OUT_DIR, `detail-${viewport.name}.png`) });

      await page.click('.detail-close');
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      check(`[${viewport.name}] 모달 닫힘`, true);

      // URL 해시 공유 상태
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

      // 접근성 기본 점검: 버튼 이름·이미지 대체텍스트·h1 1개
      const a11y = await page.evaluate(() => {
        const namelessButtons = [...document.querySelectorAll('button')].filter(
          (button) => !button.textContent.trim() && !button.getAttribute('aria-label'),
        ).length;
        return {
          namelessButtons,
          h1: document.querySelectorAll('h1').length,
          lang: document.documentElement.lang,
          srOnlyFocusable: [...document.querySelectorAll('.sr-only')].length,
        };
      });
      check(`[${viewport.name}] 버튼 접근성 이름`, a11y.namelessButtons === 0, `${a11y.namelessButtons}개 누락`);
      check(`[${viewport.name}] h1 1개·lang=ko`, a11y.h1 === 1 && a11y.lang === 'ko', `h1=${a11y.h1}, lang=${a11y.lang}`);

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
