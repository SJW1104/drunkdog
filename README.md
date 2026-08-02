# SUNIVERSITY

SUNIVERSITY는 대학생이 설문을 만들고 서로의 설문에 참여하며 응답을 교환할 수 있는 AI 기반 설문 커뮤니티입니다. 설문 작성, 응답, 결과 분석, 개인·팀 교환과 자동 매칭을 하나의 모바일 웹 환경에서 제공합니다.

## 주요 기능

- 대학생 인증 기반 사용자 관리
- 다양한 문항 유형을 지원하는 설문 작성·게시
- 설문 검색, 참여, 응답 진행률 및 결과 확인
- 개인·팀 단위 직접 교환과 자동 매칭
- 작성자용 응답 요약, 개별 응답표 및 CSV 다운로드
- AI 설문 초안, 문항 다듬기 및 결과 분석
- 알림, 프로필, 신뢰도, 북마크, 좋아요와 댓글

## 기술 스택

- Frontend: React 18, Vite 5, Axios
- Backend: Python 3.11+, FastAPI, Uvicorn, Pydantic
- Storage: JSON 기반 MVP 저장소
- Test: Pytest, ESLint, Vite production build

## 프로젝트 구조

```text
drunkdog/
├─ frontend/            # React + Vite 모바일 웹
├─ backend/             # FastAPI 서버와 테스트
│  ├─ app/
│  ├─ data/
│  └─ tests/
└─ README.md
```

## 1. 클린 설치 요구사항

아래 도구를 먼저 설치합니다.

| 도구 | 권장 버전 | 확인 명령어 |
|---|---:|---|
| Git | 2.40 이상 | `git --version` |
| Node.js | 20 LTS 이상 | `node --version` |
| npm | 10 이상 | `npm --version` |
| Python | 3.11 이상 | `python --version` 또는 `py --version` |

### 런타임과 도구 설치

Windows 10/11에서는 PowerShell을 관리자 권한으로 열고 `winget`으로 설치할 수 있습니다.

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Python.Python.3.11 -e
```

macOS에서 Homebrew를 사용하는 경우 다음 명령으로 설치합니다.

```bash
brew install git node@20 python@3.11
```

직접 설치하려면 각 공식 다운로드 페이지를 사용합니다.

- Git: https://git-scm.com/downloads
- Node.js LTS: https://nodejs.org/en/download
- Python 3.11+: https://www.python.org/downloads/

설치 후 터미널을 새로 열고 위 표의 확인 명령어로 버전을 확인합니다.

저장소를 복제합니다.

```bash
git clone https://github.com/SJW1104/drunkdog.git
cd drunkdog
```

백엔드와 프론트엔드는 각각 별도 터미널에서 실행합니다. 백엔드를 먼저 실행하는 것을 권장합니다.

## 2. 백엔드 설치 및 실행

### Windows PowerShell

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 4000
```

### macOS 또는 Linux

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 4000
```

정상 실행 여부를 확인합니다.

- API 상태: http://127.0.0.1:4000/api/v1/health
- Swagger 문서: http://127.0.0.1:4000/docs

개발 환경에서는 별도의 실제 회원가입 없이 다음 API로 테스트 계정 토큰을 발급할 수 있습니다.

```http
POST http://127.0.0.1:4000/api/v1/dev/login?user_id=demo-author
```

기본 테스트 계정은 `demo-author`, `demo-student`, `demo-balance`입니다. 프론트엔드는 개발 환경에서 테스트 세션을 자동으로 준비합니다.

## 3. 프론트엔드 설치 및 실행

새 터미널을 열고 저장소 루트에서 실행합니다.

### Windows PowerShell

```powershell
cd frontend
Copy-Item .env.example .env
npm ci
npm run dev
```

### macOS 또는 Linux

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

브라우저에서 http://127.0.0.1:5173 을 엽니다.

`frontend/.env`의 기본 API 주소는 다음과 같아야 합니다.

```env
VITE_API_BASE_URL=http://127.0.0.1:4000/api/v1
```

API 주소를 변경했다면 프론트엔드 개발 서버를 다시 시작해야 합니다.

## 4. 컴파일 및 프로덕션 빌드

### 프론트엔드

```bash
cd frontend
npm ci
npm run lint
npm run build
npm run preview -- --host 127.0.0.1
```

- 빌드 결과물: `frontend/dist/`
- 미리보기 기본 주소: http://127.0.0.1:4173

### 백엔드

FastAPI 백엔드는 별도의 번들 생성 과정이 필요하지 않습니다. 설치 및 문법 컴파일 검사는 다음과 같이 수행합니다.

Windows PowerShell:

```powershell
cd backend
.\.venv\Scripts\python.exe -m compileall app
```

macOS 또는 Linux:

```bash
cd backend
source .venv/bin/activate
python -m compileall app
```

## 5. 테스트

### 백엔드 테스트

Windows PowerShell:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest --basetemp=.pytest-work
```

macOS 또는 Linux:

```bash
cd backend
source .venv/bin/activate
python -m pytest --basetemp=.pytest-work
```

### 프론트엔드 검증

```bash
cd frontend
npm ci
npm run lint
npm run build
```

## 6. 선택 환경변수

AI 기능은 기본적으로 Mock 모드로 실행되므로 API 키 없이도 전체 화면과 흐름을 테스트할 수 있습니다. 실제 OpenAI API를 사용하려면 백엔드 실행 전에 다음 환경변수를 설정합니다.

```env
AI_MODE=openai
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-5.6-luna
```

API 키나 실제 `.env` 파일은 Git에 커밋하지 않습니다.

## 7. 실행 순서 요약

1. 저장소 클론
2. `backend` 가상환경 생성 및 의존성 설치
3. 백엔드를 `4000` 포트로 실행
4. `frontend/.env.example`을 `frontend/.env`로 복사
5. 프론트엔드에서 `npm ci` 실행
6. 프론트엔드를 `5173` 포트로 실행
7. 브라우저에서 앱 확인

## 문제 해결

### 화면에 오프라인 미리보기가 표시되는 경우

1. http://127.0.0.1:4000/api/v1/health 가 정상 응답하는지 확인합니다.
2. `frontend/.env`의 `VITE_API_BASE_URL`을 확인합니다.
3. 백엔드를 먼저 실행한 뒤 프론트엔드를 다시 시작합니다.
4. 이전 개발 토큰이 만료된 경우 브라우저를 새로고침합니다.

### `npm ci`가 실패하는 경우

Node.js 20 LTS 이상인지 확인하고 `frontend` 디렉터리에서 명령을 실행했는지 확인합니다.

### Python 명령어를 찾을 수 없는 경우

Windows에서는 `python` 대신 `py -3.11`을 사용하고, macOS/Linux에서는 `python3.11` 설치 여부를 확인합니다.

## 관련 문서

- 백엔드 API 명세: [`backend/API_SPEC.md`](backend/API_SPEC.md)
- 프론트엔드 연동 가이드: [`backend/FRONTEND_INTEGRATION.md`](backend/FRONTEND_INTEGRATION.md)
- 백엔드 상세 설명: [`backend/README.md`](backend/README.md)
