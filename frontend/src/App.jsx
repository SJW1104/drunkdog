/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import './App.css'

const friends = ['지훈', '민수', '예린']

function Icon({ children }) {
  return <span className="icon" aria-hidden="true">{children}</span>
}

function Header({ onBack, dark = false, title }) {
  return (
    <header className={`app-header ${dark ? 'app-header--dark' : ''}`}>
      <button className="icon-button" onClick={onBack} aria-label={onBack ? '뒤로 가기' : '메뉴'}>
        {onBack ? '←' : '☰'}
      </button>
      {title && <strong>{title}</strong>}
      <button className="icon-button" aria-label="설정">{title ? '•••' : '⚙'}</button>
    </header>
  )
}

function Home({ go }) {
  return (
    <section className="screen screen--dark home-screen">
      <Header dark />
      <div className="home-copy">
        <p className="kicker">DRUNKDOG</p>
        <h1>오늘의 밤을<br />기억해둘게요.</h1>
        <p>한 번만 켜두면 위치와 순간을 기록하고,<br />내일의 나에게 기억을 돌려줘요.</p>
      </div>
      <button className="start-orbit" onClick={() => go('setup')}>
        <span>술자리<br />시작</span>
        <small>탭해서 기록 시작</small>
      </button>
      <div className="recent-card">
        <div>
          <span className="muted">최근 기록</span>
          <strong>2024.05.21 (화)</strong>
          <small>⌖ 강남역 일대</small>
        </div>
        <button onClick={() => go('summary')}>기록 보기 →</button>
      </div>
    </section>
  )
}

function Setup({ go }) {
  const [tracking, setTracking] = useState(true)
  const [missions, setMissions] = useState(true)
  return (
    <section className="screen">
      <Header onBack={() => go('home')} />
      <div className="screen-body">
        <p className="step-label">시작 전 설정</p>
        <h2>오늘 밤,<br />누구와 함께하나요?</h2>
        <div className="friend-chips">
          {friends.map((friend) => <button className="chip" key={friend}>{friend} <span>×</span></button>)}
          <button className="chip chip--add" aria-label="친구 추가">＋</button>
        </div>
        <div className="settings-card">
          <button className="setting-row"><span>귀가 예정 시간</span><strong>오전 02:30 ›</strong></button>
          <button className="setting-row"><span>알림 주기</span><strong>30분 ›</strong></button>
          <label className="setting-row"><span>위치 추적</span><input type="checkbox" checked={tracking} onChange={() => setTracking(!tracking)} /></label>
          <label className="setting-row"><span>기억 미션</span><input type="checkbox" checked={missions} onChange={() => setMissions(!missions)} /></label>
        </div>
      </div>
      <button className="primary-button bottom-action" onClick={() => go('active')}>술자리 시작하기</button>
    </section>
  )
}

function Active({ go }) {
  const [seconds, setSeconds] = useState(5025)
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const time = new Date(seconds * 1000).toISOString().slice(11, 19)
  return (
    <section className="screen screen--dark active-screen">
      <Header dark />
      <div className="recording-status"><span className="live-dot" /> 안전하게 기록 중</div>
      <div className="timer">{time}</div>
      <p className="status-line"><span /> 기록 중</p>
      <div className="sobriety"><span>취기 수준</span><strong>4<small>/10</small></strong></div>
      <div className="active-friends"><span>함께하는 친구</span><div>{friends.map((friend) => <b key={friend}>{friend}</b>)}</div></div>
      <div className="quick-actions">
        <button onClick={() => go('mission')}><Icon>▣</Icon><span>사진 남기기</span></button>
        <button onClick={() => go('mission')}><Icon>◉</Icon><span>음성 메모</span></button>
      </div>
      <button className="text-button" onClick={() => go('safety')}>안전 · 귀가 지원</button>
    </section>
  )
}

function Mission({ go }) {
  const [level, setLevel] = useState(4)
  return (
    <section className="screen">
      <Header onBack={() => go('active')} />
      <div className="screen-body mission-body">
        <p className="step-label">기억 미션</p>
        <h2>지금 얼마나<br />취했나요?</h2>
        <div className="level-grid" aria-label={`취기 수준 ${level}`}>
          {Array.from({ length: 10 }, (_, index) => index + 1).map((number) => (
            <button className={level === number ? 'selected' : ''} onClick={() => setLevel(number)} key={number}>{number}</button>
          ))}
        </div>
        <div className="level-legend"><span>전혀 안 취함</span><span>매우 취함</span></div>
        <button className="mission-card"><Icon>▣</Icon><span><strong>사진 미션</strong><small>지금 이 순간을 남겨보세요</small></span><b>›</b></button>
        <button className="mission-card"><Icon>◉</Icon><span><strong>5초 음성 다이어리</strong><small>5초 동안 오늘의 한마디</small></span><b>›</b></button>
      </div>
      <button className="text-button bottom-skip" onClick={() => go('active')}>완료하고 돌아가기</button>
    </section>
  )
}

function Safety({ go }) {
  return (
    <section className="screen screen--dark safety-screen">
      <Header dark onBack={() => go('active')} />
      <div className="recording-pill"><span className="record-dot" /> 기록 중&nbsp; 01:23:45</div>
      <h2>안전하게<br />돌아가요.</h2>
      <div className="safety-actions">
        <button><Icon>⌂</Icon>집에 가기</button>
        <button><Icon>♙</Icon>친구 연락</button>
        <button><Icon>⌖</Icon>위치 공유</button>
      </div>
      <button className="danger-button" onClick={() => go('summary')}>기록 종료</button>
    </section>
  )
}

function Summary({ go }) {
  return (
    <section className="screen">
      <Header onBack={() => go('home')} />
      <div className="screen-body summary-body">
        <p className="step-label">GOOD MORNING</p>
        <h2>어제의 기록이<br />도착했어요.</h2>
        <p className="date">2024.05.21 (화) · 19:32 — 01:24</p>
        <div className="route-card">
          <div className="timeline">
            <div><b>1</b><span><strong>19:32 · 역삼역</strong><small>서울 강남구 테헤란로</small></span></div>
            <div><b>2</b><span><strong>21:07 · 신논현역</strong><small>서울 강남구 강남대로</small></span></div>
            <div><b>3</b><span><strong>23:41 · 논현역</strong><small>서울 강남구 학동로</small></span></div>
          </div>
          <div className="map-art"><i /><i /><i /></div>
        </div>
        <div className="summary-stats"><div><span>사진</span><strong>18<small>장</small></strong></div><div><span>음성 메모</span><strong>6<small>개</small></strong></div></div>
      </div>
      <button className="primary-button bottom-action" onClick={() => go('chat')}>AI와 기억 복원하기</button>
    </section>
  )
}

function Chat({ go }) {
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  return (
    <section className="screen chat-screen">
      <Header title="AI와 함께 기억 복원" onBack={() => go('summary')} />
      <div className="chat-body">
        <div className="ai-row"><span className="ai-avatar">✦</span><p>좋은 아침이에요. 어제의 기록을 모아봤어요. 기억이 어디부터 흐릿한가요?</p></div>
        <div className="clue-card"><div><Icon>⌖</Icon><span><strong>신논현역</strong><small>서울 강남구 강남대로</small></span></div><div className="mini-map"><i /></div></div>
        <div className="photo-clue"><span>어제 21:07에 남긴 사진 단서</span><div>DRUNK<br />DOG</div></div>
        <div className="ai-row"><span className="ai-avatar">✦</span><p>이 근처에서 무슨 일이 있었나요?</p></div>
        {sent && <div className="user-message">{message || '잘 모르겠어요'}</div>}
        <div className="suggestions"><button onClick={() => setMessage('기억나요')}>기억나요</button><button onClick={() => setMessage('잘 모르겠어요')}>잘 모르겠어요</button><button onClick={() => setMessage('장소를 수정할게요')}>장소 수정</button></div>
      </div>
      <form className="chat-input" onSubmit={(event) => { event.preventDefault(); setSent(true) }}>
        <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="메시지 입력" aria-label="메시지 입력" />
        <button aria-label="전송">↑</button>
      </form>
    </section>
  )
}

function App() {
  const [screen, setScreen] = useState('home')
  const screens = { home: Home, setup: Setup, active: Active, mission: Mission, safety: Safety, summary: Summary, chat: Chat }
  const CurrentScreen = screens[screen]
  return (
    <main className="app-shell">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />
      <div className="phone-frame">
        <div className="phone-speaker" />
        <CurrentScreen go={setScreen} />
      </div>
      <p className="prototype-note">모바일 프로토타입 · 화면의 버튼을 눌러 흐름을 확인하세요</p>
    </main>
  )
}

export default App
