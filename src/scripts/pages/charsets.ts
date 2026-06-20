import { api } from "../api";
import { getState, setState, selectCharset } from "../store";
import { navigate } from "../router";

export function renderCharsets(): string {
  const s = getState();
  const list = s.charsets;
  return `
    <div class="topbar"><h1>字集</h1></div>
    <div class="screen-scroll">
      <div class="section-title">内置字集</div>
      ${list
        .filter((c) => c.builtin)
        .map(
          (c) => `
        <button class="list-item" data-charset="${c.id}">
          <div>
            <div style="font-weight:600">${c.title}</div>
            <div class="tiny muted">${c.word_count} 字</div>
          </div>
          <div class="row">
            ${
              s.defaultCharsetId === c.id
                ? '<span class="tiny" style="color:var(--accent)">✓ 使用中</span>'
                : ""
            }
          </div>
        </button>
      `
        )
        .join("")}

      <div class="section-title">自定义字集</div>
      <div id="custom-list">
        ${list
          .filter((c) => !c.builtin)
          .map(
            (c) => `
          <button class="list-item" data-charset="${c.id}">
            <div>
              <div style="font-weight:600">${c.title}</div>
              <div class="tiny muted">${c.word_count} 字</div>
            </div>
            <div class="row">
              ${
                s.defaultCharsetId === c.id
                  ? '<span class="tiny" style="color:var(--accent)">✓ 使用中</span>'
                  : ""
              }
            </div>
          </button>
        `
          )
          .join("") || '<div class="empty">暂无自定义字集</div>'}
      </div>

      <button class="btn btn-primary btn-block mt-16" data-action="import">导入字集</button>
      <div class="tiny muted center mt-8">
        JSON 格式：{"title":"名称","words":["字","一",...]}
      </div>
    </div>
  `;
}

export async function bindCharsetsEvents() {
  // 选择字集
  document.querySelectorAll<HTMLElement>("[data-charset]").forEach((el) => {
    el.addEventListener("click", async () => {
      const id = el.dataset.charset!;
      await selectCharset(id);
      await api.setDefaultCharset(id);
      navigate({ name: "home" });
    });
  });

  // 导入字集
  document.querySelector("[data-action='import']")?.addEventListener("click", async () => {
    await importCharset();
  });
}

async function importCharset() {
  try {
    const isTauri = "__TAURI_INTERNALS__" in window;
    if (!isTauri) {
      // 浏览器开发：用 prompt 模拟
      const text = prompt('粘贴字集 JSON，例如：\n{"title":"我的字集","words":["字","一","二"]}');
      if (!text) return;
      const data = JSON.parse(text);
      if (!data.title || !Array.isArray(data.words)) {
        alert("格式错误");
        return;
      }
      await api.importCharset(data.title, data.words);
      alert("导入成功");
      location.reload();
      return;
    }
    const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await openDialog({
      filters: [{ name: "JSON", extensions: ["json"] }],
      multiple: false,
    });
    if (!path || typeof path !== "string") return;
    const content = await readTextFile(path);
    const data = JSON.parse(content);
    if (!data.title || !Array.isArray(data.words) || data.words.length < 10) {
      alert("格式错误：需包含 title 和 words（至少 10 个字）");
      return;
    }
    await api.importCharset(data.title, data.words);
    alert("导入成功");
    // 重新加载字集列表
    const list = await api.listCharsets();
    setState({ charsets: list });
  } catch (e) {
    alert("导入失败：" + (e as Error).message);
  }
}
