from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

from .config import Settings


class AIProviderError(RuntimeError):
    pass


SURVEY_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "title": {"type": "string"},
        "description": {"type": "string"},
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "question_type": {
                        "type": "string",
                        "enum": ["single", "multiple", "text", "number", "scale"],
                    },
                    "prompt": {"type": "string"},
                    "required": {"type": "boolean"},
                    "min_choices": {"type": ["integer", "null"]},
                    "max_choices": {"type": ["integer", "null"]},
                    "options": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {"label": {"type": "string"}},
                            "required": ["label"],
                        },
                    },
                },
                "required": [
                    "question_type",
                    "prompt",
                    "required",
                    "min_choices",
                    "max_choices",
                    "options",
                ],
            },
        },
    },
    "required": ["title", "description", "questions"],
}


ANALYSIS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "summary": {"type": "string"},
        "findings": {"type": "array", "items": {"type": "string"}},
        "cautions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary", "findings", "cautions"],
}

QUESTION_REWRITE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "original": {"type": "string", "minLength": 1, "maxLength": 500},
        "revised": {"type": "string", "minLength": 1, "maxLength": 500},
        "rationale": {"type": "string", "minLength": 1, "maxLength": 500},
    },
    "required": ["original", "revised", "rationale"],
}


@dataclass(slots=True)
class AIProvider:
    settings: Settings

    @property
    def provider_name(self) -> str:
        return "openai" if self.settings.ai_mode == "openai" else "mock"

    def generate_survey_draft(
        self, *, topic: str, audience: str, tone: str, question_count: int
    ) -> dict[str, Any]:
        if self.settings.ai_mode != "openai":
            return self._mock_draft(topic, audience, question_count)

        prompt = (
            f"주제: {topic}\n대상: {audience}\n말투: {tone}\n"
            f"문항 수: 정확히 {question_count}개\n"
            "대학생이 읽기 쉬운 설문을 작성하라. 유도 질문과 중복 질문을 피하고, "
            "선택형 문항의 options는 2개 이상 제공하라."
        )
        return self._request_json(
            developer=(
                "당신은 대학생 대상 설문 설계 전문가다. 결과는 제공된 JSON 스키마를 "
                "정확히 따라야 한다."
            ),
            user=prompt,
            schema_name="survey_draft",
            schema=SURVEY_SCHEMA,
        )

    def analyze_results(self, *, title: str, results: dict[str, Any]) -> dict[str, Any]:
        if self.settings.ai_mode != "openai":
            count = results.get("response_count", 0)
            return {
                "summary": f"'{title}' 설문에 총 {count}명이 참여했습니다.",
                "findings": [
                    "응답 분포가 큰 선택지를 중심으로 후속 질문을 설계해 보세요.",
                    "표본 특성을 함께 제시하면 결과 해석의 신뢰도가 높아집니다.",
                ],
                "cautions": ["이 결과는 참여한 사용자 표본에 한정됩니다."],
            }

        return self._request_json(
            developer=(
                "당신은 설문 통계 해설자다. 제공된 집계값만 사용하고 인과관계를 "
                "과장하지 말라. 개인정보를 추론하지 말라."
            ),
            user=f"설문 제목: {title}\n집계 결과:\n{json.dumps(results, ensure_ascii=False)}",
            schema_name="survey_analysis",
            schema=ANALYSIS_SCHEMA,
        )

    def rewrite_question(
        self,
        *,
        prompt: str,
        description: str,
        question_type: str,
    ) -> dict[str, str]:
        original = " ".join(prompt.strip().split())
        if not original:
            raise AIProviderError("다듬을 질문이 비어 있습니다.")
        if self.settings.ai_mode != "openai":
            revised = self._mock_question_rewrite(original, question_type)
            return {
                "original": original,
                "revised": revised,
                "rationale": (
                    "연구 의도와 응답 범위는 유지하면서 문장을 간결하게 정리하고 "
                    "응답자가 한 번에 이해할 수 있는 중립적인 표현으로 다듬었습니다."
                ),
            }
        result = self._request_json(
            developer=(
                "당신은 대학 연구용 설문 문항을 교정하는 전문가다. "
                "연구 의도, 측정 개념, 응답 대상과 기간을 새로 만들거나 바꾸지 않는다. "
                "한 문항에는 한 가지 개념만 남기고, 유도·가정·가치판단·이중부정·전문용어·"
                "모호한 빈도 표현을 줄인다. 응답자가 쉽게 이해할 수 있는 중립적인 존댓말을 "
                "사용하되 친근한 문구를 기계적으로 덧붙이지 않는다. 이미 적절한 문항은 억지로 "
                "바꾸지 않는다. 선택지나 척도는 제공되지 않았으므로 새로 만들지 않는다. "
                "original에는 입력 질문을 그대로, revised에는 최종 문항 하나만, rationale에는 "
                "핵심 수정 이유를 한국어 한두 문장으로 반환한다."
            ),
            user=(
                f"질문 유형: {question_type}\n"
                f"연구자가 작성한 설명: {description.strip() or '(없음)'}\n"
                f"입력 질문: {original}"
            ),
            schema_name="question_rewrite",
            schema=QUESTION_REWRITE_SCHEMA,
            reasoning_effort="low",
            verbosity="low",
        )
        result["original"] = original
        revised = " ".join(str(result.get("revised", "")).strip().split())
        rationale = " ".join(str(result.get("rationale", "")).strip().split())
        if not revised or len(revised) > 500:
            raise AIProviderError("AI 수정 문장이 비어 있거나 너무 깁니다.")
        if not rationale or len(rationale) > 500:
            raise AIProviderError("AI 수정 이유가 비어 있거나 너무 깁니다.")
        result["revised"] = revised
        result["rationale"] = rationale
        return result

    def _request_json(
        self,
        *,
        developer: str,
        user: str,
        schema_name: str,
        schema: dict[str, Any],
        reasoning_effort: str = "low",
        verbosity: str = "medium",
    ) -> dict[str, Any]:
        if not self.settings.openai_api_key:
            raise AIProviderError("OPENAI_API_KEY가 설정되지 않았습니다.")

        payload = {
            "model": self.settings.openai_model,
            "store": False,
            "reasoning": {"effort": reasoning_effort},
            "input": [
                {"role": "developer", "content": developer},
                {"role": "user", "content": user},
            ],
            "text": {
                "verbosity": verbosity,
                "format": {
                    "type": "json_schema",
                    "name": schema_name,
                    "strict": True,
                    "schema": schema,
                }
            },
        }
        request = urllib.request.Request(
            "https://api.openai.com/v1/responses",
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": f"Bearer {self.settings.openai_api_key}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                body = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            try:
                error_body = json.loads(exc.read().decode("utf-8"))
                message = error_body.get("error", {}).get("message")
            except (UnicodeDecodeError, json.JSONDecodeError):
                message = None
            raise AIProviderError(
                f"AI 공급자 요청 실패({exc.code}): {message or exc.reason}"
            ) from exc
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise AIProviderError(f"AI 공급자 호출 실패: {exc}") from exc

        if body.get("status") == "incomplete":
            reason = body.get("incomplete_details", {}).get("reason", "unknown")
            raise AIProviderError(f"AI 응답이 완료되지 않았습니다: {reason}")

        for output in body.get("output", []):
            if output.get("type") != "message":
                continue
            for content in output.get("content", []):
                if content.get("type") == "output_text":
                    try:
                        return json.loads(content["text"])
                    except (KeyError, json.JSONDecodeError) as exc:
                        raise AIProviderError("AI 응답 JSON을 해석하지 못했습니다.") from exc
        raise AIProviderError("AI 응답에 결과 텍스트가 없습니다.")

    @staticmethod
    def _mock_draft(topic: str, audience: str, question_count: int) -> dict[str, Any]:
        questions: list[dict[str, Any]] = [
            {
                "question_type": "single",
                "prompt": f"{topic}에 대해 얼마나 관심이 있나요?",
                "required": True,
                "min_choices": None,
                "max_choices": None,
                "options": [
                    {"label": "매우 관심 있다"},
                    {"label": "조금 관심 있다"},
                    {"label": "별로 관심 없다"},
                ],
            },
            {
                "question_type": "text",
                "prompt": f"{topic}와 관련해 가장 기대하는 점을 자유롭게 적어주세요.",
                "required": False,
                "min_choices": None,
                "max_choices": None,
                "options": [],
            },
        ]
        while len(questions) < question_count:
            number = len(questions) + 1
            questions.append(
                {
                    "question_type": "single",
                    "prompt": f"{topic} 관련 항목 {number}에 얼마나 동의하나요?",
                    "required": True,
                    "min_choices": None,
                    "max_choices": None,
                    "options": [
                        {"label": "동의한다"},
                        {"label": "보통이다"},
                        {"label": "동의하지 않는다"},
                    ],
                }
            )
        return {
            "title": f"{topic}, {audience}의 생각은?",
            "description": f"{audience}을 대상으로 {topic}에 대한 의견을 알아보는 설문입니다.",
            "questions": questions[:question_count],
        }

    @staticmethod
    def _mock_question_rewrite(prompt: str, question_type: str) -> str:
        revised = prompt.strip()
        replacements = {
            "귀하께서는": "",
            "귀하는": "",
            "어떠하다고 생각하십니까": "어떻게 생각하나요",
            "어떻게 생각하십니까": "어떻게 생각하시나요",
            "응답하여 주시기 바랍니다": "응답해 주세요",
            "응답해주시기 바랍니다": "응답해 주세요",
            "이용한 경험이 있으십니까": "이용해 본 적이 있나요",
            "해당되는 바를": "해당하는 항목을",
        }
        for source, target in replacements.items():
            revised = revised.replace(source, target)
        revised = " ".join(revised.split())
        if question_type in {"short_text", "long_text", "text"}:
            revised = revised.replace("자유롭게 편하게", "자유롭게")
        if not revised.endswith(("?", "요.", "다.")):
            revised = f"{revised}?"
        return revised

