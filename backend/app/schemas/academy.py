from datetime import datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, JsonValue, field_validator, model_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class HealthRead(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: Literal["ok", "unavailable"]
    database: str
    schema_status: str = Field(serialization_alias="schema", validation_alias="schema")
    timestamp: datetime


class CatalogCounts(BaseModel):
    paths: int
    modules: int
    lessons: int
    questions: int
    glossary: int
    review_cards: int
    chart_exercises: int
    calculator_exercises: int
    simulation_scenarios: int


class CatalogSummary(BaseModel):
    schema_version: str
    default_locale: str
    locales: list[str]
    counts: CatalogCounts


class ScenarioMetadata(BaseModel):
    id: str
    order: int
    simulated: bool
    title: dict[str, str]
    brief: dict[str, str]
    account: dict[str, JsonValue]
    decision_points: list[dict[str, JsonValue]]
    related_lessons: list[str]
    recommended_review_cards: list[str]


class ReviewCardRead(BaseModel):
    id: str
    glossary_id: str
    path_ids: list[str]
    kind: str
    front: dict[str, str]
    back: dict[str, str]


class SourceRead(BaseModel):
    id: str
    publisher: str
    title: str
    url: str


class GlossaryTermRead(BaseModel):
    id: str
    path_ids: list[str]
    term: dict[str, str]
    definition: dict[str, str]


class KnowledgeCheckMetadata(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    lesson_id: str
    type: str
    prompt: dict[str, str]
    options: list[dict[str, JsonValue]] | None = None
    items: list[dict[str, JsonValue]] | None = None
    pairs: list[dict[str, JsonValue]] | None = None
    left_items: list[dict[str, JsonValue]] | None = None
    right_items: list[dict[str, JsonValue]] | None = None
    chart_exercise_id: str | None = None
    scenario_id: str | None = None
    review_recommended: bool = False


class LessonRead(BaseModel):
    id: str
    path_id: str
    module_id: str
    order: int
    duration_minutes: int
    difficulty: str
    prerequisites: list[str]
    title: dict[str, str]
    summary: dict[str, str]
    objectives: dict[str, list[str]]
    content: dict[str, JsonValue]
    knowledge_checks: list[str]
    review_cards: list[str]
    glossary: list[str]
    sources: list[str]
    resolved_sources: list[SourceRead] = Field(default_factory=list)
    resolved_glossary: list[GlossaryTermRead] = Field(default_factory=list)
    resolved_review_cards: list[ReviewCardRead] = Field(default_factory=list)
    knowledge_check_metadata: list[KnowledgeCheckMetadata] = Field(default_factory=list)


class ModuleRead(BaseModel):
    id: str
    path_id: str
    order: int
    title: dict[str, str]
    objective: dict[str, str]
    lessons: list[LessonRead] = Field(default_factory=list)


class LearningPathRead(BaseModel):
    id: str
    order: int
    status: str
    difficulty: str
    estimated_minutes: int
    prerequisite_path_ids: list[str]
    title: dict[str, str]
    summary: dict[str, str]
    preview_topics: dict[str, list[str]]
    final_assessment_id: str | None
    completion_criteria: dict[str, JsonValue] | None
    lesson_count: int
    module_count: int


class LearningPathDetail(LearningPathRead):
    lessons: list[LessonRead]
    modules: list[ModuleRead]


class ChartExerciseRead(BaseModel):
    id: str
    lesson_id: str
    order: int
    title: dict[str, str]
    prompt: dict[str, str]
    data: dict[str, JsonValue]
    solution: dict[str, JsonValue]
    accessibility_summary: dict[str, str]


class CalculatorExerciseRead(BaseModel):
    id: str
    lesson_id: str
    order: int
    title: dict[str, str]
    prompt: dict[str, str]
    formula: str
    inputs: dict[str, JsonValue]
    expected: dict[str, JsonValue]
    worked_example: dict[str, str]
    interpretation: dict[str, str]
    common_mistake: dict[str, str]


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)
    locale: Literal["de", "sl", "en"] = "de"
    timezone: str = Field(default="Europe/Berlin", min_length=1, max_length=64)
    bio: str | None = Field(default=None, max_length=500)


class ProfileRead(ORMModel):
    user_id: UUID
    display_name: str | None
    locale: str
    timezone: str
    bio: str | None
    created_at: datetime
    updated_at: datetime


class PreferenceUpdate(BaseModel):
    theme: Literal["light", "dark", "system"] = "system"
    weekly_study_minutes: int = Field(default=180, ge=15, le=2400)
    reduced_motion: bool = False
    email_reminders: bool = False


class PreferenceRead(ORMModel):
    user_id: UUID
    theme: str
    weekly_study_minutes: int
    reduced_motion: bool
    email_reminders: bool
    updated_at: datetime


class OnboardingIn(BaseModel):
    learning_goal: str = Field(min_length=1, max_length=80)
    experience_level: str = Field(min_length=1, max_length=32)
    primary_interest: str = Field(min_length=1, max_length=32)
    weekly_study_minutes: int = Field(ge=15, le=2400)
    prior_market_experience: str = Field(min_length=1, max_length=32)
    risk_knowledge: str = Field(min_length=1, max_length=32)
    learning_style: str = Field(min_length=1, max_length=32)
    placement_score: int | None = Field(default=None, ge=0, le=100)
    answers: dict[str, JsonValue] = Field(default_factory=dict)


class OnboardingRead(ORMModel):
    user_id: UUID
    learning_goal: str
    experience_level: str
    primary_interest: str
    weekly_study_minutes: int
    prior_market_experience: str
    risk_knowledge: str
    learning_style: str
    recommended_path_id: str
    placement_score: int | None
    completed_at: datetime


class ProgressUpdate(BaseModel):
    status: Literal["not_started", "in_progress", "completed"]
    progress_percent: int = Field(ge=0, le=100)
    best_score: Decimal | None = Field(default=None, ge=0, le=100)
    content_version: str | None = Field(default=None, max_length=40)

    @model_validator(mode="after")
    def completion_is_consistent(self) -> "ProgressUpdate":
        if self.status == "completed" and self.progress_percent != 100:
            raise ValueError("completed lessons require progress_percent=100")
        return self


class ProgressRead(ORMModel):
    id: UUID
    lesson_id: str
    status: str
    progress_percent: int
    best_score: Decimal | None
    attempts: int
    content_version: str | None
    started_at: datetime | None
    completed_at: datetime | None
    updated_at: datetime


class NoteWrite(BaseModel):
    body: str = Field(min_length=1, max_length=20_000)


class NoteRead(ORMModel):
    id: UUID
    lesson_id: str
    body: str
    created_at: datetime
    updated_at: datetime


class BookmarkRead(ORMModel):
    id: UUID
    lesson_id: str
    created_at: datetime


class QuizAnswerIn(BaseModel):
    question_id: str = Field(min_length=1, max_length=120)
    answer: JsonValue


class QuizSubmission(BaseModel):
    answers: list[QuizAnswerIn] = Field(min_length=1, max_length=200)

    @field_validator("answers")
    @classmethod
    def unique_questions(cls, value: list[QuizAnswerIn]) -> list[QuizAnswerIn]:
        ids = [item.question_id for item in value]
        if len(ids) != len(set(ids)):
            raise ValueError("each question may be answered once")
        return value


class QuestionFeedback(BaseModel):
    question_id: str
    correct: bool
    explanation: JsonValue
    correct_answer: JsonValue = None
    review_recommended: bool = False


class QuizResult(BaseModel):
    attempt_id: UUID
    quiz_id: str
    correct_count: int
    question_count: int
    score_percent: Decimal
    feedback: list[QuestionFeedback]


class QuizRead(BaseModel):
    id: str
    lesson_id: str
    questions: list[dict[str, JsonValue]]


class ReviewGradeIn(BaseModel):
    rating: Literal["again", "hard", "good", "easy"]
    due_at: datetime
    stability: Decimal = Field(ge=0, le=36500)
    difficulty: Decimal = Field(ge=1, le=10)
    state: Literal["new", "learning", "review", "relearning"]
    reps: int = Field(ge=1)
    lapses: int = Field(ge=0)
    last_review: datetime

    @field_validator("due_at", "last_review")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("review timestamps must include a timezone")
        return value


class ReviewScheduleRead(ORMModel):
    id: UUID
    card_id: str
    due_at: datetime
    stability: Decimal
    difficulty: Decimal
    state: str
    review_count: int
    lapse_count: int
    last_reviewed_at: datetime | None


class ReviewQueueSchedule(BaseModel):
    id: UUID
    due_at: datetime
    stability: Decimal
    difficulty: Decimal
    state: str
    reps: int
    lapses: int
    last_review: datetime | None


class ReviewQueueItem(BaseModel):
    card: ReviewCardRead
    schedule: ReviewQueueSchedule


class ReviewGradeResult(BaseModel):
    card_id: str
    rating: str
    due_at: datetime
    stability: Decimal
    difficulty: Decimal
    state: str
    review_count: int
    lapse_count: int


class SimulatorCreate(BaseModel):
    scenario_id: str = Field(min_length=1, max_length=120)
    initial_balance: Decimal = Field(default=Decimal("10000"), gt=0, le=Decimal("100000000"))
    spread_bps: Decimal = Field(default=Decimal("2"), ge=0, le=1000)
    slippage_bps: Decimal = Field(default=Decimal("1"), ge=0, le=1000)
    commission_fixed: Decimal = Field(default=Decimal("0"), ge=0, le=100000)
    commission_bps: Decimal = Field(default=Decimal("0"), ge=0, le=1000)
    planned_risk: Decimal | None = Field(default=None, gt=0)
    decision_note: str = Field(default="", max_length=2000)
    risk_defined_before_entry: bool = False
    concentration_checked: bool = False


class SimulatorOrderIn(BaseModel):
    """An entry order with optional bracket protection for the resulting position."""

    expected_version: int = Field(ge=1)
    client_order_id: str = Field(min_length=1, max_length=100)
    side: Literal["buy", "sell"]
    order_type: Literal["market", "limit", "stop"]
    quantity: Decimal = Field(gt=0, le=Decimal("100000000"))
    trigger_price: Decimal | None = Field(default=None, gt=0)
    stop_loss: Decimal | None = Field(default=None, gt=0)
    take_profit: Decimal | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def trigger_is_present(self) -> "SimulatorOrderIn":
        if self.order_type in {"limit", "stop"} and self.trigger_price is None:
            raise ValueError("limit and stop orders require trigger_price")
        return self


class SimulatorStepIn(BaseModel):
    candles: int = Field(default=1, ge=1, le=100)
    expected_version: int = Field(ge=1)


class SimulatorCloseIn(BaseModel):
    expected_version: int = Field(ge=1)
    reason: str = Field(default="manual", min_length=1, max_length=32)


class SimulatorOrderRead(ORMModel):
    id: UUID
    client_order_id: str
    side: str
    order_type: str
    quantity: Decimal
    trigger_price: Decimal | None
    stop_loss: Decimal | None
    take_profit: Decimal | None
    planned_risk: Decimal | None
    status: str
    filled_price: Decimal | None
    filled_at: datetime | None
    rejection_reason: str | None
    rule_violations: list[str]
    created_at: datetime


class SimulatorTradeRead(ORMModel):
    id: UUID
    side: str
    quantity: Decimal
    entry_price: Decimal
    exit_price: Decimal
    gross_pnl: Decimal
    commission: Decimal
    net_pnl: Decimal
    planned_risk: Decimal | None
    r_multiple: Decimal | None
    opened_at: datetime
    closed_at: datetime
    exit_reason: str
    rule_violations: list


class SimulatorSessionRead(BaseModel):
    id: UUID
    scenario_id: str
    status: str
    initial_balance: Decimal
    cash_balance: Decimal
    equity: Decimal
    realized_pnl: Decimal
    unrealized_pnl: Decimal
    position_quantity: Decimal
    average_entry_price: Decimal | None
    position_stop_loss: Decimal | None
    position_take_profit: Decimal | None
    current_candle_index: int
    decision_note: str
    risk_defined_before_entry: bool
    concentration_checked: bool
    visible_candles: list[dict[str, Any]]
    version: int
    rule_violations: list[str]
    orders: list[SimulatorOrderRead]
    pending_orders: list[SimulatorOrderRead]
    trades: list[SimulatorTradeRead]


class SimulatorMetrics(BaseModel):
    net_pnl: Decimal
    gross_profit: Decimal
    gross_loss: Decimal
    win_rate: Decimal
    average_win: Decimal
    average_loss: Decimal
    payoff_ratio: Decimal | None
    expectancy: Decimal
    profit_factor: Decimal | None
    maximum_drawdown: Decimal
    average_r: Decimal | None
    best_trade: Decimal | None
    worst_trade: Decimal | None
    average_holding_seconds: Decimal | None
    rule_violations: int


class SimulatorProcessEvaluation(BaseModel):
    score: int = Field(ge=0, le=100)
    followed_rules: list[str]
    violated_rules: list[str]
    unevaluated_scenario_rules: list[str]


class SimulatorResults(BaseModel):
    metrics: SimulatorMetrics
    process: SimulatorProcessEvaluation
    orders: list[SimulatorOrderRead]
    trades: list[SimulatorTradeRead]
    debrief: dict[str, JsonValue]
    related_lessons: list[str]
    recommended_review_cards: list[str]


class JournalWrite(BaseModel):
    setup: str = Field(min_length=1, max_length=160)
    thesis: str = Field(min_length=1, max_length=20_000)
    market_context: str = Field(default="", max_length=20_000)
    simulation_session_id: UUID | None = None
    entry_price: Decimal | None = Field(default=None, gt=0)
    stop_price: Decimal | None = Field(default=None, gt=0)
    target_price: Decimal | None = Field(default=None, gt=0)
    planned_risk: Decimal | None = Field(default=None, ge=0)
    actual_risk: Decimal | None = Field(default=None, ge=0)
    result_amount: Decimal | None = None
    r_multiple: Decimal | None = None
    emotions_before: str | None = Field(default=None, max_length=240)
    emotions_during: str | None = Field(default=None, max_length=240)
    emotions_after: str | None = Field(default=None, max_length=240)
    rule_adherence: int | None = Field(default=None, ge=0, le=100)
    lesson_learned: str = Field(default="", max_length=20_000)
    chart_snapshot_url: str | None = Field(default=None, max_length=2000)
    tags: list[str] = Field(default_factory=list, max_length=20)


class JournalRead(ORMModel):
    id: UUID
    simulation_session_id: UUID | None
    setup: str
    thesis: str
    market_context: str
    entry_price: Decimal | None
    stop_price: Decimal | None
    target_price: Decimal | None
    planned_risk: Decimal | None
    actual_risk: Decimal | None
    result_amount: Decimal | None
    r_multiple: Decimal | None
    emotions_before: str | None
    emotions_during: str | None
    emotions_after: str | None
    rule_adherence: int | None
    lesson_learned: str
    chart_snapshot_url: str | None
    created_at: datetime
    updated_at: datetime
    tags: list[str] = Field(default_factory=list)


class JournalPage(BaseModel):
    items: list[JournalRead]
    total: int
    limit: int
    offset: int


class PositionSizeIn(BaseModel):
    account_balance: Decimal = Field(gt=0)
    risk_percent: Decimal = Field(gt=0, le=100)
    entry_price: Decimal = Field(gt=0)
    stop_price: Decimal = Field(gt=0)


class ExpectancyIn(BaseModel):
    win_rate: Decimal = Field(ge=0, le=100)
    average_win: Decimal = Field(ge=0)
    average_loss: Decimal = Field(ge=0)


class DrawdownIn(BaseModel):
    equity_curve: list[Decimal] = Field(min_length=1, max_length=10000)


class RewardRiskIn(BaseModel):
    entry_price: Decimal = Field(gt=0)
    stop_price: Decimal = Field(gt=0)
    target_price: Decimal = Field(gt=0)
    side: Literal["long", "short"] = "long"


class PositionSizeResult(BaseModel):
    risk_amount: Decimal
    risk_per_unit: Decimal
    quantity: Decimal
    position_value: Decimal


class RewardRiskResult(BaseModel):
    risk_per_unit: Decimal
    reward_per_unit: Decimal
    reward_to_risk: Decimal


class ExpectancyResult(BaseModel):
    expectancy: Decimal
    break_even_win_rate: Decimal


class DrawdownResult(BaseModel):
    maximum_drawdown: Decimal
    maximum_drawdown_percent: Decimal


class DashboardProfile(BaseModel):
    display_name: str | None
    locale: str
    timezone: str


class DashboardOnboarding(BaseModel):
    completed: bool
    recommended_path_id: str | None


class DashboardProgressItem(BaseModel):
    lesson_id: str
    status: str
    progress_percent: int
    best_score: Decimal | None
    updated_at: datetime


class DashboardJournalItem(BaseModel):
    id: UUID
    setup: str
    result_amount: Decimal | None
    r_multiple: Decimal | None
    created_at: datetime


class DashboardSimulator(BaseModel):
    session_id: UUID
    scenario_id: str
    status: str
    equity: Decimal
    realized_pnl: Decimal


class DashboardMasteryItem(BaseModel):
    skill_id: str
    state: str
    score: int
    evidence_count: int


class DashboardStreak(BaseModel):
    current_days: int
    longest_days: int
    last_activity_date: str | None


class DashboardRead(BaseModel):
    profile: DashboardProfile | None
    onboarding: DashboardOnboarding
    progress: list[DashboardProgressItem]
    completed_lesson_count: int
    bookmarks: list[str]
    note_count: int
    due_review_count: int
    recent_journal: list[DashboardJournalItem]
    simulator: DashboardSimulator | None
    mastery: list[DashboardMasteryItem]
    streak: DashboardStreak


class AnalyticsRead(BaseModel):
    completed_lessons: int
    average_best_lesson_score: Decimal | None


class AchievementRead(BaseModel):
    achievement_id: str
    progress: int
    awarded_at: datetime


class NamedCount(BaseModel):
    name: str
    count: int


class SetupPerformance(BaseModel):
    setup: str
    trades: int
    average_r: Decimal | None
    average_result: Decimal | None
    average_rule_adherence: Decimal | None


class JournalPeriodSummary(BaseModel):
    entry_count: int
    total_result: Decimal
    average_r: Decimal | None
    average_rule_adherence: Decimal | None


class JournalSummary(BaseModel):
    entry_count: int
    top_setups: list[NamedCount]
    common_emotions: list[NamedCount]
    repeated_mistakes: list[NamedCount]
    average_rule_adherence: Decimal | None
    strongest_setups: list[SetupPerformance]
    weakest_setups: list[SetupPerformance]
    last_7_days: JournalPeriodSummary
    last_30_days: JournalPeriodSummary


class DecisionAttemptIn(BaseModel):
    activity_type: Literal["life_simulator", "scam_detector", "decision_lab"]
    activity_id: str = Field(min_length=1, max_length=120)
    content_version: str = Field(min_length=1, max_length=40)
    selected_option_id: str = Field(min_length=1, max_length=120)
    reasoning: str = Field(min_length=20, max_length=5000)
    assumptions: list[str] = Field(default_factory=list, max_length=20)
    calculations: dict[str, JsonValue] = Field(default_factory=dict)
    response: dict[str, JsonValue] = Field(default_factory=dict)


class DecisionAttemptRead(ORMModel):
    id: UUID
    activity_type: str
    activity_id: str
    content_version: str
    status: str
    selected_option_id: str | None
    reasoning: str
    assumptions: list[str]
    calculations: dict[str, JsonValue]
    feedback: dict[str, JsonValue]
    process_score: int
    started_at: datetime
    completed_at: datetime | None


class LifeSessionCreate(BaseModel):
    profile_id: str = Field(min_length=1, max_length=100)


class LifeSessionUpdate(BaseModel):
    expected_round: int = Field(ge=0, le=120)
    selected_option_id: str = Field(min_length=1, max_length=120)
    reasoning: str = Field(min_length=20, max_length=5000)
    calculations: dict[str, JsonValue] = Field(default_factory=dict)


class LifeSessionRead(ORMModel):
    id: UUID
    profile_id: str
    scenario_id: str
    scenario_version: str
    status: str
    current_round: int
    financial_state: dict[str, JsonValue]
    decision_history: list[dict[str, JsonValue]]
    process_score: int
    started_at: datetime
    updated_at: datetime
    completed_at: datetime | None


class CompetenceEvidenceRead(ORMModel):
    id: UUID
    competence_id: str
    source_type: str
    source_id: str
    content_version: str
    score: int
    summary: str
    details: dict[str, JsonValue]
    created_at: datetime


class CompetenceProfileItem(BaseModel):
    competence_id: str
    level: Literal["not_started", "introduced", "practising", "demonstrated", "strong"]
    score: int = Field(ge=0, le=100)
    evidence_count: int
    recent_evidence: list[CompetenceEvidenceRead]


class ClassroomCreate(BaseModel):
    activity_type: Literal[
        "life_simulator",
        "scam_detector",
        "decision_lab",
        "risk_case",
        "budgeting",
        "credit_comparison",
        "inflation_interest",
    ]
    activity_id: str = Field(min_length=1, max_length=120)
    content_version: str = Field(min_length=1, max_length=40)
    duration_minutes: Literal[45, 90]
    settings: dict[str, JsonValue] = Field(default_factory=dict)


class ClassroomSessionRead(ORMModel):
    id: UUID
    activity_type: str
    activity_id: str
    content_version: str
    duration_minutes: int
    status: str
    settings: dict[str, JsonValue]
    expires_at: datetime
    created_at: datetime
    started_at: datetime | None
    closed_at: datetime | None


class ClassroomCreated(ClassroomSessionRead):
    classroom_code: str


class ClassroomJoin(BaseModel):
    classroom_code: str = Field(min_length=6, max_length=12, pattern=r"^[A-Z2-9-]+$")
    pseudonym: str = Field(min_length=2, max_length=32, pattern=r"^[\w -]+$")
    website: str = Field(default="", max_length=0)


class ClassroomJoined(BaseModel):
    session_id: UUID
    participant_id: UUID
    participant_token: str
    activity_type: str
    activity_id: str
    content_version: str
    expires_at: datetime


class ClassroomResponseIn(BaseModel):
    item_id: str = Field(min_length=1, max_length=120)
    answer: dict[str, JsonValue]
    reasoning: str = Field(min_length=10, max_length=5000)
    completed: bool = False


class ClassroomDashboard(BaseModel):
    session: ClassroomSessionRead
    active_participants: int
    completed_participants: int
    completion_rate: int
    response_count: int
    class_process_score: int
    decision_distribution: dict[str, int]
    common_misconceptions: list[dict[str, int | str]]
    concepts_requiring_review: list[str]


class PartnershipInterestIn(BaseModel):
    kind: Literal["teacher_pilot", "classroom_sponsor", "foundation", "partner"]
    organisation: str = Field(min_length=2, max_length=160)
    contact_role: str = Field(min_length=2, max_length=100)
    contact_email: str = Field(min_length=5, max_length=320)
    message: str = Field(min_length=20, max_length=5000)
    consent: bool
    website: str = Field(default="", max_length=0)

    @field_validator("contact_email")
    @classmethod
    def plausible_email(cls, value: str) -> str:
        candidate = value.strip().lower()
        if candidate.count("@") != 1 or "." not in candidate.rsplit("@", 1)[1]:
            raise ValueError("contact_email must be a valid email address")
        return candidate

    @model_validator(mode="after")
    def consent_is_required(self) -> "PartnershipInterestIn":
        if not self.consent:
            raise ValueError("consent is required")
        return self


class PartnershipInterestAccepted(BaseModel):
    id: UUID
    retention_days: int
    status: Literal["accepted"] = "accepted"


class MentorRequest(BaseModel):
    context_type: Literal["lesson", "life_simulator", "scam_detector", "decision_lab"]
    context_id: str = Field(min_length=1, max_length=120)
    learner_message: str = Field(min_length=10, max_length=2000)
    decision_summary: str = Field(default="", max_length=3000)
    locale: Literal["de", "sl", "en"] = "de"


class MentorResponse(BaseModel):
    mode: Literal["ai", "guided_fallback"]
    question: str
    follow_up_prompts: list[str]
    safety_note: str
    referenced_content_ids: list[str]
