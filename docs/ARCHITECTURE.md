# 架构与发布约定

## 服务边界

```text
运营人员 → ZOMEEX CMS（本仓库）
               ├─ SQLite / PostgreSQL：内容与版本
               ├─ Media / Object Storage：公开媒体
               └─ /api/snapshot：只读、已发布内容
                              ↓ 服务端 Token
                    原 React / Vite 网站构建
                              ↓
                       预渲染与真实预览
                              ↓ 人工确认
                         nginx 生产部署
```

CMS 是内容唯一编辑来源，原站仓库负责页面组件、路由、SEO 和部署。两边不能双向覆盖。

## 权限

| 角色 | 保存草稿 | 发布 | 管理账号 | 修改站点设置 |
|---|---:|---:|---:|---:|
| Editor | 是 | 否 | 否 | 否 |
| Reviewer | 是 | 是 | 否 | 是 |
| Administrator | 是 | 是 | 是 | 是 |

## 快照安全

快照接口只接受 `Authorization: Bearer <SNAPSHOT_TOKEN>`。令牌只能存在原站构建服务或 CI 的服务端密钥中，不能写入 `NEXT_PUBLIC_*`、`VITE_*`、前端源码或日志。

## 上线前必须完成

1. 从原站导出并核对真实产品、分类、文章、FAQ 和媒体。
2. 将 Payload 富文本、关系、多语言字段映射为原站数据模型。
3. 构建预览并核对 PDP、CLP、SEO、询盘参数和全部语言。
4. 配置持久化数据库、媒体存储、HTTPS、备份和恢复。
5. 实现不可变发布版本和部署回滚，再进行生产切换。
