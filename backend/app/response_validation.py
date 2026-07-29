from __future__ import annotations

import re
from typing import Any, Iterable

from fastapi import HTTPException

from .schemas import AnswerSubmit


SINGLE_CHOICE_TYPES = {"single", "single_choice", "dropdown", "balance"}
MULTIPLE_CHOICE_TYPES = {"multiple", "checkboxes"}
TEXT_TYPES = {"text", "short_text", "long_text"}
SCALE_TYPES = {"scale", "linear_scale"}
GRID_TYPES = {"multiple_choice_grid", "checkbox_grid"}


def _is_blank(answer: AnswerSubmit) -> bool:
    return not (
        answer.option_ids
        or (answer.value_text or "").strip()
        or answer.value_number is not None
        or (answer.value_date or "").strip()
        or (answer.value_time or "").strip()
        or answer.grid_answers
        or answer.file_uploads
    )


def validate_answers(
    survey: dict[str, Any],
    answers: Iterable[AnswerSubmit],
) -> list[dict[str, Any]]:
    answer_list = list(answers)
    questions = survey.get("questions", [])
    question_map = {question["id"]: question for question in questions}
    submitted = {answer.question_id: answer for answer in answer_list}
    if set(submitted) - set(question_map):
        raise HTTPException(
            status_code=422,
            detail="설문에 속하지 않은 문항이 포함되어 있습니다.",
        )

    for question_id, question in question_map.items():
        answer = submitted.get(question_id)
        if answer is None or _is_blank(answer):
            if question.get("required", True):
                raise HTTPException(
                    status_code=422,
                    detail=f"필수 문항 응답이 없습니다: {question['prompt']}",
                )
            continue
        _validate_answer(question, answer)

    return [answer.model_dump() for answer in answer_list if not _is_blank(answer)]


def _validate_answer(question: dict[str, Any], answer: AnswerSubmit) -> None:
    question_type = question["question_type"]
    valid_options = {item["id"] for item in question.get("options", [])}

    if question_type in SINGLE_CHOICE_TYPES:
        if len(answer.option_ids) != 1:
            raise HTTPException(
                status_code=422, detail="단일 선택 문항은 하나만 선택해야 합니다."
            )
        _ensure_options(answer.option_ids, valid_options)
        return

    if question_type in MULTIPLE_CHOICE_TYPES:
        minimum = question.get("min_choices")
        if minimum is None and question.get("required", True):
            minimum = 1
        if minimum and len(answer.option_ids) < int(minimum):
            raise HTTPException(
                status_code=422, detail="최소 선택 개수를 충족하지 못했습니다."
            )
        maximum = question.get("max_choices")
        if maximum and len(answer.option_ids) > int(maximum):
            raise HTTPException(
                status_code=422, detail="최대 선택 개수를 초과했습니다."
            )
        _ensure_options(answer.option_ids, valid_options)
        return

    if question_type in TEXT_TYPES:
        value = (answer.value_text or "").strip()
        validation = question.get("validation") or {}
        minimum = validation.get("min_length")
        maximum = validation.get("max_length")
        pattern = validation.get("pattern")
        if minimum is not None and len(value) < int(minimum):
            raise HTTPException(
                status_code=422, detail=f"최소 {minimum}자 이상 입력해야 합니다."
            )
        if maximum is not None and len(value) > int(maximum):
            raise HTTPException(
                status_code=422, detail=f"최대 {maximum}자까지 입력할 수 있습니다."
            )
        if pattern:
            try:
                matches = re.fullmatch(str(pattern), value)
            except re.error as exc:
                raise HTTPException(
                    status_code=422, detail="작성자가 설정한 검증식이 올바르지 않습니다."
                ) from exc
            if not matches:
                raise HTTPException(
                    status_code=422, detail="입력 형식이 유효성 조건과 맞지 않습니다."
                )
        return

    if question_type == "number":
        if answer.value_number is None:
            raise HTTPException(status_code=422, detail="숫자를 입력해야 합니다.")
        validation = question.get("validation") or {}
        minimum = validation.get("min_value")
        maximum = validation.get("max_value")
        if minimum is not None and answer.value_number < float(minimum):
            raise HTTPException(status_code=422, detail="숫자가 최솟값보다 작습니다.")
        if maximum is not None and answer.value_number > float(maximum):
            raise HTTPException(status_code=422, detail="숫자가 최댓값보다 큽니다.")
        return

    if question_type in SCALE_TYPES:
        if answer.value_number is not None:
            minimum = int(question.get("scale_min") or 1)
            maximum = int(question.get("scale_max") or 5)
            if not minimum <= answer.value_number <= maximum:
                raise HTTPException(
                    status_code=422, detail="척도 범위를 벗어난 응답입니다."
                )
        elif answer.option_ids:
            _ensure_options(answer.option_ids, valid_options)
        else:
            raise HTTPException(status_code=422, detail="척도 값을 선택해야 합니다.")
        return

    if question_type in GRID_TYPES:
        valid_rows = {item["id"] for item in question.get("rows", [])}
        valid_columns = {item["id"] for item in question.get("columns", [])}
        if set(answer.grid_answers) - valid_rows:
            raise HTTPException(status_code=422, detail="유효하지 않은 그리드 행입니다.")
        if question.get("required", True) and set(answer.grid_answers) != valid_rows:
            raise HTTPException(
                status_code=422, detail="그리드의 모든 필수 행에 응답해야 합니다."
            )
        for column_ids in answer.grid_answers.values():
            if question_type == "multiple_choice_grid" and len(column_ids) != 1:
                raise HTTPException(
                    status_code=422,
                    detail="객관식 그리드의 각 행에서는 하나만 선택해야 합니다.",
                )
            if question_type == "checkbox_grid" and not column_ids:
                raise HTTPException(
                    status_code=422,
                    detail="체크박스 그리드의 각 행에서 하나 이상 선택해야 합니다.",
                )
            _ensure_options(column_ids, valid_columns)
        return

    if question_type == "date":
        if not (answer.value_date or "").strip():
            raise HTTPException(status_code=422, detail="날짜를 입력해야 합니다.")
        return

    if question_type == "time":
        if not (answer.value_time or "").strip():
            raise HTTPException(status_code=422, detail="시간을 입력해야 합니다.")
        return

    if question_type == "file_upload":
        rule = question.get("file_rule") or {}
        maximum_files = int(rule.get("max_files") or 1)
        maximum_size = int(rule.get("max_size_mb") or 10) * 1024 * 1024
        allowed_types = set(rule.get("allowed_types") or [])
        if len(answer.file_uploads) > maximum_files:
            raise HTTPException(status_code=422, detail="파일 개수 제한을 초과했습니다.")
        for file in answer.file_uploads:
            if int(file.get("size", 0)) > maximum_size:
                raise HTTPException(status_code=422, detail="파일 크기 제한을 초과했습니다.")
            if allowed_types and file.get("mime_type") not in allowed_types:
                raise HTTPException(
                    status_code=422, detail="허용되지 않은 파일 형식입니다."
                )
        return

    raise HTTPException(status_code=422, detail="지원하지 않는 질문 유형입니다.")


def _ensure_options(selected: Iterable[str], valid: set[str]) -> None:
    if not set(selected).issubset(valid):
        raise HTTPException(
            status_code=422, detail="유효하지 않은 선택지가 포함되어 있습니다."
        )
