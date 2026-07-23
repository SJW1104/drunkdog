from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def build_client(tmp_path: Path) -> TestClient:
    settings = Settings(
        environment="development",
        database_path=tmp_path / "test.db",
        token_secret="test-token-secret",
        webhook_secret="test-webhook-secret",
        ai_mode="mock",
    )
    return TestClient(create_app(settings))


def signup_and_verify(client: TestClient, phone: str, email: str) -> tuple[str, dict]:
    otp = client.post("/api/v1/auth/phone/request", json={"phone": phone})
    assert otp.status_code == 200
    auth = client.post(
        "/api/v1/auth/phone/verify",
        json={"phone": phone, "code": otp.json()["dev_code"]},
    )
    assert auth.status_code == 200
    token = auth.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    school_otp = client.post(
        "/api/v1/auth/university/request",
        headers=headers,
        json={"university_id": "korea-sejong", "email": email},
    )
    assert school_otp.status_code == 200
    verified = client.post(
        "/api/v1/auth/university/verify",
        headers=headers,
        json={"email": email, "code": school_otp.json()["dev_code"]},
    )
    assert verified.status_code == 200
    assert verified.json()["university_verified"] is True
    return token, verified.json()


def test_full_survey_flow(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    author_token, _ = signup_and_verify(client, "010-1111-2222", "author@korea.ac.kr")
    participant_token, _ = signup_and_verify(client, "010-3333-4444", "student@korea.ac.kr")
    author_headers = {"Authorization": f"Bearer {author_token}"}
    participant_headers = {"Authorization": f"Bearer {participant_token}"}

    created = client.post(
        "/api/v1/surveys",
        headers=author_headers,
        json={
            "title": "캠퍼스 셔틀 수요 조사",
            "description": "셔틀 도입에 대한 의견을 확인합니다.",
            "category": "대학생활",
            "target_responses": 100,
            "results_visibility": "after_participation",
            "questions": [
                {
                    "question_type": "single",
                    "prompt": "셔틀이 생기면 이용하시겠어요?",
                    "options": [{"label": "네"}, {"label": "아니요"}],
                },
                {
                    "question_type": "text",
                    "prompt": "희망 노선을 알려주세요.",
                    "required": False,
                    "options": [],
                },
            ],
        },
    )
    assert created.status_code == 201, created.text
    survey = created.json()
    survey_id = survey["id"]
    question_id = survey["questions"][0]["id"]
    option_id = survey["questions"][0]["options"][0]["id"]
    text_question_id = survey["questions"][1]["id"]

    published = client.post(
        f"/api/v1/surveys/{survey_id}/publish", headers=author_headers
    )
    assert published.status_code == 200

    response = client.post(
        f"/api/v1/surveys/{survey_id}/responses",
        headers=participant_headers,
        json={
            "answers": [
                {"question_id": question_id, "option_ids": [option_id]},
                {"question_id": text_question_id, "value_text": "정문-기숙사"},
            ]
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["points_earned"] == 2

    duplicate = client.post(
        f"/api/v1/surveys/{survey_id}/responses",
        headers=participant_headers,
        json={"answers": [{"question_id": question_id, "option_ids": [option_id]}]},
    )
    assert duplicate.status_code == 409

    results = client.get(
        f"/api/v1/surveys/{survey_id}/results", headers=participant_headers
    )
    assert results.status_code == 200
    assert results.json()["response_count"] == 1
    assert results.json()["questions"][0]["options"][0]["percentage"] == 100.0

    wallet = client.get("/api/v1/wallet", headers=participant_headers)
    assert wallet.status_code == 200
    assert wallet.json()["balance"] == 2502

    analysis = client.post(
        f"/api/v1/ai/surveys/{survey_id}/analysis", headers=author_headers
    )
    assert analysis.status_code == 200
    assert analysis.json()["points_charged"] == 200


def test_ai_draft_and_ad_reward_idempotency(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    token, user = signup_and_verify(client, "010-5555-6666", "ai-user@korea.ac.kr")
    headers = {"Authorization": f"Bearer {token}"}

    draft = client.post(
        "/api/v1/ai/survey-drafts",
        headers=headers,
        json={"topic": "도서관 운영 시간", "question_count": 4},
    )
    assert draft.status_code == 200
    assert len(draft.json()["questions"]) == 4

    event = {
        "transaction_id": "admob-transaction-001",
        "user_id": user["id"],
        "reward_amount": 10,
    }
    webhook_headers = {"X-Webhook-Secret": "test-webhook-secret"}
    first = client.post(
        "/api/v1/integrations/admob/rewarded", headers=webhook_headers, json=event
    )
    second = client.post(
        "/api/v1/integrations/admob/rewarded", headers=webhook_headers, json=event
    )
    assert first.status_code == 200
    assert first.json()["duplicate"] is False
    assert second.status_code == 200
    assert second.json()["duplicate"] is True
    assert second.json()["balance"] == 2510

