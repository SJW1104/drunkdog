/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import './App.css'

const QUESTION_TYPES = [
  ['short', '단답형'],
  ['long', '장문형'],
  ['single', '객관식'],
  ['multiple', '체크박스'],
  ['dropdown', '드롭다운'],
  ['file', '파일 업로드'],
  ['scale', '선형 배율'],
  ['singleGrid', '객관식 그리드'],
  ['multipleGrid', '체크박스 그리드'],
  ['date', '날짜'],
  ['time', '시간'],
]

const CHOICE_TYPES = new Set(['single', 'multiple', 'dropdown'])
const GRID_TYPES = new Set(['singleGrid', 'multipleGrid'])

const initialSurveys = [
  {
    id: 'coffee',
    owner: '디자인씽킹 3팀',
    trust: 96,
    title: '대학생, 카페에서 얼마나 오래 머무르나요?',
    description: '대학생의 카페 이용 습관과 공간 선택 기준을 알아보는 설문이에요.',
    category: '대학생활',
    questionCount: 12,
    band: '11~15문항',
    minutes: 4,
    deadline: '2026-08-06',
    participants: 84,
    target: 120,
    matchScore: 94,
    hot: true,
    targetTags: ['재학생', '카페 이용자', '전국 대학'],
  },
  {
    id: 'career',
    owner: '커리어메이트',
    trust: 92,
    title: '취업 준비, 다들 언제부터 시작했어요?',
    description: '학년별 취업 준비 시기와 가장 필요한 지원을 조사해요.',
    category: '진로·취업',
    questionCount: 9,
    band: '6~10문항',
    minutes: 3,
    deadline: '2026-08-03',
    participants: 61,
    target: 100,
    matchScore: 88,
    hot: true,
    targetTags: ['3~4학년', '취업 준비생'],
  },
  {
    id: 'subscription',
    owner: '소비자행동 연구팀',
    trust: 89,
    title: '구독 서비스, 한 달에 얼마까지 괜찮나요?',
    description: '대학생의 구독 서비스 이용과 가격 민감도를 확인하는 설문이에요.',
    category: '소비',
    questionCount: 14,
    band: '11~15문항',
    minutes: 5,
    deadline: '2026-08-09',
    participants: 43,
    target: 100,
    matchScore: 86,
    hot: false,
    targetTags: ['구독 이용자', '대학생'],
  },
]

const initialRequests = [
  {
    id: 'exchange-incoming',
    type: '팀 교환',
    status: 'incoming',
    surveyId: 'subscription',
    title: '구독 서비스 이용과 가격 민감도 조사',
    partner: '소비자행동 연구팀',
    people: 3,
    ours: 0,
    theirs: 0,
    deadline: '8월 9일',
    deadlineISO: '2026-08-09',
  },
  {
    id: 'exchange-1',
    type: '팀 교환',
    status: 'waiting-me',
    surveyId: 'coffee',
    title: '대학생 카페 이용 패턴 조사',
    partner: '디자인씽킹 3팀',
    people: 3,
    ours: 1,
    theirs: 3,
    deadline: '8월 6일',
    deadlineISO: '2026-08-06',
  },
  {
    id: 'exchange-2',
    type: '개인 교환',
    status: 'waiting-partner',
    surveyId: 'career',
    title: '취업 준비 시작 시기 조사',
    partner: '커리어메이트',
    people: 1,
    ours: 1,
    theirs: 0,
    deadline: '8월 3일',
    deadlineISO: '2026-08-03',
  },
]

const initialNotifications = [
  { id: 1, type: 'exchange', title: '새로운 교환 신청이 도착했어요', body: 'UX리서치팀이 팀 교환을 신청했어요.', time: '방금 전', read: false },
  { id: 2, type: 'complete', title: '상대 팀이 응답을 완료했어요', body: '이제 우리 팀 응답만 완료하면 결과에 반영돼요.', time: '18분 전', read: false },
  { id: 3, type: 'deadline', title: '교환 자동 취소까지 6시간 남았어요', body: '마감 24시간 전까지 성사되지 않으면 자동 취소돼요.', time: '1시간 전', read: true },
]

const defaultProfile = {
  name: '나경님',
  university: '고려대학교 세종캠퍼스',
  major: '컴퓨터융합소프트웨어학과',
  studentId: '2024••••',
  grade: '3학년',
  gender: '여성',
  age: '22세',
  status: '재학',
  region: '세종특별자치시',
  housing: '자취',
  allowance: '40~60만원',
  partTime: '하고 있음',
  os: 'iPhone',
  mbti: 'ENFP',
  smoking: '비흡연',
  drinking: '가끔',
  exercise: '주 1~2회',
  license: '보유',
  car: '미보유',
  trust: 94,
  teamSize: 4,
}

const demoQuestions = [
  { id: 'q1', type: 'single', text: '평소 카페를 얼마나 자주 이용하시나요?', options: ['주 5회 이상', '주 3~4회', '주 1~2회', '월 2~3회', '거의 이용하지 않음'], required: true },
  { id: 'q2', type: 'multiple', text: '카페를 고를 때 중요하게 보는 건 무엇인가요?', options: ['가격', '좌석과 분위기', '음료 맛', '콘센트·와이파이', '접근성'], required: true },
  { id: 'q3', type: 'scale', text: '카페에서 공부하는 걸 얼마나 좋아하시나요?', min: 1, max: 5, minLabel: '전혀 아니에요', maxLabel: '정말 좋아해요', required: true },
  { id: 'q4', type: 'dropdown', text: '카페에 한 번 가면 보통 얼마나 머무르나요?', options: ['30분 미만', '30분~1시간', '1~2시간', '2~3시간', '3시간 이상'], required: true },
  { id: 'q5', type: 'long', text: '대학생에게 필요한 카페가 있다면 자유롭게 알려주세요.', required: false },
]

function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved ? JSON.parse(saved) : initialValue
    } catch {
      return initialValue
    }
  })
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])
  return [value, setValue]
}

function Icon({ name, size = 22 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  const paths = {
    home: <><path d="m3 11 9-7 9 7" /><path d="M5.5 10v10h13V10M9.5 20v-6h5v6" /></>,
    exchange: <><path d="M7 7h11l-3-3M17 17H6l3 3" /><path d="m18 7-3 3M6 17l3-3" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 6-3 7-3 9h18c0-2-3-3-3-9" /><path d="M10 21h4" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    back: <path d="m15 5-7 7 7 7" />,
    spark: <><path d="m12 2 1.4 4.6L18 8l-4.6 1.4L12 14l-1.4-4.6L6 8l4.6-1.4L12 2Z" /><path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20V7" /></>,
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4" /></>,
    team: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2.5 20a5.5 5.5 0 0 1 11 0M13 20a4 4 0 0 1 8 0" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4" /></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
    heart: <path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.8l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z" />,
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" /><path d="M8 10h8M8 14h5" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    filter: <path d="M4 6h16M7 12h10M10 18h4" />,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" /></>,
    edit: <><path d="m14 4 6 6L8 22H2v-6L14 4Z" /><path d="m12 6 6 6" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4H4v12h4" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    file: <><path d="M6 2h8l4 4v16H6V2Z" /><path d="M14 2v5h5M9 13h6M9 17h4" /></>,
    star: <path d="m12 2 3 6 7 .9-5 4.8 1.2 6.8L12 17.3l-6.2 3.2L7 13.7 2 8.9 9 8l3-6Z" />,
  }
  return <svg {...common}>{paths[name] || paths.clipboard}</svg>
}

function BrandMark({ compact = false }) {
  return (
    <div className={compact ? 'brand brand--compact' : 'brand'}>
      <span className="brand-puzzle" aria-hidden="true">
        <i className="puzzle puzzle--blue">•ᴗ•</i>
        <i className="puzzle puzzle--pink">•ᴗ•</i>
        <i className="puzzle puzzle--purple">•••</i>
        <i className="puzzle puzzle--cream">•ᴗ•</i>
      </span>
      <strong><b>SUN</b>iVERSiTY</strong>
    </div>
  )
}

function TopBar({ title, onBack, right, brand = false }) {
  return (
    <header className="topbar">
      {onBack ? <button className="round-icon" type="button" onClick={onBack} aria-label="뒤로 가기"><Icon name="back" /></button> : <span className="topbar-space" />}
      {brand ? <BrandMark compact /> : <strong>{title}</strong>}
      {right || <span className="topbar-space" />}
    </header>
  )
}

function BottomNav({ active, navigate, unread }) {
  const items = [
    ['home', '홈', 'home'],
    ['create', '설문 만들기', 'plus'],
    ['exchange', '설문 교환', 'exchange'],
  ]
  const activeIndex = Math.max(0, items.findIndex(([id]) => id === active))
  const [selectedIndex, setSelectedIndex] = useState(activeIndex)
  const [isMoving, setIsMoving] = useState(false)

  useEffect(() => {
    setSelectedIndex(activeIndex)
    setIsMoving(false)
  }, [activeIndex])

  const selectTab = (id, index) => {
    if (id === active || isMoving) return
    setSelectedIndex(index)
    setIsMoving(true)
    window.setTimeout(() => navigate(id), 260)
  }

  return (
    <nav
      className={`bottom-nav${isMoving ? ' is-moving' : ''}`}
      aria-label="주요 메뉴"
      style={{ '--active-tab': selectedIndex }}
    >
      <span className="bottom-nav__indicator" aria-hidden="true">
        <Icon
          name={items[selectedIndex][2]}
          size={items[selectedIndex][0] === 'create' ? 31 : 28}
        />
      </span>
      {items.map(([id, label, icon], index) => (
        <button
          key={id}
          type="button"
          className={`${selectedIndex === index ? 'is-active' : ''} ${id === 'create' ? 'nav-create' : ''}`}
          aria-current={active === id ? 'page' : undefined}
          aria-label={label}
          onClick={() => selectTab(id, index)}
        >
          <span><Icon name={icon} size={id === 'create' ? 31 : 28} />{id === 'notifications' && unread ? <i>{unread}</i> : null}</span>
        </button>
      ))}
    </nav>
  )
}

function Progress({ value, tone = 'blue' }) {
  return <span className={`progress progress--${tone}`}><i style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></span>
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i />
    </label>
  )
}

function DesignSelect({ value, onChange, options, ariaLabel, compact = false }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, upward: false })
  const buttonRef = useRef(null)
  const normalized = options.map((option) => Array.isArray(option) ? { value: option[0], label: option[1] } : { value: option, label: String(option) })
  const selected = normalized.find((option) => String(option.value) === String(value)) || normalized[0]

  const toggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const estimatedHeight = Math.min(normalized.length * 43 + 16, 330)
      const upward = window.innerHeight - rect.bottom < estimatedHeight + 12 && rect.top > estimatedHeight
      setPosition({
        top: upward ? rect.top - 8 : rect.bottom + 8,
        left: rect.left,
        width: Math.max(rect.width, compact ? 96 : 170),
        upward,
      })
    }
    setOpen((current) => !current)
  }

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  return (
    <div className={`design-select ${compact ? 'is-compact' : ''} ${open ? 'is-open' : ''}`}>
      <button ref={buttonRef} className="design-select-trigger" type="button" onClick={toggle} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open}>
        <span>{selected?.label}</span><Icon name="chevron" size={18} />
      </button>
      {open ? <>
        <button className="design-select-backdrop" type="button" onClick={() => setOpen(false)} aria-label="선택 목록 닫기" />
        <div
          className={`design-select-menu ${position.upward ? 'opens-up' : ''}`}
          role="listbox"
          style={{ top: position.top, left: position.left, width: position.width }}
        >
          {normalized.map((option) => {
            const active = String(option.value) === String(value)
            return <button type="button" role="option" aria-selected={active} className={active ? 'is-selected' : ''} key={option.value} onClick={() => { onChange(option.value); setOpen(false) }}><span>{option.label}</span>{active ? <Icon name="check" size={16} /> : null}</button>
          })}
        </div>
      </> : null}
    </div>
  )
}

function Modal({ children, onClose, className = '' }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className={`modal ${className}`} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        {children}
      </section>
    </div>
  )
}

function SurveyCard({ survey, onOpen, completed = false, exchange = false, eligible = true }) {
  const days = Math.max(0, Math.ceil((new Date(`${survey.deadline}T23:59:59`) - new Date()) / 86400000))
  return (
    <article className={`survey-card ${completed ? 'is-completed' : ''}`}>
      <button type="button" className="survey-card-main" onClick={onOpen}>
        <div className="survey-card-tags">
          {survey.hot ? <span className="tag tag--pink">HOT</span> : null}
          <span className="tag tag--blue">{survey.category}</span>
          {exchange ? <span className="tag tag--purple">매칭 {survey.matchScore}점</span> : null}
        </div>
        <h3>{survey.title}</h3>
        <p>{survey.description}</p>
        <div className="survey-card-meta">
          <span><Icon name="clipboard" size={15} />{survey.questionCount}문항 · 약 {survey.minutes}분</span>
          <span className={days <= 3 ? 'is-urgent' : ''}><Icon name="clock" size={15} />{days ? `${days}일 남음` : '오늘 마감'}</span>
        </div>
        <Progress value={survey.participants / survey.target * 100} tone={completed ? 'gray' : 'blue'} />
        <div className="survey-card-foot">
          <small>{survey.owner} · 신뢰도 {survey.trust}%</small>
          <strong>{completed ? '참여 완료' : exchange ? eligible ? '교환 가능' : '조건 불일치' : `${survey.participants}/${survey.target}명`}</strong>
        </div>
      </button>
    </article>
  )
}

function NotificationPopover({ notifications, setNotifications, navigate, onClose }) {
  const unreadCount = notifications.filter((notice) => !notice.read).length
  const readAll = () => setNotifications((current) => current.map((notice) => ({ ...notice, read: true })))
  const openNotice = (noticeId) => {
    setNotifications((current) => current.map((notice) => notice.id === noticeId ? { ...notice, read: true } : notice))
    onClose()
    navigate('exchange')
  }

  return (
    <div className="notification-popover-layer" onMouseDown={onClose}>
      <aside className="notification-popover" role="dialog" aria-modal="true" aria-labelledby="notification-popover-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="notification-popover-head">
          <div>
            <span><Icon name="bell" size={15} /> NEW MESSAGE</span>
            <h2 id="notification-popover-title">알림</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="알림 닫기"><Icon name="close" size={20} /></button>
        </header>
        <div className="notification-popover-summary">
          <p>{unreadCount ? `새로운 알림이 ${unreadCount}개 있어요` : '새로운 알림을 모두 확인했어요'}</p>
          {unreadCount ? <button type="button" onClick={readAll}>모두 읽음</button> : null}
        </div>
        <div className="notification-popover-list">
          {notifications.map((notice) => (
            <button type="button" key={notice.id} className={notice.read ? 'is-read' : ''} onClick={() => openNotice(notice.id)}>
              <i><Icon name={notice.type === 'complete' ? 'check' : notice.type === 'deadline' ? 'clock' : 'exchange'} size={19} /></i>
              <span><b>{notice.title}</b><p>{notice.body}</p><small>{notice.time}</small></span>
              {!notice.read ? <em /> : null}
            </button>
          ))}
        </div>
      </aside>
    </div>
  )
}

function HomeScreen({ navigate, surveys, completed, profile, unread, notifications, setNotifications }) {
  const [query, setQuery] = useState('')
  const [notificationOpen, setNotificationOpen] = useState(false)
  const visible = surveys.filter((survey) => `${survey.title} ${survey.category}`.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    if (!notificationOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setNotificationOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [notificationOpen])

  return (
    <div className="screen has-nav">
      <TopBar
        brand
        right={<div className="top-actions"><button className="round-icon" type="button" onClick={() => setNotificationOpen((open) => !open)} aria-label="알림" aria-expanded={notificationOpen}><Icon name="bell" />{unread ? <i className="dot" /> : null}</button><button className="avatar" type="button" onClick={() => navigate('profile')}>나</button></div>}
      />
      {notificationOpen ? <NotificationPopover notifications={notifications} setNotifications={setNotifications} navigate={navigate} onClose={() => setNotificationOpen(false)} /> : null}
      <main className="page home-page">
        <section className="welcome">
          <span>안녕하세요, {profile.name} 👋</span>
          <h1>오늘도 설문으로<br /><em>함께 성장해요!</em></h1>
        </section>

        <section className="ai-hero">
          <div>
            <span><Icon name="spark" size={16} /> AI 설문 제작</span>
            <h2>아이디어만 알려주세요.<br />문항은 AI가 다듬어드릴게요.</h2>
            <p>제목 추천부터 쉬운 대화체 문항, 예상 응답 시간까지 한 번에.</p>
            <button type="button" onClick={() => navigate('create')}>AI와 설문 만들기 <Icon name="chevron" size={16} /></button>
          </div>
          <BrandMark />
        </section>

        <section className="exchange-snapshot">
          <div className="section-title">
            <div><span>교환 진행 중</span><h2>서로의 설문을 완성하는 중이에요</h2></div>
            <button type="button" onClick={() => navigate('exchange')}>전체보기</button>
          </div>
          <button type="button" className="snapshot-card" onClick={() => navigate('exchange')}>
            <span className="mini-mascots"><i>•ᴗ•</i><i>•ᴗ•</i></span>
            <div><small>디자인씽킹 3팀과 교환</small><b>우리 팀 응답 1명이 남았어요</b><Progress value={75} /><em>3/4명 완료</em></div>
            <Icon name="chevron" />
          </button>
        </section>

        <section>
          <div className="section-title">
            <div><span>추천 설문</span><h2>나와 잘 맞는 설문이에요</h2></div>
            <button type="button" onClick={() => navigate('exchange')}>교환 추천</button>
          </div>
          <label className="search-field"><Icon name="search" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목이나 주제로 설문 찾기" /></label>
          <div className="survey-stack">
            {visible.slice(0, 3).map((survey) => <SurveyCard key={survey.id} survey={survey} completed={completed.includes(survey.id)} onOpen={() => navigate('surveyDetail', survey.id)} />)}
          </div>
        </section>

        <section className="compare-banner">
          <i><Icon name="chart" size={28} /></i>
          <div><b>응답하면 더 재미있는 결과를 볼 수 있어요</b><p>나와 같은 답을 고른 사람부터 성별·MBTI·학교별 차이까지 확인해 보세요.</p></div>
        </section>
      </main>
      <BottomNav active="home" navigate={navigate} unread={unread} />
    </div>
  )
}

function ExchangeScreen({ navigate, surveys, requests, setRequests, profile }) {
  const [tab, setTab] = useState('recommend')
  const [sort, setSort] = useState('score')
  const recommended = [...surveys].sort((a, b) => sort === 'score' ? b.matchScore - a.matchScore : new Date(a.deadline) - new Date(b.deadline))
  return (
    <div className="screen has-nav">
      <TopBar title="설문 교환" right={<button className="round-icon" type="button" onClick={() => navigate('exchangeHelp')} aria-label="도움말">?</button>} />
      <main className="page exchange-page">
        <section className="exchange-intro">
          <span>설문을 주고받고, 응답을 함께 모아요</span>
          <h1>혼자 찾지 말고<br /><em>서로 교환해요.</em></h1>
          <div className="exchange-actions">
            <button type="button" onClick={() => navigate('autoMatch')}><i><Icon name="spark" /></i><span><b>자동 매칭</b><small>조건이 맞는 팀을 바로 찾아요</small></span><Icon name="chevron" /></button>
            <button type="button" onClick={() => navigate('team')}><i><Icon name="team" /></i><span><b>팀 워크스페이스</b><small>{profile.teamSize}명의 진행 현황을 확인해요</small></span><Icon name="chevron" /></button>
          </div>
        </section>

        <div className="segmented">
          <button type="button" className={tab === 'recommend' ? 'is-active' : ''} onClick={() => setTab('recommend')}>추천 설문</button>
          <button type="button" className={tab === 'queue' ? 'is-active' : ''} onClick={() => setTab('queue')}>교환 대기함 <i>{requests.length}</i></button>
        </div>

        {tab === 'recommend' ? (
          <section>
            <div className="section-title">
              <div><span>같은 문항 구간 우선</span><h2>교환하기 좋은 설문</h2></div>
              <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="정렬">
                <option value="score">매칭 점수순</option>
                <option value="deadline">마감일순</option>
              </select>
            </div>
            <div className="matching-rule"><Icon name="shield" size={18} /><p><b>내 설문: 11~15문항</b><span>같거나 더 높은 구간에만 직접 교환을 신청할 수 있어요.</span></p></div>
            <div className="survey-stack">
              {recommended.map((survey) => <SurveyCard key={survey.id} survey={survey} exchange eligible={survey.questionCount >= 11} onOpen={() => navigate('surveyDetail', survey.id)} />)}
            </div>
          </section>
        ) : (
          <ExchangeQueue requests={requests} setRequests={setRequests} navigate={navigate} />
        )}
      </main>
      <BottomNav active="exchange" navigate={navigate} />
    </div>
  )
}

function ExchangeQueue({ requests, setRequests, navigate, compact = false }) {
  const labels = {
    incoming: ['새 교환 신청', 'pink'],
    'waiting-me': ['내 응답 대기', 'pink'],
    'waiting-partner': ['상대 응답 대기', 'purple'],
    completed: ['교환 완료', 'blue'],
    requested: ['수락 대기', 'gray'],
    rejected: ['교환 거절', 'gray'],
    cancelled: ['자동 취소', 'gray'],
  }
  const decideRequest = (requestId, accepted) => {
    setRequests((current) => current.map((request) => request.id === requestId ? { ...request, status: accepted ? 'waiting-me' : 'rejected' } : request))
  }
  return (
    <section className={compact ? 'queue queue--compact' : 'queue'}>
      {!compact ? <div className="queue-guide"><Icon name="clock" /><p><b>마감 24시간 전 자동 취소</b><span>성사되지 않은 신청은 자동으로 정리돼요. 미완료 신청은 설문당 최대 10개예요.</span></p></div> : null}
      <div className="queue-list">
        {requests.map((request) => {
          const [label, tone] = labels[request.status] || labels.requested
          return (
            <article key={request.id}>
              <header><span className={`tag tag--${tone}`}>{label}</span><small>{request.type} · {request.deadline} 마감</small></header>
              <h3>{request.title}</h3>
              <p>{request.partner} · {request.people}명 교환</p>
              <div className="dual-progress">
                <span><small>우리 팀</small><b>{request.ours}/{request.people}명</b><Progress value={request.ours / request.people * 100} /></span>
                <span><small>상대 팀</small><b>{request.theirs}/{request.people}명</b><Progress value={request.theirs / request.people * 100} tone="purple" /></span>
              </div>
              {request.status === 'incoming' ? <div className="request-actions"><button type="button" onClick={() => decideRequest(request.id, false)}>거절</button><button type="button" onClick={() => decideRequest(request.id, true)}>수락</button></div> : <button type="button" disabled={request.status === 'rejected' || request.status === 'cancelled'} onClick={() => request.status === 'waiting-me' ? navigate('participate', request.surveyId, { exchangeId: request.id }) : navigate('exchangeStatus', request.id)}>
                {request.status === 'waiting-me' ? '상대 설문 참여하기' : request.status === 'rejected' ? '거절한 신청' : request.status === 'cancelled' ? '마감 24시간 전 자동 취소' : '진행 상황 보기'} <Icon name="chevron" size={16} />
              </button>}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function SurveyDetailScreen({ survey, onBack, navigate, profile, onRequest, completed, favorite, onFavorite }) {
  const [exchangeModal, setExchangeModal] = useState(false)
  const [mode, setMode] = useState('personal')
  const [people, setPeople] = useState(Math.min(2, profile.teamSize))
  const [sent, setSent] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reported, setReported] = useState(false)
  if (!survey) return null
  const canExchange = survey.questionCount >= 11
  const submit = () => {
    onRequest(survey, mode, people)
    setSent(true)
  }
  return (
    <div className="screen">
      <TopBar title="설문 상세" onBack={onBack} right={<button type="button" className="round-icon" onClick={() => setReportOpen(true)} aria-label="설문 더보기"><Icon name="more" /></button>} />
      <main className="page detail-page">
        <div className="detail-tags"><span className="tag tag--blue">{survey.category}</span>{survey.hot ? <span className="tag tag--pink">HOT</span> : null}</div>
        <h1>{survey.title}</h1>
        <p className="detail-description">{survey.description}</p>
        <div className="owner-row"><span className="owner-avatar">{survey.owner.slice(0, 1)}</span><div><b>{survey.owner}</b><small><Icon name="shield" size={13} /> 신뢰도 {survey.trust}%</small></div><button type="button" className={favorite ? 'is-favorite' : ''} onClick={() => onFavorite(survey.id)}>{favorite ? '즐겨찾기 됨' : '즐겨찾기'}</button></div>
        <section className="detail-stats">
          <span><Icon name="clipboard" /><b>{survey.questionCount}문항</b><small>{survey.band}</small></span>
          <span><Icon name="clock" /><b>약 {survey.minutes}분</b><small>{survey.deadline} 마감</small></span>
          <span><Icon name="users" /><b>{survey.participants}명</b><small>목표 {survey.target}명</small></span>
        </section>
        <section className="target-box"><span>응답 대상</span><div>{survey.targetTags.map((tag) => <i key={tag}>{tag}</i>)}</div></section>
        <section className="preview-box">
          <div className="section-title"><div><span>미리보기</span><h2>이런 걸 물어봐요</h2></div></div>
          <ol>
            <li>평소 카페를 얼마나 자주 이용하시나요?</li>
            <li>카페를 고를 때 가장 중요하게 보는 것은 무엇인가요?</li>
            <li>카페에서 공부하는 걸 얼마나 좋아하시나요?</li>
          </ol>
          <small>전체 {survey.questionCount}개 문항 중 3개를 미리 보여드려요.</small>
        </section>
        <section className="result-benefit"><Icon name="chart" /><div><b>참여 후 비교 결과를 확인해 보세요</b><p>성별·MBTI·학교별 결과와 나와 같은 답을 고른 비율을 볼 수 있어요.</p></div></section>
      </main>
      <footer className="sticky-actions">
        <button type="button" className="secondary-button" disabled={!canExchange} onClick={() => setExchangeModal(true)}>{canExchange ? '교환 신청' : '교환 조건 불일치'}</button>
        <button type="button" className="primary-button" onClick={() => navigate(completed ? 'respondentResult' : 'participate', survey.id)}>{completed ? '내 응답 결과 보기' : '바로 참여하기'}</button>
      </footer>
      {exchangeModal ? (
        <Modal onClose={() => setExchangeModal(false)} className="exchange-modal">
          {!sent ? <>
            <button className="modal-close" type="button" onClick={() => setExchangeModal(false)}><Icon name="close" /></button>
            <span className="modal-kicker">DIRECT EXCHANGE</span>
            <h2>어떻게 교환할까요?</h2>
            <p>상대가 수락하면 서로의 설문에 참여할 수 있어요.</p>
            <div className="mode-cards">
              <button type="button" className={mode === 'personal' ? 'is-active' : ''} onClick={() => setMode('personal')}><Icon name="user" /><b>개인 교환</b><small>작성자끼리 1:1로 교환해요</small></button>
              <button type="button" className={mode === 'team' ? 'is-active' : ''} onClick={() => setMode('team')}><Icon name="team" /><b>팀 교환</b><small>선택한 인원만큼 응답을 교환해요</small></button>
            </div>
            {mode === 'team' ? <div className="people-picker"><span><b>교환 참여 인원</b><small>현재 팀원 {profile.teamSize}명 · 최소 2명</small></span><div><button type="button" onClick={() => setPeople(Math.max(2, people - 1))}>−</button><strong>{people}명</strong><button type="button" onClick={() => setPeople(Math.min(profile.teamSize, people + 1))}>＋</button></div></div> : null}
            <div className="rule-note"><Icon name="shield" /><span><b>교환 가능 조건을 확인했어요</b><small>내 설문과 같거나 더 높은 문항 수 구간이에요.</small></span></div>
            <button type="button" className="primary-button" onClick={submit}>교환 신청 보내기</button>
          </> : <div className="success-state"><i><Icon name="check" size={34} /></i><h2>교환 신청을 보냈어요!</h2><p>상대가 수락하면 알림으로 알려드릴게요.<br />미완료 신청은 최대 10개까지 받을 수 있어요.</p><button type="button" className="primary-button" onClick={() => navigate('exchange')}>교환 대기함 보기</button></div>}
        </Modal>
      ) : null}
      {reportOpen ? <Modal onClose={() => setReportOpen(false)} className="report-modal">
        {!reported ? <>
          <button className="modal-close" type="button" onClick={() => setReportOpen(false)}><Icon name="close" /></button>
          <span className="modal-kicker">SAFE COMMUNITY</span>
          <h2>어떤 문제가 있나요?</h2>
          <p>신고 내용은 운영 검토에만 사용되고 신고자 정보는 공개되지 않아요.</p>
          <div className="report-reasons">{['부적절한 내용', '개인정보 노출', '중복·광고성 설문', '응답 조작 의심'].map((reason) => <button type="button" className={reportReason === reason ? 'is-selected' : ''} onClick={() => setReportReason(reason)} key={reason}>{reason}<Icon name="check" size={15} /></button>)}</div>
          <div className="report-policy"><Icon name="shield" /><span><b>신고 8회 누적 시 신뢰도 0% 처리</b><small>동일 조치가 2회 누적되면 계정 이용이 정지돼요.</small></span></div>
          <button type="button" className="primary-button" disabled={!reportReason} onClick={() => setReported(true)}>신고 접수하기</button>
        </> : <div className="success-state"><i><Icon name="check" size={32} /></i><h2>신고를 접수했어요</h2><p>운영 정책에 따라 확인한 뒤 필요한 조치를 진행할게요.</p><button type="button" className="primary-button" onClick={() => setReportOpen(false)}>확인</button></div>}
      </Modal> : null}
    </div>
  )
}

function AutoMatchScreen({ onBack, profile, surveys, onMatched, navigate }) {
  const [mode, setMode] = useState('team')
  const [people, setPeople] = useState(Math.min(3, profile.teamSize))
  const [phase, setPhase] = useState('setup')
  const match = surveys[0]
  const start = () => {
    setPhase('searching')
    window.setTimeout(() => setPhase('matched'), 1300)
  }
  return (
    <div className="screen">
      <TopBar title="자동 매칭" onBack={onBack} right={<span className="top-step">{phase === 'setup' ? '설정' : phase === 'searching' ? '탐색' : '완료'}</span>} />
      <main className="page auto-page">
        {phase === 'setup' ? <>
          <div className="auto-mascot"><span>•ᴗ•</span><i><Icon name="search" /></i></div>
          <span className="eyebrow">조건에 맞는 팀을 찾아드릴게요</span>
          <h1>교환 조건을<br />선택해 주세요.</h1>
          <section className="setup-card">
            <label>교환 방식</label>
            <div className="segmented"><button type="button" className={mode === 'personal' ? 'is-active' : ''} onClick={() => setMode('personal')}>개인 1:1</button><button type="button" className={mode === 'team' ? 'is-active' : ''} onClick={() => setMode('team')}>팀 교환</button></div>
          </section>
          {mode === 'team' ? <section className="setup-card">
            <label>참여 인원</label>
            <p>같은 인원 수를 선택한 팀끼리만 매칭돼요.</p>
            <div className="people-picker people-picker--large"><button type="button" onClick={() => setPeople(Math.max(2, people - 1))}>−</button><strong>{people}<small>명</small></strong><button type="button" onClick={() => setPeople(Math.min(profile.teamSize, people + 1))}>＋</button></div>
            <small>우리 팀 {profile.teamSize}명 중 {people}명이 서로의 설문에 참여해요.</small>
          </section> : null}
          <section className="matching-conditions">
            <h3>자동으로 적용되는 조건</h3>
            <span><i><Icon name="clipboard" /></i><b>문항 수 구간</b><em>11~15문항끼리</em></span>
            <span><i><Icon name="shield" /></i><b>신뢰도</b><em>80% 이상 우선</em></span>
            <span><i><Icon name="users" /></i><b>기본 정보</b><em>응답 대상 적합도 반영</em></span>
          </section>
          <button type="button" className="primary-button bottom-cta" onClick={start}>자동 매칭 시작</button>
        </> : null}
        {phase === 'searching' ? <div className="matching-search"><div className="orbit"><span>•ᴗ•</span><i /><i /><i /></div><h1>가장 잘 맞는 팀을<br />찾고 있어요</h1><p>문항 수, 참여 인원, 신뢰도를 비교하고 있어요.</p><div className="search-steps"><span className="done"><Icon name="check" /> 문항 수 구간 확인</span><span className="done"><Icon name="check" /> 참여 인원 확인</span><span><i className="loader" /> 매칭 점수 계산</span></div></div> : null}
        {phase === 'matched' ? <div className="match-result">
          <div className="celebrate">✦ <span>•ᴗ•</span> <span>•ᴗ•</span> ✦</div>
          <span className="eyebrow">MATCH FOUND</span>
          <h1>딱 맞는 팀을 찾았어요!</h1>
          <p>매칭 점수와 교환 조건을 확인해 주세요.</p>
          <article>
            <header><span className="owner-avatar">{match.owner.slice(0, 1)}</span><div><b>{match.owner}</b><small>신뢰도 {match.trust}% · 교환 완료율 91%</small></div><strong>{match.matchScore}점</strong></header>
            <h2>{match.title}</h2>
            <div><span>{match.band}</span><span>{mode === 'team' ? `${people}명 교환` : '1:1 교환'}</span><span>{match.minutes}분 예상</span></div>
          </article>
          <div className="match-result-actions"><button type="button" className="secondary-button" onClick={() => setPhase('setup')}>다시 찾기</button><button type="button" className="primary-button" onClick={() => { onMatched(match, mode, people); navigate('exchange') }}>이 팀과 교환하기</button></div>
        </div> : null}
      </main>
    </div>
  )
}

function CreateSurveyScreen({ onBack, onPublish, profile }) {
  const emptyQuestion = () => ({ id: crypto.randomUUID(), type: 'single', text: '', description: '', options: ['선택지 1', '선택지 2'], rows: ['행 1', '행 2'], columns: ['열 1', '열 2'], required: true, shuffle: false, other: false, validation: 'none', min: 1, max: 5, branch: 'next' })
  const savedDraft = (() => {
    try { return JSON.parse(localStorage.getItem('suniversity-new-draft')) } catch { return null }
  })()
  const [step, setStep] = useState(savedDraft?.step || 1)
  const [showGuide, setShowGuide] = useState(!savedDraft)
  const [title, setTitle] = useState(savedDraft?.title || '')
  const [description, setDescription] = useState(savedDraft?.description || '')
  const [category, setCategory] = useState(savedDraft?.category || '대학생활')
  const [deadline, setDeadline] = useState(savedDraft?.deadline || '2026-08-15')
  const [basicFields, setBasicFields] = useState(savedDraft?.basicFields || ['학년', '성별', '재학 여부'])
  const [questions, setQuestions] = useState(savedDraft?.questions || [emptyQuestion()])
  const [teamSurvey, setTeamSurvey] = useState(savedDraft?.teamSurvey || false)
  const [publicResult, setPublicResult] = useState(savedDraft?.publicResult ?? true)
  const [collectEmail, setCollectEmail] = useState(savedDraft?.collectEmail || false)
  const [oneResponse, setOneResponse] = useState(savedDraft?.oneResponse ?? true)
  const [allowEdit, setAllowEdit] = useState(savedDraft?.allowEdit || false)
  const [quizMode, setQuizMode] = useState(savedDraft?.quizMode || false)
  const [confirmationMessage, setConfirmationMessage] = useState(savedDraft?.confirmationMessage || '응답해 주셔서 감사합니다!')
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)
  const [titleSuggestions, setTitleSuggestions] = useState(false)
  useEffect(() => {
    document.querySelector('.create-page')?.scrollTo({ top: 0, behavior: 'instant' })
    window.scrollTo(0, 0)
  }, [step])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const showToast = (message) => {
    window.clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = window.setTimeout(() => setToast(''), 1800)
  }

  const updateQuestion = (id, patch) => setQuestions((current) => current.map((question) => question.id === id ? { ...question, ...patch } : question))
  const saveDraft = () => {
    localStorage.setItem('suniversity-new-draft', JSON.stringify({ step, title, description, category, deadline, basicFields, questions, teamSurvey, publicResult, collectEmail, oneResponse, allowEdit, quizMode, confirmationMessage }))
    showToast('임시저장했어요')
  }
  const addQuestion = (type = 'single') => setQuestions((current) => [...current, { ...emptyQuestion(), type }])
  const publish = () => {
    const survey = {
      id: `mine-${Date.now()}`,
      owner: profile.name,
      trust: profile.trust,
      title: title || '대학생의 새로운 일상에 관한 설문',
      description: description || '여러분의 솔직한 생각을 들려주세요.',
      category,
      questionCount: questions.length,
      band: getBand(questions.length),
      minutes: Math.max(1, Math.ceil(questions.length * 0.45)),
      deadline,
      participants: 0,
      target: 100,
      matchScore: 91,
      hot: false,
      targetTags: basicFields.length ? basicFields : ['대학생'],
      questions,
      mine: true,
      settings: { collectEmail, oneResponse, allowEdit, quizMode, confirmationMessage, publicResult },
    }
    localStorage.removeItem('suniversity-new-draft')
    onPublish(survey)
  }
  const nextDisabled = step === 1 && !title.trim()
  return (
    <div className="screen create-screen">
      <TopBar title="새 설문 만들기" onBack={() => step > 1 ? setStep(step - 1) : onBack()} right={<button className="text-button" type="button" onClick={saveDraft}>임시저장</button>} />
      <div className="create-progress"><i className={step >= 1 ? 'active' : ''} /><i className={step >= 2 ? 'active' : ''} /><i className={step >= 3 ? 'active' : ''} /><i className={step >= 4 ? 'active' : ''} /></div>
      <main className="page create-page">
        {step === 1 ? <section className="create-step">
          <span className="eyebrow">STEP 1 · 기본 설정</span>
          <h1>어떤 이야기를<br />물어볼까요?</h1>
          <p>제목과 목적을 알려주면 AI가 더 재미있는 표현을 추천해 드려요.</p>
          <label className="form-field"><span>설문 제목 <b>필수</b></span><input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="예: 대학생 카페 이용 실태 조사" /><small>{title.length}/80</small></label>
          <button type="button" className="ai-suggest-button" onClick={() => setTitleSuggestions(!titleSuggestions)}><Icon name="spark" /><span><b>AI 제목 추천</b><small>클릭하고 싶은 대화체 제목으로 바꿔드려요</small></span><Icon name="chevron" /></button>
          {titleSuggestions ? <div className="suggestion-list">
            {['대학생, 카페에서 하루에 얼마 쓰세요?', '공강 시간, 다들 카페에서 뭐 하세요?', '우리 학교 앞 카페에 꼭 있었으면 하는 건?'].map((suggestion) => <button type="button" key={suggestion} onClick={() => { setTitle(suggestion); setTitleSuggestions(false) }}>{suggestion}<Icon name="spark" size={15} /></button>)}
          </div> : null}
          <label className="form-field"><span>설문 설명</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="설문의 목적과 응답자에게 전할 말을 적어주세요." /></label>
          <div className="form-grid">
            <div className="form-field"><span>카테고리</span><DesignSelect value={category} onChange={setCategory} ariaLabel="카테고리 선택" options={['대학생활', '진로·취업', '소비', '연애·관계', 'IT·서비스', '연구·논문']} /></div>
            <label className="form-field"><span>마감 기한</span><input type="date" value={deadline} min="2026-07-31" onChange={(event) => setDeadline(event.target.value)} /></label>
          </div>
          <div className="deadline-note"><Icon name="clock" /><span><b>마감 24시간 전 교환 자동 종료</b><small>성사되지 않은 교환 신청은 자동 취소돼요.</small></span></div>
        </section> : null}

        {step === 2 ? <BasicInfoStep selected={basicFields} setSelected={setBasicFields} /> : null}

        {step === 3 ? <section className="create-step question-builder">
          <span className="eyebrow">STEP 3 · 문항 구성</span>
          <h1>질문을 구성해 주세요</h1>
          <p>쉬운 단어와 대화체를 사용하면 응답 완료율이 높아져요.</p>
          <div className="ai-quality-card"><Icon name="spark" /><div><b>AI 설문 품질 가이드</b><span><em>예상 응답 시간 {Math.max(1, Math.ceil(questions.length * .45))}분</em><em>예상 완료율 {Math.max(62, 94 - questions.length * 2)}%</em></span></div></div>
          <div className="question-list">
            {questions.map((question, index) => <QuestionEditor key={question.id} question={question} index={index} onChange={(patch) => updateQuestion(question.id, patch)} onRemove={() => setQuestions((current) => current.filter((item) => item.id !== question.id))} />)}
          </div>
          <div className="add-question-actions">
            <button type="button" onClick={() => addQuestion()}><Icon name="plus" /> 질문 추가</button>
            <button type="button" onClick={() => addQuestion('section')}><Icon name="file" /> 섹션 추가</button>
            <button type="button" onClick={() => { addQuestion('single'); showToast('AI가 목적에 맞는 문항을 추가했어요') }}><Icon name="spark" /> AI 문항 생성</button>
          </div>
        </section> : null}

        {step === 4 ? <section className="create-step publish-step">
          <span className="eyebrow">STEP 4 · 게시 설정</span>
          <h1>마지막으로<br />게시 설정을 확인해요.</h1>
          <section className="publish-preview"><span className="tag tag--blue">{category}</span><h2>{title}</h2><p>{description || '설문 설명이 아직 없어요.'}</p><div><span>{questions.length}문항</span><span>약 {Math.max(1, Math.ceil(questions.length * .45))}분</span><span>{deadline} 마감</span></div></section>
          <section className="publish-options">
            <Toggle label="팀과 함께 관리하기" checked={teamSurvey} onChange={setTeamSurvey} />
            <Toggle label="응답자에게 결과 공개" checked={publicResult} onChange={setPublicResult} />
          </section>
          {teamSurvey ? <div className="team-select"><Icon name="team" /><span><b>캡스톤 A팀</b><small>팀원 {profile.teamSize}명 · 공동 편집 가능</small></span><Icon name="chevron" /></div> : null}
          <section className="free-publish"><Icon name="check" /><div><b>설문 등록은 무료예요</b><p>외부 공유와 설문 교환으로 응답자를 모을 수 있어요. 작성자는 기본 결과를 무료로 확인합니다.</p></div></section>
          <section className="response-settings">
            <h3>응답 설정</h3>
            <Toggle label="응답 1회만 허용" checked={oneResponse} onChange={setOneResponse} />
            <Toggle label="이메일 주소 수집" checked={collectEmail} onChange={setCollectEmail} />
            <Toggle label="제출 후 응답 수정 허용" checked={allowEdit} onChange={setAllowEdit} />
            <Toggle label="퀴즈 모드 · 정답 및 배점 사용" checked={quizMode} onChange={setQuizMode} />
            <label><span>제출 확인 메시지</span><input value={confirmationMessage} onChange={(event) => setConfirmationMessage(event.target.value)} /></label>
          </section>
          <section className="share-after"><Icon name="share" /><span><b>게시 후 자동으로 만들어져요</b><small>공유 링크 · QR 코드 · 설문 교환 프로필</small></span></section>
        </section> : null}
      </main>
      <footer className="create-footer">
        {step < 4 ? <button type="button" className="primary-button" disabled={nextDisabled} onClick={() => setStep(step + 1)}>다음 단계 <span>{step}/4</span></button> : <button type="button" className="primary-button" onClick={publish}>무료로 설문 게시하기</button>}
      </footer>
      {showGuide ? <Modal onClose={() => setShowGuide(false)} className="guide-modal">
        <button type="button" className="modal-close guide-close" onClick={() => setShowGuide(false)} aria-label="가이드 닫기"><Icon name="close" size={18} /></button>
        <div className="guide-visual"><span>•ᴗ•</span><i><Icon name="edit" /></i></div>
        <span className="modal-kicker"><Icon name="spark" size={13} /> SURVEY GUIDE</span>
        <h2>좋은 설문은<br />답하기 쉬운 말로 시작해요.</h2>
        <p className="guide-intro">세 가지만 기억하면 응답하기 편한 설문이 완성돼요.</p>
        <div className="guide-list"><span><b>1</b><p><strong>어려운 단어는 쉽게</strong><small>전문 용어보다 일상적인 표현을 사용해요.</small></p></span><span><b>2</b><p><strong>질문은 대화하듯 자연스럽게</strong><small>한 문장에는 하나의 내용만 물어봐요.</small></p></span><span><b>3</b><p><strong>필요한 기본 정보는 자동으로</strong><small>프로필 정보를 활용하면 질문 수를 줄일 수 있어요.</small></p></span></div>
        <button type="button" className="primary-button" onClick={() => setShowGuide(false)}>설문 만들기 시작 <Icon name="chevron" size={18} /></button>
      </Modal> : null}
      {toast ? <div className="toast" role="status"><Icon name="check" size={17} /><span>{toast}</span><button type="button" onClick={() => { window.clearTimeout(toastTimer.current); setToast('') }} aria-label="알림 닫기"><Icon name="close" size={15} /></button></div> : null}
    </div>
  )
}

function getBand(count) {
  if (count <= 5) return '1~5문항'
  const start = Math.floor((count - 1) / 5) * 5 + 1
  return `${start}~${start + 4}문항`
}

function BasicInfoStep({ selected, setSelected }) {
  const groups = [
    ['학적 정보', ['학년', '성별', '연령', '재학 여부']],
    ['생활 환경', ['거주 지역', '주거 형태', '통학 여부']],
    ['경제 활동', ['월 용돈', '아르바이트 여부', '경제활동 여부']],
    ['디지털 환경', ['스마트폰 OS']],
    ['라이프스타일', ['MBTI', '흡연 여부', '음주 여부', '운동 여부', '운전면허', '자동차 보유']],
  ]
  const toggle = (item) => setSelected((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])
  return (
    <section className="create-step basic-info-step">
      <span className="eyebrow">STEP 2 · 기본 정보</span>
      <h1>미리 저장된 정보로<br />질문 수를 줄여보세요.</h1>
      <p>선택한 정보는 응답자의 인증된 프로필에서 안전하게 가져와요.</p>
      <div className="verified-note"><Icon name="shield" /><span><b>학교·학과·학번은 학교 인증 정보 사용</b><small>응답자에게 다시 묻지 않아도 돼요.</small></span></div>
      <div className="basic-groups">
        {groups.map(([group, items]) => <section key={group}><h3>{group}</h3><div>{items.map((item) => <button type="button" key={item} className={selected.includes(item) ? 'is-selected' : ''} onClick={() => toggle(item)}>{item}{selected.includes(item) ? <Icon name="check" size={15} /> : <Icon name="plus" size={15} />}</button>)}</div></section>)}
      </div>
      <div className="auto-score-note"><Icon name="spark" /><p><b>{selected.length}개 정보를 매칭 점수에 활용해요</b><span>문항 수와 응답 대상 적합도를 바탕으로 교환할 설문을 추천합니다.</span></p></div>
    </section>
  )
}

function QuestionEditor({ question, index, onChange, onRemove }) {
  const [expanded, setExpanded] = useState(index === 0)
  const [settings, setSettings] = useState(false)
  const typeLabel = QUESTION_TYPES.find(([type]) => type === question.type)?.[1] || (question.type === 'section' ? '섹션' : '객관식')
  const optionUpdate = (key, optionIndex, value) => onChange({ [key]: question[key].map((item, indexValue) => indexValue === optionIndex ? value : item) })
  const optionRemove = (key, optionIndex) => onChange({ [key]: question[key].filter((_, indexValue) => indexValue !== optionIndex) })
  if (question.type === 'section') {
    return <article className="question-editor section-editor"><header><span>SECTION</span><button type="button" onClick={onRemove}><Icon name="trash" size={17} /></button></header><input value={question.text} onChange={(event) => onChange({ text: event.target.value })} placeholder="새 섹션 제목" /><textarea value={question.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="섹션 설명을 입력하세요." /></article>
  }
  return (
    <article className={`question-editor ${expanded ? 'is-expanded' : ''}`}>
      <header onClick={() => setExpanded(!expanded)}>
        <span><b>Q{index + 1}</b><small>{typeLabel}</small></span>
        <p>{question.text || '질문을 입력해 주세요.'}</p>
        <Icon name={expanded ? 'more' : 'chevron'} />
      </header>
      {expanded ? <div className="question-editor-body">
        <div className="question-main-input">
          <textarea value={question.text} onChange={(event) => onChange({ text: event.target.value })} placeholder="질문을 입력해 주세요." />
          <DesignSelect value={question.type} onChange={(type) => onChange({ type })} ariaLabel="질문 유형 선택" options={QUESTION_TYPES} />
        </div>
        <input className="question-description" value={question.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="질문 설명 추가 (선택)" />
        {CHOICE_TYPES.has(question.type) ? <OptionList values={question.options} onUpdate={(indexValue, value) => optionUpdate('options', indexValue, value)} onRemove={(indexValue) => optionRemove('options', indexValue)} onAdd={() => onChange({ options: [...question.options, `선택지 ${question.options.length + 1}`] })} /> : null}
        {GRID_TYPES.has(question.type) ? <div className="grid-editor"><OptionList label="행" values={question.rows} onUpdate={(indexValue, value) => optionUpdate('rows', indexValue, value)} onRemove={(indexValue) => optionRemove('rows', indexValue)} onAdd={() => onChange({ rows: [...question.rows, `행 ${question.rows.length + 1}`] })} /><OptionList label="열" values={question.columns} onUpdate={(indexValue, value) => optionUpdate('columns', indexValue, value)} onRemove={(indexValue) => optionRemove('columns', indexValue)} onAdd={() => onChange({ columns: [...question.columns, `열 ${question.columns.length + 1}`] })} /></div> : null}
        {question.type === 'scale' ? <div className="scale-editor"><DesignSelect compact value={question.min} onChange={(min) => onChange({ min: Number(min) })} ariaLabel="최소 배율" options={[0, 1]} /><span>부터</span><DesignSelect compact value={question.max} onChange={(max) => onChange({ max: Number(max) })} ariaLabel="최대 배율" options={[2, 3, 4, 5, 7, 10]} /><span>까지</span></div> : null}
        {question.type === 'file' ? <div className="file-setting"><Icon name="file" /><span><b>파일 업로드 문항</b><small>최대 파일 크기와 허용 형식은 게시 후 서버 정책에 따라 적용돼요.</small></span></div> : null}
        <div className="question-tools">
          <button type="button" onClick={() => onChange({ text: question.text ? `${question.text.replace(/[.?]$/, '')}에 대해 편하게 알려주세요.` : '평소 이 주제에 대해 어떻게 생각하시나요?' })}><Icon name="spark" size={16} /> AI로 말투 다듬기</button>
          <button type="button" onClick={() => setSettings(!settings)}><Icon name="filter" size={16} /> 세부 설정</button>
          <button type="button" onClick={onRemove}><Icon name="trash" size={16} /></button>
        </div>
        {settings ? <div className="question-settings">
          <Toggle label="필수 응답" checked={question.required} onChange={(value) => onChange({ required: value })} />
          {CHOICE_TYPES.has(question.type) ? <><Toggle label="답변 순서 섞기" checked={question.shuffle} onChange={(value) => onChange({ shuffle: value })} /><Toggle label="기타 직접 입력 허용" checked={question.other} onChange={(value) => onChange({ other: value })} /></> : null}
          <div><span>답변 유효성 검사</span><DesignSelect value={question.validation} onChange={(validation) => onChange({ validation })} ariaLabel="답변 유효성 검사" options={[['none', '사용 안 함'], ['email', '이메일 형식'], ['number', '숫자 범위'], ['length', '글자 수 제한'], ['regex', '정규식 검사']]} /></div>
          {question.type === 'single' || question.type === 'dropdown' ? <div><span>응답 후 이동</span><DesignSelect value={question.branch} onChange={(branch) => onChange({ branch })} ariaLabel="응답 후 이동" options={[['next', '다음 질문'], ['section2', '섹션 2로 이동'], ['end', '설문 종료']]} /></div> : null}
          <label><span>퀴즈 정답</span><input value={question.correctAnswer || ''} onChange={(event) => onChange({ correctAnswer: event.target.value })} placeholder="정답 또는 해설" /></label>
          <label><span>배점</span><input type="number" min="0" max="100" value={question.score || 0} onChange={(event) => onChange({ score: Number(event.target.value) })} /></label>
        </div> : null}
      </div> : null}
    </article>
  )
}

function OptionList({ values, onUpdate, onRemove, onAdd, label = '선택지' }) {
  return <div className="option-list">{label !== '선택지' ? <b>{label}</b> : null}{values.map((value, index) => <label key={`${label}-${index}`}><i>{index + 1}</i><input value={value} onChange={(event) => onUpdate(index, event.target.value)} /><button type="button" onClick={() => onRemove(index)}><Icon name="close" size={15} /></button></label>)}<button type="button" onClick={onAdd}><Icon name="plus" size={15} /> {label} 추가</button></div>
}

function ParticipateScreen({ survey, onBack, onComplete, isExchange }) {
  const questions = survey?.questions?.length ? survey.questions.filter((question) => question.type !== 'section').slice(0, 8) : demoQuestions
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const question = questions[index]
  const currentAnswer = answers[question?.id]
  const answered = question && (!question.required || (Array.isArray(currentAnswer) ? currentAnswer.length > 0 : currentAnswer !== undefined && currentAnswer !== ''))
  const update = (value) => setAnswers((current) => ({ ...current, [question.id]: value }))
  useEffect(() => {
    document.querySelector('.question-page')?.scrollTo({ top: 0, behavior: 'instant' })
  }, [index])
  const next = () => {
    if (index < questions.length - 1) setIndex(index + 1)
    else {
      setSubmitted(true)
      onComplete(survey.id, answers, isExchange)
    }
  }
  if (submitted) return <SurveySubmitted survey={survey} isExchange={isExchange} />
  return (
    <div className="screen participate-screen">
      <TopBar title="설문 참여" onBack={onBack} right={<button className="round-icon" type="button" aria-label="더보기"><Icon name="more" /></button>} />
      <div className="participate-progress"><span><b>{index + 1}</b> / {questions.length}</span><em>{Math.round((index + 1) / questions.length * 100)}%</em><Progress value={(index + 1) / questions.length * 100} /></div>
      <main className="page question-page">
        <span className="question-kicker">{survey.category} · 약 {survey.minutes}분</span>
        <h1>{question.text}</h1>
        {question.description ? <p>{question.description}</p> : <p>솔직한 생각을 편하게 골라주세요.</p>}
        <QuestionResponse question={question} value={currentAnswer} onChange={update} />
        {question.required && !answered ? <small className="required-hint">필수 질문이에요.</small> : null}
      </main>
      <footer className="participate-footer">
        <button type="button" className="secondary-button" disabled={index === 0} onClick={() => setIndex(index - 1)}>이전</button>
        <button type="button" className="primary-button" disabled={!answered} onClick={next}>{index === questions.length - 1 ? '응답 제출하기' : '다음'}</button>
      </footer>
    </div>
  )
}

function QuestionResponse({ question, value, onChange }) {
  if (question.type === 'long') return <textarea className="response-textarea" value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder="자유롭게 입력해 주세요." />
  if (question.type === 'short') return <input className="response-input" value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder="답변을 입력해 주세요." />
  if (question.type === 'multiple') return <div className="choice-list">{question.options.map((option) => {
    const selected = (value || []).includes(option)
    return <button type="button" className={selected ? 'is-selected' : ''} key={option} onClick={() => onChange(selected ? value.filter((item) => item !== option) : [...(value || []), option])}><i className="checkbox"><Icon name="check" size={14} /></i><span>{option}</span></button>
  })}</div>
  if (question.type === 'dropdown') return <div className="response-design-select"><DesignSelect value={value || ''} onChange={onChange} ariaLabel="답변 선택" options={[['', '선택해 주세요'], ...question.options]} /></div>
  if (question.type === 'scale') return <div className="response-scale"><div>{Array.from({ length: (question.max || 5) - (question.min || 1) + 1 }, (_, index) => index + (question.min || 1)).map((number) => <button type="button" className={value === number ? 'is-selected' : ''} key={number} onClick={() => onChange(number)}>{number}</button>)}</div><span><small>{question.minLabel || '낮음'}</small><small>{question.maxLabel || '높음'}</small></span></div>
  if (question.type === 'date') return <input className="response-input" type="date" value={value || ''} onChange={(event) => onChange(event.target.value)} />
  if (question.type === 'time') return <input className="response-input" type="time" value={value || ''} onChange={(event) => onChange(event.target.value)} />
  if (question.type === 'file') return <label className="response-upload"><Icon name="file" size={30} /><b>{value ? value.name : '파일을 선택해 주세요'}</b><small>이미지, PDF, 문서 파일을 올릴 수 있어요.</small><input type="file" onChange={(event) => onChange(event.target.files?.[0] || null)} /></label>
  if (GRID_TYPES.has(question.type)) return <div className="response-grid">{question.rows.map((row) => <section key={row}><b>{row}</b><div>{question.columns.map((column) => <button type="button" key={column} onClick={() => onChange({ ...(value || {}), [row]: column })} className={value?.[row] === column ? 'is-selected' : ''}>{column}</button>)}</div></section>)}</div>
  return <div className="choice-list">{question.options?.map((option) => <button type="button" className={value === option ? 'is-selected' : ''} key={option} onClick={() => onChange(option)}><i className="radio"><span /></i><span>{option}</span></button>)}</div>
}

function SurveySubmitted({ survey, isExchange }) {
  const [ready, setReady] = useState(!isExchange)
  return (
    <div className="screen submitted-screen">
      <TopBar title="응답 완료" />
      <main className="page success-state">
        <div className="success-mascot"><span>•ᴗ•</span><i><Icon name="check" size={26} /></i></div>
        <span className="eyebrow">{isExchange ? 'RESPONSE SAVED' : 'THANK YOU'}</span>
        <h1>{isExchange && !ready ? '응답을 안전하게 저장했어요' : '설문 참여를 완료했어요!'}</h1>
        <p>{isExchange && !ready ? '상대도 응답을 완료하면 교환이 확정되고 결과에 반영돼요.' : '다른 대학생들의 생각과 내 답변을 비교해 보세요.'}</p>
        {isExchange && !ready ? <section className="pending-exchange"><Icon name="clock" /><div><b>상대 응답을 기다리는 중</b><span>교환 완료 전에는 그래프와 통계에 포함되지 않아요.</span><Progress value={50} tone="purple" /></div></section> : null}
        {isExchange && !ready ? <button type="button" className="demo-button" onClick={() => setReady(true)}>프로토타입: 상대 응답 완료 처리</button> : null}
        {ready ? <button type="button" className="primary-button" onClick={() => window.dispatchEvent(new CustomEvent('suniversity-navigate', { detail: { screen: 'respondentResult', id: survey.id } }))}>비교 결과 보기</button> : <button type="button" className="secondary-button" onClick={() => window.dispatchEvent(new CustomEvent('suniversity-navigate', { detail: { screen: 'exchange' } }))}>교환 대기함으로</button>}
      </main>
    </div>
  )
}

function RespondentResultScreen({ survey, onBack, navigate }) {
  const [tab, setTab] = useState('summary')
  const groups = {
    gender: [['여성', 58], ['남성', 42]],
    mbti: [['ENFP', 31], ['INFP', 26], ['ENTJ', 18], ['기타', 25]],
    school: [['고려대', 37], ['홍익대', 24], ['연세대', 18], ['기타', 21]],
  }
  return (
    <div className="screen">
      <TopBar title="설문 결과" onBack={onBack} right={<button className="round-icon" type="button"><Icon name="share" /></button>} />
      <main className="page result-page">
        <span className="tag tag--blue">{survey.category}</span>
        <h1>{survey.title}</h1>
        <p>{survey.participants + 1}명의 답변을 바탕으로 분석했어요.</p>
        <div className="result-tabs"><button className={tab === 'summary' ? 'is-active' : ''} onClick={() => setTab('summary')}>요약</button><button className={tab === 'compare' ? 'is-active' : ''} onClick={() => setTab('compare')}>비교</button><button className={tab === 'insight' ? 'is-active' : ''} onClick={() => setTab('insight')}>인사이트</button></div>
        {tab === 'summary' ? <>
          <section className="answer-highlight"><span>나와 같은 답을 고른 사람</span><strong>35<small>%</small></strong><p>응답자 3명 중 1명은 나와 비슷하게 생각해요.</p></section>
          <section className="chart-card">
            <div className="section-title"><div><span>Q1 결과</span><h2>카페 이용 빈도</h2></div></div>
            <div className="donut-wrap"><div className="donut"><strong>85<small>명</small></strong></div><ul><li><i className="c1" />주 3~4회 <b>35%</b></li><li><i className="c2" />주 1~2회 <b>28%</b></li><li><i className="c3" />주 5회 이상 <b>21%</b></li><li><i className="c4" />기타 <b>16%</b></li></ul></div>
          </section>
          <section className="similar-card"><div className="mini-mascots"><i>•ᴗ•</i><i>•ᴗ•</i></div><div><b>ENFP 응답자와 가장 비슷해요</b><p>전체 답변 패턴이 82% 일치했어요.</p></div></section>
        </> : null}
        {tab === 'compare' ? <section className="compare-results">
          {Object.entries(groups).map(([key, values]) => <article key={key}><h3>{key === 'gender' ? '성별 비교' : key === 'mbti' ? 'MBTI 비교' : '학교별 비교'}</h3>{values.map(([label, value], index) => <span key={label}><small>{label}</small><Progress value={value} tone={index % 2 ? 'pink' : 'blue'} /><b>{value}%</b></span>)}</article>)}
        </section> : null}
        {tab === 'insight' ? <section className="insight-card"><Icon name="spark" size={25} /><span>AI 한 줄 인사이트</span><h2>카페는 음료를 마시는 곳보다<br />공부하고 머무는 공간에 가까워요.</h2><p>특히 3~4학년과 자취생 그룹에서 체류 시간이 길게 나타났어요.</p><button type="button">AI 심층 분석 보기 · 2,000원</button></section> : null}
        <button type="button" className="discussion-entry" onClick={() => navigate('discussion', survey.id)}><i><Icon name="users" /></i><span><b>응답자들과 이야기해 보세요</b><small>댓글 18개 · 익명 또는 닉네임으로 참여</small></span><Icon name="chevron" /></button>
      </main>
    </div>
  )
}

function CreatorResultsScreen({ survey, onBack, navigate }) {
  const [tab, setTab] = useState('summary')
  const responses = [
    ['2026-07-30 14:32', '주 3~4회', '좌석과 분위기', '4', '1~2시간'],
    ['2026-07-30 14:29', '주 1~2회', '가격', '3', '30분~1시간'],
    ['2026-07-30 14:21', '주 5회 이상', '콘센트·와이파이', '5', '2~3시간'],
  ]
  const downloadCsv = () => {
    const rows = [['응답 시간', '카페 빈도', '선택 기준', '선호도', '체류 시간'], ...responses]
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'suniversity-responses.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="screen creator-results-screen">
      <TopBar title="작성자 결과" onBack={onBack} right={<button className="round-icon" type="button" onClick={downloadCsv}><Icon name="download" /></button>} />
      <main className="page result-page">
        <span className="eyebrow">FREE RESULT</span>
        <h1>{survey.title}</h1>
        <div className="creator-summary"><span><b>{survey.participants || 53}</b><small>전체 응답</small></span><span><b>72%</b><small>목표 달성</small></span><span><b>{survey.minutes}:12</b><small>평균 시간</small></span></div>
        <div className="result-tabs"><button className={tab === 'summary' ? 'is-active' : ''} onClick={() => setTab('summary')}>요약</button><button className={tab === 'individual' ? 'is-active' : ''} onClick={() => setTab('individual')}>개별 응답</button><button className={tab === 'table' ? 'is-active' : ''} onClick={() => setTab('table')}>데이터 표</button></div>
        {tab === 'summary' ? <>
          <section className="chart-card"><div className="section-title"><div><span>질문 1</span><h2>카페 이용 빈도</h2></div></div><div className="donut-wrap"><div className="donut"><strong>53<small>명</small></strong></div><ul><li><i className="c1" />주 3~4회 <b>35%</b></li><li><i className="c2" />주 1~2회 <b>28%</b></li><li><i className="c3" />주 5회 이상 <b>21%</b></li><li><i className="c4" />기타 <b>16%</b></li></ul></div></section>
          <section className="bar-chart-card"><h3>질문별 응답 분포</h3><div className="vertical-bars">{[44, 68, 83, 61, 72].map((height, index) => <span key={height}><i style={{ height: `${height}%` }} /><small>Q{index + 1}</small></span>)}</div></section>
        </> : null}
        {tab === 'individual' ? <section className="individual-response"><header><button type="button"><Icon name="back" size={17} /></button><b>응답 1 / {responses.length}</b><button type="button"><Icon name="chevron" size={17} /></button></header>{responses[0].slice(1).map((value, index) => <div key={value}><small>Q{index + 1}</small><b>{value}</b></div>)}</section> : null}
        {tab === 'table' ? <section className="data-table-wrap"><table><thead><tr>{['응답 시간', '카페 빈도', '선택 기준', '선호도', '체류 시간'].map((head) => <th key={head}>{head}</th>)}</tr></thead><tbody>{responses.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table><button type="button" className="download-button" onClick={downloadCsv}><Icon name="download" /> CSV로 다운로드</button></section> : null}
        <button type="button" className="share-result-card" onClick={() => navigate('shareSurvey', survey.id)}><i><Icon name="share" /></i><span><b>설문 배포 및 공유</b><small>링크·QR 코드·외부 커뮤니티 공유</small></span><Icon name="chevron" /></button>
        <section className="premium-analysis"><Icon name="spark" /><div><b>AI로 더 깊게 분석해 보세요</b><p>핵심 인사이트부터 발표용 PPT까지 자동으로 만들 수 있어요.</p></div><button type="button">2,000원부터</button></section>
      </main>
    </div>
  )
}

function ShareSurveyScreen({ survey, onBack }) {
  const [copied, setCopied] = useState('')
  const link = `https://suniversity.kr/s/${survey.id}`
  const copy = (value, label) => {
    navigator.clipboard?.writeText(value)
    setCopied(label)
    window.setTimeout(() => setCopied(''), 1400)
  }
  const qrCells = Array.from({ length: 81 }, (_, index) => ((index * 7 + survey.id.length * 3) % 11) < 5)
  return (
    <div className="screen">
      <TopBar title="설문 공유" onBack={onBack} />
      <main className="page share-page">
        <span className="eyebrow">SHARE SURVEY</span>
        <h1>더 많은 대학생에게<br />설문을 알려보세요.</h1>
        <p>링크와 QR 코드는 모바일과 PC에서 모두 열려요.</p>
        <section className="share-survey-preview"><span className="tag tag--blue">{survey.category}</span><h2>{survey.title}</h2><small>{survey.questionCount}문항 · 약 {survey.minutes}분 · {survey.deadline} 마감</small></section>
        <section className="link-copy"><label>공유 링크</label><div><input readOnly value={link} /><button type="button" onClick={() => copy(link, '링크')}>{copied === '링크' ? <Icon name="check" /> : <Icon name="copy" />}</button></div></section>
        <section className="qr-card"><div className="qr-code">{qrCells.map((filled, index) => <i className={filled ? 'filled' : ''} key={index} />)}</div><div><b>QR 코드로 바로 참여</b><p>이미지로 저장해 포스터나 발표 자료에 넣어보세요.</p><button type="button">QR 이미지 저장</button></div></section>
        <section className="share-channels"><h3>외부로 공유하기</h3><div><button type="button" onClick={() => copy(link, '카카오톡')}><i className="kakao">K</i><span>카카오톡</span></button><button type="button" onClick={() => copy(link, '에브리타임')}><i className="every">E</i><span>에브리타임</span></button><button type="button" onClick={() => copy(link, '인스타그램')}><i className="insta">◎</i><span>인스타그램</span></button><button type="button" onClick={() => copy(link, '이메일')}><i className="mail">@</i><span>이메일</span></button></div></section>
        <section className="embed-card"><Icon name="copy" /><div><b>웹사이트에 설문 넣기</b><p>임베드 코드를 복사해 블로그나 팀 페이지에 붙여넣을 수 있어요.</p></div><button type="button" onClick={() => copy(`<iframe src="${link}"></iframe>`, '코드')}>{copied === '코드' ? '복사됨' : '코드 복사'}</button></section>
      </main>
      {copied ? <div className="toast"><Icon name="check" size={17} />{copied}를 복사했어요</div> : null}
    </div>
  )
}

function TeamScreen({ onBack }) {
  const [copied, setCopied] = useState(false)
  const members = [
    ['나경', '설문 관리자', 4, 4],
    ['서빈', '공동 편집자', 3, 4],
    ['지민', '응답 참여자', 4, 4],
    ['도윤', '응답 참여자', 2, 4],
  ]
  return (
    <div className="screen">
      <TopBar title="팀 워크스페이스" onBack={onBack} right={<button className="round-icon" type="button"><Icon name="more" /></button>} />
      <main className="page team-page">
        <section className="team-hero"><span className="team-big-avatar">C</span><div><span className="tag tag--purple">4명 참여 중</span><h1>캡스톤 A팀</h1><p>대학생 AI 활용 실태 조사</p></div></section>
        <section className="team-progress-card"><div><span>팀 응답 진행률</span><strong>81<small>%</small></strong></div><Progress value={81} tone="purple" /><p>교환 중인 설문 2개 · 남은 응답 3개</p></section>
        <section>
          <div className="section-title"><div><span>MEMBERS</span><h2>팀원별 진행 현황</h2></div><button type="button" onClick={() => { navigator.clipboard?.writeText('SUNI-TEAM-4A2'); setCopied(true) }}>{copied ? '초대 코드 복사됨' : '팀원 초대'}</button></div>
          <div className="member-list">{members.map(([name, role, done, total], index) => <article key={name}><span className={`member-avatar m${index}`}>{name.slice(0, 1)}</span><div><b>{name}{index === 0 ? ' (나)' : ''}</b><small>{role}</small></div><em>{done}/{total} 완료</em><Progress value={done / total * 100} tone={index % 2 ? 'pink' : 'blue'} /></article>)}</div>
        </section>
        <section className="team-permissions"><h3>팀 권한</h3><button type="button"><Icon name="edit" /><span><b>공동 설문 편집</b><small>관리자와 편집자 2명</small></span><Icon name="chevron" /></button><button type="button"><Icon name="exchange" /><span><b>팀 교환 신청</b><small>관리자만 신청 가능</small></span><Icon name="chevron" /></button></section>
      </main>
    </div>
  )
}

function NotificationsScreen({ navigate, notifications, setNotifications }) {
  const readAll = () => setNotifications((current) => current.map((notice) => ({ ...notice, read: true })))
  return (
    <div className="screen has-nav">
      <TopBar title="알림" right={<button className="text-button" type="button" onClick={readAll}>모두 읽음</button>} />
      <main className="page notifications-page">
        <div className="notification-day">오늘</div>
        <div className="notification-list">{notifications.map((notice) => <button type="button" key={notice.id} className={notice.read ? 'is-read' : ''} onClick={() => { setNotifications((current) => current.map((item) => item.id === notice.id ? { ...item, read: true } : item)); navigate('exchange') }}><i><Icon name={notice.type === 'complete' ? 'check' : notice.type === 'deadline' ? 'clock' : 'exchange'} /></i><span><b>{notice.title}</b><p>{notice.body}</p><small>{notice.time}</small></span>{!notice.read ? <em /> : null}</button>)}</div>
        <section className="notification-setting"><Icon name="bell" /><span><b>알림 설정</b><small>교환 요청과 마감 알림을 관리해요.</small></span><Icon name="chevron" /></section>
      </main>
      <BottomNav active="notifications" navigate={navigate} unread={0} />
    </div>
  )
}

function ProfileScreen({ navigate, profile, surveys, favoriteIds, requests }) {
  const mySurvey = surveys.find((survey) => survey.mine) || { ...surveys[0], id: 'my-demo', title: '대학생의 AI 활용과 취업 준비', participants: 53, mine: true }
  return (
    <div className="screen has-nav">
      <TopBar title="마이페이지" />
      <main className="page profile-page">
        <section className="profile-head"><div className="profile-avatar">나</div><div><h1>{profile.name}</h1><p><Icon name="shield" size={14} /> {profile.university} · 인증 완료</p><span>{profile.major}</span></div></section>
        <section className="trust-card"><div><span>나의 신뢰도</span><strong>{profile.trust}<small>%</small></strong><em>★★★★★</em></div><Progress value={profile.trust} tone="purple" /><p>성실한 교환 12회 · 받은 후기 8개</p></section>
        <section className="profile-stats"><span><b>{surveys.filter((survey) => survey.mine).length || 1}</b><small>만든 설문</small></span><span><b>27</b><small>참여 설문</small></span><span><b>{requests.length}</b><small>진행 교환</small></span></section>
        <section className="profile-menu">
          <button type="button" onClick={() => navigate('mySurveys', mySurvey.id)}><i className="blue"><Icon name="clipboard" /></i><span><b>내 설문 관리</b><small>결과·공유·편집·응답 마감</small></span><Icon name="chevron" /></button>
          <button type="button" onClick={() => navigate('team')}><i className="purple"><Icon name="team" /></i><span><b>팀 워크스페이스</b><small>팀원 {profile.teamSize}명 · 공동 관리</small></span><Icon name="chevron" /></button>
          <button type="button" onClick={() => navigate('exchangeHistory')}><i className="pink"><Icon name="exchange" /></i><span><b>교환 기록</b><small>완료 12회 · 진행 {requests.length}회</small></span><Icon name="chevron" /></button>
          <button type="button" onClick={() => navigate('favorites')}><i className="cream"><Icon name="heart" /></i><span><b>즐겨찾기 유저</b><small>{favoriteIds.length || 2}명 · 원클릭 교환 가능</small></span><Icon name="chevron" /></button>
        </section>
        <section className="profile-menu compact">
          <button type="button" onClick={() => navigate('profileEdit')}><span><b>기본 정보 관리</b><small>자동 매칭과 설문 응답에 활용</small></span><Icon name="chevron" /></button>
          <button type="button" onClick={() => navigate('schoolVerification')}><span><b>학교 인증 정보</b><small>{profile.university}</small></span><Icon name="chevron" /></button>
          <button type="button"><span><b>신고 및 이용 정책</b><small>건강한 설문 교환을 위한 기준</small></span><Icon name="chevron" /></button>
        </section>
      </main>
      <BottomNav active="profile" navigate={navigate} />
    </div>
  )
}

function ProfileEditScreen({ profile, setProfile, onBack }) {
  const [draft, setDraft] = useState(profile)
  const fields = [
    ['학년', 'grade', ['1학년', '2학년', '3학년', '4학년', '대학원생']],
    ['성별', 'gender', ['여성', '남성', '응답하지 않음']],
    ['재학 여부', 'status', ['재학', '휴학', '졸업유예', '졸업']],
    ['주거 형태', 'housing', ['기숙사', '자취', '통학']],
    ['월 용돈', 'allowance', ['20만원 미만', '20~40만원', '40~60만원', '60만원 이상']],
    ['스마트폰 OS', 'os', ['iPhone', 'Android']],
    ['MBTI', 'mbti', ['ENFP', 'INFP', 'ENTJ', 'INTJ', 'ESTJ', '기타']],
  ]
  return (
    <div className="screen">
      <TopBar title="기본 정보 관리" onBack={onBack} right={<button className="text-button" type="button" onClick={() => { setProfile(draft); onBack() }}>저장</button>} />
      <main className="page edit-profile-page">
        <section className="verified-profile"><Icon name="shield" /><div><b>학교 인증 정보</b><p>{profile.university}<br />{profile.major} · {profile.studentId}</p></div><span>인증 완료</span></section>
        <p className="privacy-copy">입력한 정보는 응답 대상 확인과 매칭 점수 계산에 사용돼요. 설문 작성자가 선택한 항목만 익명으로 전달됩니다.</p>
        <div className="profile-form">{fields.map(([label, key, options]) => <label key={key}><span>{label}</span><select value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>)}<label><span>거주 지역</span><input value={draft.region} onChange={(event) => setDraft({ ...draft, region: event.target.value })} /></label></div>
        <section className="lifestyle-options"><h3>라이프스타일</h3>{[['흡연', 'smoking'], ['음주', 'drinking'], ['운동', 'exercise'], ['운전면허', 'license'], ['자동차', 'car']].map(([label, key]) => <label key={key}><span>{label}</span><input value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label>)}</section>
      </main>
    </div>
  )
}

function MySurveysScreen({ surveys, selectedSurvey, navigate, onBack }) {
  const mine = surveys.filter((survey) => survey.mine)
  const list = mine.length ? mine : [{ ...selectedSurvey, id: 'my-demo', mine: true, title: '대학생의 AI 활용과 취업 준비', participants: 53, target: 100 }]
  const [closedIds, setClosedIds] = useStoredState('suniversity-closed-surveys', [])
  const hasDraft = Boolean(localStorage.getItem('suniversity-new-draft'))
  const toggleClosed = (id) => setClosedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  return (
    <div className="screen">
      <TopBar title="내 설문 관리" onBack={onBack} right={<button type="button" className="round-icon" onClick={() => navigate('create')}><Icon name="plus" /></button>} />
      <main className="page manage-page">
        <section className="manage-summary"><span><b>{list.length}</b><small>게시한 설문</small></span><span><b>{list.reduce((sum, survey) => sum + survey.participants, 0)}</b><small>모은 응답</small></span><span><b>2</b><small>진행 교환</small></span></section>
        {hasDraft ? <button type="button" className="draft-banner" onClick={() => navigate('create')}><i><Icon name="edit" /></i><span><b>작성 중인 임시저장이 있어요</b><small>이어서 문항을 완성해 보세요.</small></span><Icon name="chevron" /></button> : null}
        <div className="section-title"><div><span>MY SURVEYS</span><h2>게시한 설문</h2></div></div>
        <div className="manage-survey-list">{list.map((survey) => {
          const closed = closedIds.includes(survey.id)
          return <article key={survey.id}>
            <header><span className={`tag ${closed ? 'tag--gray' : 'tag--blue'}`}>{closed ? '응답 마감' : '응답 수집 중'}</span><small>{survey.deadline} 마감</small></header>
            <h3>{survey.title}</h3>
            <p>{survey.questionCount}문항 · 응답 {survey.participants}/{survey.target}명</p>
            <Progress value={survey.participants / survey.target * 100} />
            <div><button type="button" onClick={() => navigate('creatorResults', survey.id)}><Icon name="chart" /> 결과</button><button type="button" onClick={() => navigate('shareSurvey', survey.id)}><Icon name="share" /> 공유</button><button type="button" onClick={() => navigate('create')}><Icon name="edit" /> 수정</button><button type="button" className={closed ? '' : 'danger'} onClick={() => toggleClosed(survey.id)}>{closed ? '다시 받기' : '응답 마감'}</button></div>
          </article>
        })}</div>
      </main>
    </div>
  )
}

function FavoritesScreen({ onBack, navigate }) {
  const [noticeIds, setNoticeIds] = useStoredState('suniversity-favorite-notices', ['favorite-1'])
  const users = [
    { id: 'favorite-1', name: '디자인씽킹 3팀', school: '고려대학교', trust: 96, exchanges: 7, surveyId: 'coffee', color: 'blue' },
    { id: 'favorite-2', name: '소비자행동 연구팀', school: '홍익대학교', trust: 89, exchanges: 4, surveyId: 'subscription', color: 'pink' },
  ]
  const toggleNotice = (id) => setNoticeIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  return (
    <div className="screen">
      <TopBar title="즐겨찾기 유저" onBack={onBack} />
      <main className="page favorites-page">
        <div className="favorite-guide"><Icon name="heart" /><p><b>신뢰하는 팀과 빠르게 다시 교환해요</b><span>새 설문 알림을 켜두면 등록 즉시 알려드려요.</span></p></div>
        <div className="favorite-list">{users.map((user) => <article key={user.id}>
          <span className={`favorite-avatar ${user.color}`}>{user.name.slice(0, 1)}</span>
          <div><h3>{user.name}</h3><p>{user.school} · 신뢰도 {user.trust}%</p><small>함께 완료한 교환 {user.exchanges}회</small></div>
          <button type="button" className={noticeIds.includes(user.id) ? 'notice-on' : ''} onClick={() => toggleNotice(user.id)} aria-label="새 설문 알림"><Icon name="bell" size={18} /></button>
          <button type="button" className="quick-exchange" onClick={() => navigate('surveyDetail', user.surveyId)}>새 설문 보고 교환하기 <Icon name="chevron" size={15} /></button>
        </article>)}</div>
      </main>
    </div>
  )
}

function ExchangeHistoryScreen({ requests, onBack, navigate }) {
  const [filter, setFilter] = useState('all')
  const completedItems = [
    { id: 'history-1', title: '대학생 팀 프로젝트 협업 조사', partner: 'UX리서치팀', type: '팀 교환 · 4명', status: 'completed', date: '2026-07-24', trust: 98 },
    { id: 'history-2', title: 'OTT 구독 서비스 이용 조사', partner: '미디어랩', type: '개인 교환', status: 'completed', date: '2026-07-18', trust: 91 },
  ]
  const items = [...requests, ...completedItems].filter((item) => filter === 'all' || item.status === filter)
  return (
    <div className="screen">
      <TopBar title="교환 기록" onBack={onBack} />
      <main className="page history-page">
        <div className="segmented history-tabs"><button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>전체</button><button type="button" className={filter === 'completed' ? 'is-active' : ''} onClick={() => setFilter('completed')}>완료</button></div>
        <section className="history-stats"><span><b>12</b><small>완료 교환</small></span><span><b>94%</b><small>평균 신뢰도</small></span><span><b>48명</b><small>확보 응답</small></span></section>
        <div className="history-list">{items.map((item) => <button type="button" key={item.id} onClick={() => item.surveyId ? navigate('exchangeStatus', item.id) : null}><span className={`history-status ${item.status}`}>{item.status === 'completed' ? <Icon name="check" /> : item.status === 'rejected' || item.status === 'cancelled' ? <Icon name="close" /> : <Icon name="clock" />}</span><div><b>{item.title}</b><p>{item.partner} · {item.type}</p><small>{item.date || item.deadline} {item.trust ? `· 신뢰도 ${item.trust}%` : ''}</small></div><Icon name="chevron" /></button>)}</div>
      </main>
    </div>
  )
}

function SchoolVerificationScreen({ profile, onBack }) {
  const [editing, setEditing] = useState(false)
  const [phone, setPhone] = useState('010-12••-56••')
  const [email, setEmail] = useState('student@korea.ac.kr')
  const [codeSent, setCodeSent] = useState(false)
  const [verified, setVerified] = useState(true)
  return (
    <div className="screen">
      <TopBar title="학교 인증 정보" onBack={onBack} />
      <main className="page verification-page">
        {!editing ? <>
          <div className="verification-hero"><i><Icon name="shield" size={33} /></i><span className="tag tag--blue">인증 완료</span><h1>대학생 인증이<br />안전하게 완료됐어요.</h1><p>신뢰할 수 있는 대학생 설문 커뮤니티를 위해 학교 정보를 확인하고 있어요.</p></div>
          <section className="verified-data"><span><small>학교</small><b>{profile.university}</b></span><span><small>학과</small><b>{profile.major}</b></span><span><small>학번</small><b>{profile.studentId}</b></span><span><small>휴대전화</small><b>{phone}</b></span></section>
          <button type="button" className="secondary-button verification-retry" onClick={() => setEditing(true)}>인증 정보 다시 확인하기</button>
        </> : <>
          <span className="eyebrow">RE-VERIFY</span><h1 className="verification-title">전화번호와 학교 이메일을 확인해 주세요.</h1>
          <label className="form-field"><span>휴대전화</span><input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          <label className="form-field"><span>대학교 이메일</span><input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <button type="button" className="send-code-button" onClick={() => setCodeSent(true)}>{codeSent ? '인증번호를 다시 보냈어요' : '학교 이메일로 인증번호 받기'}</button>
          {codeSent ? <label className="form-field"><span>인증번호</span><input placeholder="6자리 인증번호" maxLength={6} /></label> : null}
          <label className="agreement"><input type="checkbox" defaultChecked /><span>대학생 인증 및 중복 계정 방지를 위한 정보 처리에 동의해요.</span></label>
          <button type="button" className="primary-button verification-submit" disabled={!codeSent} onClick={() => { setVerified(true); setEditing(false) }}>{verified ? '인증 정보 갱신하기' : '인증 완료하기'}</button>
        </>}
      </main>
    </div>
  )
}

function DiscussionScreen({ survey, onBack }) {
  const [identity, setIdentity] = useState('anonymous')
  const [comment, setComment] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [reply, setReply] = useState('')
  const [comments, setComments] = useStoredState(`suniversity-comments-${survey.id}`, [
    { id: 'c1', author: '익명 퍼즐 12', school: '', text: '저는 콘센트랑 좌석 간격이 제일 중요했어요. 과제할 때 오래 머무르게 되더라고요.', likes: 14, liked: false, team: 'blue', replies: [{ id: 'r1', author: '나경 · 고려대', text: '맞아요! 저도 비슷하게 답했어요.' }] },
    { id: 'c2', author: '민지 · 홍익대', school: '홍익대학교', text: '가격도 중요하지만 요즘은 조용한 분위기를 더 먼저 보게 되는 것 같아요.', likes: 9, liked: false, team: 'pink', replies: [] },
  ])
  const addComment = () => {
    if (!comment.trim()) return
    setComments((current) => [{ id: `c-${Date.now()}`, author: identity === 'anonymous' ? `익명 퍼즐 ${Math.floor(Math.random() * 90 + 10)}` : '나경 · 고려대', text: comment.trim(), likes: 0, liked: false, team: 'purple', replies: [] }, ...current])
    setComment('')
  }
  const toggleLike = (id) => setComments((current) => current.map((item) => item.id === id ? { ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) } : item))
  const toggleReplyLike = (commentId, replyId) => setComments((current) => current.map((item) => item.id === commentId ? {
    ...item,
    replies: item.replies.map((nested) => nested.id === replyId ? {
      ...nested,
      liked: !nested.liked,
      likes: (nested.likes || 0) + (nested.liked ? -1 : 1),
    } : nested),
  } : item))
  const startReply = (commentId, targetId, author) => {
    setReplyTo((current) => current?.commentId === commentId && current?.targetId === targetId ? null : { commentId, targetId, author })
    setReply('')
  }
  const addReply = (id) => {
    if (!reply.trim()) return
    setComments((current) => current.map((item) => item.id === id ? {
      ...item,
      replies: [...item.replies, {
        id: `r-${Date.now()}`,
        author: identity === 'anonymous' ? '익명 퍼즐' : '나경 · 고려대',
        text: reply.trim(),
        likes: 0,
        liked: false,
        replyTo: replyTo?.targetId === item.id ? '' : replyTo?.author,
      }],
    } : item))
    setReply('')
    setReplyTo(null)
  }
  return (
    <div className="screen discussion-screen">
      <TopBar title="설문 이야기" onBack={onBack} right={<button className="round-icon" type="button"><Icon name="more" /></button>} />
      <main className="page discussion-page">
        <section className="discussion-topic"><span className="tag tag--blue">{survey.category}</span><h1>{survey.title}</h1><p>서로 다른 답을 존중하며 자유롭게 이야기해 보세요.</p></section>
        <div className="identity-selector"><span>댓글 작성 이름</span><button type="button" className={identity === 'anonymous' ? 'is-active' : ''} onClick={() => setIdentity('anonymous')}>익명 퍼즐</button><button type="button" className={identity === 'nickname' ? 'is-active' : ''} onClick={() => setIdentity('nickname')}>나경 · 고려대</button></div>
        <section className="comment-composer"><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="이 설문에 대한 생각을 남겨보세요." /><button type="button" disabled={!comment.trim()} onClick={addComment}>등록</button></section>
        <div className="discussion-head"><b>댓글 {comments.length + comments.reduce((sum, item) => sum + item.replies.length, 0)}개</b><span>공감순</span></div>
        <div className="comment-list">{comments.map((item) => <article key={item.id} className={`team-${item.team}`}>
          <header><span className="comment-avatar">{item.author.slice(0, 1)}</span><div><b>{item.author}</b><small>방금 전</small></div><button type="button"><Icon name="more" size={17} /></button></header>
          <p>{item.text}</p>
          <footer><button type="button" className={item.liked ? 'is-liked' : ''} onClick={() => toggleLike(item.id)}><Icon name="heart" size={15} /> 공감 {item.likes}</button><button type="button" className={replyTo?.targetId === item.id ? 'is-replying' : ''} onClick={() => startReply(item.id, item.id, item.author)}><Icon name="message" size={15} /> 답글 {item.replies.length}</button></footer>
          <div className="comment-replies">{item.replies.map((nested) => <div className="comment-reply" key={nested.id}>
            <Icon name="chevron" size={14} />
            <span>
              <b>{nested.author}</b>
              <p>{nested.replyTo ? <em>@{nested.replyTo}</em> : null}{nested.text}</p>
              <footer><button type="button" className={nested.liked ? 'is-liked' : ''} onClick={() => toggleReplyLike(item.id, nested.id)}><Icon name="heart" size={13} /> 공감 {nested.likes || 0}</button><button type="button" className={replyTo?.targetId === nested.id ? 'is-replying' : ''} onClick={() => startReply(item.id, nested.id, nested.author)}><Icon name="message" size={13} /> 답글</button></footer>
            </span>
          </div>)}</div>
          {replyTo?.commentId === item.id ? <div className="reply-composer"><span>{replyTo.targetId === item.id ? '댓글에 답글 쓰는 중' : `@${replyTo.author} 님에게 답글 쓰는 중`}</span><div><input value={reply} autoFocus onChange={(event) => setReply(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) addReply(item.id) }} placeholder="답글을 입력해 주세요." /><button type="button" disabled={!reply.trim()} onClick={() => addReply(item.id)}>등록</button></div></div> : null}
        </article>)}</div>
      </main>
    </div>
  )
}

function ExchangeStatusScreen({ request, onBack, setRequests }) {
  const [rated, setRated] = useState(0)
  if (!request) return null
  const complete = request.ours === request.people && request.theirs === request.people
  const simulate = () => setRequests((current) => current.map((item) => item.id === request.id ? { ...item, theirs: item.people, ours: item.people, status: 'completed' } : item))
  return (
    <div className="screen">
      <TopBar title="교환 진행 상황" onBack={onBack} />
      <main className="page status-page">
        <div className="status-visual"><span>•ᴗ•</span><i><Icon name="exchange" /></i><span>•ᴗ•</span></div>
        <span className={`tag ${complete ? 'tag--blue' : 'tag--purple'}`}>{complete ? '교환 완료' : '응답 진행 중'}</span>
        <h1>{request.title}</h1>
        <p>{request.partner}와 {request.type} · {request.people}명 참여</p>
        <section className="status-timeline"><span className="done"><i><Icon name="check" /></i><div><b>교환 성사</b><small>양측이 교환 조건을 확인했어요.</small></div></span><span className={request.ours === request.people ? 'done' : ''}><i>{request.ours === request.people ? <Icon name="check" /> : '2'}</i><div><b>우리 팀 응답</b><small>{request.ours}/{request.people}명 완료</small><Progress value={request.ours / request.people * 100} /></div></span><span className={request.theirs === request.people ? 'done' : ''}><i>{request.theirs === request.people ? <Icon name="check" /> : '3'}</i><div><b>상대 팀 응답</b><small>{request.theirs}/{request.people}명 완료</small><Progress value={request.theirs / request.people * 100} tone="pink" /></div></span><span className={complete ? 'done' : ''}><i>{complete ? <Icon name="check" /> : '4'}</i><div><b>결과 반영</b><small>{complete ? '응답과 통계에 반영됐어요.' : '양측 완료 후 자동으로 반영돼요.'}</small></div></span></section>
        {!complete ? <button type="button" className="demo-button" onClick={simulate}>프로토타입: 양측 응답 완료 처리</button> : <section className="rating-card"><h3>이번 교환은 어땠나요?</h3><p>평가는 상대 팀의 신뢰도에 반영돼요.</p><div>{[1, 2, 3, 4, 5].map((star) => <button type="button" className={rated >= star ? 'is-active' : ''} onClick={() => setRated(star)} key={star}><Icon name="star" /></button>)}</div>{rated ? <small>평가를 저장했어요. 간단한 후기는 마이페이지에서 남길 수 있어요.</small> : null}</section>}
      </main>
    </div>
  )
}

function ExchangeHelpScreen({ onBack }) {
  return (
    <div className="screen">
      <TopBar title="교환 도움말" onBack={onBack} />
      <main className="page help-page">
        <span className="eyebrow">HOW IT WORKS</span>
        <h1>설문 교환은<br />이렇게 진행돼요.</h1>
        <section className="help-flow">{[['1', '교환 신청', '직접 고르거나 자동 매칭으로 상대를 찾아요.'], ['2', '서로 응답', '개인은 1:1, 팀은 선택한 인원만큼 참여해요.'], ['3', '양측 완료', '한쪽만 끝내면 결과에 아직 반영되지 않아요.'], ['4', '결과 반영', '모두 완료된 응답만 그래프와 통계에 포함돼요.']].map(([number, title, text]) => <span key={number}><i>{number}</i><p><b>{title}</b><small>{text}</small></p></span>)}</section>
        <section className="help-rules"><h2>꼭 알아두세요</h2><details open><summary>직접 교환은 누구에게 신청할 수 있나요?</summary><p>내 설문과 같은 문항 수 구간 또는 더 높은 구간의 설문에만 신청할 수 있어요.</p></details><details><summary>자동 매칭은 어떤 기준으로 찾나요?</summary><p>같은 문항 수 구간을 필수로 적용하고, 팀 참여 인원·신뢰도·기본 정보 적합도를 함께 비교해요.</p></details><details><summary>신청이 너무 많이 오면 어떻게 되나요?</summary><p>하나의 설문이 받을 수 있는 미완료 신청은 최대 10개예요.</p></details><details><summary>마감이 가까워지면 어떻게 되나요?</summary><p>마감 24시간 전까지 성사되지 않은 교환 신청은 자동으로 취소돼요.</p></details></section>
      </main>
    </div>
  )
}

function App() {
  const [screen, setScreen] = useState('home')
  const [selectedId, setSelectedId] = useState(null)
  const [screenMeta, setScreenMeta] = useState({})
  const [surveys, setSurveys] = useStoredState('suniversity-new-surveys', initialSurveys)
  const [completed, setCompleted] = useStoredState('suniversity-new-completed', [])
  const [requests, setRequests] = useStoredState('suniversity-new-requests', initialRequests)
  const [notifications, setNotifications] = useStoredState('suniversity-new-notifications', initialNotifications)
  const [profile, setProfile] = useStoredState('suniversity-new-profile', defaultProfile)
  const [favorites, setFavorites] = useStoredState('suniversity-new-favorites', [])
  const [, setAnswers] = useStoredState('suniversity-new-answers', {})
  const [previousScreen, setPreviousScreen] = useState('home')
  const selectedSurvey = surveys.find((survey) => survey.id === selectedId) || surveys[0]
  const selectedRequest = requests.find((request) => request.id === selectedId)
  const unread = notifications.filter((notice) => !notice.read).length
  useEffect(() => {
    const cutoff = Date.now() + 86400000
    setRequests((current) => current.map((request) => {
      const shouldCancel = request.deadlineISO && new Date(`${request.deadlineISO}T00:00:00`).getTime() <= cutoff && ['incoming', 'requested'].includes(request.status)
      return shouldCancel ? { ...request, status: 'cancelled' } : request
    }))
  }, [setRequests])

  const navigate = (next, id = null, meta = {}) => {
    setPreviousScreen(screen)
    setScreen(next)
    setSelectedId(id)
    setScreenMeta(meta)
    window.scrollTo(0, 0)
  }
  const back = () => {
    setScreen(previousScreen || 'home')
    window.scrollTo(0, 0)
  }
  useEffect(() => {
    const handler = (event) => navigate(event.detail.screen, event.detail.id)
    window.addEventListener('suniversity-navigate', handler)
    return () => window.removeEventListener('suniversity-navigate', handler)
  })
  const publishSurvey = (survey) => {
    setSurveys((current) => [survey, ...current.filter((item) => item.id !== survey.id)])
    navigate('creatorResults', survey.id)
  }
  const completeSurvey = (surveyId, response, isExchange) => {
    setCompleted((current) => [...new Set([...current, surveyId])])
    setAnswers((current) => ({ ...current, [surveyId]: response }))
    if (isExchange && screenMeta.exchangeId) {
      setRequests((current) => current.map((request) => request.id === screenMeta.exchangeId ? { ...request, ours: request.people, status: 'waiting-partner' } : request))
    }
  }
  const addRequest = (survey, mode, people) => {
    const request = { id: `exchange-${Date.now()}`, type: mode === 'team' ? '팀 교환' : '개인 교환', status: 'requested', surveyId: survey.id, title: survey.title, partner: survey.owner, people: mode === 'team' ? people : 1, ours: 0, theirs: 0, deadline: survey.deadline.slice(5).replace('-', '월 ') + '일', deadlineISO: survey.deadline }
    setRequests((current) => [request, ...current].slice(0, 10))
  }

  const common = { navigate, surveys, requests, setRequests, profile, unread, notifications, setNotifications }
  if (screen === 'home') return <HomeScreen {...common} completed={completed} />
  if (screen === 'exchange') return <ExchangeScreen {...common} />
  if (screen === 'surveyDetail') return <SurveyDetailScreen survey={selectedSurvey} onBack={back} navigate={navigate} profile={profile} onRequest={addRequest} completed={completed.includes(selectedSurvey.id)} favorite={favorites.includes(selectedSurvey.id)} onFavorite={(id) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} />
  if (screen === 'autoMatch') return <AutoMatchScreen onBack={back} profile={profile} surveys={surveys} navigate={navigate} onMatched={addRequest} />
  if (screen === 'create') return <CreateSurveyScreen onBack={back} profile={profile} onPublish={publishSurvey} />
  if (screen === 'participate') return <ParticipateScreen survey={selectedSurvey} onBack={back} onComplete={completeSurvey} isExchange={Boolean(screenMeta.exchangeId)} />
  if (screen === 'respondentResult') return <RespondentResultScreen survey={selectedSurvey} onBack={() => navigate('home')} navigate={navigate} />
  if (screen === 'creatorResults') return <CreatorResultsScreen survey={selectedSurvey} onBack={() => navigate('profile')} navigate={navigate} />
  if (screen === 'shareSurvey') return <ShareSurveyScreen survey={selectedSurvey} onBack={back} />
  if (screen === 'team') return <TeamScreen onBack={back} />
  if (screen === 'notifications') return <NotificationsScreen navigate={navigate} notifications={notifications} setNotifications={setNotifications} />
  if (screen === 'profile') return <ProfileScreen {...common} favoriteIds={favorites} />
  if (screen === 'profileEdit') return <ProfileEditScreen profile={profile} setProfile={setProfile} onBack={back} />
  if (screen === 'mySurveys') return <MySurveysScreen surveys={surveys} selectedSurvey={selectedSurvey} navigate={navigate} onBack={back} />
  if (screen === 'favorites') return <FavoritesScreen onBack={back} navigate={navigate} />
  if (screen === 'exchangeHistory') return <ExchangeHistoryScreen requests={requests} onBack={back} navigate={navigate} />
  if (screen === 'schoolVerification') return <SchoolVerificationScreen profile={profile} onBack={back} />
  if (screen === 'discussion') return <DiscussionScreen survey={selectedSurvey} onBack={back} />
  if (screen === 'exchangeStatus') return <ExchangeStatusScreen request={selectedRequest} onBack={back} setRequests={setRequests} />
  if (screen === 'exchangeHelp') return <ExchangeHelpScreen onBack={back} />
  return <HomeScreen {...common} completed={completed} />
}

export default App
