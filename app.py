"""
NeuroLegs - Adaptive Leg Training Coach
A sophisticated, mobile-first Streamlit application for science-based leg development.

Author: AI Strength & Conditioning Coach
Target User: 22-year-old student, 61.1kg, experienced lifter with lagging legs
"""

import streamlit as st
import pandas as pd
import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

# ============================================================================
# CONFIGURATION & CONSTANTS
# ============================================================================

APP_TITLE = "🦵 NeuroLegs"
DATA_FILE = "workout_logs.json"
SETTINGS_FILE = "user_settings.json"
APP_PASSWORD = "01012026"

# User Profile
USER_PROFILE = {
    "weight_kg": 61.1,
    "age": 22,
    "protein_g": 125,
    "carbs_g": 415,
    "fats_g": 60,
    "supplements": {
        "creatine_g": 5,
        "maltodextrin_g": 40,
        "whey_g": 30
    }
}

# Base schedule mapping (0 = Monday)
BASE_SCHEDULE = {
    0: "Legs A",  # Monday - Squat Focus
    1: "Rest",    # Tuesday
    2: "Legs B",  # Wednesday - Hinge Focus
    3: "Rest",    # Thursday
    4: "Legs C",  # Friday - Hypertrophy
    5: "Rest",    # Saturday
    6: "Rest"     # Sunday
}

# Weight increments for progression
WEIGHT_INCREMENT = {
    "compound": 2.5,
    "isolation": 1.25
}

# Compound exercises list
COMPOUND_EXERCISES = [
    "High Bar Squat", "Romanian Deadlift", "Leg Press",
    "Unilateral Leg Press", "Hack Squat", "Hip Thrust"
]

# Exercise database
EXERCISES = {
    "Legs A": [
        {
            "name": "High Bar Squat",
            "sets": 3,
            "rep_range": (5, 8),
            "rest": "3 min",
            "video": "https://www.youtube.com/watch?v=eMYjBnIVb_A",
            "notes": "Primary quad builder. Brace hard, hit depth."
        },
        {
            "name": "Leg Extension",
            "sets": 3,
            "rep_range": (10, 12),
            "rest": "90s",
            "video": "https://www.youtube.com/watch?v=WaRl1k71iT0",
            "notes": "Squeeze at top, control the negative."
        },
        {
            "name": "Leg Press",
            "sets": 3,
            "rep_range": (10, 12),
            "rest": "2 min",
            "video": "https://www.youtube.com/watch?v=8nm863C0c60",
            "notes": "Feet shoulder-width, full ROM."
        },
        {
            "name": "Seated Leg Curl",
            "sets": 3,
            "rep_range": (12, 15),
            "rest": "90s",
            "video": "https://www.youtube.com/watch?v=OrxowZ4l3yI",
            "notes": "Point toes, squeeze hamstrings."
        },
        {
            "name": "Standing Calf Raise",
            "sets": 4,
            "rep_range": (8, 10),
            "rest": "60s",
            "video": "https://www.youtube.com/watch?v=-M4-G8p8fmc",
            "notes": "Full stretch at bottom, pause at top."
        }
    ],
    "Legs B": [
        {
            "name": "Romanian Deadlift",
            "sets": 3,
            "rep_range": (8, 10),
            "rest": "3 min",
            "video": "https://www.youtube.com/watch?v=JCXUYuzwNrM",
            "notes": "Hinge pattern. Feel the hamstring stretch."
        },
        {
            "name": "Unilateral Leg Press",
            "sets": 3,
            "rep_range": (10, 12),
            "rest": "2 min",
            "video": "https://www.youtube.com/watch?v=8nm863C0c60",
            "notes": "One leg at a time. Balance strength."
        },
        {
            "name": "Lying Leg Curl",
            "sets": 3,
            "rep_range": (12, 15),
            "rest": "60s",
            "video": "https://www.youtube.com/watch?v=1Tq3QdYUuHs",
            "notes": "Squeeze hard at peak contraction."
        },
        {
            "name": "Adductor Machine",
            "sets": 3,
            "rep_range": (15, 20),
            "rest": "60s",
            "video": "https://www.youtube.com/watch?v=KaEp53Hj-EU",
            "notes": "Inner thigh focus. Control both phases."
        },
        {
            "name": "Seated Calf Raise",
            "sets": 4,
            "rep_range": (15, 20),
            "rest": "60s",
            "video": "https://www.youtube.com/watch?v=-M4-G8p8fmc",
            "notes": "Soleus focus. Deep stretch, hard squeeze."
        }
    ],
    "Legs C": [
        {
            "name": "Hack Squat",
            "sets": 3,
            "rep_range": (10, 12),
            "rest": "3 min",
            "video": "https://www.youtube.com/watch?v=0tmSzVHnh_s",
            "notes": "Quad dominant. Controlled descent."
        },
        {
            "name": "Hip Thrust",
            "sets": 3,
            "rep_range": (10, 12),
            "rest": "2 min",
            "video": "https://www.youtube.com/watch?v=xDmFkJxPzeM",
            "notes": "Glute focus. Full hip extension."
        },
        {
            "name": "Leg Extension (Drop Set)",
            "sets": 3,
            "rep_range": (15, 20),
            "rest": "90s",
            "video": "https://www.youtube.com/watch?v=WaRl1k71iT0",
            "notes": "Drop weight 20% after failure, continue."
        },
        {
            "name": "Seated Leg Curl",
            "sets": 3,
            "rep_range": (15, 20),
            "rest": "60s",
            "video": "https://www.youtube.com/watch?v=OrxowZ4l3yI",
            "notes": "High reps, chase the pump."
        },
        {
            "name": "Calf Press",
            "sets": 3,
            "rep_range": (20, 25),
            "rest": "45s",
            "video": "https://www.youtube.com/watch?v=K_jsGgztcGU",
            "notes": "Leg press machine. Burn it out."
        }
    ]
}

# Meal Plans
MEAL_PLANS = {
    "Option 1 - Clean/Rice": {
        "breakfast": {
            "name": "Power Oats",
            "items": ["100g Oats", "1 Scoop Whey", "1 Banana", "Drizzle of Honey"],
            "timing": "08:00"
        },
        "lunch": {
            "name": "Chicken & Rice",
            "items": ["150g Chicken Breast", "300g Basmati Rice", "Mixed Veggies", "1 tbsp Olive Oil"],
            "timing": "12:30",
            "note": "Walk 15 min after eating"
        },
        "pre_workout": {
            "name": "Quick Carbs",
            "items": ["2 Slices Toast", "30g Jam"],
            "timing": "60 min before gym"
        },
        "post_workout": {
            "name": "Recovery Shake",
            "items": ["30g Whey", "40g Maltodextrin", "5g Creatine"],
            "timing": "Within 30 min of training"
        },
        "dinner": {
            "name": "Eggs & Potatoes",
            "items": ["3 Whole Eggs", "2 Large Potatoes", "1 Apple"],
            "timing": "20:00"
        }
    },
    "Option 2 - Dense/Pasta": {
        "breakfast": {
            "name": "Protein Pancakes",
            "items": ["100g Oat Flour", "1 Banana", "Egg Whites", "Sugar-free Syrup"],
            "timing": "08:00"
        },
        "lunch": {
            "name": "Beef Pasta",
            "items": ["120g Lean Ground Beef", "150g Dry Pasta", "Marinara Sauce"],
            "timing": "12:30",
            "note": "Walk 15 min after eating"
        },
        "pre_workout": {
            "name": "Cereal Boost",
            "items": ["40g Cereal", "200ml Milk"],
            "timing": "60 min before gym"
        },
        "post_workout": {
            "name": "Recovery Shake",
            "items": ["30g Whey", "40g Maltodextrin", "5g Creatine"],
            "timing": "Within 30 min of training"
        },
        "dinner": {
            "name": "Fish & Rice",
            "items": ["150g White Fish", "300g Rice", "1/2 Avocado", "Glass of Juice"],
            "timing": "20:00"
        }
    }
}

# Starting weights for new users
STARTING_WEIGHTS = {
    "High Bar Squat": 40,
    "Leg Extension": 20,
    "Leg Press": 60,
    "Seated Leg Curl": 15,
    "Standing Calf Raise": 30,
    "Romanian Deadlift": 40,
    "Unilateral Leg Press": 30,
    "Lying Leg Curl": 15,
    "Adductor Machine": 20,
    "Seated Calf Raise": 25,
    "Hack Squat": 40,
    "Hip Thrust": 40,
    "Leg Extension (Drop Set)": 15,
    "Calf Press": 60
}


# ============================================================================
# DATA PERSISTENCE
# ============================================================================

def load_logs() -> Dict:
    """Load workout logs from JSON file."""
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    return {"workouts": [], "exercises": {}, "skipped_sessions": [], "schedule_offset": 0}


def save_logs(data: Dict) -> None:
    """Save workout logs to JSON file."""
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2, default=str)


def load_settings() -> Dict:
    """Load user settings from JSON file."""
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, 'r') as f:
            return json.load(f)
    return {
        "meal_plan": "Option 1 - Clean/Rice",
        "holiday_mode": False,
        "holiday_start": None,
        "schedule_offset": 0
    }


def save_settings(settings: Dict) -> None:
    """Save user settings to JSON file."""
    with open(SETTINGS_FILE, 'w') as f:
        json.dump(settings, f, indent=2)


# ============================================================================
# AUTHENTICATION
# ============================================================================

def check_password() -> bool:
    """Returns True if user is authenticated."""
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
    """Get schedule adjusted for any offsets from skipped sessions."""
    offset = settings.get("schedule_offset", 0)
    if offset == 0:
        return BASE_SCHEDULE.copy()

    # Shift the schedule by offset days
    adjusted = {}
    for day in range(7):
        original_day = (day - offset) % 7
        adjusted[day] = BASE_SCHEDULE[original_day]
    return adjusted


def get_today_workout_with_settings(settings: Dict) -> Tuple[str, List[Dict]]:
    """Get today's scheduled workout considering offsets and holiday mode."""
    if settings.get("holiday_mode", False):
        return "Holiday", []

    schedule = get_adjusted_schedule(settings)
    day_of_week = datetime.now().weekday()
    workout_name = schedule[day_of_week]

    if workout_name == "Rest":
        return "Rest", []

    return workout_name, EXERCISES.get(workout_name, [])


def get_next_training_day(settings: Dict) -> Tuple[str, str, int]:
    """Get the next training day info. Returns (workout_name, day_name, days_until)."""
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
    """Get a preview of the week's schedule."""
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
    """
    The brain of NeuroLegs - handles all progression logic.

    Core Principles:
    1. Double Progression: Volume (reps) before Intensity (load)
    2. RPE-Adjusted Scoring: Performance quality matters
    3. Multi-Session Analysis: Looks at last 3 sessions for smarter decisions
    4. Plateau Detection: Proactive deload suggestions
    5. Cold Start Handling: Sensible defaults for new users
    """

    def __init__(self, logs: Dict):
        self.logs = logs
        self.exercise_history = logs.get("exercises", {})

    def calculate_set_score(self, reps: int, rpe: float,
                           min_range: int, max_range: int) -> float:
        """Calculate performance score for a single set (0-100)."""
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

    def calculate_session_score(self, sets_data: List[Dict],
                                min_range: int, max_range: int) -> Tuple[float, str]:
        """Calculate overall session score for an exercise."""
        if not sets_data:
            return 0, "No data"

        scores = []
        reps_list = []

        for set_data in sets_data:
            reps = set_data.get("reps", 0)
            rpe = set_data.get("rpe", 8)
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

    def get_exercise_history(self, exercise_name: str, limit: int = 10) -> List[Dict]:
        """Get recent history for an exercise."""
        history = self.exercise_history.get(exercise_name, [])
        return sorted(history, key=lambda x: x.get("date", ""), reverse=True)[:limit]

    def analyze_multi_session_trend(self, exercise_name: str, num_sessions: int = 3) -> Dict:
        """Analyze performance trend across multiple sessions."""
        history = self.get_exercise_history(exercise_name, num_sessions + 2)

        if len(history) < 1:
            return {
                "has_data": False,
                "trend": "NO_DATA",
                "avg_weight": None,
                "avg_reps": None,
                "avg_rpe": None,
                "weight_trend": 0,
                "rep_trend": 0,
                "rpe_trend": 0,
                "sessions_analyzed": 0
            }

        weights = []
        all_reps = []
        all_rpe = []

        for session in history[:num_sessions]:
            weights.append(session.get("weight", 0))
            sets = session.get("sets", [])
            for s in sets:
                all_reps.append(s.get("reps", 0))
                all_rpe.append(s.get("rpe", 8))

        avg_weight = sum(weights) / len(weights) if weights else 0
        avg_reps = sum(all_reps) / len(all_reps) if all_reps else 0
        avg_rpe = sum(all_rpe) / len(all_rpe) if all_rpe else 8

        weight_trend = 0
        rep_trend = 0
        rpe_trend = 0

        if len(history) >= 2:
            recent_weight = history[0].get("weight", 0)
            older_weights = [h.get("weight", 0) for h in history[1:num_sessions]]
            if older_weights:
                old_avg_weight = sum(older_weights) / len(older_weights)
                weight_trend = recent_weight - old_avg_weight

            recent_reps = [s.get("reps", 0) for s in history[0].get("sets", [])]
            recent_avg_reps = sum(recent_reps) / len(recent_reps) if recent_reps else 0

            older_reps = []
            for h in history[1:num_sessions]:
                older_reps.extend([s.get("reps", 0) for s in h.get("sets", [])])
            old_avg_reps = sum(older_reps) / len(older_reps) if older_reps else 0
            rep_trend = recent_avg_reps - old_avg_reps

            recent_rpe = [s.get("rpe", 8) for s in history[0].get("sets", [])]
            recent_avg_rpe = sum(recent_rpe) / len(recent_rpe) if recent_rpe else 8

            older_rpe = []
            for h in history[1:num_sessions]:
                older_rpe.extend([s.get("rpe", 8) for s in h.get("sets", [])])
            old_avg_rpe = sum(older_rpe) / len(older_rpe) if older_rpe else 8
            rpe_trend = recent_avg_rpe - old_avg_rpe

        if weight_trend > 0 or (rep_trend > 0.5 and weight_trend >= 0):
            trend = "IMPROVING"
        elif weight_trend < -1 or (rep_trend < -1 and rpe_trend > 0.5):
            trend = "DECLINING"
        elif abs(weight_trend) < 0.5 and abs(rep_trend) < 0.5:
            trend = "STABLE"
        else:
            trend = "VARIABLE"

        return {
            "has_data": True,
            "trend": trend,
            "avg_weight": round(avg_weight, 1),
            "avg_reps": round(avg_reps, 1),
            "avg_rpe": round(avg_rpe, 1),
            "weight_trend": round(weight_trend, 1),
            "rep_trend": round(rep_trend, 1),
            "rpe_trend": round(rpe_trend, 1),
            "sessions_analyzed": min(len(history), num_sessions)
        }

    def detect_plateau(self, exercise_name: str) -> Tuple[bool, int, str]:
        """Detect if user is plateaued on an exercise."""
        history = self.get_exercise_history(exercise_name, 6)

        if len(history) < 3:
            return False, 0, "Keep training - building baseline data"

        stall_count = 0
        for i in range(len(history) - 1):
            current = history[i]
            previous = history[i + 1]

            current_weight = current.get("weight", 0)
            previous_weight = previous.get("weight", 0)
            current_reps = sum([s.get("reps", 0) for s in current.get("sets", [])])
            previous_reps = sum([s.get("reps", 0) for s in previous.get("sets", [])])

            if current_weight <= previous_weight and current_reps <= previous_reps:
                stall_count += 1
            else:
                break

        trend = self.analyze_multi_session_trend(exercise_name, 3)

        if trend["has_data"] and trend["rpe_trend"] > 0.5 and trend["trend"] != "IMPROVING":
            if stall_count >= 2:
                return True, stall_count, "RPE increasing without progress - fatigue accumulating. Consider a deload."

        if stall_count >= 4:
            return True, stall_count, "Significant plateau! Time for a strategic deload (85% weight for 1 week)."
        elif stall_count >= 2:
            return True, stall_count, "Minor stall detected. Focus on technique and mind-muscle connection."

        return False, stall_count, "Progressing well!"

    def get_next_target(self, exercise_name: str, exercise_config: Dict) -> Dict:
        """Calculate the target for the next session."""
        history = self.get_exercise_history(exercise_name, 6)
        min_range, max_range = exercise_config["rep_range"]
        num_sets = exercise_config["sets"]
        is_compound = exercise_name in COMPOUND_EXERCISES
        increment = WEIGHT_INCREMENT["compound"] if is_compound else WEIGHT_INCREMENT["isolation"]

        if not history:
            starting_weight = STARTING_WEIGHTS.get(exercise_name, 20)
            return {
                "weight": starting_weight,
                "reps_per_set": min_range,
                "recommendation": "BASELINE",
                "message": f"First time! Start with {starting_weight}kg for {min_range} reps. Focus on perfect form.",
                "confidence": 50,
                "is_new": True,
                "trend_info": None
            }

        trend = self.analyze_multi_session_trend(exercise_name, 3)

        last_session = history[0]
        last_weight = last_session.get("weight", 0)
        last_sets = last_session.get("sets", [])

        if len(history) == 1:
            return {
                "weight": last_weight,
                "reps_per_set": min_range + 1,
                "recommendation": "BUILD",
                "message": f"Second session! Use {last_weight}kg again, aim for {min_range + 1} reps per set.",
                "confidence": 60,
                "is_new": False,
                "trend_info": trend,
                "previous": f"Last: {last_weight}kg × {[s.get('reps', 0) for s in last_sets]}"
            }

        session_score, consistency = self.calculate_session_score(last_sets, min_range, max_range)

        avg_reps = sum([s.get("reps", 0) for s in last_sets]) / len(last_sets)
        avg_rpe = sum([s.get("rpe", 8) for s in last_sets]) / len(last_sets)
        min_reps = min([s.get("reps", 0) for s in last_sets])

        is_plateaued, stall_count, plateau_msg = self.detect_plateau(exercise_name)

        if is_plateaued and stall_count >= 4:
            return {
                "weight": round(last_weight * 0.85, 1),
                "reps_per_set": min_range,
                "recommendation": "DELOAD",
                "message": f"Strategic deload! Use {round(last_weight * 0.85, 1)}kg for {min_range} reps.",
                "confidence": 95,
                "plateau_info": plateau_msg,
                "is_new": False,
                "trend_info": trend
            }

        if min_reps >= max_range and avg_rpe <= 8 and trend["trend"] in ["IMPROVING", "STABLE"]:
            new_weight = last_weight + increment
            return {
                "weight": new_weight,
                "reps_per_set": min_range,
                "recommendation": "PROGRESS",
                "message": f"You've earned it! Add weight: {new_weight}kg × {min_range} reps",
                "confidence": 90,
                "previous": f"Last 3 avg: {trend['avg_weight']}kg × {trend['avg_reps']:.0f} reps @ RPE {trend['avg_rpe']:.0f}",
                "is_new": False,
                "trend_info": trend
            }

        if avg_reps >= max_range - 0.5 and avg_rpe <= 8.5:
            return {
                "weight": last_weight,
                "reps_per_set": max_range,
                "recommendation": "PUSH",
                "message": f"Almost there! Hit {max_range} on ALL sets to unlock +{increment}kg.",
                "confidence": 80,
                "previous": f"Last: {last_weight}kg × {[s.get('reps', 0) for s in last_sets]}",
                "is_new": False,
                "trend_info": trend
            }

        if avg_reps >= min_range:
            target_reps = min(int(avg_reps) + 1, max_range)
            return {
                "weight": last_weight,
                "reps_per_set": target_reps,
                "recommendation": "BUILD",
                "message": f"Building strength. Target: {last_weight}kg × {target_reps} reps.",
                "confidence": 75,
                "previous": f"Last: {last_weight}kg × {[s.get('reps', 0) for s in last_sets]}",
                "is_new": False,
                "trend_info": trend
            }

        return {
            "weight": last_weight,
            "reps_per_set": min_range,
            "recommendation": "CONSOLIDATE",
            "message": f"Consolidate gains. Same weight ({last_weight}kg), solid {min_range} reps.",
            "confidence": 70,
            "previous": f"Last: {last_weight}kg × {[s.get('reps', 0) for s in last_sets]} @ RPE {avg_rpe:.0f}",
            "is_new": False,
            "trend_info": trend,
            "plateau_info": plateau_msg if is_plateaued else None
        }

    def get_workout_summary(self, workout_name: str, exercises: List[Dict]) -> List[Dict]:
        """Generate targets for all exercises in a workout."""
        summary = []
        for ex in exercises:
            target = self.get_next_target(ex["name"], ex)
            target["exercise"] = ex
            summary.append(target)
        return summary

    def get_all_time_stats(self) -> Dict:
        """Calculate comprehensive all-time statistics."""
        if not self.exercise_history:
            return None

        stats = {
            "total_sessions": 0,
            "total_sets": 0,
            "total_reps": 0,
            "total_volume": 0,
            "first_workout": None,
            "last_workout": None,
            "exercises": {},
            "pr_list": []
        }

        all_dates = []

        for exercise_name, history in self.exercise_history.items():
            if not history:
                continue

            ex_stats = {
                "sessions": len(history),
                "current_weight": 0,
                "max_weight": 0,
                "starting_weight": 0,
                "weight_gain": 0,
                "total_volume": 0,
                "avg_reps": 0
            }

            all_reps = []
            weights = []

            for session in history:
                date = session.get("date", "")
                if date:
                    all_dates.append(date)

                weight = session.get("weight", 0)
                weights.append(weight)
                sets = session.get("sets", [])

                for s in sets:
                    reps = s.get("reps", 0)
                    all_reps.append(reps)
                    stats["total_reps"] += reps
                    stats["total_volume"] += weight * reps
                    stats["total_sets"] += 1

            if weights:
                ex_stats["current_weight"] = weights[0]
                ex_stats["max_weight"] = max(weights)
                ex_stats["starting_weight"] = weights[-1]
                ex_stats["weight_gain"] = weights[0] - weights[-1]

            if all_reps:
                ex_stats["avg_reps"] = round(sum(all_reps) / len(all_reps), 1)

            ex_stats["total_volume"] = sum([w * sum([s.get("reps", 0) for s in h.get("sets", [])]) for h, w in zip(history, weights)])

            stats["exercises"][exercise_name] = ex_stats
            stats["total_sessions"] += len(history)

            if ex_stats["max_weight"] > 0:
                stats["pr_list"].append({
                    "exercise": exercise_name,
                    "weight": ex_stats["max_weight"]
                })

        if all_dates:
            stats["first_workout"] = min(all_dates)[:10]
            stats["last_workout"] = max(all_dates)[:10]

        stats["pr_list"] = sorted(stats["pr_list"], key=lambda x: x["weight"], reverse=True)

        return stats


# ============================================================================
# UI HELPER FUNCTIONS
# ============================================================================

def get_brain_status() -> Tuple[str, str, str]:
    """Determine current brain/activity status based on time."""
    hour = datetime.now().hour

    if 6 <= hour < 9:
        return "🌅", "Morning Prep", "Fuel up and hydrate. Big day ahead."
    elif 9 <= hour < 12:
        return "🧠", "Deep Work AM", "Peak cognitive hours. Study hard."
    elif 12 <= hour < 14:
        return "🍽️", "Lunch & Digest", "Eat your meal, walk 15 min after."
    elif 14 <= hour < 17:
        return "🧠", "Deep Work PM", "Second study block. Stay focused."
    elif 17 <= hour < 20:
        return "💪", "GYM MODE", "Training window! Time to grow those legs."
    elif 20 <= hour < 22:
        return "🍽️", "Dinner & Wind Down", "Eat, relax, prepare for sleep."
    elif 22 <= hour < 24:
        return "🌙", "Recovery Mode", "Sleep is gains. Aim for 8 hours."
    else:
        return "😴", "Sleep Time", "You should be sleeping! Recovery is key."


def create_exercise_link(name: str, url: str) -> str:
    """Create a markdown hyperlink for an exercise."""
    return f"[{name}]({url})"


def format_recommendation_badge(recommendation: str) -> str:
    """Format recommendation as a colored badge."""
    colors = {
        "PROGRESS": "🟢",
        "PUSH": "🔵",
        "BUILD": "🟡",
        "CONSOLIDATE": "🟠",
        "DELOAD": "🔴",
        "BASELINE": "⚪"
    }
    return f"{colors.get(recommendation, '⚪')} {recommendation}"


def format_trend_badge(trend: str) -> str:
    """Format trend as indicator."""
    indicators = {
        "IMPROVING": "📈 Improving",
        "STABLE": "➡️ Stable",
        "DECLINING": "📉 Declining",
        "VARIABLE": "〰️ Variable",
        "NO_DATA": "❓ No Data"
    }
    return indicators.get(trend, "❓")


def get_holiday_css() -> str:
    """Return CSS for holiday/frozen mode."""
    return """
        <style>
        .stApp {
            background: linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 50%, #80deea 100%) !important;
        }
        .stMarkdown, .stText, p, h1, h2, h3, span, label {
            color: #00acc1 !important;
        }
        .stButton > button {
            background-color: #4dd0e1 !important;
            color: white !important;
            border: 2px solid #00bcd4 !important;
        }
        .stTabs [data-baseweb="tab-list"] {
            background-color: rgba(178, 235, 242, 0.5) !important;
        }
        .stMetric {
            background-color: rgba(224, 247, 250, 0.7) !important;
            border-radius: 10px;
            padding: 10px;
        }
        div[data-testid="stExpander"] {
            background-color: rgba(178, 235, 242, 0.3) !important;
            border: 1px solid #4dd0e1 !important;
        }
        .frozen-banner {
            background: linear-gradient(90deg, #00bcd4, #4dd0e1, #00bcd4);
            padding: 20px;
            border-radius: 15px;
            text-align: center;
            margin: 20px 0;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
        </style>
    """


def get_normal_css() -> str:
    """Return normal CSS."""
    return """
        <style>
        .stApp { max-width: 100%; }
        .stButton > button {
            width: 100%;
            padding: 0.75rem 1rem;
            font-size: 1.1rem;
            border-radius: 10px;
            margin: 0.25rem 0;
        }
        .stNumberInput > div > div > input {
            text-align: center;
            font-size: 1.2rem;
        }
        #MainMenu {visibility: hidden;}
        footer {visibility: hidden;}
        </style>
    """


# ============================================================================
# STREAMLIT APP
# ============================================================================

def main():
    st.set_page_config(
        page_title="NeuroLegs",
        page_icon="🦵",
        layout="centered",
        initial_sidebar_state="collapsed"
    )

    # Password protection
    if not check_password():
        return

    # Load data
    logs = load_logs()
    settings = load_settings()
    coach = AdaptiveCoach(logs)

    # Apply CSS based on holiday mode
    if settings.get("holiday_mode", False):
        st.markdown(get_holiday_css(), unsafe_allow_html=True)
    else:
        st.markdown(get_normal_css(), unsafe_allow_html=True)

    # Header
    if settings.get("holiday_mode", False):
        st.markdown("""
            <div class="frozen-banner">
                <h1>❄️ HOLIDAY MODE ❄️</h1>
                <p>Training is frozen. Enjoy your break!</p>
            </div>
        """, unsafe_allow_html=True)
    else:
        status_emoji, status_name, status_msg = get_brain_status()
        col1, col2 = st.columns([1, 3])
        with col1:
            st.markdown(f"# {status_emoji}")
        with col2:
            st.markdown(f"### {status_name}")
            st.caption(status_msg)

    st.divider()

    # Navigation
    tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
        "🏋️ Today", "📝 Log", "📊 Progress", "📈 Analytics", "🍽️ Nutrition", "⚙️ Settings"
    ])

    # ========== TAB 1: TODAY'S WORKOUT ==========
    with tab1:
        if settings.get("holiday_mode", False):
            st.markdown("## ❄️ Training Frozen")
            st.info("""
            **Holiday Mode Active**

            Your training schedule is paused. When you return:
            - All your progress data is preserved
            - Your targets will be exactly where you left off
            - The algorithm will ease you back in

            Go to Settings to deactivate when ready!
            """)

            # Show when holiday started
            if settings.get("holiday_start"):
                start_date = settings["holiday_start"][:10]
                days_off = (datetime.now() - datetime.fromisoformat(start_date)).days
                st.caption(f"❄️ Holiday started: {start_date} ({days_off} days ago)")

        else:
            workout_name, exercises = get_today_workout_with_settings(settings)

            # Week schedule preview
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
                st.info("""
                **Recovery is when you grow!**

                - 🚶 Light walking (10-15 min)
                - 🧘 Stretching / Mobility work
                - 💧 Stay hydrated (3+ liters)
                - 😴 Prioritize 8 hours of sleep
                """)

                # Skip session button for rest day - user might want to move schedule
                st.markdown("---")
                next_workout, next_day, days_until = get_next_training_day(settings)
                st.write(f"**Next:** {next_workout} on {next_day} ({days_until} day{'s' if days_until > 1 else ''})")

            else:
                st.markdown(f"## {workout_name}")
                st.caption(f"📅 {datetime.now().strftime('%A, %B %d')}")

                # SKIP SESSION BUTTON
                with st.expander("⏭️ Skip Today's Session"):
                    st.warning("Can't train today? Choose how to handle it:")

                    skip_col1, skip_col2 = st.columns(2)

                    with skip_col1:
                        if st.button("🔄 Push Schedule +1 Day", use_container_width=True,
                                    help="Move ALL future sessions forward by 1 day"):
                            # Record the skip
                            if "skipped_sessions" not in logs:
                                logs["skipped_sessions"] = []
                            logs["skipped_sessions"].append({
                                "date": datetime.now().isoformat(),
                                "workout": workout_name,
                                "action": "push_schedule"
                            })

                            # Increment schedule offset
                            settings["schedule_offset"] = settings.get("schedule_offset", 0) + 1
                            save_settings(settings)
                            save_logs(logs)
                            st.success("Schedule pushed! Tomorrow will be " + workout_name)
                            st.rerun()

                    with skip_col2:
                        if st.button("⏩ Skip & Continue", use_container_width=True,
                                    help="Skip this workout, keep schedule unchanged"):
                            # Record the skip
                            if "skipped_sessions" not in logs:
                                logs["skipped_sessions"] = []
                            logs["skipped_sessions"].append({
                                "date": datetime.now().isoformat(),
                                "workout": workout_name,
                                "action": "skip_only"
                            })
                            save_logs(logs)
                            st.success("Session skipped. Next workout continues as scheduled.")
                            st.info("💡 Tip: If you miss multiple sessions, consider Holiday Mode!")

                    st.caption("Skipped sessions are logged for your records.")

                st.divider()

                # Get targets for all exercises
                targets = coach.get_workout_summary(workout_name, exercises)

                for target in targets:
                    ex = target["exercise"]
                    with st.container():
                        st.markdown(f"### {create_exercise_link(ex['name'], ex['video'])}")

                        col1, col2 = st.columns([2, 1])
                        with col1:
                            if target.get("is_new"):
                                st.markdown(f"**Target:** {target['weight']}kg × {target['reps_per_set']} reps × {ex['sets']} sets")
                                st.caption("🆕 First time - establish your baseline!")
                            else:
                                st.markdown(f"**Target:** {target['weight']}kg × {target['reps_per_set']} reps × {ex['sets']} sets")
                                if "previous" in target:
                                    st.caption(target["previous"])

                        with col2:
                            st.markdown(format_recommendation_badge(target["recommendation"]))
                            if target.get("trend_info") and target["trend_info"].get("has_data"):
                                st.caption(format_trend_badge(target["trend_info"]["trend"]))

                        with st.expander("💡 Coach's Note"):
                            st.write(target["message"])
                            st.caption(f"Rest: {ex['rest']} | {ex['notes']}")
                            if target.get("plateau_info"):
                                st.warning(target["plateau_info"])

                        st.divider()

    # ========== TAB 2: WORKOUT LOGGER ==========
    with tab2:
        if settings.get("holiday_mode", False):
            st.markdown("## ❄️ Logging Disabled")
            st.info("Deactivate Holiday Mode in Settings to log workouts.")
        else:
            st.markdown("## 📝 Log Workout")

            selected_workout = st.selectbox(
                "Select Workout",
                ["Legs A", "Legs B", "Legs C"],
                index=["Legs A", "Legs B", "Legs C"].index(
                    get_today_workout_with_settings(settings)[0]
                ) if get_today_workout_with_settings(settings)[0] not in ["Rest", "Holiday"] else 0
            )

            selected_exercises = EXERCISES[selected_workout]
            exercise_names = [ex["name"] for ex in selected_exercises]
            selected_exercise_name = st.selectbox("Select Exercise", exercise_names)
            selected_exercise = next(ex for ex in selected_exercises if ex["name"] == selected_exercise_name)

            target = coach.get_next_target(selected_exercise_name, selected_exercise)

            st.markdown("---")
            st.markdown(f"### 🎯 Today's Target")

            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Weight", f"{target['weight']}kg")
            with col2:
                st.metric("Reps/Set", f"{target['reps_per_set']}")
            with col3:
                st.metric("Status", target["recommendation"])

            if target.get("is_new"):
                st.info("🆕 " + target["message"])
            else:
                st.info(target["message"])

            st.markdown("---")
            st.markdown("### 📊 Log Your Sets")

            weight = st.number_input(
                "Weight (kg)",
                min_value=0.0,
                max_value=500.0,
                value=float(target["weight"]) if target["weight"] else 20.0,
                step=1.25,
                format="%.2f"
            )

            sets_data = []
            num_sets = selected_exercise["sets"]

            cols = st.columns(num_sets)
            for i, col in enumerate(cols):
                with col:
                    st.markdown(f"**Set {i+1}**")
                    reps = st.number_input(
                        "Reps",
                        min_value=0,
                        max_value=50,
                        value=target["reps_per_set"],
                        key=f"reps_{i}"
                    )
                    rpe = st.slider(
                        "RPE",
                        min_value=5.0,
                        max_value=10.0,
                        value=8.0,
                        step=0.5,
                        key=f"rpe_{i}"
                    )
                    sets_data.append({"reps": reps, "rpe": rpe})

            with st.expander("📖 RPE Guide"):
                st.markdown("""
                | RPE | Reps in Reserve |
                |-----|-----------------|
                | 6 | 4+ more reps |
                | 7 | 3 more reps |
                | 8 | 2 more reps |
                | 9 | 1 more rep |
                | 10 | True failure |
                """)

            notes = st.text_area("Notes (optional)", placeholder="e.g., Felt strong, minor knee discomfort...")

            if st.button("✅ Save Workout", type="primary", use_container_width=True):
                log_entry = {
                    "date": datetime.now().isoformat(),
                    "workout": selected_workout,
                    "weight": weight,
                    "sets": sets_data,
                    "notes": notes
                }

                if selected_exercise_name not in logs["exercises"]:
                    logs["exercises"][selected_exercise_name] = []

                logs["exercises"][selected_exercise_name].insert(0, log_entry)
                logs["workouts"].append({
                    "date": datetime.now().isoformat(),
                    "workout_type": selected_workout,
                    "exercise": selected_exercise_name,
                    "data": log_entry
                })

                save_logs(logs)

                coach = AdaptiveCoach(logs)
                min_r, max_r = selected_exercise["rep_range"]
                score, consistency = coach.calculate_session_score(sets_data, min_r, max_r)

                st.success(f"Workout logged! Session Score: {score:.0f}/100")
                st.caption(consistency)

                next_target = coach.get_next_target(selected_exercise_name, selected_exercise)
                st.info(f"**Next session:** {next_target['message']}")

    # ========== TAB 3: EXERCISE PROGRESS ==========
    with tab3:
        st.markdown("## 📊 Exercise Progress")

        if not logs["exercises"]:
            st.info("No workout data yet. Start logging to see your progress!")
        else:
            tracked_exercises = list(logs["exercises"].keys())
            selected_progress_exercise = st.selectbox(
                "Select Exercise",
                tracked_exercises,
                key="progress_exercise"
            )

            history = logs["exercises"].get(selected_progress_exercise, [])

            if history:
                df_data = []
                for entry in reversed(history):
                    date = entry.get("date", "")[:10]
                    weight = entry.get("weight", 0)
                    sets = entry.get("sets", [])
                    avg_reps = sum([s.get("reps", 0) for s in sets]) / max(1, len(sets))
                    avg_rpe = sum([s.get("rpe", 8) for s in sets]) / max(1, len(sets))
                    total_volume = weight * sum([s.get("reps", 0) for s in sets])

                    df_data.append({
                        "Date": date,
                        "Weight (kg)": weight,
                        "Avg Reps": round(avg_reps, 1),
                        "Avg RPE": round(avg_rpe, 1),
                        "Volume": round(total_volume, 0)
                    })

                df = pd.DataFrame(df_data)

                col1, col2, col3, col4 = st.columns(4)
                with col1:
                    current = df["Weight (kg)"].iloc[-1] if len(df) > 0 else 0
                    starting = df["Weight (kg)"].iloc[0] if len(df) > 0 else 0
                    delta = current - starting
                    st.metric("Current", f"{current}kg", f"+{delta}kg" if delta > 0 else f"{delta}kg")

                with col2:
                    st.metric("Sessions", len(history))

                with col3:
                    max_weight = df["Weight (kg)"].max()
                    st.metric("PR", f"{max_weight}kg")

                with col4:
                    is_plateaued, stall_count, _ = coach.detect_plateau(selected_progress_exercise)
                    st.metric("Stalls", stall_count, "⚠️" if is_plateaued else "✅")

                fig_weight = px.line(df, x="Date", y="Weight (kg)", markers=True)
                fig_weight.update_layout(height=250, margin=dict(l=0, r=0, t=30, b=0))
                fig_weight.update_traces(line_color="#4CAF50")
                st.plotly_chart(fig_weight, use_container_width=True)

                fig_volume = px.bar(df, x="Date", y="Volume")
                fig_volume.update_layout(height=200, margin=dict(l=0, r=0, t=30, b=0))
                fig_volume.update_traces(marker_color="#667eea")
                st.plotly_chart(fig_volume, use_container_width=True)

                trend = coach.analyze_multi_session_trend(selected_progress_exercise, 3)
                if trend["has_data"]:
                    st.markdown("### 📈 3-Session Trend Analysis")
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        st.metric("Weight Trend", f"{trend['weight_trend']:+.1f}kg")
                    with col2:
                        st.metric("Rep Trend", f"{trend['rep_trend']:+.1f}")
                    with col3:
                        st.metric("RPE Trend", f"{trend['rpe_trend']:+.1f}")

                with st.expander("📜 Full History"):
                    st.dataframe(df.iloc[::-1], use_container_width=True)

    # ========== TAB 4: ANALYTICS ==========
    with tab4:
        st.markdown("## 📈 Analytics Dashboard")

        all_stats = coach.get_all_time_stats()

        if not all_stats:
            st.info("No workout data yet. Start logging to see analytics!")
        else:
            st.markdown("### 🏆 All-Time Overview")
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric("Total Sessions", all_stats["total_sessions"])
            with col2:
                st.metric("Total Sets", all_stats["total_sets"])
            with col3:
                st.metric("Total Reps", f"{all_stats['total_reps']:,}")
            with col4:
                st.metric("Total Volume", f"{all_stats['total_volume']:,.0f}kg")

            if all_stats["first_workout"]:
                st.caption(f"Training since: {all_stats['first_workout']} | Last workout: {all_stats['last_workout']}")

            st.divider()

            st.markdown("### 🏅 Personal Records")
            if all_stats["pr_list"]:
                pr_df = pd.DataFrame(all_stats["pr_list"])
                for i, row in pr_df.iterrows():
                    medal = "🥇" if i == 0 else ("🥈" if i == 1 else ("🥉" if i == 2 else "  "))
                    st.write(f"{medal} **{row['exercise']}**: {row['weight']}kg")

            st.divider()

            st.markdown("### 📊 Exercise Breakdown")
            ex_data = []
            for ex_name, ex_stats in all_stats["exercises"].items():
                ex_data.append({
                    "Exercise": ex_name,
                    "Sessions": ex_stats["sessions"],
                    "Current": ex_stats["current_weight"],
                    "Max": ex_stats["max_weight"],
                    "Gain": ex_stats["weight_gain"],
                    "Volume": ex_stats["total_volume"]
                })

            if ex_data:
                ex_df = pd.DataFrame(ex_data)
                st.dataframe(ex_df, use_container_width=True, hide_index=True)

                st.markdown("### 📈 Weight Progress by Exercise")
                fig = px.bar(
                    ex_df,
                    x="Exercise",
                    y="Gain",
                    color="Gain",
                    color_continuous_scale="RdYlGn"
                )
                fig.update_layout(height=300, xaxis_tickangle=-45)
                st.plotly_chart(fig, use_container_width=True)

                st.markdown("### 🥧 Volume Distribution")
                fig_pie = px.pie(ex_df, values="Volume", names="Exercise")
                fig_pie.update_layout(height=350)
                st.plotly_chart(fig_pie, use_container_width=True)

            # Skipped sessions log
            if logs.get("skipped_sessions"):
                st.divider()
                st.markdown("### ⏭️ Skipped Sessions Log")
                skip_df = pd.DataFrame(logs["skipped_sessions"])
                skip_df["date"] = skip_df["date"].str[:10]
                st.dataframe(skip_df, use_container_width=True, hide_index=True)

    # ========== TAB 5: NUTRITION ==========
    with tab5:
        st.markdown("## 🍽️ Nutrition Plan")

        st.markdown("### 📊 Your Macros")
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Protein", f"{USER_PROFILE['protein_g']}g")
        with col2:
            st.metric("Carbs", f"{USER_PROFILE['carbs_g']}g")
        with col3:
            st.metric("Fats", f"{USER_PROFILE['fats_g']}g")

        calories = (USER_PROFILE['protein_g'] * 4 +
                   USER_PROFILE['carbs_g'] * 4 +
                   USER_PROFILE['fats_g'] * 9)
        st.caption(f"Total: ~{calories} kcal/day")

        st.divider()

        st.markdown("### 🍴 Today's Meal Plan")
        selected_plan = st.radio(
            "Choose your plan:",
            list(MEAL_PLANS.keys()),
            index=list(MEAL_PLANS.keys()).index(settings.get("meal_plan", "Option 1 - Clean/Rice"))
        )

        if selected_plan != settings.get("meal_plan"):
            settings["meal_plan"] = selected_plan
            save_settings(settings)

        plan = MEAL_PLANS[selected_plan]
        meal_order = ["breakfast", "lunch", "pre_workout", "post_workout", "dinner"]
        meal_icons = {"breakfast": "🌅", "lunch": "☀️", "pre_workout": "⚡", "post_workout": "💪", "dinner": "🌙"}

        for meal_key in meal_order:
            meal = plan[meal_key]
            with st.expander(f"{meal_icons[meal_key]} {meal['name']} ({meal['timing']})"):
                for item in meal["items"]:
                    st.write(f"• {item}")
                if "note" in meal:
                    st.info(f"💡 {meal['note']}")

        st.divider()

        st.markdown("### 💊 Supplements")
        col1, col2, col3 = st.columns(3)
        with col1:
            st.markdown("**Creatine**")
            st.write(f"{USER_PROFILE['supplements']['creatine_g']}g daily")
        with col2:
            st.markdown("**Maltodextrin**")
            st.write(f"{USER_PROFILE['supplements']['maltodextrin_g']}g")
        with col3:
            st.markdown("**Whey**")
            st.write(f"{USER_PROFILE['supplements']['whey_g']}g")

    # ========== TAB 6: SETTINGS ==========
    with tab6:
        st.markdown("## ⚙️ Settings")

        # Holiday Mode
        st.markdown("### ❄️ Holiday Mode")
        holiday_active = settings.get("holiday_mode", False)

        if holiday_active:
            st.info(f"❄️ Holiday Mode is **ACTIVE** since {settings.get('holiday_start', 'N/A')[:10]}")
            if st.button("☀️ Deactivate Holiday Mode", type="primary", use_container_width=True):
                settings["holiday_mode"] = False
                settings["holiday_end"] = datetime.now().isoformat()

                # Log the holiday period
                if "holidays" not in logs:
                    logs["holidays"] = []
                logs["holidays"].append({
                    "start": settings.get("holiday_start"),
                    "end": datetime.now().isoformat()
                })

                save_settings(settings)
                save_logs(logs)
                st.success("Welcome back! Holiday Mode deactivated.")
                st.rerun()
        else:
            st.write("Going on vacation? Activate Holiday Mode to freeze your training schedule.")
            if st.button("❄️ Activate Holiday Mode", use_container_width=True):
                settings["holiday_mode"] = True
                settings["holiday_start"] = datetime.now().isoformat()
                save_settings(settings)
                st.success("Holiday Mode activated! Enjoy your break.")
                st.rerun()

        st.divider()

        # Schedule Offset
        st.markdown("### 📅 Schedule Management")
        current_offset = settings.get("schedule_offset", 0)
        st.write(f"Current schedule offset: **{current_offset} day(s)**")

        if current_offset > 0:
            st.caption("Your schedule has been shifted from skipped sessions.")
            if st.button("🔄 Reset Schedule to Default", use_container_width=True):
                settings["schedule_offset"] = 0
                save_settings(settings)
                st.success("Schedule reset to default!")
                st.rerun()

        st.divider()

        # Data Management
        st.markdown("### 💾 Data Management")

        col1, col2 = st.columns(2)
        with col1:
            st.write(f"**Logged exercises:** {len(logs.get('exercises', {}))}")
            st.write(f"**Total workouts:** {len(logs.get('workouts', []))}")

        with col2:
            st.write(f"**Skipped sessions:** {len(logs.get('skipped_sessions', []))}")
            st.write(f"**Holiday periods:** {len(logs.get('holidays', []))}")

        st.divider()

        # Danger Zone
        with st.expander("🚨 Danger Zone"):
            st.warning("These actions cannot be undone!")

            if st.button("🗑️ Clear All Workout Data", type="secondary"):
                if st.session_state.get("confirm_clear"):
                    logs = {"workouts": [], "exercises": {}, "skipped_sessions": []}
                    save_logs(logs)
                    st.success("All workout data cleared.")
                    st.session_state.confirm_clear = False
                    st.rerun()
                else:
                    st.session_state.confirm_clear = True
                    st.warning("Click again to confirm deletion!")

    # Footer
    st.divider()
    col1, col2 = st.columns([3, 1])
    with col1:
        mode_indicator = "❄️" if settings.get("holiday_mode") else ""
        st.caption(f"NeuroLegs v1.0 {mode_indicator} | {datetime.now().strftime('%H:%M')} | {USER_PROFILE['weight_kg']}kg")
    with col2:
        if st.button("🚪 Logout", type="secondary"):
            st.session_state.authenticated = False
            st.rerun()


if __name__ == "__main__":
    main()
