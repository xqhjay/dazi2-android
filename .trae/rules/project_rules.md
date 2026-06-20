# 打字提速 - 项目规则

## 技术栈
- Tauri 2 + Rust 后端 + Vite + TypeScript 前端
- 目标平台：Android，ABI 限定 arm64-v8a
- 存储：tauri-plugin-sql (SQLite) + tauri-plugin-fs

## 开发命令
- 前端开发：`npm run dev`
- 前端构建：`npm run build`
- Tauri 开发（桌面）：`cargo tauri dev`
- Android 构建：`cargo tauri android build --apk --target aarch64`
- 类型检查：`npx tsc --noEmit`

## 架构
- 前端：src/scripts/ (api.ts, store.ts, game.ts, router.ts, pages/)
- 后端：src-tauri/src/ (main.rs, db.rs, models.rs, commands/)
- 字集数据：src-tauri/resources/charsets/*.json
- 文档：docs/ (PRD.md, PROJECT_PLAN.md, TEST_REPORT.md)

## 重要约束
- ABI 仅 arm64-v8a（在 src-tauri/.tauri/tauri.conf.json 和 GitHub Actions 中限定）
- 纯本地存储，无网络依赖，AndroidManifest 无 INTERNET 权限
- 移动端输入用系统软键盘拼音 IME，需处理 composition 事件
- IME 弹起时用 visualViewport API 避让游戏区
