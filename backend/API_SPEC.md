# SUNIVERSITY 백엔드 API 명세

이 문서는 현재 JSON 기반 MVP의 설문 제작·교환·결과 API를 설명한다. 실제 실행 중인
요청/응답 스키마는 FastAPI Swagger(`http://127.0.0.1:4000/docs`)가 최종 기준이다.

## 1. 공통 규칙

| 항목 | 값 |
|---|---|
| Base URL | `http://127.0.0.1:4000/api/v1` |
| 데이터 형식 | `application/json` |
| 인증 | `Authorization: Bearer {access_token}` |
| 날짜 | 타임존을 포함한 ISO 8601 |
| 오류 본문 | `{"detail": "오류 설명"}` |

대학교 인증이 필요한 API는 인증되지 않은 사용자의 요청을 `403`으로 거절한다. 일반
공개 링크 API는 로그인과 대학교 인증이 필요 없다.

### 상태 코드

| 코드 | 의미 |
|---|---|
| `200` | 조회·수정 성공 |
| `201` | 생성·응답 제출 성공 |
| `400` | OTP 등 잘못된 요청 |
| `401` | 토큰 없음·만료·위조 |
| `403` | 대학교 미인증, 조건 불충족, 권한 없음 |
| `404` | 리소스가 없거나 접근 권한이 없어 숨김 처리됨 |
| `409` | 현재 상태에서 처리 불가, 중복, 제한 초과 |
| `422` | 요청 필드 또는 설문 응답 검증 실패 |
| `503` | AI 공급자 장애 |

## 2. 인증과 개발 로그인

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/health` | 서버 상태 확인 |
| `GET` | `/universities` | 인증 가능한 대학교 목록 |
| `POST` | `/auth/phone/request` | 휴대전화 OTP 발급 |
| `POST` | `/auth/phone/verify` | 휴대전화 OTP 검증 및 로그인 |
| `POST` | `/auth/university/request` | 대학교 이메일 OTP 발급 |
| `POST` | `/auth/university/verify` | 대학교 인증 완료 |
| `POST` | `/dev/login?user_id=demo-author` | 개발용 즉시 로그인 |
| `POST` | `/dev/reset` | 개발 JSON 데이터를 seed 상태로 초기화 |

개발 로그인 응답의 `access_token`을 이후 요청의 Bearer 토큰으로 사용한다.

## 3. 설문

### 지원 문항

`question_type`은 다음 값을 지원한다.

- `short_text`, `long_text`
- `single_choice`, `checkboxes`, `dropdown`
- `linear_scale`
- `multiple_choice_grid`, `checkbox_grid`
- `date`, `time`, `file_upload`

질문에는 `required`, `description`, `validation`, 선택지, 척도 범위 등을 설정할 수 있다.
그리드형 문항의 교환용 유효 문항 수는 질문 객체 수가 아니라 행(`rows`) 수로 계산한다.

문항 구간은 `1~5`, `6~10`, `11~15`처럼 5개 단위다. 문항이 0개인 설문은 초안으로
저장할 수 있지만 게시·교환할 수 없다.

### 문항별 응답 필드와 검증

한 문항의 답안에는 해당 유형의 필드만 보낼 수 있다. 예를 들어 객관식 답안에
`value_text`를 함께 보내면 `422`가 반환된다.

| 문항 유형 | 답안 필드 | 주요 검증 |
|---|---|---|
| `short_text` | `value_text` | 기본 최대 500자, 길이·정규식 조건 |
| `long_text` | `value_text` | 기본 최대 10,000자, 길이·정규식 조건 |
| `single_choice`, `dropdown` | `option_ids` | 정확히 1개, 실제 선택지 ID |
| `checkboxes` | `option_ids` | 중복 금지, 최소·최대 선택 개수 |
| `linear_scale` | `value_number` | 정수, 설정된 최솟값~최댓값 |
| `multiple_choice_grid` | `grid_answers` | 필수 행마다 열 ID 정확히 1개 |
| `checkbox_grid` | `grid_answers` | 필수 행마다 열 ID 1개 이상 |
| `date` | `value_date` | 실제 존재하는 `YYYY-MM-DD` |
| `time` | `value_time` | 실제 존재하는 `HH:MM` 또는 `HH:MM:SS` |
| `file_upload` | `file_uploads` | 개수·크기·MIME 및 메타데이터 검증 |

파일 메타데이터 한 건의 형식:

```json
{
  "file_name": "consent.pdf",
  "mime_type": "application/pdf",
  "size": 102400,
  "storage_key": "uploads/2026/consent.pdf"
}
```

`file_name` 대신 `name`, `storage_key` 대신 `url`도 사용할 수 있다. `size`는 0보다 큰
바이트 정수여야 한다. 현재 JSON MVP는 파일 바이너리를 직접 저장하지 않으므로 실제
업로드 저장소가 발급한 `storage_key` 또는 `url`을 답안에 넣어야 한다.

설문 생성 시에도 다음 잘못된 설정을 `422`로 차단한다.

- 중복 선택지, 중복 그리드 행·열
- 선택지 수보다 큰 `min_choices` 또는 `max_choices`
- 체크박스가 아닌 문항의 선택 개수 제한
- 컴파일할 수 없는 정규식
- 중복되거나 `type/subtype` 형식이 아닌 MIME 유형

### 설문 생성

`POST /surveys`

대학교 인증이 필요하다. 교환 필드를 생략하면 일반 설문 초안으로 생성할 수 있다.

```json
{
  "title": "대학생의 생성형 AI 활용 조사",
  "description": "논문 연구용 설문입니다.",
  "category": "연구·프로젝트",
  "category_tags": ["AI", "학습"],
  "deadline": "2026-08-15T23:59:00+09:00",
  "questions": [
    {
      "question_type": "single_choice",
      "prompt": "생성형 AI를 사용한 적이 있나요?",
      "required": true,
      "options": [
        {"label": "있다"},
        {"label": "없다"}
      ]
    }
  ],
  "external_access_enabled": true,
  "respondent_results_enabled": true,
  "exchange_enabled": true,
  "exchange_methods": ["direct", "auto"],
  "exchange_unit": "individual",
  "target_exchange_responses": 20,
  "auto_repeat": true,
  "required_respondent_conditions": [
    {"field": "year", "values": ["2", "3", "4"]}
  ],
  "results_visibility": "after_participation"
}
```

팀 설문은 다음 필드를 사용한다.

```json
{
  "exchange_unit": "team",
  "team_id": "팀 ID",
  "team_requested_responses": 3
}
```

`team_requested_responses`는 해당 팀원 수 이하여야 한다.

### 설문 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/surveys` | 초안 생성 |
| `GET` | `/surveys` | 게시 설문 목록 |
| `GET` | `/surveys/{survey_id}` | 설문 상세 |
| `PATCH` | `/surveys/{survey_id}` | 작성자 초안 수정 |
| `DELETE` | `/surveys/{survey_id}` | 작성자 초안 삭제 |
| `POST` | `/surveys/{survey_id}/publish` | 게시 |
| `POST` | `/surveys/{survey_id}/close` | 조기 마감 |
| `GET` | `/users/me/surveys` | 내 작성·참여 설문 |
| `GET` | `/survey-categories` | 카테고리 목록 |

직접 교환 신청 또는 자동매칭 대기 등록 시 `structure_locked_at`이 설정된다. 게시된
설문은 질문·선택지·카테고리·교환 조건을 변경할 수 없고 마감만 수정할 수 있다.
진행 중인 교환의 완료 기한보다 이르게 마감을 단축할 수 없으며, 마감 연장은 허용한다.

## 4. 팀

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/teams` | 팀 생성 |
| `GET` | `/teams` | 내가 속한 팀 목록 |
| `POST` | `/teams/{team_id}/members` | 팀장이 인증 사용자를 추가 |
| `DELETE` | `/teams/{team_id}/members/{member_id}` | 팀장이 팀원을 내보냄 |
| `POST` | `/teams/{team_id}/leave` | 팀원이 자진 탈퇴 |
| `PATCH` | `/teams/{team_id}/owner` | 현재 팀장이 팀장 권한 이전 |
| `GET` | `/teams/{team_id}/reliability` | 팀 신뢰도 |

개인은 개인 설문과, 팀은 팀 설문과만 교환된다. 팀 교환의 양쪽 필수 응답 수는 같을
필요가 없다. 각 팀이 자신의 설문에 설정한 `team_requested_responses`만큼 상대 설문에
응답하며, 한 명이라도 부족하면 전체 교환 결과가 반영되지 않는다.

팀원 구성 변경 규칙:

- 진행 중인 교환이 있으면 팀원 추가·삭제·탈퇴를 할 수 없다.
- 변경 후 팀원 수가 기존 초안·게시 설문의 `team_requested_responses`보다 적어지면
  삭제·탈퇴할 수 없다.
- 팀장은 본인을 직접 삭제하거나 탈퇴할 수 없으며 먼저 현재 팀원에게 팀장 권한을
  이전해야 한다.
- 팀장 변경은 팀원 구성을 바꾸지 않으므로 진행 중인 교환이 있어도 가능하다.
- 팀원 추가 대상과 새 팀장은 대학교 인증을 마친 현재 사용자여야 한다.

팀장 변경 요청:

```json
{"user_id": "새 팀장 사용자 ID"}
```

## 5. 직접(선택) 교환

직접 교환은 내 설문과 같거나 더 높은 문항 구간의 설문에만 신청할 수 있다. 추천
목록은 카테고리 유사도와 문항 수 등을 반영해 정렬한다.

### 추천 조회

`GET /exchanges/recommendations?survey_id={내 설문 ID}&limit=20`

신청 가능한 설문만 반환한다.

### 교환 신청

`POST /exchanges/direct`

신청과 동시에 신청자가 상대 설문에 응답한다. 이 응답은 `held` 상태로 저장되어 통계에
포함되지 않는다.

선행 응답 검증이 끝나기 전에는 교환 신청 자체를 저장하지 않는다. 따라서 응답 제출
전 화면 이탈은 취소·신뢰도 이력으로 기록되지 않는다. 신청이 생성된 이후 신청자가
취소하면 이미 유효한 선행 응답이 저장된 상태이므로 신뢰도에 반영된다.

```json
{
  "source_survey_id": "내 설문 ID",
  "target_survey_id": "상대 설문 ID",
  "answers": [
    {
      "question_id": "질문 ID",
      "option_ids": ["선택지 ID"]
    }
  ]
}
```

### 상대방 처리

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/exchanges/{exchange_id}/accept` | 받은 직접 신청 수락 |
| `POST` | `/exchanges/{exchange_id}/responses` | 상대 설문 응답 |
| `POST` | `/exchanges/{exchange_id}/reject` | 수락 전 거절 |
| `POST` | `/exchanges/{exchange_id}/cancel` | 진행 중 교환 수동 취소 |
| `GET` | `/exchanges?state={state}` | 내 교환 목록 |

취소 요청 예시:

```json
{"reason": "연구 일정 변경"}
```

개인 직접 교환은 신청자가 먼저 답하고, 상대 작성자가 수락 후 답하면 완료된다. 팀
교환은 각 팀의 필수 인원 전원이 응답해야 완료된다.

## 6. 자동 매칭

자동 매칭은 동일 문항 구간끼리만 연결한다. 1차 조건은 문항 구간과 필수 응답자 조건,
2차 우선순위는 신뢰도 80%와 대기 시간 20%다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/exchanges/auto/queue` | 자동 매칭 대기 등록 |
| `GET` | `/exchanges/auto/queue` | 내 활성 대기·매칭 항목 |

등록 요청:

```json
{"survey_id": "자동 매칭할 설문 ID"}
```

상대가 없으면 `status: "waiting"`, 연결되면 `status: "matched"`와 교환 객체를 반환한다.
자동 매칭은 별도의 수락 단계가 없으며 양쪽이 `/exchanges/{id}/responses`로 상대 설문에
응답한다.

`auto_repeat: true`이면 목표 교환 응답 수를 채울 때까지 완료·취소 후 자동으로 다시
대기한다. 한 번 종료된 동일한 두 설문은 즉시 다시 연결하지 않는다.

## 7. 교환 상태와 예외 규칙

### 교환 상태

| 상태 | 의미 |
|---|---|
| `awaiting_acceptance` | 직접 신청 후 상대 수락 대기 |
| `in_progress` | 수락 또는 자동 연결 후 응답 진행 |
| `completed` | 양쪽 의무 응답 완료, 결과 반영됨 |
| `rejected` | 직접 신청 거절 |
| `cancelled` | 수동 취소, 설문 조기 마감, 팀원 부족 |
| `expired` | 교환 완료 기한 초과 |

### 응답 결과 상태

| 상태 | 의미 |
|---|---|
| `held` | 교환 진행 중 보류, 통계·표·CSV에서 제외 |
| `included` | 교환 완료 또는 일반 링크 응답, 결과에 포함 |
| `excluded` | 취소·거절·만료로 폐기, 결과에서 제외 |

### 제한과 자동 정리

- 교환 완료 기한은 양쪽 설문 마감 중 빠른 시점의 24시간 전이다.
- 기한이 지나면 미완료 교환을 자동으로 `expired` 처리한다.
- 설문이 조기 마감·삭제되면 관련 활성 교환을 취소한다.
- 팀의 조건 충족 활성 인원이 남은 의무 응답 수보다 적으면 전체 교환을 취소한다.
- 보낸 직접 신청 최대 10건, 받은 직접 신청 최대 10건이다.
- 설문별 활성 자동 교환·대기는 최대 10건이다.
- 완료·예약 응답이 `target_exchange_responses`를 넘지 않도록 새 교환을 막는다.
- 수동 취소자는 신뢰도가 하락하고 상대방은 불이익을 받지 않는다.

JSON MVP에는 상시 실행되는 백그라운드 작업자가 없다. 교환·결과 대시보드 API가 호출될
때 상태를 자동 보정하며, 명시적으로 실행하려면 다음 API를 사용할 수 있다.

`POST /exchanges/reconcile`

```json
{
  "terminalized": 1,
  "auto_matches_created": 0,
  "active_for_user": 2
}
```

## 8. 신뢰도

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/users/me/reliability` | 개인 신뢰도 |
| `GET` | `/teams/{team_id}/reliability` | 팀 신뢰도 |

초기 신뢰도는 30점이다. 현재 공식은 아래와 같다.

```text
신뢰도 = 100 × (완료 슬롯 + 1.5) / (의무 슬롯 + 5)
```

0~100 범위, 소수 첫째 자리로 반환한다. 자동 매칭 우선순위는 신뢰도 80%, 최대 72시간
동안 증가하는 대기 점수 20%를 반영한다.

## 9. 공개 링크

외부 참여자는 앱 계정과 대학교 인증이 필요 없다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/surveys/{survey_id}/share-link` | 작성자가 공개 링크 발급·조회 |
| `GET` | `/public/surveys/{slug}` | 외부 참여용 설문 조회 |
| `POST` | `/public/surveys/{slug}/responses` | 외부 응답 제출 |
| `GET` | `/public/results/{token}` | 외부 응답자의 결과 조회 |

외부 링크 응답은 교환이 아니므로 검증 성공 즉시 `included`가 된다.

## 10. 결과

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/surveys/{survey_id}/results` | 요약·질문별 통계와 그래프 데이터 |
| `GET` | `/surveys/{survey_id}/responses/table` | 작성자용 개별 응답 표 |
| `GET` | `/surveys/{survey_id}/results.csv` | 작성자용 CSV 다운로드 |
| `GET` | `/research/dashboard` | 내 설문·교환·신뢰도 요약 |

교환 응답은 `completed` 이후에만 결과에 포함된다. 보류 중인 응답은 진행 수치로
노출하지 않고 `pending` 여부만 제공한다.

작성자는 응답자의 학교·학년과 필수 조건 충족에 필요한 프로필 범위를 볼 수 있다.
일반 응답자는 통계 그래프를 볼 수 있지만 개별 응답자의 개인정보는 볼 수 없다.

결과 응답에는 `minimum_group_size: 5`와 `group_statistics`가 포함된다. 학교·학년 및
설문에서 필수 조건으로 지정한 학과·프로필 카테고리는 응답자가 5명 이상인 그룹만
이름을 공개한다. 1~4명인 그룹은 이름을 숨기고 `기타/응답자 5명 미만`으로 합산한다.
이 보호 기준은 작성자와 참여자에게 동일하게 적용된다.

문항별 통계는 다음을 제공한다.

- 객관식·체크박스: 선택지별 수와 전체 응답자 대비 비율
- 선형 척도·숫자: 평균, 중앙값, 최솟값, 최댓값과 값별 분포
- 그리드: 행별 선택 수와 비율
- 주관식·날짜·시간: 작성자, 앱 참여자, 외부 링크 참여자에게 원문 공개
- 파일 메타데이터: 설문 작성자에게만 공개

교환 완료 응답과 일반 앱·외부 링크 응답만 집계한다. `held`, `excluded`, 취소·만료된
교환 응답은 전체 통계와 그룹 통계에서 모두 제외한다.

설문 작성자는 다음 쿼리로 결과를 필터링할 수 있다.

```http
GET /surveys/{survey_id}/results?university=A대학교&year=3&profile_category=research
```

필터 응답은 `response_count`, 필터 전 전체 수는 `total_response_count`로 제공한다.
프로필 필터는 작성자만 사용할 수 있고 참여자·외부 결과에는 허용하지 않는다.

## 11. 신고 처리와 교환 알림

`POST /reports`로 설문 신고를 접수한다. 관리자 역할 사용자는 다음 API로 처리한다.

```http
POST /reports/{report_id}/resolve
```

```json
{"decision": "accepted", "note": "신고 검토 후 무효 처리"}
```

설문 신고가 승인되면 설문과 관련 교환은 `invalidated`가 되고, 교환으로 반영됐거나
대기 중이던 양쪽 응답을 결과에서 제외한다. 해당 교환의 신뢰도 이력도 제거하므로
양측 모두 불이익을 받지 않는다. 기각은 신고 상태만 `rejected`로 변경한다.

교환 신청 도착, 수락, 완료, 거절, 취소, 신고 무효화 시 앱 알림을 생성한다. 팀 교환은
해당 팀원들에게 전달하며 사용자가 알림을 꺼둔 경우 생성하지 않는다.

## 12. AI 질문 다듬기

`POST /ai/questions/rewrite`

```json
{
  "prompt": "학교 수업 만족하나요?",
  "description": "수업 전반을 묻는 질문",
  "question_type": "single_choice"
}
```

응답은 원본과 수정본, 수정 이유를 함께 제공한다. 작성자가 둘 중 하나를 선택하고,
AI 수정본도 설문 저장 전에 다시 편집할 수 있다. `AI_MODE=mock`이면 외부 API 없이
고정된 개발용 수정 결과를 반환한다.

## 13. 현재 MVP 범위 주의사항

- 데이터는 `data/runtime.json`에 저장되며 단일 프로세스 실행을 전제로 한다.
- 실제 배포 전 PostgreSQL 트랜잭션, 백그라운드 작업자, 분산 잠금이 필요하다.
- 기존 포인트·리워드·밸런스게임 API 일부는 호환을 위해 코드에 남아 있으나 현재
  SUNIVERSITY 설문 교환 제품 범위가 아니며 새 화면에서 사용하지 않는다.
- Swagger의 스키마가 이 문서와 다르면 실행 중인 Swagger를 우선 확인한다.
