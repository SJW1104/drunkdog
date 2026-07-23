# SUNIVERSITY API

기획안의 핵심 기능을 실제로 호출해 볼 수 있도록 만든 MVP 백엔드입니다.

포함된 기능:

- 전화번호 OTP 회원가입과 토큰 인증
- 학교 이메일 인증 및 최초 2,500P 지급
- 설문 작성, 게시, 마감, 피드, 진행률
- 단일·복수·주관식·숫자·척도·밸런스 문항
- 1인 1응답 검증, 실시간 집계, 결과 공개 권한
- 댓글·대댓글, 익명 표시, 좋아요, 신고
- 포인트 원장, 일일 획득 한도, 유료 결과 열람 70:30 배분
- AI 설문 초안과 AI 심층 분석
- 리워드 광고 웹훅의 중복 지급 방지
- Swagger/OpenAPI 문서

## 실행

Python 3.11 이상이 필요합니다.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
python -m uvicorn app.main:app --reload
```

실행 후 다음 주소를 엽니다.

- API 문서: `http://127.0.0.1:8000/docs`
- 상태 확인: `http://127.0.0.1:8000/api/v1/health`

테스트:

```powershell
python -m pytest
```

## 개발 모드 인증

개발 모드에서는 실제 문자·이메일을 보내지 않고 OTP 요청 응답의 `dev_code`에 인증번호를
포함합니다. 운영 환경에서는 이 부분을 네이버클라우드 SENS와 이메일 발송 서비스 어댑터로
교체해야 합니다.

기본 학교 데이터는 `고려대학교 세종캠퍼스 / korea.ac.kr` 한 건입니다. 다른 학교를 열려면
`universities` 테이블에 학교명과 허용 이메일 도메인을 추가합니다.

## AI 연결

기본값 `AI_MODE=mock`에서는 비용 없이 고정 규칙으로 설문 초안과 분석을 만듭니다.
OpenAI API를 연결하려면 `.env.example`을 참고하여 환경변수를 설정합니다.

```text
AI_MODE=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
```

외부 모델에는 전화번호, 학교 이메일, 사용자 ID를 보내지 않습니다. 결과 분석 API도 개별
사용자 정보가 아니라 서버에서 계산한 집계값만 전달합니다.

## 주요 엔드포인트

| 영역 | 메서드와 경로 |
|---|---|
| 전화 인증 | `POST /api/v1/auth/phone/request`, `POST /api/v1/auth/phone/verify` |
| 학교 인증 | `POST /api/v1/auth/university/request`, `POST /api/v1/auth/university/verify` |
| 설문 | `POST /api/v1/surveys`, `GET /api/v1/surveys`, `POST /api/v1/surveys/{id}/publish` |
| 응답 | `POST /api/v1/surveys/{id}/responses`, `GET /api/v1/surveys/{id}/results` |
| 결과 판매 | `POST /api/v1/surveys/{id}/results/purchase` |
| 커뮤니티 | `GET/POST /api/v1/surveys/{id}/comments`, `POST /api/v1/surveys/{id}/like` |
| 포인트 | `GET /api/v1/wallet` |
| AI | `POST /api/v1/ai/survey-drafts`, `POST /api/v1/ai/surveys/{id}/analysis` |
| 광고 웹훅 | `POST /api/v1/integrations/admob/rewarded` |

## 운영 전 필수 보강

- 개발용 OTP 반환 제거 및 SENS·이메일 어댑터 연결
- AdMob SSV의 Google ECDSA 서명 검증 추가
- StoreKit·Google Play 구매 영수증 서버 검증
- 포인트 출금 시 CI/DI 본인확인, 계좌 검증, 지급대행 계약
- PostgreSQL 전환, Redis 기반 속도 제한과 비동기 작업 큐
- 관리자 신고 심사 화면과 개인정보 보관·파기 정책
- 운영 도메인만 허용하는 CORS 설정

현재 광고 웹훅은 외부에 바로 노출하는 AdMob 원본 콜백이 아니라, 서명 검증 어댑터 뒤에서
호출하는 내부 엔드포인트입니다. 운영에서는 `X-Webhook-Secret`만으로 원본 AdMob 콜백을
검증하면 안 됩니다.

