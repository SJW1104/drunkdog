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


QuestionType = Literal["single", "multiple", "text", "number", "scale", "balance"]


class OptionCreate(BaseModel):
    label: str = Field(min_length=1, max_length=200)


class QuestionCreate(BaseModel):
    question_type: QuestionType
    prompt: str = Field(min_length=1, max_length=500)
    required: bool = True
    min_choices: int | None = Field(default=None, ge=1)
    max_choices: int | None = Field(default=None, ge=1)
    options: list[OptionCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_options(self) -> "QuestionCreate":
        option_types = {"single", "multiple", "scale", "balance"}
        if self.question_type in option_types and len(self.options) < 2:
            raise ValueError("선택형 문항에는 선택지가 2개 이상 필요합니다.")
        if self.question_type == "balance" and len(self.options) != 2:
            raise ValueError("밸런스게임 문항에는 선택지가 정확히 2개 필요합니다.")
        if self.max_choices and self.min_choices and self.max_choices < self.min_choices:
            raise ValueError("max_choices는 min_choices보다 작을 수 없습니다.")
        return self


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
    reward_points: int | None = Field(default=None, ge=1, le=100)
    target_responses: int | None = Field(default=None, ge=1, le=1_000_000)
    deadline: datetime | None = None
    questions: list[QuestionCreate] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def validate_paid_results(self) -> "SurveyCreate":
        if self.results_visibility == "paid" and self.result_price_points <= 0:
            raise ValueError("유료 결과에는 열람 포인트를 설정해야 합니다.")
        if self.survey_type == "balance":
            if len(self.questions) != 1 or self.questions[0].question_type != "balance":
                raise ValueError(
                    "밸런스게임은 선택지 2개의 balance 문항 하나로 구성해야 합니다."
                )
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
    reward_points: int | None = Field(default=None, ge=1, le=100)
    target_responses: int | None = Field(default=None, ge=1, le=1_000_000)
    deadline: datetime | None = None
    questions: list[QuestionCreate] | None = Field(
        default=None, min_length=1, max_length=100
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
    reward_multiplier: float = 1.0
    claimable_reward_points: int | None = None
    viewer_is_author: bool = False
    viewer_can_respond: bool = False
    viewer_can_view_results: bool = False


class OptionView(BaseModel):
    id: str
    label: str
    position: int


class QuestionView(BaseModel):
    id: str
    position: int
    question_type: str
    prompt: str
    required: bool
    min_choices: int | None
    max_choices: int | None
    options: list[OptionView]


class SurveyDetail(SurveySummary):
    result_price_points: int
    questions: list[QuestionView]


class AnswerSubmit(BaseModel):
    question_id: str
    option_ids: list[str] = Field(default_factory=list)
    value_text: str | None = Field(default=None, max_length=5000)
    value_number: float | None = None

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
    deadline_bonus_points: int = 0
    daily_cap_applied: bool = False
    badge: dict[str, Any] | None = None
    result_access: dict[str, Any] | None = None
    balance_result: dict[str, Any] | None = None


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

