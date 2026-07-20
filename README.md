# DrunkDog

음주 중 남겨진 위치·시간·사진·상태 응답 등의 단서를 바탕으로, 다음 날 AI가 전날의 기억을 대화형으로 복원하도록 돕는 해커톤 프로젝트입니다.

## 프로젝트 구조

```text
drunkdog/
├─ frontend/   # React + Vite 사용자 화면
├─ backend/    # API 서버 작업 영역
└─ ai/         # 기억 복원 AI 작업 영역
```

`isoha82/news` 저장소처럼 역할별 디렉터리를 분리하는 모노레포 형식을 사용합니다. 현재 구성은 기능 구현 전 기본 개발 환경만 포함합니다.

## 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

기본 개발 서버는 `http://localhost:5173`에서 실행됩니다.

## 프론트엔드 스크립트

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## 환경 변수

`frontend/.env.example`을 복사해 `frontend/.env`를 만든 뒤 API 주소를 설정합니다.

```env
VITE_API_BASE_URL=http://localhost:4000
```

## 브랜치 권장 규칙

- `main`: 안정 버전
- `develop`: 통합 개발
- `front/*`: 프론트엔드 기능
- `back/*`: 백엔드 기능
- `ai/*`: AI 기능

## 현재 범위

- React 18 + Vite 5 프론트엔드 초기화
- ESLint 기본 설정
- Axios API 클라이언트 기본 파일
- frontend / backend / ai 역할 디렉터리 분리
- 실제 음주 모드, 기록 수집, AI 상담 기능은 아직 구현하지 않음
