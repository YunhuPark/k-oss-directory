#!/usr/bin/env node
/**
 * 헤드리스 브라우저 검증: 360px / 1280px에서
 *  - 카드 수·지표판·검색·필터·정렬·모달이 catalog.json과 일치하는지
 *  - 가로 넘침 0 (scrollWidth <= clientWidth)
 *  - 다크 모드 토글·localStorage 저장·새로고침 유지
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
function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

/** 화면에 그려져야 하는 카드 이름 목록(카탈로그 기준 기대값) */
function expectedNames(repos, options) {
  return selectRepos(repos, options).map((repo) => repo.name);
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

      const metrics = await page.$$eval('.metric', (nodes) =>
        nodes.map((node) => ({
          value: node.querySelector('.metric-value')?.textContent.trim(),
          label: node.querySelector('.metric-label')?.textContent.trim(),
          note: node.querySelector('.metric-note')?.textContent.trim(),
        })),
      );
      const expectedMetrics = [
        [String(total), 'REPOS', '국산 저장소'],
        [String(koreanCount), 'KOREAN DOCS', '한국어 문서'],
        [String(commercialCount), 'COMMERCIAL', '상업 무료 라이선스'],
        [String(dockerCount), 'DOCKER', 'Dockerfile 확인'],
      ];
      check(
        `[${viewport.name}] 지표판 4칸`,
        metrics.length === 4 && metrics.every((m, i) => m.value === expectedMetrics[i][0] && m.label === expectedMetrics[i][1]),
        JSON.stringify(metrics.map((m) => `${m.label}=${m.value}`)),
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
      await screenshot(page, path.join(OUT_DIR, `home-${viewport.name}-full.png`), viewport, { fullPage: true });

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

      // 상세 모달
      await page.click('.card');
      await page.waitForSelector('dialog[open]');
      const dialogTitle = await page.$eval('#detail-title', (el) => el.textContent.trim());
      const evidenceCount = await page.$$eval('.evidence-item', (nodes) => nodes.length);
      check(`[${viewport.name}] 상세 모달 열림`, dialogTitle.length > 0 && evidenceCount >= 4, `${dialogTitle} · 근거 ${evidenceCount}`);
      const dialogOverflow = await page.evaluate(() => {
        const dialog = document.querySelector('dialog[open]');
        const rect = dialog.getBoundingClientRect();
        return rect.right <= window.innerWidth + 1 && rect.width <= window.innerWidth;
      });
      check(`[${viewport.name}] 모달이 화면 안에`, dialogOverflow);
      await screenshot(page, path.join(OUT_DIR, `detail-${viewport.name}.png`), viewport);

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
