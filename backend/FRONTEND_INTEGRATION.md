# 프런트엔드 연동 가이드

현재 설문 생성 화면은 실제 API의 `draft → 견적 → Mock 결제 → publish` 흐름과
연결되어 있습니다. 나머지 화면별 mock 데이터와 `localStorage` 기능은 아래 계약에 맞춰
단계적으로 교체합니다. 백엔드의 필드 이름은 `snake_case`이고 프런트 표시 모델은
어댑터에서 변환합니다.

## 1. API 클라이언트

프런트 `.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:4000/api/v1
```

Axios 예시:

```ts
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("suniversity-api-access-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

브라우저에서 프런트를 `http://localhost:5173`으로 실행하는 경우 CORS가 허용되어 있습니다.

## 2. 개발용 로그인

실제 로그인 UI를 연결하기 전에는 다음 API로 토큰을 받습니다.

```http
POST /dev/login?user_id=demo-author
```

응답의 `access_token`을 저장합니다.

```ts
const { data } = await api.post("/dev/login", null, {
  params: { user_id: "demo-author" },
});
localStorage.setItem("suniversity-api-access-token", data.access_token);
```

설문 작성·게시 화면은 `demo-author`를 사용합니다. 참여 API를 연동할 때는 작성자 본인의
설문 참여가 금지되므로 `demo-student` 같은 별도 계정을 사용합니다. 사용 가능한 계정은
`/dev/dummy-users`에서 확인할 수 있습니다.

## 3. 홈 설문 카드

추천 호출:

```http
GET /surveys?sort=hot&limit=10
GET /surveys?sort=deadline&limit=10
GET /surveys?sort=latest&limit=20
```

로그인 토큰을 함께 보내면 `is_completed`, `is_liked`, `is_bookmarked`,
`viewer_can_respond`, `viewer_can_view_results`가 사용자 기준으로 계산됩니다.

기존 카드 모델 변환 예시:

```ts
export function toSurveyCard(survey: any) {
  return {
    id: survey.id,
    title: survey.title,
    eyebrow: survey.category,
    tone: survey.deadline_imminent ? "orange" : "blue",
    point: survey.claimable_reward_points,
    meta: `${survey.question_count}문항 · 약 ${survey.estimated_minutes}분`,
    count: `${survey.response_count}/${survey.target_responses ?? "∞"}명`,
    completed: survey.is_completed,
    bookmarked: survey.is_bookmarked,
  };
}
```

카테고리 탭은 `GET /survey-categories`를 사용합니다.

## 4. 설문 상세와 응답

상세 화면 진입:

```http
GET /surveys/{survey_id}
```

`questions[].id`와 `questions[].options[].id`는 응답 제출 때 반드시 서버가 내려준 값을
그대로 사용해야 합니다.

| 문항 타입 | 제출 필드 |
|---|---|
| `single`, `scale`, `balance` | `option_ids: ["선택한 ID"]` |
| `multiple` | `option_ids: ["ID 1", "ID 2"]` |
| `text` | `value_text: "입력 내용"` |
| `number` | `value_number: 3` |

예시:

```ts
await api.post(`/surveys/${surveyId}/responses`, {
  answers: [
    { question_id: questionId, option_ids: [optionId] },
  ],
});
```

응답에는 실제 적립 포인트, 보너스, 잔액, 획득 배지, 결과 열람 가능 여부가 포함됩니다.
밸런스게임은 `balance_result`로 즉시 비율도 반환합니다.

## 5. 설문 만들기

프런트의 camelCase 입력값을 다음처럼 변환합니다.

```ts
function toCreatePayload(form: any) {
  return {
    title: form.title,
    description: form.description ?? "",
    category: form.category,
    subcategory: form.subcategory ?? null,
    survey_type: form.type === "balance" ? "balance" : "standard",
    results_visibility: form.resultsVisibility ?? "after_participation",
    result_price_points: Number(form.resultPricePoints ?? 0),
    target_responses: form.targetCount
      ? Number(form.targetCount)
      : null,
    deadline: new Date(form.deadline).toISOString(),
    questions: form.questions.map((question: any) => ({
      question_type: question.type,
      prompt: question.title,
      required: question.required ?? true,
      options: (question.options ?? []).map((label: string) => ({ label })),
    })),
  };
}
```

생성 직후에는 `draft`입니다. 게시 버튼에서 받은 `survey.id`로 한 번 더 호출합니다.

기본 참여 보상은 서버가 계산합니다.

```text
기본 보상 = 문항 수 기준 최소 5P, 최대 40P
4문항 설문 = 기본 5P
```

작성자가 추가 보상을 선택하지 않으면 바로 게시합니다. `+10P` 이상 추가하려면 먼저
서버 견적을 확인합니다.

```http
GET /surveys/{survey_id}/reward-boost/quote?increment_points=10
```

주요 응답:

```json
{
  "base_reward_points": 5,
  "current_reward_boost_points": 0,
  "increment_points": 10,
  "new_reward_points": 15,
  "amount_krw": 1000,
  "currency": "KRW",
  "charge_scope": "survey_flat"
}
```

사용자가 결제를 확인하면 개발용 Mock 결제를 호출합니다. 재시도에도 중복 결제가 되지
않도록 프런트에서 같은 `transaction_id`를 유지해야 합니다.

```ts
await api.post(`/surveys/${surveyId}/reward-boost/mock-purchase`, {
  increment_points: 10,
  transaction_id: crypto.randomUUID(),
});
```

`+20P`를 한 번에 구매하면 2,000원이며, `+10P`를 두 번 구매해도 총 2,000원입니다.
결제가 완료된 추가 보상만 설문에 적용됩니다. 실제 결제 연동 시 이 Mock API를
PG·앱스토어 영수증 검증 API로 교체합니다.

그 다음 설문을 게시합니다.

```http
POST /surveys/{survey_id}/publish
```

밸런스게임은 `balance` 문항 하나와 선택지 정확히 2개가 필요합니다.
밸런스게임에는 이 추가 보상 결제를 적용하지 않습니다.

## 6. 결과 화면

```http
GET /surveys/{survey_id}/results
```

- `200`: 결과 표시
- `402`: 유료 결과이므로 서버가 설문 상세에서 내려준 `result_price_points`를 안내한 뒤
  `POST /surveys/{survey_id}/results/purchase`
- `403`: 비공개이거나 아직 참여하지 않아 열람 불가
- `409`: 집계할 응답이 아직 없음

결과 가격과 포인트 잔액을 프런트에 고정값으로 두지 않습니다. 항상 설문 상세와
`GET /wallet` 응답을 기준으로 표시합니다.

작성자용 추가 기능:

```http
POST /ai/surveys/{survey_id}/analysis
POST /surveys/{survey_id}/reports/ppt
```

PPT API는 현재 개발용 HTML 내용을 `.ppt` 미디어 타입으로 내려주는 mock입니다.
응답의 `download_url`을 기준 URL과 합쳐 다운로드합니다.

## 7. 사용자 기능

| 화면/기능 | API |
|---|---|
| 내 정보 | `GET /users/me/profile` |
| 작성·참여 설문 | `GET /users/me/surveys?kind=created|participated` |
| 관심사·알림·대표 칭호 | `PATCH /users/me/preferences` |
| 출석 상태/체크 | `GET /attendance/today`, `POST /attendance/check-in` |
| 알림 목록/읽음 | `GET /notifications`, `PATCH /notifications/{id}/read` |
| 모두 읽음 | `POST /notifications/read-all` |
| 북마크 토글 | `POST /surveys/{id}/bookmark` |
| 저장한 설문 | `GET /users/me/bookmarks` |
| 포인트 | `GET /wallet` |
| 랭킹 | `GET /rankings` |
| 교환 상품 | `GET /rewards/products` |
| 상품 교환 | `POST /rewards/exchanges` |
| 내 쿠폰/사용 | `GET /users/me/coupons`, `POST /coupons/{id}/use` |
| 개발용 광고 완료 | `POST /ads/rewarded/mock-complete` |

## 8. 밸런스게임

```http
GET  /balance-games/categories
GET  /balance-games
GET  /balance-games/{game_id}
POST /balance-games/{game_id}/vote
GET  /balance-games/{game_id}/posts
POST /balance-games/{game_id}/posts
POST /balance-posts/{post_id}/replies
POST /balance-posts/{post_id}/like
```

투표 요청:

```json
{
  "choice_id": "서버가 내려준 선택지 ID"
}
```

투표한 사용자만 토론 글과 답글을 작성할 수 있으며, 서버가 선택한 팀을 자동 지정합니다.

## 9. 프런트에서 제거할 로컬 상태

API 연결 후 아래 데이터는 `localStorage`의 값을 진실의 원천으로 사용하지 않습니다.

- 설문 목록·상세·응답 여부
- 포인트 잔액과 거래 내역
- 좋아요·북마크
- 출석 기록과 알림 읽음 상태
- 쿠폰과 밸런스게임 투표·토론

`localStorage`에는 개발 단계에서 로그인 토큰과 UI 전용 설정만 남기는 것이 안전합니다.
