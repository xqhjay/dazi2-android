// 下落字游戏引擎
import { api, type PracticeRecord } from "./api";
import {
  getState,
  setState,
  getLevel,
  getHighScore,
  getSpeedMultiplier,
  levelKey,
} from "./store";

export type GameMode = "timed" | "free" | "endless";

export interface GameConfig {
  mode: GameMode;
  charsetId: string;
  words: string[];
  // 限时模式：4分钟；自由：不限时；无尽：不限时
  customSpeed?: number; // 自由模式自定义速度倍率 0.1-5.0
}

export interface GameStats {
  cleared: number;
  errors: number;
  missed: number;
  clearedChars: string[];
  errorChars: string[];
  startTime: number;
  durationSec: number;
  wpm: number;
  accuracy: number;
  score: number;
  isPassed: boolean;
}

interface FallingChar {
  id: number;
  char: string;
  x: number; // 0-1 比例
  y: number; // px
  speed: number; // px/sec
  clearing?: boolean;
}

const BASE_SPEED = 60; // px/sec 基础下落速度
const CHAR_SIZE = 44;
const TIMED_DURATION = 240; // 4分钟
const MAX_HP = 100;
const HP_PER_MISS = 10;

export class GameEngine {
  private cfg: GameConfig;
  private area: HTMLElement;
  private input: HTMLInputElement;
  private onUpdate: (stats: Partial<GameStats> & { hp: number; timeLeft: number }) => void;
  private onEnd: (stats: GameStats) => void;

  private chars: FallingChar[] = [];
  private nextId = 1;
  private rafId = 0;
  private lastTime = 0;
  private lastSpawn = 0;
  private startTime = 0;
  private hp = MAX_HP;
  private cleared = 0;
  private errors = 0;
  private missed = 0;
  private clearedChars: string[] = [];
  private errorChars: string[] = [];
  private ended = false;
  private paused = false;
  private currentLevel: number;
  private endlessSpeed = 0.5;
  private lastSpeedUp = 0;
  private errorQueue: { char: string; time: number }[] = []; // 智能错字强化
  private areaHeight = 0;
  private areaWidth = 0;

  constructor(
    cfg: GameConfig,
    area: HTMLElement,
    input: HTMLInputElement,
    onUpdate: (s: Partial<GameStats> & { hp: number; timeLeft: number }) => void,
    onEnd: (s: GameStats) => void
  ) {
    this.cfg = cfg;
    this.area = area;
    this.input = input;
    this.onUpdate = onUpdate;
    this.onEnd = onEnd;
    this.currentLevel = cfg.mode === "timed" ? getLevel("timed", cfg.charsetId) : 1;
  }

  start() {
    this.startTime = Date.now();
    this.measureArea();
    this.setupInput();
    this.lastTime = performance.now();
    this.lastSpawn = this.lastTime;
    this.lastSpeedUp = this.lastTime;
    this.loop(this.lastTime);
    this.input.focus();
  }

  private measureArea() {
    const rect = this.area.getBoundingClientRect();
    this.areaWidth = rect.width;
    this.areaHeight = rect.height;
  }

  private setupInput() {
    let composing = false;
    this.input.addEventListener("compositionstart", () => {
      composing = true;
    });
    this.input.addEventListener("compositionend", () => {
      composing = false;
      this.handleInput();
    });
    this.input.addEventListener("input", () => {
      if (!composing) this.handleInput();
    });
  }

  private handleInput() {
    const val = this.input.value.trim();
    if (!val) return;
    // 取最后一个字符（支持一次输入多字时取末字匹配）
    const last = val[val.length - 1];
    // 在下落字中查找匹配（最早出现的）
    const target = this.chars.find((c) => !c.clearing && c.char === last);
    if (target) {
      this.clearChar(target);
      this.input.value = "";
    } else {
      // 错字
      this.errors++;
      this.errorChars.push(last);
      this.errorQueue.push({ char: last, time: Date.now() });
      this.input.classList.add("error");
      setTimeout(() => this.input.classList.remove("error"), 300);
      this.input.value = "";
      if (getState().vibrate) api.vibrate(30);
      this.onUpdate(this.getStats());
    }
  }

  private clearChar(c: FallingChar) {
    c.clearing = true;
    const el = this.area.querySelector(`[data-id="${c.id}"]`);
    if (el) el.classList.add("clearing");
    setTimeout(() => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }, 200);
    this.cleared++;
    this.clearedChars.push(c.char);
    // 从错字队列移除
    this.errorQueue = this.errorQueue.filter((e) => e.char !== c.char);
    if (getState().vibrate) api.vibrate(15);
    this.onUpdate(this.getStats());
  }

  private spawn() {
    let char: string;
    // 智能错字强化：自由模式下，10秒前的错字 70% 概率重现
    if (this.cfg.mode === "free") {
      const now = Date.now();
      const candidates = this.errorQueue.filter((e) => now - e.time > 10000);
      if (candidates.length > 0 && Math.random() < 0.7) {
        char = candidates[Math.floor(Math.random() * candidates.length)].char;
      } else {
        char = this.pickRandom();
      }
    } else {
      char = this.pickRandom();
    }
    const id = this.nextId++;
    const x = 0.1 + Math.random() * 0.8; // 避免贴边
    const speed = this.currentSpeed();
    this.chars.push({ id, char, x, y: -CHAR_SIZE, speed });
    this.renderChar({ id, char, x, y: -CHAR_SIZE, speed });
  }

  private pickRandom(): string {
    const words = this.cfg.words;
    if (!words.length) return "字";
    // 避免与当前屏幕上的字重复
    const onScreen = new Set(this.chars.filter((c) => !c.clearing).map((c) => c.char));
    let attempts = 0;
    let w = words[Math.floor(Math.random() * words.length)];
    while (onScreen.has(w) && attempts < 10) {
      w = words[Math.floor(Math.random() * words.length)];
      attempts++;
    }
    return w;
  }

  private currentSpeed(): number {
    if (this.cfg.mode === "free" && this.cfg.customSpeed) {
      return BASE_SPEED * this.cfg.customSpeed;
    }
    if (this.cfg.mode === "endless") {
      return BASE_SPEED * this.endlessSpeed;
    }
    // timed
    return BASE_SPEED * getSpeedMultiplier(this.currentLevel);
  }

  private renderChar(c: FallingChar) {
    const el = document.createElement("div");
    el.className = "falling-char";
    el.dataset.id = String(c.id);
    el.textContent = c.char;
    el.style.left = `${c.x * this.areaWidth}px`;
    el.style.top = `${c.y}px`;
    this.area.appendChild(el);
  }

  private loop = (now: number) => {
    if (this.ended || this.paused) {
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // 无尽模式每15秒加速0.1
    if (this.cfg.mode === "endless" && now - this.lastSpeedUp > 15000) {
      this.endlessSpeed += 0.1;
      this.lastSpeedUp = now;
    }

    // 生成新字
    const spawnInterval = this.spawnInterval();
    if (now - this.lastSpawn > spawnInterval) {
      this.spawn();
      this.lastSpawn = now;
    }

    // 更新位置
    const dtPx = dt * this.currentSpeed();
    for (const c of this.chars) {
      if (c.clearing) continue;
      c.y += dtPx;
      const el = this.area.querySelector(`[data-id="${c.id}"]`) as HTMLElement;
      if (el) {
        el.style.top = `${c.y}px`;
        // 接近底部变红
        if (c.y > this.areaHeight - CHAR_SIZE * 2) el.classList.add("danger");
      }
      // 触底
      if (c.y > this.areaHeight) {
        this.missed++;
        this.hp -= HP_PER_MISS;
        if (el) el.parentNode?.removeChild(el);
        this.chars = this.chars.filter((x) => x.id !== c.id);
        if (getState().vibrate) api.vibrate(40);
        if (this.hp <= 0) {
          this.hp = 0;
          this.end(false);
          return;
        }
        this.onUpdate(this.getStats());
      }
    }

    // 限时模式时间到
    if (this.cfg.mode === "timed") {
      const elapsed = (Date.now() - this.startTime) / 1000;
      if (elapsed >= TIMED_DURATION) {
        this.end(true);
        return;
      }
    }

    this.onUpdate(this.getStats());
    this.rafId = requestAnimationFrame(this.loop);
  };

  private spawnInterval(): number {
    // 速度越快，生成越频繁。基础 1500ms，随速度递减
    const mult = this.cfg.mode === "free" && this.cfg.customSpeed
      ? this.cfg.customSpeed
      : this.cfg.mode === "endless"
      ? this.endlessSpeed
      : getSpeedMultiplier(this.currentLevel);
    return Math.max(500, 1500 - mult * 200);
  }

  private getStats(): Partial<GameStats> & { hp: number; timeLeft: number } {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const timeLeft = this.cfg.mode === "timed" ? Math.max(0, TIMED_DURATION - elapsed) : 0;
    return {
      cleared: this.cleared,
      errors: this.errors,
      missed: this.missed,
      hp: this.hp,
      timeLeft,
    };
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.lastTime = performance.now();
  }

  private end(isPassed: boolean) {
    if (this.ended) return;
    this.ended = true;
    cancelAnimationFrame(this.rafId);
    const durationSec = Math.round((Date.now() - this.startTime) / 1000);
    const total = this.cleared + this.errors + this.missed;
    const accuracy = total > 0 ? (this.cleared / total) * 100 : 0;
    const wpm = durationSec > 0 ? (this.cleared / durationSec) * 60 : 0;
    // 无尽模式得分：消除字数 × 速度倍率
    const score =
      this.cfg.mode === "endless"
        ? Math.round(this.cleared * this.endlessSpeed)
        : this.cleared;

    const stats: GameStats = {
      cleared: this.cleared,
      errors: this.errors,
      missed: this.missed,
      clearedChars: this.clearedChars,
      errorChars: this.errorChars,
      startTime: this.startTime,
      durationSec,
      wpm: Math.round(wpm * 10) / 10,
      accuracy: Math.round(accuracy * 10) / 10,
      score,
      isPassed,
    };

    // 限时模式升级
    if (this.cfg.mode === "timed" && isPassed) {
      const newLevel = Math.min(8, this.currentLevel + 1);
      const key = levelKey("timed", this.cfg.charsetId);
      const levels = { ...getState().levels, [key]: newLevel };
      setState({ levels });
      api.setSetting(`level_${key}`, String(newLevel));
    }
    // 无尽模式最高分
    if (this.cfg.mode === "endless") {
      const prevHigh = getHighScore(this.cfg.charsetId);
      if (score > prevHigh) {
        const highScores = {
          ...getState().highScores,
          [`endless_${this.cfg.charsetId}`]: score,
        };
        setState({ highScores });
        api.setSetting(`highscore_endless_${this.cfg.charsetId}`, String(score));
      }
    }

    // 保存记录
    const record: PracticeRecord = {
      mode: this.cfg.mode,
      charset_id: this.cfg.charsetId,
      wpm: stats.wpm,
      accuracy: stats.accuracy,
      score: stats.score,
      duration_sec: stats.durationSec,
      cleared_count: stats.cleared,
      error_count: stats.errors + stats.missed,
      is_passed: isPassed,
      cleared_chars: stats.clearedChars,
      error_chars: stats.errorChars,
    };
    api.saveRecord(record).catch((e) => console.warn(e));
    api.checkAchievements(stats.wpm, stats.accuracy, stats.cleared, this.cfg.mode, stats.score).catch(
      (e) => console.warn(e)
    );
    // 打卡
    api.doCheckin().catch((e) => console.warn(e));

    this.onEnd(stats);
  }

  destroy() {
    this.ended = true;
    cancelAnimationFrame(this.rafId);
    this.area.innerHTML = "";
  }
}
