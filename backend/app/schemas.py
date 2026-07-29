from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class PhoneRequest(BaseModel):
    phone: str = Field(min_length=10, max_length=20)


class OtpIssued(BaseModel):
    expires_in_seconds: int
    dev_code: str | None = None


class PhoneVerify(BaseModel):
    phone: str
    code: str = Field(min_length=6, max_length=6)


class UserView(BaseModel):
    id: str
    phone: str
    nickname: str
    email: str | None
    university_id: str | None
    university_verified: bool
    role: str
    created_at: str


class AuthResult(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserView


class UniversityView(BaseModel):
    id: str
    name: str
    email_domains: list[str]


class UniversityVerificationRequest(BaseModel):
    university_id: str
    email: str


class UniversityVerificationConfirm(BaseModel):
    email: str
    code: str = Field(min_length=6, max_length=6)


class UserUpdate(BaseModel):
    nickname: str = Field(min_length=2, max_length=20)


class ResearchProfileUpdate(BaseModel):
    year: str | None = Field(default=None, max_length=20)
    department: str | None = Field(default=None, max_length=100)
    profile_categories: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("profile_categories")
    @classmethod
    def unique_profile_categories(cls, values: list[str]) -> list[str]:
        cleaned = [value.strip() for value in values if value.strip()]
        if len(cleaned) != len(set(cleaned)):
            raise ValueError("응답자 조건 카테고리는 중복될 수 없습니다.")
        return cleaned


QuestionType = Literal[
    # Research-survey question types used by the current product.
    "short_text",
    "long_text",
    "single_choice",
    "checkboxes",
    "dropdown",
    "linear_scale",
    "multiple_choice_grid",
    "checkbox_grid",
    "date",
    "time",
    "file_upload",
    # Backward-compatible aliases kept while the old prototype is migrated.
    "single",
    "multiple",
    "text",
    "number",
    "scale",
    "balance",
]


class OptionCreate(BaseModel):
    label: str = Field(min_length=1, max_length=200)


class ValidationRule(BaseModel):
    min_length: int | None = Field(default=None, ge=0, le=10_000)
    max_length: int | None = Field(default=None, ge=1, le=10_000)
    min_value: float | None = None
    max_value: float | None = None
    pattern: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validate_ranges(self) -> "ValidationRule":
        if (
            self.min_length is not None
            and self.max_length is not None
            and self.max_length < self.min_length
        ):
            raise ValueError("최대 글자 수는 최소 글자 수보다 작을 수 없습니다.")
        if (
            self.min_value is not None
            and self.max_value is not None
            and self.max_value < self.min_value
        ):
            raise ValueError("최댓값은 최솟값보다 작을 수 없습니다.")
        return self


class FileRule(BaseModel):
    allowed_types: list[str] = Field(
        default_factory=lambda: ["application/pdf", "image/png", "image/jpeg"],
        max_length=10,
    )
    max_files: int = Field(default=1, ge=1, le=10)
    max_size_mb: int = Field(default=10, ge=1, le=100)


class QuestionCreate(BaseModel):
    question_type: QuestionType
    prompt: str = Field(min_length=1, max_length=500)
    description: str = Field(default="", max_length=1000)
    required: bool = True
    min_choices: int | None = Field(default=None, ge=1)
    max_choices: int | None = Field(default=None, ge=1)
    options: list[OptionCreate] = Field(default_factory=list)
    rows: list[OptionCreate] = Field(default_factory=list, max_length=100)
    columns: list[OptionCreate] = Field(default_factory=list, max_length=50)
    scale_min: int | None = Field(default=None, ge=0, le=10)
    scale_max: int | None = Field(default=None, ge=1, le=10)
    scale_min_label: str | None = Field(default=None, max_length=100)
    scale_max_label: str | None = Field(default=None, max_length=100)
    validation: ValidationRule | None = None
    file_rule: FileRule | None = None

    @model_validator(mode="after")
    def validate_options(self) -> "QuestionCreate":
        option_types = {
            "single",
            "multiple",
            "balance",
            "single_choice",
            "checkboxes",
            "dropdown",
        }
        if self.question_type in option_types and len(self.options) < 2:
            raise ValueError("선택형 문항에는 선택지가 2개 이상 필요합니다.")
        if self.question_type == "balance" and len(self.options) != 2:
            raise ValueError("밸런스게임 문항에는 선택지가 정확히 2개 필요합니다.")
        if self.question_type in {"multiple_choice_grid", "checkbox_grid"}:
            if not self.rows or len(self.columns) < 2:
                raise ValueError("그리드 문항에는 행 1개와 열 2개 이상이 필요합니다.")
        if self.question_type in {"linear_scale", "scale"}:
            minimum = self.scale_min if self.scale_min is not None else 1
            maximum = self.scale_max if self.scale_max is not None else 5
            if maximum <= minimum:
                raise ValueError("선형 척도의 최댓값은 최솟값보다 커야 합니다.")
        if self.max_choices and self.min_choices and self.max_choices < self.min_choices:
            raise ValueError("max_choices는 min_choices보다 작을 수 없습니다.")
        return self


class RespondentCondition(BaseModel):
    field: Literal[
        "university_id",
        "year",
        "department",
        "profile_category",
    ]
    values: list[str] = Field(min_length=1, max_length=30)


class SurveyCreate(BaseModel):
    title: str = Field(min_length=2, max_length=150)
    description: str = Field(default="", max_length=3000)
    category: str = Field(default="기타", max_length=30)
    subcategory: str | None = Field(default=None, max_length=30)
    survey_type: Literal["standard", "balance"] = "standard"
    results_visibility: Literal["public", "after_participation", "private", "paid"] = (
        "after_participation"
    )
    result_price_points: int = Field(default=0, ge=0, le=100_000)
    reward_points: int | None = Field(
        default=None,
        ge=1,
        le=1_000,
        json_schema_extra={"deprecated": True},
    )
    target_responses: int | None = Field(default=None, ge=1, le=1_000_000)
    deadline: datetime | None = None
    questions: list[QuestionCreate] = Field(default_factory=list, max_length=100)
    category_tags: list[str] = Field(default_factory=list, max_length=3)
    external_access_enabled: bool = True
    respondent_results_enabled: bool = True
    exchange_enabled: bool = False
    exchange_methods: list[Literal["direct", "auto"]] = Field(
        default_factory=list, max_length=2
    )
    exchange_unit: Literal["individual", "team"] = "individual"
    team_id: str | None = None
    target_exchange_responses: int | None = Field(default=None, ge=1, le=10_000)
    team_requested_responses: int | None = Field(default=None, ge=1, le=100)
    auto_repeat: bool = True
    required_respondent_conditions: list[RespondentCondition] = Field(
        default_factory=list, max_length=20
    )

    @model_validator(mode="after")
    def validate_paid_results(self) -> "SurveyCreate":
        if self.results_visibility == "paid" and self.result_price_points <= 0:
            raise ValueError("유료 결과에는 열람 포인트를 설정해야 합니다.")
        if self.reward_points is not None:
            raise ValueError(
                "참여 보상은 서버가 계산합니다. 추가 보상은 설문 생성 후 "
                "reward-boost 결제 API를 사용하세요."
            )
        if self.survey_type == "balance":
            if len(self.questions) != 1 or self.questions[0].question_type != "balance":
                raise ValueError(
                    "밸런스게임은 선택지 2개의 balance 문항 하나로 구성해야 합니다."
                )
        if self.exchange_enabled:
            if not self.exchange_methods:
                raise ValueError("교환 기능을 켜면 직접 또는 자동 방식을 선택해야 합니다.")
            if self.deadline is None:
                raise ValueError("교환 기능을 사용하는 설문에는 마감일이 필요합니다.")
            if self.target_exchange_responses is None:
                raise ValueError("목표 교환 응답 수를 설정해야 합니다.")
            if self.exchange_unit == "team":
                if not self.team_id:
                    raise ValueError("팀 교환 설문에는 팀을 선택해야 합니다.")
                if self.team_requested_responses is None:
                    raise ValueError("팀의 희망 교환 응답 수를 설정해야 합니다.")
        return self


class SurveyUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=3000)
    category: str | None = Field(default=None, max_length=30)
    subcategory: str | None = Field(default=None, max_length=30)
    survey_type: Literal["standard", "balance"] | None = None
    results_visibility: (
        Literal["public", "after_participation", "private", "paid"] | None
    ) = None
    result_price_points: int | None = Field(default=None, ge=0, le=100_000)
    reward_points: int | None = Field(
        default=None,
        ge=1,
        le=1_000,
        json_schema_extra={"deprecated": True},
    )
    target_responses: int | None = Field(default=None, ge=1, le=1_000_000)
    deadline: datetime | None = None
    questions: list[QuestionCreate] | None = Field(
        default=None, max_length=100
    )
    category_tags: list[str] | None = Field(default=None, max_length=3)
    external_access_enabled: bool | None = None
    respondent_results_enabled: bool | None = None
    exchange_enabled: bool | None = None
    exchange_methods: list[Literal["direct", "auto"]] | None = Field(
        default=None, max_length=2
    )
    exchange_unit: Literal["individual", "team"] | None = None
    team_id: str | None = None
    target_exchange_responses: int | None = Field(default=None, ge=1, le=10_000)
    team_requested_responses: int | None = Field(default=None, ge=1, le=100)
    auto_repeat: bool | None = None
    required_respondent_conditions: list[RespondentCondition] | None = Field(
        default=None, max_length=20
    )


class SurveySummary(BaseModel):
    id: str
    author_id: str
    title: str
    description: str
    category: str
    survey_type: str
    status: str
    results_visibility: str
    target_responses: int | None
    deadline: str | None
    response_count: int
    like_count: int
    question_count: int
    created_at: str
    published_at: str | None
    subcategory: str | None = None
    result_price_points: int = 0
    reward_points: int = 0
    estimated_minutes: int = 1
    author_nickname: str | None = None
    university_name: str | None = None
    is_completed: bool = False
    is_liked: bool = False
    is_bookmarked: bool = False
    comment_count: int = 0
    progress_percentage: float | None = None
    deadline_imminent: bool = False
    base_reward_points: int = 0
    reward_boost_points: int = 0
    boosted_reward_points: int = 0
    reward_boost_price_krw: int = 0
    reward_boost_payment_status: str = "not_required"
    reward_multiplier: float = 1.0
    claimable_reward_points: int | None = None
    viewer_is_author: bool = False
    viewer_can_respond: bool = False
    viewer_can_view_results: bool = False
    effective_question_count: int = 0
    question_bucket: str | None = None
    category_tags: list[str] = Field(default_factory=list)
    external_access_enabled: bool = True
    respondent_results_enabled: bool = True
    exchange_enabled: bool = False
    exchange_methods: list[str] = Field(default_factory=list)
    exchange_unit: str = "individual"
    team_id: str | None = None
    target_exchange_responses: int | None = None
    team_requested_responses: int | None = None
    auto_repeat: bool = True
    required_respondent_conditions: list[dict[str, Any]] = Field(default_factory=list)
    exchange_completed_responses: int = 0
    exchange_reserved_responses: int = 0


class OptionView(BaseModel):
    id: str
    label: str
    position: int


class QuestionView(BaseModel):
    id: str
    position: int
    question_type: str
    prompt: str
    description: str = ""
    required: bool
    min_choices: int | None
    max_choices: int | None
    options: list[OptionView]
    rows: list[OptionView] = Field(default_factory=list)
    columns: list[OptionView] = Field(default_factory=list)
    scale_min: int | None = None
    scale_max: int | None = None
    scale_min_label: str | None = None
    scale_max_label: str | None = None
    validation: dict[str, Any] | None = None
    file_rule: dict[str, Any] | None = None


class SurveyDetail(SurveySummary):
    result_price_points: int
    questions: list[QuestionView]


class AnswerSubmit(BaseModel):
    question_id: str
    option_ids: list[str] = Field(default_factory=list)
    value_text: str | None = Field(default=None, max_length=5000)
    value_number: float | None = None
    value_date: str | None = Field(default=None, max_length=30)
    value_time: str | None = Field(default=None, max_length=30)
    grid_answers: dict[str, list[str]] = Field(default_factory=dict)
    file_uploads: list[dict[str, Any]] = Field(default_factory=list, max_length=10)

    @field_validator("option_ids")
    @classmethod
    def unique_options(cls, option_ids: list[str]) -> list[str]:
        if len(option_ids) != len(set(option_ids)):
            raise ValueError("같은 선택지를 중복해서 제출할 수 없습니다.")
        return option_ids


class SurveyResponseSubmit(BaseModel):
    answers: list[AnswerSubmit]

    @field_validator("answers")
    @classmethod
    def unique_questions(cls, answers: list[AnswerSubmit]) -> list[AnswerSubmit]:
        ids = [answer.question_id for answer in answers]
        if len(ids) != len(set(ids)):
            raise ValueError("같은 문항에 답변이 중복되었습니다.")
        return answers


class ResponseReceipt(BaseModel):
    response_id: str
    points_earned: int
    balance: int
    base_points: int = 0
    author_boost_points: int = 0
    deadline_bonus_points: int = 0
    quoted_reward_points: int = 0
    daily_cap_applied: bool = False
    badge: dict[str, Any] | None = None
    result_access: dict[str, Any] | None = None
    balance_result: dict[str, Any] | None = None
    result_status: str = "included"
    result_token: str | None = None


class AiQuestionRewriteRequest(BaseModel):
    prompt: str = Field(min_length=2, max_length=500)
    description: str = Field(default="", max_length=1000)
    question_type: QuestionType = "short_text"


class AiQuestionRewrite(BaseModel):
    original: str
    revised: str
    rationale: str


class TeamCreate(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    member_ids: list[str] = Field(default_factory=list, max_length=100)

    @field_validator("member_ids")
    @classmethod
    def unique_members(cls, member_ids: list[str]) -> list[str]:
        if len(member_ids) != len(set(member_ids)):
            raise ValueError("같은 팀원을 중복해서 추가할 수 없습니다.")
        return member_ids


class TeamMemberUpdate(BaseModel):
    user_id: str


class DirectExchangeCreate(BaseModel):
    source_survey_id: str
    target_survey_id: str
    answers: list[AnswerSubmit]


class ExchangeResponseSubmit(BaseModel):
    answers: list[AnswerSubmit]


class AutoMatchRequest(BaseModel):
    survey_id: str


class ExchangeCancelRequest(BaseModel):
    reason: str = Field(default="사용자 취소", min_length=2, max_length=500)


class ExternalSurveyResponseSubmit(BaseModel):
    answers: list[AnswerSubmit]
    consent_profile_use: bool = False



class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=1000)
    parent_id: str | None = None
    display_mode: Literal["anonymous", "nickname"] = "nickname"


class CommentView(BaseModel):
    id: str
    survey_id: str
    parent_id: str | None
    body: str
    display_name: str
    university_name: str | None
    created_at: str


class ReportCreate(BaseModel):
    target_type: Literal["survey", "comment", "user"]
    target_id: str
    reason: str = Field(min_length=2, max_length=500)


class AiSurveyDraftRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=500)
    audience: str = Field(default="대학생", max_length=200)
    tone: Literal["friendly", "neutral", "academic"] = "friendly"
    question_count: int = Field(default=8, ge=2, le=30)


class AiSurveyDraft(BaseModel):
    title: str
    description: str
    questions: list[QuestionCreate]


class AdRewardEvent(BaseModel):
    transaction_id: str = Field(min_length=5, max_length=200)
    user_id: str
    reward_amount: int = Field(default=10, ge=1, le=10)


class UserPreferencesUpdate(BaseModel):
    notifications_enabled: bool | None = None
    interests: list[str] | None = Field(default=None, max_length=10)
    selected_title: str | None = Field(default=None, max_length=50)

    @field_validator("interests")
    @classmethod
    def normalize_interests(cls, interests: list[str] | None) -> list[str] | None:
        if interests is None:
            return None
        cleaned = [item.strip() for item in interests if item.strip()]
        if len(cleaned) != len(set(cleaned)):
            raise ValueError("관심사는 중복될 수 없습니다.")
        if any(len(item) > 30 for item in cleaned):
            raise ValueError("관심사는 30자 이하여야 합니다.")
        return cleaned


class RewardExchangeCreate(BaseModel):
    product_id: str
    quantity: int = Field(default=1, ge=1, le=5)


class BalanceVoteCreate(BaseModel):
    choice_id: str


class BalancePostCreate(BaseModel):
    body: str = Field(min_length=1, max_length=1000)


class BalanceReplyCreate(BaseModel):
    body: str = Field(min_length=1, max_length=1000)


class MockAdComplete(BaseModel):
    transaction_id: str | None = Field(default=None, min_length=5, max_length=200)


class RewardBoostPurchase(BaseModel):
    increment_points: int = Field(ge=10, le=1_000, multiple_of=10)
    transaction_id: str = Field(min_length=5, max_length=200)

