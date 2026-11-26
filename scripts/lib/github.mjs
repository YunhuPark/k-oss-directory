/**
 * GitHub REST API 클라이언트.
 * sync_repos.mjs(토큰 사용)와 seed_from_gh.mjs(gh CLI 사용)가 같은 인터페이스를 공유한다.
 */

const API_ROOT = 'https://api.github.com';

export function createGithubClient({ token, fetchImpl = globalThis.fetch, userAgent = 'k-oss-directory' } = {}) {
  const baseHeaders = {
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': userAgent,
  };
  if (token) baseHeaders.Authorization = `Bearer ${token}`;

  async function request(path, { accept = 'application/vnd.github+json' } = {}) {
    const response = await fetchImpl(`${API_ROOT}${path}`, {
      headers: { ...baseHeaders, Accept: accept },
    });

    if (response.status === 404) return null;

    if (!response.ok) {
      const remaining = response.headers?.get?.('x-ratelimit-remaining');
      const suffix = remaining === '0' ? ' (API 호출 한도 소진)' : '';
      throw new Error(`GitHub ${response.status} ${path}${suffix}`);
    }
    return response;
  }

  return {
    async getRepo(fullName) {
      const response = await request(`/repos/${fullName}`);
      return response ? response.json() : null;
    },

    /** README 원문(한국어 판정용). 없으면 null */
    async getReadme(fullName) {
      const response = await request(`/repos/${fullName}/readme`, { accept: 'application/vnd.github.raw' });
      if (!response) return null;
      const text = await response.text();
      return text.length > 400_000 ? text.slice(0, 400_000) : text;
    },

    /** 루트 파일 이름 목록(Dockerfile·README.ko.md 판정용). 실패는 빈 배열로 처리 */
    async getRootNames(fullName) {
      const response = await request(`/repos/${fullName}/contents`);
      if (!response) return [];
      const items = await response.json();
      return Array.isArray(items) ? items.map((item) => item.name) : [];
    },
  };
}
