from __future__ import annotations

import math
import re
from datetime import date, time
from typing import Any, Iterable, NoReturn

from fastapi import HTTPException

from .schemas import AnswerSubmit


SINGLE_CHOICE_TYPES = {"single", "single_choice", "dropdown", "balance"}
MULTIPLE_CHOICE_TYPES = {"multiple", "checkboxes"}
TEXT_TYPES = {"text", "short_text", "long_text"}
SCALE_TYPES = {"scale", "linear_scale"}
GRID_TYPES = {"multiple_choice_grid", "checkbox_grid"}


def _error(detail: str) -> NoReturn:
    raise HTTPException(status_code=422, detail=detail)


def _is_blank(answer: AnswerSubmit) -> bool:
    return not _populated_fields(answer)


def _populated_fields(answer: AnswerSubmit) -> set[str]:
    populated: set[str] = set()
    if answer.option_ids:
        populated.add("option_ids")
    if (answer.value_text or "").strip():
        populated.add("value_text")
    if answer.value_number is not None:
        populated.add("value_number")
    if (answer.value_date or "").strip():
        populated.add("value_date")
    if (answer.value_time or "").strip():
        populated.add("value_time")
    if answer.grid_answers:
        populated.add("grid_answers")
    if answer.file_uploads:
        populated.add("file_uploads")
    return populated


def _ensure_answer_shape(
    answer: AnswerSubmit,
    *,
    allowed: set[str],
    type_label: str,
) -> None:
    unexpected = _populated_fields(answer) - allowed
    if unexpected:
        _error(
            f"{type_label} 문항에는 사용할 수 없는 응답 필드가 포함되어 있습니다: "
            + ", ".join(sorted(unexpected))
        )


def validate_answers(
    survey: dict[str, Any],
    answers: Iterable[AnswerSubmit],
) -> list[dict[str, Any]]:
    answer_list = list(answers)
    questions = survey.get("questions", [])
    question_map = {question["id"]: question for question in questions}
    submitted: dict[str, AnswerSubmit] = {}
    for answer in answer_list:
        if answer.question_id in submitted:
            _error("같은 문항의 답변을 중복해서 제출할 수 없습니다.")
        submitted[answer.question_id] = answer
    if set(submitted) - set(question_map):
        _error("설문에 속하지 않은 문항이 포함되어 있습니다.")

    for question_id, question in question_map.items():
        answer = submitted.get(question_id)
        if answer is None or _is_blank(answer):
            if question.get("required", True):
                _error(f"필수 문항에 응답해야 합니다: {question['prompt']}")
            continue
        _validate_answer(question, answer)

    return [answer.model_dump() for answer in answer_list if not _is_blank(answer)]


def _validate_answer(question: dict[str, Any], answer: AnswerSubmit) -> None:
    question_type = question["question_type"]
    valid_options = {item["id"] for item in question.get("options", [])}

    if question_type in SINGLE_CHOICE_TYPES:
        _ensure_answer_shape(
            answer, allowed={"option_ids"}, type_label="단일 선택"
        )
        if len(answer.option_ids) != 1:
            _error("단일 선택 문항은 선택지를 하나만 선택해야 합니다.")
        _ensure_options(answer.option_ids, valid_options)
        return

    if question_type in MULTIPLE_CHOICE_TYPES:
        _ensure_answer_shape(
            answer, allowed={"option_ids"}, type_label="체크박스"
        )
        minimum = question.get("min_choices")
        if minimum is None and question.get("required", True):
            minimum = 1
        if minimum is not None and len(answer.option_ids) < int(minimum):
            _error(f"선택지를 최소 {minimum}개 선택해야 합니다.")
        maximum = question.get("max_choices")
        if maximum is not None and len(answer.option_ids) > int(maximum):
            _error(f"선택지는 최대 {maximum}개까지 선택할 수 있습니다.")
        _ensure_options(answer.option_ids, valid_options)
        return

    if question_type in TEXT_TYPES:
        _ensure_answer_shape(answer, allowed={"value_text"}, type_label="주관식")
        value = (answer.value_text or "").strip()
        validation = question.get("validation") or {}
        default_maximum = 500 if question_type == "short_text" else 10_000
        minimum = validation.get("min_length")
        maximum = validation.get("max_length", default_maximum)
        pattern = validation.get("pattern")
        if minimum is not None and len(value) < int(minimum):
            _error(f"최소 {minimum}자 이상 입력해야 합니다.")
        if maximum is not None and len(value) > int(maximum):
            _error(f"최대 {maximum}자까지 입력할 수 있습니다.")
        if pattern:
            try:
                matches = re.fullmatch(str(pattern), value)
            except re.error as exc:
                raise HTTPException(
                    status_code=422,
                    detail="작성자가 설정한 유효성 검사식이 올바르지 않습니다.",
                ) from exc
            if not matches:
                _error("입력값이 문항의 유효성 조건과 맞지 않습니다.")
        return

    if question_type == "number":
        _ensure_answer_shape(answer, allowed={"value_number"}, type_label="숫자")
        if answer.value_number is None or not math.isfinite(answer.value_number):
            _error("유효한 숫자를 입력해야 합니다.")
        validation = question.get("validation") or {}
        minimum = validation.get("min_value")
        maximum = validation.get("max_value")
        if minimum is not None and answer.value_number < float(minimum):
            _error(f"숫자는 {minimum} 이상이어야 합니다.")
        if maximum is not None and answer.value_number > float(maximum):
            _error(f"숫자는 {maximum} 이하여야 합니다.")
        return

    if question_type in SCALE_TYPES:
        if question_type == "scale" and answer.option_ids:
            _ensure_answer_shape(
                answer, allowed={"option_ids"}, type_label="척도형"
            )
            if len(answer.option_ids) != 1:
                _error("척도형 문항은 값을 하나만 선택해야 합니다.")
            _ensure_options(answer.option_ids, valid_options)
            return
        _ensure_answer_shape(
            answer, allowed={"value_number"}, type_label="척도형"
        )
        value = answer.value_number
        if value is None or not math.isfinite(value) or not value.is_integer():
            _error("척도 값은 정수로 입력해야 합니다.")
        minimum_value = question.get("scale_min")
        maximum_value = question.get("scale_max")
        minimum = int(minimum_value) if minimum_value is not None else 1
        maximum = int(maximum_value) if maximum_value is not None else 5
        if not minimum <= value <= maximum:
            _error(f"척도 값은 {minimum}에서 {maximum} 사이여야 합니다.")
        return

    if question_type in GRID_TYPES:
        _ensure_answer_shape(
            answer, allowed={"grid_answers"}, type_label="그리드"
        )
        valid_rows = {item["id"] for item in question.get("rows", [])}
        valid_columns = {item["id"] for item in question.get("columns", [])}
        submitted_rows = set(answer.grid_answers)
        if submitted_rows - valid_rows:
            _error("유효하지 않은 그리드 행이 포함되어 있습니다.")
        if question.get("required", True) and submitted_rows != valid_rows:
            _error("그리드의 모든 필수 행에 응답해야 합니다.")
        for column_ids in answer.grid_answers.values():
            if len(column_ids) != len(set(column_ids)):
                _error("같은 그리드 열을 중복해서 선택할 수 없습니다.")
            if question_type == "multiple_choice_grid" and len(column_ids) != 1:
                _error("객관식 그리드의 각 행에서는 하나만 선택해야 합니다.")
            if question_type == "checkbox_grid" and not column_ids:
                _error("체크박스 그리드의 각 제출 행에는 선택이 필요합니다.")
            _ensure_options(column_ids, valid_columns)
        return

    if question_type == "date":
        _ensure_answer_shape(answer, allowed={"value_date"}, type_label="날짜")
        value = (answer.value_date or "").strip()
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            _error("날짜는 YYYY-MM-DD 형식이어야 합니다.")
        try:
            date.fromisoformat(value)
        except ValueError:
            _error("존재하지 않는 날짜입니다.")
        return

    if question_type == "time":
        _ensure_answer_shape(answer, allowed={"value_time"}, type_label="시간")
        value = (answer.value_time or "").strip()
        if not re.fullmatch(r"\d{2}:\d{2}(?::\d{2})?", value):
            _error("시간은 HH:MM 또는 HH:MM:SS 형식이어야 합니다.")
        try:
            time.fromisoformat(value)
        except ValueError:
            _error("존재하지 않는 시간입니다.")
        return

    if question_type == "file_upload":
        _ensure_answer_shape(
            answer, allowed={"file_uploads"}, type_label="파일 업로드"
        )
        rule = question.get("file_rule") or {}
        maximum_files = int(rule.get("max_files") or 1)
        maximum_size = int(rule.get("max_size_mb") or 10) * 1024 * 1024
        allowed_types = {
            str(value).strip().lower()
            for value in rule.get("allowed_types", [])
        }
        if not answer.file_uploads:
            _error("업로드한 파일 정보가 없습니다.")
        if len(answer.file_uploads) > maximum_files:
            _error(f"파일은 최대 {maximum_files}개까지 업로드할 수 있습니다.")
        for uploaded in answer.file_uploads:
            name = str(
                uploaded.get("file_name") or uploaded.get("name") or ""
            ).strip()
            mime_type = str(uploaded.get("mime_type") or "").strip().lower()
            location = str(
                uploaded.get("storage_key") or uploaded.get("url") or ""
            ).strip()
            size = uploaded.get("size")
            if not name or not mime_type or not location:
                _error("파일 이름, MIME 형식, 저장 위치가 모두 필요합니다.")
            if isinstance(size, bool) or not isinstance(size, int) or size <= 0:
                _error("파일 크기는 0보다 큰 바이트 정수여야 합니다.")
            if size > maximum_size:
                _error(
                    f"파일 하나의 크기는 {rule.get('max_size_mb') or 10}MB를 "
                    "초과할 수 없습니다."
                )
            if allowed_types and mime_type not in allowed_types:
                _error("허용되지 않은 파일 형식입니다.")
        return

    _error("지원하지 않는 질문 유형입니다.")


def _ensure_options(selected: Iterable[str], valid: set[str]) -> None:
    if not set(selected).issubset(valid):
        _error("유효하지 않은 선택지가 포함되어 있습니다.")
