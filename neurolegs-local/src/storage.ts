import { DEFAULT_SETTINGS } from "./constants";
import { emptyLogs, normalizeLogs } from "./engine";
import type { Logs, Settings } from "./types";

const STORAGE_KEY = "neurolegs-local-vite-v1";

type PersistedState = {
  logs: Logs;
  settings: Settings;
};

export function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { logs: emptyLogs(), settings: DEFAULT_SETTINGS };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const logs = normalizeLogs(parsed.logs ?? emptyLogs());
    const parsedSettings = (parsed.settings ?? {}) as Partial<Settings>;
    const settings = {
      ...DEFAULT_SETTINGS,
      ...parsedSettings,
      progressionState: {
        ...DEFAULT_SETTINGS.progressionState,
        ...(parsedSettings.progressionState ?? {}),
      },
    };

    if (logs.scheduleOffset !== settings.scheduleOffset) {
      logs.scheduleOffset = settings.scheduleOffset;
    }

    return { logs, settings };
  } catch {
    return { logs: emptyLogs(), settings: DEFAULT_SETTINGS };
  }
}

export function savePersistedState(logs: Logs, settings: Settings): void {
  const payload: PersistedState = {
    logs: normalizeLogs(logs),
    settings,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearPersistedState(): void {
  localStorage.removeItem(STORAGE_KEY);
}
