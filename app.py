"""
NeuroLegs - Adaptive Leg Training Coach
A sophisticated, mobile-first Streamlit application for science-based leg development.

Author: AI Strength & Conditioning Coach
Target User: 22-year-old student, 61.1kg, experienced lifter with lagging legs
Version: 2.0 - Enhanced with CSV export, rest timer, 1RM calculator, measurements, streaks
"""

import streamlit as st
import pandas as pd
import json
import os
import time
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from io import StringIO
import gspread
from google.oauth2.service_account import Credentials
from gspread.exceptions import WorksheetNotFound

# ============================================================================
# CONFIGURATION & CONSTANTS
# ============================================================================

APP_TITLE = "🦵 NeuroLegs"
APP_PASSWORD = "01012026"

USER_PROFILE = {
    "weight_kg": 61.1,
    "age": 22,
    "protein_g": 125,
    "carbs_g": 415,
    "fats_g": 60,
    "supplements": {"creatine_g": 5, "maltodextrin_g": 40, "whey_g": 30}
}

BASE_SCHEDULE = {
    0: "Legs A", 1: "Rest", 2: "Legs B", 3: "Rest",
    4: "Legs C", 5: "Rest", 6: "Rest"
}

WEIGHT_INCREMENT = {"compound": 2.5, "isolation": 1.25}
BACKOFF_PERCENT = 0.90
BACKOFF_MIN_PERCENT = 0.80
BACKOFF_MAX_PERCENT = 0.95
TARGET_RPE = 8.0
MAX_RPE = 9.0
DELOAD_RPE = 9.5

COMPOUND_EXERCISES = [
    "High Bar Squat", "Romanian Deadlift", "Leg Press",
    "Unilateral Leg Press", "Hack Squat", "Hip Thrust"
]

EXERCISES = {
    "Legs A": [
        {"name": "High Bar Squat", "sets": 3, "rep_range": (5, 8), "rest": "3 min", "rest_seconds": 180,
         "video": "https://www.youtube.com/watch?v=eMYjBnIVb_A", "notes": "Primary quad builder. Brace hard, hit depth."},
        {"name": "Leg Extension", "sets": 3, "rep_range": (10, 12), "rest": "90s", "rest_seconds": 90,
         "video": "https://www.youtube.com/watch?v=WaRl1k71iT0", "notes": "Squeeze at top, control the negative."},
        {"name": "Leg Press", "sets": 3, "rep_range": (10, 12), "rest": "2 min", "rest_seconds": 120,
         "video": "https://www.youtube.com/watch?v=8nm863C0c60", "notes": "Feet shoulder-width, full ROM."},
        {"name": "Seated Leg Curl", "sets": 3, "rep_range": (12, 15), "rest": "90s", "rest_seconds": 90,
         "video": "https://www.youtube.com/watch?v=OrxowZ4l3yI", "notes": "Point toes, squeeze hamstrings."},
        {"name": "Seated Calf Raise", "sets": 4, "rep_range": (15, 20), "rest": "60s", "rest_seconds": 60,
         "video": "https://www.youtube.com/watch?v=-M4-G8p8fmc", "notes": "Soleus focus. Deep stretch, hard squeeze."}
    ],
    "Legs B": [
        {"name": "Romanian Deadlift", "sets": 3, "rep_range": (8, 10), "rest": "3 min", "rest_seconds": 180,
         "video": "https://www.youtube.com/watch?v=JCXUYuzwNrM", "notes": "Hinge pattern. Feel the hamstring stretch."},
        {"name": "Unilateral Leg Press", "sets": 3, "rep_range": (10, 12), "rest": "2 min", "rest_seconds": 120,
         "video": "https://www.youtube.com/watch?v=8nm863C0c60", "notes": "One leg at a time. Balance strength."},
        {"name": "Lying Leg Curl", "sets": 3, "rep_range": (12, 15), "rest": "60s", "rest_seconds": 60,
         "video": "https://www.youtube.com/watch?v=1Tq3QdYUuHs", "notes": "Squeeze hard at peak contraction."},
        {"name": "Adductor Machine", "sets": 3, "rep_range": (15, 20), "rest": "60s", "rest_seconds": 60,
         "video": "https://www.youtube.com/watch?v=KaEp53Hj-EU", "notes": "Inner thigh focus. Control both phases."},
        {"name": "Seated Calf Raise", "sets": 4, "rep_range": (15, 20), "rest": "60s", "rest_seconds": 60,
         "video": "https://www.youtube.com/watch?v=-M4-G8p8fmc", "notes": "Soleus focus. Deep stretch, hard squeeze."}
    ],
    "Legs C": [
        {"name": "Hack Squat", "sets": 3, "rep_range": (10, 12), "rest": "3 min", "rest_seconds": 180,
         "video": "https://www.youtube.com/watch?v=0tmSzVHnh_s", "notes": "Quad dominant. Controlled descent."},
        {"name": "Hip Thrust", "sets": 3, "rep_range": (10, 12), "rest": "2 min", "rest_seconds": 120,
         "video": "https://www.youtube.com/watch?v=xDmFkJxPzeM", "notes": "Glute focus. Full hip extension."},
        {"name": "Leg Extension (Drop Set)", "sets": 3, "rep_range": (15, 20), "rest": "90s", "rest_seconds": 90,
         "video": "https://www.youtube.com/watch?v=WaRl1k71iT0", "notes": "Drop weight 20% after failure, continue."},
        {"name": "Seated Leg Curl", "sets": 3, "rep_range": (15, 20), "rest": "60s", "rest_seconds": 60,
         "video": "https://www.youtube.com/watch?v=OrxowZ4l3yI", "notes": "High reps, chase the pump."},
        {"name": "Calf Press", "sets": 3, "rep_range": (20, 25), "rest": "45s", "rest_seconds": 45,
         "video": "https://www.youtube.com/watch?v=K_jsGgztcGU", "notes": "Leg press machine. Burn it out."}
    ]
}

MEAL_PLANS = {
    "Option 1 - Clean/Rice": {
        "breakfast": {"name": "Power Oats", "items": ["100g Oats", "1 Scoop Whey", "1 Banana", "Drizzle of Honey"], "timing": "08:00"},
        "lunch": {"name": "Chicken & Rice", "items": ["150g Chicken Breast", "300g Basmati Rice", "Mixed Veggies", "1 tbsp Olive Oil"], "timing": "12:30", "note": "Walk 15 min after eating"},
        "pre_workout": {"name": "Quick Carbs", "items": ["2 Slices Toast", "30g Jam"], "timing": "60 min before gym"},
        "post_workout": {"name": "Recovery Shake", "items": ["30g Whey", "40g Maltodextrin", "5g Creatine"], "timing": "Within 30 min of training"},
        "dinner": {"name": "Eggs & Potatoes", "items": ["3 Whole Eggs", "2 Large Potatoes", "1 Apple"], "timing": "20:00"}
    },
    "Option 2 - Dense/Pasta": {
        "breakfast": {"name": "Protein Pancakes", "items": ["100g Oat Flour", "1 Banana", "Egg Whites", "Sugar-free Syrup"], "timing": "08:00"},
        "lunch": {"name": "Beef Pasta", "items": ["120g Lean Ground Beef", "150g Dry Pasta", "Marinara Sauce"], "timing": "12:30", "note": "Walk 15 min after eating"},
        "pre_workout": {"name": "Cereal Boost", "items": ["40g Cereal", "200ml Milk"], "timing": "60 min before gym"},
        "post_workout": {"name": "Recovery Shake", "items": ["30g Whey", "40g Maltodextrin", "5g Creatine"], "timing": "Within 30 min of training"},
        "dinner": {"name": "Fish & Rice", "items": ["150g White Fish", "300g Rice", "1/2 Avocado", "Glass of Juice"], "timing": "20:00"}
    }
}

STARTING_WEIGHTS = {
    "High Bar Squat": 40, "Leg Extension": 20, "Leg Press": 60, "Seated Leg Curl": 15,
    "Romanian Deadlift": 40, "Unilateral Leg Press": 30, "Lying Leg Curl": 15,
    "Adductor Machine": 20, "Seated Calf Raise": 25, "Hack Squat": 40,
    "Hip Thrust": 40, "Leg Extension (Drop Set)": 15, "Calf Press": 60
}

WORKOUT_LOG_SHEET = "workout_logs"
SKIPPED_SESSIONS_SHEET = "skipped_sessions"
MEASUREMENTS_SHEET = "measurements"
LEGACY_LOGS_SHEET = "logs"

WORKOUT_LOG_HEADERS = ["date", "workout", "exercise", "weight", "sets_json", "notes"]
SKIPPED_SESSION_HEADERS = ["date", "workout", "action"]
MEASUREMENT_HEADERS = ["date", "body_weight", "left_thigh", "right_thigh", "left_calf", "right_calf", "notes"]


# ============================================================================
# DATA PERSISTENCE (Google Sheets)
# ============================================================================

@st.cache_resource
def get_sheets_client():
    """Get authenticated Google Sheets client using Streamlit secrets."""
    creds = Credentials.from_service_account_info(
        st.secrets["gcp_service_account"],
        scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    return gspread.authorize(creds)

@st.cache_resource
def get_spreadsheet():
    client = get_sheets_client()
    return client.open_by_key(st.secrets["spreadsheet_id"])


def get_or_create_worksheet(spreadsheet, title: str, rows: int = 1000, cols: int = 20):
    try:
        return spreadsheet.worksheet(title)
    except WorksheetNotFound:
        return spreadsheet.add_worksheet(title=title, rows=rows, cols=cols)


def ensure_headers(worksheet, headers: List[str], cache_key: str) -> None:
    initialized = st.session_state.setdefault("sheets_initialized", set())
    if cache_key in initialized:
        return
    existing = worksheet.row_values(1)
    if existing != headers:
        if existing:
            worksheet.insert_row(headers, 1)
        else:
            worksheet.update("A1", [headers])
    initialized.add(cache_key)


def append_rows_safe(worksheet, rows: List[List]) -> None:
    if not rows:
        return
    try:
        worksheet.append_rows(rows, value_input_option="RAW")
    except AttributeError:
        for row in rows:
            worksheet.append_row(row, value_input_option="RAW")


def safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_int(value, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def serialize_sets(sets_data: List[Dict]) -> str:
    return json.dumps(sets_data, separators=(",", ":"))


def rpe_to_rir(rpe: float) -> float:
    return max(0.0, 10.0 - rpe)


def estimate_e1rm(weight: float, reps: int, rpe: float) -> float:
    if weight <= 0 or reps <= 0:
        return 0.0
    effective_reps = reps + rpe_to_rir(rpe)
    return weight * (1 + (effective_reps / 30.0))


def get_session_sets(entry: Dict) -> List[Dict]:
    base_weight = safe_float(entry.get("weight", 0))
    sets = entry.get("sets", []) or []
    normalized = []
    for s in sets:
        normalized.append({
            "reps": safe_int(s.get("reps", 0)),
            "rpe": safe_float(s.get("rpe", TARGET_RPE), TARGET_RPE),
            "weight": safe_float(s.get("weight", base_weight), base_weight)
        })
    return normalized


def get_session_top_weight(entry: Dict) -> float:
    sets = get_session_sets(entry)
    if not sets:
        return safe_float(entry.get("weight", 0))
    return max(s["weight"] for s in sets)


def get_session_volume(entry: Dict) -> float:
    sets = get_session_sets(entry)
    return sum(s["weight"] * s["reps"] for s in sets)


def normalize_logs(logs: Dict) -> Dict:
    logs.setdefault("workouts", [])
    logs.setdefault("exercises", {})
    logs.setdefault("skipped_sessions", [])
    logs.setdefault("measurements", [])
    logs.setdefault("schedule_offset", 0)

    for history in logs["exercises"].values():
        history.sort(key=lambda x: x.get("date", ""), reverse=True)
    logs["measurements"].sort(key=lambda x: x.get("date", ""))
    return logs


def load_legacy_logs(spreadsheet) -> Optional[Dict]:
    try:
        legacy_sheet = spreadsheet.worksheet(LEGACY_LOGS_SHEET)
    except WorksheetNotFound:
        return None
    data = legacy_sheet.acell("A1").value
    if not data:
        return None
    try:
        legacy_logs = json.loads(data)
    except json.JSONDecodeError:
        return None
    if not isinstance(legacy_logs, dict):
        return None
    return legacy_logs


def migrate_legacy_logs(
    legacy_logs: Dict,
    workout_ws,
    skipped_ws,
    measurements_ws
) -> None:
    workout_rows = []
    exercise_history = legacy_logs.get("exercises", {})
    if exercise_history:
        for exercise_name, history in exercise_history.items():
            for entry in reversed(history):
                workout_rows.append([
                    entry.get("date", ""),
                    entry.get("workout", ""),
                    exercise_name,
                    entry.get("weight", 0),
                    serialize_sets(entry.get("sets", [])),
                    entry.get("notes", "")
                ])
    else:
        for entry in legacy_logs.get("workouts", []):
            data = entry.get("data", {})
            workout_rows.append([
                entry.get("date", ""),
                entry.get("workout_type", ""),
                entry.get("exercise", ""),
                data.get("weight", 0),
                serialize_sets(data.get("sets", [])),
                data.get("notes", "")
            ])
    append_rows_safe(workout_ws, workout_rows)

    skipped_rows = [
        [entry.get("date", ""), entry.get("workout", ""), entry.get("action", "")]
        for entry in legacy_logs.get("skipped_sessions", [])
    ]
    append_rows_safe(skipped_ws, skipped_rows)

    measurement_rows = []
    for entry in legacy_logs.get("measurements", []):
        measurement_rows.append([
            entry.get("date", ""),
            entry.get("body_weight", 0),
            entry.get("left_thigh", 0),
            entry.get("right_thigh", 0),
            entry.get("left_calf", 0),
            entry.get("right_calf", 0),
            entry.get("notes", "")
        ])
    append_rows_safe(measurements_ws, measurement_rows)


def build_logs_from_rows(
    workout_rows: List[Dict],
    skipped_rows: List[Dict],
    measurement_rows: List[Dict]
) -> Dict:
    logs = {"workouts": [], "exercises": {}, "skipped_sessions": [], "measurements": [], "schedule_offset": 0}

    for row in workout_rows:
        exercise_name = row.get("exercise", "")
        if not exercise_name:
            continue
        sets_raw = row.get("sets_json", "")
        try:
            sets_data = json.loads(sets_raw) if sets_raw else []
        except json.JSONDecodeError:
            sets_data = []

        entry = {
            "date": row.get("date", ""),
            "workout": row.get("workout", ""),
            "weight": safe_float(row.get("weight", 0)),
            "sets": sets_data,
            "notes": row.get("notes", "")
        }
        logs["exercises"].setdefault(exercise_name, []).append(entry)
        logs["workouts"].append({
            "date": entry["date"],
            "workout_type": entry["workout"],
            "exercise": exercise_name,
            "data": entry
        })

    logs["skipped_sessions"] = [
        {
            "date": row.get("date", ""),
            "workout": row.get("workout", ""),
            "action": row.get("action", "")
        }
        for row in skipped_rows
    ]

    logs["measurements"] = []
    for row in measurement_rows:
        logs["measurements"].append({
            "date": row.get("date", ""),
            "body_weight": safe_float(row.get("body_weight", 0)),
            "left_thigh": safe_float(row.get("left_thigh", 0)),
            "right_thigh": safe_float(row.get("right_thigh", 0)),
            "left_calf": safe_float(row.get("left_calf", 0)),
            "right_calf": safe_float(row.get("right_calf", 0)),
            "notes": row.get("notes", "")
        })

    return normalize_logs(logs)


def load_logs() -> Dict:
    """Load logs from Google Sheets."""
    try:
        spreadsheet = get_spreadsheet()
        workout_ws = get_or_create_worksheet(
            spreadsheet, WORKOUT_LOG_SHEET, rows=1000, cols=len(WORKOUT_LOG_HEADERS)
        )
        skipped_ws = get_or_create_worksheet(
            spreadsheet, SKIPPED_SESSIONS_SHEET, rows=200, cols=len(SKIPPED_SESSION_HEADERS)
        )
        measurements_ws = get_or_create_worksheet(
            spreadsheet, MEASUREMENTS_SHEET, rows=500, cols=len(MEASUREMENT_HEADERS)
        )

        ensure_headers(workout_ws, WORKOUT_LOG_HEADERS, WORKOUT_LOG_SHEET)
        ensure_headers(skipped_ws, SKIPPED_SESSION_HEADERS, SKIPPED_SESSIONS_SHEET)
        ensure_headers(measurements_ws, MEASUREMENT_HEADERS, MEASUREMENTS_SHEET)

        workout_rows = workout_ws.get_all_records()
        if not workout_rows:
            legacy_logs = load_legacy_logs(spreadsheet)
            if legacy_logs:
                migrate_legacy_logs(legacy_logs, workout_ws, skipped_ws, measurements_ws)
                return normalize_logs(legacy_logs)

        skipped_rows = skipped_ws.get_all_records()
        measurement_rows = measurements_ws.get_all_records()
        return build_logs_from_rows(workout_rows, skipped_rows, measurement_rows)
    except Exception as e:
        st.error(f"Failed to load logs: {e}")
    return {"workouts": [], "exercises": {}, "skipped_sessions": [], "measurements": [], "schedule_offset": 0}


def append_workout_logs(rows: List[List]) -> None:
    try:
        spreadsheet = get_spreadsheet()
        workout_ws = get_or_create_worksheet(
            spreadsheet, WORKOUT_LOG_SHEET, rows=1000, cols=len(WORKOUT_LOG_HEADERS)
        )
        ensure_headers(workout_ws, WORKOUT_LOG_HEADERS, WORKOUT_LOG_SHEET)
        append_rows_safe(workout_ws, rows)
    except Exception as e:
        st.error(f"Failed to save workout logs: {e}")


def append_skipped_sessions(rows: List[List]) -> None:
    try:
        spreadsheet = get_spreadsheet()
        skipped_ws = get_or_create_worksheet(
            spreadsheet, SKIPPED_SESSIONS_SHEET, rows=200, cols=len(SKIPPED_SESSION_HEADERS)
        )
        ensure_headers(skipped_ws, SKIPPED_SESSION_HEADERS, SKIPPED_SESSIONS_SHEET)
        append_rows_safe(skipped_ws, rows)
    except Exception as e:
        st.error(f"Failed to save skipped sessions: {e}")


def append_measurements(rows: List[List]) -> None:
    try:
        spreadsheet = get_spreadsheet()
        measurements_ws = get_or_create_worksheet(
            spreadsheet, MEASUREMENTS_SHEET, rows=500, cols=len(MEASUREMENT_HEADERS)
        )
        ensure_headers(measurements_ws, MEASUREMENT_HEADERS, MEASUREMENTS_SHEET)
        append_rows_safe(measurements_ws, rows)
    except Exception as e:
        st.error(f"Failed to save measurements: {e}")


def load_settings() -> Dict:
    """Load settings from Google Sheets."""
    try:
        spreadsheet = get_spreadsheet()
        sheet = spreadsheet.worksheet("settings")
        data = sheet.acell("A1").value
        if data:
            return json.loads(data)
    except Exception as e:
        st.error(f"Failed to load settings: {e}")
    return {"meal_plan": "Option 1 - Clean/Rice", "holiday_mode": False, "holiday_start": None, "schedule_offset": 0}


def save_settings(settings: Dict) -> None:
    """Save settings to Google Sheets."""
    try:
        spreadsheet = get_spreadsheet()
        sheet = spreadsheet.worksheet("settings")
        sheet.update_acell("A1", json.dumps(settings, default=str))
    except Exception as e:
        st.error(f"Failed to save settings: {e}")
    st.session_state["settings"] = settings


# ============================================================================
# CSV EXPORT/IMPORT
# ============================================================================

def export_logs_to_csv(logs: Dict) -> str:
    """Export all workout logs to CSV format."""
    rows = []
    for exercise_name, history in logs.get("exercises", {}).items():
        for entry in history:
            date = entry.get("date", "")[:19]
            weight = entry.get("weight", 0)
            workout = entry.get("workout", "")
            notes = entry.get("notes", "")
            sets = get_session_sets(entry)
            for i, s in enumerate(sets):
                rows.append({
                    "Date": date,
                    "Exercise": exercise_name,
                    "Workout": workout,
                    "Set": i + 1,
                    "Weight_kg": s.get("weight", weight),
                    "Reps": s.get("reps", 0),
                    "RPE": s.get("rpe", TARGET_RPE),
                    "Notes": notes
                })

    if not rows:
        return "Date,Exercise,Workout,Set,Weight_kg,Reps,RPE,Notes\n"

    df = pd.DataFrame(rows)
    return df.to_csv(index=False)


def export_measurements_to_csv(logs: Dict) -> str:
    """Export body measurements to CSV."""
    measurements = logs.get("measurements", [])
    if not measurements:
        return "Date,Body_Weight_kg,Left_Thigh_cm,Right_Thigh_cm,Left_Calf_cm,Right_Calf_cm,Notes\n"

    df = pd.DataFrame(measurements)
    return df.to_csv(index=False)


def import_csv_to_logs(csv_content: str, logs: Dict) -> Tuple[Dict, int, List[List]]:
    """Import workout data from CSV. Returns updated logs, count, and sheet rows."""
    try:
        df = pd.read_csv(StringIO(csv_content))
        required_cols = ["Date", "Exercise", "Weight_kg", "Reps"]
        if not all(col in df.columns for col in required_cols):
            return logs, -1, []

        imported = 0
        imported_rows = []
        grouped = df.groupby(["Date", "Exercise"])

        for (date, exercise), group in grouped:
            sets_data = []
            for _, row in group.iterrows():
                sets_data.append({
                    "reps": int(row.get("Reps", 0)),
                    "rpe": float(row.get("RPE", 8)),
                    "weight": float(row.get("Weight_kg", 0))
                })

            entry_weight = max([s.get("weight", 0) for s in sets_data]) if sets_data else 0
            entry = {
                "date": str(date),
                "workout": str(group.iloc[0].get("Workout", "")),
                "weight": entry_weight,
                "sets": sets_data,
                "notes": str(group.iloc[0].get("Notes", ""))
            }

            if exercise not in logs["exercises"]:
                logs["exercises"][exercise] = []

            logs["exercises"][exercise].append(entry)
            logs["workouts"].append({
                "date": entry["date"],
                "workout_type": entry["workout"],
                "exercise": exercise,
                "data": entry
            })
            imported_rows.append([
                entry["date"],
                entry["workout"],
                exercise,
                entry["weight"],
                serialize_sets(entry["sets"]),
                entry["notes"]
            ])
            imported += 1

        return normalize_logs(logs), imported, imported_rows
    except Exception as e:
        return logs, -1, []


# ============================================================================
# 1RM CALCULATOR
# ============================================================================

def calculate_1rm(weight: float, reps: int, formula: str = "brzycki") -> float:
    """
    Calculate estimated 1 Rep Max using various formulas.

    Formulas:
    - Brzycki: weight × (36 / (37 - reps))
    - Epley: weight × (1 + 0.0333 × reps)
    - Lander: (100 × weight) / (101.3 - 2.67123 × reps)
    """
    if reps <= 0 or weight <= 0:
        return 0
    if reps == 1:
        return weight
    if reps > 12:
        reps = 12  # Cap for accuracy

    if formula == "brzycki":
        return weight * (36 / (37 - reps))
    elif formula == "epley":
        return weight * (1 + 0.0333 * reps)
    elif formula == "lander":
        return (100 * weight) / (101.3 - 2.67123 * reps)
    else:
        # Average of all three
        brzycki = weight * (36 / (37 - reps))
        epley = weight * (1 + 0.0333 * reps)
        lander = (100 * weight) / (101.3 - 2.67123 * reps)
        return (brzycki + epley + lander) / 3


def get_percentages_from_1rm(one_rm: float) -> Dict[str, float]:
    """Get training weights at various percentages of 1RM."""
    percentages = {
        "100% (1RM)": 1.0,
        "95% (2 reps)": 0.95,
        "90% (3-4 reps)": 0.90,
        "85% (5-6 reps)": 0.85,
        "80% (7-8 reps)": 0.80,
        "75% (9-10 reps)": 0.75,
        "70% (11-12 reps)": 0.70,
        "65% (15+ reps)": 0.65,
    }
    return {k: round(one_rm * v, 1) for k, v in percentages.items()}


# ============================================================================
# WARM-UP GENERATOR
# ============================================================================

def generate_warmup_sets(working_weight: float, working_reps: int) -> List[Dict]:
    """Generate progressive warm-up sets for a given working weight."""
    warmup = []

    # Empty bar / very light (if applicable)
    if working_weight >= 40:
        warmup.append({"weight": 20, "reps": 10, "notes": "Empty bar / mobility"})

    # 40% x 8
    if working_weight >= 30:
        warmup.append({"weight": round(working_weight * 0.4 / 2.5) * 2.5, "reps": 8, "notes": "40% - Easy"})

    # 60% x 5
    warmup.append({"weight": round(working_weight * 0.6 / 2.5) * 2.5, "reps": 5, "notes": "60% - Moderate"})

    # 75% x 3
    warmup.append({"weight": round(working_weight * 0.75 / 2.5) * 2.5, "reps": 3, "notes": "75% - Getting heavy"})

    # 85% x 2
    warmup.append({"weight": round(working_weight * 0.85 / 2.5) * 2.5, "reps": 2, "notes": "85% - Prime nervous system"})

    # 90% x 1 (optional for heavy days)
    if working_reps <= 6:
        warmup.append({"weight": round(working_weight * 0.90 / 2.5) * 2.5, "reps": 1, "notes": "90% - Final prep"})

    return warmup


# ============================================================================
# STREAK CALCULATOR
# ============================================================================

def calculate_streak(logs: Dict, settings: Dict) -> Dict:
    """Calculate training streak and consistency metrics."""
    workouts = logs.get("workouts", [])

    if not workouts:
        return {
            "current_streak_weeks": 0,
            "longest_streak_weeks": 0,
            "total_weeks_trained": 0,
            "consistency_percent": 0,
            "workouts_this_week": 0,
            "target_workouts_week": 3
        }

    # Get unique workout dates
    workout_dates = set()
    for w in workouts:
        date_str = w.get("date", "")[:10]
        if date_str:
            workout_dates.add(date_str)

    if not workout_dates:
        return {"current_streak_weeks": 0, "longest_streak_weeks": 0, "total_weeks_trained": 0,
                "consistency_percent": 0, "workouts_this_week": 0, "target_workouts_week": 3}

    # Convert to datetime and sort
    dates = sorted([datetime.fromisoformat(d) for d in workout_dates])

    # Calculate weeks with at least one workout
    weeks_trained = set()
    for d in dates:
        week_key = d.strftime("%Y-W%W")
        weeks_trained.add(week_key)

    # Current week workouts
    current_week = datetime.now().strftime("%Y-W%W")
    workouts_this_week = sum(1 for d in dates if d.strftime("%Y-W%W") == current_week)

    # Calculate streak (consecutive weeks with workouts)
    all_weeks = []
    start_date = dates[0]
    end_date = datetime.now()
    current = start_date
    while current <= end_date:
        all_weeks.append(current.strftime("%Y-W%W"))
        current += timedelta(weeks=1)

    # Find current streak
    current_streak = 0
    for week in reversed(all_weeks):
        if week in weeks_trained:
            current_streak += 1
        else:
            break

    # Find longest streak
    longest_streak = 0
    temp_streak = 0
    for week in all_weeks:
        if week in weeks_trained:
            temp_streak += 1
            longest_streak = max(longest_streak, temp_streak)
        else:
            temp_streak = 0

    # Consistency
    total_possible_weeks = len(all_weeks)
    consistency = (len(weeks_trained) / total_possible_weeks * 100) if total_possible_weeks > 0 else 0

    return {
        "current_streak_weeks": current_streak,
        "longest_streak_weeks": longest_streak,
        "total_weeks_trained": len(weeks_trained),
        "consistency_percent": round(consistency, 1),
        "workouts_this_week": workouts_this_week,
        "target_workouts_week": 3
    }


def parse_log_date(date_str: str) -> Optional[datetime]:
    if not date_str:
        return None
    try:
        parsed = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
    except (ValueError, TypeError):
        return None


def get_weekly_review(logs: Dict, days: int = 7) -> Dict:
    now = datetime.now()
    recent_cutoff = now - timedelta(days=days)
    previous_cutoff = now - timedelta(days=days * 2)

    review = {
        "recent": {"sessions": 0, "sets": 0, "volume": 0, "rpe_sum": 0, "rpe_count": 0, "e1rm_sum": 0},
        "previous": {"sessions": 0, "sets": 0, "volume": 0, "rpe_sum": 0, "rpe_count": 0, "e1rm_sum": 0}
    }

    for _, history in logs.get("exercises", {}).items():
        for entry in history:
            entry_date = parse_log_date(entry.get("date", ""))
            if not entry_date:
                continue
            if entry_date >= recent_cutoff:
                bucket = review["recent"]
            elif entry_date >= previous_cutoff:
                bucket = review["previous"]
            else:
                continue

            sets = get_session_sets(entry)
            if not sets:
                continue
            bucket["sessions"] += 1
            bucket["sets"] += len(sets)
            bucket["volume"] += sum([s.get("weight", 0) * s.get("reps", 0) for s in sets])
            bucket["rpe_sum"] += sum([s.get("rpe", TARGET_RPE) for s in sets])
            bucket["rpe_count"] += len(sets)

            best_set = max(
                sets,
                key=lambda s: estimate_e1rm(s.get("weight", 0), s.get("reps", 0), s.get("rpe", TARGET_RPE))
            )
            bucket["e1rm_sum"] += estimate_e1rm(
                best_set.get("weight", 0),
                best_set.get("reps", 0),
                best_set.get("rpe", TARGET_RPE)
            )

    for bucket in review.values():
        bucket["avg_rpe"] = round(bucket["rpe_sum"] / bucket["rpe_count"], 2) if bucket["rpe_count"] else 0
        bucket["avg_e1rm"] = round(bucket["e1rm_sum"] / bucket["sessions"], 1) if bucket["sessions"] else 0

    return review


# ============================================================================
# PR DETECTION
# ============================================================================

def check_for_new_pr(exercise_name: str, weight: float, logs: Dict) -> Tuple[bool, float]:
    """Check if the logged weight is a new PR. Returns (is_pr, old_pr)."""
    history = logs.get("exercises", {}).get(exercise_name, [])

    if not history:
        return True, 0  # First entry is always a PR

    max_weight = max([get_session_top_weight(h) for h in history])

    if weight > max_weight:
        return True, max_weight

    return False, max_weight


# ============================================================================
# AUTHENTICATION
# ============================================================================

def check_password() -> bool:
    if 'authenticated' not in st.session_state:
        st.session_state.authenticated = False
    if st.session_state.authenticated:
        return True

    st.markdown("## 🔐 NeuroLegs")
    st.markdown("Enter password to access your training log.")
    password = st.text_input("Password", type="password", key="password_input")

    if st.button("Login", type="primary", use_container_width=True):
        if password == APP_PASSWORD:
            st.session_state.authenticated = True
            st.rerun()
        else:
            st.error("Incorrect password")

    st.caption("Hint: Your leg day anniversary 🦵")
    return False


# ============================================================================
# SCHEDULE MANAGEMENT
# ============================================================================

def get_adjusted_schedule(settings: Dict) -> Dict:
    offset = settings.get("schedule_offset", 0)
    if offset == 0:
        return BASE_SCHEDULE.copy()
    adjusted = {}
    for day in range(7):
        original_day = (day - offset) % 7
        adjusted[day] = BASE_SCHEDULE[original_day]
    return adjusted


def get_today_workout_with_settings(settings: Dict) -> Tuple[str, List[Dict]]:
    if settings.get("holiday_mode", False):
        return "Holiday", []
    schedule = get_adjusted_schedule(settings)
    day_of_week = datetime.now().weekday()
    workout_name = schedule[day_of_week]
    if workout_name == "Rest":
        return "Rest", []
    return workout_name, EXERCISES.get(workout_name, [])


def get_next_training_day(settings: Dict) -> Tuple[str, str, int]:
    if settings.get("holiday_mode", False):
        return "Holiday", "N/A", 0
    schedule = get_adjusted_schedule(settings)
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    current_day = datetime.now().weekday()
    for i in range(1, 8):
        check_day = (current_day + i) % 7
        if schedule[check_day] != "Rest":
            return schedule[check_day], day_names[check_day], i
    return "Rest", "N/A", 7


def get_week_schedule_preview(settings: Dict) -> List[Dict]:
    schedule = get_adjusted_schedule(settings)
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    today = datetime.now().weekday()
    preview = []
    for i in range(7):
        day = (today + i) % 7
        preview.append({
            "day": day_names[day],
            "workout": schedule[day] if not settings.get("holiday_mode") else "❄️",
            "is_today": i == 0
        })
    return preview


# ============================================================================
# ADAPTIVE COACHING ALGORITHM
# ============================================================================

class AdaptiveCoach:
    def __init__(self, logs: Dict):
        self.logs = logs
        self.exercise_history = logs.get("exercises", {})

    def calculate_set_score(self, reps: int, rpe: float, min_range: int, max_range: int) -> float:
        if reps < min_range:
            rep_score = max(0, (reps / min_range) * 30)
        elif reps > max_range:
            rep_score = 100
        else:
            range_position = (reps - min_range) / (max_range - min_range)
            rep_score = 30 + (range_position * 70)
        rpe_modifier = 1.0 + (9 - rpe) * 0.05
        rpe_modifier = max(0.85, min(1.20, rpe_modifier))
        return min(100, rep_score * rpe_modifier)

    def calculate_session_score(self, sets_data: List[Dict], min_range: int, max_range: int) -> Tuple[float, str]:
        if not sets_data:
            return 0, "No data"
        scores = []
        reps_list = []
        for set_data in sets_data:
            reps = set_data.get("reps", 0)
            rpe = set_data.get("rpe", TARGET_RPE)
            reps_list.append(reps)
            scores.append(self.calculate_set_score(reps, rpe, min_range, max_range))
        avg_score = sum(scores) / len(scores)
        rep_variance = max(reps_list) - min(reps_list)
        if rep_variance <= 1:
            consistency = "Excellent consistency"
            avg_score *= 1.05
        elif rep_variance <= 2:
            consistency = "Good consistency"
        else:
            consistency = "Work on set-to-set consistency"
            avg_score *= 0.95
        return min(100, avg_score), consistency

    def get_session_stats(self, session: Dict, rep_range: Tuple[int, int]) -> Dict:
        sets = get_session_sets(session)
        if not sets:
            return {
                "sets": [],
                "top_weight": safe_float(session.get("weight", 0)),
                "top_set_reps": 0,
                "top_set_rpe": TARGET_RPE,
                "backoff_sets": 0,
                "backoff_avg_reps": 0,
                "backoff_min_reps": 0,
                "backoff_avg_rpe": TARGET_RPE,
                "backoff_rep_dropoff": 0,
                "avg_reps": 0,
                "min_reps": 0,
                "max_reps": 0,
                "avg_rpe": TARGET_RPE,
                "rep_dropoff": 0,
                "volume": 0,
                "best_e1rm": 0,
                "all_sets_in_range": False
            }

        min_range, max_range = rep_range
        weights = [s.get("weight", 0) for s in sets]
        reps = [s.get("reps", 0) for s in sets]
        rpes = [s.get("rpe", TARGET_RPE) for s in sets]

        top_weight = max(weights) if weights else 0
        top_sets = [s for s in sets if s.get("weight", 0) >= top_weight * 0.99]
        top_set = max(top_sets, key=lambda s: s.get("reps", 0)) if top_sets else sets[0]

        backoff_sets = [s for s in sets if s.get("weight", 0) < top_weight * 0.99]
        if backoff_sets:
            backoff_reps = [s.get("reps", 0) for s in backoff_sets]
            backoff_rpes = [s.get("rpe", TARGET_RPE) for s in backoff_sets]
            backoff_avg_reps = sum(backoff_reps) / len(backoff_reps)
            backoff_min_reps = min(backoff_reps)
            backoff_avg_rpe = sum(backoff_rpes) / len(backoff_rpes)
            backoff_rep_dropoff = max(backoff_reps) - min(backoff_reps)
        else:
            backoff_avg_reps = 0
            backoff_min_reps = 0
            backoff_avg_rpe = TARGET_RPE
            backoff_rep_dropoff = 0

        volume = sum(w * r for w, r in zip(weights, reps))
        e1rms = [estimate_e1rm(w, r, rpe) for w, r, rpe in zip(weights, reps, rpes)]

        in_range_sets = sum(1 for r in reps if min_range <= r <= max_range)
        return {
            "sets": sets,
            "top_weight": top_weight,
            "top_set_reps": top_set.get("reps", 0),
            "top_set_rpe": top_set.get("rpe", TARGET_RPE),
            "backoff_sets": len(backoff_sets),
            "backoff_avg_reps": backoff_avg_reps,
            "backoff_min_reps": backoff_min_reps,
            "backoff_avg_rpe": backoff_avg_rpe,
            "backoff_rep_dropoff": backoff_rep_dropoff,
            "avg_reps": sum(reps) / len(reps),
            "min_reps": min(reps),
            "max_reps": max(reps),
            "avg_rpe": sum(rpes) / len(rpes),
            "rep_dropoff": max(reps) - min(reps),
            "volume": volume,
            "best_e1rm": max(e1rms) if e1rms else 0,
            "all_sets_in_range": in_range_sets == len(reps)
        }

    def get_backoff_adjustment(self, session_stats: Dict, rep_range: Tuple[int, int]) -> Tuple[float, Optional[str]]:
        if session_stats.get("backoff_sets", 0) == 0:
            return BACKOFF_PERCENT, None

        min_range, max_range = rep_range
        top_success = session_stats["top_set_reps"] >= min_range and session_stats["top_set_rpe"] <= MAX_RPE
        backoff_avg_reps = session_stats["backoff_avg_reps"]
        backoff_min_reps = session_stats["backoff_min_reps"]
        backoff_avg_rpe = session_stats["backoff_avg_rpe"]
        backoff_dropoff = session_stats["backoff_rep_dropoff"]

        if top_success and (backoff_min_reps < min_range or backoff_avg_rpe > MAX_RPE or backoff_dropoff >= 3):
            new_percent = max(BACKOFF_MIN_PERCENT, BACKOFF_PERCENT - 0.05)
            return new_percent, f"Back-off auto-adjusted to {int(new_percent * 100)}% for quality reps."

        if backoff_avg_reps < min_range:
            new_percent = max(BACKOFF_MIN_PERCENT, BACKOFF_PERCENT - 0.03)
            return new_percent, f"Back-off reduced to {int(new_percent * 100)}% to stay in range."

        if backoff_avg_reps >= max_range and backoff_avg_rpe <= TARGET_RPE - 0.5:
            new_percent = min(BACKOFF_MAX_PERCENT, BACKOFF_PERCENT + 0.02)
            return new_percent, f"Back-off nudged up to {int(new_percent * 100)}% for more overload."

        return BACKOFF_PERCENT, None

    def get_exercise_history(self, exercise_name: str, limit: int = 10) -> List[Dict]:
        history = self.exercise_history.get(exercise_name, [])
        return sorted(history, key=lambda x: x.get("date", ""), reverse=True)[:limit]

    def get_days_since_last_session(self, exercise_name: str) -> Optional[int]:
        """Returns days since last session for an exercise, or None if never trained."""
        history = self.get_exercise_history(exercise_name, limit=1)
        if not history:
            return None
        try:
            last_date_str = history[0].get("date", "")
            if not last_date_str:
                return None
            last_date = datetime.fromisoformat(last_date_str.replace("Z", "+00:00"))
            if last_date.tzinfo:
                last_date = last_date.replace(tzinfo=None)
            return (datetime.now() - last_date).days
        except (ValueError, TypeError):
            return None

    def get_return_deload_factor(self, days_gap: int) -> Tuple[float, str, str]:
        """Returns (deload_multiplier, phase_name, message) based on time gap."""
        if days_gap <= 14:
            return (1.0, "NORMAL", "")
        elif days_gap <= 28:
            return (0.90, "LIGHT_RETURN", "Light return week - ease back in")
        elif days_gap <= 56:
            return (0.80, "REACCLIMATION", "Re-acclimation phase - rebuild the groove")
        elif days_gap <= 90:
            return (0.70, "REBUILDING", "Rebuilding phase - muscle memory will help!")
        else:
            return (0.60, "FRESH_START", "Fresh start - your muscles remember more than you think!")

    def analyze_multi_session_trend(self, exercise_name: str, rep_range: Tuple[int, int], num_sessions: int = 3) -> Dict:
        history = self.get_exercise_history(exercise_name, num_sessions + 2)
        if len(history) < 1:
            return {"has_data": False, "trend": "NO_DATA", "avg_e1rm": None, "avg_reps": None,
                    "avg_rpe": None, "e1rm_trend": 0, "rep_trend": 0, "rpe_trend": 0, "sessions_analyzed": 0}

        session_stats = [self.get_session_stats(h, rep_range) for h in history[:num_sessions]]
        e1rms = [s["best_e1rm"] for s in session_stats]
        avg_reps = sum([s["avg_reps"] for s in session_stats]) / len(session_stats)
        avg_rpe = sum([s["avg_rpe"] for s in session_stats]) / len(session_stats)

        e1rm_trend = rep_trend = rpe_trend = 0
        if len(session_stats) >= 2:
            recent = session_stats[0]
            older = session_stats[1:num_sessions]
            prev_avg_e1rm = sum([s["best_e1rm"] for s in older]) / len(older)
            prev_avg_reps = sum([s["avg_reps"] for s in older]) / len(older)
            prev_avg_rpe = sum([s["avg_rpe"] for s in older]) / len(older)

            e1rm_trend = recent["best_e1rm"] - prev_avg_e1rm
            rep_trend = recent["avg_reps"] - prev_avg_reps
            rpe_trend = recent["avg_rpe"] - prev_avg_rpe

        prev_avg = (sum(e1rms[1:]) / len(e1rms[1:])) if len(e1rms) > 1 else e1rms[0]
        threshold = max(0.5, prev_avg * 0.01) if prev_avg else 0.5

        if e1rm_trend > threshold or (rep_trend > 0.5 and rpe_trend <= 0.3):
            trend = "IMPROVING"
        elif e1rm_trend < -threshold or (rep_trend < -0.5 and rpe_trend > 0.5):
            trend = "DECLINING"
        elif abs(e1rm_trend) <= threshold and abs(rep_trend) <= 0.5:
            trend = "STABLE"
        else:
            trend = "VARIABLE"

        return {
            "has_data": True,
            "trend": trend,
            "avg_e1rm": round(sum(e1rms) / len(e1rms), 1),
            "avg_reps": round(avg_reps, 1),
            "avg_rpe": round(avg_rpe, 1),
            "e1rm_trend": round(e1rm_trend, 1),
            "rep_trend": round(rep_trend, 1),
            "rpe_trend": round(rpe_trend, 1),
            "sessions_analyzed": min(len(history), num_sessions)
        }

    def detect_plateau(self, exercise_name: str, rep_range: Tuple[int, int]) -> Tuple[bool, int, str]:
        history = self.get_exercise_history(exercise_name, 6)
        if len(history) < 3:
            return False, 0, "Keep training - building baseline data"

        stall_count = 0
        for i in range(len(history) - 1):
            current = self.get_session_stats(history[i], rep_range)
            previous = self.get_session_stats(history[i + 1], rep_range)
            if current["best_e1rm"] <= previous["best_e1rm"] + 0.5 and current["avg_reps"] <= previous["avg_reps"] + 0.25:
                stall_count += 1
            else:
                break

        trend = self.analyze_multi_session_trend(exercise_name, rep_range, 3)
        if trend["has_data"] and trend["rpe_trend"] > 0.5 and trend["trend"] != "IMPROVING":
            if stall_count >= 2:
                return True, stall_count, "RPE increasing without progress - fatigue accumulating."

        if stall_count >= 4:
            return True, stall_count, "Significant plateau! Time for a strategic deload."
        elif stall_count >= 2:
            return True, stall_count, "Minor stall detected. Consider a volume boost."
        return False, stall_count, "Progressing well!"

    def get_next_target(self, exercise_name: str, exercise_config: Dict) -> Dict:
        history = self.get_exercise_history(exercise_name, 8)
        min_range, max_range = exercise_config["rep_range"]
        is_compound = exercise_name in COMPOUND_EXERCISES
        increment = WEIGHT_INCREMENT["compound"] if is_compound else WEIGHT_INCREMENT["isolation"]

        def round_to_increment(value: float) -> float:
            if increment <= 0:
                return value
            return round(value / increment) * increment

        def build_target(
            weight: float,
            reps: int,
            recommendation: str,
            message: str,
            backoff_percent: float = BACKOFF_PERCENT,
            **kwargs
        ) -> Dict:
            backoff_weight = round_to_increment(weight * backoff_percent)
            backoff_reps = min(max_range, max(reps, min_range) + 2)
            target = {
                "weight": round_to_increment(weight),
                "reps_per_set": reps,
                "recommendation": recommendation,
                "message": message,
                "backoff_weight": backoff_weight,
                "backoff_reps": backoff_reps,
                "backoff_percent": backoff_percent
            }
            target.update(kwargs)
            return target

        if not history:
            starting_weight = STARTING_WEIGHTS.get(exercise_name, 20)
            return build_target(
                starting_weight,
                min_range,
                "BASELINE",
                f"First time! Start with {starting_weight}kg for {min_range} reps.",
                confidence=50,
                is_new=True,
                trend_info=None
            )

        days_gap = self.get_days_since_last_session(exercise_name)
        last_session = history[0]
        last_stats = self.get_session_stats(last_session, (min_range, max_range))
        last_weight = last_stats["top_weight"]
        last_reps = [s.get("reps", 0) for s in last_stats["sets"]]
        last_avg_rpe = last_stats["avg_rpe"]

        if days_gap is not None and days_gap > 14:
            deload_factor, phase, phase_msg = self.get_return_deload_factor(days_gap)
            return_weight = round_to_increment(last_weight * deload_factor)
            deload_percent = int((1 - deload_factor) * 100)

            return build_target(
                return_weight,
                min_range,
                phase,
                phase_msg,
                confidence=85,
                is_new=False,
                trend_info=None,
                days_since_last=days_gap,
                last_weight=last_weight,
                last_reps=last_reps,
                last_rpe=round(last_avg_rpe, 1),
                deload_percent=deload_percent,
                previous=f"Last ({days_gap} days ago): {last_weight}kg × {last_reps}"
            )

        backoff_percent, backoff_note = self.get_backoff_adjustment(last_stats, (min_range, max_range))
        trend = self.analyze_multi_session_trend(exercise_name, (min_range, max_range), 3)

        if len(history) == 1:
            return build_target(
                last_weight,
                min_range + 1,
                "BUILD",
                f"Second session! Use {last_weight}kg again, aim for {min_range + 1} reps.",
                backoff_percent=backoff_percent,
                confidence=60,
                is_new=False,
                trend_info=trend,
                backoff_note=backoff_note,
                previous=f"Last: {last_weight}kg × {last_reps}"
            )

        is_plateaued, stall_count, plateau_msg = self.detect_plateau(exercise_name, (min_range, max_range))

        if last_stats["avg_rpe"] >= DELOAD_RPE or last_stats["min_reps"] < min_range - 1 or last_stats["rep_dropoff"] >= 4:
            deload_weight = round_to_increment(last_weight * 0.9)
            return build_target(
                deload_weight,
                min_range,
                "DELOAD",
                f"Fatigue spike detected. Reset to {deload_weight}kg and rebuild.",
                backoff_percent=backoff_percent,
                confidence=90,
                is_new=False,
                trend_info=trend,
                backoff_note=backoff_note,
                plateau_info=plateau_msg if is_plateaued else None
            )

        if is_plateaued and stall_count >= 3:
            deload_weight = round_to_increment(last_weight * 0.92)
            return build_target(
                deload_weight,
                min_range,
                "DELOAD",
                f"Plateau detected. Strategic deload to {deload_weight}kg.",
                backoff_percent=backoff_percent,
                confidence=90,
                is_new=False,
                trend_info=trend,
                backoff_note=backoff_note,
                plateau_info=plateau_msg
            )

        if last_stats["min_reps"] >= max_range and last_stats["avg_rpe"] <= (MAX_RPE - 0.5) and trend["trend"] != "DECLINING":
            new_weight = last_weight + increment
            return build_target(
                new_weight,
                min_range,
                "PROGRESS",
                f"Add weight! {new_weight}kg × {min_range} reps.",
                backoff_percent=backoff_percent,
                confidence=90,
                previous=f"Last 3 avg e1RM: {trend.get('avg_e1rm', 0)}kg",
                is_new=False,
                trend_info=trend,
                backoff_note=backoff_note
            )

        if last_stats["avg_reps"] >= max_range - 0.5 and last_stats["avg_rpe"] <= MAX_RPE:
            return build_target(
                last_weight,
                max_range,
                "PUSH",
                f"Hit {max_range} on all sets to unlock +{increment}kg.",
                backoff_percent=backoff_percent,
                confidence=80,
                previous=f"Last: {last_weight}kg × {last_reps}",
                is_new=False,
                trend_info=trend,
                backoff_note=backoff_note
            )

        if is_plateaued and last_stats["avg_rpe"] <= (MAX_RPE - 0.5):
            target_reps = min(max_range, max(int(round(last_stats["avg_reps"])), min_range))
            return build_target(
                last_weight,
                target_reps,
                "VOLUME",
                "Stalled but fresh. Add one back-off set for extra volume.",
                backoff_percent=backoff_percent,
                confidence=80,
                previous=f"Last: {last_weight}kg × {last_reps}",
                is_new=False,
                trend_info=trend,
                backoff_note=backoff_note,
                plateau_info=plateau_msg,
                suggested_extra_sets=1
            )

        if last_stats["avg_reps"] >= min_range:
            target_reps = min(int(last_stats["avg_reps"]) + 1, max_range)
            return build_target(
                last_weight,
                target_reps,
                "BUILD",
                f"Target: {last_weight}kg × {target_reps} reps.",
                backoff_percent=backoff_percent,
                confidence=75,
                previous=f"Last: {last_weight}kg × {last_reps}",
                is_new=False,
                trend_info=trend,
                backoff_note=backoff_note
            )

        return build_target(
            last_weight,
            min_range,
            "CONSOLIDATE",
            f"Same weight ({last_weight}kg), focus on clean {min_range} reps.",
            backoff_percent=backoff_percent,
            confidence=70,
            previous=f"Last: {last_weight}kg @ avg RPE {last_stats['avg_rpe']:.1f}",
            is_new=False,
            trend_info=trend,
            backoff_note=backoff_note,
            plateau_info=plateau_msg if is_plateaued else None
        )

    def get_workout_summary(self, workout_name: str, exercises: List[Dict]) -> List[Dict]:
        summary = []
        for ex in exercises:
            target = self.get_next_target(ex["name"], ex)
            target["exercise"] = ex
            summary.append(target)
        return summary

    def get_all_time_stats(self) -> Dict:
        if not self.exercise_history:
            return None
        stats = {"total_sessions": 0, "total_sets": 0, "total_reps": 0, "total_volume": 0,
                 "first_workout": None, "last_workout": None, "exercises": {}, "pr_list": []}
        all_dates = []

        for exercise_name, history in self.exercise_history.items():
            if not history:
                continue
            ex_stats = {"sessions": len(history), "current_weight": 0, "max_weight": 0,
                        "starting_weight": 0, "weight_gain": 0, "total_volume": 0, "avg_reps": 0}
            all_reps = []
            weights = []

            for session in history:
                date = session.get("date", "")
                if date:
                    all_dates.append(date)
                session_top_weight = get_session_top_weight(session)
                weights.append(session_top_weight)
                sets = get_session_sets(session)
                for s in sets:
                    reps = s.get("reps", 0)
                    all_reps.append(reps)
                    stats["total_reps"] += reps
                    stats["total_volume"] += s.get("weight", session_top_weight) * reps
                    stats["total_sets"] += 1

            if weights:
                ex_stats["current_weight"] = weights[0]
                ex_stats["max_weight"] = max(weights)
                ex_stats["starting_weight"] = weights[-1]
                ex_stats["weight_gain"] = weights[0] - weights[-1]
            if all_reps:
                ex_stats["avg_reps"] = round(sum(all_reps) / len(all_reps), 1)
            ex_stats["total_volume"] = sum([get_session_volume(h) for h in history])
            stats["exercises"][exercise_name] = ex_stats
            stats["total_sessions"] += len(history)
            if ex_stats["max_weight"] > 0:
                stats["pr_list"].append({"exercise": exercise_name, "weight": ex_stats["max_weight"]})

        if all_dates:
            stats["first_workout"] = min(all_dates)[:10]
            stats["last_workout"] = max(all_dates)[:10]
        stats["pr_list"] = sorted(stats["pr_list"], key=lambda x: x["weight"], reverse=True)
        return stats


# ============================================================================
# UI HELPERS
# ============================================================================

def get_brain_status() -> Tuple[str, str, str]:
    hour = datetime.now().hour
    if 6 <= hour < 9:
        return "🌅", "Morning Prep", "Fuel up and hydrate."
    elif 9 <= hour < 12:
        return "🧠", "Deep Work AM", "Peak cognitive hours."
    elif 12 <= hour < 14:
        return "🍽️", "Lunch & Digest", "Eat, walk 15 min after."
    elif 14 <= hour < 17:
        return "🧠", "Deep Work PM", "Second study block."
    elif 17 <= hour < 20:
        return "💪", "GYM MODE", "Time to grow those legs!"
    elif 20 <= hour < 22:
        return "🍽️", "Dinner & Wind Down", "Eat, relax."
    elif 22 <= hour < 24:
        return "🌙", "Recovery Mode", "Sleep is gains."
    else:
        return "😴", "Sleep Time", "Recovery is key."


def create_exercise_link(name: str, url: str) -> str:
    return f"[{name}]({url})"


def format_recommendation_badge(recommendation: str) -> str:
    colors = {
        "PROGRESS": "🟢", "PUSH": "🔵", "BUILD": "🟡", "CONSOLIDATE": "🟠",
        "DELOAD": "🔴", "BASELINE": "⚪", "NORMAL": "🟢", "VOLUME": "🟡",
        "LIGHT_RETURN": "🔵", "REACCLIMATION": "🟡", "REBUILDING": "🟠", "FRESH_START": "🔴"
    }
    return f"{colors.get(recommendation, '⚪')} {recommendation.replace('_', ' ')}"


def format_trend_badge(trend: str) -> str:
    indicators = {"IMPROVING": "📈", "STABLE": "➡️", "DECLINING": "📉", "VARIABLE": "〰️", "NO_DATA": "❓"}
    return indicators.get(trend, "❓")


def get_holiday_css() -> str:
    return """<style>
        .stApp { background: linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 50%, #80deea 100%) !important; }
        .frozen-banner { background: linear-gradient(90deg, #00bcd4, #4dd0e1, #00bcd4);
            padding: 20px; border-radius: 15px; text-align: center; margin: 20px 0; }
        </style>"""


def get_normal_css() -> str:
    return """<style>
        .stApp { max-width: 100%; }
        .stButton > button { width: 100%; padding: 0.75rem 1rem; font-size: 1.1rem; border-radius: 10px; }
        .stNumberInput > div > div > input { text-align: center; font-size: 1.2rem; }
        #MainMenu {visibility: hidden;} footer {visibility: hidden;}
        .pr-celebration { font-size: 2rem; text-align: center; padding: 20px;
            background: linear-gradient(90deg, #ffd700, #ffec8b, #ffd700);
            border-radius: 15px; animation: pulse 1s infinite; }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        </style>"""


# ============================================================================
# STREAMLIT APP
# ============================================================================

def main():
    st.set_page_config(page_title="NeuroLegs", page_icon="🦵", layout="centered", initial_sidebar_state="collapsed")

    if not check_password():
        return

    if "logs" not in st.session_state:
        st.session_state["logs"] = load_logs()
    if "settings" not in st.session_state:
        st.session_state["settings"] = load_settings()

    logs = st.session_state["logs"]
    settings = st.session_state["settings"]
    coach = AdaptiveCoach(logs)

    if settings.get("holiday_mode", False):
        st.markdown(get_holiday_css(), unsafe_allow_html=True)
    else:
        st.markdown(get_normal_css(), unsafe_allow_html=True)

    # Header with streak
    if not settings.get("holiday_mode", False):
        streak = calculate_streak(logs, settings)
        status_emoji, status_name, status_msg = get_brain_status()
        col1, col2, col3 = st.columns([1, 2, 1])
        with col1:
            st.markdown(f"# {status_emoji}")
        with col2:
            st.markdown(f"### {status_name}")
            st.caption(status_msg)
        with col3:
            st.metric("🔥 Streak", f"{streak['current_streak_weeks']}w")
    else:
        st.markdown('<div class="frozen-banner"><h1>❄️ HOLIDAY MODE ❄️</h1></div>', unsafe_allow_html=True)

    st.divider()

    # Navigation
    tab1, tab2, tab3, tab4, tab5, tab6, tab7, tab8 = st.tabs([
        "🏋️ Today", "📝 Log", "📊 Progress", "📈 Analytics", "🔢 Tools", "📘 Progression", "⚙️ Settings", "📚 Library"
    ])

    # ========== TAB 1: TODAY ==========
    with tab1:
        if settings.get("holiday_mode", False):
            st.info("Training frozen. Go to Settings to deactivate.")
        else:
            workout_name, exercises = get_today_workout_with_settings(settings)

            # Week preview
            st.markdown("### 📅 This Week")
            week_preview = get_week_schedule_preview(settings)
            cols = st.columns(7)
            for i, day in enumerate(week_preview):
                with cols[i]:
                    if day["is_today"]:
                        st.markdown(f"**{day['day']}**")
                        st.markdown(f"📍 {day['workout'][:5] if day['workout'] != 'Rest' else '😴'}")
                    else:
                        st.caption(day['day'])
                        st.caption(day['workout'][:5] if day['workout'] != 'Rest' else '😴')

            st.divider()

            if workout_name == "Rest":
                st.markdown("## 😴 Rest Day")
                st.info("Recovery is when you grow! Light walking, stretching, hydration.")
                next_workout, next_day, days_until = get_next_training_day(settings)
                st.write(f"**Next:** {next_workout} on {next_day}")
            else:
                st.markdown(f"## {workout_name}")

                # Skip session
                with st.expander("⏭️ Skip Today's Session"):
                    c1, c2 = st.columns(2)
                    with c1:
                        if st.button("🔄 Push +1 Day", use_container_width=True):
                            if "skipped_sessions" not in logs: logs["skipped_sessions"] = []
                            skip_entry = {"date": datetime.now().isoformat(), "workout": workout_name, "action": "push"}
                            logs["skipped_sessions"].append(skip_entry)
                            append_skipped_sessions([[skip_entry["date"], skip_entry["workout"], skip_entry["action"]]])
                            settings["schedule_offset"] = settings.get("schedule_offset", 0) + 1
                            save_settings(settings)
                            st.rerun()
                    with c2:
                        if st.button("⏩ Skip Only", use_container_width=True):
                            if "skipped_sessions" not in logs: logs["skipped_sessions"] = []
                            skip_entry = {"date": datetime.now().isoformat(), "workout": workout_name, "action": "skip"}
                            logs["skipped_sessions"].append(skip_entry)
                            append_skipped_sessions([[skip_entry["date"], skip_entry["workout"], skip_entry["action"]]])
                            st.success("Skipped!")

                st.divider()

                targets = coach.get_workout_summary(workout_name, exercises)
                for target in targets:
                    ex = target["exercise"]
                    st.markdown(f"### {create_exercise_link(ex['name'], ex['video'])}")
                    c1, c2 = st.columns([2, 1])
                    with c1:
                        st.markdown(f"**Top: {target['weight']}kg × {target['reps_per_set']}**")
                        if ex["sets"] > 1:
                            st.caption(
                                f"Back-off: {target['backoff_weight']}kg × {target['backoff_reps']} × {ex['sets'] - 1} sets "
                                f"({int(target.get('backoff_percent', BACKOFF_PERCENT) * 100)}%)"
                            )
                        else:
                            st.caption(f"{ex['sets']} set")
                        if target.get("backoff_note"):
                            st.caption(target["backoff_note"])
                        if target.get("suggested_extra_sets"):
                            st.caption("Volume boost: +1 extra back-off set if you feel fresh.")
                        if "previous" in target:
                            st.caption(target["previous"])
                    with c2:
                        st.markdown(format_recommendation_badge(target["recommendation"]))

                    with st.expander("💡 Coach + Warm-up"):
                        st.write(target["message"])
                        st.caption(f"Rest: {ex['rest']}")

                        # Warm-up sets
                        if target["weight"] and target["weight"] >= 30:
                            st.markdown("**Warm-up Protocol:**")
                            warmup = generate_warmup_sets(target["weight"], target["reps_per_set"])
                            for w in warmup:
                                st.write(f"• {w['weight']}kg × {w['reps']} - {w['notes']}")
                    st.divider()

    # ========== TAB 2: LOG ==========
    with tab2:
        if settings.get("holiday_mode", False):
            st.info("Logging disabled during holiday.")
        else:
            st.markdown("## 📝 Log Workout")

            workout_name, _ = get_today_workout_with_settings(settings)
            selected_workout = st.selectbox("Workout", ["Legs A", "Legs B", "Legs C"],
                index=["Legs A", "Legs B", "Legs C"].index(workout_name) if workout_name not in ["Rest", "Holiday"] else 0)

            selected_exercises = EXERCISES[selected_workout]
            with st.expander("⏱️ Rest Timer"):
                rest_exercise_name = st.selectbox(
                    "Exercise",
                    [ex["name"] for ex in selected_exercises],
                    key="rest_timer_exercise"
                )
                rest_exercise = next(ex for ex in selected_exercises if ex["name"] == rest_exercise_name)
                rest_time = rest_exercise.get("rest_seconds", 90)
                st.write(f"Recommended rest: **{rest_time}s**")
                timer_options = sorted({30, 60, 90, 120, 180, rest_time})
                selected_time = st.select_slider(
                    "Timer (seconds)",
                    options=timer_options,
                    value=rest_time,
                    key="rest_timer_seconds"
                )
                if st.button("▶️ Start Timer", use_container_width=True, key="rest_timer_start"):
                    progress_bar = st.progress(0)
                    timer_text = st.empty()
                    for i in range(selected_time, 0, -1):
                        progress_bar.progress((selected_time - i) / selected_time)
                        timer_text.markdown(f"### ⏱️ {i}s")
                        time.sleep(1)
                    progress_bar.progress(1.0)
                    timer_text.markdown("### ✅ GO!")
                    st.balloons()
            log_scheme = st.radio(
                "Set Scheme",
                ["Straight Sets", "Top Set + Back-off"],
                horizontal=True,
                key="log_scheme",
                index=1
            )
            st.caption("Fill out the full session and save everything in one shot.")

            with st.form("log_session_form"):
                session_data = []
                for exercise in selected_exercises:
                    exercise_name = exercise["name"]
                    target = coach.get_next_target(exercise_name, exercise)

                    st.markdown(f"### {create_exercise_link(exercise_name, exercise['video'])}")
                    c1, c2, c3 = st.columns(3)
                    with c1: st.metric("Target Weight", f"{target['weight']}kg")
                    with c2: st.metric("Target Reps", f"{target['reps_per_set']}")
                    with c3: st.metric("Status", target["recommendation"])

                    if "previous" in target:
                        st.caption(target["previous"])
                    min_r, max_r = exercise["rep_range"]
                    st.caption(f"Rep range: {min_r}-{max_r} • Rest: {exercise['rest']}")
                    if target.get("backoff_note"):
                        st.caption(target["backoff_note"])

                    # Return-from-break warning
                    if target.get("days_since_last") and target["days_since_last"] > 14:
                        days = target["days_since_last"]
                        st.warning(f"**Welcome back!** You haven't trained {exercise_name} in **{days} days**")
                        col1, col2 = st.columns(2)
                        with col1:
                            st.info(f"**Last session:** {target['last_weight']}kg × {target['last_reps']} @ RPE {target['last_rpe']}")
                        with col2:
                            st.success(f"**Recommended:** {target['weight']}kg ({target['deload_percent']}% deload)")

                    st.info(target["message"])

                    key_prefix = f"log_{selected_workout}_{exercise_name}".replace(" ", "_")
                    use_backoff = log_scheme == "Top Set + Back-off"
                    is_compound = exercise_name in COMPOUND_EXERCISES
                    increment = WEIGHT_INCREMENT["compound"] if is_compound else WEIGHT_INCREMENT["isolation"]

                    if use_backoff:
                        top_weight = st.number_input(
                            "Top Set Weight (kg)",
                            min_value=0.0,
                            max_value=500.0,
                            value=float(target["weight"]) if target["weight"] else 20.0,
                            step=increment,
                            key=f"{key_prefix}_top_weight"
                        )
                        backoff_percent = target.get("backoff_percent", BACKOFF_PERCENT)
                        suggested_backoff = round(top_weight * backoff_percent / increment) * increment
                        backoff_weight = st.number_input(
                            "Back-off Weight (kg)",
                            min_value=0.0,
                            max_value=500.0,
                            value=float(suggested_backoff),
                            step=increment,
                            key=f"{key_prefix}_backoff_weight"
                        )
                        working_weight = top_weight
                        st.caption(
                            f"Back-off target: {backoff_weight}kg × {target.get('backoff_reps', target['reps_per_set'])} reps "
                            f"({int(backoff_percent * 100)}%)"
                        )
                    else:
                        working_weight = st.number_input(
                            "Weight (kg)",
                            min_value=0.0,
                            max_value=500.0,
                            value=float(target["weight"]) if target["weight"] else 20.0,
                            step=increment,
                            key=f"{key_prefix}_weight"
                        )
                        backoff_weight = working_weight

                    extra_sets = 0
                    if target.get("suggested_extra_sets"):
                        extra_sets = 1 if st.checkbox(
                            "Add 1 extra set (recommended)",
                            key=f"{key_prefix}_extra_set"
                        ) else 0

                    sets_data = []
                    set_count = exercise["sets"] + extra_sets
                    cols = st.columns(set_count)
                    for i, col in enumerate(cols):
                        with col:
                            if use_backoff:
                                set_label = "Top Set" if i == 0 else f"Back-off {i}"
                                set_weight = working_weight if i == 0 else backoff_weight
                                default_reps = target["reps_per_set"] if i == 0 else target.get("backoff_reps", target["reps_per_set"])
                            else:
                                set_label = f"Set {i+1}"
                                set_weight = working_weight
                                default_reps = target["reps_per_set"]

                            st.markdown(f"**{set_label}**")
                            reps = st.number_input(
                                "Reps",
                                min_value=0,
                                max_value=50,
                                value=default_reps,
                                key=f"{key_prefix}_reps_{i}"
                            )
                            rpe = st.slider(
                                "RPE",
                                5.0,
                                10.0,
                                8.0,
                                0.5,
                                key=f"{key_prefix}_rpe_{i}"
                            )
                            sets_data.append({"reps": reps, "rpe": rpe, "weight": set_weight})

                    notes = st.text_area("Notes", placeholder="How did it feel?", key=f"{key_prefix}_notes")

                    session_data.append({
                        "exercise": exercise,
                        "weight": working_weight,
                        "sets": sets_data,
                        "notes": notes
                    })

                    st.markdown("---")

                submitted = st.form_submit_button("✅ Save Session", type="primary", use_container_width=True)

            if submitted:
                session_time = datetime.now().isoformat()
                pr_hits = []
                score_lines = []
                workout_rows = []

                for entry in session_data:
                    exercise = entry["exercise"]
                    exercise_name = exercise["name"]
                    weight = entry["weight"]
                    sets_data = entry["sets"]
                    notes = entry["notes"]

                    session_top_weight = max([s.get("weight", weight) for s in sets_data]) if sets_data else weight
                    is_pr, old_pr = check_for_new_pr(exercise_name, session_top_weight, logs)

                    log_entry = {
                        "date": session_time,
                        "workout": selected_workout,
                        "weight": session_top_weight,
                        "sets": sets_data,
                        "notes": notes
                    }

                    if exercise_name not in logs["exercises"]:
                        logs["exercises"][exercise_name] = []
                    logs["exercises"][exercise_name].insert(0, log_entry)
                    logs["workouts"].append({
                        "date": session_time,
                        "workout_type": selected_workout,
                        "exercise": exercise_name,
                        "data": log_entry
                    })
                    workout_rows.append([
                        session_time,
                        selected_workout,
                        exercise_name,
                        session_top_weight,
                        serialize_sets(sets_data),
                        notes
                    ])

                    min_r, max_r = exercise["rep_range"]
                    score, consistency = coach.calculate_session_score(sets_data, min_r, max_r)
                    score_lines.append(f"{exercise_name}: {score:.0f}/100 - {consistency}")

                    if is_pr and session_top_weight > old_pr:
                        pr_hits.append(f"{exercise_name}: {session_top_weight}kg (+{session_top_weight-old_pr}kg)")

                append_workout_logs(workout_rows)

                if pr_hits:
                    pr_details = "<br>".join(pr_hits)
                    st.markdown(
                        f'<div class="pr-celebration">🏆 NEW PR! 🏆<br>{pr_details}</div>',
                        unsafe_allow_html=True
                    )
                    st.balloons()

                st.success("Session logged!")
                for line in score_lines:
                    st.write(f"• {line}")

    # ========== TAB 3: PROGRESS ==========
    with tab3:
        st.markdown("## 📊 Exercise Progress")
        if not logs.get("exercises"):
            st.info("No data yet. Start logging!")
        else:
            selected_ex = st.selectbox("Exercise", list(logs["exercises"].keys()), key="progress_ex")
            history = logs["exercises"].get(selected_ex, [])

            if history:
                df_data = []
                for entry in reversed(history):
                    date = entry.get("date", "")[:10]
                    sets = get_session_sets(entry)
                    top_weight = get_session_top_weight(entry)
                    avg_reps = sum([s.get("reps", 0) for s in sets]) / max(1, len(sets))
                    volume = sum([s.get("weight", top_weight) * s.get("reps", 0) for s in sets])
                    df_data.append({"Date": date, "Weight": top_weight, "Avg Reps": round(avg_reps, 1), "Volume": volume})

                df = pd.DataFrame(df_data)

                c1, c2, c3 = st.columns(3)
                with c1: st.metric("Current", f"{df['Weight'].iloc[-1]}kg", f"+{df['Weight'].iloc[-1] - df['Weight'].iloc[0]}kg")
                with c2: st.metric("PR", f"{df['Weight'].max()}kg")
                with c3: st.metric("Sessions", len(history))

                fig = px.line(df, x="Date", y="Weight", markers=True)
                fig.update_traces(line_color="#4CAF50")
                st.plotly_chart(fig, use_container_width=True)

                # 1RM Estimate
                if history:
                    latest = history[0]
                    latest_sets = get_session_sets(latest)
                    if latest_sets:
                        best_set = max(
                            latest_sets,
                            key=lambda s: estimate_e1rm(s.get("weight", 0), s.get("reps", 0), s.get("rpe", TARGET_RPE))
                        )
                        est_1rm = estimate_e1rm(
                            best_set.get("weight", 0),
                            best_set.get("reps", 0),
                            best_set.get("rpe", TARGET_RPE)
                        )
                        st.info(
                            f"**Estimated 1RM:** {est_1rm:.1f}kg "
                            f"(best set: {best_set.get('weight', 0)}kg × {best_set.get('reps', 0)} reps @ RPE {best_set.get('rpe', TARGET_RPE)})"
                        )

    # ========== TAB 4: ANALYTICS ==========
    with tab4:
        st.markdown("## 📈 Analytics")
        all_stats = coach.get_all_time_stats()

        if not all_stats:
            st.info("No data yet!")
        else:
            streak = calculate_streak(logs, settings)

            # Streak display
            st.markdown("### 🔥 Training Consistency")
            c1, c2, c3, c4 = st.columns(4)
            with c1: st.metric("Current Streak", f"{streak['current_streak_weeks']} weeks")
            with c2: st.metric("Longest Streak", f"{streak['longest_streak_weeks']} weeks")
            with c3: st.metric("This Week", f"{streak['workouts_this_week']}/3")
            with c4: st.metric("Consistency", f"{streak['consistency_percent']}%")

            st.divider()

            weekly_review = get_weekly_review(logs)
            recent = weekly_review["recent"]
            previous = weekly_review["previous"]
            if recent["sessions"] > 0:
                st.markdown("### 📅 Weekly Performance Review")
                prev_has_data = previous["sessions"] > 0
                c1, c2, c3, c4 = st.columns(4)
                with c1:
                    st.metric(
                        "Sessions",
                        recent["sessions"],
                        delta=(recent["sessions"] - previous["sessions"]) if prev_has_data else None
                    )
                with c2:
                    st.metric(
                        "Volume",
                        f"{recent['volume']:.0f}kg",
                        delta=(f"{recent['volume'] - previous['volume']:.0f}kg" if prev_has_data else None)
                    )
                with c3:
                    st.metric(
                        "Avg RPE",
                        f"{recent['avg_rpe']:.2f}",
                        delta=(round(recent["avg_rpe"] - previous["avg_rpe"], 2) if prev_has_data else None)
                    )
                with c4:
                    st.metric(
                        "Avg e1RM",
                        f"{recent['avg_e1rm']:.1f}kg",
                        delta=(f"{recent['avg_e1rm'] - previous['avg_e1rm']:.1f}kg" if prev_has_data else None)
                    )
                if not prev_has_data:
                    st.caption("Not enough prior-week data for deltas yet.")
                st.divider()

            c1, c2, c3, c4 = st.columns(4)
            with c1: st.metric("Sessions", all_stats["total_sessions"])
            with c2: st.metric("Sets", all_stats["total_sets"])
            with c3: st.metric("Reps", f"{all_stats['total_reps']:,}")
            with c4: st.metric("Volume", f"{all_stats['total_volume']:,.0f}kg")

            st.divider()
            st.markdown("### 🏅 PRs")
            for i, pr in enumerate(all_stats["pr_list"][:5]):
                medal = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"][i]
                st.write(f"{medal} **{pr['exercise']}**: {pr['weight']}kg")

    # ========== TAB 5: TOOLS ==========
    with tab5:
        st.markdown("## 🔢 Training Tools")

        tool = st.radio("Select Tool", ["1RM Calculator", "Warm-up Generator", "Body Measurements"], horizontal=True)

        if tool == "1RM Calculator":
            st.markdown("### 🏋️ 1RM Calculator")
            c1, c2 = st.columns(2)
            with c1:
                calc_weight = st.number_input("Weight lifted (kg)", min_value=0.0, value=60.0, step=2.5)
            with c2:
                calc_reps = st.number_input("Reps performed", min_value=1, max_value=12, value=5)

            if st.button("Calculate 1RM", type="primary"):
                one_rm = calculate_1rm(calc_weight, calc_reps)
                st.success(f"**Estimated 1RM: {one_rm:.1f}kg**")

                st.markdown("### Training Weights")
                percentages = get_percentages_from_1rm(one_rm)
                for label, weight in percentages.items():
                    st.write(f"• {label}: **{weight}kg**")

        elif tool == "Warm-up Generator":
            st.markdown("### 🔥 Warm-up Generator")
            working_weight = st.number_input("Working weight (kg)", min_value=20.0, value=60.0, step=2.5)
            working_reps = st.number_input("Working reps", min_value=1, max_value=20, value=5)

            if st.button("Generate Warm-up", type="primary"):
                warmup = generate_warmup_sets(working_weight, working_reps)
                st.markdown("### Your Warm-up Protocol")
                for i, w in enumerate(warmup, 1):
                    st.write(f"**Set {i}:** {w['weight']}kg × {w['reps']} reps - *{w['notes']}*")
                st.info(f"Then proceed to working sets: {working_weight}kg × {working_reps} reps")

        else:  # Body Measurements
            st.markdown("### 📏 Body Measurements")

            with st.form("measurements_form"):
                c1, c2 = st.columns(2)
                with c1:
                    body_weight = st.number_input("Body Weight (kg)", min_value=30.0, max_value=200.0, value=61.1)
                    left_thigh = st.number_input("Left Thigh (cm)", min_value=20.0, max_value=100.0, value=50.0)
                    left_calf = st.number_input("Left Calf (cm)", min_value=20.0, max_value=60.0, value=35.0)
                with c2:
                    measure_notes = st.text_input("Notes", placeholder="Morning, relaxed...")
                    right_thigh = st.number_input("Right Thigh (cm)", min_value=20.0, max_value=100.0, value=50.0)
                    right_calf = st.number_input("Right Calf (cm)", min_value=20.0, max_value=60.0, value=35.0)

                if st.form_submit_button("Save Measurements", type="primary"):
                    if "measurements" not in logs:
                        logs["measurements"] = []
                    measurement_entry = {
                        "date": datetime.now().isoformat()[:10],
                        "body_weight": body_weight,
                        "left_thigh": left_thigh,
                        "right_thigh": right_thigh,
                        "left_calf": left_calf,
                        "right_calf": right_calf,
                        "notes": measure_notes
                    }
                    logs["measurements"].append(measurement_entry)
                    append_measurements([[
                        measurement_entry["date"],
                        measurement_entry["body_weight"],
                        measurement_entry["left_thigh"],
                        measurement_entry["right_thigh"],
                        measurement_entry["left_calf"],
                        measurement_entry["right_calf"],
                        measurement_entry["notes"]
                    ]])
                    st.success("Measurements saved!")

            # Show history
            if logs.get("measurements"):
                st.markdown("### 📊 Measurement History")
                mdf = pd.DataFrame(logs["measurements"])
                st.dataframe(mdf, use_container_width=True, hide_index=True)

                if len(mdf) > 1:
                    fig = px.line(mdf, x="date", y=["left_thigh", "right_thigh"], markers=True,
                                 labels={"value": "cm", "variable": "Measurement"})
                    st.plotly_chart(fig, use_container_width=True)

    # ========== TAB 6: PROGRESSION ==========
    with tab5:
        pass  # Handled above in tools

    with tab6:
        st.markdown("## 📘 Progression System")
        st.caption("How the app decides weight, reps, back-off loads, and deloads.")

        c1, c2, c3, c4 = st.columns(4)
        with c1: st.metric("Target RPE", f"{TARGET_RPE:.1f}")
        with c2: st.metric("Back-off", f"{int(BACKOFF_PERCENT * 100)}%")
        with c3: st.metric("Comp. Jump", f"+{WEIGHT_INCREMENT['compound']}kg")
        with c4: st.metric("Iso Jump", f"+{WEIGHT_INCREMENT['isolation']}kg")

        st.divider()
        st.markdown("### Core Structure")
        st.write("• Each exercise uses a top set (main overload signal) plus back-off sets (volume).")
        st.write("• Top set drives progression; back-off sets drive muscle-building volume and quality.")
        st.write("• You can switch to Straight Sets anytime from the Log tab.")

        st.markdown("### Progression Rules")
        st.write("• Add load when top set reaches the top of the rep range with manageable RPE and trend is stable or improving.")
        st.write("• If near the top of the range, keep load and push reps first.")
        st.write("• If reps drop below range or RPE spikes, load is held and you consolidate or deload.")

        st.markdown("### Auto Back-off Adjustments")
        st.write("• Back-off load is auto-tuned based on your last session performance.")
        st.write("• If top set succeeds but back-off quality collapses, back-off load is reduced (up to 80%).")
        st.write("• If back-offs are strong and controlled, back-off load can increase (up to 95%).")

        st.markdown("### Fatigue & Deload Logic")
        st.write("• Deload triggers when RPE is very high, reps crash, or drop-off is large.")
        st.write("• After long breaks, the system auto-reduces load and ramps back in.")

        st.markdown("### Volume Boosts")
        st.write("• If you stall but RPE is stable, the system recommends one extra back-off set.")
        st.write("• Volume is the lever for growth; load is the lever for strength.")

        st.markdown("### Trend Tracking")
        st.write("• e1RM is estimated from your best set and tracked across sessions.")
        st.write("• Weekly review compares volume, RPE, and e1RM to keep progress on track.")

    # ========== TAB 7: SETTINGS ==========
    with tab7:
        st.markdown("## ⚙️ Settings")

        # Holiday Mode
        st.markdown("### ❄️ Holiday Mode")
        if settings.get("holiday_mode"):
            if st.button("☀️ Deactivate Holiday", type="primary", use_container_width=True):
                settings["holiday_mode"] = False
                save_settings(settings)
                st.rerun()
        else:
            if st.button("❄️ Activate Holiday", use_container_width=True):
                settings["holiday_mode"] = True
                settings["holiday_start"] = datetime.now().isoformat()
                save_settings(settings)
                st.rerun()

        st.divider()

        # CSV Export/Import
        st.markdown("### 💾 Data Export/Import")

        c1, c2 = st.columns(2)
        with c1:
            csv_data = export_logs_to_csv(logs)
            st.download_button("📥 Download Workouts CSV", csv_data, "neurolegs_workouts.csv", "text/csv", use_container_width=True)
        with c2:
            measurements_csv = export_measurements_to_csv(logs)
            st.download_button("📥 Download Measurements CSV", measurements_csv, "neurolegs_measurements.csv", "text/csv", use_container_width=True)

        st.markdown("**Import CSV:**")
        uploaded_file = st.file_uploader("Upload workout CSV", type=["csv"])
        if uploaded_file:
            if st.button("Import Data"):
                content = uploaded_file.getvalue().decode("utf-8")
                logs, count, imported_rows = import_csv_to_logs(content, logs)
                if count > 0:
                    append_workout_logs(imported_rows)
                    st.success(f"Imported {count} workout entries!")
                else:
                    st.error("Import failed. Check CSV format.")

        st.divider()

        # Schedule reset
        if settings.get("schedule_offset", 0) > 0:
            st.markdown("### 📅 Schedule")
            st.write(f"Offset: {settings['schedule_offset']} days")
            if st.button("Reset Schedule"):
                settings["schedule_offset"] = 0
                save_settings(settings)
                st.rerun()

        st.divider()

        # Stats
        st.markdown("### 📊 Data Stats")
        st.write(f"Exercises tracked: {len(logs.get('exercises', {}))}")
        st.write(f"Total workouts: {len(logs.get('workouts', []))}")
        st.write(f"Measurements: {len(logs.get('measurements', []))}")

    # ========== TAB 8: EXERCISE LIBRARY ==========
    with tab8:
        st.markdown("## 📚 Exercise Library")
        st.caption("All exercises you've ever trained, including inactive ones")

        all_exercises = logs.get("exercises", {})

        if not all_exercises:
            st.info("No exercise history yet. Start logging workouts to build your library!")
        else:
            # Summary stats
            active_count = 0
            inactive_count = 0
            for ex_name in all_exercises:
                days = coach.get_days_since_last_session(ex_name)
                if days is not None and days <= 14:
                    active_count += 1
                else:
                    inactive_count += 1

            c1, c2, c3 = st.columns(3)
            with c1:
                st.metric("Total Exercises", len(all_exercises))
            with c2:
                st.metric("Active (< 14 days)", active_count)
            with c3:
                st.metric("Inactive", inactive_count)

            st.divider()

            # Filter options
            filter_option = st.radio("Show", ["All", "Active Only", "Inactive Only"], horizontal=True)

            # Sort exercises by last trained date
            exercise_list = []
            for ex_name, history in all_exercises.items():
                if not history:
                    continue
                days_gap = coach.get_days_since_last_session(ex_name)
                if days_gap is None:
                    days_gap = 9999

                # Apply filter
                if filter_option == "Active Only" and days_gap > 14:
                    continue
                if filter_option == "Inactive Only" and days_gap <= 14:
                    continue

                best_weight = max(get_session_top_weight(h) for h in history)
                last_session = history[0] if history else {}
                exercise_list.append({
                    "name": ex_name,
                    "days_gap": days_gap,
                    "sessions": len(history),
                    "best_weight": best_weight,
                    "last_weight": get_session_top_weight(last_session) if last_session else 0,
                    "last_session": last_session
                })

            # Sort by days since last (most recent first)
            exercise_list.sort(key=lambda x: x["days_gap"])

            for ex in exercise_list:
                days = ex["days_gap"]
                if days <= 14:
                    status_icon = "🟢"
                    status_text = f"Active ({days}d ago)"
                elif days <= 28:
                    status_icon = "🟡"
                    status_text = f"Recent ({days}d ago)"
                elif days <= 56:
                    status_icon = "🟠"
                    status_text = f"Inactive ({days}d)"
                elif days < 9999:
                    status_icon = "🔴"
                    status_text = f"Long break ({days}d)"
                else:
                    status_icon = "⚪"
                    status_text = "Unknown"

                with st.expander(f"{status_icon} **{ex['name']}** - {status_text}"):
                    c1, c2, c3 = st.columns(3)
                    with c1:
                        st.metric("Last Weight", f"{ex['last_weight']}kg")
                    with c2:
                        st.metric("PR Weight", f"{ex['best_weight']}kg")
                    with c3:
                        st.metric("Total Sessions", ex["sessions"])

                    # Show return recommendation if inactive
                    if days > 14:
                        deload_factor, phase, msg = coach.get_return_deload_factor(days)
                        return_weight = round(ex["last_weight"] * deload_factor / 2.5) * 2.5
                        deload_pct = int((1 - deload_factor) * 100)
                        st.info(f"**Return recommendation:** Start at **{return_weight}kg** ({deload_pct}% deload) - {msg}")

                    # Last session details
                    if ex["last_session"]:
                        sets = get_session_sets(ex["last_session"])
                        if sets:
                            reps = [s.get("reps", 0) for s in sets]
                            rpe = [s.get("rpe", 8) for s in sets]
                            st.caption(f"Last: {ex['last_weight']}kg × {reps} @ RPE {[round(r, 1) for r in rpe]}")

    # Footer
    st.divider()
    c1, c2 = st.columns([3, 1])
    with c1:
        st.caption(f"NeuroLegs v2.0 | {datetime.now().strftime('%H:%M')}")
    with c2:
        if st.button("🚪 Logout"):
            st.session_state.authenticated = False
            st.rerun()


if __name__ == "__main__":
    main()
