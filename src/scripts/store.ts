// 简单全局状态管理
import { api, type CharsetData, type CharsetMeta } from "./api";

export interface AppState {
  theme: "light" | "dark" | "system";
  sound: boolean;
  vibrate: boolean;
  defaultCharsetId: string;
  charsets: CharsetMeta[];
  currentCharset: CharsetData | null;
  // 各模式各字集的等级/最高分
  levels: Record<string, number>; // key: `${mode}_${charsetId}` -> level (1-8)
  highScores: Record<string, number>; // key: `endless_${charsetId}` -> score
}

const state: AppState = {
  theme: "system",
  sound: true,
  vibrate: true,
  defaultCharsetId: "common-1",
  charsets: [],
  currentCharset: null,
  levels: {},
  highScores: {},
};

const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState>) {
  Object.assign(state, patch);
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function loadSettings() {
  try {
    const all = await api.getAllSettings();
    if (all.theme) setState({ theme: all.theme as AppState["theme"] });
    if (all.sound) setState({ sound: all.sound === "true" });
    if (all.vibrate) setState({ vibrate: all.vibrate === "true" });
    if (all.default_charset) setState({ defaultCharsetId: all.default_charset });
    // 等级与最高分
    const levels: Record<string, number> = {};
    const highScores: Record<string, number> = {};
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith("level_")) levels[k.slice(6)] = parseInt(v, 10) || 1;
      if (k.startsWith("highscore_")) highScores[k.slice(10)] = parseInt(v, 10) || 0;
    }
    setState({ levels, highScores });
    applyTheme();
  } catch (e) {
    console.warn("loadSettings failed", e);
  }
}

export async function loadCharsets() {
  try {
    const list = await api.listCharsets();
    setState({ charsets: list });
    if (!state.currentCharset) {
      await selectCharset(state.defaultCharsetId);
    }
  } catch (e) {
    console.warn("loadCharsets failed", e);
  }
}

export async function selectCharset(id: string) {
  try {
    const data = await api.loadCharset(id);
    setState({ currentCharset: data, defaultCharsetId: id });
  } catch (e) {
    console.warn("selectCharset failed", e);
  }
}

export function applyTheme() {
  const prefersDark =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = state.theme === "dark" || (state.theme === "system" && prefersDark);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

export function levelKey(mode: string, charsetId: string) {
  return `${mode}_${charsetId}`;
}

export function getLevel(mode: string, charsetId: string): number {
  return state.levels[levelKey(mode, charsetId)] || 1;
}

export function getHighScore(charsetId: string): number {
  return state.highScores[`endless_${charsetId}`] || 0;
}

// 速度等级配置（与原版一致，去除修仙命名）
export const SPEED_LEVELS = [
  { level: 1, name: "Lv.1", multiplier: 0.5 },
  { level: 2, name: "Lv.2", multiplier: 1.0 },
  { level: 3, name: "Lv.3", multiplier: 1.5 },
  { level: 4, name: "Lv.4", multiplier: 2.0 },
  { level: 5, name: "Lv.5", multiplier: 2.5 },
  { level: 6, name: "Lv.6", multiplier: 3.0 },
  { level: 7, name: "Lv.7", multiplier: 3.5 },
  { level: 8, name: "Lv.8", multiplier: 4.0 },
];

export function getSpeedMultiplier(level: number): number {
  return SPEED_LEVELS[Math.min(level, 8) - 1].multiplier;
}
