// 简单路由 + 页面渲染
import { subscribe } from "./store";
import { renderHome } from "./pages/home";
import { renderStats } from "./pages/stats";
import { renderCharsets } from "./pages/charsets";
import { renderProfile } from "./pages/profile";
import { renderGame } from "./pages/game";

export type Route =
  | { name: "home" }
  | { name: "stats" }
  | { name: "charsets" }
  | { name: "profile" }
  | { name: "game"; mode: "timed" | "free" | "endless" };

let currentRoute: Route = { name: "home" };
const routeListeners = new Set<(r: Route) => void>();

export function getRoute(): Route {
  return currentRoute;
}

export function navigate(route: Route) {
  currentRoute = route;
  routeListeners.forEach((l) => l(route));
  render();
  // 滚动到顶
  const scroll = document.querySelector(".screen-scroll");
  if (scroll) scroll.scrollTop = 0;
}

export function onRouteChange(fn: (r: Route) => void) {
  routeListeners.add(fn);
  return () => routeListeners.delete(fn);
}

const app = document.getElementById("app")!;

export function render() {
  const route = currentRoute;
  let content: string;
  let showTabbar = true;

  switch (route.name) {
    case "home":
      content = renderHome();
      break;
    case "stats":
      content = renderStats();
      break;
    case "charsets":
      content = renderCharsets();
      break;
    case "profile":
      content = renderProfile();
      break;
    case "game":
      content = renderGame(route.mode);
      showTabbar = false;
      break;
  }

  app.innerHTML = `
    <div class="screen">
      ${content}
    </div>
    ${showTabbar ? renderTabbar(route.name) : ""}
  `;

  // 绑定事件
  bindPageEvents(route);
}

function renderTabbar(active: string): string {
  const tabs = [
    { id: "home", label: "练习", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
    { id: "stats", label: "统计", icon: "M4 19V5M4 19h16M8 17v-5M12 17V8M16 17v-3" },
    { id: "charsets", label: "字集", icon: "M4 6h16M4 12h16M4 18h10" },
    { id: "profile", label: "我的", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-4 4-6 8-6s8 2 8 6" },
  ];
  return `
    <nav class="tabbar">
      ${tabs
        .map(
          (t) => `
        <button class="tab ${active === t.id ? "active" : ""}" data-route="${t.id}">
          <span class="tab-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="${t.icon}" />
            </svg>
          </span>
          <span>${t.label}</span>
        </button>
      `
        )
        .join("")}
    </nav>
  `;
}

function bindPageEvents(route: Route) {
  // Tab 切换
  document.querySelectorAll<HTMLElement>("[data-route]").forEach((el) => {
    el.addEventListener("click", () => {
      const r = el.dataset.route!;
      navigate({ name: r as Route["name"] } as Route);
    });
  });
  // 各页面事件
  switch (route.name) {
    case "home":
      import("./pages/home").then((m) => m.bindHomeEvents());
      break;
    case "stats":
      import("./pages/stats").then((m) => m.bindStatsEvents());
      break;
    case "charsets":
      import("./pages/charsets").then((m) => m.bindCharsetsEvents());
      break;
    case "profile":
      import("./pages/profile").then((m) => m.bindProfileEvents());
      break;
    case "game":
      import("./pages/game").then((m) => m.bindGameEvents(route.mode));
      break;
  }
}

// 订阅状态变化时重渲染（仅非游戏页）
subscribe(() => {
  if (currentRoute.name !== "game") render();
});
