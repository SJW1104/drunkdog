# SUNIVERSITY JSON Mock API

데이터베이스 없이 프런트엔드와 앱 흐름을 먼저 검증하기 위한 FastAPI 백엔드입니다.
모든 데이터는 JSON 파일에 저장되며, 앱을 처음 실행하면 `data/seed.json`을 복사해
`data/runtime.json`을 만듭니다.

## 현재 구현 범위

- 개발용 전화번호 OTP 로그인과 학교 이메일 인증
- 검증된 더미 사용자 즉시 로그인
- 설문 임시저장, 수정, 삭제, 게시, 마감
- 설문 피드, 카테고리, 검색, 정렬, 진행률
- 단일·복수·주관식·숫자·척도·밸런스 문항
- 1인 1응답, 응답 검증, 결과 집계와 공개 권한
- 댓글·대댓글, 익명 표시, 좋아요, 신고
- 참여 포인트, 일일 한도, 유료 결과 70:30 배분
- 내 프로필, 내가 만든/참여한 설문, 레벨과 랭킹
- 출석 체크, 알림 읽음 처리, 관심사·대표 칭호 설정
- 설문 북마크와 저장 목록
- 기프티콘 상품 조회·포인트 교환·쿠폰 사용
- 밸런스게임 즉시 투표 결과와 팀별 토론
- Mock AI 설문 초안과 결과 분석
- Mock AI+PPT 결과 리포트
- 개발용 광고 보상과 AdMob 웹훅 중복 지급 방지
- 더미데이터 초기화

## 폴더 구조

```text
backend/
├─ app/
│  ├─ main.py          # FastAPI 앱 생성과 CORS
│  ├─ routes.py        # 인증·설문·결과·포인트 핵심 API
│  ├─ engagement_routes.py # 출석·알림·리워드·밸런스게임 API
│  ├─ domain.py        # 상태·보상·레벨 등 공통 도메인 규칙
│  ├─ schemas.py       # 요청·응답 Pydantic 모델
│  ├─ store.py         # JSON 읽기·원자적 쓰기
│  ├─ points.py        # 포인트 원장 규칙
│  ├─ security.py      # 개발 토큰과 인증 의존성
│  └─ ai_provider.py   # Mock/OpenAI 교체 지점
├─ data/
│  └─ seed.json        # Git으로 관리하는 원본 더미데이터
├─ tests/
│  └─ test_api.py
├─ API_SPEC.md
├─ FRONTEND_INTEGRATION.md
└─ pyproject.toml
```

`data/runtime.json`은 실행 중 자동 생성되며 Git에 포함되지 않습니다. 직접 내용을
고쳐도 다음 요청부터 반영됩니다.

## 실행

PowerShell에서:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 4000
```

실행 후:

- API 문서: `http://127.0.0.1:4000/docs`
- 상태 확인: `http://127.0.0.1:4000/api/v1/health`
- 프런트 API 기준 주소: `http://127.0.0.1:4000/api/v1`

JSON 저장은 로컬 개발용 단일 프로세스 구현입니다. Uvicorn의 `--workers` 옵션을
추가하지 마세요.

## 더미 사용자로 바로 로그인

```http
POST /api/v1/dev/login?user_id=demo-student
```

사용 가능한 ID:

| ID | 닉네임 | 역할 |
|---|---|---|
| `demo-author` | 설문요정 | 설문 작성자, 임시저장 보유 |
| `demo-student` | 세종캠퍼 | 여러 설문 참여자 |
| `demo-balance` | 밸런스장인 | 밸런스게임 작성자 |

응답의 `access_token`을 이후 요청의 헤더에 넣습니다.

```text
Authorization: Bearer <access_token>
```

Swagger의 `Authorize` 버튼에서도 토큰을 입력할 수 있습니다.

## 더미데이터 초기화

실행 중 바뀐 `runtime.json`을 다시 `seed.json` 상태로 되돌립니다.

```http
POST /api/v1/dev/reset
```

또는 서버를 끈 뒤 `data/runtime.json`만 삭제하고 다시 실행해도 됩니다.

## 주요 API

| 영역 | 메서드와 경로 |
|---|---|
| 개발 | `GET /dev/dummy-users`, `POST /dev/login`, `POST /dev/reset` |
| 인증 | `POST /auth/phone/request`, `POST /auth/phone/verify` |
| 학교 인증 | `GET /universities`, `POST /auth/university/request`, `POST /auth/university/verify` |
| 프로필 | `GET/PATCH /users/me`, `GET /users/me/profile`, `GET /users/me/surveys` |
| 사용자 설정 | `PATCH /users/me/preferences`, `GET /users/me/bookmarks` |
| 설문 | `POST/GET /surveys`, `GET/PATCH/DELETE /surveys/{id}` |
| 추가 참여 보상 | `GET /surveys/{id}/reward-boost/quote`, `POST /surveys/{id}/reward-boost/mock-purchase` |
| 설문 상태 | `POST /surveys/{id}/publish`, `POST /surveys/{id}/close` |
| 응답·결과 | `POST /surveys/{id}/responses`, `GET /surveys/{id}/results` |
| 커뮤니티 | `GET/POST /surveys/{id}/comments`, `POST /surveys/{id}/like` |
| 출석·알림 | `GET /attendance/today`, `POST /attendance/check-in`, `GET /notifications` |
| 북마크 | `POST/PUT/DELETE /surveys/{id}/bookmark` |
| 기프티콘 | `GET /rewards/products`, `POST /rewards/exchanges`, `GET /users/me/coupons` |
| 밸런스게임 | `GET /balance-games`, `POST /balance-games/{id}/vote`, 토론 API |
| 포인트 | `GET /wallet`, `GET /rankings` |
| AI | `POST /ai/survey-drafts`, `POST /ai/surveys/{id}/analysis` |
| 리포트 | `POST /surveys/{id}/reports/ppt`, `GET /mock-files/{report_id}` |
| 광고 | `POST /ads/rewarded/mock-complete`, `POST /integrations/admob/rewarded` |

전체 요청·응답 예시는 [API_SPEC.md](./API_SPEC.md)와 실행 중 생성되는 Swagger 문서를
참고하세요. 현재 프런트 구조에 맞춘 연결 순서와 변환 코드는
[FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)에 정리했습니다.

## 테스트

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest --basetemp=.pytest-work
```

테스트는 각각 독립된 임시 JSON 파일을 사용합니다.

현재 자동 테스트 16개가 로그인부터 설문 작성·참여·결과·포인트·출석·알림·북마크·
리워드·리포트·밸런스게임 흐름을 검증합니다.

## 현재 포인트 규칙

- 일반 설문 기본 보상은 문항 수와 같으며 최소 5P, 최대 40P입니다. 따라서 기본 4문항은 5P입니다.
- 작성자는 게시 전 `+10P` 단위로 참여 보상을 올릴 수 있으며, `+10P`마다 설문 한 건 기준 1,000원을 결제합니다.
- 클라이언트가 `reward_points`를 직접 지정할 수 없고, 개발 환경에서는 Mock 결제 API가 결제 완료와 보상 증액을 원자적으로 기록합니다.
- 마감까지 24시간 이하인 설문은 무료 기본 보상만 1.5배로 계산하며 소수점은 버립니다. 결제한 추가 보상은 정확한 금액 그대로 더합니다.
- 일반 보상은 한국 시간 기준 하루 최대 1,000P입니다.
- 밸런스게임 투표는 2P, 출석은 5P, 광고 보상은 10P입니다.
- AI 결과 분석은 200P, Mock AI+PPT 리포트는 400P입니다.
- 유료 결과 구매액은 작성자 70%, 플랫폼 30% 규칙으로 처리합니다.

## 환경변수

`.env.example`의 항목을 필요에 따라 셸 또는 실행 환경에 설정합니다.

```env
ENVIRONMENT=development
JSON_DATA_PATH=data/runtime.json
JSON_SEED_PATH=data/seed.json
TOKEN_SECRET=replace-with-a-long-random-secret
WEBHOOK_SECRET=replace-with-a-different-random-secret
AI_MODE=mock
```

현재 설정 로더는 OS 환경변수를 읽습니다. `.env` 파일을 자동으로 읽게 하려면 실행 명령에
`--env-file .env`를 추가하세요.

## 나중에 실제 DB로 바꿀 때

현재 HTTP 계약과 Pydantic 모델은 그대로 두고 `JsonStore`를 PostgreSQL 저장소
구현으로 교체하면 됩니다. 실제 배포 전에는 다음 항목도 필요합니다.

- 실제 SMS·학교 이메일 발송
- JWT/OAuth 기반 인증과 비밀키 관리
- PostgreSQL 트랜잭션과 마이그레이션
- Redis 기반 속도 제한과 작업 큐
- AdMob 서명 및 앱 결제 영수증 검증
- 관리자 신고 심사와 개인정보 보관·파기 정책
- 운영 도메인으로 제한된 CORS
