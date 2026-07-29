from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def build_client(tmp_path: Path) -> TestClient:
    settings = Settings(
        environment="development",
        data_path=tmp_path / "research-test.json",
        seed_path=Path(__file__).parents[1] / "data" / "seed.json",
        token_secret="research-test-secret",
        webhook_secret="research-webhook-secret",
        ai_mode="mock",
    )
    return TestClient(create_app(settings))


def dev_headers(client: TestClient, user_id: str) -> dict[str, str]:
    response = client.post(f"/api/v1/dev/login?user_id={user_id}")
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_published_exchange_survey(
    client: TestClient,
    headers: dict[str, str],
    *,
    title: str,
    question_count: int = 1,
    methods: list[str] | None = None,
    exchange_unit: str = "individual",
    team_id: str | None = None,
    team_requested_responses: int | None = None,
) -> dict:
    questions = [
        {
            "question_type": "single_choice",
            "prompt": f"{index + 1}번 질문에 동의하나요?",
            "description": "연구 목적의 질문입니다.",
            "options": [{"label": "동의"}, {"label": "비동의"}],
        }
        for index in range(question_count)
    ]
    payload = {
        "title": title,
        "description": "교환 기능 통합 테스트 설문입니다.",
        "category": "연구·프로젝트",
        "category_tags": ["논문", "대학생활"],
        "deadline": (datetime.now(UTC) + timedelta(days=5)).isoformat(),
        "questions": questions,
        "external_access_enabled": True,
        "respondent_results_enabled": True,
        "exchange_enabled": True,
        "exchange_methods": methods or ["direct", "auto"],
        "exchange_unit": exchange_unit,
        "team_id": team_id,
        "target_exchange_responses": 20,
        "team_requested_responses": team_requested_responses,
        "auto_repeat": True,
        "required_respondent_conditions": [],
        "results_visibility": "after_participation",
    }
    created = client.post("/api/v1/surveys", headers=headers, json=payload)
    assert created.status_code == 201, created.text
    published = client.post(
        f"/api/v1/surveys/{created.json()['id']}/publish",
        headers=headers,
    )
    assert published.status_code == 200, published.text
    return published.json()


def answer_for(survey: dict) -> list[dict]:
    return [
        {
            "question_id": question["id"],
            "option_ids": [question["options"][0]["id"]],
        }
        for question in survey["questions"]
    ]


def signup_verified(
    client: TestClient, *, phone: str, email: str
) -> tuple[dict[str, str], dict]:
    issued = client.post("/api/v1/auth/phone/request", json={"phone": phone})
    verified_phone = client.post(
        "/api/v1/auth/phone/verify",
        json={"phone": phone, "code": issued.json()["dev_code"]},
    )
    headers = {
        "Authorization": f"Bearer {verified_phone.json()['access_token']}"
    }
    issued_school = client.post(
        "/api/v1/auth/university/request",
        headers=headers,
        json={"university_id": "korea-sejong", "email": email},
    )
    verified_school = client.post(
        "/api/v1/auth/university/verify",
        headers=headers,
        json={"email": email, "code": issued_school.json()["dev_code"]},
    )
    assert verified_school.status_code == 200, verified_school.text
    return headers, verified_school.json()


def test_zero_question_draft_grid_count_and_publish_guard(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    author = dev_headers(client, "demo-author")
    empty = client.post(
        "/api/v1/surveys",
        headers=author,
        json={
            "title": "질문을 추가할 예정인 초안",
            "description": "",
            "questions": [],
        },
    )
    assert empty.status_code == 201, empty.text
    assert empty.json()["question_count"] == 0
    assert empty.json()["effective_question_count"] == 0
    blocked = client.post(
        f"/api/v1/surveys/{empty.json()['id']}/publish",
        headers=author,
    )
    assert blocked.status_code == 409

    grid = client.post(
        "/api/v1/surveys",
        headers=author,
        json={
            "title": "그리드 문항 계산 설문",
            "description": "",
            "questions": [
                {
                    "question_type": "multiple_choice_grid",
                    "prompt": "항목별 만족도를 선택해 주세요.",
                    "rows": [
                        {"label": "수업"},
                        {"label": "시설"},
                        {"label": "교통"},
                        {"label": "지원"},
                        {"label": "복지"},
                        {"label": "문화"},
                    ],
                    "columns": [
                        {"label": "만족"},
                        {"label": "보통"},
                        {"label": "불만족"},
                    ],
                }
            ],
        },
    )
    assert grid.status_code == 201, grid.text
    assert grid.json()["question_count"] == 1
    assert grid.json()["effective_question_count"] == 6
    assert grid.json()["question_bucket"] == "6~10"


def test_direct_exchange_holds_then_atomically_includes_results(
    tmp_path: Path,
) -> None:
    client = build_client(tmp_path)
    author = dev_headers(client, "demo-author")
    counterpart = dev_headers(client, "demo-balance")
    source = create_published_exchange_survey(
        client, author, title="AI 학습 경험 조사"
    )
    target = create_published_exchange_survey(
        client, counterpart, title="캠퍼스 이동 경험 조사", question_count=2
    )

    recommendations = client.get(
        f"/api/v1/exchanges/recommendations?survey_id={source['id']}",
        headers=author,
    )
    assert recommendations.status_code == 200, recommendations.text
    assert target["id"] in {
        item["survey_id"] for item in recommendations.json()
    }

    requested = client.post(
        "/api/v1/exchanges/direct",
        headers=author,
        json={
            "source_survey_id": source["id"],
            "target_survey_id": target["id"],
            "answers": answer_for(target),
        },
    )
    assert requested.status_code == 201, requested.text
    exchange_id = requested.json()["id"]
    assert requested.json()["waiting_message"] == "교환 결과 대기 중"

    target_results = client.get(
        f"/api/v1/surveys/{target['id']}/results",
        headers=counterpart,
    )
    assert target_results.status_code == 200
    assert target_results.json()["response_count"] == 0
    table = client.get(
        f"/api/v1/surveys/{target['id']}/responses/table",
        headers=counterpart,
    )
    assert table.json()["pending"] is True
    assert table.json()["rows"] == []

    accepted = client.post(
        f"/api/v1/exchanges/{exchange_id}/accept",
        headers=counterpart,
    )
    assert accepted.status_code == 200, accepted.text
    completed = client.post(
        f"/api/v1/exchanges/{exchange_id}/responses",
        headers=counterpart,
        json={"answers": answer_for(source)},
    )
    assert completed.status_code == 201, completed.text
    assert completed.json()["exchange_completed"] is True
    assert completed.json()["exchange"]["state"] == "completed"

    source_results = client.get(
        f"/api/v1/surveys/{source['id']}/results", headers=author
    )
    target_results = client.get(
        f"/api/v1/surveys/{target['id']}/results", headers=counterpart
    )
    assert source_results.json()["response_count"] == 1
    assert target_results.json()["response_count"] == 1
    assert client.get(
        "/api/v1/users/me/reliability", headers=author
    ).json()["score"] == 41.7


def test_auto_match_has_no_acceptance_step_and_public_link_is_immediate(
    tmp_path: Path,
) -> None:
    client = build_client(tmp_path)
    author = dev_headers(client, "demo-author")
    counterpart = dev_headers(client, "demo-balance")
    source = create_published_exchange_survey(
        client, author, title="자동 매칭 설문 A", methods=["auto"]
    )
    target = create_published_exchange_survey(
        client, counterpart, title="자동 매칭 설문 B", methods=["auto"]
    )

    waiting = client.post(
        "/api/v1/exchanges/auto/queue",
        headers=author,
        json={"survey_id": source["id"]},
    )
    assert waiting.status_code == 200
    assert waiting.json()["status"] == "waiting"
    matched = client.post(
        "/api/v1/exchanges/auto/queue",
        headers=counterpart,
        json={"survey_id": target["id"]},
    )
    assert matched.status_code == 200, matched.text
    assert matched.json()["status"] == "matched"
    exchange_id = matched.json()["exchange"]["id"]
    assert matched.json()["exchange"]["accepted"] is True

    first = client.post(
        f"/api/v1/exchanges/{exchange_id}/responses",
        headers=counterpart,
        json={"answers": answer_for(source)},
    )
    assert first.status_code == 201, first.text
    assert first.json()["exchange_completed"] is False
    second = client.post(
        f"/api/v1/exchanges/{exchange_id}/responses",
        headers=author,
        json={"answers": answer_for(target)},
    )
    assert second.status_code == 201, second.text
    assert second.json()["exchange_completed"] is True

    public = client.get(f"/api/v1/surveys/{source['id']}/share-link", headers=author)
    assert public.status_code == 200
    external = client.post(
        f"/api/v1/public/surveys/{public.json()['slug']}/responses",
        json={"answers": answer_for(source)},
    )
    assert external.status_code == 201, external.text
    assert external.json()["result_status"] == "included"
    public_results = client.get(
        f"/api/v1/public/results/{external.json()['result_token']}"
    )
    assert public_results.status_code == 200
    assert public_results.json()["response_count"] == 2


def test_team_exchange_uses_asymmetric_counts_and_all_or_nothing(
    tmp_path: Path,
) -> None:
    client = build_client(tmp_path)
    author = dev_headers(client, "demo-author")
    counterpart = dev_headers(client, "demo-balance")
    member_a_headers, member_a = signup_verified(
        client, phone="01011110001", email="member-a@korea.ac.kr"
    )
    member_b_headers, member_b = signup_verified(
        client, phone="01011110002", email="member-b@korea.ac.kr"
    )
    member_c_headers, member_c = signup_verified(
        client, phone="01011110003", email="member-c@korea.ac.kr"
    )

    team_a = client.post(
        "/api/v1/teams",
        headers=author,
        json={
            "name": "연구팀 A",
            "member_ids": ["demo-student", member_a["id"]],
        },
    )
    team_b = client.post(
        "/api/v1/teams",
        headers=counterpart,
        json={
            "name": "연구팀 B",
            "member_ids": [member_b["id"], member_c["id"]],
        },
    )
    assert team_a.status_code == 201, team_a.text
    assert team_b.status_code == 201, team_b.text

    source = create_published_exchange_survey(
        client,
        author,
        title="A팀 연구 설문",
        methods=["direct"],
        exchange_unit="team",
        team_id=team_a.json()["id"],
        team_requested_responses=3,
    )
    target = create_published_exchange_survey(
        client,
        counterpart,
        title="B팀 연구 설문",
        methods=["direct"],
        exchange_unit="team",
        team_id=team_b.json()["id"],
        team_requested_responses=2,
    )
    exchange = client.post(
        "/api/v1/exchanges/direct",
        headers=author,
        json={
            "source_survey_id": source["id"],
            "target_survey_id": target["id"],
            "answers": answer_for(target),
        },
    )
    assert exchange.status_code == 201, exchange.text
    exchange_id = exchange.json()["id"]
    second_a = client.post(
        f"/api/v1/exchanges/{exchange_id}/responses",
        headers=member_a_headers,
        json={"answers": answer_for(target)},
    )
    assert second_a.status_code == 201, second_a.text
    assert client.post(
        f"/api/v1/exchanges/{exchange_id}/accept", headers=counterpart
    ).status_code == 200

    for headers in (counterpart, member_b_headers):
        response = client.post(
            f"/api/v1/exchanges/{exchange_id}/responses",
            headers=headers,
            json={"answers": answer_for(source)},
        )
        assert response.status_code == 201, response.text
        assert response.json()["exchange_completed"] is False

    before = client.get(
        f"/api/v1/surveys/{source['id']}/results", headers=author
    )
    assert before.json()["response_count"] == 0
    final = client.post(
        f"/api/v1/exchanges/{exchange_id}/responses",
        headers=member_c_headers,
        json={"answers": answer_for(source)},
    )
    assert final.status_code == 201, final.text
    assert final.json()["exchange_completed"] is True
    assert client.get(
        f"/api/v1/surveys/{source['id']}/results", headers=author
    ).json()["response_count"] == 3
    assert client.get(
        f"/api/v1/surveys/{target['id']}/results", headers=counterpart
    ).json()["response_count"] == 2
