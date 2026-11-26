#!/usr/bin/env node
/**
 * 로컬 미리보기 서버: public/ 을 그대로 서빙한다(빌드 없음).
 *   node scripts/serve.mjs [--port 4173]
 * Cloudflare Pages도 같은 방식(정적 파일)으로 서빙하므로 미리보기 = 배포본에 가깝다.
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const portArg = process.argv.indexOf('--port');
const PORT = Number(portArg > -1 ? process.argv[portArg + 1] : process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export function createServer(root = ROOT) {
  return http.createServer(async (request, response) => {
    try {
      const url = decodeURIComponent((request.url ?? '/').split('?')[0]);
      const relative = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
      const file = path.join(root, relative);
      // 경로 탈출(../) 방지: root 자체이거나 root 바로 아래 경로만 허용
      if (file !== root && !file.startsWith(root + path.sep)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const info = await stat(file).catch(() => null);
      const target = info?.isDirectory() ? path.join(file, 'index.html') : file;
      const body = await readFile(target);
      response.writeHead(200, {
        'content-type': TYPES[path.extname(target)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(body);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, () => {
    console.log(`K-OSS Directory → http://localhost:${PORT}`);
  });
}
