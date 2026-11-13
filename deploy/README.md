# 服务器部署

当前 CMS 地址：`http://106.74.26.75:8201/admin`。

- Nginx 监听 `8201`，反向代理至 `127.0.0.1:18201`。
- systemd 服务：`zomeex-cms`，使用独立的 `zomeex-cms` 系统用户运行，开机启动。
- 程序：`/opt/zomeex-cms/releases/<version>`，`current` 链接指向当前版本。
- 持久化数据：`/opt/zomeex-cms/shared/{data,media,documents,private-documents}`。
- 服务端配置：`/opt/zomeex-cms/shared/.env`，不提交 Git。
- Node.js 安装在 `/opt/node`。
- 初始备份：`/opt/zomeex-cms/backups/20261112-initial/state.tar.gz`，包含一致性数据库备份、上传文件与服务端配置，仅 root 可读。

IP + HTTP 部署设置 `NEXT_PUBLIC_SERVER_URL=http://106.74.26.75:8201` 和
`CMS_COOKIE_SECURE=false`。配置 HTTPS 后将 `CMS_COOKIE_SECURE` 改为 `true`，
并更新 `NEXT_PUBLIC_SERVER_URL`，重新构建后重启服务。

服务器设置 `CMS_BUILD_ROOT=/opt/zomeex-cms`，让构建器可以解析 release 与 shared
之间的上传目录链接。`npm run build` 会先生成后台组件 import map。

Nginx 在 GET / HEAD 缺少 Origin 时补充当前 CMS origin，以兼容 HTTP 浏览器缺少
Fetch Metadata 的情况。写请求保留原始 Origin，继续使用 Payload 的 CSRF 检查。
切换地址时同步更新 Nginx 模板中的 origin。

服务器使用 `PAYLOAD_DB_PUSH=false`，保留已迁移数据库结构。升级内容模型时先备份，
使用正式数据库迁移，不在生产环境自动推送结构变更。
在仍使用旧用户表结构的环境中，上线用户名登录前运行 `node scripts/migrate-usernames.mjs /opt/zomeex-cms/shared/data/zomeex-cms.db`，添加可选的用户名字段。原有账号仍支持邮箱登录。

```bash
systemctl status zomeex-cms
journalctl -u zomeex-cms -n 100 --no-pager
systemctl restart zomeex-cms
nginx -t
```

更新版本时先准备新的 release，复用 shared 数据目录并完成依赖安装与生产构建，
再切换 `current` 链接、重启服务并验证 `/admin/login`。更新程序时不要覆盖 shared 数据。
本次部署保留本地已有管理员账号，密码未写入部署模板。

## 2026-11-12 更新记录

- 已部署后台代码 `6410856` 到 `/opt/zomeex-cms/releases/20261112-6410856`，端口继续使用 `8201`；本次未发布官网。
- 新增 Applications、Solutions 的隐藏迁移字段默认值，后台可以直接新建记录；保留原管理员、数据库和上传文件，无数据库列迁移。
- 更新前备份：`/opt/zomeex-cms/backups/20261112-6410856`，数据库 `quick_check` 和上传压缩包完整性检查通过。上一版本 `/opt/zomeex-cms/releases/20261112-i18n` 保留作为回滚目标。
- 新版本构建、候选服务和公网登录页验证通过；快照记录数量一致，未授权快照返回 `401`；管理员登录后读取图片与 PDF 返回 `200`，中英文产品表单验证通过。

发布包可能已包含 `media` 占位目录及 `documents` 示例文件。建立持久化链接前先保留并移开这些 release 内目录，确认 `media`、`documents`、`private-documents` 自身是指向对应 `shared` 路径的符号链接，避免把链接误建到目录内部。切换前应同时检查登录页、授权快照以及已有图片与 PDF；不能只依赖 HTML 登录页健康检查。

当前 `Media` 与 `Documents` 仍沿用后台登录读取权限，匿名文件请求会被拒绝。以后部署公开官网时需要单独确认并实现公开媒体／已发布文件的访问规则；本次仅更新 CMS，未改变文件权限。

## 2026-11-13 用户名登录

线上切换到 `/opt/zomeex-cms/releases/20261113-6410856-username`，基于已部署的 `6410856` 启用用户名登录。原管理员账号保留邮箱与角色。上线前已备份 SQLite 数据库，并通过 `quick_check` 验证备份。切换后验证了 `8201` 的登录页、用户名和邮箱登录以及后台会话。
