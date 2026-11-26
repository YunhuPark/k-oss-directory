/**
 * 순수 함수 모음: GitHub API 응답 + 큐레이션 정보 → catalog.json 항목.
 * 네트워크·파일 접근은 여기에 없다(sync_repos.mjs / seed_from_gh.mjs 담당).
 */

/** 카테고리 키 → 화면에 보이는 이름 */
export const CATEGORIES = {
  frontend: '프론트엔드',
  ai: 'AI·데이터',
  backend: '백엔드·인프라',
  tool: '개발 도구',
  learn: '학습·자료',
};

/**
 * 회사 서비스에 그대로 써도 된다고 판단하는 SPDX 라이선스.
 * OFL-1.1은 글꼴을 앱·웹에 임베드해 배포해도 되는 라이선스라 폰트 저장소에 한해 허용한다
 * (OFL은 폰트 자체를 유료로 재판매하는 것만 막는다).
 */
export const COMMERCIAL_LICENSES = new Set([
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'MPL-2.0',
  'CC0-1.0',
  'Unlicense',
  '0BSD',
  'OFL-1.1',
]);

/** "최근"의 기준: 3개월 */
export const RECENT_MONTHS = 3;

/** 한국어 README로 인정하는 최소 한글 글자 수 */
export const KOREAN_README_MIN_HANGUL = 100;

const KOREAN_README_FILE = /^readme[-_.]?(ko|kr)([-_.][a-z]{2,4})?\.md$/i;

export function isCommercialLicense(spdx) {
  if (!spdx || typeof spdx !== 'string') return false;
  return COMMERCIAL_LICENSES.has(spdx);
}

export function countHangul(text) {
  if (!text) return 0;
  const matches = String(text).match(/[\uAC00-\uD7A3]/g);
  return matches ? matches.length : 0;
}

export function hasKoreanReadmeFile(rootNames = []) {
  return rootNames.some((name) => KOREAN_README_FILE.test(name));
}

/**
 * 한국어 문서 지원 판정.
 * 1) 큐레이션 값이 있으면 그것을 쓴다(source: curated)
 * 2) 없으면 README 한글 비중 또는 README.ko.md 계열 파일 존재로 판정(source: readme)
 */
export function detectKoreanDocs({ curated, readmeText, rootNames = [] }) {
  if (typeof curated === 'boolean') {
    return { value: curated, source: 'curated' };
  }
  if (hasKoreanReadmeFile(rootNames)) {
    return { value: true, source: 'readme' };
  }
  if (countHangul(readmeText) >= KOREAN_README_MIN_HANGUL) {
    return { value: true, source: 'readme' };
  }
  return { value: false, source: 'readme' };
}

/** Docker 판정: 큐레이션 값 → 루트 Dockerfile → topics */
export function detectDocker({ curated, rootNames = [], topics = [] }) {
  if (typeof curated === 'boolean') {
    return { value: curated, source: 'curated' };
  }
  if (rootNames.includes('Dockerfile')) {
    return { value: true, source: 'detected' };
  }
  if (topics.some((topic) => String(topic).toLowerCase() === 'docker')) {
    return { value: true, source: 'detected' };
  }
  return { value: false, source: 'none' };
}

export function monthsAgo(now, months) {
  const d = new Date(now.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export function isRecent(pushedAt, now, months = RECENT_MONTHS) {
  const pushed = Date.parse(pushedAt);
  if (Number.isNaN(pushed)) return false;
  return pushed >= monthsAgo(now, months).getTime();
}

function ownerOf(fullName = '') {
  const [owner = '', name = ''] = String(fullName).split('/');
  return { owner, name };
}

/** 조회에 실패한 저장소: 큐레이션 정보만으로 최소 항목을 만든다(사이트에서 사라지지 않게). */
export function buildStaleEntry(curated, now) {
  const { owner, name } = ownerOf(curated.repo);
  return {
    repo: curated.repo,
    name,
    owner,
    vendor: curated.vendor,
    category: curated.category,
    summary: curated.summary,
    tags: curated.tags ?? [],
    description: '',
    stars: null,
    forks: null,
    openIssues: null,
    language: null,
    license: curated.license ?? null,
    licenseName: null,
    licenseSource: curated.license ? 'curated' : 'none',
    commercialUse: isCommercialLicense(curated.license),
    homepage: null,
    pushedAt: null,
    updatedAt: null,
    createdAt: null,
    archived: false,
    defaultBranch: null,
    topics: [],
    koreanDocs: curated.koreanDocs === true,
    koreanDocsSource: curated.koreanDocs === true ? 'curated' : 'none',
    docker: curated.docker === true,
    dockerSource: curated.docker === true ? 'curated' : 'none',
    url: `https://github.com/${curated.repo}`,
    recent: false,
    stale: true,
  };
}

/** 정상 항목 하나 만들기 */
export function buildEntry({ curated, repo, readmeText, rootNames, now }) {
  const { owner, name } = ownerOf(curated.repo);
  const topics = Array.isArray(repo.topics) ? repo.topics : [];
  const korean = detectKoreanDocs({ curated: curated.koreanDocs, readmeText, rootNames });
  const docker = detectDocker({ curated: curated.docker, rootNames, topics });
  // GitHub이 라이선스를 잘못 읽는 저장소(예: OFL 전문에 저작권 고지가 여러 개 붙은 폰트)는
  // 사람이 LICENSE 원문을 확인한 값(curated.license)을 쓴다. 그 사실을 licenseSource에 남긴다.
  const apiLicense = repo.license?.spdx_id ?? null;
  const license = curated.license ?? apiLicense;

  return {
    repo: curated.repo,
    name: repo.name ?? name,
    owner: repo.owner?.login ?? owner,
    vendor: curated.vendor,
    category: curated.category,
    summary: curated.summary,
    tags: curated.tags ?? [],
    description: repo.description ?? '',
    stars: Number.isFinite(repo.stargazers_count) ? repo.stargazers_count : null,
    forks: Number.isFinite(repo.forks_count) ? repo.forks_count : null,
    openIssues: Number.isFinite(repo.open_issues_count) ? repo.open_issues_count : null,
    language: repo.language ?? null,
    license,
    licenseName: curated.license ? curated.licenseName ?? null : repo.license?.name ?? null,
    licenseSource: curated.license ? 'curated' : apiLicense ? 'github' : 'none',
    commercialUse: isCommercialLicense(license),
    homepage: repo.homepage && repo.homepage.trim() ? repo.homepage.trim() : null,
    pushedAt: repo.pushed_at ?? null,
    updatedAt: repo.updated_at ?? null,
    createdAt: repo.created_at ?? null,
    archived: Boolean(repo.archived),
    defaultBranch: repo.default_branch ?? null,
    topics,
    koreanDocs: korean.value,
    koreanDocsSource: korean.source,
    docker: docker.value,
    dockerSource: docker.source,
    url: `https://github.com/${curated.repo}`,
    recent: isRecent(repo.pushed_at, now),
    stale: false,
  };
}

/**
 * 전체 카탈로그 생성.
 * client: { getRepo(fullName), getReadme(fullName), getRootNames(fullName) }
 * 한 저장소가 실패해도 나머지를 만들고, 이전 카탈로그 값이 있으면 그 값을 유지한다.
 * concurrency: 동시에 조회할 저장소 수(기본 4). 결과 순서는 입력 순서와 같다.
 */
export async function buildCatalog({ curatedList, client, now = new Date(), previousRepos = [], concurrency = 4 }) {
  const previous = new Map(previousRepos.map((entry) => [entry.repo, entry]));
  const entries = new Array(curatedList.length);
  const errors = [];

  async function buildOne(curated) {
    try {
      const repo = await client.getRepo(curated.repo);
      if (!repo) {
        throw new Error(`저장소를 찾을 수 없음: ${curated.repo}`);
      }
      let readmeText = null;
      let rootNames = [];
      try {
        [readmeText, rootNames] = await Promise.all([
          client.getReadme(curated.repo),
          client.getRootNames(curated.repo),
        ]);
      } catch (readmeError) {
        // README/루트 목록 실패는 치명적이지 않다. 큐레이션 값으로 계속 간다.
        errors.push({ repo: curated.repo, stage: 'readme', reason: String(readmeError.message ?? readmeError) });
      }
      return buildEntry({ curated, repo, readmeText, rootNames, now });
    } catch (error) {
      const reason = String(error.message ?? error);
      errors.push({ repo: curated.repo, stage: 'repo', reason });
      return previous.get(curated.repo) ?? buildStaleEntry(curated, now);
    }
  }

  let next = 0;
  const size = Math.max(1, Math.min(Number(concurrency) || 1, curatedList.length || 1));
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < curatedList.length) {
        const index = next;
        next += 1;
        entries[index] = await buildOne(curatedList[index]);
      }
    }),
  );

  if (curatedList.length > 0 && errors.filter((e) => e.stage === 'repo').length === curatedList.length) {
    throw new Error('모든 저장소 조회에 실패했습니다. 기존 카탈로그를 덮어쓰지 않습니다.');
  }

  return {
    catalog: {
      generatedAt: now.toISOString(),
      recentSince: monthsAgo(now, RECENT_MONTHS).toISOString(),
      source: 'github-api',
      count: entries.length,
      repos: entries,
    },
    errors,
  };
}

/** 파일을 쓰기 전 스키마 검증: 깨진 데이터로 사이트가 비는 것을 막는다. */
export function assertCatalog(catalog) {
  const problems = [];
  if (!catalog || typeof catalog !== 'object') problems.push('catalog가 객체가 아닙니다');
  if (!catalog?.generatedAt || Number.isNaN(Date.parse(catalog.generatedAt))) problems.push('generatedAt이 없습니다');
  if (!Array.isArray(catalog?.repos)) problems.push('repos가 배열이 아닙니다');
  if (problems.length === 0 && catalog.repos.length === 0) problems.push('repos가 비어 있습니다');

  for (const entry of catalog?.repos ?? []) {
    if (!entry.repo || !String(entry.repo).includes('/')) problems.push(`repo 형식 오류: ${JSON.stringify(entry.repo)}`);
    if (typeof entry.summary !== 'string' || entry.summary.length === 0) problems.push(`summary 없음: ${entry.repo}`);
    if (!(entry.stars === null || typeof entry.stars === 'number')) problems.push(`stars 형식 오류: ${entry.repo}`);
    if (!CATEGORIES[entry.category]) problems.push(`알 수 없는 카테고리: ${entry.repo} (${entry.category})`);
    if (typeof entry.koreanDocs !== 'boolean') problems.push(`koreanDocs 형식 오류: ${entry.repo}`);
    if (typeof entry.docker !== 'boolean') problems.push(`docker 형식 오류: ${entry.repo}`);
    if (typeof entry.commercialUse !== 'boolean') problems.push(`commercialUse 형식 오류: ${entry.repo}`);
  }

  if (problems.length > 0) {
    throw new Error(`카탈로그 검증 실패:\n- ${problems.join('\n- ')}`);
  }
  return true;
}
