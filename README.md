# K-OSS Directory

**🔗 라이브 사이트 — [k-oss-directory.pages.dev](https://k-oss-directory.pages.dev)**

**실무에 붙는 오픈소스, 글로벌과 한국을 한 화면에서.**

GitHub Explore는 트렌딩만 보여주고, 쓸 만한 프로젝트는 언어 장벽·라이선스 불안·실행 장벽·관리 중단 때문에 매번 검색에서 걸러집니다.
K-OSS Directory는 **해외 인디 개발자·소규모 팀의 프로젝트와 한국 팀·개인 개발자의 저장소**를 같은 기준으로 모아, 실무에 바로 붙일 수 있는지 네 가지로 판정해 카드 한 장에 보여줍니다.

## 이렇게 판정합니다

- 🌍 **글로벌 + 한국** — 해외 개인·소규모 팀이 만든 실무 오픈소스와 한국 팀·기업·개인 개발자 저장소를 함께, 사람이 검수해 넣습니다.
- 📘 **한국어 문서** — `README.ko.md` 같은 번역본 존재 여부와 README 한글 비중으로 자동 판정합니다.
- ⚖️ **상업 무료 라이선스** — MIT·Apache-2.0·BSD·ISC·MPL-2.0·OFL-1.1 등 SPDX 허용 목록과 대조합니다. AGPL·SSPL·사용 제한 라이선스는 넣지 않습니다.
- 🐳 **Docker 실행** — 루트 `Dockerfile`·공식 이미지 여부를 확인하고, `최근 3개월` 푸시 필터를 함께 제공합니다.

화면에서는 이 네 가지를 카드 한 장에 담고, 검색·카테고리·필터·정렬이 즉시 반영됩니다. 목록은 **24개씩 먼저 보여 주고 `더 보기 (N개 남음)` 버튼으로 이어서 펼칩니다**. 검색은 `-`·`_`·`/`·공백을 모두 구분자로 봐서 `k-ui-ux`를 쳐도 `k-style-ui-ux`가 바로 나옵니다. 카드마다 `git clone` 명령을 복사할 수 있고, 라이트/다크 모드 선택은 `localStorage`에 남습니다. 모바일 360px에서도 상세 모달은 헤더·하단 버튼이 고정되고 본문만 스크롤되어 `GitHub 열기`가 가려지지 않습니다. 본문 글꼴은 Pretendard이고, 본문 대비는 라이트·다크 모두 4.5:1 이상입니다.

<p>
  <img src="docs/screenshots/home-1280.png" alt="데스크톱 탐색 화면" width="800">
</p>
<p>
  <img src="docs/screenshots/home-1280-dark.png" alt="다크 모드 탐색 화면" width="392">
  <img src="docs/screenshots/filter-docker-1280.png" alt="Docker 필터 적용 화면" width="392">
</p>
<p>
  <img src="docs/screenshots/home-360.png" alt="모바일 탐색 화면" width="240">
  <img src="docs/screenshots/detail-1280.png" alt="상세 모달" width="520">
</p>

## 수록 현황

**260개 저장소** — 전부 상업 무료 라이선스입니다. 한국어 문서 71 · Docker 47 · 최근 3개월 푸시 197 · 보관됨 3 (2026-11-26 GitHub API 검증).

| 분류 | 프론트엔드 | 백엔드·인프라 | 개발 도구 | AI·데이터 | 학습·자료 | 합계 |
|---|---|---|---|---|---|---|
| 저장소 | 49 | 46 | 78 | 60 | 27 | 260 |

2026-11-26에 93개 → **260개**로 늘렸습니다. 이번에 새로 넣은 167개(글로벌 인디·실무 133개 + 국내 인디·개인 34개)는 모두 `gh api repos/{owner}/{repo}`로 존재·아카이브 아님·상업 무료 라이선스를 실측 확인했고, AGPL·SSPL·자체 사용 제한 라이선스라서 넣지 않은 후보(`immich-app/immich`·`n8n-io/n8n`·`docmost/docmost`·`twentyhq/twenty`·`Comfy-Org/ComfyUI`·`open-webui/open-webui` 등)는 목록에서 뺐습니다. `pocketbase/pocketbase`처럼 GitHub에서 보관(archived)된 저장소도 제외했습니다.
별점·최근 푸시 같은 수치는 `public/data/catalog.json`이 매일 갱신하므로, 최신 값은 사이트에서 보는 편이 정확합니다.

<details>
<summary>전체 260개 목록 (2026-11-26 기준 · 스타 순)</summary>

| 저장소 | 만든 곳 | 분류 | ★ | 라이선스 | 한국어 문서 |
|---|---|---|---|---|---|
| [sindresorhus/awesome](https://github.com/sindresorhus/awesome) | Sindre Sorhus | 학습·자료 | 543k | CC0-1.0 |   |
| [practical-tutorials/project-based-learning](https://github.com/practical-tutorials/project-based-learning) | practical-tutorials | 학습·자료 | 290.5k | MIT |   |
| [TheAlgorithms/Python](https://github.com/TheAlgorithms/Python) | TheAlgorithms | 학습·자료 | 226.5k | MIT |   |
| [ossu/computer-science](https://github.com/ossu/computer-science) | OSSU | 학습·자료 | 211.6k | MIT |   |
| [microsoft/markitdown](https://github.com/microsoft/markitdown) | Microsoft | AI·데이터 | 198.5k | MIT |   |
| [trekhleb/javascript-algorithms](https://github.com/trekhleb/javascript-algorithms) | Oleksii Trekhleb | 학습·자료 | 196.8k | MIT | ✅ |
| [avelino/awesome-go](https://github.com/avelino/awesome-go) | avelino | 학습·자료 | 196k | MIT |   |
| [ollama/ollama](https://github.com/ollama/ollama) | Ollama | AI·데이터 | 188.2k | MIT |   |
| [huggingface/transformers](https://github.com/huggingface/transformers) | Hugging Face | AI·데이터 | 169.3k | Apache-2.0 |   |
| [langchain-ai/langchain](https://github.com/langchain-ai/langchain) | LangChain | AI·데이터 | 150k | MIT |   |
| [yangshun/tech-interview-handbook](https://github.com/yangshun/tech-interview-handbook) | Yangshun Tay | 학습·자료 | 143.7k | MIT |   |
| [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) | Excalidraw | 프론트엔드 | 136.3k | MIT |   |
| [ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp) | ggml | AI·데이터 | 136.3k | MIT |   |
| [shadcn-ui/ui](https://github.com/shadcn-ui/ui) | shadcn | 프론트엔드 | 129.1k | MIT |   |
| [microsoft/generative-ai-for-beginners](https://github.com/microsoft/generative-ai-for-beginners) | Microsoft | 학습·자료 | 124.3k | MIT |   |
| [browser-use/browser-use](https://github.com/browser-use/browser-use) | Browser Use | AI·데이터 | 122.1k | MIT |   |
| [mrdoob/three.js](https://github.com/mrdoob/three.js) | three.js | 프론트엔드 | 119.4k | MIT |   |
| [supabase/supabase](https://github.com/supabase/supabase) | Supabase | 백엔드·인프라 | 115.5k | Apache-2.0 |   |
| [d3/d3](https://github.com/d3/d3) | D3 | 프론트엔드 | 114k | ISC |   |
| [openai/whisper](https://github.com/openai/whisper) | OpenAI | AI·데이터 | 113.6k | MIT |   |
| [fatedier/frp](https://github.com/fatedier/frp) | frp | 백엔드·인프라 | 110.8k | Apache-2.0 |   |
| [fastapi/fastapi](https://github.com/fastapi/fastapi) | FastAPI | 백엔드·인프라 | 105k | MIT |   |
| [microsoft/playwright](https://github.com/microsoft/playwright) | Microsoft | 개발 도구 | 101.1k | Apache-2.0 |   |
| [tailwindlabs/tailwindcss](https://github.com/tailwindlabs/tailwindcss) | Tailwind Labs | 프론트엔드 | 98.8k | MIT |   |
| [vllm-project/vllm](https://github.com/vllm-project/vllm) | vLLM | AI·데이터 | 97.6k | Apache-2.0 |   |
| [louislam/uptime-kuma](https://github.com/louislam/uptime-kuma) | Louis Lam | 개발 도구 | 94.9k | MIT |   |
| [astral-sh/uv](https://github.com/astral-sh/uv) | Astral | 개발 도구 | 92.7k | Apache-2.0 |   |
| [storybookjs/storybook](https://github.com/storybookjs/storybook) | Storybook | 개발 도구 | 91.7k | MIT |   |
| [mermaid-js/mermaid](https://github.com/mermaid-js/mermaid) | Mermaid | 프론트엔드 | 91.3k | MIT |   |
| [syncthing/syncthing](https://github.com/syncthing/syncthing) | Syncthing | 백엔드·인프라 | 90.8k | MPL-2.0 |   |
| [sveltejs/svelte](https://github.com/sveltejs/svelte) | Svelte | 프론트엔드 | 89.9k | MIT |   |
| [mlabonne/llm-course](https://github.com/mlabonne/llm-course) | Maxime Labonne | 학습·자료 | 85.2k | Apache-2.0 |   |
| [junegunn/fzf](https://github.com/junegunn/fzf) | Junegunn Choi | 개발 도구 | 84.5k | MIT |   |
| [vitejs/vite](https://github.com/vitejs/vite) | Vite | 프론트엔드 | 84.1k | MIT |   |
| [jesseduffield/lazygit](https://github.com/jesseduffield/lazygit) | Jesse Duffield | 개발 도구 | 84.1k | MIT |   |
| [hoppscotch/hoppscotch](https://github.com/hoppscotch/hoppscotch) | Hoppscotch | 개발 도구 | 81k | MIT |   |
| [unslothai/unsloth](https://github.com/unslothai/unsloth) | Unsloth | AI·데이터 | 80.3k | Apache-2.0 |   |
| [caddyserver/caddy](https://github.com/caddyserver/caddy) | Caddy | 백엔드·인프라 | 79.6k | Apache-2.0 |   |
| [openai/openai-cookbook](https://github.com/openai/openai-cookbook) | OpenAI | 학습·자료 | 77.5k | MIT |   |
| [hiyouga/LlamaFactory](https://github.com/hiyouga/LlamaFactory) | hiyouga | AI·데이터 | 76.3k | Apache-2.0 |   |
| [cline/cline](https://github.com/cline/cline) | Cline | AI·데이터 | 71.9k | Apache-2.0 |   |
| [microsoft/AI-For-Beginners](https://github.com/microsoft/AI-For-Beginners) | Microsoft | 학습·자료 | 71.3k | MIT |   |
| [docling-project/docling](https://github.com/docling-project/docling) | Docling | AI·데이터 | 71.1k | MIT |   |
| [BurntSushi/ripgrep](https://github.com/BurntSushi/ripgrep) | BurntSushi | 개발 도구 | 70.4k | Unlicense |   |
| [mem0ai/mem0](https://github.com/mem0ai/mem0) | Mem0 | AI·데이터 | 69.5k | Apache-2.0 |   |
| [chartjs/Chart.js](https://github.com/chartjs/Chart.js) | Chart.js | 프론트엔드 | 67.8k | MIT |   |
| [leonardomso/33-js-concepts](https://github.com/leonardomso/33-js-concepts) | Leonardo Soares | 학습·자료 | 66.5k | MIT |   |
| [coollabsio/coolify](https://github.com/coollabsio/coolify) | Coolify | 백엔드·인프라 | 66.5k | Apache-2.0 |   |
| [traefik/traefik](https://github.com/traefik/traefik) | Traefik | 백엔드·인프라 | 65.7k | MIT |   |
| [karpathy/nanoGPT](https://github.com/karpathy/nanoGPT) | Andrej Karpathy | AI·데이터 | 65.1k | MIT |   |
| [sharkdp/bat](https://github.com/sharkdp/bat) | sharkdp | 개발 도구 | 61.5k | Apache-2.0 |   |
| [rclone/rclone](https://github.com/rclone/rclone) | rclone | 백엔드·인프라 | 61.3k | MIT |   |
| [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) | CrewAI | AI·데이터 | 61.3k | MIT |   |
| [nuxt/nuxt](https://github.com/nuxt/nuxt) | Nuxt | 프론트엔드 | 61.1k | MIT |   |
| [starship/starship](https://github.com/starship/starship) | Starship | 개발 도구 | 60.9k | ISC |   |
| [FiloSottile/mkcert](https://github.com/FiloSottile/mkcert) | Filippo Valsorda | 개발 도구 | 59.9k | BSD-3-Clause |   |
| [go-gitea/gitea](https://github.com/go-gitea/gitea) | Gitea | 백엔드·인프라 | 59.3k | MIT |   |
| [pmndrs/zustand](https://github.com/pmndrs/zustand) | pmndrs | 프론트엔드 | 59k | MIT |   |
| [appwrite/appwrite](https://github.com/appwrite/appwrite) | Appwrite | 백엔드·인프라 | 58.6k | BSD-3-Clause |   |
| [typst/typst](https://github.com/typst/typst) | Typst | 개발 도구 | 57.4k | Apache-2.0 |   |
| [remix-run/react-router](https://github.com/remix-run/react-router) | Remix | 프론트엔드 | 56.7k | MIT |   |
| [ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) | ggml | AI·데이터 | 55.5k | MIT |   |
| [vuejs/core](https://github.com/vuejs/core) | Vue.js | 프론트엔드 | 55.1k | MIT |   |
| [jesseduffield/lazydocker](https://github.com/jesseduffield/lazydocker) | Jesse Duffield | 개발 도구 | 53.4k | MIT |   |
| [run-llama/llama_index](https://github.com/run-llama/llama_index) | LlamaIndex | AI·데이터 | 53k | MIT |   |
| [dbeaver/dbeaver](https://github.com/dbeaver/dbeaver) | DBeaver | 개발 도구 | 52.5k | Apache-2.0 |   |
| [prettier/prettier](https://github.com/prettier/prettier) | Prettier | 개발 도구 | 52.5k | MIT |   |
| [roboflow/supervision](https://github.com/roboflow/supervision) | Roboflow | AI·데이터 | 51.7k | MIT |   |
| [astral-sh/ruff](https://github.com/astral-sh/ruff) | Astral | 개발 도구 | 51.5k | MIT |   |
| [cypress-io/cypress](https://github.com/cypress-io/cypress) | Cypress | 개발 도구 | 51k | MIT |   |
| [TanStack/query](https://github.com/TanStack/query) | TanStack | 프론트엔드 | 50.6k | MIT |   |
| [tmux/tmux](https://github.com/tmux/tmux) | tmux | 개발 도구 | 50.6k | ISC |   |
| [calcom/cal.diy](https://github.com/calcom/cal.diy) | Cal.com | 개발 도구 | 50.4k | MIT |   |
| [Aider-AI/aider](https://github.com/Aider-AI/aider) | Aider | AI·데이터 | 50.3k | Apache-2.0 |   |
| [slidevjs/slidev](https://github.com/slidevjs/slidev) | Slidev | 개발 도구 | 49.6k | MIT |   |
| [usebruno/bruno](https://github.com/usebruno/bruno) | Bruno | 개발 도구 | 48.6k | MIT |   |
| [prisma/orm](https://github.com/prisma/orm) | Prisma | 백엔드·인프라 | 47.8k | Apache-2.0 |   |
| [cli/cli](https://github.com/cli/cli) | GitHub | 개발 도구 | 47.2k | MIT |   |
| [streamlit/streamlit](https://github.com/streamlit/streamlit) | Streamlit | AI·데이터 | 46.5k | Apache-2.0 |   |
| [juanfont/headscale](https://github.com/juanfont/headscale) | Headscale | 백엔드·인프라 | 46.1k | BSD-3-Clause |   |
| [sharkdp/fd](https://github.com/sharkdp/fd) | sharkdp | 개발 도구 | 45.2k | Apache-2.0 |   |
| [colinhacks/zod](https://github.com/colinhacks/zod) | Colin Hacks | 프론트엔드 | 44.4k | MIT |   |
| [gradio-app/gradio](https://github.com/gradio-app/gradio) | Gradio | AI·데이터 | 44.2k | Apache-2.0 |   |
| [duckdb/duckdb](https://github.com/duckdb/duckdb) | DuckDB | AI·데이터 | 43.4k | MIT |   |
| [facebookresearch/faiss](https://github.com/facebookresearch/faiss) | Meta | AI·데이터 | 41.9k | MIT |   |
| [pola-rs/polars](https://github.com/pola-rs/polars) | Polars | AI·데이터 | 40.5k | MIT |   |
| [Kong/insomnia](https://github.com/Kong/insomnia) | Kong | 개발 도구 | 40.2k | Apache-2.0 |   |
| [evanw/esbuild](https://github.com/evanw/esbuild) | Evan Wallace | 프론트엔드 | 40.2k | MIT |   |
| [aquasecurity/trivy](https://github.com/aquasecurity/trivy) | Aqua Security | 개발 도구 | 39.8k | Apache-2.0 |   |
| [tailscale/tailscale](https://github.com/tailscale/tailscale) | Tailscale | 백엔드·인프라 | 39.6k | BSD-3-Clause |   |
| [ueberdosis/tiptap](https://github.com/ueberdosis/tiptap) | Tiptap | 프론트엔드 | 39.1k | MIT |   |
| [restic/restic](https://github.com/restic/restic) | restic | 백엔드·인프라 | 37.5k | BSD-2-Clause |   |
| [casey/just](https://github.com/casey/just) | just | 개발 도구 | 36.8k | CC0-1.0 |   |
| [microsoft/graphrag](https://github.com/microsoft/graphrag) | Microsoft | AI·데이터 | 36.8k | MIT |   |
| [continuedev/continue](https://github.com/continuedev/continue) | Continue | AI·데이터 | 36.6k | Apache-2.0 |   |
| [jdx/mise](https://github.com/jdx/mise) | mise | 개발 도구 | 36.5k | MIT |   |
| [drizzle-team/drizzle-orm](https://github.com/drizzle-team/drizzle-orm) | Drizzle | 백엔드·인프라 | 36.4k | Apache-2.0 |   |
| [seaweedfs/seaweedfs](https://github.com/seaweedfs/seaweedfs) | SeaweedFS | 백엔드·인프라 | 36.3k | Apache-2.0 |   |
| [zellij-org/zellij](https://github.com/zellij-org/zellij) | Zellij | 개발 도구 | 36.3k | MIT |   |
| [qdrant/qdrant](https://github.com/qdrant/qdrant) | Qdrant | AI·데이터 | 35.7k | Apache-2.0 |   |
| [motiondivision/motion](https://github.com/motiondivision/motion) | Motion | 프론트엔드 | 35.6k | MIT |   |
| [derailed/k9s](https://github.com/derailed/k9s) | k9s | 개발 도구 | 35.1k | Apache-2.0 |   |
| [k3s-io/k3s](https://github.com/k3s-io/k3s) | K3s | 백엔드·인프라 | 34.5k | Apache-2.0 |   |
| [python-poetry/poetry](https://github.com/python-poetry/poetry) | Poetry | 개발 도구 | 34.3k | MIT |   |
| [honojs/hono](https://github.com/honojs/hono) | Hono | 백엔드·인프라 | 33.1k | MIT |   |
| [dokku/dokku](https://github.com/dokku/dokku) | Dokku | 백엔드·인프라 | 32.2k | MIT |   |
| [hasura/graphql-engine](https://github.com/hasura/graphql-engine) | Hasura | 백엔드·인프라 | 32.1k | Apache-2.0 |   |
| [alpinejs/alpine](https://github.com/alpinejs/alpine) | Alpine.js | 프론트엔드 | 32k | MIT |   |
| [gitleaks/gitleaks](https://github.com/gitleaks/gitleaks) | gitleaks | 개발 도구 | 31.4k | MIT |   |
| [opentofu/opentofu](https://github.com/opentofu/opentofu) | OpenTofu | 개발 도구 | 31k | MPL-2.0 |   |
| [chroma-core/chroma](https://github.com/chroma-core/chroma) | Chroma | AI·데이터 | 29.8k | Apache-2.0 |   |
| [mlflow/mlflow](https://github.com/mlflow/mlflow) | MLflow | AI·데이터 | 29k | Apache-2.0 |   |
| [HumanSignal/label-studio](https://github.com/HumanSignal/label-studio) | HumanSignal | AI·데이터 | 28.8k | Apache-2.0 |   |
| [PostgREST/postgrest](https://github.com/PostgREST/postgrest) | PostgREST | 백엔드·인프라 | 27.8k | MIT |   |
| [eslint/eslint](https://github.com/eslint/eslint) | ESLint | 개발 도구 | 27.7k | MIT |   |
| [squidfunk/mkdocs-material](https://github.com/squidfunk/mkdocs-material) | squidfunk | 개발 도구 | 27.6k | MIT |   |
| [deepset-ai/haystack](https://github.com/deepset-ai/haystack) | deepset | AI·데이터 | 27.1k | Apache-2.0 |   |
| [biomejs/biome](https://github.com/biomejs/biome) | Biome | 개발 도구 | 26.2k | Apache-2.0 |   |
| [pulumi/pulumi](https://github.com/pulumi/pulumi) | Pulumi | 개발 도구 | 25.9k | Apache-2.0 |   |
| [temporalio/temporal](https://github.com/temporalio/temporal) | Temporal | 백엔드·인프라 | 24.6k | MIT |   |
| [marimo-team/marimo](https://github.com/marimo-team/marimo) | marimo | AI·데이터 | 23.7k | Apache-2.0 |   |
| [huggingface/datasets](https://github.com/huggingface/datasets) | Hugging Face | AI·데이터 | 22.2k | Apache-2.0 |   |
| [nats-io/nats-server](https://github.com/nats-io/nats-server) | NATS | 백엔드·인프라 | 21.2k | Apache-2.0 |   |
| [radix-ui/primitives](https://github.com/radix-ui/primitives) | Radix UI | 프론트엔드 | 19.6k | MIT |   |
| [nhn/tui.editor](https://github.com/nhn/tui.editor) | NHN | 개발 도구 | 18k | MIT | 보관됨 |
| [gyoogle/tech-interview-for-developer](https://github.com/gyoogle/tech-interview-for-developer) | 개인 개발자 | 학습·자료 | 17.7k | MIT | ✅ |
| [vitest-dev/vitest](https://github.com/vitest-dev/vitest) | Vitest | 개발 도구 | 17.5k | MIT |   |
| [ast-grep/ast-grep](https://github.com/ast-grep/ast-grep) | ast-grep | 개발 도구 | 16.7k | MIT |   |
| [go-task/task](https://github.com/go-task/task) | Task | 개발 도구 | 16.4k | MIT |   |
| [goreleaser/goreleaser](https://github.com/goreleaser/goreleaser) | GoReleaser | 개발 도구 | 16.2k | MIT |   |
| [pre-commit/pre-commit](https://github.com/pre-commit/pre-commit) | pre-commit | 개발 도구 | 15.7k | MIT |   |
| [direnv/direnv](https://github.com/direnv/direnv) | direnv | 개발 도구 | 15.6k | MIT |   |
| [jupyterlab/jupyterlab](https://github.com/jupyterlab/jupyterlab) | Jupyter | AI·데이터 | 15.4k | BSD-3-Clause |   |
| [benbjohnson/litestream](https://github.com/benbjohnson/litestream) | Litestream | 백엔드·인프라 | 14.7k | Apache-2.0 |   |
| [supertone-oss-archive/supertonic](https://github.com/supertone-oss-archive/supertonic) | 수퍼톤 | AI·데이터 | 13.8k | MIT | 보관됨 |
| [lancedb/lancedb](https://github.com/lancedb/lancedb) | LanceDB | AI·데이터 | 12k | Apache-2.0 |   |
| [toss/es-toolkit](https://github.com/toss/es-toolkit) | 토스 | 프론트엔드 | 11.4k | MIT | ✅ |
| [nhost/nhost](https://github.com/nhost/nhost) | Nhost | 백엔드·인프라 | 9.4k | MIT |   |
| [woodpecker-ci/woodpecker](https://github.com/woodpecker-ci/woodpecker) | Woodpecker CI | 백엔드·인프라 | 8.3k | Apache-2.0 |   |
| [myshell-ai/MeloTTS](https://github.com/myshell-ai/MeloTTS) | MyShell | AI·데이터 | 7.7k | MIT |   |
| [epoko77-ai/im-not-ai](https://github.com/epoko77-ai/im-not-ai) | epoko77 | AI·데이터 | 6.8k | MIT | ✅ |
| [naver/billboard.js](https://github.com/naver/billboard.js) | 네이버 | 프론트엔드 | 6k | MIT |   |
| [line/armeria](https://github.com/line/armeria) | 라인 | 백엔드·인프라 | 5.2k | Apache-2.0 |   |
| [TakWolf/ark-pixel-font](https://github.com/TakWolf/ark-pixel-font) | TakWolf | 프론트엔드 | 5k | MIT |   |
| [orioncactus/pretendard](https://github.com/orioncactus/pretendard) | 개인 개발자 | 프론트엔드 | 3.7k | OFL-1.1 | ✅ |
| [yybmion/public-apis-4Kr](https://github.com/yybmion/public-apis-4Kr) | 개인 개발자 | 학습·자료 | 3.6k | MIT | ✅ |
| [chrisryugj/kordoc](https://github.com/chrisryugj/kordoc) | 개인 개발자 | 개발 도구 | 3.1k | MIT | ✅ |
| [chrisryugj/korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp) | 개인 개발자 | AI·데이터 | 2.9k | MIT | ✅ |
| [naver/egjs-flicking](https://github.com/naver/egjs-flicking) | 네이버 | 프론트엔드 | 2.9k | MIT |   |
| [naver/egjs-infinitegrid](https://github.com/naver/egjs-infinitegrid) | 네이버 | 프론트엔드 | 2.4k | MIT |   |
| [jo-duchan/tapflow](https://github.com/jo-duchan/tapflow) | 개인 개발자 | 개발 도구 | 2.3k | MIT |   |
| [naver/d2-coding-font](https://github.com/naver/d2-coding-font) | 네이버 | 프론트엔드 | 2.3k | OFL-1.1 |   |
| [line/line-bot-sdk-python](https://github.com/line/line-bot-sdk-python) | 라인 | 백엔드·인프라 | 2.1k | Apache-2.0 |   |
| [teddylee777/langchain-kr](https://github.com/teddylee777/langchain-kr) | 개인 개발자 | 학습·자료 | 2.1k | Apache-2.0 | ✅ |
| [toss/frontend-fundamentals](https://github.com/toss/frontend-fundamentals) | 토스 | 학습·자료 | 2k | MIT |   |
| [toss/es-hangul](https://github.com/toss/es-hangul) | 토스 | 프론트엔드 | 1.9k | MIT | ✅ |
| [Beomi/KoAlpaca](https://github.com/Beomi/KoAlpaca) | Beomi | AI·데이터 | 1.6k | Apache-2.0 | ✅ |
| [kakao/khaiii](https://github.com/kakao/khaiii) | 카카오 | AI·데이터 | 1.5k | Apache-2.0 | ✅ |
| [ClintJang/awesome-swift-korean-lecture](https://github.com/ClintJang/awesome-swift-korean-lecture) | ClintJang | 학습·자료 | 1.3k | MIT | ✅ |
| [kakaobrain/pororo](https://github.com/kakaobrain/pororo) | 카카오브레인 | AI·데이터 | 1.3k | Apache-2.0 | 보관됨 |
| [currenjin/site-for-developers](https://github.com/currenjin/site-for-developers) | currenjin | 학습·자료 | 1.2k | MIT | ✅ |
| [daangn/seed-design](https://github.com/daangn/seed-design) | 당근 | 프론트엔드 | 1.2k | Apache-2.0 | ✅ |
| [line/promgen](https://github.com/line/promgen) | 라인 | 백엔드·인프라 | 1.1k | MIT |   |
| [line/line-bot-sdk-nodejs](https://github.com/line/line-bot-sdk-nodejs) | 라인 | 백엔드·인프라 | 1.1k | Apache-2.0 |   |
| [toss/suspensive](https://github.com/toss/suspensive) | 토스 | 프론트엔드 | 1.1k | MIT |   |
| [daangn/stackflow](https://github.com/daangn/stackflow) | 당근 | 프론트엔드 | 1k | MIT |   |
| [woowacourse/back-end-roadmap](https://github.com/woowacourse/back-end-roadmap) | 우아한테크코스 | 학습·자료 | 990 | MIT | ✅ |
| [gaerae/awesome-algorithms-education](https://github.com/gaerae/awesome-algorithms-education) | gaerae | 학습·자료 | 914 | CC0-1.0 | ✅ |
| [line/kotlin-jdsl](https://github.com/line/kotlin-jdsl) | 라인 | 백엔드·인프라 | 826 | Apache-2.0 |   |
| [bab2min/Kiwi](https://github.com/bab2min/Kiwi) | 개인 개발자 | AI·데이터 | 811 | Apache-2.0 | ✅ |
| [line/line-bot-mcp-server](https://github.com/line/line-bot-mcp-server) | 라인 | AI·데이터 | 806 | Apache-2.0 |   |
| [amondnet/vercel-action](https://github.com/amondnet/vercel-action) | 개인 개발자 | 개발 도구 | 764 | MIT |   |
| [toss/overlay-kit](https://github.com/toss/overlay-kit) | 토스 | 프론트엔드 | 739 | MIT | ✅ |
| [e-/Hangul.js](https://github.com/e-/Hangul.js) | 개인 개발자 | 프론트엔드 | 709 | MIT | ✅ |
| [naver/fixture-monkey](https://github.com/naver/fixture-monkey) | 네이버 | 개발 도구 | 697 | Apache-2.0 | ✅ |
| [line/centraldogma](https://github.com/line/centraldogma) | 라인 | 백엔드·인프라 | 675 | Apache-2.0 |   |
| [open-korean-text/open-korean-text](https://github.com/open-korean-text/open-korean-text) | 커뮤니티 | AI·데이터 | 667 | Apache-2.0 | ✅ |
| [parksb/Front-End-Performance-Checklist](https://github.com/parksb/Front-End-Performance-Checklist) | parksb | 개발 도구 | 666 | MIT | ✅ |
| [line/line-fido2-server](https://github.com/line/line-fido2-server) | 라인 | 백엔드·인프라 | 587 | Apache-2.0 |   |
| [toss/use-funnel](https://github.com/toss/use-funnel) | 토스 | 프론트엔드 | 586 | MIT |   |
| [kakao/n2](https://github.com/kakao/n2) | 카카오 | AI·데이터 | 581 | Apache-2.0 |   |
| [kakao/buffalo](https://github.com/kakao/buffalo) | 카카오 | AI·데이터 | 578 | Apache-2.0 |   |
| [rtzr/Awesome-Korean-Speech-Recognition](https://github.com/rtzr/Awesome-Korean-Speech-Recognition) | RTZR | 학습·자료 | 558 | CC0-1.0 | ✅ |
| [naver/kapture](https://github.com/naver/kapture) | 네이버 | AI·데이터 | 546 | BSD-3-Clause |   |
| [hyunbinseo/holidays-kr](https://github.com/hyunbinseo/holidays-kr) | 개인 개발자 | 개발 도구 | 515 | MIT | ✅ |
| [eagle705/pytorch-bert-crf-ner](https://github.com/eagle705/pytorch-bert-crf-ner) | eagle705 | AI·데이터 | 507 | Apache-2.0 | ✅ |
| [Beomi/KcBERT](https://github.com/Beomi/KcBERT) | Beomi | AI·데이터 | 496 | MIT | ✅ |
| [woowacourse/tecoble](https://github.com/woowacourse/tecoble) | 우아한테크코스 | 학습·자료 | 491 | MIT |   |
| [toss/granite](https://github.com/toss/granite) | 토스 | 프론트엔드 | 481 | Apache-2.0 | ✅ |
| [CausalInferenceLab/Causal-Inference-with-Python](https://github.com/CausalInferenceLab/Causal-Inference-with-Python) | CausalInferenceLab | 학습·자료 | 481 | MIT | ✅ |
| [hyunwoongko/kss](https://github.com/hyunwoongko/kss) | hyunwoongko | AI·데이터 | 468 | BSD-3-Clause | ✅ |
| [naver/scavenger](https://github.com/naver/scavenger) | 네이버 | 개발 도구 | 467 | Apache-2.0 |   |
| [hyunwoongko/kochat](https://github.com/hyunwoongko/kochat) | hyunwoongko | AI·데이터 | 460 | Apache-2.0 | ✅ |
| [devsisters/shardcake](https://github.com/devsisters/shardcake) | 데브시스터즈 | 백엔드·인프라 | 449 | Apache-2.0 |   |
| [vmc-inner-circle/k-style-ui-ux](https://github.com/vmc-inner-circle/k-style-ui-ux) | VMC 이너서클 | 개발 도구 | 418 | MIT | ✅ |
| [spoqa/spoqa-han-sans](https://github.com/spoqa/spoqa-han-sans) | 스포카 | 프론트엔드 | 412 | OFL-1.1 | ✅ |
| [line/abc-user-feedback](https://github.com/line/abc-user-feedback) | 라인 | 개발 도구 | 381 | Apache-2.0 |   |
| [tae0y/real-estate-mcp](https://github.com/tae0y/real-estate-mcp) | tae0y | AI·데이터 | 381 | MIT | ✅ |
| [golangkorea/effective-go](https://github.com/golangkorea/effective-go) | Golang Korea | 학습·자료 | 380 | Apache-2.0 | ✅ |
| [PyTorchKR/tutorials-kr](https://github.com/PyTorchKR/tutorials-kr) | PyTorch 한국 사용자 모임 | 학습·자료 | 375 | BSD-3-Clause | ✅ |
| [line/decaton](https://github.com/line/decaton) | 라인 | 백엔드·인프라 | 373 | Apache-2.0 |   |
| [line/garr](https://github.com/line/garr) | 라인 | 백엔드·인프라 | 372 | Apache-2.0 |   |
| [suhdonghwi/nuri](https://github.com/suhdonghwi/nuri) | suhdonghwi | 개발 도구 | 372 | MIT | ✅ |
| [toss/react-simplikit](https://github.com/toss/react-simplikit) | 토스 | 프론트엔드 | 361 | MIT | ✅ |
| [samchon/payments](https://github.com/samchon/payments) | 개인 개발자 | 백엔드·인프라 | 359 | MIT | ✅ |
| [hmmhmmhm/daiso-mcp](https://github.com/hmmhmmhm/daiso-mcp) | hmmhmmhm | AI·데이터 | 354 | MIT | ✅ |
| [toss/es-git](https://github.com/toss/es-git) | 토스 | 개발 도구 | 333 | MIT | ✅ |
| [toss/h6s](https://github.com/toss/h6s) | 토스 | 개발 도구 | 319 | MIT | ✅ |
| [naver/arcus](https://github.com/naver/arcus) | 네이버 | 백엔드·인프라 | 317 | Apache-2.0 |   |
| [naver/spring-jdbc-plus](https://github.com/naver/spring-jdbc-plus) | 네이버 | 백엔드·인프라 | 293 | Apache-2.0 |   |
| [gnuboard/g6](https://github.com/gnuboard/g6) | 그누보드 | 백엔드·인프라 | 273 | MIT | ✅ |
| [toss/nestjs-aop](https://github.com/toss/nestjs-aop) | 토스 | 개발 도구 | 257 | MIT | ✅ |
| [line/apng-drawable](https://github.com/line/apng-drawable) | 라인 | 프론트엔드 | 255 | Apache-2.0 |   |
| [hsh2001/kor-law-for-dev](https://github.com/hsh2001/kor-law-for-dev) | hsh2001 | 학습·자료 | 253 | MIT | ✅ |
| [hangulize/hangulize](https://github.com/hangulize/hangulize) | 개인 개발자 | 개발 도구 | 251 | MIT | ✅ |
| [bluewings/korean-regexp](https://github.com/bluewings/korean-regexp) | 개인 개발자 | 프론트엔드 | 231 | MIT | ✅ |
| [738/inko](https://github.com/738/inko) | 738 | 개발 도구 | 231 | MIT | ✅ |
| [kakao/actionbase](https://github.com/kakao/actionbase) | 카카오 | 백엔드·인프라 | 230 | Apache-2.0 |   |
| [DoHyun468/claw-hwp](https://github.com/DoHyun468/claw-hwp) | DoHyun468 | 개발 도구 | 230 | MIT | ✅ |
| [daangn/autopprof](https://github.com/daangn/autopprof) | 당근 | 백엔드·인프라 | 221 | Apache-2.0 |   |
| [naver/pr-stats](https://github.com/naver/pr-stats) | 네이버 | 개발 도구 | 203 | Apache-2.0 | ✅ |
| [9beach/vscode-hanspell](https://github.com/9beach/vscode-hanspell) | 9beach | 개발 도구 | 203 | MIT | ✅ |
| [woowacourse/prolog](https://github.com/woowacourse/prolog) | 우아한테크코스 | 학습·자료 | 201 | MIT |   |
| [toss/apps-in-toss-harness](https://github.com/toss/apps-in-toss-harness) | 토스 | 개발 도구 | 194 | BSD-3-Clause | ✅ |
| [kakao/kakao_flutter_sdk](https://github.com/kakao/kakao_flutter_sdk) | 카카오 | 개발 도구 | 194 | Apache-2.0 |   |
| [Indosaram/hwpers](https://github.com/Indosaram/hwpers) | 개인 개발자 | 개발 도구 | 191 | MIT |   |
| [naver/egjs-axes](https://github.com/naver/egjs-axes) | 네이버 | 프론트엔드 | 190 | MIT |   |
| [9beach/hanspell](https://github.com/9beach/hanspell) | 9beach | 개발 도구 | 190 | MIT | ✅ |
| [ongjin/garu](https://github.com/ongjin/garu) | 개인 개발자 | AI·데이터 | 183 | Apache-2.0 | ✅ |
| [ncsoft/CaPa](https://github.com/ncsoft/CaPa) | 엔씨소프트 | AI·데이터 | 165 | BSD-3-Clause |   |
| [kakao/web2app](https://github.com/kakao/web2app) | 카카오 | 프론트엔드 | 164 | MIT |   |
| [muik/transliteration](https://github.com/muik/transliteration) | muik | 개발 도구 | 154 | Apache-2.0 | ✅ |
| [hyperconnect/HypeUI](https://github.com/hyperconnect/HypeUI) | 하이퍼커넥트 | 프론트엔드 | 149 | Apache-2.0 |   |
| [daangn/KarrotListKit](https://github.com/daangn/KarrotListKit) | 당근 | 프론트엔드 | 146 | Apache-2.0 |   |
| [naver/spring-batch-plus](https://github.com/naver/spring-batch-plus) | 네이버 | 백엔드·인프라 | 130 | Apache-2.0 |   |
| [kakao/prevue](https://github.com/kakao/prevue) | 카카오 | 개발 도구 | 127 | Apache-2.0 | ✅ |
| [chrisryugj/korean-dart-mcp](https://github.com/chrisryugj/korean-dart-mcp) | chrisryugj | AI·데이터 | 127 | MIT | ✅ |
| [naver/egjs-conveyer](https://github.com/naver/egjs-conveyer) | 네이버 | 프론트엔드 | 126 | MIT |   |
| [kakaobank/KF-DeBERTa](https://github.com/kakaobank/KF-DeBERTa) | 카카오뱅크 | AI·데이터 | 123 | MIT | ✅ |
| [naver/cfcs](https://github.com/naver/cfcs) | 네이버 | 프론트엔드 | 119 | MIT |   |
| [roboco-io/hwp2md](https://github.com/roboco-io/hwp2md) | roboco-io | 개발 도구 | 118 | MIT | ✅ |
| [Jhyub/JetBrainsMonoHangul](https://github.com/Jhyub/JetBrainsMonoHangul) | Jhyub | 프론트엔드 | 115 | OFL-1.1 | ✅ |
| [banksalad/AXSnapshot](https://github.com/banksalad/AXSnapshot) | 뱅크샐러드 | 개발 도구 | 113 | MIT | ✅ |
| [RanolP/dalmoori-font](https://github.com/RanolP/dalmoori-font) | RanolP | 프론트엔드 | 112 | Apache-2.0 | ✅ |
| [treesoop/hwp-mcp](https://github.com/treesoop/hwp-mcp) | treesoop | AI·데이터 | 110 | MIT | ✅ |
| [toss/docflow](https://github.com/toss/docflow) | 토스 | 개발 도구 | 106 | MIT | ✅ |
| [naver/design-to-ui](https://github.com/naver/design-to-ui) | 네이버 | 개발 도구 | 106 | Apache-2.0 | ✅ |
| [UpstageAI/korean-tax-calc-mcp](https://github.com/UpstageAI/korean-tax-calc-mcp) | Upstage | AI·데이터 | 102 | MIT | ✅ |
| [daangn/graplix](https://github.com/daangn/graplix) | 당근 | 백엔드·인프라 | 94 | MIT |   |
| [SDuck4/type-hangul](https://github.com/SDuck4/type-hangul) | SDuck4 | 개발 도구 | 94 | MIT | ✅ |
| [daangn/icona](https://github.com/daangn/icona) | 당근 | 개발 도구 | 93 | MIT |   |
| [toss/necto](https://github.com/toss/necto) | 토스 | 개발 도구 | 88 | MIT | ✅ |
| [hike-lab/public-data-lens](https://github.com/hike-lab/public-data-lens) | hike-lab | 개발 도구 | 85 | MIT | ✅ |
| [daangn/kinesumer](https://github.com/daangn/kinesumer) | 당근 | 백엔드·인프라 | 78 | Apache-2.0 |   |
| [ridi/react-viewer](https://github.com/ridi/react-viewer) | 리디 | 프론트엔드 | 64 | MIT |   |
| [daangn/urlpack](https://github.com/daangn/urlpack) | 당근 | 프론트엔드 | 61 | MIT |   |
| [yanolja/ogem](https://github.com/yanolja/ogem) | 야놀자 | 백엔드·인프라 | 42 | Apache-2.0 |   |
| [hanmariyang/giting-skills](https://github.com/hanmariyang/giting-skills) | Giting | 개발 도구 | 37 | MIT | ✅ |
| [sktelecom/bomlens](https://github.com/sktelecom/bomlens) | SK텔레콤 | 개발 도구 | 31 | Apache-2.0 |   |
| [sktelecom/onot](https://github.com/sktelecom/onot) | SK텔레콤 | 개발 도구 | 16 | Apache-2.0 |   |

</details>

## 저장소 구조

```
data/repos.json              # 사람이 관리하는 큐레이션 원본 (무엇을 넣을지·분류·한 줄 소개)
public/                      # 배포되는 정적 사이트 (빌드 없음)
  index.html · styles.css · app.js
  lib/filter.mjs             # 검색·필터·정렬·페이지 나누기 (브라우저와 테스트가 함께 사용)
  data/catalog.json          # 스크립트가 만드는 생성물 (스타·라이선스·최근 푸시·판정)
scripts/
  sync_repos.mjs             # GITHUB_TOKEN으로 catalog.json 생성 (CI)
  seed_from_gh.mjs           # gh CLI로 catalog.json 생성 (로컬, 토큰 불필요)
  serve.mjs                  # 로컬 미리보기 서버
  ui_check.mjs               # 360/1280 헤드리스 브라우저 검증 + 스크린샷
  tests/                     # node --test 단위 테스트
docs/workflows/sync.yml      # 일일 동기화 워크플로 (.github/workflows로 옮기면 활성화)
.github/ISSUE_TEMPLATE/submit-repo.yml   # 저장소 제보 폼
PRD.md                       # 기획서 (화면·데이터 모델·아키텍처·로드맵)
```

**운영비 0원** — 서버도 DB도 없습니다. 정적 파일 + GitHub Actions(하루 1회) + Cloudflare Pages 무료 플랜.

## 로컬에서 실행

Node 22 이상이면 됩니다. 설치할 패키지는 없습니다.

```bash
node scripts/serve.mjs                  # → http://localhost:4173
node --test scripts/tests/*.test.mjs    # 단위 테스트
```

`public/data/catalog.json`이 저장소에 포함되어 있어 바로 뜹니다. 데이터를 새로 받고 싶다면 (`gh` 로그인 상태에서):

```bash
node scripts/seed_from_gh.mjs
```

## 저장소 추가·수정

1. `data/repos.json`의 `repos` 배열에 항목을 추가합니다.

   ```jsonc
   {
     "repo": "owner/name",          // 필수
     "vendor": "만든 곳",            // 표시용 (조직·개인·제품 이름)
     "category": "frontend",        // frontend | ai | backend | tool | learn
     "summary": "한 줄 소개",         // 한국어로 직접 씁니다
     "tags": ["React", "모달"],
     "koreanDocs": true,            // 선택: 자동 판정을 덮어쓸 때만
     "docker": true,                // 선택: Dockerfile/이미지를 직접 확인했을 때만
     "addedAt": "2026-11-26"
   }
   ```

2. `node scripts/seed_from_gh.mjs`로 `catalog.json`을 갱신합니다(또는 Actions 실행).
3. PR을 올리면 검토 후 반영됩니다. 저장소를 직접 고치기 어렵다면 [제보 이슈](../../issues/new?template=submit-repo.yml)로 알려 주세요.

**수록 기준** — ① 해외 인디 개발자·소규모 팀 또는 한국 팀·기업·개인 개발자가 만든 공개 저장소 ② 지금 실무에 쓸 수 있는 것(보관(archived) 상태이거나 3년 이상 방치 + 대체재가 있으면 제외) ③ 상업 무료 라이선스가 명시된 것.

## 판정 규칙 상세

| 판정 | 방법 |
|---|---|
| 상업 무료 | SPDX가 MIT·Apache-2.0·BSD-2/3-Clause·ISC·MPL-2.0·CC0-1.0·Unlicense·0BSD·OFL-1.1 중 하나. GitHub이 라이선스를 못 읽는 저장소는 `license`에 사람이 확인한 값을 적는다(`licenseSource: curated`) |
| 한국어 문서 | `koreanDocs` 수동 값 → `README.ko.md`류 파일 → README 한글 100자 이상 순서로 판정 |
| Docker | `docker` 수동 값 → 루트 `Dockerfile` → topics에 `docker` |
| 최근 3개월 | `pushed_at`이 동기화 시점 −90일 이후 |

## 검색 규칙

| 입력 | 동작 |
|---|---|
| `k-ui-ux` | `-`·`_`·`/`·공백을 구분자로 나눠 `k`·`ui`·`ux`를 모두 포함하는 항목을 찾는다 → `k-style-ui-ux`가 바로 나온다 |
| `react 쿼리` | 두 토큰을 모두 포함(AND). 순서는 상관없다 |
| `차트` | 한글은 조사가 붙어도 찾는다(`차트가`, `차트를` 모두 매칭) |
| `k` · `ui` (1~2자 영문) | 낱말 경계에서만 맞춘다. `unsloth` 속 글자에 걸리지 않는다 |
| 대상 | 저장소 경로·이름·만든 곳·소개·원문 설명·태그·분류·언어 |

## 페이지 나누기

- 처음에는 **24개**만 그립니다(`PAGE_SIZE`).
- 남은 항목이 있으면 목록 아래에 `더 보기 (N개 남음)` 버튼이 붙고, 누를 때마다 24개씩 이어서 그립니다.
- 검색어·카테고리·필터·정렬이 바뀌면 다시 24개부터 보여 줍니다(URL 해시도 함께 갱신).

## 검증

- **단위 테스트 34개** (`scripts/tests/`) — 라이선스 판정(OFL-1.1·직접 확인 값 포함), 한국어/Docker 판정, 말일 보정, 실패 시 직전 값 유지, 스키마 검증, 토큰 검색(`k-ui-ux` → `k-style-ui-ux`), 24개 페이지 나누기, 검색·필터·정렬
- **헤드리스 브라우저 106개 항목** — 360px·1280px, 라이트·다크에서 첫 화면 구성(제목 → 검색 → 정렬·필터 → 카테고리 → 카드), **첫 화면 24개 렌더 · `더 보기` 1회 48개 · 끝까지 눌러 전체 260개 · 버튼 숨김**, **`k-ui-ux` 검색이 `k-style-ui-ux`를 표시**, 푸터 수록 현황 한 줄, 세부 필터 접힘/펼침, 카테고리 필 칩, 가로 넘침 0, 검색·필터 AND·정렬, 테마 토글·저장, 대비 4.5:1, 모달, 해시 복원, 키보드 조작, 콘솔 오류 0, 접근성 이름·터치 타깃

```bash
node --test scripts/tests/*.test.mjs
PUPPETEER_PATH=/path/to/puppeteer node scripts/ui_check.mjs --out downloads/k-oss-mvp
```

## 배포 (Cloudflare Pages)

1. Cloudflare Pages → *Create a project* → GitHub 저장소 연결
2. **Build command: (없음)** · **Build output directory: `public`**
3. 커밋마다 자동 배포. `data/repos.json`을 고치고 동기화가 돌면 사이트가 갱신됩니다.

## 자동 동기화 켜기

GitHub App 권한 제한으로 워크플로 파일은 `docs/workflows/sync.yml`에 있습니다. 소유자가 GitHub 웹에서 `.github/workflows/sync.yml` 파일을 만들어 내용을 붙여넣으면 매일 06:00 KST에 자동 실행됩니다. Actions 탭 → **저장소 메타데이터 동기화** → *Run workflow* 로 즉시 1회 실행할 수 있습니다.

동기화는 실패에 강합니다.

- 한 저장소가 실패해도 나머지는 갱신하고, 실패한 항목은 **직전 값 유지**
- 전부 실패하면 기존 `catalog.json`을 **덮어쓰지 않고** 워크플로만 실패 (사이트는 계속 동작)
- 파일을 쓰기 전에 스키마를 검증 (`assertCatalog`)

## 로드맵

- [x] 시드 40개로 확장 (국내 19개 + OFL 폰트 2개 + 별표 저장소 4개, 2026-11-26)
- [x] 93개로 대량 확장 (국내 기업·팀 15곳 38개 + 개인·커뮤니티 15개, 2026-11-26)
- [x] 260개로 확장 + 24개 `더 보기` + 토큰 검색 (글로벌 인디·실무 133개, 국내 인디·개인 34개, 2026-11-26)
- [ ] 태그 클릭 탐색, 상세 정적 페이지(`/r/{owner}/{repo}`), OG 이미지
- [ ] 주간 인기순 (스타 증가량 스냅샷)

## 라이선스

**아직 정하지 않았습니다.** 공개 저장소로 운영하려면 라이선스(예: MIT)를 정해 `LICENSE` 파일을 추가해야 합니다. `public/`의 코드와 `data/repos.json`의 큐레이션 목록은 별도로 정할 수 있습니다.
