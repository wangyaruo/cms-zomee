# 可视化页面画布

访问 `http://localhost:3100/canvas`，或从 CMS 仪表盘进入。

## 已实现

- 创建独立页面并设置标题和 slug。
- 从组件面板拖入区块、调整顺序、编辑属性。
- 自动保存草稿；保存状态会在顶部显示。
- 发布按钮需要审核员或管理员权限。
- Puck 自带桌面和手机宽度预览，也可打开独立预览路由。
- 页面使用独立 `pages` 集合保存布局，支持草稿和历史版本。

## 首批区块

Hero、Rich Text、Product Cards、Feature Grid、Media、FAQ、CTA、Spacer。

## 路由

- `/canvas`：页面列表和新建入口
- `/canvas/<id>`：可视化编辑器
- `/preview/<slug>`：真实渲染预览；未发布页面要求 CMS 登录

## 验证

```bash
npm run test:canvas
```

测试会创建包含 Hero、Feature Grid 和 FAQ 的真实页面，发布后检查预览 HTML，最后删除测试记录。

当前画布用于独立页面编排，尚不能把原站所有 React 组件直接拖入，也不会自动把新页面部署到原站。
