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
        "original": {"type": "string"},
        "revised": {"type": "string"},
        "rationale": {"type": "string"},
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
        if self.settings.ai_mode != "openai":
            revised = self._mock_question_rewrite(prompt)
            return {
                "original": prompt,
                "revised": revised,
                "rationale": (
                    "질문의 의미는 유지하면서 어려운 표현과 불필요한 수식어를 "
                    "줄이고, 응답자가 한 번에 이해할 수 있는 문장으로 다듬었습니다."
                ),
            }
        return self._request_json(
            developer=(
                "당신은 대학 연구 설문 문항 교정자다. 질문의 연구 의도와 측정 "
                "대상을 바꾸지 말고, 유도 질문·이중 질문·모호한 표현을 줄여라. "
                "원문과 수정 이유를 반드시 함께 반환하라."
            ),
            user=(
                f"질문 유형: {question_type}\n"
                f"질문 설명: {description or '(없음)'}\n"
                f"원문: {prompt}"
            ),
            schema_name="question_rewrite",
            schema=QUESTION_REWRITE_SCHEMA,
        )

    def _request_json(
        self,
        *,
        developer: str,
        user: str,
        schema_name: str,
        schema: dict[str, Any],
    ) -> dict[str, Any]:
        if not self.settings.openai_api_key:
            raise AIProviderError("OPENAI_API_KEY가 설정되지 않았습니다.")

        payload = {
            "model": self.settings.openai_model,
            "input": [
                {"role": "developer", "content": developer},
                {"role": "user", "content": user},
            ],
            "text": {
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
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise AIProviderError(f"AI 공급자 호출 실패: {exc}") from exc

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
    def _mock_question_rewrite(prompt: str) -> str:
        revised = prompt.strip()
        replacements = {
            "귀하께서는": "본인은",
            "어떠하다고 생각하십니까": "어떻게 생각하나요",
            "응답하여 주시기 바랍니다": "응답해 주세요",
            "이용한 경험이 있으십니까": "이용해 본 적이 있나요",
            "해당되는 바를": "해당하는 항목을",
        }
        for source, target in replacements.items():
            revised = revised.replace(source, target)
        if not revised.endswith(("?", "요.", "다.")):
            revised = f"{revised}?"
        return revised

