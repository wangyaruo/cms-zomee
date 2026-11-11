# 不可变发布版本

## 创建版本

审核员或管理员通过服务端会话调用：

```bash
curl -X POST \
  -H "Authorization: JWT $CMS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"2026-11-11 内容基线","note":"本次发布说明"}' \
  http://localhost:3100/api/release-actions/create
```

版本只包含当前已发布内容，不允许用草稿预览创建。每次保存：

- 不可变快照
- 内容 SHA-256
- 各集合数量
- 创建人和创建时间

相同内容重复发布会返回已有版本，不生成重复记录。版本不能通过后台编辑或删除。

## 按版本读取

```bash
curl -H "Authorization: Bearer $SNAPSHOT_TOKEN" \
  http://localhost:3100/api/snapshot?release=RELEASE_ID
```

返回的 `version` 是发布记录 ID，后续内容编辑不会改变该版本。

## 原站按版本构建

```bash
CMS_SNAPSHOT_TOKEN=服务端令牌 \
CMS_RELEASE_ID=RELEASE_ID \
npm run build
```

`CMS_RELEASE_ID` 与草稿预览互斥。构建只生成本地产物，尚不代表已经部署。生产部署与一键回滚仍需要服务器发布脚本和部署权限。

## 验证

CMS 启动后执行：

```bash
npm run test:releases
```

验证基线版本创建、按 ID 读取、内容数量、无迁移备份字段，以及相同内容重复发布去重。
