import { create } from 'zustand';
import { DEFAULT_RISK_RULES, RiskRuleConfig } from '../utils/riskRules';

export interface PropChallenge {
  id: string;
  name: string;
  accountId: string;
  phase: 'Phase 1' | 'Phase 2' | 'Funded' | 'Failed';
  startBalance: number;
  profitTargetPct: number; // e.g. 10
  maxDrawdownPct: number; // e.g. 10
  dailyDrawdownPct: number; // e.g. 5
  minTradingDays: number;
  tradingDaysDone: number;
  notes?: string;
  createdAt: string;
}

interface ToolsState {
  riskRules: RiskRuleConfig;
  challenges: PropChallenge[];
  lastBreachKeys: string[]; // tránh spam Telegram
  setRiskRules: (rules: Partial<RiskRuleConfig>) => void;
  addChallenge: (c: Omit<PropChallenge, 'id' | 'createdAt'>) => void;
  updateChallenge: (id: string, patch: Partial<PropChallenge>) => void;
  deleteChallenge: (id: string) => void;
  setLastBreachKeys: (keys: string[]) => void;
  hydrate: () => void;
}

const RULES_KEY = 'goldquant_risk_rules';
const CHALLENGES_KEY = 'goldquant_prop_challenges';
const BREACH_KEY = 'goldquant_last_breaches';

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const useToolsStore = create<ToolsState>((set, get) => ({
  riskRules: DEFAULT_RISK_RULES,
  challenges: [],
  lastBreachKeys: [],

  hydrate: () => {
    set({
      riskRules: { ...DEFAULT_RISK_RULES, ...loadJson(RULES_KEY, {}) },
      challenges: loadJson(CHALLENGES_KEY, []),
      lastBreachKeys: loadJson(BREACH_KEY, []),
    });
  },

  setRiskRules: (partial) => {
    const next = { ...get().riskRules, ...partial };
    saveJson(RULES_KEY, next);
    set({ riskRules: next });
  },

  addChallenge: (data) => {
    const c: PropChallenge = {
      ...data,
      id: `ch_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const challenges = [...get().challenges, c];
    saveJson(CHALLENGES_KEY, challenges);
    set({ challenges });
  },

  updateChallenge: (id, patch) => {
    const challenges = get().challenges.map((c) =>
      c.id === id ? { ...c, ...patch } : c
    );
    saveJson(CHALLENGES_KEY, challenges);
    set({ challenges });
  },

  deleteChallenge: (id) => {
    const challenges = get().challenges.filter((c) => c.id !== id);
    saveJson(CHALLENGES_KEY, challenges);
    set({ challenges });
  },

  setLastBreachKeys: (keys) => {
    saveJson(BREACH_KEY, keys);
    set({ lastBreachKeys: keys });
  },
}));
