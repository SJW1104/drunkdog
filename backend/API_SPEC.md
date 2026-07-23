# SUNIVERSITY MVP API 명세서

이 문서는 `outputs/suniversity-api`에 구현된 자체 백엔드 API를 기준으로 작성되었습니다.
SMS, 이메일, OpenAI, AdMob 같은 외부 사업자 API 자체가 아니라, SUNIVERSITY 앱과 프론트엔드가
호출하는 내부 REST API를 설명합니다.

## 1. 공통 규칙

| 항목 | 값 |
|---|---|
| 기본 URL | `http://127.0.0.1:8000/api/v1` |
| 데이터 형식 | `application/json` |
| 인증 방식 | `Authorization: Bearer {access_token}` |
| ID 형식 | UUID 문자열. 대학 ID 등 일부 기준정보는 고정 문자열 사용 |
| 날짜 형식 | ISO 8601 문자열. 예: `2026-07-23T14:30:00+00:00` |
| 오류 형식 | `{ "detail": "오류 설명" }` |
| 자동 문서 | 서버 실행 후 `http://127.0.0.1:8000/docs` |

### 공통 상태 코드

| 코드 | 의미 |
|---|---|
| `200` | 조회·수정 성공 |
| `201` | 리소스 생성 성공 |
| `400` | 인증번호 오류 등 잘못된 요청 |
| `401` | 로그인 토큰 또는 웹훅 인증 실패 |
| `402` | 포인트 부족 또는 유료 결과 열람권 필요 |
| `403` | 학교 미인증 또는 접근 권한 없음 |
| `404` | 대상 리소스를 찾을 수 없음 |
| `409` | 중복 참여, 이미 처리된 상태, 마감된 설문 |
| `422` | 필드 검증 실패 또는 잘못된 문항·선택지 |
| `429` | 일일 광고 보상 횟수 초과 |
| `503` | 외부 AI·SMS·이메일 공급자 사용 불가 |

### 접근 권한 구분

| 구분 | 설명 |
|---|---|
| 공개 | 토큰 없이 호출 가능 |
| 로그인 | 유효한 Bearer 토큰 필요 |
| 학교 인증 | 로그인 후 대학교 이메일 인증까지 완료해야 함 |
| 내부 웹훅 | 앱 사용자가 아닌 외부 연동 서버만 호출 |

## 2. 전체 엔드포인트

| 영역 | 메서드 | 경로 | 권한 | 설명 |
|---|---|---|---|---|
| 시스템 | GET | `/health` | 공개 | 서버 상태 확인 |
| 인증 | GET | `/universities` | 공개 | 인증 가능한 학교 목록 |
| 인증 | POST | `/auth/phone/request` | 공개 | 휴대전화 OTP 발급 |
| 인증 | POST | `/auth/phone/verify` | 공개 | OTP 검증 및 로그인 |
| 인증 | POST | `/auth/university/request` | 로그인 | 학교 이메일 OTP 발급 |
| 인증 | POST | `/auth/university/verify` | 로그인 | 학교 인증 및 최초 포인트 지급 |
| 사용자 | GET | `/users/me` | 로그인 | 내 프로필 조회 |
| 사용자 | PATCH | `/users/me` | 로그인 | 닉네임 변경 |
| 설문 | POST | `/surveys` | 학교 인증 | 설문 임시저장 생성 |
| 설문 | GET | `/surveys` | 공개 | 게시된 설문 피드 조회 |
| 설문 | GET | `/surveys/{survey_id}` | 로그인 | 설문 상세 조회 |
| 설문 | POST | `/surveys/{survey_id}/publish` | 학교 인증·작성자 | 설문 게시 |
| 설문 | POST | `/surveys/{survey_id}/close` | 학교 인증·작성자 | 설문 마감 |
| 설문 | GET | `/surveys/{survey_id}/progress` | 공개 | 응답 진행률 조회 |
| 응답 | POST | `/surveys/{survey_id}/responses` | 학교 인증 | 설문 응답 제출 |
| 결과 | GET | `/surveys/{survey_id}/results` | 로그인·열람 권한 | 결과 통계 조회 |
| 결과 | POST | `/surveys/{survey_id}/results/purchase` | 학교 인증 | 유료 결과 열람권 구매 |
| 커뮤니티 | GET | `/surveys/{survey_id}/comments` | 공개 | 댓글·대댓글 조회 |
| 커뮤니티 | POST | `/surveys/{survey_id}/comments` | 학교 인증 | 댓글·대댓글 작성 |
| 커뮤니티 | POST | `/surveys/{survey_id}/like` | 학교 인증 | 좋아요 토글 |
| 커뮤니티 | POST | `/reports` | 학교 인증 | 설문·댓글·사용자 신고 |
| 포인트 | GET | `/wallet` | 로그인 | 잔액과 원장 내역 조회 |
| AI | POST | `/ai/survey-drafts` | 학교 인증 | AI 설문 초안 생성 |
| AI | POST | `/ai/surveys/{survey_id}/analysis` | 학교 인증·작성자 | AI 심층 분석 |
| 광고 | POST | `/integrations/admob/rewarded` | 내부 웹훅 | 검증된 리워드 광고 포인트 지급 |

## 3. 시스템 API

### GET `/health`

서버가 요청을 받을 수 있는지 확인합니다.

응답 `200`:

```json
{
  "status": "ok"
}
```

## 4. 인증 API

### GET `/universities`

학교 이메일 인증에 사용할 학교와 허용 도메인을 조회합니다.

응답 `200`:

```json
[
  {
    "id": "korea-sejong",
    "name": "고려대학교 세종캠퍼스",
    "email_domains": ["korea.ac.kr"]
  }
]
```

### POST `/auth/phone/request`

휴대전화 번호로 6자리 인증번호를 발급합니다.

요청:

```json
{
  "phone": "010-1234-5678"
}
```

응답 `200`:

```json
{
  "expires_in_seconds": 300,
  "dev_code": "123456"
}
```

`dev_code`는 개발 환경에서만 반환하는 테스트용 인증번호입니다. 운영 환경에서는 응답에서
제거하고 SMS 발송 어댑터를 사용해야 합니다.

### POST `/auth/phone/verify`

인증번호를 검증합니다. 처음 접속한 번호는 회원을 생성하고, 기존 번호는 로그인 처리합니다.

요청:

```json
{
  "phone": "010-1234-5678",
  "code": "123456"
}
```

응답 `200`:

```json
{
  "access_token": "signed-access-token",
  "token_type": "bearer",
  "user": {
    "id": "09a3e489-3bd4-4fbf-a6b6-d342fc3a4203",
    "phone": "01012345678",
    "nickname": "수니5678",
    "email": null,
    "university_id": null,
    "university_verified": false,
    "role": "user",
    "created_at": "2026-07-23 12:00:00"
  }
}
```

이후 인증이 필요한 요청에는 다음 헤더를 사용합니다.

```http
Authorization: Bearer signed-access-token
```

### POST `/auth/university/request`

선택한 학교의 이메일 도메인을 확인하고 학교 이메일 OTP를 발급합니다.

요청:

```json
{
  "university_id": "korea-sejong",
  "email": "student@korea.ac.kr"
}
```

응답은 전화 OTP 발급 응답과 같습니다. 개발 환경에서는 `dev_code`가 포함됩니다.

주요 오류:

- `404`: 등록되지 않은 학교
- `422`: 해당 학교의 이메일 도메인이 아님
- `503`: 운영 이메일 발송 어댑터가 설정되지 않음

### POST `/auth/university/verify`

학교 이메일 OTP를 확인하고 사용자를 학교 인증 상태로 변경합니다. 최초 성공 시 2,500P를
한 번만 지급합니다.

요청:

```json
{
  "email": "student@korea.ac.kr",
  "code": "654321"
}
```

응답 `200`: 갱신된 사용자 객체

## 5. 사용자 API

### GET `/users/me`

현재 로그인한 사용자 정보를 조회합니다.

### PATCH `/users/me`

닉네임을 변경합니다. 닉네임은 2~20자입니다.

요청:

```json
{
  "nickname": "세종캠퍼스러"
}
```

응답 `200`: 갱신된 사용자 객체

## 6. 설문 API

### 문항 유형

| `question_type` | 설명 | 답변 필드 |
|---|---|---|
| `single` | 객관식 단일 선택 | `option_ids`에 1개 |
| `multiple` | 객관식 복수 선택 | `option_ids`에 여러 개 |
| `text` | 주관식 | `value_text` |
| `number` | 숫자 입력 | `value_number` |
| `scale` | 척도형 | `option_ids`에 1개 |
| `balance` | 밸런스게임 | 선택지 정확히 2개, 답변은 1개 |

### 결과 공개 유형

| `results_visibility` | 설명 |
|---|---|
| `public` | 로그인 사용자는 누구나 열람 가능 |
| `after_participation` | 설문 참여자와 작성자만 열람 가능 |
| `private` | 작성자만 열람 가능 |
| `paid` | 작성자 또는 포인트로 열람권을 구매한 사용자만 가능 |

### POST `/surveys`

설문과 문항을 생성합니다. 최초 상태는 `draft`입니다.

요청 예시:

```json
{
  "title": "캠퍼스 셔틀이 생긴다면 이용하시겠어요?",
  "description": "셔틀버스 도입 수요를 조사합니다.",
  "category": "대학생활",
  "survey_type": "standard",
  "results_visibility": "after_participation",
  "result_price_points": 0,
  "target_responses": 100,
  "deadline": "2026-08-01T23:59:59+09:00",
  "questions": [
    {
      "question_type": "single",
      "prompt": "셔틀이 생기면 이용하시겠어요?",
      "required": true,
      "options": [
        {"label": "네"},
        {"label": "아니요"}
      ]
    },
    {
      "question_type": "text",
      "prompt": "희망 노선을 알려주세요.",
      "required": false,
      "options": []
    }
  ]
}
```

응답 `201`: 생성된 설문 상세 객체. 서버에서 생성한 설문·문항·선택지 ID가 포함됩니다.

검증 규칙:

- 설문 제목: 2~150자
- 문항: 1~100개
- 선택형 문항: 선택지 2개 이상
- 밸런스 문항: 선택지 정확히 2개
- `paid` 결과: `result_price_points`가 1 이상이어야 함

### GET `/surveys`

게시 상태인 설문 피드를 조회합니다.

쿼리 파라미터:

| 이름 | 기본값 | 설명 |
|---|---:|---|
| `sort` | `latest` | `latest`, `hot`, `deadline` 중 하나 |
| `category` | 없음 | 카테고리 일치 필터 |
| `limit` | `20` | 1~100 |
| `offset` | `0` | 페이지 시작 위치 |

응답 항목에는 `response_count`, `like_count`, `question_count`가 포함됩니다.

### GET `/surveys/{survey_id}`

설문과 문항·선택지를 조회합니다. 임시저장 설문은 작성자만 조회할 수 있습니다.

### POST `/surveys/{survey_id}/publish`

작성자가 `draft` 설문을 게시합니다. 성공 시 상태가 `published`로 변경됩니다.

### POST `/surveys/{survey_id}/close`

작성자가 게시된 설문을 수동 마감합니다. 성공 시 상태가 `closed`로 변경됩니다.

### GET `/surveys/{survey_id}/progress`

응답 수와 목표 달성률을 조회합니다.

응답 `200`:

```json
{
  "survey_id": "survey-uuid",
  "response_count": 42,
  "target_responses": 100,
  "percentage": 42.0
}
```

목표 응답 수를 설정하지 않은 경우 `percentage`는 `null`입니다.

## 7. 응답 API

### POST `/surveys/{survey_id}/responses`

게시된 설문에 응답합니다. 한 사용자는 한 설문에 한 번만 참여할 수 있습니다.

요청 예시:

```json
{
  "answers": [
    {
      "question_id": "single-question-uuid",
      "option_ids": ["selected-option-uuid"]
    },
    {
      "question_id": "multiple-question-uuid",
      "option_ids": ["option-a-uuid", "option-b-uuid"]
    },
    {
      "question_id": "text-question-uuid",
      "value_text": "정문에서 기숙사까지 필요합니다."
    },
    {
      "question_id": "number-question-uuid",
      "value_number": 4
    }
  ]
}
```

응답 `201`:

```json
{
  "response_id": "response-uuid",
  "points_earned": 4,
  "balance": 2504
}
```

서버 검증 사항:

- 게시 상태 및 마감일 확인
- 사용자 중복 참여 확인
- 설문에 포함된 문항·선택지인지 확인
- 필수 문항 누락 확인
- 단일·복수 선택 개수 확인
- 포인트 지급 및 일일 한도 적용

## 8. 결과 API

### GET `/surveys/{survey_id}/results`

공개 정책에 따라 설문 집계 결과를 조회합니다.

선택형 결과 예시:

```json
{
  "survey_id": "survey-uuid",
  "title": "캠퍼스 셔틀 수요 조사",
  "response_count": 10,
  "questions": [
    {
      "question_id": "question-uuid",
      "prompt": "셔틀을 이용하시겠어요?",
      "question_type": "single",
      "answer_count": 10,
      "options": [
        {
          "option_id": "option-uuid",
          "label": "네",
          "count": 8,
          "percentage": 80.0
        }
      ]
    }
  ]
}
```

숫자 문항은 `average`, `minimum`, `maximum`을 반환합니다. 주관식 원문 목록은 개인정보
노출을 줄이기 위해 설문 작성자에게만 최대 100개까지 반환합니다.

### POST `/surveys/{survey_id}/results/purchase`

`results_visibility=paid`인 설문의 열람권을 포인트로 구매합니다.

요청 본문은 없습니다.

응답 `200`:

```json
{
  "purchased": true,
  "balance": 2300
}
```

같은 사용자가 같은 설문을 다시 구매해도 중복 차감되지 않습니다. 결제액의 70%는 설문 작성자
포인트로 지급되며 30%는 플랫폼 몫입니다.

## 9. 커뮤니티 API

### GET `/surveys/{survey_id}/comments`

삭제되지 않은 댓글과 대댓글을 작성 순서대로 조회합니다.

응답 예시:

```json
[
  {
    "id": "comment-uuid",
    "survey_id": "survey-uuid",
    "parent_id": null,
    "body": "흥미로운 설문이네요.",
    "display_name": "세종캠퍼스러",
    "university_name": "고려대학교 세종캠퍼스",
    "created_at": "2026-07-23 12:00:00"
  }
]
```

익명 댓글은 `display_name`이 `익명`, `university_name`이 `null`로 반환됩니다.

### POST `/surveys/{survey_id}/comments`

댓글 또는 대댓글을 작성합니다.

요청:

```json
{
  "body": "저도 셔틀이 필요하다고 생각합니다.",
  "parent_id": null,
  "display_mode": "nickname"
}
```

| 필드 | 값 |
|---|---|
| `body` | 1~1,000자 |
| `parent_id` | 일반 댓글은 `null`, 대댓글은 부모 댓글 ID |
| `display_mode` | `anonymous` 또는 `nickname` |

### POST `/surveys/{survey_id}/like`

좋아요를 토글합니다. 별도 요청 본문은 없습니다.

```json
{
  "liked": true,
  "like_count": 15
}
```

### POST `/reports`

설문·댓글·사용자를 신고합니다.

요청:

```json
{
  "target_type": "comment",
  "target_id": "comment-uuid",
  "reason": "욕설이 포함되어 있습니다."
}
```

`target_type`은 `survey`, `comment`, `user` 중 하나입니다.

응답 `201`:

```json
{
  "report_id": "report-uuid",
  "status": "pending"
}
```

## 10. 포인트 API

### GET `/wallet`

현재 잔액, 오늘 획득한 보상, 최근 포인트 원장을 조회합니다.

쿼리 파라미터 `limit`은 기본 50, 최대 200입니다.

응답 예시:

```json
{
  "balance": 2510,
  "daily_reward_total": 10,
  "daily_reward_limit": 1000,
  "transactions": [
    {
      "id": "ledger-uuid",
      "amount": 10,
      "entry_type": "rewarded_ad",
      "reference_type": "admob_transaction",
      "reference_id": "ad-transaction-id",
      "balance_after": 2510,
      "created_at": "2026-07-23 12:00:00"
    }
  ]
}
```

현재 포인트 처리 규칙:

| 이벤트 | 포인트 |
|---|---:|
| 학교 인증 최초 완료 | `+2,500P` |
| 설문 참여 | 문항 수 기준 `+1~40P` |
| 마감까지 24시간 이하인 설문 참여 | 기본 참여 포인트의 `1.5배` |
| 일반 일일 획득 한도 | `1,000P` |
| 리워드 광고 | `+10P`, 하루 최대 5회 |
| AI 심층 분석 | `-200P` |
| 유료 결과 열람 | 작성자가 설정한 포인트 차감 |

포인트 적립·차감은 클라이언트가 금액을 직접 지정하지 않습니다. 설문 제출, 학교 인증, 검증된
광고 웹훅 등 서버 이벤트에 의해 원장이 생성됩니다.

## 11. AI API

### POST `/ai/survey-drafts`

주제와 대상에 맞는 설문 제목·설명·문항 초안을 만듭니다.

요청:

```json
{
  "topic": "도서관 운영 시간 연장",
  "audience": "고려대학교 세종캠퍼스 재학생",
  "tone": "friendly",
  "question_count": 8
}
```

| 필드 | 규칙 |
|---|---|
| `topic` | 2~500자 |
| `audience` | 최대 200자 |
| `tone` | `friendly`, `neutral`, `academic` |
| `question_count` | 2~30개 |

응답은 `POST /surveys`의 `title`, `description`, `questions` 필드와 호환됩니다. 사용자는 AI
초안을 검토·수정한 뒤 설문 생성 API로 저장해야 합니다.

### POST `/ai/surveys/{survey_id}/analysis`

설문 작성자가 집계 결과를 바탕으로 심층 분석을 생성합니다. 성공 시 200P가 차감됩니다.

요청 본문은 없습니다.

응답 예시:

```json
{
  "analysis": {
    "summary": "총 100명이 참여했으며 셔틀 도입 찬성이 우세했습니다.",
    "findings": [
      "응답자의 72%가 셔틀 이용 의향을 표시했습니다.",
      "기숙사와 정문 연결 수요가 가장 높았습니다."
    ],
    "cautions": [
      "이 결과는 자발적으로 참여한 사용자 표본에 한정됩니다."
    ]
  },
  "points_charged": 200,
  "balance": 2300
}
```

AI 공급자에는 전화번호, 학교 이메일, 사용자 ID가 아니라 서버에서 계산한 집계 통계만
전달합니다.

## 12. 광고 연동 API

### POST `/integrations/admob/rewarded`

광고 검증 계층이 정상 광고 시청을 확인한 뒤 호출하는 내부 API입니다.

필수 헤더:

```http
X-Webhook-Secret: configured-webhook-secret
```

요청:

```json
{
  "transaction_id": "admob-transaction-001",
  "user_id": "user-uuid",
  "reward_amount": 10
}
```

응답:

```json
{
  "accepted": true,
  "reward": 10,
  "balance": 2520,
  "duplicate": false
}
```

같은 `transaction_id`가 다시 전달되면 포인트를 중복 지급하지 않고 `duplicate: true`를
반환합니다.

이 엔드포인트의 `X-Webhook-Secret`은 SUNIVERSITY 내부 어댑터 인증용입니다. 운영 환경에서
AdMob 원본 콜백을 받을 때는 그 앞단에서 Google SSV의 ECDSA 서명을 별도로 검증해야 합니다.

## 13. 현재 명세에 없는 후속 API

다음 기능은 기획안에는 있지만 현재 MVP 코드에는 아직 구현되지 않았습니다.

- 설문 수정·삭제·복제
- 설문 끌어올리기와 24시간 프리미엄 노출
- 기프티콘 상품 조회·교환
- 현금 출금과 지급대행
- StoreKit·Google Play 결제 검증
- 친구 초대
- 알림 목록·읽음 처리·푸시 토큰 등록
- 사용자 활동 내역·레벨·랭킹·AI 프로필 태그
- 관리자 신고 심사·포인트 회수·회원 정지
- CSV·Excel·PPT 보고서 파일 생성
- 검색어 기반 설문 검색

이 기능들은 API 경로와 데이터 규칙을 별도 버전에서 추가해야 합니다.
