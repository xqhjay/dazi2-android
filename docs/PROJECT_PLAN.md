# 打字提速 App — 项目计划文档

| 字段 | 内容 |
|---|---|
| 项目名称 | 打字提速 |
| 项目类型 | Android 移动 App（Tauri 2） |
| ABI | arm64-v8a only |
| 文档版本 | v1.0 |
| 创建日期 | 2026-06-20 |

---

## 1. 技术架构

### 1.1 技术栈选型
| 层 | 技术 | 说明 |
|---|---|---|
| 桌面/移动壳 | Tauri 2 | 跨平台，Rust 后端 |
| 后端逻辑 | Rust | 数据存储、字集管理、成就判定 |
| 前端 | Vite + TypeScript（原生） | 轻量无框架，契合极简风，包体小 |
| 数据存储 | tauri-plugin-sql (SQLite) | 结构化本地存储 |
| 文件系统 | tauri-plugin-fs | 自定义字集读写 |
| 振动 | tauri-plugin-vibrator | 触觉反馈 |
| 构建 | Cargo + Gradle (Android) | arm64-v8a 限定 |

### 1.2 架构图
```
┌─────────────────────────────────────────┐
│  前端 (WebView, Vite + TS)              │
│  ├─ 练习页 (游戏循环 / 下落字 / 输入)   │
│  ├─ 统计页 (图表 / 错字本)              │
│  ├─ 字集页 (列表 / 导入)                │
│  └─ 我的页 (成就 / 打卡 / 设置)         │
└──────────────┬──────────────────────────┘
               │ Tauri IPC (invoke)
┌──────────────┴──────────────────────────┐
│  Rust 后端                               │
│  ├─ commands/  (IPC 命令层)              │
│  │   ├─ practice.rs  (记录读写)          │
│  │   ├─ charset.rs   (字集管理)          │
│  │   │   ├─ stats.rs      (统计聚合)     │
│  │   │   ├─ achievement.rs(成就判定)     │
│  │   │   └─ checkin.rs    (打卡)         │
│  ├─ db.rs        (SQLite 初始化/迁移)    │
│  └─ models.rs    (数据模型)              │
└──────────────┬──────────────────────────┘
               │
┌──────────────┴──────────────────────────┐
│  本地资源                                │
│  ├─ SQLite DB (app data)                 │
│  ├─ 内置字集 (resources/)                │
│  └─ 自定义字集 (app data/charsets/)      │
└─────────────────────────────────────────┘
```

### 1.3 Tauri 2 插件依赖清单
| 插件 | 用途 | Cargo crate |
|---|---|---|
| tauri-plugin-sql | SQLite 存储 | tauri-plugin-sql |
| tauri-plugin-fs | 字集文件读写 | tauri-plugin-fs |
| tauri-plugin-vibrator | 振动反馈 | tauri-plugin-vibrator |
| tauri-plugin-dialog | 文件选择（导入字集） | tauri-plugin-dialog |
| tauri-plugin-store | 简单键值设置（备选） | tauri-plugin-store |

### 1.4 Android 构建配置要点
- `tauri.conf.json`：仅 arm64-v8a
- `Cargo.toml`：release 优化（lto, opt-level=z, strip）
- AndroidManifest：无网络权限（纯离线）
- minSdkVersion 26, targetSdkVersion 34

---

## 2. WBS 任务分解

### 2.1 M1 — 项目初始化与核心游戏机制
| 任务 ID | 任务 | 产出 |
|---|---|---|
| T1.1 | Tauri 2 项目初始化（Android, arm64-v8a） | 可构建空壳 |
| T1.2 | 前端工程搭建（Vite + TS + 路由 + 样式系统） | 基础脚手架 |
| T1.3 | Rust 后端骨架（db 初始化、commands 注册） | IPC 通路 |
| T1.4 | 内置字集资源打包 + 加载 | 3 套字集可用 |
| T1.5 | 下落字游戏引擎（游戏循环、下落、碰撞） | 可玩核心 |
| T1.6 | IME 拼音输入处理 + 消除逻辑 | 输入可用 |
| T1.7 | 三大模式逻辑（限时/自由/无尽） | 模式可切换 |
| T1.8 | 练习页移动端布局（IME 避让、安全区） | 移动端可用 |

### 2.2 M2 — 数据存储与统计
| 任务 ID | 任务 | 产出 |
|---|---|---|
| T2.1 | SQLite schema 建表 + 迁移 | DB 就绪 |
| T2.2 | 练习记录读写 commands | 数据持久化 |
| T2.3 | 单字掌握度记录 | 错字强化数据基础 |
| T2.4 | 统计聚合 commands（趋势、概览） | 统计 API |
| T2.5 | 统计页 UI（概览卡片 + 折线图） | 统计页可用 |
| T2.6 | 错字本 UI + 针对练习入口 | 错字本可用 |

### 2.3 M3 — 扩展功能
| 任务 ID | 任务 | 产出 |
|---|---|---|
| T3.1 | 成就系统（定义 + 判定 + 解锁记录） | 成就可用 |
| T3.2 | 每日打卡（连续天数计算） | 打卡可用 |
| T3.3 | 成就/打卡页 UI | 我的页完善 |
| T3.4 | 自定义字集导入（文件选择 + 校验 + 存储） | 导入可用 |
| T3.5 | 字集管理页 UI | 字集页完善 |
| T3.6 | 设置项（主题/音效/振动）+ 持久化 | 设置可用 |
| T3.7 | 音效资源 + 播放逻辑 | 音效可用 |
| T3.8 | 振动反馈集成 | 触感可用 |

### 2.4 M4 — 打磨、测试与构建
| 任务 ID | 任务 | 产出 |
|---|---|---|
| T4.1 | 移动端交互打磨（动效、间距、字号） | 体验达标 |
| T4.2 | 边缘 case 处理（后台/中断/低内存） | 稳定性 |
| T4.3 | 测试用例编写与执行 | 测试报告 |
| T4.4 | APK 构建（本地 → GitHub Actions） | 可安装 APK |
| T4.5 | 上传 gofile.io | 下载链接 |

---

## 3. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|---|---|---|---|
| Tauri 2 Android 构建环境复杂 | 高 | 高 | 优先用 GitHub Actions（预置环境），本地失败不阻塞 |
| IME 弹起遮挡游戏区 | 中 | 高 | visualViewport API 动态调整，多机型测试 |
| 拼音输入匹配下落字延迟 | 中 | 中 | compositionend 即时匹配，输入框自动清空 |
| SQLite 插件 Android 兼容 | 低 | 高 | 用官方插件，提前验证 |
| APK 体积超标 | 低 | 低 | release 优化 + strip，无重依赖 |

---

## 4. 交付清单
- [x] PRD 文档（docs/PRD.md）
- [x] 项目计划文档（docs/PROJECT_PLAN.md）
- [x] 源代码（src-tauri/ + src/）
- [x] 测试文档（docs/TEST_REPORT.md）
- [x] 可安装 APK（GitHub Actions 构建，arm64-v8a，3.96 MB）
- [x] gofile.io 下载链接：https://gofile.io/d/Nbyind

【项目交付完成】
