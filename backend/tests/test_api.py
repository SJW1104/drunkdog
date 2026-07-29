from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.domain import participation_reward
from app.main import create_app


def build_client(tmp_path: Path) -> TestClient:
    settings = Settings(
        environment="development",
        data_path=tmp_path / "test.json",
        seed_path=Path(__file__).parents[1] / "data" / "seed.json",
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


def dev_headers(client: TestClient, user_id: str) -> dict[str, str]:
    login = client.post(f"/api/v1/dev/login?user_id={user_id}")
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_full_survey_flow(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    author_token, _ = signup_and_verify(
        client, "010-1111-2222", "flow-author@korea.ac.kr"
    )
    participant_token, _ = signup_and_verify(
        client, "010-3333-4444", "flow-student@korea.ac.kr"
    )
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
    assert response.json()["points_earned"] == 5
    assert response.json()["base_points"] == 5
    assert response.json()["author_boost_points"] == 0

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
    assert wallet.json()["balance"] == 2505

    analysis = client.post(
        f"/api/v1/ai/surveys/{survey_id}/analysis", headers=author_headers
    )
    assert analysis.status_code == 200
    assert analysis.json()["points_charged"] == 200

    cached_analysis = client.post(
        f"/api/v1/ai/surveys/{survey_id}/analysis", headers=author_headers
    )
    assert cached_analysis.status_code == 200
    assert cached_analysis.json()["points_charged"] == 0
    assert cached_analysis.json()["cached"] is True


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


def test_seed_data_dev_login_draft_update_and_reset(tmp_path: Path) -> None:
    client = build_client(tmp_path)

    health = client.get("/api/v1/health")
    assert health.status_code == 200
    assert health.json()["storage"] == "json"

    feed = client.get("/api/v1/surveys")
    assert feed.status_code == 200
    assert len(feed.json()) == 4

    login = client.post("/api/v1/dev/login?user_id=demo-author")
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    mine = client.get("/api/v1/users/me/surveys", headers=headers)
    assert mine.status_code == 200
    assert any(item["status"] == "draft" for item in mine.json())

    updated = client.patch(
        "/api/v1/surveys/survey-draft-library",
        headers=headers,
        json={"title": "수정된 도서관 운영 수요 조사"},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "수정된 도서관 운영 수요 조사"

    ranking = client.get("/api/v1/rankings", headers=headers)
    assert ranking.status_code == 200
    assert ranking.json()["me"]["user_id"] == "demo-author"

    reset = client.post("/api/v1/dev/reset")
    assert reset.status_code == 200
    restored = client.get(
        "/api/v1/surveys/survey-draft-library", headers=headers
    )
    assert restored.status_code == 200
    assert restored.json()["title"] == "도서관 24시간 운영 수요 조사"


def test_frontend_survey_card_contract_and_viewer_state(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = dev_headers(client, "demo-student")

    feed = client.get("/api/v1/surveys", headers=headers)
    assert feed.status_code == 200
    items = {item["id"]: item for item in feed.json()}

    ai_survey = items["survey-ai-campus"]
    assert ai_survey["author_nickname"] == "설문요정"
    assert ai_survey["university_name"] == "고려대학교 세종캠퍼스"
    assert ai_survey["reward_points"] == 5
    assert ai_survey["base_reward_points"] == 5
    assert ai_survey["reward_boost_points"] == 0
    assert ai_survey["estimated_minutes"] == 2
    assert ai_survey["is_completed"] is True
    assert ai_survey["is_liked"] is True
    assert ai_survey["viewer_can_view_results"] is True

    paid = items["survey-cafe-paid"]
    assert paid["result_price_points"] == 200
    assert paid["is_bookmarked"] is True
    assert paid["viewer_can_view_results"] is False

    shuttle = items["survey-campus-shuttle"]
    assert shuttle["deadline_imminent"] is True
    assert shuttle["base_reward_points"] == 5
    assert shuttle["reward_boost_points"] == 20
    assert shuttle["boosted_reward_points"] == 25
    assert shuttle["reward_boost_price_krw"] == 2000
    assert shuttle["reward_boost_payment_status"] == "paid"
    assert shuttle["reward_multiplier"] == 1.5
    assert shuttle["reward_points"] == 27

    detail = client.get(
        "/api/v1/surveys/survey-ai-campus", headers=headers
    )
    assert detail.status_code == 200
    assert len(detail.json()["questions"]) == 3


def test_attendance_notifications_preferences_and_bookmarks(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    student_headers = dev_headers(client, "demo-student")
    author_headers = dev_headers(client, "demo-author")

    before = client.get(
        "/api/v1/attendance/today", headers=student_headers
    )
    assert before.status_code == 200
    assert before.json()["checked_in"] is False

    first = client.post(
        "/api/v1/attendance/check-in", headers=student_headers
    )
    second = client.post(
        "/api/v1/attendance/check-in", headers=student_headers
    )
    assert first.status_code == 200
    assert first.json()["points_earned"] == 5
    assert second.json()["already_checked_in"] is True
    assert second.json()["balance"] == first.json()["balance"]

    notices = client.get("/api/v1/notifications", headers=student_headers)
    assert notices.status_code == 200
    assert notices.json()["unread_count"] >= 2
    notice_id = notices.json()["items"][0]["id"]
    marked = client.patch(
        f"/api/v1/notifications/{notice_id}/read",
        headers=student_headers,
    )
    assert marked.status_code == 200
    read_all = client.post(
        "/api/v1/notifications/read-all", headers=student_headers
    )
    assert read_all.status_code == 200
    assert client.get(
        "/api/v1/notifications", headers=student_headers
    ).json()["unread_count"] == 0

    bookmark = client.post(
        "/api/v1/surveys/survey-ai-campus/bookmark",
        headers=student_headers,
    )
    assert bookmark.status_code == 200
    assert bookmark.json()["bookmarked"] is True
    saved = client.get(
        "/api/v1/users/me/bookmarks", headers=student_headers
    )
    assert any(item["id"] == "survey-ai-campus" for item in saved.json())

    preferences = client.patch(
        "/api/v1/users/me/preferences",
        headers=author_headers,
        json={
            "notifications_enabled": False,
            "interests": ["대학생활", "연구·프로젝트"],
            "selected_title": "극한 밸런스 장인",
        },
    )
    assert preferences.status_code == 200
    assert preferences.json()["selected_title"] == "극한 밸런스 장인"


def test_rewards_mock_ad_and_ppt_report(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = dev_headers(client, "demo-student")

    products = client.get("/api/v1/rewards/products")
    assert products.status_code == 200
    assert len(products.json()) >= 4

    exchange = client.post(
        "/api/v1/rewards/exchanges",
        headers=headers,
        json={"product_id": "coffee-americano", "quantity": 1},
    )
    assert exchange.status_code == 201
    assert exchange.json()["points_spent"] == 1500
    coupon_id = exchange.json()["id"]
    used = client.post(
        f"/api/v1/coupons/{coupon_id}/use", headers=headers
    )
    assert used.status_code == 200
    assert used.json()["status"] == "used"

    ad_payload = {"transaction_id": "mock-ad-test-001"}
    first_ad = client.post(
        "/api/v1/ads/rewarded/mock-complete",
        headers=headers,
        json=ad_payload,
    )
    second_ad = client.post(
        "/api/v1/ads/rewarded/mock-complete",
        headers=headers,
        json=ad_payload,
    )
    assert first_ad.status_code == 200
    assert first_ad.json()["reward"] == 10
    assert second_ad.json()["duplicate"] is True
    assert second_ad.json()["balance"] == first_ad.json()["balance"]

    report = client.post(
        "/api/v1/surveys/survey-ai-campus/reports/ppt",
        headers=headers,
    )
    assert report.status_code == 200
    assert report.json()["points_charged"] == 400
    download = client.get(report.json()["download_url"])
    assert download.status_code == 200
    assert download.headers["content-type"].startswith(
        "application/vnd.ms-powerpoint"
    )
    cached = client.post(
        "/api/v1/surveys/survey-ai-campus/reports/ppt",
        headers=headers,
    )
    assert cached.status_code == 200
    assert cached.json()["cached"] is True
    assert cached.json()["points_charged"] == 0


def test_balance_vote_discussion_and_answer_validation(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    first_token, _ = signup_and_verify(
        client, "010-7000-0001", "balance-one@korea.ac.kr"
    )
    second_token, _ = signup_and_verify(
        client, "010-7000-0002", "balance-two@korea.ac.kr"
    )
    first_headers = {"Authorization": f"Bearer {first_token}"}
    second_headers = {"Authorization": f"Bearer {second_token}"}

    vote = client.post(
        "/api/v1/balance-games/survey-team-balance/vote",
        headers=first_headers,
        json={"choice_id": "o-team-attend"},
    )
    assert vote.status_code == 200
    assert vote.json()["points_earned"] == 2
    assert vote.json()["my_choice"] == "o-team-attend"
    assert vote.json()["participant_count"] == 3

    second_vote = client.post(
        "/api/v1/balance-games/survey-team-balance/vote",
        headers=second_headers,
        json={"choice_id": "o-team-result"},
    )
    assert second_vote.status_code == 200

    post = client.post(
        "/api/v1/balance-games/survey-team-balance/posts",
        headers=first_headers,
        json={"body": "회의 참여가 없는 것보다는 나아요."},
    )
    assert post.status_code == 201
    assert post.json()["team"] == "o-team-attend"

    reply = client.post(
        f"/api/v1/balance-posts/{post.json()['id']}/replies",
        headers=second_headers,
        json={"body": "결과물 완성도도 중요하다고 생각해요."},
    )
    assert reply.status_code == 201
    assert reply.json()["team"] == "o-team-result"
    liked = client.post(
        f"/api/v1/balance-posts/{post.json()['id']}/like",
        headers=second_headers,
    )
    assert liked.status_code == 200
    assert liked.json()["like_count"] == 1

    posts = client.get(
        "/api/v1/balance-games/survey-team-balance/posts",
        headers=first_headers,
    )
    created = next(
        item for item in posts.json() if item["id"] == post.json()["id"]
    )
    assert created["reply_count"] == 1

    author_headers = dev_headers(client, "demo-author")
    created_survey = client.post(
        "/api/v1/surveys",
        headers=author_headers,
        json={
            "title": "복수 선택 검증 설문",
            "results_visibility": "public",
            "questions": [
                {
                    "question_type": "multiple",
                    "prompt": "최소 하나를 골라주세요.",
                    "required": True,
                    "options": [{"label": "A"}, {"label": "B"}],
                }
            ],
        },
    )
    survey_id = created_survey.json()["id"]
    question_id = created_survey.json()["questions"][0]["id"]
    assert client.post(
        f"/api/v1/surveys/{survey_id}/publish", headers=author_headers
    ).status_code == 200
    invalid = client.post(
        f"/api/v1/surveys/{survey_id}/responses",
        headers=first_headers,
        json={"answers": [{"question_id": question_id, "option_ids": []}]},
    )
    assert invalid.status_code == 422


@pytest.mark.parametrize(
    ("question_count", "expected"),
    [
        (1, 5),
        (4, 5),
        (5, 5),
        (6, 6),
        (10, 10),
        (40, 40),
        (41, 40),
        (100, 40),
    ],
)
def test_participation_reward_policy(
    question_count: int, expected: int
) -> None:
    assert participation_reward(question_count) == expected


def test_reward_boost_quote_payment_and_publish(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    author_headers = dev_headers(client, "demo-author")
    participant_headers = dev_headers(client, "demo-student")

    direct_reward = client.post(
        "/api/v1/surveys",
        headers=author_headers,
        json={
            "title": "직접 보상 입력 차단 설문",
            "reward_points": 15,
            "questions": [
                {
                    "question_type": "text",
                    "prompt": "의견을 적어주세요.",
                    "required": False,
                }
            ],
        },
    )
    assert direct_reward.status_code == 422

    created = client.post(
        "/api/v1/surveys",
        headers=author_headers,
        json={
            "title": "4문항 기본 보상과 추가 보상 테스트",
            "results_visibility": "public",
            "target_responses": 100,
            "questions": [
                {
                    "question_type": "text",
                    "prompt": f"선택 문항 {index}",
                    "required": False,
                }
                for index in range(1, 5)
            ],
        },
    )
    assert created.status_code == 201, created.text
    survey_id = created.json()["id"]
    assert created.json()["base_reward_points"] == 5
    assert created.json()["reward_boost_points"] == 0
    assert created.json()["reward_points"] == 5

    quote = client.get(
        f"/api/v1/surveys/{survey_id}/reward-boost/quote",
        params={"increment_points": 10},
        headers=author_headers,
    )
    assert quote.status_code == 200, quote.text
    assert quote.json()["base_reward_points"] == 5
    assert quote.json()["new_reward_points"] == 15
    assert quote.json()["amount_krw"] == 1000
    assert quote.json()["charge_scope"] == "survey_flat"

    invalid_quote = client.get(
        f"/api/v1/surveys/{survey_id}/reward-boost/quote",
        params={"increment_points": 15},
        headers=author_headers,
    )
    assert invalid_quote.status_code == 422
    other_user_quote = client.get(
        f"/api/v1/surveys/{survey_id}/reward-boost/quote",
        params={"increment_points": 10},
        headers=participant_headers,
    )
    assert other_user_quote.status_code == 404

    first_payload = {
        "increment_points": 10,
        "transaction_id": "reward-boost-test-001",
    }
    first_purchase = client.post(
        f"/api/v1/surveys/{survey_id}/reward-boost/mock-purchase",
        headers=author_headers,
        json=first_payload,
    )
    duplicate_purchase = client.post(
        f"/api/v1/surveys/{survey_id}/reward-boost/mock-purchase",
        headers=author_headers,
        json=first_payload,
    )
    assert first_purchase.status_code == 200, first_purchase.text
    assert first_purchase.json()["amount_krw"] == 1000
    assert first_purchase.json()["reward_points"] == 15
    assert first_purchase.json()["duplicate"] is False
    assert duplicate_purchase.status_code == 200
    assert duplicate_purchase.json()["duplicate"] is True

    reused_transaction = client.post(
        f"/api/v1/surveys/{survey_id}/reward-boost/mock-purchase",
        headers=author_headers,
        json={
            "increment_points": 20,
            "transaction_id": "reward-boost-test-001",
        },
    )
    assert reused_transaction.status_code == 409

    second_purchase = client.post(
        f"/api/v1/surveys/{survey_id}/reward-boost/mock-purchase",
        headers=author_headers,
        json={
            "increment_points": 10,
            "transaction_id": "reward-boost-test-002",
        },
    )
    assert second_purchase.status_code == 200
    assert second_purchase.json()["reward_boost_points"] == 20
    assert second_purchase.json()["reward_points"] == 25

    detail = client.get(
        f"/api/v1/surveys/{survey_id}", headers=author_headers
    )
    assert detail.json()["reward_boost_points"] == 20
    assert detail.json()["reward_boost_price_krw"] == 2000
    assert detail.json()["reward_boost_payment_status"] == "paid"

    published = client.post(
        f"/api/v1/surveys/{survey_id}/publish",
        headers=author_headers,
    )
    assert published.status_code == 200, published.text
    assert published.json()["reward_points"] == 25

    response = client.post(
        f"/api/v1/surveys/{survey_id}/responses",
        headers=participant_headers,
        json={"answers": []},
    )
    assert response.status_code == 201, response.text
    assert response.json()["points_earned"] == 25
    assert response.json()["base_points"] == 5
    assert response.json()["author_boost_points"] == 20
    assert response.json()["deadline_bonus_points"] == 0
    assert response.json()["balance"] == 3425

    quote_after_publish = client.get(
        f"/api/v1/surveys/{survey_id}/reward-boost/quote",
        params={"increment_points": 10},
        headers=author_headers,
    )
    assert quote_after_publish.status_code == 404

