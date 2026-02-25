import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";
import { exportLogsToCsv, exportMeasurementsToCsv, importCsvToLogs } from "./csv";
import {
  APP_TITLE,
  BACKOFF_PERCENT,
  DEFAULT_SETTINGS,
  EXERCISES,
  MEAL_PLANS,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUP_ORDER,
  MUSCLE_TARGET_RANGES,
  TARGET_RPE,
  USER_PROFILE,
} from "./constants";
import {
  AdaptiveCoach,
  buildBodyHeatmapState,
  calculate1rm,
  calculateStreak,
  checkForNewPr,
  emptyLogs,
  estimateE1rm,
  formatRecommendationBadge,
  formatTrendBadge,
  generateWarmupSets,
  getAllMeasurementsSorted,
  getBrainStatus,
  getNextTrainingDay,
  getPercentagesFrom1rm,
  getSessionSets,
  getSessionTopWeight,
  getTodayWorkoutWithSettings,
  getWeekSchedulePreview,
  getWeeklyReview,
  getWorkoutNameList,
  normalizeLogs,
} from "./engine";
import { buildTrainingPlanText, parseTrainingPlanText } from "./notesSync";
import { loadPersistedState, savePersistedState } from "./storage";
import { importStreamlitSpreadsheet } from "./streamlitImport";
import {
  buildGitHubSyncKey,
  findBackupGistId,
  parseGitHubSyncKey,
  pullBackupFromGitHubGist,
  pushBackupToGitHubGist,
} from "./cloudSync";
import { BodyMapTab } from "./components/BodyMapTab";
import type { Logs, MeasurementEntry, SessionScheme, Settings, WorkoutName } from "./types";

type TabId = "today" | "log" | "progress" | "analytics" | "bodymap" | "tools" | "progression" | "settings" | "library";

const TAB_ITEMS: Array<{ id: TabId; label: string }> = [
  { id: "today", label: "Today" },
  { id: "log", label: "Notes Sync" },
  { id: "progress", label: "Progress" },
  { id: "analytics", label: "Analytics" },
  { id: "bodymap", label: "Body Map" },
  { id: "tools", label: "Tools" },
  { id: "progression", label: "Progression" },
  { id: "settings", label: "Settings" },
  { id: "library", label: "Library" },
];

const WORKOUT_NAMES = getWorkoutNameList();
const CLOUD_TOKEN_STORAGE_KEY = "neurolegs-cloud-token";
const CLOUD_GIST_STORAGE_KEY = "neurolegs-cloud-gist-id";
const CLOUD_AUTO_SYNC_STORAGE_KEY = "neurolegs-cloud-auto-sync";
const ENV_CLOUD_TOKEN = envString(import.meta.env.VITE_GITHUB_SYNC_TOKEN);
const ENV_CLOUD_GIST_ID = envString(import.meta.env.VITE_GITHUB_SYNC_GIST_ID);
const ENV_CLOUD_SYNC_LABEL = envString(import.meta.env.VITE_GITHUB_SYNC_LABEL) || "main";
const ENV_CLOUD_MANAGED = ENV_CLOUD_TOKEN.length > 0;
const ENV_CLOUD_GIST_PINNED = ENV_CLOUD_GIST_ID.length > 0;
const ENV_CLOUD_AUTO = (() => {
  if (typeof import.meta.env.VITE_GITHUB_SYNC_AUTO === "string") {
    return envBoolean(import.meta.env.VITE_GITHUB_SYNC_AUTO);
  }
  return ENV_CLOUD_MANAGED;
})();

function envString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function envBoolean(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

type SessionReview = {
  importedExercises: number;
  skippedExercises: number;
  totalSets: number;
  totalVolume: number;
  avgRpe: number;
  prHits: string[];
  highlights: string[];
  cautions: string[];
};

type ImportUndoSnapshot = {
  source: string;
  createdAt: string;
  logs: Logs;
  settings: Settings;
};

function formatClockNow() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatYmd(d);
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function downloadTextFile(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function asInputNumber(value: string, fallback: number) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeWorkoutName(value: string | null): WorkoutName {
  if (value && WORKOUT_NAMES.includes(value as WorkoutName)) {
    return value as WorkoutName;
  }
  return WORKOUT_NAMES[0];
}

function getDeltaTone(delta: number | null): "up" | "down" | "flat" | "none" {
  if (delta === null) {
    return "none";
  }
  if (delta > 0) {
    return "up";
  }
  if (delta < 0) {
    return "down";
  }
  return "flat";
}

function formatSigned(delta: number, digits = 1): string {
  const rounded = Number(delta.toFixed(digits));
  const abs = Math.abs(rounded);
  const rendered = Number.isInteger(abs) ? String(abs) : abs.toFixed(digits);
  if (rounded > 0) {
    return `+${rendered}`;
  }
  if (rounded < 0) {
    return `-${rendered}`;
  }
  return "0";
}

function hasLoggedTrainingData(logs: Logs): boolean {
  const exerciseEntries = Object.values(logs.exercises).reduce((sum, entries) => sum + entries.length, 0);
  return (
    logs.workouts.length > 0 ||
    logs.measurements.length > 0 ||
    logs.skippedSessions.length > 0 ||
    logs.skippedExercises.length > 0 ||
    exerciseEntries > 0
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="stat-card">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {hint ? <p className="stat-hint">{hint}</p> : null}
    </article>
  );
}

function App() {
  const initialState = useMemo(() => {
    const persisted = loadPersistedState();
    const [todayWorkout] = getTodayWorkoutWithSettings(persisted.settings);
    const selectedWorkout = todayWorkout !== "Holiday" && todayWorkout !== "Rest" ? todayWorkout : WORKOUT_NAMES[0];
    const firstProgressExercise = Object.keys(persisted.logs.exercises)[0] ?? "";
    return {
      ...persisted,
      selectedWorkout,
      firstProgressExercise,
    };
  }, []);

  const firstPersistRef = useRef(true);

  const [logs, setLogs] = useState<Logs>(initialState.logs);
  const [settings, setSettings] = useState<Settings>(initialState.settings);

  const [activeTab, setActiveTab] = useState<TabId>("today");
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutName>(initialState.selectedWorkout);
  const [logScheme, setLogScheme] = useState<SessionScheme>("Top Set + Back-off");
  const [saveMessage, setSaveMessage] = useState("");
  const [warningMessage, setWarningMessage] = useState("");

  const [progressExercise, setProgressExercise] = useState(initialState.firstProgressExercise);
  const [planCopied, setPlanCopied] = useState(false);
  const [pastedNotes, setPastedNotes] = useState("");
  const [pastedSessionDate, setPastedSessionDate] = useState<string>(() => dateDaysAgo(0));
  const [lastSessionReview, setLastSessionReview] = useState<SessionReview | null>(null);
  const [lastImportUndo, setLastImportUndo] = useState<ImportUndoSnapshot | null>(null);

  const [toolTab, setToolTab] = useState<"1RM Calculator" | "Warm-up Generator" | "Body Measurements">("1RM Calculator");
  const [calcWeight, setCalcWeight] = useState(60);
  const [calcReps, setCalcReps] = useState(5);
  const [calcResult, setCalcResult] = useState<number | null>(null);
  const [workingWeight, setWorkingWeight] = useState(60);
  const [workingReps, setWorkingReps] = useState(5);
  const [warmupResult, setWarmupResult] = useState<{ weight: number; reps: number; notes: string }[]>([]);

  const [measureBodyWeight, setMeasureBodyWeight] = useState(USER_PROFILE.weightKg);
  const [measureLeftThigh, setMeasureLeftThigh] = useState(50);
  const [measureRightThigh, setMeasureRightThigh] = useState(50);
  const [measureLeftCalf, setMeasureLeftCalf] = useState(35);
  const [measureRightCalf, setMeasureRightCalf] = useState(35);
  const [measureNotes, setMeasureNotes] = useState("");

  const [csvImportFeedback, setCsvImportFeedback] = useState("");
  const [xlsxImportFeedback, setXlsxImportFeedback] = useState("");
  const [cloudSyncFeedback, setCloudSyncFeedback] = useState("");
  const [cloudSyncBusy, setCloudSyncBusy] = useState<"push" | "pull" | null>(null);
  const [cloudToken, setCloudToken] = useState(() => {
    if (ENV_CLOUD_MANAGED) {
      return ENV_CLOUD_TOKEN;
    }
    const stored = localStorage.getItem(CLOUD_TOKEN_STORAGE_KEY);
    if (stored?.trim()) {
      return stored.trim();
    }
    return "";
  });
  const [cloudGistId, setCloudGistId] = useState(() => {
    if (ENV_CLOUD_MANAGED) {
      return ENV_CLOUD_GIST_PINNED ? ENV_CLOUD_GIST_ID : "";
    }
    const stored = localStorage.getItem(CLOUD_GIST_STORAGE_KEY);
    if (stored?.trim()) {
      return stored.trim();
    }
    return "";
  });
  const [cloudAutoSync, setCloudAutoSync] = useState(() => {
    if (ENV_CLOUD_MANAGED) {
      return ENV_CLOUD_AUTO;
    }
    const stored = localStorage.getItem(CLOUD_AUTO_SYNC_STORAGE_KEY);
    if (stored === "1") {
      return true;
    }
    if (stored === "0") {
      return false;
    }
    return false;
  });
  const [cloudSyncKeyInput, setCloudSyncKeyInput] = useState("");
  const [cloudAutoReady, setCloudAutoReady] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState<"All" | "Active Only" | "Inactive Only">("All");
  const cloudSkipNextAutoPushRef = useRef(false);
  const cloudLastSyncedSnapshotRef = useRef("");
  const cloudAutoPushTimeoutRef = useRef<number | null>(null);
  const cloudPayloadSnapshotRef = useRef("");
  const cloudBusyRef = useRef<"push" | "pull" | null>(null);
  const cloudPayloadSnapshot = useMemo(
    () => JSON.stringify({ logs: normalizeLogs(logs), settings }),
    [logs, settings],
  );

  useEffect(() => {
    if (firstPersistRef.current) {
      firstPersistRef.current = false;
      return;
    }
    savePersistedState(logs, settings);
  }, [logs, settings]);

  useEffect(() => {
    cloudPayloadSnapshotRef.current = cloudPayloadSnapshot;
  }, [cloudPayloadSnapshot]);

  useEffect(() => {
    cloudBusyRef.current = cloudSyncBusy;
  }, [cloudSyncBusy]);

  useEffect(() => {
    if (!ENV_CLOUD_MANAGED) {
      return;
    }

    if (cloudToken !== ENV_CLOUD_TOKEN) {
      setCloudToken(ENV_CLOUD_TOKEN);
    }
    if (ENV_CLOUD_GIST_PINNED && cloudGistId !== ENV_CLOUD_GIST_ID) {
      setCloudGistId(ENV_CLOUD_GIST_ID);
    }
    if (cloudAutoSync !== ENV_CLOUD_AUTO) {
      setCloudAutoSync(ENV_CLOUD_AUTO);
    }
  }, [cloudAutoSync, cloudGistId, cloudToken]);

  useEffect(() => {
    if (ENV_CLOUD_MANAGED) {
      return;
    }
    if (cloudToken.trim()) {
      localStorage.setItem(CLOUD_TOKEN_STORAGE_KEY, cloudToken.trim());
    } else {
      localStorage.removeItem(CLOUD_TOKEN_STORAGE_KEY);
    }
  }, [cloudToken]);

  useEffect(() => {
    if (cloudGistId.trim()) {
      localStorage.setItem(CLOUD_GIST_STORAGE_KEY, cloudGistId.trim());
    } else {
      localStorage.removeItem(CLOUD_GIST_STORAGE_KEY);
    }
  }, [cloudGistId]);

  useEffect(() => {
    if (ENV_CLOUD_MANAGED) {
      return;
    }
    localStorage.setItem(CLOUD_AUTO_SYNC_STORAGE_KEY, cloudAutoSync ? "1" : "0");
  }, [cloudAutoSync]);

  useEffect(() => {
    const token = cloudToken.trim();
    const gistId = cloudGistId.trim();
    if (!cloudAutoSync || !token || gistId) {
      return;
    }

    let cancelled = false;
    setCloudSyncBusy("pull");

    (async () => {
      try {
        const discoveredGistId = await findBackupGistId({
          token,
          syncLabel: ENV_CLOUD_SYNC_LABEL,
        });
        if (cancelled) {
          return;
        }

        if (discoveredGistId) {
          setCloudGistId(discoveredGistId);
          setCloudSyncFeedback(`Auto-sync database found (${discoveredGistId}).`);
        } else {
          setCloudSyncFeedback("No remote sync database found yet. It will be created on first logged training data.");
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : "Database discovery failed.";
        setCloudSyncFeedback(`Database discovery failed: ${message}`);
      } finally {
        if (!cancelled) {
          setCloudSyncBusy(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cloudAutoSync, cloudGistId, cloudToken]);

  useEffect(() => {
    const token = cloudToken.trim();
    const gistId = cloudGistId.trim();

    if (!cloudAutoSync || !token) {
      setCloudAutoReady(false);
      return;
    }

    if (!gistId) {
      setCloudAutoReady(true);
      return;
    }

    let cancelled = false;
    setCloudAutoReady(false);
    setCloudSyncBusy("pull");

    (async () => {
      try {
        const remote = await pullBackupFromGitHubGist({ token, gistId });
        if (cancelled) {
          return;
        }

        const remoteLogs = normalizeLogs(deepClone(remote.logs));
        const remoteSettings = deepClone(remote.settings);
        const remoteSnapshot = JSON.stringify({ logs: remoteLogs, settings: remoteSettings });

        if (remoteSnapshot !== cloudPayloadSnapshotRef.current) {
          cloudSkipNextAutoPushRef.current = true;
          setLogs(remoteLogs);
          setSettings(remoteSettings);
        }

        cloudLastSyncedSnapshotRef.current = remoteSnapshot;
        setCloudSyncFeedback(`Auto-sync connected to gist ${gistId}.`);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : "Auto pull failed.";
        if (ENV_CLOUD_MANAGED && !ENV_CLOUD_GIST_PINNED && /\(404\)/.test(message)) {
          setCloudGistId("");
        }
        setCloudSyncFeedback(`Auto pull failed: ${message}`);
      } finally {
        if (!cancelled) {
          setCloudSyncBusy(null);
          setCloudAutoReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cloudAutoSync, cloudGistId, cloudToken]);

  useEffect(() => {
    const token = cloudToken.trim();
    if (!cloudAutoSync || !cloudAutoReady || !token) {
      return;
    }

    if (cloudSkipNextAutoPushRef.current) {
      cloudSkipNextAutoPushRef.current = false;
      return;
    }

    if (cloudPayloadSnapshot === cloudLastSyncedSnapshotRef.current) {
      return;
    }
    if (!cloudGistId.trim() && !hasLoggedTrainingData(logs)) {
      return;
    }

    if (cloudAutoPushTimeoutRef.current !== null) {
      window.clearTimeout(cloudAutoPushTimeoutRef.current);
    }

    cloudAutoPushTimeoutRef.current = window.setTimeout(async () => {
      setCloudSyncBusy("push");
      try {
        const result = await pushBackupToGitHubGist({
          token,
          gistId: cloudGistId.trim() || undefined,
          syncLabel: ENV_CLOUD_SYNC_LABEL,
          logs,
          settings,
        });
        setCloudGistId(result.gistId);
        cloudLastSyncedSnapshotRef.current = cloudPayloadSnapshot;
        setCloudSyncFeedback(`Auto-sync saved at ${formatClockNow()} (gist ${result.gistId}).`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Auto push failed.";
        if (ENV_CLOUD_MANAGED && !ENV_CLOUD_GIST_PINNED && /\(404\)/.test(message)) {
          setCloudGistId("");
        }
        setCloudSyncFeedback(`Auto push failed: ${message}`);
      } finally {
        setCloudSyncBusy(null);
      }
    }, 1500);

    return () => {
      if (cloudAutoPushTimeoutRef.current !== null) {
        window.clearTimeout(cloudAutoPushTimeoutRef.current);
        cloudAutoPushTimeoutRef.current = null;
      }
    };
  }, [cloudAutoReady, cloudAutoSync, cloudGistId, cloudPayloadSnapshot, cloudToken, logs, settings]);

  useEffect(() => {
    const token = cloudToken.trim();
    const gistId = cloudGistId.trim();
    if (!cloudAutoSync || !cloudAutoReady || !token || !gistId) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      if (cloudBusyRef.current !== null) {
        return;
      }
      if (cloudPayloadSnapshotRef.current !== cloudLastSyncedSnapshotRef.current) {
        return;
      }

      try {
        const remote = await pullBackupFromGitHubGist({ token, gistId });
        const remoteLogs = normalizeLogs(deepClone(remote.logs));
        const remoteSettings = deepClone(remote.settings);
        const remoteSnapshot = JSON.stringify({ logs: remoteLogs, settings: remoteSettings });

        if (remoteSnapshot === cloudLastSyncedSnapshotRef.current) {
          return;
        }

        cloudSkipNextAutoPushRef.current = true;
        cloudLastSyncedSnapshotRef.current = remoteSnapshot;
        setLogs(remoteLogs);
        setSettings(remoteSettings);
        setCloudSyncFeedback(`Remote update pulled at ${formatClockNow()}.`);
      } catch {
        // Ignore background refresh errors to avoid noisy UI.
      }
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [cloudAutoReady, cloudAutoSync, cloudGistId, cloudToken]);

  const coach = useMemo(() => new AdaptiveCoach(logs, settings), [logs, settings]);
  const programmingState = useMemo(() => coach.getProgrammingState(), [coach]);

  const streak = useMemo(() => calculateStreak(logs), [logs]);
  const weeklyReview = useMemo(() => getWeeklyReview(logs), [logs]);
  const allStats = useMemo(() => coach.getAllTimeStats(), [coach]);
  const bodyHeatmap = useMemo(() => buildBodyHeatmapState(logs), [logs]);

  const [todayWorkoutName, todayExercises] = useMemo(() => getTodayWorkoutWithSettings(settings), [settings]);
  const todayTargets = useMemo(() => {
    if (todayWorkoutName === "Holiday" || todayWorkoutName === "Rest") {
      return [];
    }
    return coach.getWorkoutSummary(todayWorkoutName, todayExercises);
  }, [coach, todayExercises, todayWorkoutName]);

  const selectedWorkoutTargets = useMemo(
    () => coach.getWorkoutSummary(selectedWorkout, EXERCISES[selectedWorkout]),
    [coach, selectedWorkout],
  );

  const planText = useMemo(
    () => buildTrainingPlanText(selectedWorkout, selectedWorkoutTargets, logScheme),
    [selectedWorkout, selectedWorkoutTargets, logScheme],
  );
  const notesParsePreview = useMemo(() => parseTrainingPlanText(pastedNotes), [pastedNotes]);

  const [statusEmoji, statusName, statusMsg] = getBrainStatus();
  const weekPreview = getWeekSchedulePreview(settings);

  const progressExercises = useMemo(() => Object.keys(logs.exercises), [logs.exercises]);

  const resolvedProgressExercise = progressExercise || progressExercises[0] || "";

  const progressHistory = useMemo(() => {
    if (!resolvedProgressExercise) {
      return [];
    }

    const history = logs.exercises[resolvedProgressExercise] ?? [];
    return [...history]
      .reverse()
      .map((entry) => {
        const sets = getSessionSets(entry);
        const topWeight = getSessionTopWeight(entry);
        const avgReps = sets.length ? sets.reduce((sum, s) => sum + s.reps, 0) / sets.length : 0;
        const volume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);

        return {
          date: entry.date.slice(0, 10),
          weight: topWeight,
          avgReps: Number(avgReps.toFixed(1)),
          volume,
        };
      });
  }, [logs.exercises, resolvedProgressExercise]);


  function captureImportUndoSnapshot(source: string) {
    setLastImportUndo({
      source,
      createdAt: new Date().toISOString(),
      logs: deepClone(logs),
      settings: deepClone(settings),
    });
  }

  function handleUndoLastImport() {
    if (!lastImportUndo) {
      setWarningMessage("No import to undo.");
      return;
    }

    setLogs(normalizeLogs(deepClone(lastImportUndo.logs)));
    setSettings(deepClone(lastImportUndo.settings));
    setLastImportUndo(null);
    setSaveMessage(`Undid last import (${lastImportUndo.source}).`);
    setWarningMessage("");
  }

  async function handleCloudPushBackup() {
    setCloudSyncFeedback("");
    setWarningMessage("");
    setSaveMessage("");

    if (!cloudToken.trim()) {
      setCloudSyncFeedback("Enter a GitHub token first.");
      return;
    }

    setCloudSyncBusy("push");
    try {
      const result = await pushBackupToGitHubGist({
        token: cloudToken.trim(),
        gistId: cloudGistId.trim() || undefined,
        syncLabel: ENV_CLOUD_SYNC_LABEL,
        logs,
        settings,
      });
      setCloudGistId(result.gistId);
      cloudLastSyncedSnapshotRef.current = cloudPayloadSnapshot;
      setCloudSyncFeedback(`Backup pushed to gist ${result.gistId}. Open: ${result.htmlUrl}`);
      setSaveMessage("Cloud backup synced.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cloud push failed.";
      setCloudSyncFeedback(message);
    } finally {
      setCloudSyncBusy(null);
    }
  }

  async function handleCloudPullBackup() {
    setCloudSyncFeedback("");
    setWarningMessage("");
    setSaveMessage("");

    if (!cloudToken.trim() || !cloudGistId.trim()) {
      setCloudSyncFeedback("Enter both GitHub token and gist id.");
      return;
    }

    setCloudSyncBusy("pull");
    try {
      const remote = await pullBackupFromGitHubGist({
        token: cloudToken.trim(),
        gistId: cloudGistId.trim(),
      });
      const remoteLogs = normalizeLogs(deepClone(remote.logs));
      const remoteSettings = deepClone(remote.settings);
      const remoteSnapshot = JSON.stringify({ logs: remoteLogs, settings: remoteSettings });
      captureImportUndoSnapshot("Cloud pull");
      cloudSkipNextAutoPushRef.current = true;
      cloudLastSyncedSnapshotRef.current = remoteSnapshot;
      setLogs(remoteLogs);
      setSettings(remoteSettings);
      setCloudSyncFeedback(`Backup pulled from gist ${cloudGistId.trim()}.`);
      setSaveMessage("Cloud backup restored.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cloud pull failed.";
      setCloudSyncFeedback(message);
    } finally {
      setCloudSyncBusy(null);
    }
  }

  async function handleCloudCopySyncKey() {
    setCloudSyncFeedback("");
    setWarningMessage("");
    setSaveMessage("");

    try {
      const syncKey = buildGitHubSyncKey({
        token: cloudToken.trim(),
        gistId: cloudGistId.trim(),
      });
      await navigator.clipboard.writeText(syncKey);
      setCloudSyncFeedback("Sync key copied. Paste it once in your other browser.");
      setSaveMessage("Sync key copied.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to copy sync key.";
      setCloudSyncFeedback(message);
    }
  }

  function handleCloudApplySyncKey() {
    setCloudSyncFeedback("");
    setWarningMessage("");
    setSaveMessage("");

    try {
      const parsed = parseGitHubSyncKey(cloudSyncKeyInput);
      setCloudToken(parsed.token);
      setCloudGistId(parsed.gistId);
      setCloudAutoSync(true);
      setCloudSyncFeedback("Sync key applied. Auto-sync is now enabled.");
      setSaveMessage("Sync key applied.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid sync key.";
      setCloudSyncFeedback(message);
    }
  }

  function handlePasteNotesImport() {
    setWarningMessage("");
    setSaveMessage("");
    setLastSessionReview(null);

    const parsed = notesParsePreview;
    if (!parsed.entries.length) {
      setWarningMessage("No valid exercise/set lines found. Paste the exported template format.");
      return;
    }

    const parsedWorkout = safeWorkoutName(parsed.workout);
    const fromInput = /^\d{4}-\d{2}-\d{2}$/.test(pastedSessionDate) ? pastedSessionDate : "";
    const fromTemplate = parsed.date && /^\d{4}-\d{2}-\d{2}/.test(parsed.date) ? parsed.date.slice(0, 10) : "";
    const sessionDate = fromInput || fromTemplate || dateDaysAgo(0);
    const now = new Date();
    const timestamp = `${sessionDate}T${now.toTimeString().slice(0, 8)}.${String(now.getMilliseconds()).padStart(3, "0")}`;

    const nextLogs: Logs = {
      ...logs,
      exercises: { ...logs.exercises },
      workouts: [...logs.workouts],
      skippedExercises: [...logs.skippedExercises],
    };

    const prHits: string[] = [];
    const cautionSet = new Set<string>();
    const highlightSet = new Set<string>();
    let imported = 0;
    let skippedExercises = 0;
    let totalSets = 0;
    let totalVolume = 0;
    let totalRpe = 0;

    const reviewTargets = coach.getWorkoutSummary(parsedWorkout, EXERCISES[parsedWorkout]);
    const targetByExercise = new Map(reviewTargets.map((target) => [target.exercise.name, target]));

    parsed.entries.forEach((entry) => {
      if (entry.skipped) {
        skippedExercises += 1;
        nextLogs.skippedExercises.push({
          date: timestamp,
          workout: parsedWorkout,
          exercise: entry.exercise,
          reason: "notes_skip",
        });
        highlightSet.add(`${entry.exercise}: marked as skipped.`);
        return;
      }

      const filteredSets = entry.sets.filter((s) => s.weight >= 0 && s.reps > 0);
      if (!filteredSets.length) {
        skippedExercises += 1;
        return;
      }

      totalSets += filteredSets.length;
      totalVolume += filteredSets.reduce((sum, set) => sum + set.weight * set.reps, 0);
      totalRpe += filteredSets.reduce((sum, set) => sum + set.rpe, 0);

      const sessionTopWeight = Math.max(...filteredSets.map((s) => s.weight));
      const [isPr, oldPr] = checkForNewPr(entry.exercise, sessionTopWeight, nextLogs);
      const avgReps = filteredSets.reduce((sum, set) => sum + set.reps, 0) / filteredSets.length;
      const repDropoff = Math.max(...filteredSets.map((set) => set.reps)) - Math.min(...filteredSets.map((set) => set.reps));
      const avgRpe = filteredSets.reduce((sum, set) => sum + set.rpe, 0) / filteredSets.length;

      const target = targetByExercise.get(entry.exercise);
      if (target) {
        if (sessionTopWeight >= target.weight && avgReps >= target.repsPerSet) {
          highlightSet.add(`${entry.exercise}: target met or exceeded.`);
        } else if (sessionTopWeight < target.weight && avgReps < target.repsPerSet - 1) {
          cautionSet.add(`${entry.exercise}: below both load and reps target.`);
        }
      }

      if (repDropoff >= 4) {
        cautionSet.add(`${entry.exercise}: large rep dropoff (${repDropoff}).`);
      }
      if (avgRpe >= 9.5) {
        cautionSet.add(`${entry.exercise}: very high average RPE (${avgRpe.toFixed(1)}).`);
      }

      const logEntry = {
        date: timestamp,
        workout: parsedWorkout,
        weight: sessionTopWeight,
        sets: filteredSets,
        notes: entry.notes,
      };

      if (!nextLogs.exercises[entry.exercise]) {
        nextLogs.exercises[entry.exercise] = [];
      }

      nextLogs.exercises[entry.exercise].unshift(logEntry);
      nextLogs.workouts.push({
        date: timestamp,
        workoutType: parsedWorkout,
        exercise: entry.exercise,
        data: logEntry,
      });

      if (isPr && sessionTopWeight > oldPr) {
        prHits.push(`${entry.exercise}: ${sessionTopWeight}kg (+${(sessionTopWeight - oldPr).toFixed(1)}kg)`);
      }

      imported += 1;
    });

    if (!imported) {
      if (skippedExercises > 0) {
        captureImportUndoSnapshot("Notes import (skips only)");
        setLogs(nextLogs);
        setWarningMessage(`Only skipped exercises detected (${skippedExercises}). No sets were imported.`);
        setSaveMessage(`Logged ${skippedExercises} skipped exercise(s) for ${sessionDate}.`);
      } else {
        setWarningMessage("Template parsed, but no sets with valid numbers were found.");
      }
      return;
    }

    captureImportUndoSnapshot("Notes import");
    setLogs(nextLogs);
    setPastedNotes("");
    const avgRpe = totalSets ? totalRpe / totalSets : 0;
    setLastSessionReview({
      importedExercises: imported,
      skippedExercises,
      totalSets,
      totalVolume,
      avgRpe,
      prHits,
      highlights: [...highlightSet].slice(0, 6),
      cautions: [...cautionSet].slice(0, 6),
    });

    const messages = [`Imported ${imported} exercise entries from pasted notes (${sessionDate}).`];
    if (skippedExercises > 0) {
      messages.push(`Skipped exercises: ${skippedExercises}`);
    }
    if (prHits.length) {
      messages.push(`PRs: ${prHits.join(" | ")}`);
    }
    setSaveMessage(messages.join("\n"));
  }

  function handleCopyPlan() {
    if (!planText) {
      return;
    }

    navigator.clipboard
      .writeText(planText)
      .then(() => {
        setPlanCopied(true);
        window.setTimeout(() => setPlanCopied(false), 1800);
      })
      .catch(() => {
        setWarningMessage("Clipboard copy failed. You can still copy from the text area manually.");
      });
  }

  function handleToggleHoliday() {
    if (settings.holidayMode) {
      setSettings({ ...settings, holidayMode: false, holidayStart: null });
      return;
    }
    setSettings({ ...settings, holidayMode: true, holidayStart: new Date().toISOString() });
  }

  function handlePushDay() {
    if (todayWorkoutName === "Holiday" || todayWorkoutName === "Rest") {
      return;
    }

    const skipEntry = {
      date: new Date().toISOString(),
      workout: todayWorkoutName,
      action: "push" as const,
    };

    setLogs((prev) => ({
      ...prev,
      skippedSessions: [...prev.skippedSessions, skipEntry],
    }));

    setSettings((prev) => ({
      ...prev,
      scheduleOffset: prev.scheduleOffset + 1,
    }));
  }

  function handleSkipOnly() {
    if (todayWorkoutName === "Holiday" || todayWorkoutName === "Rest") {
      return;
    }

    const skipEntry = {
      date: new Date().toISOString(),
      workout: todayWorkoutName,
      action: "skip" as const,
    };

    setLogs((prev) => ({
      ...prev,
      skippedSessions: [...prev.skippedSessions, skipEntry],
    }));
  }

  function handleSaveMeasurement() {
    const entry: MeasurementEntry = {
      date: new Date().toISOString().slice(0, 10),
      bodyWeight: measureBodyWeight,
      leftThigh: measureLeftThigh,
      rightThigh: measureRightThigh,
      leftCalf: measureLeftCalf,
      rightCalf: measureRightCalf,
      notes: measureNotes,
    };

    setLogs((prev) => ({
      ...prev,
      measurements: [...prev.measurements, entry],
    }));

    setSaveMessage("Measurements saved.");
    setMeasureNotes("");
  }

  function handleDownloadWorkoutsCsv() {
    downloadTextFile("neurolegs_workouts.csv", exportLogsToCsv(logs), "text/csv;charset=utf-8");
  }

  function handleDownloadMeasurementsCsv() {
    downloadTextFile("neurolegs_measurements.csv", exportMeasurementsToCsv(logs), "text/csv;charset=utf-8");
  }

  function handleCsvFilePicked(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      const result = importCsvToLogs(content, logs);

      if (result.count > 0) {
        captureImportUndoSnapshot("CSV import");
        setLogs(normalizeLogs(result.logs));
        setCsvImportFeedback(`Imported ${result.count} entries.`);
        setSaveMessage("CSV import completed.");
        setWarningMessage("");
      } else {
        setCsvImportFeedback("Import failed. Check CSV format.");
      }
    };

    reader.onerror = () => {
      setCsvImportFeedback("Could not read the selected file.");
    };

    reader.readAsText(file);
    event.target.value = "";
  }

  function handleStreamlitSpreadsheetPicked(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result;
        if (!(buffer instanceof ArrayBuffer)) {
          setXlsxImportFeedback("Import failed: could not read spreadsheet bytes.");
          return;
        }

        const result = importStreamlitSpreadsheet(buffer, logs, settings);
        captureImportUndoSnapshot("Streamlit spreadsheet import");
        setLogs(normalizeLogs(result.logs));
        setSettings(result.settings);

        const [todayWorkout] = getTodayWorkoutWithSettings(result.settings);
        if (todayWorkout !== "Holiday" && todayWorkout !== "Rest") {
          setSelectedWorkout(todayWorkout);
        }

        const parts = [
          `Workouts: +${result.summary.workoutsImported}`,
          `Duplicates skipped: ${result.summary.workoutsSkippedAsDuplicate}`,
          `Skipped sessions: +${result.summary.skippedSessionsImported}`,
          `Measurements: +${result.summary.measurementsImported}`,
        ];
        if (result.summary.settingsImported) {
          parts.push("Settings imported");
        }

        setXlsxImportFeedback(parts.join(" | "));
        setSaveMessage("Streamlit spreadsheet imported successfully.");
        setWarningMessage("");
      } catch {
        setXlsxImportFeedback("Import failed. Make sure this file comes from the Streamlit Google Sheet export.");
      }
    };

    reader.onerror = () => {
      setXlsxImportFeedback("Could not read the selected spreadsheet.");
    };

    reader.readAsArrayBuffer(file);
    event.target.value = "";
  }

  function handleResetSchedule() {
    setSettings((prev) => ({ ...prev, scheduleOffset: 0 }));
  }

  function handleResetAllData() {
    const confirmed = window.confirm("This will erase all local logs/settings for this app. Continue?");
    if (!confirmed) {
      return;
    }
    const resetLogs = emptyLogs();
    setLogs(resetLogs);
    setSettings(DEFAULT_SETTINGS);
    setSelectedWorkout(WORKOUT_NAMES[0]);
    setLogScheme("Top Set + Back-off");
    setProgressExercise("");
    setSaveMessage("All local data reset.");
  }

  function renderTodayTab() {
    if (settings.holidayMode) {
      return <p className="pill note">Holiday mode is active. Training is frozen until you deactivate it.</p>;
    }

    if (todayWorkoutName === "Rest") {
      const [nextWorkout, nextDay, daysUntil] = getNextTrainingDay(settings);
      return (
        <section className="stack">
          <h3 className="section-title">Rest Day</h3>
          <p className="pill">Recovery is where growth happens. Walk, hydrate, and sleep hard.</p>
          <p className="pill warm">Next: {nextWorkout} on {nextDay} ({daysUntil} day{daysUntil > 1 ? "s" : ""})</p>
        </section>
      );
    }

    return (
      <section className="stack">
        <div className="panel-row">
          <button className="button subtle" onClick={handlePushDay}>Push +1 day</button>
          <button className="button subtle" onClick={handleSkipOnly}>Skip only</button>
        </div>

        <article className="card">
          <div className="card-header">
            <h3>System State</h3>
            <span className="badge accent">v2</span>
          </div>
          <div className="quick-grid">
            <Stat label="Wave Week" value={`${programmingState.wave.week}`} hint={programmingState.wave.isPivotWeek ? "Pivot" : "Build"} />
            <Stat label="Fatigue" value={programmingState.fatigue.zone} hint={`Score ${programmingState.fatigue.score.toFixed(1)}`} />
            <Stat
              label="Bodyweight Ref"
              value={`${programmingState.bodyweightStatus.bodyWeight.toFixed(1)}kg`}
              hint={
                programmingState.bodyweightStatus.staleDays === null
                  ? "Profile fallback"
                  : `${programmingState.bodyweightStatus.staleDays}d old`
              }
            />
          </div>
          {programmingState.wave.notes.length ? (
            <ul className="simple-list">
              {programmingState.wave.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </article>

        <article className="card">
          <div className="card-header">
            <h3>{todayWorkoutName}</h3>
            <span className="badge accent">{todayExercises.length} exercises</span>
          </div>
          <p className="muted">Use the Log tab to copy your Notes template before gym, then paste it back after training.</p>
        </article>

        {todayTargets.map((target) => (
          <article key={target.exercise.name} className="exercise-card">
            <div className="card-header">
              <a href={target.exercise.video} target="_blank" rel="noreferrer" className="exercise-link">
                {target.exercise.name}
              </a>
              <span className="badge">{formatRecommendationBadge(target.recommendation)}</span>
            </div>

            <div className="quick-grid">
              <Stat label="Top Set" value={`${target.weight}kg x ${target.repsPerSet}`} />
              <Stat
                label="Back-off"
                value={`${target.backoffWeight}kg x ${target.backoffReps}`}
                hint={`${Math.round((target.backoffPercent ?? BACKOFF_PERCENT) * 100)}% • ${target.prescribedSets ?? target.exercise.sets} sets`}
              />
              <Stat label="Rest" value={target.exercise.rest} />
            </div>

            <p className="muted">{target.message}</p>
            {target.trendInfo?.hasData ? (
              <p className="pill note">
                Trend: {formatTrendBadge(target.trendInfo.trend)} {target.trendInfo.trend}
              </p>
            ) : null}
            {target.backoffNote ? <p className="pill warm">{target.backoffNote}</p> : null}
            {target.previous ? <p className="pill">{target.previous}</p> : null}
            {target.suggestedExtraSets ? <p className="pill warm">Volume boost: +1 extra back-off set if fresh.</p> : null}
            {target.adjustmentReasons?.length ? (
              <ul className="simple-list">
                {target.adjustmentReasons.map((reason) => (
                  <li key={`${target.exercise.name}-${reason}`}>{reason}</li>
                ))}
              </ul>
            ) : null}

            {target.weight >= 30 ? (
              <div className="warmup">
                <p className="field-label">Warm-up</p>
                <ul>
                  {generateWarmupSets(target.weight, target.repsPerSet).map((set, i) => (
                    <li key={`${target.exercise.name}-${i}`}>{set.weight}kg x {set.reps} - {set.notes}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    );
  }

  function renderLogTab() {
    const diagnostics = notesParsePreview.diagnostics;
    const hasPastedText = pastedNotes.trim().length > 0;
    const parsedExercises = notesParsePreview.entries.length;
    const ignoredLines = diagnostics?.ignoredLines.length ?? 0;
    const parseLooksGood = hasPastedText && parsedExercises > 0 && ignoredLines === 0;
    const parsePartiallyGood = hasPastedText && parsedExercises > 0 && ignoredLines > 0;

    return (
      <section className="stack">
        <article className="card">
          <div className="card-header">
            <h3>Gym Notes Sync</h3>
            <select className="select" value={selectedWorkout} onChange={(e) => setSelectedWorkout(safeWorkoutName(e.target.value))}>
              {WORKOUT_NAMES.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          <p className="muted">Before gym: copy this plan and paste it into iPhone Notes. After gym: paste your edited note below to import.</p>

          <div className="chip-row">
            {(["Top Set + Back-off", "Straight Sets"] as SessionScheme[]).map((scheme) => (
              <button
                key={scheme}
                className={`chip ${logScheme === scheme ? "active" : ""}`}
                onClick={() => setLogScheme(scheme)}
              >
                {scheme}
              </button>
            ))}
          </div>

          <textarea className="textarea" rows={16} value={planText} readOnly />

          <div className="panel-row">
            <button className="button" onClick={handleCopyPlan}>Copy Plan</button>
            <button className="button subtle" onClick={() => downloadTextFile(`plan-${new Date().toISOString().slice(0, 10)}.txt`, planText)}>Download .txt</button>
            {planCopied ? <span className="pill success">Copied</span> : null}
          </div>
        </article>

        <article className="card">
          <h3>Session Change Overview</h3>
          <p className="muted">Visual comparison vs your last session for each exercise, plus why the app made the move.</p>
          <div className="stack compact">
            {selectedWorkoutTargets.map((target) => (
              <article key={target.exercise.name} className="exercise-card change-card">
                {(() => {
                  const lastSession = coach.getExerciseHistory(target.exercise.name, 1)[0];
                  const lastSets = lastSession ? getSessionSets(lastSession) : [];
                  const lastWeight = lastSession ? getSessionTopWeight(lastSession) : null;
                  const lastAvgReps = lastSets.length
                    ? lastSets.reduce((sum, set) => sum + set.reps, 0) / lastSets.length
                    : null;
                  const lastComparableReps = lastAvgReps === null ? null : Math.round(lastAvgReps);
                  const daysSinceLast = coach.getDaysSinceLastSession(target.exercise.name);

                  const weightDelta = lastWeight === null ? null : target.weight - lastWeight;
                  const repsDelta = lastComparableReps === null ? null : target.repsPerSet - lastComparableReps;

                  const weightTone = getDeltaTone(weightDelta);
                  const repsTone = getDeltaTone(repsDelta);

                  const weightDeltaLabel =
                    weightDelta === null ? "New" : `${formatSigned(weightDelta)} kg`;
                  const repsDeltaLabel =
                    repsDelta === null ? "New" : `${formatSigned(repsDelta)} reps`;

                  const reason = target.message.endsWith(".") ? target.message : `${target.message}.`;
                  const reasonSuffix = target.adjustmentReasons?.length
                    ? ` ${target.adjustmentReasons.slice(0, 2).join(" ")}`
                    : "";

                  return (
                    <>
                      <div className="card-header">
                        <a href={target.exercise.video} target="_blank" rel="noreferrer" className="exercise-link">
                          {target.exercise.name}
                        </a>
                        <span className="badge">{formatRecommendationBadge(target.recommendation)}</span>
                      </div>

                      <div className="quick-grid">
                        <Stat
                          label="Last Session"
                          value={
                            lastWeight === null || lastComparableReps === null
                              ? "No history"
                              : `${lastWeight}kg x ${lastComparableReps}`
                          }
                          hint={
                            daysSinceLast === null
                              ? "First time"
                              : `${daysSinceLast} day${daysSinceLast > 1 ? "s" : ""} ago`
                          }
                        />
                        <Stat label="Next Target" value={`${target.weight}kg x ${target.repsPerSet}`} />
                        <Stat label="Back-off" value={`${target.backoffWeight}kg x ${target.backoffReps}`} />
                      </div>

                      <div className="delta-row">
                        <span className={`delta-chip ${weightTone}`}>
                          {weightTone === "up" ? "▲" : weightTone === "down" ? "▼" : weightTone === "flat" ? "•" : "◦"} Weight {weightDeltaLabel}
                        </span>
                        <span className={`delta-chip ${repsTone}`}>
                          {repsTone === "up" ? "▲" : repsTone === "down" ? "▼" : repsTone === "flat" ? "•" : "◦"} Reps {repsDeltaLabel}
                        </span>
                      </div>

                      <p className="reason-line"><strong>Why:</strong> {reason}{reasonSuffix}</p>
                    </>
                  );
                })()}
              </article>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>Paste Completed Notes</h3>
          <p className="muted">Paste your edited iPhone Notes template here. To skip an exercise, write `SKIP` under that exercise block.</p>
          <label className="field-label" htmlFor="session-date-input">Session day</label>
          <div className="panel-row">
            <input
              id="session-date-input"
              className="input"
              type="date"
              value={pastedSessionDate}
              onChange={(e) => setPastedSessionDate(e.target.value)}
            />
          </div>
          <div className="chip-row">
            <button className={`chip ${pastedSessionDate === dateDaysAgo(0) ? "active" : ""}`} onClick={() => setPastedSessionDate(dateDaysAgo(0))}>Today</button>
            <button className={`chip ${pastedSessionDate === dateDaysAgo(1) ? "active" : ""}`} onClick={() => setPastedSessionDate(dateDaysAgo(1))}>Yesterday</button>
            <button className={`chip ${pastedSessionDate === dateDaysAgo(2) ? "active" : ""}`} onClick={() => setPastedSessionDate(dateDaysAgo(2))}>2 days ago</button>
          </div>
          {parseLooksGood ? (
            <p className="pill success">
              Parse ready: {parsedExercises} exercise block(s), {diagnostics?.parsedSetLines ?? 0} set line(s), {diagnostics?.skippedExercises ?? 0} skipped.
            </p>
          ) : null}
          {parsePartiallyGood ? (
            <p className="pill warm">
              Parse partial: {parsedExercises} exercise block(s) detected, but {ignoredLines} line(s) were not understood.
            </p>
          ) : null}
          {!parseLooksGood && !parsePartiallyGood && hasPastedText ? (
            <p className="pill alert">Parse failed: no valid set lines detected yet.</p>
          ) : null}
          <textarea className="textarea" rows={12} value={pastedNotes} onChange={(e) => setPastedNotes(e.target.value)} placeholder="Paste template with updated numbers" />
          <div className="panel-row">
            <button className="button" onClick={handlePasteNotesImport}>Import From Notes</button>
            <button className="button subtle" onClick={handleUndoLastImport} disabled={!lastImportUndo}>Undo Last Import</button>
          </div>
          {lastImportUndo ? (
            <p className="pill note">Undo available for: {lastImportUndo.source} ({new Date(lastImportUndo.createdAt).toLocaleString()})</p>
          ) : null}
        </article>

        {lastSessionReview ? (
          <article className="card">
            <h3>Session Review</h3>
            <div className="quick-grid">
              <Stat label="Imported" value={`${lastSessionReview.importedExercises} exercises`} />
              <Stat label="Skipped" value={`${lastSessionReview.skippedExercises}`} />
              <Stat label="Sets" value={`${lastSessionReview.totalSets}`} />
              <Stat label="Volume" value={`${Math.round(lastSessionReview.totalVolume)}kg`} />
              <Stat label="Avg RPE" value={lastSessionReview.avgRpe.toFixed(2)} />
              <Stat label="PRs" value={`${lastSessionReview.prHits.length}`} />
            </div>
            {lastSessionReview.highlights.length ? (
              <>
                <p className="field-label">Highlights</p>
                <ul className="simple-list">
                  {lastSessionReview.highlights.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {lastSessionReview.cautions.length ? (
              <>
                <p className="field-label">Cautions</p>
                <ul className="simple-list">
                  {lastSessionReview.cautions.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </article>
        ) : null}

        <article className="card">
          <h3>PR Timeline</h3>
          {(() => {
            const events = Object.entries(logs.exercises).flatMap(([exercise, history]) => {
              const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
              let runningPr = -Infinity;
              const rows: Array<{ date: string; exercise: string; weight: number; delta: number }> = [];
              sorted.forEach((entry) => {
                const topWeight = getSessionTopWeight(entry);
                if (topWeight > runningPr) {
                  const delta = runningPr === -Infinity ? 0 : topWeight - runningPr;
                  runningPr = topWeight;
                  rows.push({ date: entry.date.slice(0, 10), exercise, weight: topWeight, delta });
                }
              });
              return rows;
            }).sort((a, b) => b.date.localeCompare(a.date));

            if (!events.length) {
              return <p className="pill note">No PR events yet.</p>;
            }

            const badgeFor = (delta: number) => {
              if (delta >= 5) {
                return { label: `${formatSigned(delta)}kg leap`, tone: "gold" as const };
              }
              if (delta >= 2.5) {
                return { label: `${formatSigned(delta)}kg`, tone: "silver" as const };
              }
              if (delta > 0) {
                return { label: `${formatSigned(delta)}kg`, tone: "bronze" as const };
              }
              return { label: "First logged PR", tone: "neutral" as const };
            };

            return (
              <div className="timeline-wrap">
                {events.slice(0, 16).map((event, idx) => (
                  <article key={`${event.exercise}-${event.date}-${event.weight}-${idx}`} className="timeline-item">
                    {(() => {
                      const badge = badgeFor(event.delta);
                      return <span className={`timeline-badge ${badge.tone}`}>{badge.label}</span>;
                    })()}
                    <div className="timeline-content">
                      <p><strong>{event.exercise}</strong> hit {event.weight}kg</p>
                      <p className="muted">{event.date}</p>
                    </div>
                  </article>
                ))}
              </div>
            );
          })()}
        </article>
      </section>
    );
  }

  function renderProgressTab() {
    if (!progressExercises.length) {
      return <p className="pill note">No data yet. Start logging sessions.</p>;
    }

    const history = logs.exercises[resolvedProgressExercise] ?? [];
    const current = progressHistory.at(-1);
    const first = progressHistory[0];
    const pr = progressHistory.reduce((max, point) => Math.max(max, point.weight), 0);

    const latest = history[0];
    const latestSets = latest ? getSessionSets(latest) : [];
    const bestSet = latestSets.length
      ? [...latestSets].sort((a, b) => estimateE1rm(b.weight, b.reps, b.rpe) - estimateE1rm(a.weight, a.reps, a.rpe))[0]
      : null;
    const est1rm = bestSet ? estimateE1rm(bestSet.weight, bestSet.reps, bestSet.rpe) : 0;

    return (
      <section className="stack">
        <article className="card">
          <div className="card-header">
            <h3>Exercise Progress</h3>
            <select className="select" value={resolvedProgressExercise} onChange={(e) => setProgressExercise(e.target.value)}>
              {progressExercises.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="quick-grid">
            <Stat label="Current" value={`${current?.weight ?? 0}kg`} hint={first ? `+${(current?.weight ?? 0) - first.weight}kg` : undefined} />
            <Stat label="PR" value={`${pr}kg`} />
            <Stat label="Sessions" value={`${history.length}`} />
          </div>

          <div className="chart-box">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={progressHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="weight" stroke="#0d9488" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {bestSet ? (
            <p className="pill warm">
              Estimated 1RM: {est1rm.toFixed(1)}kg (best set {bestSet.weight}kg x {bestSet.reps} @ {bestSet.rpe})
            </p>
          ) : null}
        </article>
      </section>
    );
  }

  function renderAnalyticsTab() {
    if (!allStats) {
      return <p className="pill note">No data yet.</p>;
    }

    const recent = weeklyReview.recent;
    const previous = weeklyReview.previous;
    const hasPrevious = previous.sessions > 0;

    return (
      <section className="stack">
        <article className="card">
          <h3>Training Consistency</h3>
          <div className="quick-grid">
            <Stat label="Current Streak" value={`${streak.currentStreakWeeks} weeks`} />
            <Stat label="Longest" value={`${streak.longestStreakWeeks} weeks`} />
            <Stat label="This Week" value={`${streak.workoutsThisWeek}/${streak.targetWorkoutsWeek}`} />
            <Stat label="Consistency" value={`${streak.consistencyPercent}%`} />
          </div>
        </article>

        <article className="card">
          <h3>Weekly Review</h3>
          {recent.sessions ? (
            <div className="quick-grid">
              <Stat label="Sessions" value={`${recent.sessions}`} hint={hasPrevious ? `${recent.sessions - previous.sessions >= 0 ? "+" : ""}${recent.sessions - previous.sessions}` : undefined} />
              <Stat label="Volume" value={`${Math.round(recent.volume)}kg`} hint={hasPrevious ? `${recent.volume - previous.volume >= 0 ? "+" : ""}${Math.round(recent.volume - previous.volume)}kg` : undefined} />
              <Stat label="Avg RPE" value={recent.avgRpe.toFixed(2)} hint={hasPrevious ? `${(recent.avgRpe - previous.avgRpe).toFixed(2)}` : undefined} />
              <Stat label="Avg e1RM" value={`${recent.avgE1rm.toFixed(1)}kg`} hint={hasPrevious ? `${(recent.avgE1rm - previous.avgE1rm).toFixed(1)}kg` : undefined} />
            </div>
          ) : (
            <p className="pill note">No sessions logged in the last 7 days.</p>
          )}
        </article>

        <article className="card">
          <div className="card-header">
            <h3>Muscle Dose (Last 7d)</h3>
            <button className="button subtle" onClick={() => setActiveTab("bodymap")}>Open Body Map</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Muscle</th>
                  <th>Effective Sets</th>
                  <th>Target</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {MUSCLE_GROUP_ORDER.map((group) => {
                  const dose = programmingState.muscleDose[group];
                  const range = MUSCLE_TARGET_RANGES[group];
                  const adjustment = programmingState.muscleAdjustments[group];
                  const status =
                    adjustment.action === "increase" ? "Below target" : adjustment.action === "decrease" ? "Above target" : "In range";
                  return (
                    <tr key={group}>
                      <td>{MUSCLE_GROUP_LABELS[group]}</td>
                      <td>{dose.toFixed(1)}</td>
                      <td>{range.min}-{range.max}</td>
                      <td>{status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card">
          <h3>All-Time Stats</h3>
          <div className="quick-grid">
            <Stat label="Sessions" value={`${allStats.totalSessions}`} />
            <Stat label="Sets" value={`${allStats.totalSets}`} />
            <Stat label="Reps" value={allStats.totalReps.toLocaleString()} />
            <Stat label="Volume" value={`${Math.round(allStats.totalVolume).toLocaleString()}kg`} />
          </div>
        </article>

        <article className="card">
          <h3>Top PRs</h3>
          <ol className="simple-list">
            {allStats.prList.slice(0, 5).map((pr, idx) => (
              <li key={pr.exercise}>
                <span>{["🥇", "🥈", "🥉", "4️⃣", "5️⃣"][idx]}</span> {pr.exercise}: {pr.weight}kg
              </li>
            ))}
          </ol>
        </article>
      </section>
    );
  }

  function renderToolsTab() {
    const percentages = calcResult ? getPercentagesFrom1rm(calcResult) : null;
    const measurements = getAllMeasurementsSorted(logs.measurements);

    return (
      <section className="stack">
        <article className="card">
          <div className="chip-row">
            {(["1RM Calculator", "Warm-up Generator", "Body Measurements"] as const).map((tool) => (
              <button key={tool} className={`chip ${toolTab === tool ? "active" : ""}`} onClick={() => setToolTab(tool)}>
                {tool}
              </button>
            ))}
          </div>

          {toolTab === "1RM Calculator" ? (
            <div className="stack compact">
              <label>
                Weight lifted (kg)
                <input className="input" type="number" value={calcWeight} min={0} step={2.5} onChange={(e) => setCalcWeight(asInputNumber(e.target.value, calcWeight))} />
              </label>
              <label>
                Reps performed
                <input className="input" type="number" value={calcReps} min={1} max={12} onChange={(e) => setCalcReps(Math.max(1, Math.min(12, Number.parseInt(e.target.value, 10) || 1)))} />
              </label>
              <button className="button" onClick={() => setCalcResult(calculate1rm(calcWeight, calcReps))}>Calculate 1RM</button>

              {calcResult ? (
                <>
                  <p className="pill success">Estimated 1RM: {calcResult.toFixed(1)}kg</p>
                  <ul className="simple-list">
                    {Object.entries(percentages ?? {}).map(([label, value]) => (
                      <li key={label}>{label}: {value}kg</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}

          {toolTab === "Warm-up Generator" ? (
            <div className="stack compact">
              <label>
                Working weight (kg)
                <input className="input" type="number" value={workingWeight} min={20} step={2.5} onChange={(e) => setWorkingWeight(asInputNumber(e.target.value, workingWeight))} />
              </label>
              <label>
                Working reps
                <input className="input" type="number" value={workingReps} min={1} max={20} onChange={(e) => setWorkingReps(Math.max(1, Math.min(20, Number.parseInt(e.target.value, 10) || 1)))} />
              </label>
              <button className="button" onClick={() => setWarmupResult(generateWarmupSets(workingWeight, workingReps))}>Generate Warm-up</button>
              {warmupResult.length ? (
                <ul className="simple-list">
                  {warmupResult.map((set, idx) => (
                    <li key={`${set.weight}-${set.reps}-${idx}`}>Set {idx + 1}: {set.weight}kg x {set.reps} - {set.notes}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {toolTab === "Body Measurements" ? (
            <div className="stack compact">
              <div className="panel-row">
                <label>
                  Body Weight (kg)
                  <input className="input" type="number" value={measureBodyWeight} min={30} max={200} onChange={(e) => setMeasureBodyWeight(asInputNumber(e.target.value, measureBodyWeight))} />
                </label>
                <label>
                  Left Thigh (cm)
                  <input className="input" type="number" value={measureLeftThigh} min={20} max={100} onChange={(e) => setMeasureLeftThigh(asInputNumber(e.target.value, measureLeftThigh))} />
                </label>
                <label>
                  Right Thigh (cm)
                  <input className="input" type="number" value={measureRightThigh} min={20} max={100} onChange={(e) => setMeasureRightThigh(asInputNumber(e.target.value, measureRightThigh))} />
                </label>
              </div>

              <div className="panel-row">
                <label>
                  Left Calf (cm)
                  <input className="input" type="number" value={measureLeftCalf} min={20} max={60} onChange={(e) => setMeasureLeftCalf(asInputNumber(e.target.value, measureLeftCalf))} />
                </label>
                <label>
                  Right Calf (cm)
                  <input className="input" type="number" value={measureRightCalf} min={20} max={60} onChange={(e) => setMeasureRightCalf(asInputNumber(e.target.value, measureRightCalf))} />
                </label>
                <label>
                  Notes
                  <input className="input" value={measureNotes} onChange={(e) => setMeasureNotes(e.target.value)} placeholder="Morning, relaxed" />
                </label>
              </div>

              <button className="button" onClick={handleSaveMeasurement}>Save Measurements</button>

              {measurements.length ? (
                <>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>BW</th>
                          <th>L Thigh</th>
                          <th>R Thigh</th>
                          <th>L Calf</th>
                          <th>R Calf</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {measurements.map((m, idx) => (
                          <tr key={`${m.date}-${idx}`}>
                            <td>{m.date}</td>
                            <td>{m.bodyWeight}</td>
                            <td>{m.leftThigh}</td>
                            <td>{m.rightThigh}</td>
                            <td>{m.leftCalf}</td>
                            <td>{m.rightCalf}</td>
                            <td>{m.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {measurements.length > 1 ? (
                    <div className="chart-box">
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={measurements}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="leftThigh" name="Left Thigh" stroke="#e11d48" strokeWidth={2} />
                          <Line type="monotone" dataKey="rightThigh" name="Right Thigh" stroke="#0f766e" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </article>
      </section>
    );
  }

  function renderBodyMapTab() {
    return <BodyMapTab heatmap={bodyHeatmap} />;
  }

  function renderProgressionTab() {
    return (
      <section className="stack">
        <article className="card">
          <h3>Progression System</h3>
          <div className="quick-grid">
            <Stat label="Target RPE" value={TARGET_RPE.toFixed(1)} />
            <Stat label="Back-off" value={`${Math.round(BACKOFF_PERCENT * 100)}%`} />
            <Stat label="Compound Jump" value="+2.5kg" />
            <Stat label="Isolation Jump" value="+1.25kg" />
          </div>

          <ul className="simple-list">
            <li>Add load when top sets hit upper rep range at manageable RPE.</li>
            <li>If near top range, hold load and push reps first.</li>
            <li>If reps crash or RPE spikes, consolidate or deload.</li>
            <li>Back-off load auto-adjusts between 80% and 95% based on quality.</li>
            <li>Long breaks trigger return phases with automatic deloads.</li>
          </ul>
        </article>
      </section>
    );
  }

  function renderSettingsTab() {
    const cloudFeedbackIsError = /failed|error|invalid|no backup|enter|required|missing|unable/i.test(cloudSyncFeedback);

    return (
      <section className="stack">
        <article className="card">
          <h3>Holiday Mode</h3>
          <p className="muted">Freeze the schedule while traveling or on breaks.</p>
          <button className="button" onClick={handleToggleHoliday}>{settings.holidayMode ? "Deactivate Holiday" : "Activate Holiday"}</button>
        </article>

        <article className="card">
          <h3>Data Export / Import</h3>
          <div className="panel-row">
            <button className="button subtle" onClick={handleDownloadWorkoutsCsv}>Download Workouts CSV</button>
            <button className="button subtle" onClick={handleDownloadMeasurementsCsv}>Download Measurements CSV</button>
          </div>

          <label className="field-label" htmlFor="streamlit-xlsx-upload">Import Streamlit Spreadsheet (.xlsx)</label>
          <input
            id="streamlit-xlsx-upload"
            type="file"
            accept=".xlsx,.xlsm,.xls"
            onChange={handleStreamlitSpreadsheetPicked}
          />
          {xlsxImportFeedback ? <p className="pill note">{xlsxImportFeedback}</p> : null}

          <label className="field-label" htmlFor="csv-upload">Import CSV</label>
          <input id="csv-upload" type="file" accept=".csv" onChange={handleCsvFilePicked} />
          {csvImportFeedback ? <p className="pill note">{csvImportFeedback}</p> : null}

          <div className="panel-row">
            <button className="button subtle" onClick={handleUndoLastImport} disabled={!lastImportUndo}>Undo Last Import</button>
          </div>
          {lastImportUndo ? (
            <p className="pill note">Undo ready: {lastImportUndo.source} ({new Date(lastImportUndo.createdAt).toLocaleString()})</p>
          ) : (
            <p className="muted">No import snapshot available yet.</p>
          )}
        </article>

        <article className="card">
          <h3>GitHub Sync Database</h3>
          <p className="muted">Use one private GitHub Gist as your database so all browsers stay synced.</p>

          {ENV_CLOUD_MANAGED ? (
            <>
              <p className="pill note">Zero-input mode is active from environment config.</p>
              <p className="hint">Sync label: {ENV_CLOUD_SYNC_LABEL}</p>
              <p className="hint">
                {cloudGistId.trim() ? `Connected gist: ${cloudGistId.trim()}` : "Gist id will be auto-discovered or auto-created."}
              </p>
            </>
          ) : (
            <>
              <label className="field-label" htmlFor="cloud-token-input">GitHub token (gist scope)</label>
              <input
                id="cloud-token-input"
                className="input"
                type="password"
                value={cloudToken}
                onChange={(e) => setCloudToken(e.target.value)}
                placeholder="ghp_..."
              />
              <p className="hint">Stored locally on this browser for automatic sync.</p>

              <label className="field-label" htmlFor="cloud-gist-id-input">Gist ID</label>
              <input
                id="cloud-gist-id-input"
                className="input"
                value={cloudGistId}
                onChange={(e) => setCloudGistId(e.target.value.trim())}
                placeholder="Auto-created on first push"
              />

              <label className="inline-check" htmlFor="cloud-auto-sync">
                <input
                  id="cloud-auto-sync"
                  type="checkbox"
                  checked={cloudAutoSync}
                  onChange={(e) => setCloudAutoSync(e.target.checked)}
                />
                Enable automatic pull/push sync
              </label>
              <p className="hint">When enabled, this browser pushes your changes and pulls remote updates every 30s.</p>
            </>
          )}

          <div className="panel-row">
            <button className="button" onClick={handleCloudPushBackup} disabled={cloudSyncBusy !== null}>
              {cloudSyncBusy === "push" ? "Pushing..." : "Push Backup"}
            </button>
            <button
              className="button subtle"
              onClick={handleCloudPullBackup}
              disabled={cloudSyncBusy !== null || !cloudGistId.trim()}
            >
              {cloudSyncBusy === "pull" ? "Pulling..." : "Pull Backup"}
            </button>
            <button
              className="button subtle"
              onClick={handleCloudCopySyncKey}
              disabled={!cloudToken.trim() || !cloudGistId.trim()}
            >
              Copy Sync Key
            </button>
          </div>

          {ENV_CLOUD_MANAGED ? null : (
            <>
              <label className="field-label" htmlFor="cloud-sync-key-input">Paste Sync Key (other browser)</label>
              <div className="panel-row">
                <input
                  id="cloud-sync-key-input"
                  className="input"
                  value={cloudSyncKeyInput}
                  onChange={(e) => setCloudSyncKeyInput(e.target.value)}
                  placeholder="neurolegs-sync-v1:..."
                />
                <button className="button subtle" onClick={handleCloudApplySyncKey} disabled={!cloudSyncKeyInput.trim()}>
                  Apply Key
                </button>
              </div>
            </>
          )}

          {cloudSyncFeedback ? <p className={`pill ${cloudFeedbackIsError ? "alert" : "note"}`}>{cloudSyncFeedback}</p> : null}
        </article>

        {settings.scheduleOffset > 0 ? (
          <article className="card">
            <h3>Schedule Offset</h3>
            <p className="pill">Current offset: {settings.scheduleOffset} day(s)</p>
            <button className="button subtle" onClick={handleResetSchedule}>Reset Schedule</button>
          </article>
        ) : null}

        <article className="card">
          <h3>Meal Plan</h3>
          <select
            className="select"
            value={settings.mealPlan}
            onChange={(e) => setSettings((prev) => ({ ...prev, mealPlan: e.target.value }))}
          >
            {Object.keys(MEAL_PLANS).map((plan) => (
              <option key={plan} value={plan}>{plan}</option>
            ))}
          </select>
        </article>

        <article className="card danger">
          <h3>Data Reset</h3>
          <p className="muted">Deletes all local workouts, measurements, and settings for this Vite app only.</p>
          <button className="button danger" onClick={handleResetAllData}>Reset Local Data</button>
        </article>

        <article className="card">
          <h3>Data Stats</h3>
          <div className="quick-grid">
            <Stat label="Exercises" value={`${Object.keys(logs.exercises).length}`} />
            <Stat label="Workouts" value={`${logs.workouts.length}`} />
            <Stat label="Measurements" value={`${logs.measurements.length}`} />
          </div>
        </article>
      </section>
    );
  }

  function renderLibraryTab() {
    const allExercises = logs.exercises;
    const allNames = Object.keys(allExercises);

    if (!allNames.length) {
      return <p className="pill note">No exercise history yet. Start logging sessions.</p>;
    }

    const items = allNames
      .map((name) => {
        const history = allExercises[name] ?? [];
        const daysGap = coach.getDaysSinceLastSession(name) ?? 9999;
        const bestWeight = history.length ? Math.max(...history.map((entry) => getSessionTopWeight(entry))) : 0;
        const lastSession = history[0];

        return {
          name,
          history,
          daysGap,
          sessions: history.length,
          bestWeight,
          lastWeight: lastSession ? getSessionTopWeight(lastSession) : 0,
          lastSession,
        };
      })
      .filter((item) => {
        if (libraryFilter === "Active Only") {
          return item.daysGap <= 14;
        }
        if (libraryFilter === "Inactive Only") {
          return item.daysGap > 14;
        }
        return true;
      })
      .sort((a, b) => a.daysGap - b.daysGap);

    const activeCount = allNames.filter((name) => {
      const days = coach.getDaysSinceLastSession(name);
      return days !== null && days <= 14;
    }).length;

    const inactiveCount = allNames.length - activeCount;

    return (
      <section className="stack">
        <article className="card">
          <h3>Exercise Library</h3>
          <div className="quick-grid">
            <Stat label="Total" value={`${allNames.length}`} />
            <Stat label="Active (<14d)" value={`${activeCount}`} />
            <Stat label="Inactive" value={`${inactiveCount}`} />
          </div>

          <div className="chip-row">
            {(["All", "Active Only", "Inactive Only"] as const).map((option) => (
              <button key={option} className={`chip ${libraryFilter === option ? "active" : ""}`} onClick={() => setLibraryFilter(option)}>
                {option}
              </button>
            ))}
          </div>

          <div className="stack compact">
            {items.map((item) => {
              let status = "Unknown";
              let statusClass = "";

              if (item.daysGap <= 14) {
                status = `Active (${item.daysGap}d ago)`;
                statusClass = "ok";
              } else if (item.daysGap <= 28) {
                status = `Recent (${item.daysGap}d ago)`;
                statusClass = "warn";
              } else if (item.daysGap <= 56) {
                status = `Inactive (${item.daysGap}d)`;
                statusClass = "alert";
              } else if (item.daysGap < 9999) {
                status = `Long break (${item.daysGap}d)`;
                statusClass = "danger";
              }

              const [deloadFactor, phase, phaseMsg] = coach.getReturnDeloadFactor(item.daysGap);
              const returnWeight = Math.round((item.lastWeight * deloadFactor) / 2.5) * 2.5;
              const deloadPct = Math.round((1 - deloadFactor) * 100);

              return (
                <article key={item.name} className="exercise-card">
                  <div className="card-header">
                    <h4>{item.name}</h4>
                    <span className={`badge ${statusClass}`}>{status}</span>
                  </div>

                  <div className="quick-grid">
                    <Stat label="Last Weight" value={`${item.lastWeight}kg`} />
                    <Stat label="PR" value={`${item.bestWeight}kg`} />
                    <Stat label="Sessions" value={`${item.sessions}`} />
                  </div>

                  {item.daysGap > 14 && item.daysGap < 9999 ? (
                    <p className="pill warm">
                      Return recommendation: {returnWeight}kg ({deloadPct}% deload) - {phase} - {phaseMsg}
                    </p>
                  ) : null}

                  {item.lastSession ? (
                    <p className="muted">
                      Last: {item.lastWeight}kg x [{item.lastSession.sets.map((set) => set.reps).join(", ")}] @ [{item.lastSession.sets.map((set) => set.rpe.toFixed(1)).join(", ")}]
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </article>
      </section>
    );
  }

  function renderActiveTab() {
    switch (activeTab) {
      case "today":
        return renderTodayTab();
      case "log":
        return renderLogTab();
      case "progress":
        return renderProgressTab();
      case "analytics":
        return renderAnalyticsTab();
      case "bodymap":
        return renderBodyMapTab();
      case "tools":
        return renderToolsTab();
      case "progression":
        return renderProgressionTab();
      case "settings":
        return renderSettingsTab();
      case "library":
        return renderLibraryTab();
      default:
        return null;
    }
  }

  return (
    <main className={`app-shell ${settings.holidayMode ? "holiday" : ""}`}>
      <header className="hero">
        <div>
          <p className="hero-kicker">{statusEmoji} {statusName}</p>
          <h1>{APP_TITLE}</h1>
          <p className="muted">{statusMsg}</p>
        </div>
        <div className="hero-stats">
          <Stat label="Streak" value={`${streak.currentStreakWeeks}w`} />
        </div>
      </header>

      <section className="week-strip">
        {weekPreview.map((day) => (
          <article key={`${day.day}-${day.workout}`} className={`day-pill ${day.isToday ? "today" : ""}`}>
            <p>{day.day}</p>
            <p>{day.workout === "Rest" ? "😴" : day.workout}</p>
          </article>
        ))}
      </section>

      <nav className="tabs" aria-label="Main navigation">
        {TAB_ITEMS.map((tab) => (
          <button key={tab.id} className={`tab ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {warningMessage ? <p className="pill alert">{warningMessage}</p> : null}
      {saveMessage ? <p className="pill success">{saveMessage}</p> : null}

      {renderActiveTab()}

      <footer className="footer">
        <p>NeuroLegs Vite local | {formatClockNow()}</p>
      </footer>
    </main>
  );
}

export default App;
