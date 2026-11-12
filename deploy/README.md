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

```bash
systemctl status zomeex-cms
journalctl -u zomeex-cms -n 100 --no-pager
systemctl restart zomeex-cms
nginx -t
```

更新版本时先准备新的 release，复用 shared 数据目录并完成依赖安装与生产构建，
再切换 `current` 链接、重启服务并验证 `/admin/login`。更新程序时不要覆盖 shared 数据。
本次部署保留本地已有管理员账号，密码未写入部署模板。
