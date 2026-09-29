# maou-website

maou 的个人主页。零依赖 Node 服务器 + 纯静态前端，实时拉取 Steam / itch / GitHub / B 站数据。

## 运行

需要 Node 20+。

```bash
npm start          # http://127.0.0.1:5180（被占用会自动顺延）
npm run snapshot   # 刷新 public/data/*.json 快照
```

Windows 可直接双击 `test-web.bat`。

可选环境变量：`GITHUB_TOKEN`（避免 GitHub API 限流）、`PORT`、`HOST`。

## 部署

- 有 Node：`/api/*` 实时数据。
- GitHub Pages：已配好 `.github/workflows/pages.yml`，每 6 小时自动拉取最新数据并发布，无需手动维护（仓库 Settings → Pages → Source 选 GitHub Actions）。

## 许可

代码 MIT；`public/assets/` 图片与页面文案版权归 maou 所有。
