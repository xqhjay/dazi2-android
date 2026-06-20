import { GameEngine, type GameMode, type GameStats } from "../game";
import { getState } from "../store";
import { navigate } from "../router";

let engine: GameEngine | null = null;

export function renderGame(mode: GameMode): string {
  const s = getState();
  const charset = s.currentCharset;
  if (!charset) {
    return `<div class="result-screen"><div class="empty">请先选择字集</div><button class="btn btn-primary" onclick="location.reload()">重新加载</button></div>`;
  }

  const showHp = mode !== "free";

  return `
    <div class="game-screen">
      <div class="game-header">
        <button class="icon-btn" data-action="back" title="返回">‹</button>
        <div class="game-stat">
          <div class="game-stat-val" id="g-cleared">0</div>
          <div class="game-stat-lbl">消除</div>
        </div>
        ${
          showHp
            ? `
          <div class="row" style="flex:1;max-width:140px">
            <div class="hp-bar"><div class="hp-fill" id="g-hp" style="width:100%"></div></div>
          </div>
        `
            : ""
        }
        ${
          mode === "timed"
            ? `
          <div class="game-stat">
            <div class="game-stat-val" id="g-time">4:00</div>
            <div class="game-stat-lbl">剩余</div>
          </div>
        `
            : mode === "endless"
            ? `
          <div class="game-stat">
            <div class="game-stat-val" id="g-score">0</div>
            <div class="game-stat-lbl">得分</div>
          </div>
        `
            : ""
        }
        <button class="icon-btn" data-action="pause" title="暂停">⏸</button>
      </div>
      <div class="game-area" id="game-area"></div>
      <div class="game-input-bar">
        <input
          type="text"
          class="game-input"
          id="game-input"
          placeholder="拼音输入汉字..."
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          enterkeyhint="done"
        />
      </div>
    </div>
    <div class="hidden" id="pause-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:100">
      <div class="card" style="width:80%;max-width:300px;text-align:center">
        <div style="font-size:18px;font-weight:700;margin-bottom:16px">已暂停</div>
        <button class="btn btn-primary btn-block" data-action="resume">继续</button>
        <button class="btn btn-secondary btn-block mt-8" data-action="back">退出</button>
      </div>
    </div>
  `;
}

export async function bindGameEvents(mode: GameMode) {
  const s = getState();
  const charset = s.currentCharset;
  if (!charset) return;

  const area = document.getElementById("game-area") as HTMLElement;
  const input = document.getElementById("game-input") as HTMLInputElement;

  if (!area || !input) return;

  // 自由模式可选自定义速度（简化：用当前等级速度或默认1.0）
  const customSpeed = mode === "free" ? 1.0 : undefined;

  engine = new GameEngine(
    {
      mode,
      charsetId: charset.id,
      words: charset.words,
      customSpeed,
    },
    area,
    input,
    (stats) => updateUI(mode, stats),
    (stats) => showResult(mode, stats)
  );

  // 返回
  document.querySelector("[data-action='back']")?.addEventListener("click", () => {
    if (confirm("确定退出本局练习？")) {
      engine?.destroy();
      navigate({ name: "home" });
    }
  });

  // 暂停
  document.querySelector("[data-action='pause']")?.addEventListener("click", () => {
    engine?.pause();
    document.getElementById("pause-overlay")?.classList.remove("hidden");
  });

  // 继续
  document.querySelector("[data-action='resume']")?.addEventListener("click", () => {
    engine?.resume();
    document.getElementById("pause-overlay")?.classList.add("hidden");
    input.focus();
  });

  // 启动
  engine.start();

  // IME 避让：监听 visualViewport，动态调整游戏区高度
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const onResize = () => {
      const headerH = 56;
      const inputH = 64;
      const available = vv.height - headerH - inputH;
      area.style.height = `${Math.max(200, available)}px`;
    };
    vv.addEventListener("resize", onResize);
    onResize();
  }
}

function updateUI(mode: GameMode, stats: any) {
  const cleared = document.getElementById("g-cleared");
  if (cleared) cleared.textContent = String(stats.cleared || 0);

  if (stats.hp !== undefined) {
    const hp = document.getElementById("g-hp") as HTMLElement;
    if (hp) {
      hp.style.width = `${stats.hp}%`;
      hp.style.background =
        stats.hp > 50 ? "var(--success)" : stats.hp > 25 ? "var(--warning)" : "var(--danger)";
    }
  }

  if (mode === "timed" && stats.timeLeft !== undefined) {
    const t = document.getElementById("g-time");
    if (t) {
      const m = Math.floor(stats.timeLeft / 60);
      const sec = Math.floor(stats.timeLeft % 60);
      t.textContent = `${m}:${sec.toString().padStart(2, "0")}`;
    }
  }

  if (mode === "endless") {
    const sc = document.getElementById("g-score");
    if (sc) sc.textContent = String(stats.cleared || 0);
  }
}

function showResult(mode: GameMode, stats: GameStats) {
  const app = document.getElementById("app")!;
  const modeLabel = mode === "timed" ? "限时挑战" : mode === "free" ? "自由练习" : "无尽加速";
  const passLabel =
    mode === "free"
      ? "练习完成"
      : stats.isPassed
      ? mode === "timed"
        ? "挑战成功 · 等级提升"
        : "游戏结束"
      : "挑战失败";

  const newHigh =
    mode === "endless" && stats.score > (getState().highScores[`endless_${getState().currentCharset?.id}`] || 0);

  app.innerHTML = `
    <div class="screen">
      <div class="result-screen">
        <div style="font-size:48px">${stats.isPassed || mode === "free" ? "🎉" : "💔"}</div>
        <div class="result-title">${passLabel}</div>
        ${newHigh ? '<div class="tiny" style="color:var(--accent);font-weight:600">🏆 新纪录！</div>' : ""}
        <div class="result-stats">
          <div class="stat-item">
            <div class="stat-value">${stats.wpm}</div>
            <div class="stat-label">WPM</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.accuracy}%</div>
            <div class="stat-label">准确率</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.cleared}</div>
            <div class="stat-label">消除字</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.errors + stats.missed}</div>
            <div class="stat-label">错误/漏字</div>
          </div>
        </div>
        <div class="tiny muted">练习时长 ${formatDuration(stats.durationSec)} · ${modeLabel}</div>
        <div class="row mt-16" style="width:100%;max-width:300px">
          <button class="btn btn-secondary" style="flex:1" data-action="home">返回</button>
          <button class="btn btn-primary" style="flex:1" data-action="retry">再来一局</button>
        </div>
      </div>
    </div>
  `;

  document.querySelector("[data-action='home']")?.addEventListener("click", () => {
    navigate({ name: "home" });
  });
  document.querySelector("[data-action='retry']")?.addEventListener("click", () => {
    navigate({ name: "game", mode });
  });
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec} 秒`;
  return `${Math.floor(sec / 60)} 分 ${sec % 60} 秒`;
}
