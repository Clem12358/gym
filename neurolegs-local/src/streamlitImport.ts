import * as XLSX from "xlsx";
import { normalizeLogs } from "./engine";
import type { Logs, SetLog, Settings, WorkoutEntry } from "./types";

type ImportSummary = {
  workoutsImported: number;
  workoutsSkippedAsDuplicate: number;
  skippedSessionsImported: number;
  measurementsImported: number;
  settingsImported: boolean;
};

type ImportResult = {
  logs: Logs;
  settings: Settings;
  summary: ImportSummary;
};

function str(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number.parseFloat(str(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseSets(raw: unknown, fallbackWeight: number): SetLog[] {
  const setsRaw = str(raw);
  if (!setsRaw) {
    return [];
  }

  try {
    const parsed = JSON.parse(setsRaw) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((set) => ({
      reps: Math.max(0, Math.round(num(set.reps, 0))),
      rpe: Math.max(5, Math.min(10, num(set.rpe, 8))),
      weight: num(set.weight, fallbackWeight),
    }));
  } catch {
    return [];
  }
}

function workoutKey(exercise: string, entry: WorkoutEntry): string {
  return [exercise, entry.date, entry.workout, JSON.stringify(entry.sets), entry.notes].join("||");
}

function measurementKey(m: {
  date: string;
  bodyWeight: number;
  leftThigh: number;
  rightThigh: number;
  leftCalf: number;
  rightCalf: number;
  notes: string;
}): string {
  return [m.date, m.bodyWeight, m.leftThigh, m.rightThigh, m.leftCalf, m.rightCalf, m.notes].join("||");
}

function readLegacyLogsFallback(workbook: XLSX.WorkBook): Array<{ exercise: string; entry: WorkoutEntry }> {
  const sheet = workbook.Sheets.logs;
  if (!sheet) {
    return [];
  }

  const a1 = sheet.A1?.v;
  if (!a1) {
    return [];
  }

  try {
    const parsed = JSON.parse(String(a1)) as {
      exercises?: Record<string, WorkoutEntry[]>;
    };

    const imported: Array<{ exercise: string; entry: WorkoutEntry }> = [];
    const exercises = parsed.exercises ?? {};

    Object.entries(exercises).forEach(([exercise, history]) => {
      history.forEach((entry) => {
        imported.push({
          exercise,
          entry: {
            date: str(entry.date),
            workout: str(entry.workout),
            weight: num(entry.weight, 0),
            sets: (entry.sets ?? []).map((set) => ({
              reps: Math.max(0, Math.round(num(set.reps, 0))),
              rpe: Math.max(5, Math.min(10, num(set.rpe, 8))),
              weight: num(set.weight, num(entry.weight, 0)),
            })),
            notes: str(entry.notes),
          },
        });
      });
    });

    return imported;
  } catch {
    return [];
  }
}

export function importStreamlitSpreadsheet(
  arrayBuffer: ArrayBuffer,
  baseLogs: Logs,
  baseSettings: Settings,
): ImportResult {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  const nextLogs: Logs = {
    ...baseLogs,
    workouts: [...baseLogs.workouts],
    exercises: Object.fromEntries(
      Object.entries(baseLogs.exercises).map(([name, history]) => [name, [...history]]),
    ),
    skippedSessions: [...baseLogs.skippedSessions],
    skippedExercises: [...baseLogs.skippedExercises],
    measurements: [...baseLogs.measurements],
  };

  const summary: ImportSummary = {
    workoutsImported: 0,
    workoutsSkippedAsDuplicate: 0,
    skippedSessionsImported: 0,
    measurementsImported: 0,
    settingsImported: false,
  };

  const existingWorkoutKeys = new Set<string>();
  Object.entries(nextLogs.exercises).forEach(([exercise, history]) => {
    history.forEach((entry) => {
      existingWorkoutKeys.add(workoutKey(exercise, entry));
    });
  });

  const workoutSheet = workbook.Sheets.workout_logs;
  const workoutRows = workoutSheet
    ? XLSX.utils.sheet_to_json<Record<string, unknown>>(workoutSheet, { defval: "" })
    : [];

  let importedEntries: Array<{ exercise: string; entry: WorkoutEntry }> = [];

  if (workoutRows.length) {
    importedEntries = workoutRows
      .map((row) => {
        const exercise = str(row.exercise);
        if (!exercise) {
          return null;
        }

        const baseWeight = num(row.weight, 0);
        const sets = parseSets(row.sets_json, baseWeight);
        const topWeight = sets.length ? Math.max(...sets.map((set) => set.weight)) : baseWeight;

        const entry: WorkoutEntry = {
          date: str(row.date),
          workout: str(row.workout),
          weight: topWeight,
          sets,
          notes: str(row.notes),
        };

        return { exercise, entry };
      })
      .filter((item): item is { exercise: string; entry: WorkoutEntry } => item !== null);
  } else {
    importedEntries = readLegacyLogsFallback(workbook);
  }

  importedEntries.forEach(({ exercise, entry }) => {
    const key = workoutKey(exercise, entry);
    if (existingWorkoutKeys.has(key)) {
      summary.workoutsSkippedAsDuplicate += 1;
      return;
    }

    existingWorkoutKeys.add(key);

    if (!nextLogs.exercises[exercise]) {
      nextLogs.exercises[exercise] = [];
    }

    nextLogs.exercises[exercise].push(entry);
    nextLogs.workouts.push({
      date: entry.date,
      workoutType: entry.workout,
      exercise,
      data: entry,
    });

    summary.workoutsImported += 1;
  });

  const skippedSheet = workbook.Sheets.skipped_sessions;
  const skippedRows = skippedSheet
    ? XLSX.utils.sheet_to_json<Record<string, unknown>>(skippedSheet, { defval: "" })
    : [];

  const existingSkipped = new Set(nextLogs.skippedSessions.map((s) => `${s.date}||${s.workout}||${s.action}`));
  skippedRows.forEach((row) => {
    const date = str(row.date);
    const workout = str(row.workout);
    const action = str(row.action);
    if (!date || !workout || !action) {
      return;
    }

    if (action !== "push" && action !== "skip") {
      return;
    }

    const key = `${date}||${workout}||${action}`;
    if (existingSkipped.has(key)) {
      return;
    }

    existingSkipped.add(key);
    nextLogs.skippedSessions.push({
      date,
      workout,
      action,
    });
    summary.skippedSessionsImported += 1;
  });

  const measurementsSheet = workbook.Sheets.measurements;
  const measurementRows = measurementsSheet
    ? XLSX.utils.sheet_to_json<Record<string, unknown>>(measurementsSheet, { defval: "" })
    : [];

  const existingMeasurements = new Set(nextLogs.measurements.map((m) => measurementKey(m)));

  measurementRows.forEach((row) => {
    const measurement = {
      date: str(row.date),
      bodyWeight: num(row.body_weight, 0),
      leftThigh: num(row.left_thigh, 0),
      rightThigh: num(row.right_thigh, 0),
      leftCalf: num(row.left_calf, 0),
      rightCalf: num(row.right_calf, 0),
      notes: str(row.notes),
    };

    if (!measurement.date) {
      return;
    }

    const key = measurementKey(measurement);
    if (existingMeasurements.has(key)) {
      return;
    }

    existingMeasurements.add(key);
    nextLogs.measurements.push(measurement);
    summary.measurementsImported += 1;
  });

  let nextSettings: Settings = { ...baseSettings };
  const settingsSheet = workbook.Sheets.settings;
  if (settingsSheet?.A1?.v) {
    try {
      const raw = JSON.parse(String(settingsSheet.A1.v)) as Record<string, unknown>;
      nextSettings = {
        ...baseSettings,
        mealPlan: str(raw.meal_plan ?? raw.mealPlan) || baseSettings.mealPlan,
        holidayMode: Boolean(raw.holiday_mode ?? raw.holidayMode ?? baseSettings.holidayMode),
        holidayStart: str(raw.holiday_start ?? raw.holidayStart) || null,
        scheduleOffset: Number.parseInt(String(raw.schedule_offset ?? raw.scheduleOffset ?? baseSettings.scheduleOffset), 10) || 0,
      };
      summary.settingsImported = true;
      nextLogs.scheduleOffset = nextSettings.scheduleOffset;
    } catch {
      // ignore malformed settings
    }
  }

  return {
    logs: normalizeLogs(nextLogs),
    settings: nextSettings,
    summary,
  };
}
