import Papa from "papaparse";
import { TARGET_RPE } from "./constants";
import { normalizeLogs } from "./engine";
import type { Logs, MeasurementEntry, SetLog, WorkoutEntry } from "./types";

export function exportLogsToCsv(logs: Logs): string {
  const rows: Array<{
    Date: string;
    Exercise: string;
    Workout: string;
    Set: number;
    Weight_kg: number;
    Reps: number;
    RPE: number;
    Notes: string;
  }> = [];

  Object.entries(logs.exercises).forEach(([exerciseName, history]) => {
    history.forEach((entry) => {
      const date = entry.date.slice(0, 19);
      const weight = entry.weight;
      const workout = entry.workout;
      const notes = entry.notes;
      entry.sets.forEach((set, i) => {
        rows.push({
          Date: date,
          Exercise: exerciseName,
          Workout: workout,
          Set: i + 1,
          Weight_kg: set.weight ?? weight,
          Reps: set.reps,
          RPE: set.rpe ?? TARGET_RPE,
          Notes: notes,
        });
      });
    });
  });

  if (!rows.length) {
    return "Date,Exercise,Workout,Set,Weight_kg,Reps,RPE,Notes\n";
  }

  return Papa.unparse(rows);
}

export function exportMeasurementsToCsv(logs: Logs): string {
  const rows = logs.measurements.map((m) => ({
    Date: m.date,
    Body_Weight_kg: m.bodyWeight,
    Left_Thigh_cm: m.leftThigh,
    Right_Thigh_cm: m.rightThigh,
    Left_Calf_cm: m.leftCalf,
    Right_Calf_cm: m.rightCalf,
    Notes: m.notes,
  }));

  if (!rows.length) {
    return "Date,Body_Weight_kg,Left_Thigh_cm,Right_Thigh_cm,Left_Calf_cm,Right_Calf_cm,Notes\n";
  }

  return Papa.unparse(rows);
}

function mapMeasurementRow(row: Record<string, unknown>): MeasurementEntry {
  const num = (value: unknown) => {
    const parsed = Number.parseFloat(String(value ?? 0));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return {
    date: String(row.Date ?? ""),
    bodyWeight: num(row.Body_Weight_kg),
    leftThigh: num(row.Left_Thigh_cm),
    rightThigh: num(row.Right_Thigh_cm),
    leftCalf: num(row.Left_Calf_cm),
    rightCalf: num(row.Right_Calf_cm),
    notes: String(row.Notes ?? ""),
  };
}

export function importCsvToLogs(csvContent: string, logs: Logs): { logs: Logs; count: number } {
  const parsed = Papa.parse<Record<string, unknown>>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    return { logs, count: -1 };
  }

  const rows = parsed.data;
  const hasMeasurementColumns = rows.every((row) => "Body_Weight_kg" in row);

  if (hasMeasurementColumns) {
    const measurements = rows.map(mapMeasurementRow).filter((m) => m.date);
    const merged = {
      ...logs,
      measurements: [...logs.measurements, ...measurements],
    };
    return { logs: normalizeLogs(merged), count: measurements.length };
  }

  const required = ["Date", "Exercise", "Weight_kg", "Reps"];
  const first = rows[0] ?? {};
  if (!required.every((key) => key in first)) {
    return { logs, count: -1 };
  }

  const grouped = new Map<string, Record<string, unknown>[]>();

  rows.forEach((row) => {
    const date = String(row.Date ?? "").trim();
    const exercise = String(row.Exercise ?? "").trim();
    if (!date || !exercise) {
      return;
    }
    const key = `${date}__${exercise}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)?.push(row);
  });

  let imported = 0;
  const nextLogs: Logs = {
    ...logs,
    workouts: [...logs.workouts],
    exercises: { ...logs.exercises },
  };

  grouped.forEach((groupRows, key) => {
    const [date, exercise] = key.split("__");
    const setsData: SetLog[] = groupRows.map((row) => ({
      reps: Number.parseInt(String(row.Reps ?? 0), 10) || 0,
      rpe: Number.parseFloat(String(row.RPE ?? TARGET_RPE)) || TARGET_RPE,
      weight: Number.parseFloat(String(row.Weight_kg ?? 0)) || 0,
    }));

    const entryWeight = setsData.length ? Math.max(...setsData.map((s) => s.weight)) : 0;

    const entry: WorkoutEntry = {
      date,
      workout: String(groupRows[0].Workout ?? ""),
      weight: entryWeight,
      sets: setsData,
      notes: String(groupRows[0].Notes ?? ""),
    };

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

    imported += 1;
  });

  return { logs: normalizeLogs(nextLogs), count: imported };
}
