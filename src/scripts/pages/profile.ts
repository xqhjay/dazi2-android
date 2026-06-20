import { api, type Achievement, type CheckinStatus } from "../api";
import { getState, setState } from "../store";

let achievements: Achievement[] = [];
let checkin: CheckinStatus | null = null;

export function renderProfile(): string {
  const s = getState();
  return `
    <div class="topbar"><h1>我的</h1></div>
    <div class="screen-scroll">
      ${checkin ? renderCheckinCard(checkin) : '<div class="empty">加载中...</div>'}

      <div class="section-title">成就</div>
      <div class="badge-grid" id="badge-grid">
        ${renderBadges()}
      </div>

      <div class="section-title">设置</div>
      <div class="setting-row" data-action="theme">
        <div>
          <div class="setting-row-label">主题</div>
          <div class="setting-row-desc">当前：${themeLabel(s.theme)}</div>
        </div>
        <div class="tiny" style="color:var(--accent)">切换 ›</div>
      </div>
      <div class="setting-row" data-action="toggle-sound">
        <div>
          <div class="setting-row-label">音效</div>
        </div>
        <div class="switch ${s.sound ? "on" : ""}"></div>
      </div>
      <div class="setting-row" data-action="toggle-vibrate">
        <div>
          <div class="setting-row-label">振动反馈</div>
        </div>
        <div class="switch ${s.vibrate ? "on" : ""}"></div>
      </div>

      <div class="section-title">数据</div>
      <button class="btn btn-danger btn-block" data-action="reset">清除所有数据</button>
      <div class="tiny muted center mt-8">v1.0.0 · 纯本地存储 · 无网络依赖</div>
    </div>
  `;
}

function themeLabel(t: string) {
  return t === "light" ? "明色" : t === "dark" ? "暗色" : "跟随系统";
}

function renderCheckinCard(c: CheckinStatus): string {
  return `
    <div class="streak-card">
      <div class="row" style="justify-content:space-between">
        <div>
          <div class="streak-num">${c.streak}</div>
          <div class="streak-label">连续打卡天数</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:20px;font-weight:700">${c.total}</div>
          <div class="streak-label">累计打卡</div>
        </div>
      </div>
      <div class="tiny" style="opacity:0.9;margin-top:12px">
        ${c.today ? "✅ 今日已打卡" : "🎯 完成一局练习即可打卡"}
      </div>
    </div>
  `;
}

function renderBadges(): string {
  const icons: Record<string, string> = {
    first_practice: "🌱",
    streak_7: "📅",
    streak_30: "🔥",
    clear_100: "💯",
    wpm_40: "⚡",
    accuracy_98: "🎯",
    total_1000: "🏆",
    endless_500: "🚀",
  };
  if (!achievements.length) return '<div class="empty">加载中...</div>';
  return achievements
    .map(
      (a) => `
      <div class="badge ${a.unlocked ? "unlocked" : ""}">
        <div class="badge-icon">${icons[a.code] || "🔒"}</div>
        <div class="badge-name">${a.title}</div>
        <div class="badge-desc">${a.description}</div>
      </div>
    `
    )
    .join("");
}

export async function bindProfileEvents() {
  try {
    [achievements, checkin] = await Promise.all([
      api.listAchievements(),
      api.getCheckinStatus(),
    ]);
    // 重新渲染打卡卡和徽章
    const s = getState();
    const scroll = document.querySelector(".screen-scroll");
    if (scroll) {
      scroll.innerHTML = `
        ${renderCheckinCard(checkin!)}
        <div class="section-title">成就</div>
        <div class="badge-grid">${renderBadges()}</div>
        <div class="section-title">设置</div>
        <div class="setting-row" data-action="theme">
          <div>
            <div class="setting-row-label">主题</div>
            <div class="setting-row-desc">当前：${themeLabel(s.theme)}</div>
          </div>
          <div class="tiny" style="color:var(--accent)">切换 ›</div>
        </div>
        <div class="setting-row" data-action="toggle-sound">
          <div><div class="setting-row-label">音效</div></div>
          <div class="switch ${s.sound ? "on" : ""}"></div>
        </div>
        <div class="setting-row" data-action="toggle-vibrate">
          <div><div class="setting-row-label">振动反馈</div></div>
          <div class="switch ${s.vibrate ? "on" : ""}"></div>
        </div>
        <div class="section-title">数据</div>
        <button class="btn btn-danger btn-block" data-action="reset">清除所有数据</button>
        <div class="tiny muted center mt-8">v1.0.0 · 纯本地存储 · 无网络依赖</div>
      `;
      bindProfileEvents();
    }
  } catch (e) {
    console.warn(e);
  }

  // 主题切换
  document.querySelector("[data-action='theme']")?.addEventListener("click", async () => {
    const s = getState();
    const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
    const idx = order.indexOf(s.theme);
    const next = order[(idx + 1) % order.length];
    await api.setSetting("theme", next);
    setState({ theme: next });
    const { applyTheme } = await import("../store");
    applyTheme();
  });

  // 音效
  document.querySelector("[data-action='toggle-sound']")?.addEventListener("click", async () => {
    const s = getState();
    await api.setSetting("sound", String(!s.sound));
    setState({ sound: !s.sound });
  });

  // 振动
  document.querySelector("[data-action='toggle-vibrate']")?.addEventListener("click", async () => {
    const s = getState();
    await api.setSetting("vibrate", String(!s.vibrate));
    setState({ vibrate: !s.vibrate });
  });

  // 清除数据
  document.querySelector("[data-action='reset']")?.addEventListener("click", () => {
    if (confirm("确定清除所有练习数据？此操作不可恢复。")) {
      // 通过设置一个标记，下次启动时清空（简化实现：直接重载）
      localStorage.clear();
      location.reload();
    }
  });
}
