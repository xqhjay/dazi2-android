// Tauri 后端 API 封装
// 在 Tauri 环境用 invoke，在浏览器开发环境用 mock

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<T>(cmd, args);
  }
  // 浏览器开发环境 mock
  return mockApi<T>(cmd, args);
}

// ===== 类型 =====
export interface PracticeRecord {
  mode: "timed" | "free" | "endless";
  charset_id: string;
  wpm: number;
  accuracy: number;
  score: number;
  duration_sec: number;
  cleared_count: number;
  error_count: number;
  is_passed: boolean;
  cleared_chars: string[];
  error_chars: string[];
}

export interface SavedRecord {
  id: number;
  mode: string;
  charset_id: string;
  wpm: number;
  accuracy: number;
  score: number;
  duration_sec: number;
  cleared_count: number;
  error_count: number;
  is_passed: boolean;
  created_at: string;
}

export interface Overview {
  total_duration_sec: number;
  total_cleared: number;
  avg_wpm: number;
  avg_accuracy: number;
  total_sessions: number;
}

export interface TrendPoint {
  date: string;
  wpm: number;
  accuracy: number;
}

export interface ErrorChar {
  char: string;
  charset_id: string;
  error_count: number;
  correct_count: number;
  last_practiced_at: string | null;
}

export interface CharsetMeta {
  id: string;
  title: string;
  word_count: number;
  builtin: boolean;
}

export interface CharsetData {
  id: string;
  title: string;
  words: string[];
}

export interface Achievement {
  code: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlocked_at: string | null;
}

export interface CheckinStatus {
  today: boolean;
  streak: number;
  total: number;
}

// ===== API =====
export const api = {
  saveRecord: (r: PracticeRecord) => invoke<number>("save_record", { record: r }),
  getRecords: (limit?: number) => invoke<SavedRecord[]>("get_records", { limit }),
  getOverview: () => invoke<Overview>("get_overview"),
  getTrend: (days?: number) => invoke<TrendPoint[]>("get_trend", { days }),
  getRecentStats: () => invoke<SavedRecord | null>("get_recent_stats"),

  listCharsets: () => invoke<CharsetMeta[]>("list_charsets"),
  loadCharset: (id: string) => invoke<CharsetData>("load_charset", { id }),
  importCharset: (title: string, words: string[]) =>
    invoke<string>("import_charset", { title, words }),
  setDefaultCharset: (id: string) => invoke<void>("set_default_charset", { id }),
  getDefaultCharset: () => invoke<string | null>("get_default_charset"),

  getErrorChars: (limit?: number) => invoke<ErrorChar[]>("get_error_chars", { limit }),
  updateCharMastery: (charsetId: string, cleared: string[], errors: string[]) =>
    invoke<void>("update_char_mastery", {
      charsetId,
      clearedChars: cleared,
      errorChars: errors,
    }),

  checkAchievements: (
    wpm: number,
    accuracy: number,
    clearedCount: number,
    mode: string,
    score: number
  ) =>
    invoke<string[]>("check_achievements", {
      wpm,
      accuracy,
      clearedCount,
      mode,
      score,
    }),
  listAchievements: () => invoke<Achievement[]>("list_achievements"),

  doCheckin: () => invoke<CheckinStatus>("do_checkin"),
  getCheckinStatus: () => invoke<CheckinStatus>("get_checkin_status"),

  getSetting: (key: string) => invoke<string | null>("get_setting", { key }),
  setSetting: (key: string, value: string) => invoke<void>("set_setting", { key, value }),
  getAllSettings: () => invoke<Record<string, string>>("get_all_settings"),

  // 振动反馈
  vibrate: async (ms: number = 20) => {
    if (isTauri) {
      try {
        const { vibrate } = await import("@tauri-apps/plugin-haptics");
        await vibrate(ms);
      } catch {
        /* 忽略 */
      }
    } else if ("vibrate" in navigator) {
      navigator.vibrate(ms);
    }
  },
};

// ===== 浏览器开发环境 mock =====
const mockStore: Record<string, unknown> = {
  records: [] as PracticeRecord[],
  settings: { theme: "light", sound: "true", vibrate: "true", default_charset: "common-1" },
  achievements: [] as string[],
  checkins: [] as string[],
};

async function mockApi<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  await new Promise((r) => setTimeout(r, 10));
  const records = mockStore.records as PracticeRecord[];
  switch (cmd) {
    case "save_record":
      records.push(args!.record as PracticeRecord);
      return 1 as T;
    case "get_records":
      return records.slice(-50).reverse() as unknown as T;
    case "get_overview": {
      const dur = records.reduce((s, r) => s + r.duration_sec, 0);
      const cleared = records.reduce((s, r) => s + r.cleared_count, 0);
      const avgWpm = records.length ? records.reduce((s, r) => s + r.wpm, 0) / records.length : 0;
      const avgAcc = records.length
        ? records.reduce((s, r) => s + r.accuracy, 0) / records.length
        : 0;
      return {
        total_duration_sec: dur,
        total_cleared: cleared,
        avg_wpm: avgWpm,
        avg_accuracy: avgAcc,
        total_sessions: records.length,
      } as T;
    }
    case "get_trend":
      return [] as T;
    case "get_recent_stats":
      return (records[records.length - 1] || null) as T;
    case "list_charsets":
      return [
        { id: "common-1", title: "常用字 500（前 500 · 高频）", word_count: 500, builtin: true },
        { id: "common-2", title: "常用字 500（中 500 · 中频）", word_count: 500, builtin: true },
        { id: "common-3", title: "常用字 500（后 500 · 低频）", word_count: 500, builtin: true },
      ] as T;
    case "load_charset": {
      const id = args!.id as string;
      const words = Array.from({ length: 500 }, (_, i) =>
        String.fromCharCode(0x4e00 + ((i * 7) % 3000))
      );
      return { id, title: `字集 ${id}`, words } as T;
    }
    case "import_charset":
      return "custom-mock" as T;
    case "set_default_charset":
      return undefined as T;
    case "get_default_charset":
      return (mockStore.settings as Record<string, string>).default_charset as T;
    case "get_error_chars":
      return [] as T;
    case "update_char_mastery":
      return undefined as T;
    case "check_achievements":
      return [] as T;
    case "list_achievements":
      return [] as T;
    case "do_checkin":
      return { today: true, streak: 1, total: 1 } as T;
    case "get_checkin_status":
      return { today: false, streak: 0, total: 0 } as T;
    case "get_setting":
      return ((mockStore.settings as Record<string, string>)[args!.key as string] ?? null) as T;
    case "set_setting":
      (mockStore.settings as Record<string, string>)[args!.key as string] = args!.value as string;
      return undefined as T;
    case "get_all_settings":
      return mockStore.settings as T;
    default:
      return undefined as T;
  }
}
