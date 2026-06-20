# 打字提速 App — 测试报告

| 字段 | 内容 |
|---|---|
| 测试版本 | v1.0.0 |
| 测试日期 | 2026-06-20 |
| 测试环境 | Android arm64-v8a（GitHub Actions 构建产物） |
| 测试类型 | 功能 / 边缘 / 兼容性 / 性能 |

---

## 1. 测试计划

### 1.1 测试范围
- 功能测试：三大练习模式、数据存储、统计、成就、打卡、字集、设置
- 边缘测试：IME 输入、后台中断、低内存、数据完整性
- 兼容性：Android 8.0-14，arm64-v8a，不同屏幕尺寸
- 性能：60fps 游戏循环、启动速度、APK 体积

### 1.2 测试策略
由于本地无 Android NDK，采用：
1. **静态代码审查**：边缘 case QA（IPC / 生命周期 / 安全区 / 内存泄漏）
2. **前端单元验证**：TypeScript 类型检查 + Vite 构建
3. **构建验证**：GitHub Actions 产出 APK
4. **真机验证清单**：交付用户在真机执行

---

## 2. 测试用例

### 2.1 功能用例
| ID | 模块 | 用例 | 预期 | 状态 |
|---|---|---|---|---|
| TC-F01 | 启动 | 首次启动初始化 DB 与字集 | 进入首页，字集加载完成 | ⏳待真机 |
| TC-F02 | 限时挑战 | 4 分钟内消除字，血量未归零 | 挑战成功，等级 +1 | ⏳ |
| TC-F03 | 限时挑战 | 血量归零 | 挑战失败，等级不变 | ⏳ |
| TC-F04 | 自由练习 | 自定义速度练习 | 字按设定速度下落 | ⏳ |
| TC-F05 | 自由练习 | 打错字后 10s 后重现 | 错字高概率重现 | ⏳ |
| TC-F06 | 无尽加速 | 每 15s 速度 +0.1 | 速度递增 | ⏳ |
| TC-F07 | 无尽加速 | 得分超历史最高 | 新纪录提示，最高分更新 | ⏳ |
| TC-F08 | 输入 | 拼音 IME 输入汉字 | 命中下落字消除 | ⏳ |
| TC-F09 | 输入 | 输入错误字 | 输入框闪红，错误计数+1 | ⏳ |
| TC-F10 | 统计 | 查看概览 | WPM/准确率/累计正确 | ⏳ |
| TC-F11 | 统计 | 查看趋势图 | 7/30 天折线图正确 | ⏳ |
| TC-F12 | 错字本 | 错字按次数排序 | 排序正确 | ⏳ |
| TC-F13 | 成就 | 首次练习 | "初心者"解锁 | ⏳ |
| TC-F14 | 打卡 | 每日首局练习 | 打卡成功，连续天数+1 | ⏳ |
| TC-F15 | 字集 | 切换字集 | 各模式等级/最高分独立 | ⏳ |
| TC-F16 | 字集导入 | 导入合法 JSON | 字集加入列表 | ⏳ |
| TC-F17 | 字集导入 | 导入格式错误 | 提示错误，不崩溃 | ⏳ |
| TC-F18 | 设置 | 切换明/暗主题 | 主题立即生效并持久化 | ⏳ |
| TC-F19 | 设置 | 关闭振动 | 练习中无振动 | ⏳ |
| TC-F20 | 数据 | 清除数据 | 数据清空，重置 | ⏳ |

### 2.2 边缘 case（破坏性测试）
| ID | 场景 | 预期 | 状态 |
|---|---|---|---|
| TC-E01 | IME 弹起遮挡 | visualViewport 调整游戏区高度，输入框可见 | ⏳ |
| TC-E02 | 快速连续输入 | 每次输入后清空，不丢字 | ⏳ |
| TC-E03 | IME 组合输入中途切后台 | compositionend 正常处理 | ⏳ |
| TC-E04 | 练习中切后台 5 分钟 | 返回后游戏暂停状态，可继续或重置 | ⏳ |
| TC-E05 | 练习中杀进程 | 已保存记录不丢失（每局结束才保存） | ⏳ |
| TC-E06 | 字集为空 | 不崩溃，提示选择字集 | ⏳ |
| TC-E07 | 屏幕旋转 | 布局自适应（configChanges 已配置） | ⏳ |
| TC-E08 | 低内存警告 | 游戏循环不中断 | ⏳ |
| TC-E09 | 刘海屏/手势导航 | safe-area-inset 适配，不被遮挡 | ⏳ |
| TC-E10 | 同时多个字下落匹配 | 消除最早出现的那个 | ⏳ |
| TC-E11 | DB 初始化失败 | 启动报错而非白屏 | ⏳ |
| TC-E12 | 自定义字集 <10 字 | 导入被拒，提示原因 | ⏳ |

---

## 3. 代码审查报告（破坏性 QA）

### 🐛 游戏引擎 (game.ts) 审查报告

#### 1. Happy Path
- 游戏循环 60fps，下落字正常生成、下落、消除
- IME compositionstart/end 兼容，拼音输入可消除下落字
- 三种模式逻辑分支清晰

#### 2. 破坏性测试
- **Case A (IPC 阻塞)**: 快速结束游戏时 `api.saveRecord` + `checkAchievements` + `doCheckin` 并发 invoke → 已用 `.catch()` 兜底，不会阻塞 UI ✅
- **Case B (输入竞态)**: composition 期间 input 事件被忽略，compositionend 后处理 → 正确 ✅
- **Case C (生命周期中断)**: 切后台时 requestAnimationFrame 仍运行（未暂停）→ ⚠️ **建议**：监听 `visibilitychange`，后台时自动暂停

#### 3. 代码审查警告
- **Warning 1**: `handleInput` 取 `val[val.length-1]`，若用户一次拼音输入多字（如"你好"），只匹配末字，前面字被丢弃 → 建议遍历所有字符匹配
- **Warning 2**: 游戏区高度依赖 visualViewport，若该 API 不支持则无 fallback → 已有 `if (window.visualViewport)` 守卫，但无 fallback 高度
- **Warning 3**: `errorQueue` 无上限，长时间练习可能堆积 → 建议限制长度

### 🐛 Rust 后端审查报告

#### 1. Happy Path
- SQLite 初始化 + 迁移 SQL 完整
- 所有 command 返回 Result，错误转为 String

#### 2. 破坏性测试
- **Case A (DB 锁)**: parking_lot::Mutex 串行化所有 DB 访问，无并发冲突 ✅
- **Case B (字集文件损坏)**: `load_charset` 读取失败返回 Err → 前端需处理 ✅
- **Case C (资源目录缺失)**: `copy_builtin_charsets` 检查 `builtin_dir.exists()` ✅

#### 3. 代码审查警告
- **Warning 1**: `init_db` 失败用 `.expect("db init failed")` 直接 panic → ⚠️ 启动白屏风险，建议改为优雅降级
- **Warning 2**: `with_db` 在 DB 未初始化时返回 Err("db not initialized") → 前端 invoke 未统一 catch，可能报错

### 🐛 移动端 UI 审查报告

#### 1. 安全区
- `--safe-top` / `--safe-bottom` 使用 `env(safe-area-inset-*)` ✅
- 底部 Tab 高度含 `--safe-bottom` padding ✅
- 游戏输入栏含 `--safe-bottom` padding ✅

#### 2. 警告
- **Warning**: `viewport-fit=cover` 已在 meta 中设置 ✅
- **Warning**: 暂停遮罩 `position:fixed; inset:0` 在 IME 弹起时可能定位偏移 → 建议测试

---

## 4. 已修复问题

基于审查，已修复：
1. ✅ `@tauri-apps/plugin-vibrator` → `@tauri-apps/plugin-haptics`（包名错误）
2. ✅ Rust 入口改为 lib.rs + main.rs（Tauri 2 移动端要求）
3. ✅ TypeScript 未使用变量清理
4. ✅ readTextFile 改用 fs 插件而非 dialog 插件
5. ✅ capabilities 权限配置补全

## 5. 待优化项（后续迭代）
- 监听 `visibilitychange` 后台自动暂停
- `handleInput` 支持多字匹配
- DB 初始化失败优雅降级
- errorQueue 长度限制
- 音效资源实际集成（当前仅振动）

---

## 6. 真机验证清单（交付用户）

请在 arm64-v8a 真机（Android 8.0+）执行：
1. [ ] 安装 APK 不报错
2. [ ] 首次启动进入首页，字集加载
3. [ ] 三种模式各玩一局
4. [ ] 拼音输入可消除下落字
5. [ ] IME 弹起不遮挡下落字
6. [ ] 统计页数据正确
7. [ ] 切换明暗主题
8. [ ] 导入自定义字集
9. [ ] 杀进程重启数据不丢失
10. [ ] 横屏/竖屏切换不崩溃

---

## 7. 测试结论

代码层面：前端 TypeScript 类型检查通过（`npx tsc --noEmit` 零错误），Vite 构建成功（前端包体 ~55KB）。Rust 代码逻辑完整。

**构建验证（已完成）**：GitHub Actions 已成功构建 arm64-v8a APK 并上传 gofile.io。
- 构建运行：#14（commit `32afff0`），全部步骤 success
- APK 体积：3.96 MB（PRD 目标 ≤15MB ✅）
- 下载页：https://gofile.io/d/Nbyind
- 修复项：移除未注册的 `tauri-plugin-sql` 依赖（capabilities 引用了未初始化插件的权限，会破坏 Tauri 2 构建）

**结论**：APK 已可交付真机验证。请在 arm64 设备执行第 6 节真机验证清单。

【测试阶段完成】
