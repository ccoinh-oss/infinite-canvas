
## 2026-06-30 - Task: 增加登录准入并保留浏览器本地存储
### What was done
- 新增账号密码登录准入：未登录访问页面会跳转登录页，未登录调用受保护 API 返回 401。
- 新增服务端签名会话 Cookie、登录、退出和会话查询接口，账号与会话参数统一写入根目录 YAML 配置。
- 顶部状态区新增当前账号展示与退出登录入口。
- 保持画布、我的素材、生成记录和 AI API Key 仍保存在当前浏览器本地，未迁移到服务器。
- 同步更新 README、CHANGELOG 和文档站说明，明确默认账号、配置文件位置和本地数据边界。

### Testing
- `cd web && bun run build`：通过，Next.js 生产构建成功。
- `cd web && bunx tsc --noEmit --pretty false`：未通过；发现仓库既有 TypeScript 错误和 `.next/dev` 旧类型残留，例如缺失历史路由类型、canvas 组件已有类型问题、`api/prompts` ES target 正则问题。本轮登录链路改动不依赖这些错误。
- 使用 `node .next/standalone/server.js` 在临时端口 `3104` 验证登录链路：
  - 未登录访问 `/canvas` 返回 `307` 并跳转 `/login?redirect=%2Fcanvas`。
  - 未登录访问 `/api/prompts?pageSize=1` 返回 `401`，响应 `{"code":401,"data":null,"msg":"请先登录"}`。
  - 使用默认账号 `admin / admin123` 调用 `/api/auth/login` 返回 `200`，写入 `infinite_canvas_session` Cookie。
  - 带 Cookie 调用 `/api/auth/session` 返回当前用户 `admin`。
  - 带 Cookie 调用 `/api/prompts?pageSize=1` 返回 `200` 和提示词数据。
  - 调用 `/api/auth/logout` 返回 `200` 并清空 Cookie。
  - 退出后再次调用 `/api/prompts?pageSize=1` 返回 `401`。

### Notes
- Changed files:
  - `config/app.yaml`：新增应用登录配置、默认账号、会话 Cookie 和本地数据提示。
  - `web/src/lib/auth/config.ts`：新增 YAML 配置读取、密码校验、会话签名和 Cookie 选项。
  - `web/src/app/api/auth/login/route.ts`：新增登录接口。
  - `web/src/app/api/auth/logout/route.ts`：新增退出接口。
  - `web/src/app/api/auth/session/route.ts`：新增会话查询接口。
  - `web/src/proxy.ts`：新增 Next.js 16 访问准入拦截。
  - `web/src/app/login/page.tsx`：新增登录页服务端入口。
  - `web/src/app/login/login-form.tsx`：新增登录表单和本地数据提示。
  - `web/src/stores/use-user-store.ts`：扩展用户状态、会话刷新和退出动作。
  - `web/src/components/layout/client-root-init.tsx`：应用启动时恢复服务端会话。
  - `web/src/components/layout/user-status-actions.tsx`：顶部展示当前账号并提供退出入口。
  - `web/scripts/auth-hash-password.mjs`：新增密码哈希生成脚本。
  - `web/package.json`、`web/bun.lock`：新增 `js-yaml` 依赖用于读取 YAML 配置。
  - `Dockerfile`：构建和运行镜像时复制 `config/`。
  - `docs/content/docs/backend/auth-login.mdx`：新增登录准入说明文档。
  - `docs/content/docs/backend/meta.json`、`docs/index.md`：新增登录文档入口。
  - `docs/content/docs/backend/local-development.mdx`、`docs/content/docs/overview/quick-start.mdx`、`docs/content/docs/overview/docker.mdx`、`docs/content/docs/overview/features.mdx`：补充登录配置与本地数据边界说明。
  - `docs/content/docs/progress/pending-test.mdx`：记录本轮可测试变更。
  - `README.md`、`CHANGELOG.md`：补充登录准入说明和版本记录。
- Existing pre-task changes left untouched: `web/next-env.d.ts`、`web/src/app/(user)/canvas/page.tsx`。
- Rollback: 执行 `git checkout -- CHANGELOG.md Dockerfile README.md docs/content/docs/backend/local-development.mdx docs/content/docs/backend/meta.json docs/content/docs/overview/docker.mdx docs/content/docs/overview/features.mdx docs/content/docs/overview/quick-start.mdx docs/content/docs/progress/pending-test.mdx docs/index.md web/bun.lock web/package.json web/src/components/layout/client-root-init.tsx web/src/components/layout/user-status-actions.tsx web/src/stores/use-user-store.ts progress.md`，并删除 `config/`、`docs/content/docs/backend/auth-login.mdx`、`web/scripts/`、`web/src/app/api/auth/`、`web/src/app/login/`、`web/src/lib/auth/`、`web/src/proxy.ts`。不要回滚上述 pre-task changes，除非确认它们不再需要。

## 2026-06-30 - Task: 改为网页自助注册和非 YAML 账号存储
### What was done
- 新增网页自助注册：登录页提供“注册账号”模式，注册成功后自动写入会话 Cookie 并进入应用。
- 新增账号运行数据文件：注册账号和账号修改写入 `data/auth-users.json`，`config/app.yaml` 只保存运行参数，不保存用户账号。
- 新增当前登录用户账号配置修改：支持修改用户名、显示名称和密码；修改密码需要当前密码，修改后刷新当前会话。
- Docker Compose 默认挂载 `./data:/app/data`，保证容器重建后注册账号仍保留。
- 保持画布、素材、生成记录和 AI API Key 仍保存在当前浏览器本地，不随账号同步到服务器。
- 同步更新登录说明、快速开始、Docker、功能说明、待测试、文档索引、README 和 CHANGELOG。

### Testing
- `cd web && bun run build`：通过，生产构建成功，路由包含 `/api/auth/register` 和 `/api/auth/account`。
- 使用 `node .next/standalone/server.js` 在临时端口 `3112` 做端到端 HTTP 验证，并临时把 `user_store_path` 指向 `data/auth-users.codex-test.json`，结束后已恢复和清理：
  - 未登录访问 `/canvas` 返回 `307`，跳转 `/login?redirect=%2Fcanvas`。
  - `/login` 页面 HTML 包含“注册账号”和“浏览器本地”提示。
  - 未登录 `PATCH /api/auth/account` 返回 `401 请先登录`。
  - `POST /api/auth/register` 返回 `200`，写入 `infinite_canvas_session` Cookie，并创建账号数据文件。
  - 带 Cookie 调用 `/api/auth/session` 返回注册用户。
  - 重复注册同名用户返回 `400 用户名已存在`。
  - `PATCH /api/auth/account` 修改用户名和显示名称返回 `200`，随后会话返回新用户名和新昵称。
  - 使用错误当前密码修改密码返回 `401 当前密码不正确`。
  - 使用正确当前密码修改密码返回 `200`。
  - 退出后旧密码登录返回 `401`，新密码登录返回 `200`。
  - 新密码登录后访问 `/canvas` 返回 `200`。
  - 临时账号数据文件包含新用户名和 `pbkdf2_sha256$` 哈希，不包含明文旧密码或新密码；临时 YAML 不包含 `users:` 或测试用户名。
- `cd web && bunx tsc --noEmit --pretty false`：未通过；仍为仓库既有 `.next/dev` 历史路由类型、canvas 组件、`api/prompts` ES target 正则等错误，输出未指向本轮新增 auth 文件。

### Notes
- Changed files:
  - `config/app.yaml`：移除 YAML 用户账号，新增注册开关和账号数据文件路径配置。
  - `web/src/lib/auth/config.ts`：改为从 `data/auth-users.json` 读写账号，新增注册、账号修改、密码哈希、会话刷新和 YAML BOM 兼容处理。
  - `web/src/app/api/auth/register/route.ts`：新增注册 API，注册成功后自动登录。
  - `web/src/app/api/auth/account/route.ts`：新增当前用户账号配置修改 API。
  - `web/src/app/api/auth/login/route.ts`、`logout/route.ts`、`session/route.ts`：统一非 YAML 账号存储后的登录、退出和会话响应。
  - `web/src/proxy.ts`：放行注册 API，继续保护业务页面、业务 API 和 `/webdav-proxy`。
  - `web/src/app/login/login-form.tsx`：登录页增加登录/注册双模式和本地数据提示。
  - `web/src/stores/use-user-store.ts`：新增账号配置更新动作。
  - `web/src/components/layout/user-status-actions.tsx`：新增账号配置入口、弹窗和退出入口。
  - `docker-compose.yml`、`docker-compose.local.yml`：挂载 `./data:/app/data` 保存注册账号。
  - `docs/content/docs/backend/auth-login.mdx`、`docs/content/docs/overview/quick-start.mdx`、`docs/content/docs/overview/docker.mdx`、`docs/content/docs/overview/features.mdx`、`docs/content/docs/progress/pending-test.mdx`、`docs/index.md`、`README.md`、`CHANGELOG.md`：同步说明自助注册、非 YAML 账号存储和本地浏览器数据边界。
  - `web/scripts/auth-hash-password.mjs`：删除，不再需要手工为 YAML 用户生成密码哈希。
- Existing pre-task changes left untouched: `web/next-env.d.ts`、`web/src/app/(user)/canvas/page.tsx`。
- Rollback: 可执行 `git checkout -- config/app.yaml web/src/lib/auth/config.ts web/src/app/api/auth/login/route.ts web/src/app/api/auth/logout/route.ts web/src/app/api/auth/session/route.ts web/src/proxy.ts web/src/app/login/login-form.tsx web/src/stores/use-user-store.ts web/src/components/layout/user-status-actions.tsx docker-compose.yml docker-compose.local.yml docs/content/docs/backend/auth-login.mdx docs/content/docs/overview/quick-start.mdx docs/content/docs/overview/docker.mdx docs/content/docs/overview/features.mdx docs/content/docs/progress/pending-test.mdx docs/index.md README.md CHANGELOG.md progress.md`，并删除 `web/src/app/api/auth/register/`、`web/src/app/api/auth/account/`；如需恢复旧手工 YAML 用户脚本，再从上一提交恢复 `web/scripts/auth-hash-password.mjs`。不要回滚上述 pre-task changes，除非确认它们不再需要。

## 2026-06-30 - Task: 调整首页顶栏视觉
### What was done
- 降低首页顶栏视觉重量：改为更轻的半透明磨砂背景、弱边框和更克制的品牌区尺寸。
- 将桌面导航改为低高度圆角按钮样式，缩小图标和文字占比，避免压过首页主视觉。
- 将首页右侧账号、配置、主题、版本等操作收进统一的轻量胶囊区域，同时保留画布页 `variant="canvas"` 的原有扁平表现。
- 保留 `/canvas/[id]` 隐藏全局顶栏逻辑和移动端菜单入口。无需更新 docs 待办或功能说明，本轮仅为视觉微调。

### Testing
- `cd web && bun run build`：通过，Next.js 生产构建成功，路由生成正常。

### Notes
- Changed files:
  - `web/src/components/layout/app-top-nav.tsx`：调整首页/全局顶栏背景、品牌区、导航链接和右侧操作区视觉样式。
  - `web/src/components/layout/user-status-actions.tsx`：统一默认顶栏按钮、账号名和版本按钮样式，并为画布模式保留原有扁平按钮表现。
  - `progress.md`：追加本轮视觉调整和验证记录。
- Existing pre-task changes left untouched: `web/next-env.d.ts`、`web/src/app/(user)/canvas/page.tsx` 以及上一轮登录功能相关未提交文件。
- Rollback: 可执行 `git checkout -- web/src/components/layout/app-top-nav.tsx web/src/components/layout/user-status-actions.tsx progress.md` 回退本轮顶栏视觉调整；如需保留历史进度记录，请只回退两个组件文件。

## 2026-06-30 - Task: 接入两个 GitHub 提示词源
### What was done
- 新增 `songtianlun/awesome-prompts` 提示词源，解析 GPT Image 1、GPT-4o、Nano Banana 和 Nano Banana Pro 图像案例文档。
- 新增 `Danielhan626/best-gpt-image-2-prompts-digest` 提示词源，解析 GPT Image 2 中文整理案例详情。
- 同步更新第三方提示词源文档和待测试记录，方便后续在 `/prompts` 页面人工确认展示效果。

### Testing
- `cd web && bun run build`：通过，Next.js 生产构建成功。
- 使用 `node .next/standalone/server.js` 在临时端口 `3124` 验证提示词接口：
  - 注册临时账号成功，获得会话 Cookie。
  - `GET /api/prompts?category=songtianlun-awesome-prompts&pageSize=3` 返回 `200`，`total=219`。
  - `GET /api/prompts?category=danielhan-gpt-image-2-digest&pageSize=3` 返回 `200`，`total=106`。
- `cd web && bunx tsc --noEmit --pretty false --skipLibCheck`：未通过；仍包含仓库既有 canvas、image/video 页面 props、ES target 正则等类型错误，本轮新增 route 也沿用该文件既有 dotAll 正则风格，生产构建已通过。

### Notes
- Changed files:
  - `web/src/app/api/prompts/route.ts`：新增两个远程提示词源的分类、拉取和解析逻辑。
  - `docs/content/docs/overview/third-party-prompt-repositories.mdx`：补充两个新增 GitHub 提示词源。
  - `docs/content/docs/progress/pending-test.mdx`：记录本轮提示词库来源扩展待人工测试。
  - `progress.md`：追加本轮接入和验证记录。
- Existing pre-task changes left untouched: `web/next-env.d.ts`、`web/src/app/(user)/canvas/page.tsx` 以及上一轮登录功能相关未提交文件。
- Rollback: 可执行 `git checkout -- web/src/app/api/prompts/route.ts docs/content/docs/overview/third-party-prompt-repositories.mdx docs/content/docs/progress/pending-test.mdx progress.md` 回退本轮提示词源接入；如需保留历史进度记录，请只回退前三个文件。

## 2026-06-30 - Task: 完整回归测试提示词源接入
### What was done
- 对接入提示词源后的生产构建、认证流程、受保护页面、提示词 API 全分类、搜索、标签筛选和分页做本地自动回归。
- 测试发现旧的 `EvoLinkAI/awesome-gpt-image-2-API-and-Prompts` raw 地址返回 404，导致 `gpt-image-2-prompts` 空分类；已移除该失效源和文档记录，避免提示词库出现不可用分类。
- 重新验证保留的 7 个提示词分类均能返回数据，其中两个新增分类分别返回 `songtianlun-awesome-prompts=219`、`danielhan-gpt-image-2-digest=106`。

### Testing
- `cd web && bun run build`：通过，Next.js 生产构建成功。
- 使用 `node .next/standalone/server.js` 在临时端口 `3125` 做自动化回归：
  - 未登录访问 `/canvas` 返回 `307` 跳转登录；未登录访问 `/api/prompts?pageSize=1` 返回 `401`。
  - 注册临时账号成功，`/api/auth/session` 返回当前用户。
  - 已登录访问 `/`、`/canvas`、`/prompts`、`/assets`、`/image`、`/video` 均返回 `200`。
  - 账号配置修改成功，退出登录后业务 API 重新返回 `401`。
  - 保留提示词分类查询通过：`awesome-gpt-image=53`、`awesome-gpt4o-image-prompts=76`、`youmind-gpt-image-2=126`、`youmind-nano-banana-pro=128`、`davidwu-gpt-image2-prompts=494`、`songtianlun-awesome-prompts=219`、`danielhan-gpt-image-2-digest=106`。
  - 新增 `songtianlun-awesome-prompts` 的标签筛选、关键词搜索和分页通过；新增 `danielhan-gpt-image-2-digest` 的关键词搜索通过。
- `cd web && bunx tsc --noEmit --pretty false --skipLibCheck`：仍未通过；输出为仓库既有 canvas、image/video 页面 props、ES target 正则等类型错误，生产构建和本轮接口回归均已通过。

### Notes
- Changed files:
  - `web/src/app/api/prompts/route.ts`：移除失效 EvoLinkAI 源，保留并验证两个新增源解析逻辑。
  - `docs/content/docs/overview/third-party-prompt-repositories.mdx`：移除失效源记录，保留新增源记录。
  - `docs/content/docs/progress/pending-test.mdx`：补充失效源移除待测说明。
  - `progress.md`：追加本轮完整回归测试记录。
- Existing pre-task changes left untouched: `web/next-env.d.ts`、`web/src/app/(user)/canvas/page.tsx` 以及上一轮登录功能相关未提交文件。
- Rollback: 可执行 `git checkout -- web/src/app/api/prompts/route.ts docs/content/docs/overview/third-party-prompt-repositories.mdx docs/content/docs/progress/pending-test.mdx progress.md` 回退本轮提示词源修复和测试记录；如需保留历史进度记录，请只回退前三个文件。

## 2026-06-30 - Task: 提示词页面显示总量和更新时间
### What was done
- 提示词 API 新增返回 `totalAll`、`sourceCount` 和 `fetchedAt`，用于描述当前远程提示词缓存的全库总量、来源数量和最近拉取时间。
- 提示词中心顶部新增三块信息：提示词总量、当前筛选数量、更新时间，并显示远程源数量。
- 同步更新待测试记录，方便后续人工确认页面展示效果。

### Testing
- `cd web && bun run build`：通过，Next.js 生产构建成功。
- 使用 `node .next/standalone/server.js` 在临时端口 `3126` 验证提示词接口：
  - 注册临时账号成功。
  - `GET /api/prompts?pageSize=2` 返回 `200`。
  - 响应包含 `total=1202`、`totalAll=1202`、`sourceCount=7`、`fetchedAt` 时间戳、`categories=7`。

### Notes
- Changed files:
  - `web/src/app/api/prompts/route.ts`：提示词列表响应新增总量、来源数和缓存拉取时间字段。
  - `web/src/services/api/prompts.ts`：补充响应类型和更新时间格式化函数。
  - `web/src/components/prompts/use-prompt-list.ts`：向页面透出总量、来源数和更新时间。
  - `web/src/app/(user)/prompts/page.tsx`：页面顶部展示提示词总量、当前筛选数、更新时间和远程源数量。
  - `docs/content/docs/progress/pending-test.mdx`：记录本轮可测试页面展示变化。
  - `progress.md`：追加本轮实现和验证记录。
- Existing pre-task changes left untouched: `web/next-env.d.ts`、`web/src/app/(user)/canvas/page.tsx` 以及上一轮登录与提示词源相关未提交文件。
- Rollback: 可执行 `git checkout -- web/src/app/api/prompts/route.ts web/src/services/api/prompts.ts web/src/components/prompts/use-prompt-list.ts web/src/app/(user)/prompts/page.tsx docs/content/docs/progress/pending-test.mdx progress.md` 回退本轮页面信息展示；如需保留历史进度记录，请只回退前五个文件。

## 2026-06-30 - Task: 全量接入 YouMind AI Image Prompts Skill
### What was done
- 全量接入 `YouMind-OpenLab/ai-image-prompts-skill` 远程提示词源。
- 从 `references/manifest.json` 读取全部分类 JSON，解析每条数据的 `title`、`content`、`description`、`sourceMedia` 和 `needReferenceImages`。
- 将 `title` 映射为提示词标题、`content` 映射为提示词正文、`sourceMedia` 映射为封面和详情预览，分类标题和“需要参考图”写入标签。
- 按 `id` 或提示词正文做去重，避免同一条提示词在多个分类重复显示。
- 同步更新第三方提示词源文档和待测试记录。

### Testing
- `cd web && bun run build`：通过，Next.js 生产构建成功。
- 使用 `node .next/standalone/server.js` 在临时端口 `3127` 验证提示词接口：
  - 注册临时账号成功。
  - `GET /api/prompts?pageSize=2` 返回 `200`，`totalAll=15290`、`sourceCount=8`、`categories=8`。
  - `GET /api/prompts?category=youmind-ai-image-prompts-skill&pageSize=3` 返回 `200`，`total=14088`，首条包含标题、封面图和分类标签。

### Notes
- Changed files:
  - `web/src/app/api/prompts/route.ts`：新增 `youmind-ai-image-prompts-skill` 分类和全量 JSON 解析逻辑。
  - `docs/content/docs/overview/third-party-prompt-repositories.mdx`：补充新增 GitHub 提示词源。
  - `docs/content/docs/progress/pending-test.mdx`：记录本轮提示词库全量源接入待测事项。
  - `progress.md`：追加本轮实现和验证记录。
- Existing pre-task changes left untouched: `web/next-env.d.ts`、`web/src/app/(user)/canvas/page.tsx` 以及上一轮登录、提示词源和页面统计相关未提交文件。
- Rollback: 可执行 `git checkout -- web/src/app/api/prompts/route.ts docs/content/docs/overview/third-party-prompt-repositories.mdx docs/content/docs/progress/pending-test.mdx progress.md` 回退本轮全量源接入；如需保留历史进度记录，请只回退前三个文件。

## 2026-06-30 - Task: 规范化 Base URL 结尾
### What was done
- 将内置 Base URL 从 `https://cca.maya.today/` 调整为 `https://cca.maya.today`，界面不再展示结尾 `/`。
- 配置写入 `baseUrl` 和 `channels` 时统一去除结尾 `/`，兼容用户从链接或旧本地配置导入带斜杠的地址。
- 请求 URL 拼接继续复用统一规范化逻辑，避免出现重复斜杠或错误路径。
- 同步更新待测试记录，提示后续人工确认配置弹窗展示和请求行为。

### Testing
- `cd web && bun run build`：通过，Next.js 生产构建成功。
- `rg 'LOCKED_BASE_URL|normalizeBaseUrl|buildApiUrl|updateConfig\\("baseUrl"|updateConfig\\("channels"' ...`：确认 Base URL 默认值、写入入口和请求拼接入口均覆盖。

### Notes
- Changed files:
  - `web/src/stores/use-config-store.ts`：默认 Base URL 去除结尾 `/`，并新增保存与请求拼接共用的规范化函数。
  - `docs/content/docs/progress/pending-test.mdx`：记录本轮配置行为变更待人工测试。
  - `progress.md`：追加本轮实现和验证记录。
- Existing pre-task changes left untouched: `web/next-env.d.ts`、`web/src/app/(user)/canvas/page.tsx` 以及上一轮登录、提示词源和页面统计相关未提交文件。
- Rollback: 可执行 `git checkout -- web/src/stores/use-config-store.ts docs/content/docs/progress/pending-test.mdx progress.md` 回退本轮 Base URL 规范化；如需保留历史进度记录，请只回退前两个文件。

## 2026-06-30 - Task: 移除默认 Base URL 尾斜杠
### What was done
- 将运行代码中的默认 Base URL 固定为 `https://cca.maya.today`，不再使用 `https://cca.maya.today/`。
- 补充配置保存兜底，写入 `baseUrl` 或 `channels` 时自动去掉结尾 `/`。
- 请求 URL 拼接继续复用同一规范化逻辑，旧本地配置带 `/` 时也会被去除。

### Testing
- `rg "https://cca\\.maya\\.today/|cca\\.maya\\.today" . -g '!web/.next' -g '!web/node_modules' -g '!node_modules'`：运行代码只剩 `https://cca.maya.today`，带 `/` 的匹配仅存在于历史 `progress.md` 文本说明。
- `cd web && bun run build`：通过，Next.js 生产构建成功。

### Notes
- Changed files:
  - `web/src/stores/use-config-store.ts`：修正默认 Base URL 并增加保存/请求共用的去尾斜杠规范化。
  - `progress.md`：追加本轮修正和验证记录。
- Existing pre-task changes left untouched: `web/next-env.d.ts`、`web/src/app/(user)/canvas/page.tsx` 以及上一轮登录、提示词源、页面统计和配置相关未提交文件。
- Rollback: 可执行 `git checkout -- web/src/stores/use-config-store.ts progress.md` 回退本轮默认 Base URL 修正；如需保留历史进度记录，请只回退代码文件。

## 2026-06-30 - Task: 修复 Base URL 残留尾斜杠和模型拉取
### What was done
- 配置弹窗的 Base URL 展示强制使用去尾斜杠后的值，旧浏览器本地配置即使保存过 `https://cca.maya.today/` 也不会继续显示结尾 `/`。
- 页面启动时自动清理 `config.baseUrl` 和各渠道 `channel.baseUrl` 中的结尾 `/`，并写回本地配置。
- URL 参数导入 `baseUrl` 时同步去掉结尾 `/`。
- 新增 `/api/models` 服务端代理拉取模型列表，前端“拉取模型”不再直接从浏览器请求外部 API，避免 CORS 或外部站点返回 HTML 首页导致失败。
- 修正渠道创建逻辑：传入自定义 Base URL 时保留该地址并去尾斜杠，未传时才使用内置 `https://cca.maya.today`。

### Testing
- `rg 'https://cca\\.maya\\.today/|https://cca\\.maya\\.today|/api/models|displayBaseUrl|normalizeBaseUrl' web/src ...`：运行代码中只剩 `https://cca.maya.today`，没有 `https://cca.maya.today/`。
- `cd web && bun run build`：通过，Next.js 生产构建成功，路由中包含 `/api/models`。
- 使用 standalone 临时服务验证 `/api/models` 受登录保护：未登录返回 `401 请先登录`。
- 注册临时账号后，用无效 Key 分别提交 `https://cca.maya.today` 和 `https://cca.maya.today/`：均返回明确的 `401 鉴权失败，请检查 API Key、套餐权限或模型权限`，不会返回网关首页 HTML。
- 使用本地 mock OpenAI `/v1/models` 服务验证：Base URL 传入 `http://127.0.0.1:<port>/` 时，`/api/models` 能去尾斜杠并成功返回 `mock-image-model`、`mock-text-model`。

### Notes
- Changed files:
  - `web/src/stores/use-config-store.ts`：默认 Base URL、旧配置合并、渠道创建、请求配置和 URL 拼接统一去尾斜杠。
  - `web/src/components/layout/app-config-modal.tsx`：Base URL 显示层强制去尾斜杠，避免旧状态继续展示 `/`。
  - `web/src/components/layout/client-root-init.tsx`：页面启动和 URL 参数导入时清理尾斜杠。
  - `web/src/services/api/image.ts`：模型拉取改走本应用 `/api/models` 服务端代理。
  - `web/src/app/api/models/route.ts`：新增服务端模型列表代理接口。
  - `docs/content/docs/progress/pending-test.mdx`：记录本轮配置和模型拉取待测项。
  - `progress.md`：追加本轮修复和验证记录。
- Existing pre-task changes left untouched: `web/next-env.d.ts`、`web/src/app/(user)/canvas/page.tsx` 以及上一轮登录、提示词源、页面统计和配置相关未提交文件。
- Rollback: 可执行 `git checkout -- web/src/stores/use-config-store.ts web/src/components/layout/app-config-modal.tsx web/src/components/layout/client-root-init.tsx web/src/services/api/image.ts docs/content/docs/progress/pending-test.mdx progress.md` 并删除 `web/src/app/api/models/route.ts` 回退本轮修复；如需保留历史进度记录，请只回退代码和待测文件。

## 2026-06-30 - Task: 修复图片生成请求失败
### What was done
- 新增 `/api/ai` 服务端临时转发接口，用于 OpenAI 兼容图片生成和图片编辑请求。
- 将文生图 `/v1/images/generations` 从浏览器直连改为调用本应用 `/api/ai`，由服务端转发到用户配置的 Base URL。
- 将图生图/参考图编辑 `/v1/images/edits` 从浏览器直连改为调用本应用 `/api/ai`，参考图以 data URL 传给本应用后临时组装 FormData 转发。
- 保持 API Key 仍来自浏览器本地配置；服务端只在本次请求中转发，不写入 YAML 或服务器配置。
- 同步更新 README、功能说明、快速开始、本地开发和文档索引，说明模型拉取和 OpenAI 图片生成/编辑已通过 Next.js Route 临时转发。

### Testing
- `cd web && bun run build`：通过，Next.js 生产构建成功，路由中包含 `/api/ai` 和 `/api/models`。
- 使用 standalone 临时服务和本地 mock OpenAI 服务验证 `/api/ai`：
  - `POST /api/ai` 转发 `path=/images/generations` 成功返回 mock `b64_json`。
  - `POST /api/ai` 转发 `path=/images/edits` 成功组装 multipart FormData 并返回 mock `b64_json`。
  - Base URL 传入带结尾 `/` 的本地 mock 地址时，仍正确请求上游 `/v1/images/...`。
- `rg` 检查关键旧文档表述：已移除“前台直连 / AI 接口不经过后端代理”等与当前图片代理行为冲突的说明。

### Notes
- Changed files:
  - `web/src/app/api/ai/route.ts`：新增 OpenAI 兼容图片生成/编辑临时转发接口。
  - `web/src/services/api/image.ts`：文生图和图生图改走 `/api/ai`，保留模型拉取走 `/api/models`。
  - `README.md`：更新 AI 请求链路说明。
  - `docs/content/docs/overview/features.mdx`：更新 AI 生成和限制说明。
  - `docs/content/docs/overview/quick-start.mdx`：更新快速开始中的 AI 请求链路说明。
  - `docs/content/docs/backend/local-development.mdx`：更新本地开发说明。
  - `docs/index.md`：更新文档索引说明。
  - `docs/content/docs/progress/pending-test.mdx`：记录本轮图片生成代理待测事项。
  - `progress.md`：追加本轮修复和验证记录。
- Existing pre-task changes left untouched: `web/next-env.d.ts`、`web/src/app/(user)/canvas/page.tsx` 以及上一轮登录、提示词源、页面统计和配置相关未提交文件。
- Rollback: 可执行 `git checkout -- web/src/services/api/image.ts README.md docs/content/docs/overview/features.mdx docs/content/docs/overview/quick-start.mdx docs/content/docs/backend/local-development.mdx docs/index.md docs/content/docs/progress/pending-test.mdx progress.md` 并删除 `web/src/app/api/ai/route.ts` 回退本轮图片生成代理；如需保留历史进度记录，请只回退代码和文档文件。

## 2026-06-30 - Task: 修复默认模型和 YouMind 封面
### What was done
- 默认渠道模型列表只保留 `gpt-image-2`，避免默认渠道继续出现其他模型。
- 将默认模型选择兜底调整为 `default::gpt-image-2`，确保默认渠道可直接使用。
- 修复 YouMind 提示词源封面解析，过滤 `Language`、`License`、`Stars`、README 封面和 Star History 等仓库装饰图。

### Testing
- `python` 抽样检查 `YouMind-OpenLab/awesome-nano-banana-pro-prompts` README 的 8 条图片 URL：有效封面来自 `cms-assets.youmind.com`，不再使用 `img.shields.io` 等徽章图。
- `cd web && bun run build`：通过，Next.js 生产构建成功。

### Notes
- Changed files:
  - `web/src/stores/use-config-store.ts`：默认渠道模型列表和默认选中模型收敛到 `gpt-image-2`。
  - `web/src/components/layout/app-config-modal.tsx`：默认渠道模型展示与保存保持一致。
  - `web/src/app/api/prompts/route.ts`：YouMind 图片解析过滤仓库装饰图。
  - `docs/content/docs/progress/pending-test.mdx`：记录本轮待人工确认事项。
  - `progress.md`：追加本轮实现和验证记录。
- Existing pre-task changes left untouched: 登录、Base URL、图片生成代理和 UI 相关既有未提交改动未回滚。
- Rollback: 可执行 `git checkout -- web/src/stores/use-config-store.ts web/src/components/layout/app-config-modal.tsx web/src/app/api/prompts/route.ts docs/content/docs/progress/pending-test.mdx progress.md` 回退本轮默认模型和 YouMind 封面修复；如需保留历史进度记录，请只回退代码和待测文件。

## 2026-06-30 - Task: 修复提示词库分类图片显示
### What was done
- 提示词库卡片和详情页改用统一图片组件，图片为空或加载失败时显示轻量占位，不再出现破图图标或异常大字占位。
- 提示词源解析新增 HTML `<img>` 支持，过滤徽章、仓库封面、已确认失效图片和无实际图片文件的源路径。
- `songtianlun/awesome-prompts` 分类优先使用 `output` 结果图作为封面，避免部分 `input.jpg` 失效导致卡片破图。
- `Danielhan626/best-gpt-image-2-prompts-digest` 源仓库未提供实际图片文件，保留提示词内容，封面统一走占位展示。

### Testing
- `cd web && bun run build`：通过，Next.js 生产构建成功。
- 重启 30026 端口服务后，注册临时账号并分页拉取 `/api/prompts`：共 15302 条提示词；`awesome-gpt-image`、`songtianlun-awesome-prompts`、`youmind-ai-image-prompts-skill` 等主要分类可返回有效封面；临时账号已清理。
- 全量 HTTP 图片审查：15062 个非空封面 URL 检查后无 404/ERR；剩余 112 条为空封面，均会由前端占位显示，明细已写入 `data/prompt-image-audit/cover-summary-final.json` 和 `data/prompt-image-audit/bad-cover-records-final.csv`。
- 当前服务已按最新构建重启在 `http://127.0.0.1:30026`，`/api/auth/session` 返回 200。

### Notes
- Changed files:
  - `web/src/app/api/prompts/route.ts`：补充提示词图片解析、过滤失效图片源，并调整部分分类封面选择策略。
  - `web/src/components/prompts/prompt-image.tsx`：新增统一提示词图片展示和失败占位组件。
  - `web/src/components/prompts/prompt-card.tsx`：卡片封面改用统一图片组件。
  - `web/src/components/prompts/prompt-detail-dialog.tsx`：详情页封面改用统一图片组件。
  - `docs/content/docs/progress/pending-test.mdx`：记录本轮提示词图片显示待人工确认事项。
  - `progress.md`：追加本轮实现和验证记录。
- Existing pre-task changes left untouched: 端口、Base URL、模型列表、图片生成代理和默认模型相关既有未提交改动未回滚。
- Rollback: 可执行 `git checkout -- web/src/app/api/prompts/route.ts web/src/components/prompts/prompt-card.tsx web/src/components/prompts/prompt-detail-dialog.tsx docs/content/docs/progress/pending-test.mdx progress.md` 并删除 `web/src/components/prompts/prompt-image.tsx` 回退本轮图片显示修复；如需保留历史进度记录，请只回退代码和待测文件。

## 2026-07-01 - Task: 首页提示词随机展示
### What was done
- 首页“沉淀每一次好结果”改为每次刷新随机展示 12 条有封面的提示词。
- 首页随机展示区域标题改为“灵机一动”，副标题改为“每次刷新页面，都会遇见新的视觉灵感。”。
- 首页随机展示卡片移除图片上的提示词正文遮罩，只保留顶部轻量标签和底部标题，减少对图片主体的遮挡。
- “灵机一动”标题旁新增“换一批”按钮，点击后不刷新整页，直接重新随机加载示例图。
- “灵机一动”每张卡片新增“复制”和“导入”动作；复制提示词后给出成功提示，导入会新建画布并放入示例图节点和已填提示词的配置节点。
- “灵机一动”标题旁新增“中文”按钮，点击后只在包含中文的提示词中随机换图。
- 首页“当前提示词总量”后追加中文提示词总量，复用 `/api/prompts` 返回的 `totalChinese`。
- “灵机一动”的“全部/中文”改为范围切换胶囊，“换一批”作为独立动作放在同一控制条中，避免按钮堆在标题旁。
- `/api/prompts` 新增随机返回和仅有封面过滤参数，供首页使用，不影响提示词库正常分页浏览。
- `/api/prompts` 新增 `language=zh` 查询参数，用于过滤标题、提示词或预览内容包含中文的提示词。
- `/api/prompts` 新增 `totalChinese` 返回字段，表示全量提示词中包含中文字符的数量。

### Testing
- `cd web && bun run build`：通过，Next.js 生产构建成功；本轮文案、遮挡修复、“换一批”按钮、卡片复制/导入动作和控制条布局调整后均再次构建通过。
- 重启 30026 端口服务后，注册临时账号验证 `/api/prompts?pageSize=12&random=1&coverOnly=1&language=zh`：返回 12 条，其中 12 条均包含中文；临时账号已清理。
- 重启 30026 端口服务后，注册临时账号验证 `/api/prompts?pageSize=1&random=1&coverOnly=1`：返回 `totalAll=15302`、`totalChinese=1210`；临时账号已清理。
- 重启 30026 端口服务后，注册临时账号连续请求两次 `/api/prompts?pageSize=12&random=1&coverOnly=1`：两次返回的 12 条 ID 不相同，且空封面数量为 0；临时账号已清理。
- `/api/auth/session` 返回 200，确认当前服务运行在 `http://127.0.0.1:30026`。

### Notes
- Changed files:
  - `web/src/app/api/prompts/route.ts`：新增 `random=1` 和 `coverOnly=1` 查询参数处理。
  - `web/src/app/api/prompts/route.ts`：新增 `language=zh` 查询参数处理。
  - `web/src/app/api/prompts/route.ts`：新增 `totalChinese` 返回字段。
  - `web/src/services/api/prompts.ts`：请求参数类型新增随机、仅封面、中文过滤开关和中文总量字段。
  - `web/src/app/(user)/page.tsx`：首页展示改为请求随机有封面提示词，并更新区域标题、副标题、卡片遮罩布局、主动刷新按钮、范围切换控制条、中文总量、复制提示词和导入画布动作。
  - `docs/content/docs/progress/pending-test.mdx`：记录本轮首页随机展示待人工确认事项。
  - `progress.md`：追加本轮实现和验证记录。
- Existing pre-task changes left untouched: 端口、Base URL、模型列表、图片生成代理和提示词图片修复相关既有未提交改动未回滚。
- Rollback: 可执行 `git checkout -- web/src/app/api/prompts/route.ts web/src/services/api/prompts.ts web/src/app/(user)/page.tsx docs/content/docs/progress/pending-test.mdx progress.md` 回退本轮首页随机展示；如需保留历史进度记录，请只回退代码和待测文件。

## 2026-07-01 - Task: 提示词库增加中文筛选
### What was done
- 提示词库筛选区新增“中文”开关。
- 打开“中文”后，请求会携带 `language=zh`，只展示标题、提示词或预览内容包含中文字符的提示词。
- 中文筛选会与现有关键词、分类、标签和滚动分页一起生效。

### Testing
- `cd web && bun run build`：通过，Next.js 生产构建成功。
- 重启 30026 端口服务后，注册临时账号验证 `/api/prompts?pageSize=20&language=zh`：返回 20 条，其中 20 条均包含中文；临时账号已清理。
- `/api/auth/session` 返回 200，确认当前服务运行在 `http://127.0.0.1:30026`。

### Notes
- Changed files:
  - `web/src/components/prompts/use-prompt-list.ts`：提示词列表查询支持中文过滤参数，并加入查询缓存 key。
  - `web/src/app/(user)/prompts/page.tsx`：筛选区新增“中文”开关并传入列表查询。
  - `docs/content/docs/progress/pending-test.mdx`：记录本轮提示词库中文筛选待人工确认事项。
  - `progress.md`：追加本轮实现和验证记录。
- Existing pre-task changes left untouched: 首页随机展示、复制/导入画布、Base URL、模型列表和图片生成代理相关既有未提交改动未回滚。
- Rollback: 可执行 `git checkout -- web/src/components/prompts/use-prompt-list.ts web/src/app/(user)/prompts/page.tsx docs/content/docs/progress/pending-test.mdx progress.md` 回退本轮提示词库中文筛选；如需保留历史进度记录，请只回退代码和待测文件。

## 2026-07-01 - Task: 优化灵机一动控制条选中态
### What was done
- 将首页“灵机一动”的“全部/中文”选中态由纯黑底改为浅暖色选中态，降低视觉重量并提升文字可读性。

### Testing
- `cd web && bun run build`：通过，Next.js 生产构建成功。
- 重启 30026 端口服务后，`/api/auth/session` 返回 200，确认当前服务运行在 `http://127.0.0.1:30026`。

### Notes
- Changed files:
  - `web/src/app/(user)/page.tsx`：调整“灵机一动”范围切换按钮选中态样式。
  - `docs/content/docs/progress/pending-test.mdx`：记录本轮首页控制条视觉优化待人工确认事项。
  - `progress.md`：追加本轮实现和验证记录。
- Existing pre-task changes left untouched: 首页随机展示、中文筛选、复制/导入画布、Base URL、模型列表和图片生成代理相关既有未提交改动未回滚。
- Rollback: 可执行 `git checkout -- web/src/app/(user)/page.tsx docs/content/docs/progress/pending-test.mdx progress.md` 回退本轮首页控制条选中态优化；如需保留历史进度记录，请只回退代码和待测文件。
## 2026-07-01 - Task: ???????????
### What was done
- ?????????????/??/???????????????????????????????

### Testing
- `cd web && bun run build`????Next.js ???????

### Notes
- Changed files:
  - `web/src/app/(user)/page.tsx`??????????????????
  - `docs/content/docs/progress/pending-test.mdx`??????????????????????
  - `progress.md`?????????????
- Existing pre-task changes left untouched: ??????????????/?????Base URL?????????????????????????
- Rollback: ??? `git checkout -- web/src/app/(user)/page.tsx docs/content/docs/progress/pending-test.mdx progress.md` ?????????????????????????????????????
## 2026-07-01 - Task: ????????????
### What was done
- ?????????????/??/????????????????????????????????????????

### Testing
- `cd web && bun run build`????Next.js ???????

### Notes
- Changed files:
  - `web/src/app/(user)/page.tsx`??????????????????????????
  - `docs/content/docs/progress/pending-test.mdx`??????????????????????
  - `progress.md`?????????????
- Existing pre-task changes left untouched: ??????????????/?????Base URL?????????????????????????
- Rollback: ??? `git checkout -- web/src/app/(user)/page.tsx docs/content/docs/progress/pending-test.mdx progress.md` ?????????????????????????????????????
## 2026-07-01 - Task: ?????????????
### What was done
- ?????? `data/prompts-cache.json` ???????????????????????????????????????????????
- ????????????????????????????????? id ?????????????????????????
- ????????????????????????????????????????????
- ?? `/api/prompts/cache` ????????????`/api/prompts?refresh=1` ???????
- ?????? `config/app.yaml`????????????????? URL ????????????????

### Testing
- `cd web && bun scripts/test-prompt-cache.mjs`????????????/???????????????????????????????
- `cd web && bun run build`????Next.js ????????? `/api/prompts/cache` ??????
- ?? 30026 ???????????????????`/api/prompts?pageSize=5&refresh=1` ?? `totalAll=15302`???????? `added=0`?`updated=0`?`deleted=0`?`unchanged=15302`?
- ????? `/api/prompts/cache`???????? `total=15302`??? `/api/prompts?pageSize=5` ?? `cache.source=memory`?
- ???????????`keyword=poster` ?? `total=767`?`language=zh` ?? 10/10 ??????`coverOnly=1` ?? 10/10 ??????
- ????? 3 ? `cachetest*` ?????? `data/auth-users.json` ???

### Notes
- Changed files:
  - `config/app.yaml`???????????????? TTL ???
  - `web/src/lib/prompts/prompt-cache.ts`???????????????????????????????
  - `web/src/app/api/prompts/route.ts`???????????????????????????
  - `web/src/app/api/prompts/cache/route.ts`?????????????????
  - `web/src/services/api/prompts.ts`????????????????????
  - `web/scripts/test-prompt-cache.mjs`????????????????
  - `docs/content/docs/overview/quick-start.mdx`?????????????????
  - `docs/content/docs/overview/features.mdx`????????????????
  - `docs/content/docs/backend/local-development.mdx`?????????????????
  - `docs/content/docs/overview/docker.mdx`?????????????????????
  - `docs/content/docs/overview/render.mdx`????????????????????
  - `docs/content/docs/overview/third-party-prompt-repositories.mdx`????????????????
  - `docs/content/docs/progress/pending-test.mdx`??????????????????
  - `progress.md`?????????????
- Existing pre-task changes left untouched: ??????????????/?????Base URL??????????????????????
- Rollback: ??? `git checkout -- config/app.yaml web/src/app/api/prompts/route.ts web/src/services/api/prompts.ts docs/content/docs/overview/quick-start.mdx docs/content/docs/overview/features.mdx docs/content/docs/backend/local-development.mdx docs/content/docs/overview/docker.mdx docs/content/docs/overview/render.mdx docs/content/docs/overview/third-party-prompt-repositories.mdx docs/content/docs/progress/pending-test.mdx progress.md`???? `web/src/lib/prompts/`?`web/src/app/api/prompts/cache/`?`web/scripts/test-prompt-cache.mjs` ? `data/prompts-cache.json` ????????????????????????????????
