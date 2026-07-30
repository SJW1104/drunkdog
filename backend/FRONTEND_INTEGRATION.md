# 백엔드 연동 가이드

이 문서는 프론트엔드 코드를 수정한 기록이 아니라, 현재 백엔드와 연결할 때 필요한
호출 순서를 정리한 계약서다.

## 1. 기본 설정

```ts
const API_BASE_URL = "http://127.0.0.1:4000/api/v1";
```

로그인 이후 요청:

```ts
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
};
```

개발 중에는 `POST /dev/login?user_id=demo-author`로 토큰을 받을 수 있다.

## 2. 설문 작성 화면

1. `POST /surveys`로 0문항 초안을 생성한다.
2. `PATCH /surveys/{id}`로 질문과 교환 설정을 저장한다.
3. `POST /ai/questions/rewrite` 결과에서 원본·수정본을 나란히 보여준다.
4. 작성자가 선택·재수정한 질문을 다시 설문에 저장한다.
5. `POST /surveys/{id}/publish`로 게시한다.

`effective_question_count`와 `question_bucket`은 서버 값을 사용한다. 특히 그리드 문항은
행 수로 계산하므로 클라이언트가 별도 계산하지 않는 것이 안전하다.

교환이 시작되어 `structure_locked_at`이 생기면 질문·선택지 구조 편집 UI를 잠근다.

### 문항별 답안 매핑

| 문항 유형 | 전송 필드 |
|---|---|
| 단답형·장문형 | `value_text` |
| 객관식·드롭다운·체크박스 | `option_ids` |
| 선형 척도 | `value_number` |
| 객관식·체크박스 그리드 | `grid_answers: {rowId: [columnId]}` |
| 날짜 | `value_date: "YYYY-MM-DD"` |
| 시간 | `value_time: "HH:MM"` |
| 파일 | `file_uploads` |

선형 척도는 정수만 보내고, 한 답안에 서로 다른 유형의 필드를 섞지 않는다. 파일은
먼저 실제 저장소에 업로드한 뒤 파일 이름, MIME, 바이트 크기, `storage_key` 또는
`url`을 `file_uploads`에 넣는다. 현재 백엔드는 파일 바이너리 업로드 API를 제공하지
않는다.

## 3. 직접 교환 화면

1. 내 설문을 선택한다.
2. `GET /exchanges/recommendations?survey_id={id}`로 추천 목록을 받는다.
3. 상대 설문을 작성한다.
4. 답안과 함께 `POST /exchanges/direct`를 호출한다.
5. 응답은 결과에 넣지 말고 “교환 결과 대기 중”으로 표시한다.

받은 신청:

1. `GET /exchanges?state=awaiting_acceptance`로 조회한다.
2. `POST /exchanges/{id}/accept`를 호출한다.
3. 상대 설문 응답 후 `POST /exchanges/{id}/responses`를 호출한다.
4. 응답의 `exchange_completed`가 `true`이면 결과 화면을 갱신한다.

거절은 `/reject`, 진행 중 취소는 `/cancel`을 사용한다.

## 4. 자동 매칭 화면

```http
POST /exchanges/auto/queue
Content-Type: application/json

{"survey_id": "survey-id"}
```

- `waiting`: 상대 탐색 중
- `matched`: 연결 완료, 바로 상대 설문 응답 가능

`GET /exchanges/auto/queue`는 활성 대기·매칭 항목만 반환한다. 자동 매칭에는 수락
버튼을 표시하지 않는다.

## 5. 교환 카드에서 사용할 필드

| 필드 | UI 의미 |
|---|---|
| `state` | 현재 교환 상태 |
| `mode` | `direct` 또는 `auto` |
| `scope` | `individual` 또는 `team` |
| `can_accept` | 수락 버튼 표시 여부 |
| `can_respond` | 설문 응답 버튼 표시 여부 |
| `my_response_submitted` | 내 응답 제출 여부 |
| `cutoff_at` | 교환 완료 기한 |
| `terminal_reason` | 취소·만료 안내 |

결과 수치를 낙관적으로 증가시키지 않는다. 서버가 `completed`를 반환한 뒤 결과 API를
다시 조회한다.

## 6. 결과 화면

- 그래프·통계: `GET /surveys/{id}/results`
- 작성자 응답표: `GET /surveys/{id}/responses/table`
- CSV: `GET /surveys/{id}/results.csv`
- 홈 요약: `GET /research/dashboard`

응답표의 `pending: true`는 교환 보류 응답이 있다는 뜻이다. 보류 응답 수나 진행도를
통계에 섞지 말고 “교환 완료 대기 중인 응답이 있습니다” 정도로만 표시한다.

작성자 화면만 응답자의 학교·학년·필수 조건 관련 프로필을 표시한다.

## 7. 외부 링크

1. 작성자가 `GET /surveys/{id}/share-link`로 URL/slug를 받는다.
2. 외부 사용자는 인증 없이 `GET /public/surveys/{slug}`로 설문을 연다.
3. `POST /public/surveys/{slug}/responses`로 응답한다.
4. 받은 `result_token`으로 `GET /public/results/{token}`을 호출한다.

외부 참여 화면에서는 로그인·대학교 인증을 요구하지 않는다.

## 8. 오류 처리

모든 오류는 기본적으로 `detail` 문자열을 표시할 수 있다.

| 코드 | 화면 처리 |
|---|---|
| `401` | 로그인 만료 처리 |
| `403` | 대학교 인증 또는 권한 안내 |
| `404` | 삭제·접근 불가 안내 후 목록으로 이동 |
| `409` | 마감, 중복 신청, 10건 제한, 목표 응답 완료 등 상태 메시지 |
| `422` | 질문별 입력 오류 표시 |

교환 목록이나 대시보드를 조회하면 서버가 만료·조기 마감·팀원 부족 상태를 자동
정리한다. 필요하면 앱 재진입 시 `POST /exchanges/reconcile`을 한 번 호출할 수 있다.

전체 필드 스키마와 최신 응답 예시는 실행 중인 Swagger(`/docs`)와
[API_SPEC.md](./API_SPEC.md)를 참고한다.
