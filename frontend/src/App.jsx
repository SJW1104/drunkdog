/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import './App.css'

const friends = ['지훈', '민수', '예린']

const onboardingSlides = [
  {
    eyebrow: 'WELCOME TO DRUNKDOG',
    title: '기억하지 못해도\n괜찮은 밤.',
    description: 'DrunkDog이 오늘 밤의 작은 단서들을 모아\n내일의 기억으로 돌려드릴게요.',
    visual: 'memory',
  },
  {
    eyebrow: 'JUST ONE TAP',
    title: '술자리는 즐기고,\n기록은 맡겨두세요.',
    description: '위치와 시간은 자동으로 기록하고\n가끔 짧고 쉬운 기억 미션만 보내드려요.',
    visual: 'orbit',
  },
  {
    eyebrow: 'SAFE & PRIVATE',
    title: '필요한 권한만\n안전하게 사용할게요.',
    description: '위치, 알림, 카메라와 마이크는\n기억 복원과 안전 기능에만 사용해요.',
    visual: 'shield',
  },
]

function Icon({ children }) {
  return <span className="icon" aria-hidden="true">{children}</span>
}

function Header({ onBack, onSettings, dark = false, title }) {
  return (
    <header className={`app-header ${dark ? 'app-header--dark' : ''}`}>
      {onBack ? <button className="icon-button" onClick={onBack} aria-label="뒤로 가기">←</button> : <span className="header-spacer" aria-hidden="true" />}
      {title && <strong>{title}</strong>}
      {onSettings ? (
        <button className="icon-button" onClick={onSettings} aria-label="설정">⚙</button>
      ) : <span className="header-spacer" aria-hidden="true" />}
    </header>
  )
}

function Onboarding({ go }) {
  const [step, setStep] = useState(0)
  const slide = onboardingSlides[step]
  const isLast = step === onboardingSlides.length - 1

  return (
    <section className="screen screen--dark onboarding-screen">
      <div className="onboarding-top">
        <span className="wordmark">DRUNKDOG</span>
        {!isLast && <button onClick={() => go('home')}>건너뛰기</button>}
      </div>
      <div className={`onboarding-visual onboarding-visual--${slide.visual}`} aria-hidden="true">
        <div className="visual-core">{step === 0 ? '✦' : step === 1 ? '●' : '✓'}</div>
        <i /><i /><i />
      </div>
      <div className="onboarding-copy">
        <p className="kicker">{slide.eyebrow}</p>
        <h1>{slide.title.split('\n').map((line) => <span key={line}>{line}</span>)}</h1>
        <p>{slide.description.split('\n').map((line) => <span key={line}>{line}</span>)}</p>
      </div>
      {isLast && (
        <div className="permission-preview">
          <span>⌖ 위치</span><span>♧ 알림</span><span>▣ 카메라</span><span>◉ 마이크</span>
        </div>
      )}
      <div className="onboarding-footer">
        <div className="page-dots" aria-label={`${step + 1} / ${onboardingSlides.length}`}>
          {onboardingSlides.map((item, index) => <i className={index === step ? 'active' : ''} key={item.eyebrow} />)}
        </div>
        <button className="primary-button" onClick={() => isLast ? go('home') : setStep(step + 1)}>
          {isLast ? '시작하기' : '다음'}
        </button>
      </div>
    </section>
  )
}

function Home({ go }) {
  return (
    <section className="screen screen--dark home-screen">
      <Header dark onSettings={() => go('settings')} />
      <div className="home-scroll">
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
      </div>
      <BottomNav current="home" go={go} />
    </section>
  )
}

const pastRecords = [
  { date: '05.21 화', place: '강남역 · 신논현', time: '19:32 — 01:24', friends: '지훈, 민수, 예린', score: '8/10' },
  { date: '05.11 토', place: '성수동 · 서울숲', time: '18:40 — 23:56', friends: '민수, 수빈', score: '7/10' },
  { date: '04.27 토', place: '을지로3가', time: '20:15 — 02:08', friends: '지훈, 예린', score: '6/10' },
]

function Records({ go }) {
  return (
    <section className="screen tab-screen">
      <Header title="지난 기록" onSettings={() => go('settings')} />
      <div className="screen-body tab-body">
        <div className="records-heading"><div><p className="step-label">MY NIGHTS</p><h2>지나간 술자리를<br />모아봤어요.</h2></div></div>
        <div className="month-row"><strong>2024년 5월</strong><span>3개의 기록</span></div>
        <div className="record-list">
          {pastRecords.map((record, index) => (
            <button className="record-item" onClick={() => index === 0 && go('summary')} key={record.date}>
              <span className="record-date">{record.date}</span>
              <span className="record-copy"><strong>{record.place}</strong><small>{record.time} · {record.friends}</small></span>
              <span className="record-score">{record.score}<b>›</b></span>
            </button>
          ))}
        </div>
      </div>
      <BottomNav current="records" go={go} />
    </section>
  )
}

function ChatbotHub({ go }) {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const send = (event) => {
    event.preventDefault()
    if (!message.trim()) return
    setMessages([...messages, message.trim()])
    setMessage('')
  }
  return (
    <section className="screen tab-screen chatbot-hub">
      <Header title="AI 기억 챗봇" onSettings={() => go('settings')} />
      <div className="chatbot-scroll">
        <p className="section-caption">직전 술자리 리포트</p>
        <button className="latest-report" onClick={() => go('summary')}>
          <span><small>2024.05.21 화</small><strong>강남역에서 보낸 5시간 52분</strong><b>사진 18장 · 음성 6개 · 친구 3명</b></span><em>8<small>/10</small></em>
        </button>
        <div className="ai-row"><span className="ai-avatar">✦</span><p>직전 술자리 기록을 정리해두었어요. 궁금한 순간이나 기억나지 않는 일을 물어보세요.</p></div>
        <div className="suggestions chatbot-suggestions"><button onClick={() => setMessage('마지막 장소가 어디였어?')}>마지막 장소</button><button onClick={() => setMessage('누구와 함께 있었어?')}>함께한 사람</button><button onClick={() => setMessage('어제 기록을 요약해줘')}>기록 요약</button></div>
        {messages.map((item, index) => <div className="user-message" key={`${item}-${index}`}>{item}</div>)}
      </div>
      <form className="chat-input chatbot-input" onSubmit={send}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="어제의 기억을 물어보세요" aria-label="챗봇 메시지 입력" /><button aria-label="전송">↑</button></form>
      <BottomNav current="chatbot" go={go} />
    </section>
  )
}

function Setup({ go, showPreDrink }) {
  const [tracking, setTracking] = useState(true)
  const [missions, setMissions] = useState(true)
  const [soundMode, setSoundMode] = useState(true)
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
          <button className="setting-row" onClick={() => go('emergencyContactSetup')}><span>긴급 연락처</span><strong>민수 · 010-1234-5678 ›</strong></button>
          <label className="setting-row"><span>위치 추적</span><input type="checkbox" checked={tracking} onChange={() => setTracking(!tracking)} /></label>
          <label className="setting-row"><span>기억 미션</span><input type="checkbox" checked={missions} onChange={() => setMissions(!missions)} /></label>
          <button className="setting-row setting-row--detail" onClick={() => go('missionSettings')} disabled={!missions}><span>미션 상세 설정</span><strong>더보기 ›</strong></button>
          <label className="setting-row"><span>소리 모드</span><input type="checkbox" checked={soundMode} onChange={() => setSoundMode(!soundMode)} /></label>
        </div>
      </div>
      <button className="primary-button bottom-action" onClick={() => go(showPreDrink ? 'preDrink' : 'active')}>술자리 시작하기</button>
    </section>
  )
}

function BottomNav({ current, go }) {
  const tabs = [
    { id: 'home', icon: '⌂', label: '홈' },
    { id: 'records', icon: '▤', label: '기록' },
    { id: 'chatbot', icon: '✦', label: '챗봇' },
  ]
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {tabs.map((tab) => <button className={current === tab.id ? 'active' : ''} onClick={() => go(tab.id)} key={tab.id}><span>{tab.icon}</span><small>{tab.label}</small></button>)}
    </nav>
  )
}

function MissionSettings({ go, backTo }) {
  const [photo, setPhoto] = useState(true)
  const [voice, setVoice] = useState(true)
  const [condition, setCondition] = useState(true)
  return (
    <section className="screen">
      <Header title="미션 상세 설정" onBack={() => go(backTo)} />
      <div className="screen-body settings-page-body">
        <p className="section-caption">기억 미션 종류</p>
        <div className="settings-card">
          <label className="setting-row"><span><b>사진 미션</b><small>지금 이 순간의 사진 남기기</small></span><input type="checkbox" checked={photo} onChange={() => setPhoto(!photo)} /></label>
          <label className="setting-row"><span><b>음성 다이어리</b><small>5초 동안 오늘의 한마디 녹음</small></span><input type="checkbox" checked={voice} onChange={() => setVoice(!voice)} /></label>
          <label className="setting-row"><span><b>컨디션 체크</b><small>현재 취기와 상태 확인</small></span><input type="checkbox" checked={condition} onChange={() => setCondition(!condition)} /></label>
        </div>
        <p className="section-caption">미션 알림</p>
        <div className="settings-card">
          <button className="setting-row"><span>미션 간격</span><strong>60분 ›</strong></button>
          <button className="setting-row"><span>시작 시간</span><strong>음주 시작 30분 후 ›</strong></button>
        </div>
      </div>
      <button className="primary-button bottom-action" onClick={() => go(backTo)}>설정 완료</button>
    </section>
  )
}

function EmergencyContact({ go, backTo }) {
  const [name, setName] = useState('민수')
  const [phone, setPhone] = useState('010-1234-5678')
  const [shareLocation, setShareLocation] = useState(true)
  return (
    <section className="screen">
      <Header title="긴급 연락처" onBack={() => go(backTo)} />
      <div className="screen-body contact-body">
        <p className="step-label">EMERGENCY CONTACT</p>
        <h2>도움이 필요할 때<br />연락할 사람을 적어주세요.</h2>
        <div className="contact-form">
          <label><span>이름</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="이름 입력" /></label>
          <label><span>전화번호</span><input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="010-0000-0000" /></label>
        </div>
        <div className="settings-card contact-options">
          <label className="setting-row"><span><b>위치 함께 보내기</b><small>긴급 연락 시 현재 위치를 공유해요</small></span><input type="checkbox" checked={shareLocation} onChange={() => setShareLocation(!shareLocation)} /></label>
        </div>
      </div>
      <button className="primary-button bottom-action" onClick={() => go(backTo)}>연락처 저장</button>
    </section>
  )
}

const defaultReminders = [
  '술 마실 때 물 최대한 많이 마시기',
  '술 한 잔, 물 한 잔!',
  '취해서 연락은 절대 NO! 전화나 연락하지 않기',
  '오늘 밤은 흑역사 생성 금지! 감정이 격해지면 앱을 켜고 심호흡하기',
  '오늘의 음주 한계치를 기억하고 알림이 울리면 솔직하게 컨디션 체크하기',
  '얼마나 마셨는지, 지금 몇 시고 어디서 누구와 있는지 억지로라도 상기하기',
]

function PreDrink({ go, customReminder }) {
  const reminders = customReminder.trim() ? [...defaultReminders, customReminder.trim()] : defaultReminders
  return (
    <section className="screen predrink-screen">
      <div className="predrink-card">
        <span className="predrink-icon">!</span>
        <p className="step-label">시작하기 전에</p>
        <h2>오늘 밤,<br />이것만은 기억해요.</h2>
        <div className="reminder-list">
          {reminders.map((item) => <p key={item}><i>✓</i><span>{item}</span></p>)}
        </div>
        <div className="predrink-actions">
          <button className="secondary-button" onClick={() => go('setup')}>돌아가기</button>
          <button className="primary-button" onClick={() => go('active')}>기억하고 시작</button>
        </div>
      </div>
    </section>
  )
}

function Settings({ go, customReminder, setCustomReminder, showPreDrink, setShowPreDrink }) {
  const [notifications, setNotifications] = useState(true)
  const [sound, setSound] = useState(true)
  const [vibration, setVibration] = useState(true)
  return (
    <section className="screen">
      <Header title="설정" onBack={() => go('home')} />
      <div className="screen-body settings-page-body">
        <p className="section-caption">계정 및 안전</p>
        <div className="settings-card">
          <button className="setting-row"><span>프로필</span><strong>내 정보 ›</strong></button>
          <button className="setting-row" onClick={() => go('emergencyContactSettings')}><span>긴급 연락처 관리</span><strong>1명 ›</strong></button>
          <button className="setting-row"><span>앱 알림 권한</span><strong>허용됨 ›</strong></button>
          <button className="setting-row"><span>버전 정보</span><strong>v1.0.0 ›</strong></button>
        </div>
        <p className="section-caption">음주 모드</p>
        <div className="settings-card">
          <label className="setting-row"><span><b>시작 전 기억사항</b><small>음주 모드 시작 전에 안내 표시</small></span><input type="checkbox" checked={showPreDrink} onChange={() => setShowPreDrink(!showPreDrink)} /></label>
          <label className="reminder-editor">
            <span>직접 추가할 기억사항</span>
            <textarea value={customReminder} maxLength={100} onChange={(event) => setCustomReminder(event.target.value)} placeholder="나에게 필요한 기억사항을 적어주세요" />
            <small>{customReminder.length}/100</small>
          </label>
        </div>
        <p className="section-caption">알림 및 미션 커스텀 설정</p>
        <div className="settings-card">
          <label className="setting-row"><span>알림 사용</span><input type="checkbox" checked={notifications} onChange={() => setNotifications(!notifications)} /></label>
          <button className="setting-row" onClick={() => go('missionSettingsFromSettings')}><span>기억 미션 설정</span><strong>상세 설정 ›</strong></button>
        </div>
        <p className="section-caption">알림음 및 진동</p>
        <div className="settings-card">
          <label className="setting-row"><span>알림음</span><input type="checkbox" checked={sound} onChange={() => setSound(!sound)} /></label>
          <label className="setting-row"><span>진동</span><input type="checkbox" checked={vibration} onChange={() => setVibration(!vibration)} /></label>
        </div>
        <p className="section-caption">데이터 및 앱</p>
        <div className="settings-card">
          <button className="setting-row"><span>프라이버시 및 데이터 관리</span><strong>›</strong></button>
          <button className="setting-row"><span>앱 환경 설정</span><strong>›</strong></button>
        </div>
      </div>
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
      <div className="recording-status"><span className="live-dot" /> 위치 기록 중</div>
      <div className="timer">{time}</div>
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
  const [screen, setScreen] = useState('onboarding')
  const [customReminder, setCustomReminder] = useState('')
  const [showPreDrink, setShowPreDrink] = useState(true)
  const screens = { onboarding: Onboarding, home: Home, records: Records, chatbot: ChatbotHub, setup: Setup, missionSettings: MissionSettings, missionSettingsFromSettings: MissionSettings, emergencyContactSetup: EmergencyContact, emergencyContactSettings: EmergencyContact, preDrink: PreDrink, settings: Settings, active: Active, mission: Mission, safety: Safety, summary: Summary, chat: Chat }
  const CurrentScreen = screens[screen]
  return (
    <main className="app-shell">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />
      <div className="phone-frame">
        <div className="phone-speaker" />
        <CurrentScreen
          go={setScreen}
          customReminder={customReminder}
          setCustomReminder={setCustomReminder}
          showPreDrink={showPreDrink}
          setShowPreDrink={setShowPreDrink}
          backTo={screen === 'missionSettingsFromSettings' || screen === 'emergencyContactSettings' ? 'settings' : 'setup'}
        />
      </div>
      <p className="prototype-note">모바일 프로토타입 · 화면의 버튼을 눌러 흐름을 확인하세요</p>
    </main>
  )
}

export default App
