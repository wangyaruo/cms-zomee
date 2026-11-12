# ZOMEEX CMS

独立内容管理后台，用于管理现有 React / Vite 网站。前台网站、询盘接收服务和本 CMS 分别部署，不改动原网站的 Git remote。

## 已实现

- Payload 可视化后台：`/admin`
- 后台界面中文 / English 切换：登录页和侧栏可切换，偏好自动保存；与产品、文章的内容语言分别设置
- 管理员、审核员、编辑三种角色
- 登录失败锁定和 8 小时会话
- 产品、分类、博客、FAQ、媒体库、站点设置
- 英文 + 中文及其他 15 种语言字段
- 草稿、自动保存、历史版本和发布权限
- 产品规格、选项、图库、FAQ 和关联产品
- 富文本、图片 alt、SEO title / description / robots
- 仅导出已发布内容的服务端快照 API
- SQLite 本地持久化；数据库与上传文件不提交 Git

详细完成范围见 [`docs/IMPLEMENTATION_CHECKLIST.md`](docs/IMPLEMENTATION_CHECKLIST.md)。原站导出、幂等导入和发布边界见 [`docs/CONTENT_MIGRATION.md`](docs/CONTENT_MIGRATION.md)。不可变发布版本见 [`docs/RELEASES.md`](docs/RELEASES.md)。拖拽式可视化页面画布见 [`docs/CANVAS.md`](docs/CANVAS.md)。扩展内容模型见 [`docs/CONTENT_MODELS.md`](docs/CONTENT_MODELS.md)。

## 复制已有内容

打开产品、分类、博客文章、应用场景或解决方案的编辑页，在右上角「⋯」菜单选择「复制」。后台从最近一次保存的内容创建独立草稿，保留各语言文案、数组、图片和关联，并自动生成新网址标识。可以在副本中修改网址标识，再由审核员或管理员发布。

产品副本清空 SKU，并标为「资料待完善」。博客副本清空发布日期和修订日期，取消推荐。隐藏的迁移数据不会带到副本，避免继承原页面的身份或专属模板。

## 内容回收站

产品、分类、博客、FAQ、应用、解决方案、资源、导航、法律条款和固定页面支持回收站。审核员和管理员可从详情页菜单移入回收站，也可在集合列表打开「回收站」并恢复。恢复默认回到草稿，也可选择恢复为已发布。记录仍可恢复，历史版本沿用现有的数量限制，后台不提供永久删除这些内容的入口。

移入回收站后，内容从后台普通列表、正式快照和草稿预览快照移除。已经保存的发布版本仍保留创建时的数据。媒体、上传文件、账号和发布版本各自沿用原有权限。

已有 SQLite 数据库升级时，先停掉使用该数据库的 CMS 进程并备份，再传入现有数据库文件路径执行一次增量迁移，然后启动新版。新建数据库时由 Payload 初始化。

```bash
node scripts/migrate-content-trash.mjs /absolute/path/to/zomeex-cms.db
```

迁移只添加回收站所需的时间字段和索引，可重复执行。请先在备份副本上验证。关闭 Payload 自动更新表结构时，也使用这条命令完成升级。

## 移入前查看引用

审核员和管理员可在内容编辑页展开「移入回收站前的直接引用」，查看引用这条内容的记录、字段和状态，点击来源标题即可检查或修改关联。列表中勾选内容后也可检查，跨页全选会按当前搜索和筛选范围查询。

检查包含已发布记录和最新草稿中的内容关联、富文本链接、菜单及页面链接；同时选中准备移入的记录不计为外部引用。结果最多展示 50 条，引用总数按全部匹配记录计算。移入操作仍由原有确认框完成，引用提示不会自动修改或阻止关联。

此处显示直接引用，不包含间接影响、历史版本或已保存的发布快照。绝对网址按站点设置中的官网正式地址识别；域名未设置时，仍可检查以 `/` 开头的站内链接。界面检查失败时可重试。

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
