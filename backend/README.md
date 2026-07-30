# SUNIVERSITY JSON MVP 백엔드

대학생 연구 설문을 앱 안에서 만들고, 개인 또는 팀 단위로 설문 응답을 교환하는
FastAPI 백엔드다. 아직 데이터베이스 없이 JSON 파일로 동작한다.

## 현재 구현 범위

- 휴대전화 로그인과 대학교 이메일 인증
- 11종 설문 문항, 0문항 초안, 게시·마감·수정 잠금
- 개인↔개인, 팀↔팀 직접 교환과 자동 매칭
- 5문항 단위 구간, 카테고리 추천, 필수 응답자 조건
- 신청자 선응답, 상대 수락·응답 후 양쪽 결과 동시 반영
- 팀별 비대칭 필수 응답 수와 전원 완료 방식
- D-24 자동 만료, 수동 취소, 조기 마감·팀원 부족 정리
- 보류(`held`)·반영(`included`)·제외(`excluded`) 응답 분리
- 신뢰도 기반 자동 매칭, 목표 응답 수까지 자동 반복
- 외부 공개 링크, 결과 통계·응답표·CSV
- AI 질문 다듬기(mock 또는 외부 공급자)

## 실행

PowerShell:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 4000
```

- API: `http://127.0.0.1:4000/api/v1`
- Swagger: `http://127.0.0.1:4000/docs`
- 상태 확인: `http://127.0.0.1:4000/api/v1/health`

개발용 로그인:

```http
POST /api/v1/dev/login?user_id=demo-author
```

응답의 토큰을 요청 헤더에 넣는다.

```text
Authorization: Bearer <access_token>
```

기본 개발 사용자 ID는 `demo-author`, `demo-student`, `demo-balance`다.

## 테스트

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest --basetemp=.pytest-work
```

현재 42개 테스트가 인증, 문항별 응답 검증, 설문, 결과 통계, 팀 관리, 교환,
취소·만료·자동 재매칭 예외를 검증한다.

## 주요 파일

```text
backend/
├─ app/
│  ├─ main.py                 FastAPI 앱
│  ├─ routes.py               인증·설문 기본 API
│  ├─ exchange_routes.py      팀·직접 교환·자동 매칭
│  ├─ exchange_domain.py      문항 구간·신뢰도·교환 계산
│  ├─ research_routes.py      공개 링크·결과·AI 다듬기
│  ├─ response_validation.py  문항별 응답 검증
│  ├─ schemas.py              Pydantic 요청 모델
│  └─ store.py                JSON 저장소
├─ data/
│  └─ seed.json
├─ tests/
├─ API_SPEC.md
└─ FRONTEND_INTEGRATION.md
```

`data/runtime.json`은 첫 실행 때 생성되며 Git에 포함하지 않는다. JSON 저장소는 한
프로세스용이므로 Uvicorn의 `--workers` 옵션을 사용하지 않는다.

## 문서

- [API_SPEC.md](./API_SPEC.md): 현재 기능과 요청 규칙
- [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md): 클라이언트 연결 순서
- Swagger: 실행 코드에서 생성되는 전체 요청·응답 스키마

기존 포인트·리워드·밸런스게임 코드는 과거 기획 호환용으로 일부 남아 있다. 현재 제품
개발의 기준은 설문 제작·교환·연구 결과 API다.
