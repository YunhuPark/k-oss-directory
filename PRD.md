# K-OSS Directory — 기획서 (PRD v0.2)

> 한국 개발자가 만든, 한국어로 쓸 수 있는 오픈소스를 한 화면에서 찾는 디렉토리.
> 저장소: `YunhuPark/k-oss-directory` · 작성일 2026-11-26 · v0.2 갱신 2026-11-26 · 상태: 40개 수록 · Cloudflare Pages 배포

---

## 1. 한 줄 정의

**"GitHub에서 한국 오픈소스를 찾는 5분을, 30초로."**

국산(한국 팀·기업·개인 개발자) 오픈소스 중 **실무에 바로 붙일 수 있는 것**만 골라,
한국어 문서 지원 여부·상업적 사용 가능 라이선스·Docker 실행 가능 여부·최근 업데이트를
한 줄로 비교할 수 있게 보여주는 정적 웹 디렉토리.

## 2. 왜 필요한가

GitHub Explore는 "트렌딩"만 보여주고, 국내 오픈소스는 다음 네 가지 이유로 검색에서 계속 걸러진다.

| 문제 | 실제로 겪는 일 |
|---|---|
| 언어 장벽 | README는 영어인데 문서·이슈는 한국어라 어디를 읽어야 할지 모른다 |
| 라이선스 불안 | 스타 수는 보이지만 "회사 서비스에 써도 되나"는 직접 LICENSE를 열어야 안다 |
| 실행 장벽 | 데모를 띄우려면 빌드 환경부터 맞춰야 한다 |
| 관리 여부 | 3년 전 커밋에서 멈춘 라이브러리를 붙였다가 나중에 갈아엎는다 |

기존 국내 큐레이션(블로그 글, awesome-list)은 **목록은 있지만 필터가 없다.**
GitHub 저장소 검색은 **필터는 있지만 "한국 것"을 정의해 주지 않는다.**

## 3. 차별화 4축

1. **국산 오픈소스 한정** — 토스·네이버·카카오·당근·라인·NHN 등 국내 조직과 한국 개인 개발자 저장소만 수록. "한국에서 만들었는가"를 사람이 검수한다.
2. **한국어 문서 지원 표시** — README 본문의 한글 비중, `README.ko.md`·`README-ko_kr.md` 같은 한국어 문서 파일 존재를 자동 판정해 배지로 노출.
3. **상업 무료 라이선스 판정** — SPDX 라이선스를 허용 목록(MIT·Apache-2.0·BSD·ISC·MPL-2.0·OFL-1.1 등)과 대조해 "회사에서 써도 되는가"를 즉시 답한다.
4. **Docker 한 방 실행 + 최근 업데이트 필터** — `Dockerfile`/공식 이미지가 확인된 저장소는 `docker run` 안내를 붙이고, 최근 3개월 푸시된 것만 남길 수 있다.

## 4. 사용자와 시나리오

| 사용자 | 상황 | 이 서비스로 하는 일 |
|---|---|---|
| 취업 준비생·부트캠프 수강생 | 포트폴리오에 쓸 국산 라이브러리를 찾는다 | 카테고리 탭 → 스타순 정렬 → 상세에서 문서 링크 확인 |
| 스타트업 개발자 | 사내 서비스에 차트·에디터를 붙여야 한다 | `상업 무료` + `최근 3개월` 필터 → 라이선스·최근 커밋 확인 |
| 백엔드 엔지니어 | 국산 인프라 도구를 평가한다 | `Docker` 필터 → 저장소의 실행 방법 확인 |
| 오픈소스 기여자 | 국내 프로젝트에 첫 기여를 하려 한다 | 한국어 README 프로젝트만 골라 이슈 링크로 이동 |

핵심 시나리오(30초): **검색어 입력 → 필터 2개 → 카드 3개 비교 → 상세에서 GitHub/문서 열기.**

## 5. MVP 화면 3개

### 5.1 탐색 목록 (메인)
- 상단: 로고 · 한 줄 소개 · **실시간 검색창**(이름·소개·태그·만든 곳) · **정렬**(스타순 / 최신 업데이트순 / 이름순)
- 카테고리 탭: 전체 · 프론트엔드 · AI·데이터 · 백엔드·인프라 · 개발 도구 · 학습·자료
- 필터 칩(다중 선택 AND): `한국어 문서` `상업 무료` `Docker` `최근 3개월`
- 결과 수 표시(`16개 중 7개`)와 **초기화**
- 카드 그리드: 이름 · 한 줄 소개 · 배지(라이선스·한국어·Docker·보관됨) · ★스타 · 최근 업데이트 · 언어
- 반응형: 360px 1열 / 768px 2열 / 1280px 3열. 가로 스크롤 0.
- 결과 0건: 검색어와 필터를 되돌리는 버튼이 있는 빈 상태.

### 5.2 상세 (모달)
- 카드를 누르면 열린다. `role="dialog"`, ESC·바깥 클릭 닫기, 열릴 때 포커스 이동, 닫으면 원래 카드로 복귀.
- 표시: 저장소명 · 만든 곳 · 카테고리 · 한 줄 소개 · 긴 설명 · 태그 · ★스타 · 오픈 이슈 · 라이선스 · 최근 푸시 · 기본 브랜치 · 언어
- 버튼: **GitHub 열기** · **문서(홈페이지)** · **이 저장소 정보가 틀렸어요(제보)**
- 상태 배지: `보관됨(archived)` 이면 눈에 띄게 표시.

### 5.3 제보 (GitHub Issue 연결)
- 서버·DB 없이 GitHub Issue Form으로 처리한다: `.github/ISSUE_TEMPLATE/submit-repo.yml`.
- 제보 링크는 `?template=submit-repo.yml&title=[제보]+<owner>/<repo>` 형태로 저장소명을 미리 채운다.
- 제보 유형: 새 저장소 추가 · 정보 수정(라이선스/한국어/링크) · 삭제 요청.
- 처리 흐름: Issue 접수 → `data/repos.json` 수정 → Actions 동기화 → 자동 반영. 응답 SLA는 "주 1회 일괄 검토".

## 6. 기능 요구사항

| ID | 요구사항 | 우선순위 | MVP |
|---|---|---|---|
| FR-1 | 40개 시드 데이터(실제 GitHub API로 검증) 표시 | P0 | ✅ |
| FR-2 | 실시간 검색(한국어 부분 일치, 대소문자 무시) | P0 | ✅ |
| FR-3 | 카테고리 탭 전환 | P0 | ✅ |
| FR-4 | 필터 칩 4종 + 다중 선택 | P0 | ✅ |
| FR-5 | 정렬 3종 | P1 | ✅ |
| FR-6 | 상세 모달(키보드 접근 가능) | P0 | ✅ |
| FR-7 | GitHub Issue 제보 링크 | P1 | ✅ |
| FR-8 | URL 해시로 검색·필터 상태 공유 | P2 | ✅ |
| FR-9 | 하루 1회 자동 메타데이터 동기화 | P0 | ✅ (워크플로 파일) |
| FR-10 | 태그 클릭 탐색 | P2 | ⏳ 로드맵 |
| FR-11 | 주간 인기순(스타 증가량) | P2 | ⏳ 로드맵 |

## 7. 데이터 모델

### 7.1 두 파일로 나눈다

| 파일 | 누가 쓰나 | 성격 |
|---|---|---|
| `data/repos.json` | 사람(PR) | **큐레이션 원본.** 어떤 저장소를 넣을지, 카테고리·요약·태그·수동 판정 |
| `public/data/catalog.json` | 스크립트(Actions) | **생성물.** GitHub API에서 받은 스타·라이선스·최근 푸시 등 실시간 메타데이터 |

둘을 분리하는 이유: 손으로 관리할 정보(왜 이걸 넣었는가)와 기계가 가져올 정보(스타 수)를 섞으면
동기화할 때마다 PR 충돌이 난다.

### 7.2 `data/repos.json`

```jsonc
{
  "version": 1,
  "repos": [
    {
      "repo": "toss/es-toolkit",        // 필수. owner/name
      "vendor": "토스",                  // 만든 곳 (표시용)
      "category": "frontend",            // frontend | ai | backend | tool | learn
      "summary": "lodash 대체를 노리는…", // 한국어 한 줄 소개 (내가 쓴다)
      "tags": ["TypeScript", "유틸리티"],
      "koreanDocs": true,               // 선택. 생략하면 자동 판정
      "docker": false,                  // 선택. 공식 Docker 확인 여부
      "license": "OFL-1.1",             // 선택. GitHub이 라이선스를 못 읽을 때 사람이 직접 확인한 SPDX
      "addedAt": "2026-11-26"
    }
  ]
}
```

### 7.3 `public/data/catalog.json` (생성물)

```jsonc
{
  "generatedAt": "2026-11-26T00:12:00.000Z",
  "source": "github-api",
  "count": 16,
  "repos": [
    {
      "repo": "toss/es-toolkit", "name": "es-toolkit", "owner": "toss",
      "vendor": "토스", "category": "frontend", "summary": "…", "tags": ["…"],
      "description": "A modern JavaScript utility library…",  // GitHub 원문
      "stars": 11399, "forks": 320, "openIssues": 68,
      "language": "TypeScript", "license": "MIT", "licenseName": "MIT License",
      "commercialUse": true,          // 허용 목록 판정
      "homepage": "https://es-toolkit.dev",
      "pushedAt": "2026-11-14T10:26:04Z", "updatedAt": "…", "createdAt": "…",
      "archived": false, "defaultBranch": "main",
      "topics": ["typescript", "lodash"],
      "koreanDocs": true, "koreanDocsSource": "readme", // readme | curated
      "docker": false, "dockerSource": "none",
      "url": "https://github.com/toss/es-toolkit",
      "recent": true                  // generatedAt 기준 90일 이내 푸시
    }
  ]
}
```

### 7.4 판정 규칙 (모두 스크립트가 계산, 결과를 데이터에 남긴다)

- **상업 무료**: `MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, CC0-1.0, Unlicense, 0BSD, OFL-1.1` 중 하나면 `true`. 라이선스 없음은 `false`(표시: `라이선스 미지정`).
  - OFL-1.1은 글꼴을 앱·웹에 임베드해 배포해도 되는 라이선스라 폰트 저장소에 한해 허용한다(폰트 자체의 유료 재판매만 금지).
  - GitHub API가 `NOASSERTION`으로 읽는 저장소(Pretendard처럼 OFL 전문에 저작권 고지가 여러 개 붙은 경우)는 `data/repos.json`의 `license`에 LICENSE 원문을 확인한 값을 적고 `licenseSource: curated`로 남긴다. 화면에서는 `?` 표시로 API 실측(`✓`)과 구분한다.
- **한국어 문서**: ① `data/repos.json`의 `koreanDocs`가 있으면 그 값(`source: curated`) ② 없으면 README 원문의 한글 글자 수 ≥ 100 또는 루트에 `README.ko.md`·`README-ko_kr.md`·`README.kr.md`가 있으면 `true`(`source: readme`).
- **Docker**: `data/repos.json`의 `docker`가 `true`면 `true`(`source: curated`, 저장소 안 Dockerfile 경로를 사람이 확인) ② 아니면 루트 `Dockerfile` 존재 또는 topics에 `docker` 포함(`source: detected`).
- **최근 3개월**: `pushedAt`이 `generatedAt - 90일` 이후.
- **보관됨**: `archived: true`인 저장소는 목록에서 숨기지 않되 카드에 `보관됨` 배지와 상세 경고를 붙인다(대체 라이브러리를 찾는 단서가 되므로).

## 8. 기술 아키텍처 — 운영비 0원

```
  GitHub Actions (매일 06:00 KST)
        │  1. data/repos.json 읽기
        │  2. 각 저장소 GET /repos/{o}/{r}, /readme, /contents
        │  3. 판정 계산 → public/data/catalog.json 커밋
        ▼
  GitHub 저장소 (public, data + public)
        │  push → Cloudflare Pages 자동 빌드(빌드 명령 없음, 출력 폴더 public)
        ▼
  Cloudflare Pages (정적 호스팅, CDN)
        ▼
  사용자 브라우저: HTML/CSS/JS + catalog.json 1회 로드 (프레임워크·번들러 없음)
```

| 구성요소 | 선택 | 무료 한도 | 이 서비스 사용량 |
|---|---|---|---|
| 호스팅 | Cloudflare Pages | 요청 무제한, 월 500회 빌드 | 하루 1회 push ≈ 30회/월 |
| 데이터 수집 | GitHub Actions | **공개 저장소는 표준 러너 무료** | 하루 1회, 1분 이내 |
| API | GitHub REST | 인증 시 시간당 5,000회 | 16개 × 3회 ≈ 48회/회 실행 |
| 저장소 | GitHub public | 무제한 | 데이터 파일 수십 KB |
| DB·서버 | **없음** | — | — |

- 서버가 없으므로 **다운·보안 취약점·요금 폭탄이 없다.** 데이터가 틀리면 파일을 고치면 되고, 그 이력이 git에 남는다.
- 실시간성이 필요 없는 종류의 데이터(스타 수, 최근 커밋)이므로 하루 1회 동기화로 충분하다.
- 확장 시에도 구조를 깨지 않는다: 검색 인덱스가 필요해지면 같은 `catalog.json`을 클라이언트에서 필터(현재 방식)하고, 데이터가 1,000건을 넘으면 페이지네이션·샤딩만 추가한다.

### 8.1 동기화 워크플로 (`docs/workflows/sync.yml`)

권한 문제로 `.github/workflows/`에 직접 푸시하지 못할 수 있어 `docs/workflows/sync.yml`에 두고,
저장소 소유자가 GitHub 웹에서 `.github/workflows/sync.yml`로 옮기면 활성화된다.

- 트리거: `schedule`(매일 21:00 UTC = 06:00 KST) + `workflow_dispatch` + `data/repos.json` 변경 시
- 단계: checkout → `node scripts/sync_repos.mjs` (env `GITHUB_TOKEN`) → `catalog.json` 변경 시 커밋·푸시
- 실패 처리: 한 저장소 조회가 실패해도 **직전 값 유지**로 계속 진행하고, 최종 실패율을 로그·요약에 남긴다. 전 저장소 실패 시에만 워크플로 실패(빈 데이터로 사이트가 비는 것을 막는다).

## 9. 시드 구성 (현재 40개)

**1차 16개(MVP, 2026-11-26 GitHub API로 존재·스타·라이선스·최근 푸시 직접 검증 완료)**
국산 OSS 15개 + 직접 만든 1개(`YunhuPark/devorch`).

| # | 저장소 | 만든 곳 | 카테고리 | ★ | 라이선스 | 한국어 | Docker | 최근 3개월 |
|---|---|---|---|---|---|---|---|---|
| 1 | `nhn/tui.editor` | NHN | 개발 도구 | 17,983 | MIT | | | ✅ (보관됨) |
| 2 | `gyoogle/tech-interview-for-developer` | 개인 | 학습 | 17,704 | MIT | ✅ | | | ✅ |
| 3 | `toss/es-toolkit` | 토스 | 프론트엔드 | 11,399 | MIT | ✅ | | ✅ |
| 4 | `naver/billboard.js` | 네이버 | 프론트엔드 | 6,026 | MIT | | | ✅ |
| 5 | `line/armeria` | 라인 | 백엔드·인프라 | 5,154 | Apache-2.0 | | | ✅ |
| 6 | `naver/egjs-flicking` | 네이버 | 프론트엔드 | 2,919 | MIT | | | ✅ |
| 7 | `naver/egjs-infinitegrid` | 네이버 | 프론트엔드 | 2,364 | MIT | | | ✅ |
| 8 | `kakao/khaiii` | 카카오 | AI·데이터 | 1,455 | Apache-2.0 | ✅ | ✅ | ✅ |
| 9 | `kakaobrain/pororo` | 카카오브레인 | AI·데이터 | 1,300 | Apache-2.0 | ✅ | ✅ | (보관됨) |
| 10 | `daangn/seed-design` | 당근 | 프론트엔드 | 1,195 | Apache-2.0 | ✅ | | ✅ |
| 11 | `toss/suspensive` | 토스 | 프론트엔드 | 1,060 | MIT | | | ✅ |
| 12 | `daangn/stackflow` | 당근 | 프론트엔드 | 1,036 | MIT | | | ✅ |
| 13 | `amondnet/vercel-action` | 개인 | 개발 도구 | 764 | MIT | | | |
| 14 | `toss/overlay-kit` | 토스 | 프론트엔드 | 739 | MIT | ✅ | | ✅ |
| 15 | `line/centraldogma` | 라인 | 백엔드·인프라 | 675 | Apache-2.0 | | ✅ | ✅ |
| 16 | `YunhuPark/devorch` | 직접 만듦 | 개발 도구 | 0 | 미지정 | ✅ | | ✅ |

**2차(2026-11-26) — 자기 저장소 10개 제외, 별표 저장소 전수 조사, 검증 19개 + 폰트 2개 추가 → 40개.**

1. `YunhuPark/*` 10개(`devorch` 포함)를 제거했다. 직접 만든 저장소가 목록의 44%를 차지해 "국산 오픈소스 큐레이션"이라는 성격을 흐렸기 때문이다.
2. `gh api users/YunhuPark/starred --paginate`로 **별표한 저장소 1,211개 전수 조회** → 1,211개 README·루트 파일 목록을 실제로 받아 한국어 문서 여부를 판정. 국산·한국어 기준 통과 4개만 추가:
   `vmc-inner-circle/k-style-ui-ux`, `hanmariyang/giting-skills`, `jo-duchan/tapflow`(서울 소재 개발자·MIT), `supertone-oss-archive/supertonic`(수퍼톤, 보관됨).
   같은 조회에서 탈락: `tosspayments/browser-sdk`·`portone-io/server-sdk`(라이선스 없음), `abus-aikorea/voice-pro`(GPL-3.0), `code-yeongyu/oh-my-openagent`(NOASSERTION). 한국어 README만 번역해 둔 해외 인기 툴은 "국산" 전제를 지키려고 넣지 않았다.
3. `work/notes/k-oss-candidates-2026-11-26.md`에서 실측 검증된 국내 19개(토스·네이버·라인·당근) + OFL-1.1 폰트 2개(`orioncactus/pretendard`, `naver/d2-coding-font`)를 추가했다.

**현재 분포(2026-11-26 동기화 결과)**: 저장소 40개 · 프론트엔드 15 / 개발 도구 10 / 백엔드·인프라 9 / AI·데이터 5 / 학습·자료 1.
판정: 한국어 문서 15 · 상업 무료 40 · Docker 7 · 최근 3개월 34 · 보관됨 3(`nhn/tui.editor`, `kakaobrain/pororo`, `supertone-oss-archive/supertonic`).

**다음 배치 후보(추측 금지 — 투입 전 `gh api repos/{owner}/{repo}` 재검증)**: `toss/slash`(보관됨), `nhn/tui.calendar`·`tui.chart`·`tui.grid`(보관됨), `naver/ngrinder`(보관됨), `line/tsr`(보관됨), `naver/fe-news`·`toss/technical-writing`(라이선스 미명시), `spoqa/spoqa-han-sans`(OFL), `kakao/buffalo`(6개월+ 미갱신), `naver/dust3r`·`naver/mast3r`(비상업 라이선스).

> 시드 확장 원칙: **스타 수보다 "지금 실무에 붙일 수 있는가"**. 3년 이상 커밋이 없고 대체재가 있으면 제외하거나 `보관됨`으로 표시한다.
> 배치 단위는 주 1회 5~7개. 한 번에 많이 넣으면 검수 품질이 서비스 품질을 앞지른다.
>
> "국산" 경계 메모: `line/armeria`·`line/centraldogma`는 네이버 계열(LINE) 조직 저장소로, 한국·일본 엔지니어가 함께 관리한다. 수록은 유지하되 `vendor`에 `라인`으로 표시해 출처를 숨기지 않는다.

## 10. 비기능 요구사항

- **성능**: 초기 HTML+CSS+JS < 60KB(gzip 전), `catalog.json` < 100KB. 외부 CDN·폰트·분석 스크립트 0개. 첫 화면 LCP < 1.5초(3G 기준).
- **반응형**: 360px~1440px에서 가로 스크롤 0. 터치 타깃 최소 44px.
- **접근성**: 키보드만으로 검색·필터·모달 조작 가능, `aria-pressed`/`aria-live`(결과 수) 사용, 명도 대비 4.5:1 이상.
- **SEO**: 저장소 이름이 URL 해시가 아닌 정적 `index.html` 제목·메타 설명에 포함. (MVP는 단일 페이지, 상세는 로드맵에서 `/r/{owner}/{repo}` 정적 페이지로 승격)
- **오프라인 내성**: 데이터 로드 실패 시 빈 화면 대신 안내 문구 + GitHub 링크.

## 11. 출시·운영

1. Cloudflare Pages에 저장소 연결(빌드 명령 없음, 출력 디렉터리 `public`) → `k-oss.pages.dev` 확보.
2. `docs/workflows/sync.yml`을 `.github/workflows/sync.yml`로 이동(또는 Actions 권한 부여) 후 `workflow_dispatch`로 1회 수동 실행.
3. 홍보: 국내 개발 커뮤니티(OKKY, 개발자 Slack, X)에 "국산 오픈소스 30개 정리" 형태로 공유. PR 환영 문구와 제보 템플릿을 README에 노출.
4. 유지 비용: 하루 5분(제보 Issue 확인). 스타 수가 목적이 아니라 **"내 프로젝트를 여기 올리고 싶다"는 제보가 목적**이므로 제보 응답 속도가 서비스 품질이다.

## 12. 로드맵

| 단계 | 내용 | 판단 기준 |
|---|---|---|
| M1 (이번) | 16개 시드 + 탐색·필터·상세·제보 + 자동 동기화 | 배포 URL 동작, 모바일 가로 넘침 0 |
| M2 | 태그 클릭 탐색, 상세 정적 페이지(`/r/{o}/{r}`), OG 이미지 (시드는 40개로 확장 완료) | 주간 방문 100 |
| M3 | 주간 인기순(스타 증가량 스냅샷 저장), 개인화 없음 유지 | 데이터 100건 |
| M4 | 다국어(영문 UI), 채용·기여 난이도(`good first issue` 수) 표시 | 제보 월 10건 |

## 13. 리스크와 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| "국산"의 정의 모호 | 무관한 저장소 유입 | 사람 검수 + `vendor` 필드 필수 + README에 수록 기준 명시 |
| 라이선스 판정 오류 | 기업 사용자가 법적 위험 | 판정은 "참고용"으로 표시하고 원문 LICENSE 링크를 항상 함께 노출 |
| archived 저장소 추천 | 사용자가 죽은 라이브러리 선택 | `보관됨` 배지 + 대체 라이브러리 필드(로드맵) |
| API rate limit | 동기화 중단 | 실패 시 직전 값 유지, 토큰 인증(시간당 5,000회)으로 충분 |
| 동기화 데이터가 사이트를 깨뜨림 | 빈 화면 | 스크립트가 스키마 검증 후에만 파일 교체, 실패 시 종전 파일 유지 |

## 14. 완료 정의 (Definition of Done — M1)

- [x] `data/repos.json` 40개, 전부 실제 API 조회로 검증
- [x] `public/` 정적 사이트가 `catalog.json`만으로 동작(서버·DB 없음)
- [x] 검색·카테고리·필터 4종·정렬·상세 모달 동작
- [x] 360px/1280px 헤드리스 브라우저 검증, 가로 넘침 0, 스크린샷 보관
- [x] `scripts/sync_repos.mjs` + 단위 테스트 통과
- [x] `docs/workflows/sync.yml`, `.github/ISSUE_TEMPLATE/submit-repo.yml` 준비
- [x] 저장소 공개·Cloudflare Pages 배포 — https://k-oss-directory.pages.dev
- [ ] 저장소 라이선스 결정(현재 미정 — 공개 전 결정 필요)
