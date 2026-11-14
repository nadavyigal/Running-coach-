"""
AI Endurance Coach module aligned with the AI_Endurance_Coach_Master_Protocol.

The module is self contained (standard library only) and exposes a
generate_daily_plan(...) API that returns a dictionary ready to slot into
current_microcycle.days[i] with training_session, nutrition_engine, and
recovery_protocol blocks. A __main__ demo shows how to wire user_profile,
macrocycle_context, and a microcycle day input.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from statistics import mean
from typing import Any, Dict, List, Optional, Sequence, Tuple


# ----------------------------- Tunable constants ----------------------------- #

PRE_RUN_CARBS_EASY_G_PER_KG = 0.5
PRE_RUN_CARBS_LONG_OR_HARD_G_PER_KG = 1.0

INTRA_CARB_RULES = [
    {"min_minutes": 0, "max_minutes": 59, "carbs_g_per_hour": 0, "fluids": "Water", "electrolytes_mg_per_l": 300},
    {"min_minutes": 60, "max_minutes": 89, "carbs_g_per_hour": 30, "fluids": "Water + electrolytes", "electrolytes_mg_per_l": 400},
    {"min_minutes": 90, "max_minutes": 180, "carbs_g_per_hour": 60, "fluids": "Carb mix (glucose/fructose) + electrolytes", "electrolytes_mg_per_l": 500},
    {"min_minutes": 181, "max_minutes": 300, "carbs_g_per_hour": 90, "fluids": "High-carb mix + electrolytes", "electrolytes_mg_per_l": 600},
]

POST_RUN_PROTEIN_G_PER_KG = 0.27  # within 0.25-0.30 g/kg guidance
POST_RUN_CARB_G_PER_KG = {
    "short": 0.6,  # <=45 minutes
    "medium": 0.8,  # 46-89 minutes
    "long": 1.0,  # >=90 minutes
}

HYDRATION_ML_PER_HR_RANGE = (500, 750)
HYDRATION_SODIUM_MG_PER_L_RANGE = (400, 800)

READINESS_TIER_BOUNDS = {"low": 0, "moderate": 50, "high": 75}
MASTERS_AGE = 40

ACWR_THRESHOLDS = {
    "under": 0.8,
    "optimal_low": 0.8,
    "optimal_high": 1.3,
    "elevated_high": 1.5,
}

INTENSITY_FACTORS = {"Z1": 1.0, "Z2": 1.3, "Z3": 1.6, "Z4": 1.9, "Z5": 2.3}


# ------------------------------- Data models -------------------------------- #

def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


@dataclass
class UserProfile:
    user_id: str
    age: int
    sex: Optional[str]
    weight_kg: float
    height_cm: Optional[float] = None
    max_hr: Optional[int] = None
    resting_hr: Optional[int] = None
    training_level: str = "intermediate"  # novice | intermediate | advanced
    injury_flag: bool = False
    goal_event: Optional[str] = None
    goal_time_minutes: Optional[int] = None

    def to_protocol(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class MacrocycleContext:
    phase: str  # base | build | peak | taper | recovery
    weeks_to_event: int
    goal_event: str
    target_weekly_distance_km: Optional[float] = None
    surface_focus: Optional[str] = None

    def to_protocol(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DailyReadinessInputs:
    sleep_hours: float
    sleep_quality: int  # 1-10
    soreness: int  # 1-10
    stress: int  # 1-10
    mental_energy: int  # 1-10
    resting_hr: Optional[int] = None
    hrv_change_ms: Optional[float] = None

    def to_protocol(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class MicrocycleDayContext:
    day_index: int
    day_name: str
    template: str  # Recovery | Long Run | Threshold | VO2_Intervals | Double_Threshold | Rest
    availability_minutes: int
    readiness_inputs: DailyReadinessInputs
    planned_distance_km: Optional[float] = None
    load_history: Sequence[float] = field(default_factory=list)  # last 28 days of load units
    environment: Optional[str] = None

    def to_protocol(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["load_history"] = list(self.load_history)
        return payload


# ------------------------------- Core engines ------------------------------- #


class PhysiologyEngine:
    """Heart-rate zone and pacing helpers."""

    @staticmethod
    def heart_rate_zones(max_hr: int, resting_hr: Optional[int]) -> Dict[str, Tuple[int, int]]:
        if not max_hr:
            raise ValueError("max_hr is required to derive zones")
        rhr = resting_hr or 60
        reserve = max(max_hr - rhr, 1)

        def zone(low: float, high: float) -> Tuple[int, int]:
            return (
                int(round(rhr + reserve * low)),
                int(round(rhr + reserve * high)),
            )

        return {
            "Z1": zone(0.55, 0.72),
            "Z2": zone(0.72, 0.82),
            "Z3": zone(0.82, 0.89),
            "Z4": zone(0.89, 0.95),
            "Z5": zone(0.95, 1.00),
        }

    @staticmethod
    def zone_rpe_mapping() -> Dict[str, str]:
        return {"Z1": "RPE 2-3", "Z2": "RPE 3-4", "Z3": "RPE 5-6", "Z4": "RPE 7-8", "Z5": "RPE 9+"}


class LoadManager:
    """Acute:Chronic Workload Ratio calculator and risk classifier."""

    def compute_acute_chronic(self, load_history: Sequence[float]) -> Tuple[float, float]:
        if not load_history:
            return 0.0, 0.0
        acute_window = load_history[-7:]
        chronic_window = load_history[-28:] if len(load_history) >= 28 else load_history
        acute_load = mean(acute_window)
        chronic_load = mean(chronic_window)
        return acute_load, chronic_load

    def compute_acwr(self, acute_load: float, chronic_load: float) -> float:
        if chronic_load <= 0:
            return float("inf") if acute_load > 0 else 0.0
        return acute_load / chronic_load

    def classify_acwr(self, acwr: float) -> str:
        if acwr < ACWR_THRESHOLDS["under"]:
            return "underload"
        if ACWR_THRESHOLDS["optimal_low"] <= acwr <= ACWR_THRESHOLDS["optimal_high"]:
            return "optimal"
        if ACWR_THRESHOLDS["optimal_high"] < acwr <= ACWR_THRESHOLDS["elevated_high"]:
            return "elevated"
        return "high"

    def load_report(self, load_history: Sequence[float]) -> Dict[str, Any]:
        acute, chronic = self.compute_acute_chronic(load_history)
        acwr = self.compute_acwr(acute, chronic)
        zone = self.classify_acwr(acwr)
        recommendation = "Maintain progressive overload."
        if zone == "underload":
            recommendation = "Increase load gradually (5-10%) to avoid detraining."
        elif zone == "elevated":
            recommendation = "Hold or slightly reduce load; avoid stacking hard days."
        elif zone == "high":
            recommendation = "Prioritize recovery; cap intensity until ACWR is back in range."

        return {
            "acute_load": round(acute, 2),
            "chronic_load": round(chronic, 2),
            "acwr": round(acwr, 2) if acwr != float("inf") else float("inf"),
            "zone": zone,
            "recommendation": recommendation,
        }


class NutritionEngine:
    """Pre, intra, and post session fueling."""

    def build_plan(self, session: Dict[str, Any], user: UserProfile) -> Dict[str, Any]:
        duration = session.get("duration_minutes", 0)
        template = session.get("template", "Recovery")
        intensity_zone = session.get("primary_zone", "Z1")
        is_long_or_hard = template in {"Long Run", "Threshold", "VO2_Intervals", "Double_Threshold"}

        pre_carb_g_per_kg = PRE_RUN_CARBS_LONG_OR_HARD_G_PER_KG if is_long_or_hard else PRE_RUN_CARBS_EASY_G_PER_KG
        pre_run_carbs = round(user.weight_kg * pre_carb_g_per_kg, 1)

        intra_plan = self._intra_fueling(duration, intensity_zone)
        post_plan = self._post_fueling(duration, user.weight_kg)

        return {
            "pre_run": {
                "carbs_g": pre_run_carbs,
                "notes": "Aim for low-fiber carbs 2-3h pre-run; add 500 ml fluids." if is_long_or_hard else "Small carb snack 30-60 min pre-run.",
            },
            "intra_run": intra_plan,
            "post_run": post_plan,
            "hydration": self._hydration_guidance(duration, intensity_zone),
        }

    def _intra_fueling(self, duration: float, intensity_zone: str) -> Dict[str, Any]:
        rule = INTRA_CARB_RULES[0]
        for candidate in INTRA_CARB_RULES:
            if candidate["min_minutes"] <= duration <= candidate["max_minutes"]:
                rule = candidate
                break
        carbs = rule["carbs_g_per_hour"]
        if intensity_zone in {"Z4", "Z5"} and duration >= 90:
            carbs = max(carbs, 70)
        return {
            "carbs_g_per_hour": carbs,
            "fluids": rule["fluids"],
            "electrolytes_mg_per_l": rule["electrolytes_mg_per_l"],
            "notes": "Use glucose+fructose mix for >60 g/h; sip steadily every 10-15 min." if carbs else "Water as thirst dictates; add electrolytes in heat.",
        }

    def _post_fueling(self, duration: float, weight_kg: float) -> Dict[str, Any]:
        protein = round(weight_kg * POST_RUN_PROTEIN_G_PER_KG, 1)
        if duration >= 90:
            carb_rate = POST_RUN_CARB_G_PER_KG["long"]
        elif duration >= 46:
            carb_rate = POST_RUN_CARB_G_PER_KG["medium"]
        else:
            carb_rate = POST_RUN_CARB_G_PER_KG["short"]
        carbs = round(weight_kg * carb_rate, 1)
        return {
            "protein_g": protein,
            "carbs_g": carbs,
            "notes": "Refuel within 60 min with carbs + 20-30 g protein; add a second carb meal if double day.",
        }

    def _hydration_guidance(self, duration: float, intensity_zone: str) -> Dict[str, Any]:
        ml_low, ml_high = HYDRATION_ML_PER_HR_RANGE
        sodium_low, sodium_high = HYDRATION_SODIUM_MG_PER_L_RANGE
        needs_electrolytes = duration >= 60 or intensity_zone in {"Z3", "Z4", "Z5"}
        return {
            "fluids_ml_per_hour": f"{ml_low}-{ml_high}",
            "sodium_mg_per_l": f"{sodium_low}-{sodium_high}" if needs_electrolytes else "Lightly salted foods suffice for short easy days.",
            "notes": "Use thirst as a guide; adjust upward in heat or humidity.",
        }


class RecoveryEngine:
    """Readiness scoring plus recovery actions."""

    def readiness_score(self, inputs: DailyReadinessInputs, user: UserProfile, load_zone: str) -> Tuple[float, str]:
        score = 100.0
        score -= max(0.0, (7.5 - inputs.sleep_hours) * 5.0)
        score += (inputs.sleep_quality - 7) * 3.0
        score -= (inputs.soreness - 3) * 4.0
        score -= (inputs.stress - 3) * 3.0
        score += (inputs.mental_energy - 5) * 2.5

        if inputs.resting_hr and user.resting_hr:
            delta = inputs.resting_hr - user.resting_hr
            if delta > 0:
                score -= delta * 1.2
        if inputs.hrv_change_ms is not None and inputs.hrv_change_ms < 0:
            score += inputs.hrv_change_ms * 0.6  # negative change reduces score

        if load_zone in {"elevated", "high"}:
            score -= 8

        if user.injury_flag:
            score -= 10

        score = clamp(score, 0, 100)
        tier = "high" if score >= READINESS_TIER_BOUNDS["high"] else "moderate" if score >= READINESS_TIER_BOUNDS["moderate"] else "low"
        return score, tier

    def protocol(self, readiness_tier: str, acwr_zone: str, user: UserProfile) -> Dict[str, Any]:
        actions: List[str] = ["7-9h sleep, consistent bedtime", "Protein with every meal; colorful carbs and healthy fats"]
        monitoring: List[str] = ["Subjective check-in (mood/soreness)", "Resting HR on waking"]

        if readiness_tier == "low" or acwr_zone in {"high"}:
            actions.extend(["Active recovery: 20-40 min easy walk/ride", "10-15 min mobility + light band work", "Early night; reduce stimulants"])
            monitoring.append("Delay intensity until readiness improves")
        elif readiness_tier == "moderate" or acwr_zone == "elevated":
            actions.extend(["Keep intensity at or below Z2 today", "Add 5-10 min of post-run mobility", "Extra 20-30 g carbs in evening meal"])
        else:
            actions.extend(["Proceed with planned intensity; keep warmup thorough", "Short strides to maintain neuromuscular readiness"])

        if user.age >= MASTERS_AGE:
            actions.append("Include extra calf/hip stability 2-3x/week; extend cooldown by 5 min")
        if user.training_level == "novice":
            actions.append("Prefer soft surfaces; focus on relaxed form cues")
        if user.injury_flag:
            actions.append("Prioritize pain-free movement; skip plyometrics and downhill stress")

        return {"actions": actions, "monitoring": monitoring}


# ------------------------------ AICoach facade ------------------------------ #


class AICoach:
    """Coordinates physiology, load, nutrition, and recovery logic."""

    def __init__(self) -> None:
        self.physiology = PhysiologyEngine()
        self.load_manager = LoadManager()
        self.nutrition = NutritionEngine()
        self.recovery = RecoveryEngine()

    def generate_daily_plan(
        self, user_profile: UserProfile, macrocycle_context: MacrocycleContext, microcycle_day: MicrocycleDayContext
    ) -> Dict[str, Any]:
        adaptations: List[str] = []

        hr_zones = self._safe_zones(user_profile, adaptations)
        load_risk = self.load_manager.load_report(microcycle_day.load_history)
        readiness_score, readiness_tier = self.recovery.readiness_score(
            microcycle_day.readiness_inputs, user_profile, load_risk["zone"]
        )

        selected_template = self._adapt_template(microcycle_day.template, readiness_tier, load_risk["zone"], user_profile, adaptations)
        session = self._build_training_session(selected_template, microcycle_day, macrocycle_context, hr_zones, readiness_tier, adaptations)
        nutrition_plan = self.nutrition.build_plan(session, user_profile)
        recovery_protocol = self.recovery.protocol(readiness_tier, load_risk["zone"], user_profile)

        day_entry = {
            "day_index": microcycle_day.day_index,
            "day_name": microcycle_day.day_name,
            "template_requested": microcycle_day.template,
            "template_final": selected_template,
            "training_session": session,
            "nutrition_engine": nutrition_plan,
            "recovery_protocol": recovery_protocol,
            "load_risk": load_risk,
            "readiness": {"score": round(readiness_score, 1), "tier": readiness_tier},
            "adaptations": adaptations,
            "meta": {
                "user_profile": user_profile.to_protocol(),
                "macrocycle_context": macrocycle_context.to_protocol(),
            },
        }
        return day_entry

    def _safe_zones(self, user: UserProfile, adaptations: List[str]) -> Dict[str, Tuple[int, int]]:
        if not user.max_hr:
            adaptations.append("Missing max_hr; defaulting to 190 bpm for zone calc.")
        max_hr = user.max_hr or 190
        return self.physiology.heart_rate_zones(max_hr, user.resting_hr)

    def _adapt_template(
        self, template: str, readiness_tier: str, acwr_zone: str, user: UserProfile, adaptations: List[str]
    ) -> str:
        adjusted = template
        if user.injury_flag and template not in {"Rest", "Recovery"}:
            adjusted = "Recovery"
            adaptations.append("Injury flag set; downgrading to Recovery.")

        if readiness_tier == "low":
            if template not in {"Rest", "Recovery"}:
                adjusted = "Recovery"
                adaptations.append("Low readiness detected; replaced hard session with Recovery.")
            if acwr_zone in {"high"}:
                adjusted = "Rest"
                adaptations.append("High ACWR + low readiness; prescribing Rest.")
        elif acwr_zone in {"high"}:
            if template in {"VO2_Intervals", "Double_Threshold"}:
                adjusted = "Threshold"
                adaptations.append("High ACWR; downgrading from very hard to Threshold.")
        elif acwr_zone in {"elevated"} and template in {"VO2_Intervals", "Double_Threshold"}:
            adjusted = "Threshold"
            adaptations.append("Elevated ACWR; shifting to Threshold focus.")

        return adjusted

    def _build_training_session(
        self,
        template: str,
        day: MicrocycleDayContext,
        macrocycle: MacrocycleContext,
        hr_zones: Dict[str, Tuple[int, int]],
        readiness_tier: str,
        adaptations: List[str],
    ) -> Dict[str, Any]:
        builder = {
            "Rest": self._rest_day,
            "Recovery": self._recovery_run,
            "Long Run": self._long_run,
            "Threshold": self._threshold_run,
            "VO2_Intervals": self._vo2_intervals,
            "Double_Threshold": self._double_threshold,
        }.get(template, self._recovery_run)

        session = builder(day, macrocycle, hr_zones)
        session["template"] = template
        session["primary_zone"] = session.get("primary_zone", "Z1")

        if readiness_tier == "moderate" and template not in {"Rest", "Recovery"}:
            session = self._trim_volume(session, 0.85, adaptations, "Moderate readiness; trimmed volume by 15%.")

        if day.availability_minutes and session["duration_minutes"] > day.availability_minutes:
            session = self._trim_to_availability(session, day.availability_minutes, adaptations)

        session["estimated_load"] = self._estimate_load(session.get("segments", []))
        return session

    def _trim_volume(self, session: Dict[str, Any], factor: float, adaptations: List[str], reason: str) -> Dict[str, Any]:
        session = {**session}
        session["duration_minutes"] = max(0, round(session["duration_minutes"] * factor))
        new_segments = []
        for segment in session.get("segments", []):
            segment = dict(segment)
            segment["duration_minutes"] = max(0, round(segment.get("duration_minutes", 0) * factor))
            new_segments.append(segment)
        session["segments"] = new_segments
        adaptations.append(reason)
        return session

    def _trim_to_availability(self, session: Dict[str, Any], available: int, adaptations: List[str]) -> Dict[str, Any]:
        if session["duration_minutes"] == 0:
            return session
        factor = available / max(session["duration_minutes"], 1)
        trimmed = self._trim_volume(session, factor, adaptations, f"Duration capped to availability ({available} min).")
        return trimmed

    def _rest_day(self, _: MicrocycleDayContext, __: MacrocycleContext, ___: Dict[str, Tuple[int, int]]) -> Dict[str, Any]:
        return {
            "type": "Rest",
            "duration_minutes": 0,
            "segments": [],
            "primary_zone": "Z1",
            "notes": "Full rest or light 20-30 min walk if desired.",
        }

    def _recovery_run(
        self, day: MicrocycleDayContext, _: MacrocycleContext, hr_zones: Dict[str, Tuple[int, int]]
    ) -> Dict[str, Any]:
        duration = max(20, min(day.availability_minutes, 40))
        return {
            "type": "Recovery",
            "duration_minutes": duration,
            "segments": [
                {"label": "Easy", "duration_minutes": duration, "target_zone": "Z1", "hr_range_bpm": hr_zones["Z1"]},
            ],
            "primary_zone": "Z1",
            "notes": "Keep cadence relaxed; nasal breathing. Optional 3-4x10s strides if feeling fresh.",
        }

    def _long_run(
        self, day: MicrocycleDayContext, macrocycle: MacrocycleContext, hr_zones: Dict[str, Tuple[int, int]]
    ) -> Dict[str, Any]:
        target_duration = min(max(day.availability_minutes, 75), 120)
        warmup = 10
        cooldown = 10
        surge_block = 8
        steady = max(target_duration - (warmup + cooldown + surge_block), 40)
        total_duration = warmup + steady + surge_block + cooldown
        if total_duration > target_duration:
            surplus = total_duration - target_duration
            steady = max(40, steady - surplus)
            total_duration = warmup + steady + surge_block + cooldown
        segments: List[Dict[str, Any]] = [
            {"label": "Warm-up", "duration_minutes": warmup, "target_zone": "Z1", "hr_range_bpm": hr_zones["Z1"]},
            {"label": "Steady", "duration_minutes": steady, "target_zone": "Z2", "hr_range_bpm": hr_zones["Z2"]},
        ]
        if surge_block > 0:
            segments.append(
                {
                    "label": "Optional Surges",
                    "duration_minutes": surge_block,
                    "target_zone": "Z3",
                    "hr_range_bpm": hr_zones["Z3"],
                    "notes": "4x2 min uptempo with 3 min easy jogs",
                }
            )
        segments.append({"label": "Cool-down", "duration_minutes": cooldown, "target_zone": "Z1", "hr_range_bpm": hr_zones["Z1"]})
        return {
            "type": "Endurance",
            "duration_minutes": total_duration,
            "segments": segments,
            "primary_zone": "Z2",
            "notes": f"Macrocycle phase: {macrocycle.phase}. Keep fueling steady; avoid racing the long run.",
        }

    def _threshold_run(
        self, day: MicrocycleDayContext, macrocycle: MacrocycleContext, hr_zones: Dict[str, Tuple[int, int]]
    ) -> Dict[str, Any]:
        reps = 3
        rep_duration = 10
        recovery = 3
        total_main = reps * rep_duration + (reps - 1) * recovery
        total_duration = 15 + total_main + 10
        if total_duration > day.availability_minutes:
            factor = day.availability_minutes / total_duration
            rep_duration = max(8, round(rep_duration * factor))
            reps = max(2, reps - 1)
            total_main = reps * rep_duration + (reps - 1) * recovery
            total_duration = 15 + total_main + 10
        intervals = [
            {"label": f"Threshold rep {i+1}", "duration_minutes": rep_duration, "target_zone": "Z3", "hr_range_bpm": hr_zones["Z3"]}
            for i in range(reps)
        ]
        recoveries = [{"label": f"Recovery jog {i+1}", "duration_minutes": recovery, "target_zone": "Z1", "hr_range_bpm": hr_zones["Z1"]} for i in range(reps - 1)]
        segments: List[Dict[str, Any]] = [{"label": "Warm-up", "duration_minutes": 15, "target_zone": "Z1", "hr_range_bpm": hr_zones["Z1"]}]
        for rep, rec in zip(intervals, recoveries + [None]):  # type: ignore[arg-type]
            segments.append(rep)
            if rec:
                segments.append(rec)
        segments.append({"label": "Cool-down", "duration_minutes": 10, "target_zone": "Z1", "hr_range_bpm": hr_zones["Z1"]})
        return {
            "type": "Lactate Threshold",
            "duration_minutes": total_duration,
            "segments": segments,
            "primary_zone": "Z3",
            "notes": f"Stay controlled; avoid drifting into VO2. Phase: {macrocycle.phase}.",
        }

    def _vo2_intervals(
        self, day: MicrocycleDayContext, macrocycle: MacrocycleContext, hr_zones: Dict[str, Tuple[int, int]]
    ) -> Dict[str, Any]:
        reps = 5
        rep_duration = 3
        recovery = 2
        total_main = reps * rep_duration + (reps - 1) * recovery
        total_duration = 15 + total_main + 10
        if total_duration > day.availability_minutes:
            reps = max(4, reps - 1)
            total_main = reps * rep_duration + (reps - 1) * recovery
            total_duration = 15 + total_main + 10
        intervals = [
            {"label": f"VO2 rep {i+1}", "duration_minutes": rep_duration, "target_zone": "Z4", "hr_range_bpm": hr_zones["Z4"]} for i in range(reps)
        ]
        recoveries = [{"label": f"Recovery jog {i+1}", "duration_minutes": recovery, "target_zone": "Z1", "hr_range_bpm": hr_zones["Z1"]} for i in range(reps - 1)]
        segments: List[Dict[str, Any]] = [{"label": "Warm-up", "duration_minutes": 15, "target_zone": "Z1", "hr_range_bpm": hr_zones["Z1"]}]
        for rep, rec in zip(intervals, recoveries + [None]):  # type: ignore[arg-type]
            segments.append(rep)
            if rec:
                segments.append(rec)
        segments.append({"label": "Cool-down", "duration_minutes": 10, "target_zone": "Z1", "hr_range_bpm": hr_zones["Z1"]})
        return {
            "type": "VO2 Max Intervals",
            "duration_minutes": total_duration,
            "segments": segments,
            "primary_zone": "Z4",
            "notes": f"Target fast-but-controlled reps; stop early if form breaks. Phase: {macrocycle.phase}.",
        }

    def _double_threshold(
        self, day: MicrocycleDayContext, macrocycle: MacrocycleContext, hr_zones: Dict[str, Tuple[int, int]]
    ) -> Dict[str, Any]:
        warmup = 10
        cooldown = 10
        am_block = 25
        pm_block = 30
        easy_between = 10
        planned_total = warmup + am_block + easy_between + pm_block + cooldown
        target_total = min(day.availability_minutes, 90)
        if planned_total > target_total:
            factor = target_total / planned_total
            am_block = max(15, round(am_block * factor))
            pm_block = max(20, round(pm_block * factor))
            easy_between = max(5, round(easy_between * factor))
        total_duration = warmup + am_block + easy_between + pm_block + cooldown
        return {
            "type": "Double Threshold (conservative)",
            "duration_minutes": total_duration,
            "segments": [
                {"label": "Warm-up", "duration_minutes": warmup, "target_zone": "Z1", "hr_range_bpm": hr_zones["Z1"]},
                {"label": "AM Tempo", "duration_minutes": am_block, "target_zone": "Z3", "hr_range_bpm": hr_zones["Z3"]},
                {"label": "Recovery jog", "duration_minutes": easy_between, "target_zone": "Z1", "hr_range_bpm": hr_zones["Z1"]},
                {"label": "PM Steady", "duration_minutes": pm_block, "target_zone": "Z2", "hr_range_bpm": hr_zones["Z2"]},
                {"label": "Cool-down", "duration_minutes": cooldown, "target_zone": "Z1", "hr_range_bpm": hr_zones["Z1"]},
            ],
            "primary_zone": "Z3",
            "notes": f"Keep conservative intensity; cut second block if fatigue rises. Phase: {macrocycle.phase}.",
        }

    def _estimate_load(self, segments: List[Dict[str, Any]]) -> float:
        total = 0.0
        for segment in segments:
            factor = INTENSITY_FACTORS.get(segment.get("target_zone", "Z1"), 1.0)
            total += segment.get("duration_minutes", 0) * factor
        return round(total, 1)


# --------------------------------- Demo --------------------------------- #


if __name__ == "__main__":
    sample_user = UserProfile(
        user_id="athlete-123",
        age=35,
        sex="male",
        weight_kg=68.0,
        height_cm=175.0,
        max_hr=190,
        resting_hr=52,
        training_level="intermediate",
        injury_flag=False,
        goal_event="Spring Half Marathon",
    )

    sample_macro = MacrocycleContext(
        phase="build",
        weeks_to_event=10,
        goal_event="Spring Half Marathon",
        target_weekly_distance_km=55.0,
        surface_focus="road",
    )

    readiness_inputs = DailyReadinessInputs(
        sleep_hours=6.5,
        sleep_quality=7,
        soreness=4,
        stress=5,
        mental_energy=6,
        resting_hr=56,
        hrv_change_ms=-5.0,
    )

    sample_day = MicrocycleDayContext(
        day_index=2,
        day_name="Tuesday",
        template="Threshold",
        availability_minutes=75,
        readiness_inputs=readiness_inputs,
        planned_distance_km=12.0,
        load_history=[48, 52, 60, 62, 50, 40, 55, 70, 68, 64, 60, 58, 62, 65, 63, 60, 58, 55, 50, 48, 52, 50, 45, 40, 42, 44, 46, 48],
        environment="cool, dry",
    )

    coach = AICoach()
    daily_plan = coach.generate_daily_plan(sample_user, sample_macro, sample_day)

    print("=== Load / Risk Analysis ===")
    print(daily_plan["load_risk"])
    print("\n=== Daily Plan (current_microcycle.days[i]) ===")
    from pprint import pprint

    pprint(daily_plan)
