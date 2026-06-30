<p align="center">
  <img src="web/public/logo.png" width="96" alt="BMCCA无限画布 logo">
</p>

<h1 align="center">BMCCA无限画布</h1>

BMCCA无限画布是一款面向图片创作的 AI 工作台。画布编排、AI 图片生成、参考图编辑、对话助手、提示词库和素材沉淀放在同一个界面里，适合用来探索视觉方案并连续迭代图片结果。

## 核心功能

- 无限画布：多画布项目、节点拖拽缩放、连线、小地图、撤销重做、导入导出。
- AI 创作：接入 OpenAI 兼容接口；模型拉取和图片生成/编辑通过 Next.js Route 转发。
- 画布助手：围绕选中节点和上游节点对话、生图，并把结果插回画布。
- 提示词库：抓取多个 GitHub 开源项目（含 songtianlun/awesome-prompts 等 7 个仓库），缓存在运行实例内存中，每小时自动刷新。
- 账号系统：网页自助注册、账号密码登录和个人账号配置修改。

## 技术栈

- 前端：Next.js 16、React、TypeScript、Tailwind CSS、Ant Design、Zustand、TanStack Query。
- 部署：Bun 本地运行或 Docker。

## 快速开始

### 方式一：Bun 本地运行（推荐）

```bash
git clone https://github.com/ccoinh-oss/infinite-canvas.git
cd infinite-canvas
cd web
bun install
bun run build
bun run start
```

运行后访问 `http://localhost:30026`。

### 方式二：Docker

```bash
# 本地构建运行
docker compose -f docker-compose.local.yml up -d --build

# 或手动构建
docker build -t bmcca-canvas .
docker run --rm -p 30026:30026 bmcca-canvas
```

## 配置说明

- 应用配置集中在 `config/app.yaml`，不使用环境变量。
- 首次打开可自助注册账号；账号数据写入 `data/auth-users.json`。
- AI API Key 和 Base URL 在浏览器本地配置（右上角配置弹窗）。
- Base URL 已锁定为 `https://cca.maya.today/`，不可修改。

## 本次变更详情（相对上游 v0.4.0）

### 品牌定制

- 项目名称改为 **BMCCA无限画布**，更换全新 Logo 和网站图标。
- 移除首页右上角 GitHub 链接和文档入口图标。
- 顶栏图标和品牌文字统一放大。
- 渠道名称固定前缀 `BMCCA`，支持自定义后缀。

### 功能调整

- Base URL 锁定为 `https://cca.maya.today/`，用户不可修改。
- 渠道名称写死为 `BMCCA` + 自定义后缀，不再自动编号。
- 用户注册和账号配置中合并"用户名"和"显示名称"为单个字段。
- 首页提示词只展示有封面图的条目，避免 broken image。
- 默认端口从 3000 改为 30026，避免端口冲突。
- 默认渠道模型列表只保留 `gpt-image-2`，不再预置视频/文本/音频模型。

### 提示词库扩展

- 新增 `songtianlun/awesome-prompts` 数据源（138 条带图案例，涵盖 gpt-image-1 和 gpt-4o）。
- 新增 `ai-image-prompts-skill` 数据源，提示词总量扩展至 15000+ 条。
- 首页"查看提示词库"按钮下方实时显示当前提示词总量和更新时间。
- 当前共聚合 8 个 GitHub 开源提示词仓库。

### Bug 修复

- 修复 canvas 页面 `useSearchParams` 未用 Suspense 包裹导致构建失败。
- 移除旧 favicon.ico，解决浏览器标签栏图标不更新问题。
- 修复 youmind-nano-banana-pro 提示词封面图显示徽章而非效果图的问题。

## 文档

- [快速开始](docs/content/docs/overview/quick-start.mdx)
- [功能介绍](docs/content/docs/overview/features.mdx)
- [Docker 部署](docs/content/docs/overview/docker.mdx)
- [第三方提示词仓库](docs/content/docs/overview/third-party-prompt-repositories.mdx)

## 开源协议

本项目基于 GNU Affero General Public License v3.0，见 [LICENSE](LICENSE)。
