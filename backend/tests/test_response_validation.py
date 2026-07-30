from __future__ import annotations

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.response_validation import validate_answers
from app.schemas import AnswerSubmit, QuestionCreate


def option(option_id: str) -> dict[str, str]:
    return {"id": option_id, "label": option_id}


def test_all_research_question_types_accept_valid_answers() -> None:
    survey = {
        "questions": [
            {
                "id": "short",
                "question_type": "short_text",
                "prompt": "짧은 의견",
                "required": True,
                "validation": {"min_length": 2, "max_length": 10},
            },
            {
                "id": "long",
                "question_type": "long_text",
                "prompt": "긴 의견",
                "required": True,
            },
            {
                "id": "single",
                "question_type": "single_choice",
                "prompt": "하나 선택",
                "required": True,
                "options": [option("a"), option("b")],
            },
            {
                "id": "checks",
                "question_type": "checkboxes",
                "prompt": "복수 선택",
                "required": True,
                "min_choices": 1,
                "max_choices": 2,
                "options": [option("a"), option("b"), option("c")],
            },
            {
                "id": "dropdown",
                "question_type": "dropdown",
                "prompt": "목록 선택",
                "required": True,
                "options": [option("a"), option("b")],
            },
            {
                "id": "scale",
                "question_type": "linear_scale",
                "prompt": "만족도",
                "required": True,
                "scale_min": 0,
                "scale_max": 10,
            },
            {
                "id": "radio-grid",
                "question_type": "multiple_choice_grid",
                "prompt": "행별 하나",
                "required": True,
                "rows": [option("r1"), option("r2")],
                "columns": [option("c1"), option("c2")],
            },
            {
                "id": "check-grid",
                "question_type": "checkbox_grid",
                "prompt": "행별 복수",
                "required": True,
                "rows": [option("r1")],
                "columns": [option("c1"), option("c2")],
            },
            {
                "id": "date",
                "question_type": "date",
                "prompt": "날짜",
                "required": True,
            },
            {
                "id": "time",
                "question_type": "time",
                "prompt": "시간",
                "required": True,
            },
            {
                "id": "file",
                "question_type": "file_upload",
                "prompt": "파일",
                "required": True,
                "file_rule": {
                    "allowed_types": ["application/pdf"],
                    "max_files": 1,
                    "max_size_mb": 2,
                },
            },
        ]
    }
    answers = [
        AnswerSubmit(question_id="short", value_text="좋아요"),
        AnswerSubmit(question_id="long", value_text="충분히 긴 자유 응답입니다."),
        AnswerSubmit(question_id="single", option_ids=["a"]),
        AnswerSubmit(question_id="checks", option_ids=["a", "b"]),
        AnswerSubmit(question_id="dropdown", option_ids=["b"]),
        AnswerSubmit(question_id="scale", value_number=0),
        AnswerSubmit(
            question_id="radio-grid",
            grid_answers={"r1": ["c1"], "r2": ["c2"]},
        ),
        AnswerSubmit(
            question_id="check-grid",
            grid_answers={"r1": ["c1", "c2"]},
        ),
        AnswerSubmit(question_id="date", value_date="2026-07-30"),
        AnswerSubmit(question_id="time", value_time="09:30"),
        AnswerSubmit(
            question_id="file",
            file_uploads=[
                {
                    "file_name": "consent.pdf",
                    "mime_type": "application/pdf",
                    "size": 1024,
                    "storage_key": "uploads/consent.pdf",
                }
            ],
        ),
    ]

    validated = validate_answers(survey, answers)

    assert len(validated) == 11
    assert next(
        item for item in validated if item["question_id"] == "scale"
    )["value_number"] == 0


@pytest.mark.parametrize(
    ("question", "answer", "expected"),
    [
        (
            {
                "id": "date",
                "question_type": "date",
                "prompt": "날짜",
                "required": True,
            },
            AnswerSubmit(question_id="date", value_date="2026-02-30"),
            "존재하지 않는 날짜",
        ),
        (
            {
                "id": "time",
                "question_type": "time",
                "prompt": "시간",
                "required": True,
            },
            AnswerSubmit(question_id="time", value_time="25:10"),
            "존재하지 않는 시간",
        ),
        (
            {
                "id": "scale",
                "question_type": "linear_scale",
                "prompt": "척도",
                "required": True,
                "scale_min": 1,
                "scale_max": 5,
            },
            AnswerSubmit(question_id="scale", value_number=2.5),
            "정수",
        ),
        (
            {
                "id": "single",
                "question_type": "single_choice",
                "prompt": "하나",
                "required": True,
                "options": [option("a"), option("b")],
            },
            AnswerSubmit(
                question_id="single",
                option_ids=["a"],
                value_text="혼합 입력",
            ),
            "사용할 수 없는 응답 필드",
        ),
        (
            {
                "id": "grid",
                "question_type": "multiple_choice_grid",
                "prompt": "그리드",
                "required": True,
                "rows": [option("r1"), option("r2")],
                "columns": [option("c1"), option("c2")],
            },
            AnswerSubmit(
                question_id="grid",
                grid_answers={"r1": ["c1"]},
            ),
            "모든 필수 행",
        ),
        (
            {
                "id": "file",
                "question_type": "file_upload",
                "prompt": "파일",
                "required": True,
                "file_rule": {
                    "allowed_types": ["application/pdf"],
                    "max_files": 1,
                    "max_size_mb": 1,
                },
            },
            AnswerSubmit(
                question_id="file",
                file_uploads=[
                    {
                        "file_name": "bad.exe",
                        "mime_type": "application/x-msdownload",
                        "size": 100,
                        "storage_key": "uploads/bad.exe",
                    }
                ],
            ),
            "허용되지 않은 파일 형식",
        ),
    ],
)
def test_invalid_research_answers_are_rejected(
    question: dict, answer: AnswerSubmit, expected: str
) -> None:
    with pytest.raises(HTTPException) as exc_info:
        validate_answers({"questions": [question]}, [answer])

    assert exc_info.value.status_code == 422
    assert expected in str(exc_info.value.detail)


@pytest.mark.parametrize(
    "payload",
    [
        {
            "question_type": "single_choice",
            "prompt": "중복 선택지",
            "options": [{"label": "같음"}, {"label": "같음"}],
        },
        {
            "question_type": "checkboxes",
            "prompt": "잘못된 선택 개수",
            "options": [{"label": "A"}, {"label": "B"}],
            "min_choices": 3,
        },
        {
            "question_type": "short_text",
            "prompt": "잘못된 정규식",
            "validation": {"pattern": "["},
        },
        {
            "question_type": "multiple_choice_grid",
            "prompt": "중복 행",
            "rows": [{"label": "행"}, {"label": "행"}],
            "columns": [{"label": "A"}, {"label": "B"}],
        },
        {
            "question_type": "file_upload",
            "prompt": "중복 MIME",
            "file_rule": {
                "allowed_types": ["application/pdf", "application/pdf"]
            },
        },
    ],
)
def test_invalid_question_configuration_is_rejected(payload: dict) -> None:
    with pytest.raises(ValidationError):
        QuestionCreate.model_validate(payload)
