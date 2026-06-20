import { getState, getLevel, getHighScore } from "../store";
import { api, type CheckinStatus } from "../api";
import { navigate } from "../router";

export function renderHome(): string {
  const s = getState();
  const charsetTitle = s.currentCharset?.title || s.charsets[0]?.title || "未选择";
  const timedLevel = s.currentCharset ? getLevel("timed", s.currentCharset.id) : 1;
  const endlessHigh = s.currentCharset ? getHighScore(s.currentCharset.id) : 0;

  return `
    <div class="topbar">
      <h1>打字提速</h1>
      <button class="icon-btn" data-action="switch-charset" title="切换字集">
        <span style="font-size:13px">${charsetTitle.slice(0, 6)}</span>
      </button>
    </div>
    <div class="screen-scroll">
      <div id="home-checkin"></div>

      <div class="section-title">练习模式</div>
      <button class="mode-card" data-mode="timed">
        <div class="mode-icon timed">⏱</div>
        <div class="mode-info">
          <h3>限时挑战</h3>
          <p>4 分钟限时 · 当前 Lv.${timedLevel}</p>
        </div>
      </button>
      <button class="mode-card" data-mode="free">
        <div class="mode-icon free">📖</div>
        <div class="mode-info">
          <h3>自由练习</h3>
          <p>不限时 · 自定义速度 · 智能错字强化</p>
        </div>
      </button>
      <button class="mode-card" data-mode="endless">
        <div class="mode-icon endless">🔥</div>
        <div class="mode-info">
          <h3>无尽加速</h3>
          <p>速度递增 · 最高分 ${endlessHigh}</p>
        </div>
      </button>

      <div class="section-title">快速设置</div>
      <div class="setting-row" data-action="toggle-sound">
        <div>
          <div class="setting-row-label">音效</div>
          <div class="setting-row-desc">消除与错误提示音</div>
        </div>
        <div class="switch ${s.sound ? "on" : ""}"></div>
      </div>
      <div class="setting-row" data-action="toggle-vibrate">
        <div>
          <div class="setting-row-label">振动反馈</div>
          <div class="setting-row-desc">触觉反馈</div>
        </div>
        <div class="switch ${s.vibrate ? "on" : ""}"></div>
      </div>
    </div>
  `;
}

export async function bindHomeEvents() {
  // 加载打卡状态
  try {
    const status = await api.getCheckinStatus();
    const el = document.getElementById("home-checkin");
    if (el) {
      el.innerHTML = renderCheckin(status);
    }
  } catch (e) {
    console.warn(e);
  }

  // 模式选择
  document.querySelectorAll<HTMLElement>("[data-mode]").forEach((el) => {
    el.addEventListener("click", () => {
      const mode = el.dataset.mode as "timed" | "free" | "endless";
      navigate({ name: "game", mode });
    });
  });

  // 切换字集
  document.querySelector("[data-action='switch-charset']")?.addEventListener("click", () => {
    navigate({ name: "charsets" });
  });

  // 音效开关
  document.querySelector("[data-action='toggle-sound']")?.addEventListener("click", async () => {
    const s = getState();
    await api.setSetting("sound", String(!s.sound));
    const { setState } = await import("../store");
    setState({ sound: !s.sound });
  });

  // 振动开关
  document
    .querySelector("[data-action='toggle-vibrate']")
    ?.addEventListener("click", async () => {
      const s = getState();
      await api.setSetting("vibrate", String(!s.vibrate));
      const { setState } = await import("../store");
      setState({ vibrate: !s.vibrate });
    });
}

function renderCheckin(status: CheckinStatus): string {
  if (status.today) {
    return `
      <div class="card" style="display:flex;align-items:center;gap:12px">
        <div style="font-size:28px">✅</div>
        <div>
          <div style="font-weight:600">今日已打卡</div>
          <div class="tiny muted">连续 ${status.streak} 天 · 累计 ${status.total} 天</div>
        </div>
      </div>
    `;
  }
  return `
    <div class="card" style="display:flex;align-items:center;gap:12px;background:var(--accent-soft)">
      <div style="font-size:28px">🎯</div>
      <div>
        <div style="font-weight:600">今日尚未练习</div>
        <div class="tiny muted">完成一局练习即可打卡</div>
      </div>
    </div>
  `;
}
