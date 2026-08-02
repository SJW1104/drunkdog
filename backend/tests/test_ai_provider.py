from __future__ import annotations

import json
from pathlib import Path

from app.ai_provider import AIProvider
from app.config import Settings


def test_mock_rewrite_is_neutral_and_does_not_append_generic_phrase() -> None:
    provider = AIProvider(Settings(ai_mode="mock"))

    result = provider.rewrite_question(
        prompt="  귀하는   이번 수업을 어떻게 생각하십니까  ",
        description="수업 만족도를 확인하는 질문",
        question_type="short_text",
    )

    assert result["original"] == "귀하는 이번 수업을 어떻게 생각하십니까"
    assert result["revised"] == "이번 수업을 어떻게 생각하시나요?"
    assert "편하게 알려주세요" not in result["revised"]
    assert result["rationale"]


def test_openai_rewrite_uses_private_structured_response_and_preserves_original(
    monkeypatch,
) -> None:
    captured: dict = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

        def read(self) -> bytes:
            body = {
                "status": "completed",
                "output": [
                    {
                        "type": "message",
                        "content": [
                            {
                                "type": "output_text",
                                "text": json.dumps(
                                    {
                                        "original": "모델이 바꾼 잘못된 원문",
                                        "revised": "  이번 수업에 얼마나 만족하시나요?  ",
                                        "rationale": "  표현을 중립적으로 정리했습니다.  ",
                                    },
                                    ensure_ascii=False,
                                ),
                            }
                        ],
                    }
                ],
            }
            return json.dumps(body, ensure_ascii=False).encode("utf-8")

    def fake_urlopen(request, timeout):
        captured.update(json.loads(request.data.decode("utf-8")))
        captured["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    provider = AIProvider(
        Settings(
            ai_mode="openai",
            openai_api_key="test-key",
            openai_model="gpt-5.6-luna",
            data_path=Path("unused.json"),
        )
    )

    result = provider.rewrite_question(
        prompt="이번 수업 만족도는 어떤가요?",
        description="수업 만족도 측정",
        question_type="linear_scale",
    )

    assert result["original"] == "이번 수업 만족도는 어떤가요?"
    assert result["revised"] == "이번 수업에 얼마나 만족하시나요?"
    assert captured["model"] == "gpt-5.6-luna"
    assert captured["store"] is False
    assert captured["reasoning"] == {"effort": "low"}
    assert captured["text"]["verbosity"] == "low"
    assert captured["text"]["format"]["strict"] is True
    assert captured["timeout"] == 60
