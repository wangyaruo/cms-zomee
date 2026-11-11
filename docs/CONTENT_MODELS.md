# 扩展内容模型与迁移

## 已迁移

| 集合 | 数量 | 主要字段 |
| --- | ---: | --- |
| Applications | 7 | 标题、slug、简介、主图、产品、FAQ、SEO、完整原始结构 |
| Solutions | 6 | 标题、slug、简介、主图、产品、应用、SEO、完整原始结构 |
| Resources | 6 | 标题、slug、类型、简介、主图、SEO、完整原始结构 |
| Navigation Menus | 2 | 菜单项、子项、中英文标签、链接、排序 |
| Legal Pages | 2 | 标题、slug、修订日期、简介、SEO、完整法律章节 |
| Site Pages | 7 | Home、About、Quality、Company、How We Work、Project Process、Contact；Sections 按稳定 sourcePath 编辑标题、正文、列表、媒体和链接 |
| Documents | 8 + 上传 | 中英文 Checklist PDF；AI／EPS／PDF／ZIP 刀模、预览、尺寸、版本、用途和发布确认 |
| Private Documents | 管理员上传 | 私有项目文件；仅管理员可读取，不进入公开快照 |

Resources 当前包括 Artwork、Materials、Checklists、Compliance、Dielines、Packaging Finder。

## 完整结构保留

Applications、Solutions、Resources、Legal Pages 的 `sourceData` 保留原站完整数据，包括段落、列表、推荐理由、表单定义、法律条款等。后台提供常用字段编辑，快照保留完整结构供原站渲染。

产品和文章快照继续移除 `sourceData`，因为原站已有这些记录作为回退，避免重复传输。其他结构化页面保留该字段。

## 复杂 PDP 编辑

Products 的 PDP Content 页提供 Hero、图库说明、徽章、保障项、亮点、选项图片、定制项、结构说明卡、合规模块、底部 CTA 和 Documents 关联。

双语数组必须通过 `locale=all` 一次写入 `{en, zh}`。不能先写英文数组再写中文数组，否则 Payload 会替换数组并丢失另一种语言。`import:original` 已采用原子双语更新。

## Site Settings

公司名、邮箱、电话、WhatsApp、Logo、微信二维码、询价接口、社交链接、默认分享图、canonical 预留地址和默认 SEO。Logo 与二维码已作为实际媒体关系迁移；正式域名未确认前 `canonicalBaseUrl` 保持为空。

## 迁移

原站导出：

```bash
npx --yes --package=tsx --package=esbuild tsx scripts/export-cms-content.ts \
  cms-admin/import/original-content.json
```

CMS 导入和核对：

```bash
npm run import:original -- --overwrite
npm run verify:import
```

已有数据库结构只需内容迁移时，可设置 `PAYLOAD_DB_PUSH=false`，避免开发环境自动 push 重复改表。生产环境应使用正式迁移流程，不能依赖手工补列。
