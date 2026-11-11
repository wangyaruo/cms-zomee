# 原站内容迁移

本阶段把 `zomee-index` 的真实本地数据迁入独立 CMS，不改变原站页面和线上内容。

## 导出

在原站仓库执行：

```bash
npm run cms:export -- /绝对路径/cms-zomee/import/original-content.json
```

导出内容：

- 60 个分类：7 个大类、43 个子类及仍有产品引用的兼容分类
- 226 个产品
- 51 篇文章及其编辑模块
- 157 条去重后的公共与产品 FAQ
- 原始 PDP 字段、编辑状态、发布状态和中英文字段

`import/` 是本地迁移工作目录，不提交 Git。

## 导入

先在 CMS `.env` 配置：

```dotenv
ORIGINAL_CONTENT_FILE=import/original-content.json
ORIGINAL_PUBLIC_DIR=../public
```

执行：

```bash
npm run import:original
npm run verify:import
```

默认按 slug、FAQ stableKey 和媒体 sourcePath 去重，已存在记录会跳过，不覆盖运营修改。只有明确需要重新以源站覆盖时才执行：

```bash
npm run import:original -- --overwrite
```

## 发布边界

- 产品保留原站可访问状态；demo、placeholder 和 pending 数据设置 `noindex`。
- 博客初稿和预览保持原站公开可见、`noindex` 的边界；公开状态与搜索收录分别控制。
- 没有答案或仍为草稿的 FAQ 不会发布。
- 历史无包装分类的硬件记录保留为空分类。
- 原站刻意保留的重复 SKU 不会被强行合并或重编。
- 复杂 PDP 未映射字段保存在后台隐藏的 `sourceData`，供前台适配器使用，运营无需编辑 JSON。

## 验证

`verify:import` 检查每个源记录只出现一次、产品图片与分类关系、复杂产品原始字段、中文产品名、文章发布边界和媒体路径唯一性。

单元测试另外覆盖富文本段落、FAQ 列表与链接、中文编辑正文转换。
