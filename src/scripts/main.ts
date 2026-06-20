import { render } from "./router";
import { loadSettings, loadCharsets, applyTheme } from "./store";

async function init() {
  // 监听系统主题变化
  if (window.matchMedia) {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", applyTheme);
  }

  // 监听视口变化（IME 避让）
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      document.documentElement.style.setProperty(
        "--vh",
        `${window.visualViewport!.height * 0.01}px`
      );
    });
  }

  await loadSettings();
  await loadCharsets();

  render();
}

init();
