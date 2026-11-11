# ZOMEEX CMS

独立内容管理后台，用于管理现有 React / Vite 网站。前台网站、询盘接收服务和本 CMS 分别部署，不改动原网站的 Git remote。

## 已实现

- Payload 可视化后台：`/admin`
- 管理员、审核员、编辑三种角色
- 登录失败锁定和 8 小时会话
- 产品、分类、博客、FAQ、媒体库、站点设置
- 英文 + 中文及其他 15 种语言字段
- 草稿、自动保存、历史版本和发布权限
- 产品规格、选项、图库、FAQ 和关联产品
- 富文本、图片 alt、SEO title / description / robots
- 仅导出已发布内容的服务端快照 API
- SQLite 本地持久化；数据库与上传文件不提交 Git

详细完成范围见 [`docs/IMPLEMENTATION_CHECKLIST.md`](docs/IMPLEMENTATION_CHECKLIST.md)。

## 环境要求

- Node.js `^22.23.4` 或 `>=24.22.1`
- npm 10+

## 本地启动

```bash
npm ci
cp .env.example .env
```

编辑 `.env`，至少设置：

```dotenv
PAYLOAD_SECRET=一个至少32字节的随机值
DATABASE_URL=file:./data/zomeex-cms.db
NEXT_PUBLIC_SERVER_URL=http://localhost:3100
CMS_BOOTSTRAP_EMAIL=你的管理员邮箱
CMS_BOOTSTRAP_PASSWORD=至少12位的强密码
SNAPSHOT_TOKEN=独立的服务端随机令牌
```

生成随机值：

```bash
openssl rand -hex 32
```

创建首位管理员并启动：

```bash
npm run seed
npm run dev
```

打开 `http://localhost:3100/admin`。初始化脚本只在数据库没有用户时创建账号，重复执行不会修改已有密码。

## 验证

```bash
npm run typecheck
npm test
npm run build
# 启动服务后另开终端，验证登录、上传、权限和发布快照：
npm run test:smoke
```

## 内容快照

`GET /api/snapshot` 是服务端到服务端接口，不包含用户、密码或草稿。调用方必须提供：

```bash
curl -H "Authorization: Bearer $SNAPSHOT_TOKEN" http://localhost:3100/api/snapshot
```

不要把 `SNAPSHOT_TOKEN` 放进 `NEXT_PUBLIC_*`、`VITE_*` 或浏览器代码。现站读取快照、构建预览和生产部署尚未接入，完成前保存草稿不会自动改变线上网站。

## 数据与备份

- SQLite 数据：`data/`
- 上传媒体：`media/`
- 两者均已排除 Git，部署时必须持久化并一起备份。
- 生产环境建议改为 PostgreSQL 和对象存储；迁移前不要把开发数据库直接当生产备份。

## 项目边界

当前仓库只负责 CMS 和内容快照。现有网站的 CLP、PDP、17 语言预渲染、询盘邮箱接收仍由原网站仓库负责。后续通过“CMS 已发布快照 → 原站构建 → 预览 → 部署”单向集成，避免双向覆盖。
