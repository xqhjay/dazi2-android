import { api, type Overview, type TrendPoint, type ErrorChar } from "../api";
import { getState } from "../store";

let overview: Overview | null = null;
let trend: TrendPoint[] = [];
let errors: ErrorChar[] = [];
let trendDays = 7;

export function renderStats(): string {
  return `
    <div class="topbar"><h1>统计</h1></div>
    <div class="screen-scroll" id="stats-scroll">
      ${overview ? renderOverview(overview) : '<div class="empty">加载中...</div>'}

      <div class="section-title">趋势</div>
      <div class="row" style="margin:8px 4px">
        <button class="btn btn-secondary ${trendDays === 7 ? "" : "btn-block"}" style="padding:6px 12px;font-size:13px;flex:1" data-trend="7">7 天</button>
        <button class="btn btn-secondary ${trendDays === 30 ? "" : "btn-block"}" style="padding:6px 12px;font-size:13px;flex:1" data-trend="30">30 天</button>
      </div>
      <div class="chart" id="trend-chart">${renderTrendChart()}</div>

      <div class="section-title">错字本</div>
      <div id="error-list">${renderErrorList()}</div>
    </div>
  `;
}

function renderOverview(o: Overview): string {
  const fmtDur = (sec: number) => {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)} 分钟`;
    return `${(sec / 3600).toFixed(1)} 小时`;
  };
  return `
    <div class="stat-grid">
      <div class="stat-item">
        <div class="stat-value">${o.avg_wpm.toFixed(1)}</div>
        <div class="stat-label">平均 WPM</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${o.avg_accuracy.toFixed(1)}%</div>
        <div class="stat-label">平均准确率</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${o.total_cleared}</div>
        <div class="stat-label">累计消除字</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${fmtDur(o.total_duration_sec)}</div>
        <div class="stat-label">累计练习时长</div>
      </div>
    </div>
    <div class="card center">
      <div class="tiny muted">总练习次数</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px">${o.total_sessions}</div>
    </div>
  `;
}

function renderTrendChart(): string {
  if (!trend.length) return '<div class="empty">暂无数据</div>';
  const w = 300, h = 120, pad = 20;
  const maxWpm = Math.max(...trend.map((t) => t.wpm), 10);
  const stepX = (w - pad * 2) / Math.max(1, trend.length - 1);
  const points = trend.map((t, i) => {
    const x = pad + i * stepX;
    const y = h - pad - (t.wpm / maxWpm) * (h - pad * 2);
    return `${x},${y}`;
  });
  const accent = getState().theme === "dark" ? "#60a5fa" : "#3b82f6";
  return `
    <svg viewBox="0 0 ${w} ${h}">
      <polyline points="${points.join(" ")}" fill="none" stroke="${accent}" stroke-width="2" />
      ${points
        .map((p) => {
          const [x, y] = p.split(",");
          return `<circle cx="${x}" cy="${y}" r="3" fill="${accent}" />`;
        })
        .join("")}
    </svg>
  `;
}

function renderErrorList(): string {
  if (!errors.length) return '<div class="empty">暂无错字记录</div>';
  return errors
    .slice(0, 50)
    .map(
      (e) => `
      <div class="list-item">
        <div class="row">
          <span style="font-size:24px;font-weight:600;margin-right:12px">${e.char}</span>
          <div>
            <div class="tiny">错 ${e.error_count} 次 · 对 ${e.correct_count} 次</div>
            ${
              e.last_practiced_at
                ? `<div class="tiny muted">${e.last_practiced_at.slice(0, 10)}</div>`
                : ""
            }
          </div>
        </div>
      </div>
    `
    )
    .join("");
}

export async function bindStatsEvents() {
  await loadData();
  // 趋势切换
  document.querySelectorAll<HTMLElement>("[data-trend]").forEach((el) => {
    el.addEventListener("click", async () => {
      trendDays = parseInt(el.dataset.trend!, 10);
      trend = await api.getTrend(trendDays);
      const chart = document.getElementById("trend-chart");
      if (chart) chart.innerHTML = renderTrendChart();
    });
  });
}

async function loadData() {
  try {
    [overview, trend, errors] = await Promise.all([
      api.getOverview(),
      api.getTrend(trendDays),
      api.getErrorChars(100),
    ]);
    const scroll = document.getElementById("stats-scroll");
    if (scroll) {
      scroll.innerHTML = `
        ${renderOverview(overview)}
        <div class="section-title">趋势</div>
        <div class="row" style="margin:8px 4px">
          <button class="btn btn-secondary" style="padding:6px 12px;font-size:13px;flex:1" data-trend="7">7 天</button>
          <button class="btn btn-secondary" style="padding:6px 12px;font-size:13px;flex:1" data-trend="30">30 天</button>
        </div>
        <div class="chart" id="trend-chart">${renderTrendChart()}</div>
        <div class="section-title">错字本</div>
        <div id="error-list">${renderErrorList()}</div>
      `;
      bindStatsEvents();
    }
  } catch (e) {
    console.warn(e);
  }
}
