/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import NotificationPopover from './components/notifications/NotificationPopover'
import DesignSelect from './components/ui/DesignSelect'
import Icon from './components/ui/Icon'
import aiHeroBackground from './assets/ai-hero-background.svg'
import aiHeroButton from './assets/ai-hero-button.svg'
import aiHeroPuzzle from './assets/ai-hero-puzzle.svg'
import autoMatchPuzzleBlue from './assets/auto-match-puzzle-blue.svg'
import autoMatchPuzzlesCombined from './assets/auto-match-puzzles-combined.svg'
import respondentSimilarPuzzles from './assets/respondent-similar-puzzles.svg'
import miniPuzzleBlue from './assets/mini-puzzle-blue-flat.svg'
import miniPuzzlePink from './assets/mini-puzzle-pink-flat.svg'
import puzzleMainComplete from './assets/puzzle-main-complete.svg'
import './App.css'
import './styles/interaction-polish.css'

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
const DAY_MS = 86400000
const HOUR_MS = 3600000
const TERMINAL_REQUEST_STATUSES = new Set(['completed', 'rejected', 'cancelled', 'expired'])

function toInputDate(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 10)
}

const TODAY = toInputDate(new Date())
const DEFAULT_DEADLINE = toInputDate(new Date(Date.now() + DAY_MS * 14))

function getDeadlineState(deadline) {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(deadline || '')
  const endAt = valid ? new Date(`${deadline}T23:59:59.999`).getTime() : Number.NaN
  if (Number.isNaN(endAt)) {
    return { missing: true, expired: false, within24Hours: false, days: null, hours: null, remaining: null, label: '마감일 미정' }
  }
  const remaining = endAt - Date.now()
  const expired = remaining < 0
  const within24Hours = !expired && remaining <= DAY_MS
  const days = expired ? 0 : Math.max(1, Math.ceil(remaining / DAY_MS))
  const hours = expired ? 0 : Math.max(1, Math.ceil(remaining / HOUR_MS))
  return {
    missing: false,
    expired,
    within24Hours,
    days,
    hours,
    remaining,
    label: expired ? '마감됨' : within24Hours ? `${hours}시간 남음` : `${days}일 남음`,
  }
}

function formatDeadline(deadline) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline || '')) return '마감일 미정'
  const [, month, day] = deadline.split('-')
  return `${Number(month)}월 ${Number(day)}일`
}

function isSurveyClosed(survey) {
  return Boolean(survey?.closed) || getDeadlineState(survey?.deadline).expired
}

const initialSurveys = [
  {
    id: 'coffee',
    createdAt: '2026-08-02T09:30:00+09:00',
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
    createdAt: '2026-08-01T18:10:00+09:00',
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
    createdAt: '2026-07-31T14:20:00+09:00',
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

function BrandMark({ compact = false }) {
  return (
    <div className={compact ? 'brand brand--compact' : 'brand'}>
      <span className="brand-puzzle brand-puzzle--layers" aria-hidden="true">
        <img className="puzzle-layer puzzle-layer--complete" src={puzzleMainComplete} alt="" />
      </span>
      <strong><b>SUN</b>iVERSiTY</strong>
    </div>
  )
}

function MiniPuzzlePair() {
  return (
    <span className="mini-mascots mini-mascots--svg" aria-hidden="true">
      <img className="mini-puzzle-blue" src={miniPuzzleBlue} alt="" />
      <img className="mini-puzzle-pink" src={miniPuzzlePink} alt="" />
    </span>
  )
}

function TopBar({ title, onBack, right, brand = false }) {
  if (brand) {
    return (
      <header className="topbar topbar--brand">
        <BrandMark compact />
        {right || <span className="topbar-space" />}
      </header>
    )
  }
  return (
    <header className="topbar">
      {onBack ? <button className="round-icon" type="button" onClick={onBack} aria-label="뒤로 가기"><Icon name="back" /></button> : <span className="topbar-space" />}
      <strong>{title}</strong>
      {right || <span className="topbar-space" />}
    </header>
  )
}

function BottomNav({ active, navigate }) {
  const items = [
    ['home', '홈', 'home'],
    ['community', '커뮤니티', 'users'],
    ['createHub', '설문 만들기', 'plus'],
    ['exchange', '설문 교환', 'exchange'],
  ]
  const activeIndex = Math.max(0, items.findIndex(([id]) => id === active))
  const selectTab = (id) => {
    if (id === active) return
    navigate(id)
  }

  return (
    <nav
      className="bottom-nav"
      aria-label="주요 메뉴"
      style={{ '--active-tab': activeIndex }}
    >
      <span className="bottom-nav__indicator" aria-hidden="true">
        <Icon
          name={items[activeIndex][2]}
          size={items[activeIndex][0] === 'createHub' ? 27 : 25}
        />
      </span>
      {items.map(([id, label, icon], index) => (
        <button
          key={id}
          type="button"
          className={`${activeIndex === index ? 'is-active' : ''} ${id === 'createHub' ? 'nav-create' : ''}`}
          aria-current={active === id ? 'page' : undefined}
          aria-label={label}
          onClick={() => selectTab(id)}
        >
          <span><Icon name={icon} size={id === 'createHub' ? 27 : 25} /></span>
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
  const deadlineState = getDeadlineState(survey.deadline)
  const closed = isSurveyClosed(survey)
  const exchangeClosing = exchange && deadlineState.within24Hours
  return (
    <article className={`survey-card ${completed ? 'is-completed' : ''} ${closed ? 'is-closed' : ''} ${exchangeClosing ? 'is-exchange-closing' : ''}`}>
      <button type="button" className="survey-card-main" onClick={onOpen}>
        <div className="survey-card-tags">
          {survey.hot ? <span className="tag tag--pink">HOT</span> : null}
          <span className="tag tag--blue">{survey.category}</span>
          {closed ? <span className="tag tag--gray">마감됨</span> : null}
          {exchangeClosing ? <span className="tag tag--orange">교환 마감</span> : null}
          {exchange ? <span className="tag tag--purple">매칭 {survey.matchScore}점</span> : null}
        </div>
        <h3>{survey.title}</h3>
        <p>{survey.description}</p>
        <div className="survey-card-meta">
          <span><Icon name="clipboard" size={15} />{survey.questionCount}문항 · 약 {survey.minutes}분</span>
          <span className={deadlineState.expired ? 'is-closed-label' : !deadlineState.missing && deadlineState.days <= 3 ? 'is-urgent' : ''}><Icon name="clock" size={15} />{deadlineState.label}</span>
        </div>
        <Progress value={survey.participants / survey.target * 100} tone={completed ? 'gray' : 'blue'} />
        <div className="survey-card-foot">
          <small>{survey.owner} · 신뢰도 {survey.trust}%</small>
          <strong>{closed ? '응답 마감' : completed ? '참여 완료' : exchange ? exchangeClosing ? '신규 교환 불가' : eligible ? '교환 가능' : '조건 불일치' : `${survey.participants}/${survey.target}명`}</strong>
        </div>
      </button>
    </article>
  )
}

function HomeScreen({ navigate, surveys, completed, profile, unread, notifications, setNotifications }) {
  const [query, setQuery] = useState('')
  const [notificationOpen, setNotificationOpen] = useState(false)
  const visible = surveys
    .filter((survey) => `${survey.title} ${survey.category}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => Number(isSurveyClosed(a)) - Number(isSurveyClosed(b)))

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
          <img className="ai-hero__background" src={aiHeroBackground} alt="" aria-hidden="true" />
          <svg className="ai-hero__outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path vectorEffect="non-scaling-stroke" d="M8 1.8C26 1.1 39 2.5 55 1.7C70 1 86 1.3 92 2.4C96.4 3.4 98.3 7.1 98.1 13C97.7 31 98.8 47 98 64C97.3 80 98.1 89 95.1 94C92.4 98.2 87 98.4 80 98C61 97.2 45 98.8 28 98C16 97.5 8.2 98.7 4.3 94.4C1.1 90.8 1.8 84 1.9 76C2.2 58 1.1 42 2 25C2.4 14 1.2 7.5 4.7 4.2C5.6 3.3 6.7 2.5 8 1.8Z" />
          </svg>
          <div>
            <span><Icon name="spark" size={16} /> AI 자동 설문 제작</span>
            <h2>아이디어만 말하면<br /><em>AI</em>가 설문을<br />완성해드려요.</h2>
            <p>대화로 목적과 대상을 정하고,<br />제목·문항을 한 번에 자동 생성해요.</p>
            <button type="button" onClick={() => navigate('aiCreate')}><img src={aiHeroButton} alt="" aria-hidden="true" /><span>AI와 대화 시작</span><Icon name="chevron" size={16} /></button>
          </div>
          <img className="ai-hero__puzzle" src={aiHeroPuzzle} alt="" aria-hidden="true" />
        </section>

        <section className="exchange-snapshot">
          <div className="section-title">
            <div><span>교환 진행 중</span><h2>서로의 설문을 완성하는 중이에요</h2></div>
            <button type="button" onClick={() => navigate('exchange')}>전체보기</button>
          </div>
          <button type="button" className="snapshot-card" onClick={() => navigate('exchange')}>
            <MiniPuzzlePair />
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

function CommunityScreen({ navigate, surveys, completed }) {
  const [feed, setFeed] = useState('hot')
  const [topic, setTopic] = useState('전체')
  const [query, setQuery] = useState('')
  const [liked, setLiked] = useStoredState('suniversity-community-likes', [])
  const topics = [
    { name: '전체', caption: '모든 주제', icon: 'grid' },
    { name: '대학생활', caption: '캠퍼스', icon: 'users' },
    { name: '진로·취업', caption: '커리어', icon: 'clipboard' },
    { name: '소비', caption: '생활·소비', icon: 'heart' },
    { name: 'IT·서비스', caption: '디지털', icon: 'spark' },
    { name: '연구·논문', caption: '학술 조사', icon: 'chart' },
  ]
  const visible = [...surveys]
    .filter((survey) => !isSurveyClosed(survey))
    .filter((survey) => topic === '전체' || survey.category === topic)
    .filter((survey) => `${survey.title} ${survey.description} ${survey.category}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => feed === 'hot'
      ? Number(b.hot) - Number(a.hot) || (b.participants / b.target) - (a.participants / a.target)
      : new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

  const toggleLike = (id) => setLiked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  return (
    <div className="screen has-nav community-screen">
      <TopBar title="커뮤니티" />
      <main className="page community-page">
        <section className="community-category-panel">
          <span>관심 분야를 골라보세요</span>
          <h1>어떤 이야기가<br /><em>궁금한가요?</em></h1>
          <p>카테고리를 선택하면 관련 설문만 모아볼 수 있어요.</p>
          <div className="community-category-grid" aria-label="설문 카테고리">
            {topics.map((item) => (
              <button type="button" key={item.name} className={topic === item.name ? 'is-active' : ''} aria-pressed={topic === item.name} onClick={() => setTopic(item.name)}>
                <i><Icon name={item.icon} size={20} /></i>
                <b>{item.name}</b>
                <small>{item.caption}</small>
              </button>
            ))}
          </div>
        </section>

        <div className="community-feed-tabs" role="tablist" aria-label="커뮤니티 설문 분류">
          <button type="button" role="tab" aria-selected={feed === 'hot'} className={feed === 'hot' ? 'is-active' : ''} onClick={() => setFeed('hot')}><Icon name="spark" size={18} /><span><b>핫한 설문</b><small>지금 반응이 많아요</small></span></button>
          <button type="button" role="tab" aria-selected={feed === 'recent'} className={feed === 'recent' ? 'is-active' : ''} onClick={() => setFeed('recent')}><Icon name="clock" size={18} /><span><b>최근 등록</b><small>새로운 설문이에요</small></span></button>
        </div>

        <label className="search-field community-search"><Icon name="search" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="커뮤니티 설문 검색" /></label>

        <section className="community-feed" aria-live="polite">
          <div className="community-feed-title"><span>{feed === 'hot' ? '🔥 HOT NOW' : '🆕 JUST POSTED'}</span><b>{visible.length}개의 설문</b></div>
          {visible.map((survey, index) => (
            <article className="community-post" key={survey.id}>
              <header>
                <span className="community-avatar">{survey.owner.slice(0, 1)}</span>
                <div><b>{survey.owner}</b><small>{survey.mine ? '방금 전' : `${index + 1}시간 전`} · {survey.category}</small></div>
                {survey.matchScore >= 90 ? <span className="community-ai-badge"><Icon name="spark" size={12} /> AI 추천</span> : null}
              </header>
              <SurveyCard survey={survey} completed={completed.includes(survey.id)} onOpen={() => navigate('surveyDetail', survey.id)} />
              <footer>
                <button type="button" className={liked.includes(survey.id) ? 'is-liked' : ''} onClick={() => toggleLike(survey.id)}><Icon name="heart" size={16} /> 공감 {12 + index * 7 + Number(liked.includes(survey.id))}</button>
                <button type="button" onClick={() => navigate('discussion', survey.id)}><Icon name="message" size={16} /> 이야기 {5 + index * 3}</button>
                <button type="button" onClick={() => navigate('surveyDetail', survey.id)}>설문 보기 <Icon name="chevron" size={14} /></button>
              </footer>
            </article>
          ))}
          {!visible.length ? <div className="community-empty"><Icon name="search" /><b>조건에 맞는 설문이 없어요</b><p>다른 주제나 검색어로 다시 찾아보세요.</p><button type="button" onClick={() => { setTopic('전체'); setQuery('') }}>필터 초기화</button></div> : null}
        </section>
      </main>
      <button className="community-create-fab" type="button" onClick={() => navigate('create')} aria-label="직접 설문 만들기"><Icon name="plus" size={25} /></button>
      <BottomNav active="community" navigate={navigate} />
    </div>
  )
}

function CreateHubScreen({ navigate }) {
  const hasDraft = Boolean(localStorage.getItem('suniversity-new-draft'))

  return (
    <div className="screen has-nav create-hub-screen">
      <TopBar title="설문 만들기" />
      <main className="page create-hub-page">
        <section className="create-hub-intro">
          <span><Icon name="plus" size={14} /> CREATE SURVEY</span>
          <h1>나에게 맞는 방식으로<br /><em>설문을 시작해요.</em></h1>
          <p>AI와 대화하며 빠르게 만들거나, 원하는 문항을 직접 구성할 수 있어요.</p>
        </section>

        <section className="create-methods" aria-label="설문 제작 방식 선택">
          <button className="create-method create-method--ai" type="button" onClick={() => navigate('aiCreate')}>
            <span className="create-method-badge"><Icon name="spark" size={12} /> 첫 번째 추천</span>
            <i><Icon name="spark" size={27} /></i>
            <div><b>AI와 대화하며 만들기</b><p>목적과 대상만 알려주면 제목과 문항을 함께 완성해요.</p><small>약 1분 · 처음 만드는 분께 추천</small></div>
            <Icon name="chevron" size={18} />
          </button>
          <button className="create-method create-method--manual" type="button" onClick={() => navigate('create')}>
            <i><Icon name="edit" size={25} /></i>
            <div><b>직접 설계하기</b><p>질문 유형과 세부 설정을 하나씩 자유롭게 구성해요.</p><small>세밀한 설정이 필요할 때</small></div>
            <Icon name="chevron" size={18} />
          </button>
        </section>

        {hasDraft ? <button type="button" className="create-hub-draft" onClick={() => navigate('create')}><i><Icon name="file" size={20} /></i><span><b>작성 중인 설문이 있어요</b><small>임시저장한 내용부터 이어서 작성하기</small></span><Icon name="chevron" size={17} /></button> : null}

        <section className="create-hub-tip"><Icon name="spark" size={18} /><div><b>무엇을 고를지 고민되나요?</b><p>처음이라면 AI 제작을 선택해 보세요. 완성된 문항은 직접 수정할 수 있어요.</p></div></section>
      </main>
      <BottomNav active="createHub" navigate={navigate} />
    </div>
  )
}

function ExchangeScreen({ navigate, surveys, requests, setRequests, profile }) {
  const [tab, setTab] = useState('recommend')
  const [sort, setSort] = useState('score')
  const recommended = surveys
    .filter((survey) => !isSurveyClosed(survey) && !getDeadlineState(survey.deadline).within24Hours)
    .sort((a, b) => sort === 'score' ? b.matchScore - a.matchScore : new Date(a.deadline) - new Date(b.deadline))
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
              <DesignSelect value={sort} onChange={setSort} options={[["score", "매칭 점수순"], ["deadline", "마감일순"]]} ariaLabel="정렬" compact />
            </div>
            <div className="matching-rule"><Icon name="shield" size={18} /><p><b>내 설문: 11~15문항</b><span>같거나 더 높은 구간에만 직접 교환을 신청할 수 있어요.</span></p></div>
            <div className="survey-stack">
              {recommended.map((survey) => <SurveyCard key={survey.id} survey={survey} exchange eligible={survey.questionCount >= 11} onOpen={() => navigate('surveyDetail', survey.id)} />)}
              {!recommended.length ? <div className="empty-surveys"><Icon name="clock" /><b>지금 교환 가능한 설문이 없어요</b><p>마감까지 24시간 이상 남은 설문이 등록되면 여기에 보여드릴게요.</p></div> : null}
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
    expired: ['기한 만료', 'gray'],
  }
  const decideRequest = (requestId, accepted) => {
    setRequests((current) => current.map((request) => request.id === requestId ? { ...request, status: accepted ? 'waiting-me' : 'rejected' } : request))
  }
  return (
    <section className={compact ? 'queue queue--compact' : 'queue'}>
      {!compact ? <div className="queue-guide"><Icon name="clock" /><p><b>마감 24시간 전 자동 취소</b><span>성사되지 않은 신청은 자동으로 정리돼요. 미완료 신청은 설문당 최대 10개예요.</span></p></div> : null}
      <div className="queue-list">
        {requests.map((request) => {
          const [defaultLabel, tone] = labels[request.status] || labels.requested
          const label = request.status === 'cancelled' && request.cancelReason === 'owner-closed' ? '작성자 마감' : defaultLabel
          return (
            <article key={request.id}>
              <header><span className={`tag tag--${tone}`}>{label}</span><small>{request.type} · {request.deadline} 마감</small></header>
              <h3>{request.title}</h3>
              <p>{request.partner} · {request.people}명 교환</p>
              <div className="dual-progress">
                <span><small>우리 팀</small><b>{request.ours}/{request.people}명</b><Progress value={request.ours / request.people * 100} /></span>
                <span><small>상대 팀</small><b>{request.theirs}/{request.people}명</b><Progress value={request.theirs / request.people * 100} tone="purple" /></span>
              </div>
              {request.status === 'incoming' ? <div className="request-actions"><button type="button" onClick={() => decideRequest(request.id, false)}>거절</button><button type="button" onClick={() => decideRequest(request.id, true)}>수락</button></div> : <button type="button" disabled={['rejected', 'cancelled', 'expired'].includes(request.status)} onClick={() => request.status === 'waiting-me' ? navigate('participate', request.surveyId, { exchangeId: request.id }) : navigate('exchangeStatus', request.id)}>
                {request.status === 'waiting-me' ? '상대 설문 참여하기' : request.status === 'rejected' ? '거절한 신청' : request.status === 'cancelled' ? request.cancelReason === 'owner-closed' ? '작성자가 설문을 마감했어요' : '마감 24시간 전 자동 취소' : request.status === 'expired' ? '설문 마감으로 교환 종료' : '진행 상황 보기'} <Icon name="chevron" size={16} />
              </button>}
            </article>
          )
        })}
        {!requests.length ? <div className="queue-empty"><Icon name="exchange" size={28} /><b>진행 중인 교환이 없어요</b><p>추천 설문에서 교환을 신청하거나 자동 매칭을 시작해 보세요.</p><button type="button" onClick={() => navigate('exchange')}>추천 설문 보기</button></div> : null}
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
  const [requestError, setRequestError] = useState('')
  if (!survey) return null
  const deadlineState = getDeadlineState(survey.deadline)
  const closed = isSurveyClosed(survey)
  const exchangeClosing = deadlineState.within24Hours && !closed
  const canExchange = survey.questionCount >= 11 && !closed && !exchangeClosing && !completed && !survey.mine
  const exchangeLabel = closed
    ? '교환 마감'
    : exchangeClosing
      ? '교환 신청 종료'
      : completed
        ? '참여 완료'
        : survey.mine
          ? '내 설문'
          : canExchange
            ? '교환 신청'
            : '교환 조건 불일치'
  const submit = () => {
    if (!canExchange) return
    const result = onRequest(survey, mode, people)
    if (result?.ok === false) {
      setRequestError(result.message)
      return
    }
    setRequestError('')
    setSent(true)
  }
  return (
    <div className="screen">
      <TopBar title="설문 상세" onBack={onBack} right={<button type="button" className="round-icon" onClick={() => setReportOpen(true)} aria-label="설문 더보기"><Icon name="more" /></button>} />
      <main className="page detail-page">
        <div className="detail-tags"><span className="tag tag--blue">{survey.category}</span>{survey.hot ? <span className="tag tag--pink">HOT</span> : null}{closed ? <span className="tag tag--gray">응답 마감</span> : null}</div>
        <h1>{survey.title}</h1>
        <p className="detail-description">{survey.description}</p>
        {closed ? <section className="closed-notice"><Icon name="clock" /><div><b>이 설문은 응답이 마감됐어요</b><p>{completed ? '내가 참여한 결과는 계속 확인할 수 있어요.' : '새로운 응답과 교환 신청은 더 이상 받지 않아요.'}</p></div></section> : null}
        {exchangeClosing ? <section className="deadline-warning"><Icon name="clock" /><div><b>교환 신청은 종료됐어요</b><p>마감까지 {deadlineState.hours}시간 남아 신규 교환은 어렵지만, 일반 설문 참여는 마감 전까지 가능해요.</p></div></section> : null}
        <div className="owner-row"><span className="owner-avatar">{survey.owner.slice(0, 1)}</span><div><b>{survey.owner}</b><small><Icon name="shield" size={13} /> 신뢰도 {survey.trust}%</small></div><button type="button" className={favorite ? 'is-favorite' : ''} onClick={() => onFavorite(survey.id)}>{favorite ? '즐겨찾기 됨' : '즐겨찾기'}</button></div>
        <section className="detail-stats">
          <span><Icon name="clipboard" /><b>{survey.questionCount}문항</b><small>{survey.band}</small></span>
          <span><Icon name="clock" /><b>{deadlineState.label}</b><small>{formatDeadline(survey.deadline)} 마감</small></span>
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
        <button type="button" className="secondary-button" disabled={!canExchange} onClick={() => setExchangeModal(true)}>{exchangeLabel}</button>
        <button type="button" className="primary-button" disabled={closed && !completed} onClick={() => navigate(completed ? 'respondentResult' : 'participate', survey.id)}>{completed ? '내 응답 결과 보기' : closed ? '응답 마감' : '바로 참여하기'}</button>
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
            {requestError ? <div className="inline-error" role="alert"><Icon name="clock" size={15} />{requestError}</div> : null}
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
  const [matchError, setMatchError] = useState('')
  const match = surveys.find((survey) => !survey.mine && !isSurveyClosed(survey) && !getDeadlineState(survey.deadline).within24Hours)
  const start = () => {
    if (!match) return
    setPhase('searching')
    window.setTimeout(() => setPhase('matched'), 1300)
  }
  return (
    <div className="screen">
      <TopBar title="자동 매칭" onBack={onBack} right={phase === 'setup' ? <button className="top-step top-step--button" type="button" onClick={() => navigate('team')}>설정</button> : <span className="top-step">{phase === 'searching' ? '탐색' : '완료'}</span>} />
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
          {!match ? <div className="auto-empty"><Icon name="clock" /><span><b>매칭 가능한 설문이 없어요</b><small>교환 마감까지 24시간 이상 남은 설문이 필요해요.</small></span></div> : null}
          {matchError ? <div className="inline-error" role="alert"><Icon name="clock" size={15} />{matchError}</div> : null}
          <button type="button" className="primary-button bottom-cta" disabled={!match} onClick={start}>자동 매칭 시작</button>
        </> : null}
        {phase === 'searching' ? <div className="matching-search"><div className="orbit orbit--puzzle"><img src={autoMatchPuzzleBlue} alt="" /><i /><i /><i /></div><h1>가장 잘 맞는 팀을<br />찾고 있어요</h1><p>문항 수, 참여 인원, 신뢰도를 비교하고 있어요.</p><div className="search-steps"><span className="done"><Icon name="check" /> 문항 수 구간 확인</span><span className="done"><Icon name="check" /> 참여 인원 확인</span><span><i className="loader" /> 매칭 점수 계산</span></div></div> : null}
        {phase === 'matched' && match ? <div className="match-result">
          <div className="celebrate celebrate--puzzles"><i>✦</i><img src={autoMatchPuzzlesCombined} alt="" /><i>✦</i></div>
          <span className="eyebrow">MATCH FOUND</span>
          <h1>딱 맞는 팀을 찾았어요!</h1>
          <p>매칭 점수와 교환 조건을 확인해 주세요.</p>
          <article>
            <header><span className="owner-avatar">{match.owner.slice(0, 1)}</span><div><b>{match.owner}</b><small>신뢰도 {match.trust}% · 교환 완료율 91%</small></div><strong>{match.matchScore}점</strong></header>
            <h2>{match.title}</h2>
            <div><span>{match.band}</span><span>{mode === 'team' ? `${people}명 교환` : '1:1 교환'}</span><span>{match.minutes}분 예상</span></div>
          </article>
          <div className="match-result-actions"><button type="button" className="secondary-button" onClick={() => { setMatchError(''); setPhase('setup') }}>다시 찾기</button><button type="button" className="primary-button" onClick={() => { const result = onMatched(match, mode, people); if (result?.ok === false) { setMatchError(result.message); setPhase('setup'); return } navigate('exchange') }}>이 팀과 교환하기</button></div>
        </div> : null}
      </main>
    </div>
  )
}

function AISurveyChatScreen({ onBack, onGenerate, navigate }) {
  const [messages, setMessages] = useState([
    { id: 'welcome', role: 'ai', text: '안녕하세요! 저는 설문 메이트 수니예요. 어떤 목적으로 설문을 만들고 싶나요?' },
  ])
  const [stage, setStage] = useState('purpose')
  const [input, setInput] = useState('')
  const [purpose, setPurpose] = useState('')
  const [audience, setAudience] = useState('')
  const [questionCount, setQuestionCount] = useState(5)
  const chatEnd = useRef(null)
  const replyTimer = useRef(null)

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, stage])
  useEffect(() => () => window.clearTimeout(replyTimer.current), [])

  const addAiReply = (text, nextStage) => {
    setStage('thinking')
    window.clearTimeout(replyTimer.current)
    replyTimer.current = window.setTimeout(() => {
      setMessages((current) => [...current, { id: `ai-${Date.now()}`, role: 'ai', text }])
      setStage(nextStage)
    }, 480)
  }

  const submitAnswer = (answer) => {
    const value = answer.trim()
    if (!value || stage === 'thinking' || stage === 'ready') return
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', text: value }])
    setInput('')
    if (stage === 'purpose') {
      setPurpose(value)
      addAiReply(`좋아요. “${value}”에 맞춰볼게요. 이 설문은 누구의 답변이 가장 필요한가요?`, 'audience')
      return
    }
    if (stage === 'audience') {
      setAudience(value)
      addAiReply(`${value}이 편하게 답할 수 있는 말투로 만들게요. 설문 길이는 어느 정도가 좋을까요?`, 'count')
      return
    }
    const count = Math.min(10, Math.max(3, Number(value.replace(/[^0-9]/g, '')) || 5))
    setQuestionCount(count)
    addAiReply(`${count}문항으로 핵심만 정리했어요. 제목과 질문을 미리 확인한 뒤 바로 편집할 수 있어요.`, 'ready')
  }

  const restartConversation = () => {
    window.clearTimeout(replyTimer.current)
    setMessages([{ id: `welcome-${Date.now()}`, role: 'ai', text: '좋아요. 처음부터 다시 맞춰볼게요. 어떤 목적으로 설문을 만들고 싶나요?' }])
    setStage('purpose')
    setInput('')
    setPurpose('')
    setAudience('')
    setQuestionCount(5)
  }

  const subject = purpose.replace(/\s*(에 대한|관련)?\s*조사\s*$/u, '').trim() || '대학생의 일상'
  const generatedTitle = `${subject}, 우리는 어떻게 생각할까요?`
  const questionTemplates = [
    ['single', `${subject}에 얼마나 관심이 있나요?`, ['매우 관심 있어요', '조금 관심 있어요', '보통이에요', '별로 관심 없어요']],
    ['single', `${subject} 관련 경험은 얼마나 자주 있나요?`, ['거의 매일', '주 3~4회', '주 1~2회', '거의 없어요']],
    ['multiple', `${subject}에서 중요하게 보는 점을 모두 골라주세요.`, ['편리함', '가격', '경험의 질', '주변의 추천']],
    ['scale', `지금 느끼는 ${subject} 만족도는 어느 정도인가요?`, []],
    ['single', `${subject} 관련 선택에서 가장 큰 영향을 주는 건 무엇인가요?`, ['내 필요', '친구 추천', '온라인 후기', '가격']],
    ['multiple', `${subject}과 관련해 불편했던 점이 있다면 골라주세요.`, ['정보가 부족해요', '비용이 부담돼요', '시간이 부족해요', '딱히 없어요']],
    ['single', `앞으로 ${subject} 관련 활동을 더 자주 할 생각이 있나요?`, ['매우 있어요', '조금 있어요', '잘 모르겠어요', '별로 없어요']],
    ['long', `${subject}이 더 좋아지려면 무엇이 바뀌면 좋을까요?`, []],
    ['single', `${subject}, 친구에게 추천하고 싶나요?`, ['꼭 추천하고 싶어요', '상황에 따라 추천해요', '잘 모르겠어요', '추천하지 않을 것 같아요']],
    ['long', `${subject}에 대해 마지막으로 들려주고 싶은 이야기가 있나요?`, []],
  ]
  const generatedQuestions = questionTemplates.slice(0, questionCount).map(([type, text, options], index) => ({
    id: `ai-q-${Date.now()}-${index}`,
    type,
    text,
    description: '',
    options: options.length ? options : ['선택지 1', '선택지 2'],
    rows: ['행 1', '행 2'],
    columns: ['열 1', '열 2'],
    required: index < Math.max(1, questionCount - 1),
    shuffle: false,
    other: false,
    validation: 'none',
    min: 1,
    max: 5,
    branch: 'next',
  }))

  const useGeneratedSurvey = () => onGenerate({
    step: 3,
    title: generatedTitle,
    description: `${audience || '대학생'}의 ${subject} 경험과 생각을 알아보기 위한 설문입니다. 편하게 답해주세요.`,
    category: subject.includes('취업') ? '진로·취업' : subject.includes('소비') ? '소비' : '대학생활',
    deadline: DEFAULT_DEADLINE,
    basicFields: ['학년', '성별', '재학 여부'],
    questions: generatedQuestions,
    teamSurvey: false,
    publicResult: true,
    collectEmail: false,
    oneResponse: true,
    allowEdit: false,
    quizMode: false,
    confirmationMessage: '응답해 주셔서 감사합니다!',
  })

  const quickReplies = stage === 'purpose'
    ? ['대학생 소비 습관 조사', '취업 준비 경험', '학교생활 만족도']
    : stage === 'audience'
      ? ['전체 대학생', '재학생', '취업 준비생']
      : stage === 'count'
        ? ['5문항', '7문항', '10문항']
        : []
  const progress = stage === 'purpose' ? 25 : stage === 'audience' ? 50 : stage === 'count' || stage === 'thinking' ? 75 : 100

  return (
    <div className="screen ai-chat-screen">
      <TopBar title="AI 설문 만들기" onBack={onBack} right={<span className="ai-top-badge"><Icon name="spark" size={12} /> AI BETA</span>} />
      <div className="ai-chat-progress"><i style={{ width: `${progress}%` }} /></div>
      <main className="page ai-chat-page">
        <section className="ai-chat-intro">
          <div className="ai-orb"><img src={miniPuzzleBlue} alt="" /><Icon name="message" size={18} /></div>
          <div><span>AI SURVEY MATE</span><h1>대화하면서<br />설문을 완성해요.</h1><p>목적과 대상만 알려주면 제목부터 문항까지 자동으로 구성해 드려요.</p></div>
        </section>

        <section className="ai-conversation" aria-live="polite">
          {messages.map((message) => <article className={`chat-message chat-message--${message.role}`} key={message.id}>
            {message.role === 'ai' ? <span className="chat-avatar"><img src={miniPuzzleBlue} alt="" /></span> : null}
            <div>{message.role === 'ai' ? <small><Icon name="spark" size={11} /> 수니 AI</small> : null}<p>{message.text}</p></div>
          </article>)}
          {stage === 'thinking' ? <article className="chat-message chat-message--ai"><span className="chat-avatar"><img src={miniPuzzleBlue} alt="" /></span><div className="typing-bubble" aria-label="AI가 답변을 작성 중"><i /><i /><i /></div></article> : null}
          {stage === 'ready' ? <article className="ai-generated-preview">
            <header><span><Icon name="spark" size={14} /> AI 자동 생성 완료</span><b>{generatedQuestions.length}문항 · 약 {Math.max(1, Math.ceil(generatedQuestions.length * .45))}분</b></header>
            <h2>{generatedTitle}</h2>
            <p>{audience || '대학생'}을 대상으로 쉬운 대화체 문항을 구성했어요.</p>
            <ol>{generatedQuestions.slice(0, 3).map((question) => <li key={question.id}>{question.text}</li>)}</ol>
            {generatedQuestions.length > 3 ? <small>외 {generatedQuestions.length - 3}개 문항이 더 있어요.</small> : null}
            <button type="button" className="primary-button" onClick={useGeneratedSurvey}><Icon name="spark" size={17} /> 자동 생성 설문 편집하기</button>
          </article> : null}
          <div ref={chatEnd} />
        </section>

        {quickReplies.length ? <div className="ai-quick-replies">{quickReplies.map((reply) => <button type="button" key={reply} onClick={() => submitAnswer(reply)}>{reply}<Icon name="chevron" size={13} /></button>)}</div> : null}
      </main>
      <footer className="ai-chat-composer">
        {stage === 'ready' ? <div className="ai-ready-actions"><button type="button" onClick={restartConversation}><Icon name="back" size={14} /> 조건 다시 정하기</button><button type="button" className="manual-create-link" onClick={() => navigate('create')}>직접 만들기 <Icon name="chevron" size={14} /></button></div> : <>
          <input aria-label="AI 설문 도우미에게 메시지 보내기" value={input} disabled={stage === 'thinking'} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) submitAnswer(input) }} placeholder={stage === 'purpose' ? '설문 목적을 입력해 주세요' : stage === 'audience' ? '응답 대상을 입력해 주세요' : '3~10개 사이 문항 수를 입력해 주세요'} />
          <button type="button" disabled={!input.trim() || stage === 'thinking'} onClick={() => submitAnswer(input)} aria-label="메시지 보내기"><Icon name="chevron" /></button>
        </>}
      </footer>
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
  const [deadline, setDeadline] = useState(savedDraft?.deadline && savedDraft.deadline >= TODAY ? savedDraft.deadline : DEFAULT_DEADLINE)
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
  const draftDeadlineState = getDeadlineState(deadline)
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
      createdAt: new Date().toISOString(),
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
            <label className="form-field"><span>마감 기한</span><input type="date" value={deadline} min={TODAY} onChange={(event) => setDeadline(event.target.value)} /></label>
          </div>
          <div className={`deadline-note ${draftDeadlineState.within24Hours ? 'is-urgent' : ''}`}><Icon name="clock" /><span><b>{draftDeadlineState.within24Hours ? '교환을 신청받기에는 기간이 짧아요' : '마감 24시간 전 교환 자동 종료'}</b><small>{draftDeadlineState.within24Hours ? '일반 응답은 받을 수 있지만 새 교환 신청은 노출되지 않아요.' : '성사되지 않은 교환 신청은 자동 취소돼요.'}</small></span></div>
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
          <section className="publish-preview"><span className="tag tag--blue">{category}</span><h2>{title}</h2><p>{description || '설문 설명이 아직 없어요.'}</p><div><span>{questions.length}문항</span><span>약 {Math.max(1, Math.ceil(questions.length * .45))}분</span><span>{formatDeadline(deadline)} 마감</span></div></section>
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
  const closed = isSurveyClosed(survey)
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
  if (closed) return (
    <div className="screen">
      <TopBar title="설문 참여" onBack={onBack} />
      <main className="page closed-state">
        <i><Icon name="clock" size={34} /></i>
        <span className="tag tag--gray">응답 마감</span>
        <h1>설문 참여 기간이<br />종료됐어요.</h1>
        <p>{formatDeadline(survey.deadline)}에 마감된 설문이에요.<br />다른 설문에서 의견을 들려주세요.</p>
        <button type="button" className="primary-button" onClick={onBack}>설문 목록으로 돌아가기</button>
      </main>
    </div>
  )
  if (submitted) return <SurveySubmitted survey={survey} isExchange={isExchange} />
  return (
    <div className="screen participate-screen">
      <TopBar title="설문 참여" onBack={onBack} />
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
        {isExchange && !ready && import.meta.env.DEV ? <button type="button" className="preview-state-button" onClick={() => setReady(true)}><Icon name="spark" size={15} /> 개발 미리보기 · 완료 상태 보기</button> : null}
        {ready ? <button type="button" className="primary-button" onClick={() => window.dispatchEvent(new CustomEvent('suniversity-navigate', { detail: { screen: 'respondentResult', id: survey.id } }))}>비교 결과 보기</button> : <button type="button" className="secondary-button" onClick={() => window.dispatchEvent(new CustomEvent('suniversity-navigate', { detail: { screen: 'exchange' } }))}>교환 대기함으로</button>}
      </main>
    </div>
  )
}

function RespondentResultScreen({ survey, onBack, navigate }) {
  const [tab, setTab] = useState('summary')
  const [deepOpen, setDeepOpen] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])
  const copyResultLink = () => {
    navigator.clipboard?.writeText(`https://suniversity.kr/result/${survey.id}`)
    window.clearTimeout(toastTimer.current)
    setToast('결과 링크를 복사했어요')
    toastTimer.current = window.setTimeout(() => setToast(''), 1800)
  }
  const groups = {
    gender: [['여성', 58], ['남성', 42]],
    mbti: [['ENFP', 31], ['INFP', 26], ['ENTJ', 18], ['기타', 25]],
    school: [['고려대', 37], ['홍익대', 24], ['연세대', 18], ['기타', 21]],
  }
  return (
    <div className="screen">
      <TopBar title="설문 결과" onBack={onBack} right={<button className="round-icon" type="button" onClick={copyResultLink} aria-label="결과 링크 복사"><Icon name="share" /></button>} />
      <main className="page result-page">
        <span className="tag tag--blue">{survey.category}</span>
        <h1>{survey.title}</h1>
        <p>{survey.participants + 1}명의 답변을 바탕으로 분석했어요.</p>
        <div className="respondent-ai-note"><Icon name="spark" size={15} /><span><b>AI 비교 분석 준비 완료</b><small>나와 비슷한 응답자와 그룹별 차이를 찾았어요.</small></span></div>
        <div className="result-tabs"><button className={tab === 'summary' ? 'is-active' : ''} onClick={() => setTab('summary')}>요약</button><button className={tab === 'compare' ? 'is-active' : ''} onClick={() => setTab('compare')}>비교</button><button className={tab === 'insight' ? 'is-active' : ''} onClick={() => setTab('insight')}><Icon name="spark" size={12} /> AI 인사이트</button></div>
        {tab === 'summary' ? <>
          <section className="answer-highlight"><span>나와 같은 답을 고른 사람</span><strong>35<small>%</small></strong><p>응답자 3명 중 1명은 나와 비슷하게 생각해요.</p></section>
          <section className="chart-card">
            <div className="section-title"><div><span>Q1 결과</span><h2>카페 이용 빈도</h2></div></div>
            <div className="donut-wrap"><div className="donut"><strong>85<small>명</small></strong></div><ul><li><i className="c1" />주 3~4회 <b>35%</b></li><li><i className="c2" />주 1~2회 <b>28%</b></li><li><i className="c3" />주 5회 이상 <b>21%</b></li><li><i className="c4" />기타 <b>16%</b></li></ul></div>
          </section>
          <section className="similar-card"><img className="similar-card__puzzles" src={respondentSimilarPuzzles} alt="" /><div><b>ENFP 응답자와 가장 비슷해요</b><p>전체 답변 패턴이 82% 일치했어요.</p></div></section>
        </> : null}
        {tab === 'compare' ? <section className="compare-results">
          {Object.entries(groups).map(([key, values]) => <article key={key}><h3>{key === 'gender' ? '성별 비교' : key === 'mbti' ? 'MBTI 비교' : '학교별 비교'}</h3>{values.map(([label, value], index) => <span key={label}><small>{label}</small><Progress value={value} tone={index % 2 ? 'pink' : 'blue'} /><b>{value}%</b></span>)}</article>)}
        </section> : null}
        {tab === 'insight' ? <><section className="insight-card"><Icon name="spark" size={25} /><span>AI 한 줄 인사이트</span><h2>카페는 음료를 마시는 곳보다<br />공부하고 머무는 공간에 가까워요.</h2><p>특히 3~4학년과 자취생 그룹에서 체류 시간이 길게 나타났어요.</p><button type="button" aria-expanded={deepOpen} onClick={() => setDeepOpen((open) => !open)}>{deepOpen ? '심층 분석 접기' : 'AI 심층 분석 보기 · 2,000원'}</button></section>{deepOpen ? <section className="respondent-deep-analysis" aria-live="polite"><span><Icon name="spark" size={15} /> AI DEEP INSIGHT</span><h3>응답 차이가 가장 큰 그룹이에요</h3><ul><li><b>3~4학년</b><small>과제와 취업 준비로 2시간 이상 머무는 비율이 평균보다 18% 높아요.</small></li><li><b>자취생</b><small>가격보다 콘센트·좌석 환경을 더 중요하게 선택했어요.</small></li><li><b>다음 질문 추천</b><small>카페 선택 시 이동 거리와 혼잡도가 미치는 영향을 추가로 물어보세요.</small></li></ul></section> : null}</> : null}
        <button type="button" className="discussion-entry" onClick={() => navigate('discussion', survey.id)}><i><Icon name="users" /></i><span><b>응답자들과 이야기해 보세요</b><small>댓글 18개 · 익명 또는 닉네임으로 참여</small></span><Icon name="chevron" /></button>
      </main>
      {toast ? <div className="toast" role="status"><Icon name="check" size={17} /><span>{toast}</span></div> : null}
    </div>
  )
}

function CreatorResultsScreen({ survey, onBack, navigate }) {
  const [tab, setTab] = useState('summary')
  const [aiTool, setAiTool] = useState('deep')
  const [responseIndex, setResponseIndex] = useState(0)
  const [aiRun, setAiRun] = useState({ key: '', status: 'idle' })
  const aiTimer = useRef(null)
  useEffect(() => () => window.clearTimeout(aiTimer.current), [])
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
  const aiTools = {
    deep: { label: 'AI 심층 분석', icon: 'chart', title: '응답의 이유까지 한 번에 분석해요', body: '학년·성별·생활 환경별 차이를 찾아 핵심 원인과 다음 조사 방향을 정리합니다.', action: '심층 분석 시작 · 2,000원' },
    insight: { label: 'AI 인사이트', icon: 'spark', title: '발표에 바로 쓸 핵심 문장을 만들어요', body: '응답에서 의미 있는 변화와 예상 밖의 패턴을 찾아 근거와 함께 제안합니다.', action: '인사이트 생성 · 1,000원' },
    ppt: { label: 'PPT 자동 생성', icon: 'file', title: '분석 결과를 발표 자료로 완성해요', body: '표지·조사 개요·핵심 차트·결론으로 구성된 발표용 PPT 초안을 자동 생성합니다.', action: 'PPT 8장 만들기 · 4,000원' },
  }
  const selectedAiTool = aiTools[aiTool]
  const selectedResponse = responses[responseIndex]
  const runAiTool = () => {
    window.clearTimeout(aiTimer.current)
    setAiRun({ key: aiTool, status: 'loading' })
    aiTimer.current = window.setTimeout(() => setAiRun({ key: aiTool, status: 'done' }), 700)
  }
  return (
    <div className="screen creator-results-screen">
      <TopBar title="작성자 결과" onBack={onBack} right={<button className="round-icon" type="button" onClick={downloadCsv} aria-label="응답 CSV 다운로드"><Icon name="download" /></button>} />
      <main className="page result-page">
        <div className="result-tier-head result-tier-head--free"><span><Icon name="check" size={13} /> FREE RESULT</span><small>작성자 기본 결과 · 무료</small></div>
        <h1>{survey.title}</h1>
        <div className="creator-summary"><span><b>{survey.participants || 53}</b><small>전체 응답</small></span><span><b>72%</b><small>목표 달성</small></span><span><b>{survey.minutes}:12</b><small>평균 시간</small></span></div>
        <div className="result-tabs"><button className={tab === 'summary' ? 'is-active' : ''} onClick={() => setTab('summary')}>요약</button><button className={tab === 'individual' ? 'is-active' : ''} onClick={() => setTab('individual')}>개별 응답</button><button className={tab === 'table' ? 'is-active' : ''} onClick={() => setTab('table')}>데이터 표</button></div>
        {tab === 'summary' ? <>
          <section className="chart-card"><div className="section-title"><div><span>질문 1</span><h2>카페 이용 빈도</h2></div></div><div className="donut-wrap"><div className="donut"><strong>53<small>명</small></strong></div><ul><li><i className="c1" />주 3~4회 <b>35%</b></li><li><i className="c2" />주 1~2회 <b>28%</b></li><li><i className="c3" />주 5회 이상 <b>21%</b></li><li><i className="c4" />기타 <b>16%</b></li></ul></div></section>
          <section className="bar-chart-card"><h3>질문별 응답 분포</h3><div className="vertical-bars">{[44, 68, 83, 61, 72].map((height, index) => <span key={height}><i style={{ height: `${height}%` }} /><small>Q{index + 1}</small></span>)}</div></section>
        </> : null}
        {tab === 'individual' ? <section className="individual-response"><header><button type="button" disabled={responseIndex === 0} onClick={() => setResponseIndex((index) => Math.max(0, index - 1))} aria-label="이전 응답"><Icon name="back" size={17} /></button><b>응답 {responseIndex + 1} / {responses.length}</b><button type="button" disabled={responseIndex === responses.length - 1} onClick={() => setResponseIndex((index) => Math.min(responses.length - 1, index + 1))} aria-label="다음 응답"><Icon name="chevron" size={17} /></button></header><small className="response-submitted-at">제출 {selectedResponse[0]}</small>{selectedResponse.slice(1).map((value, index) => <div key={`${responseIndex}-${index}`}><small>Q{index + 1}</small><b>{value}</b></div>)}</section> : null}
        {tab === 'table' ? <section className="data-table-wrap"><table><thead><tr>{['응답 시간', '카페 빈도', '선택 기준', '선호도', '체류 시간'].map((head) => <th key={head}>{head}</th>)}</tr></thead><tbody>{responses.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table><button type="button" className="download-button" onClick={downloadCsv}><Icon name="download" /> CSV로 다운로드</button></section> : null}
        <button type="button" className="share-result-card" onClick={() => navigate('shareSurvey', survey.id, { survey })}><i><Icon name="share" /></i><span><b>설문 배포 및 공유</b><small>링크·QR 코드·외부 커뮤니티 공유</small></span><Icon name="chevron" /></button>
        <section className="ai-result-suite">
          <header className="result-tier-head result-tier-head--ai"><span><Icon name="spark" size={13} /> AI RESULT</span><small>AI가 응답을 더 깊게 해석해요</small></header>
          <div className="ai-result-intro"><i><Icon name="spark" size={24} /></i><div><b>결과를 이해하는 데서 끝내지 마세요</b><p>AI가 인사이트를 찾고, 발표 자료까지 이어서 완성해 드려요.</p></div></div>
          <div className="ai-tool-tabs">
            {Object.entries(aiTools).map(([key, tool]) => <button type="button" key={key} className={aiTool === key ? 'is-active' : ''} onClick={() => setAiTool(key)}><Icon name={tool.icon} size={17} /><span>{tool.label}</span></button>)}
          </div>
          <article className="ai-tool-preview">
            <span><Icon name={selectedAiTool.icon} size={20} /> {selectedAiTool.label}</span>
            <h2>{selectedAiTool.title}</h2>
            <p>{selectedAiTool.body}</p>
            <div><em><Icon name="check" size={12} /> 응답 데이터 자동 반영</em><em><Icon name="check" size={12} /> 수정 가능한 초안 제공</em></div>
            <button type="button" disabled={aiRun.status === 'loading'} onClick={runAiTool}>{aiRun.status === 'loading' && aiRun.key === aiTool ? 'AI가 분석 중이에요…' : selectedAiTool.action}<Icon name="chevron" size={15} /></button>
          </article>
          {aiRun.status === 'done' ? <section className="ai-run-result" aria-live="polite"><span><Icon name="check" size={14} /> {aiTools[aiRun.key].label} 초안 생성 완료</span><h3>{aiRun.key === 'ppt' ? '8장 발표 자료 구성을 만들었어요' : aiRun.key === 'insight' ? '발표에 쓸 핵심 인사이트 3개를 찾았어요' : '응답 차이의 원인과 다음 조사 방향을 정리했어요'}</h3><p>백엔드 연결 전에는 샘플 데이터로 미리 보여드려요. 실제 연결 후 응답 데이터에 맞춰 자동 생성됩니다.</p><button type="button" onClick={() => setAiRun({ key: '', status: 'idle' })}>확인</button></section> : null}
        </section>
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
  const downloadQr = () => {
    const cellSize = 12
    const padding = 12
    const size = cellSize * 9 + padding * 2
    const blocks = qrCells.map((filled, index) => filled
      ? `<rect x="${padding + (index % 9) * cellSize}" y="${padding + Math.floor(index / 9) * cellSize}" width="${cellSize}" height="${cellSize}" rx="1"/>`
      : '').join('')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" rx="14" fill="#ffffff"/><g fill="#183d73">${blocks}</g></svg>`
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `suniversity-${survey.id}-qr.svg`
    anchor.click()
    URL.revokeObjectURL(url)
    setCopied('QR 이미지')
    window.setTimeout(() => setCopied(''), 1400)
  }
  return (
    <div className="screen">
      <TopBar title="설문 공유" onBack={onBack} />
      <main className="page share-page">
        <span className="eyebrow">SHARE SURVEY</span>
        <h1>더 많은 대학생에게<br />설문을 알려보세요.</h1>
        <p>링크와 QR 코드는 모바일과 PC에서 모두 열려요.</p>
        <section className="share-survey-preview"><span className="tag tag--blue">{survey.category}</span><h2>{survey.title}</h2><small>{survey.questionCount}문항 · 약 {survey.minutes}분 · {formatDeadline(survey.deadline)} 마감</small></section>
        <section className="link-copy"><label>공유 링크</label><div><input readOnly value={link} /><button type="button" onClick={() => copy(link, '링크')}>{copied === '링크' ? <Icon name="check" /> : <Icon name="copy" />}</button></div></section>
        <section className="qr-card"><div className="qr-code">{qrCells.map((filled, index) => <i className={filled ? 'filled' : ''} key={index} />)}</div><div><b>QR 코드로 바로 참여</b><p>이미지로 저장해 포스터나 발표 자료에 넣어보세요.</p><button type="button" onClick={downloadQr}>QR 이미지 저장</button></div></section>
        <section className="share-channels"><h3>외부로 공유하기</h3><div><button type="button" onClick={() => copy(link, '카카오톡')}><i className="kakao">K</i><span>카카오톡</span></button><button type="button" onClick={() => copy(link, '에브리타임')}><i className="every">E</i><span>에브리타임</span></button><button type="button" onClick={() => copy(link, '인스타그램')}><i className="insta">◎</i><span>인스타그램</span></button><button type="button" onClick={() => copy(link, '이메일')}><i className="mail">@</i><span>이메일</span></button></div></section>
        <section className="embed-card"><Icon name="copy" /><div><b>웹사이트에 설문 넣기</b><p>임베드 코드를 복사해 블로그나 팀 페이지에 붙여넣을 수 있어요.</p></div><button type="button" onClick={() => copy(`<iframe src="${link}"></iframe>`, '코드')}>{copied === '코드' ? '복사됨' : '코드 복사'}</button></section>
      </main>
      {copied ? <div className="toast"><Icon name="check" size={17} />{copied}를 복사했어요</div> : null}
    </div>
  )
}

function EnhancedTeamScreen({ onBack }) {
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [permissionOpen, setPermissionOpen] = useState(null)
  const [selectedMember, setSelectedMember] = useState(null)
  const [teams, setTeams] = useState(['캡스톤 A팀', '서비스기획 B팀', '졸업작품 팀'])
  const [activeTeam, setActiveTeam] = useState('캡스톤 A팀')
  const [members, setMembers] = useState([
    ['나경', '설문 관리자', 4, 4],
    ['서빈', '공동 편집자', 3, 4],
    ['지민', '응답 참여자', 4, 4],
    ['도윤', '응답 참여자', 2, 4],
  ])
  const removeMember = (name) => {
    setMembers((current) => current.filter(([memberName]) => memberName !== name))
    setSelectedMember(null)
  }
  const createTeam = () => {
    const name = teamName.trim()
    if (!name || teams.includes(name)) return
    setTeams((current) => [...current, name])
    setActiveTeam(name)
    setTeamName('')
    setCreateOpen(false)
    setMenuOpen(false)
  }
  const deleteTeam = () => {
    if (teams.length === 1 || !window.confirm(`${activeTeam}을 삭제할까요?`)) return
    const nextTeams = teams.filter((team) => team !== activeTeam)
    setTeams(nextTeams)
    setActiveTeam(nextTeams[0])
    setMenuOpen(false)
  }
  return (
    <div className="screen" onClick={() => setSelectedMember(null)}>
      <TopBar title="팀 워크스페이스" onBack={onBack} right={<button className="round-icon" type="button" aria-label="팀 메뉴" aria-expanded={menuOpen} onClick={(event) => { event.stopPropagation(); setMenuOpen((open) => !open) }}><Icon name="more" /></button>} />
      {menuOpen ? <><button className="team-menu-backdrop" type="button" aria-label="팀 메뉴 닫기" onClick={() => setMenuOpen(false)} /><aside className="team-switcher" onClick={(event) => event.stopPropagation()}>
        <header><small>현재 팀</small><strong>{activeTeam}</strong></header>
        <div className="team-switcher__list"><span>다른 팀으로 변경</span>{teams.filter((team) => team !== activeTeam).map((team) => <button type="button" key={team} onClick={() => { setActiveTeam(team); setMenuOpen(false) }}><i>{team.slice(0, 1)}</i><b>{team}</b><Icon name="chevron" size={16} /></button>)}</div>
        <footer><button type="button" onClick={() => { setMenuOpen(false); setCreateOpen(true) }}><Icon name="plus" size={18} /> 팀 생성하기</button><button className="is-danger" type="button" disabled={teams.length === 1} onClick={deleteTeam}><Icon name="trash" size={18} /> 팀 삭제하기</button></footer>
      </aside></> : null}
      {createOpen ? <div className="team-create-layer" role="presentation" onClick={() => setCreateOpen(false)}><section className="team-create-dialog" role="dialog" aria-modal="true" aria-labelledby="team-create-title" onClick={(event) => event.stopPropagation()}>
        <div className="team-create-icon"><Icon name="team" size={25} /></div>
        <h2 id="team-create-title">새 팀 만들기</h2>
        <p>함께 설문을 만들고 교환할 팀의 이름을 정해 주세요.</p>
        <label><span>팀 이름</span><input autoFocus maxLength={20} value={teamName} placeholder="예: 캡스톤 디자인팀" onChange={(event) => setTeamName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') createTeam() }} /></label>
        {teams.includes(teamName.trim()) ? <small>이미 사용 중인 팀 이름이에요.</small> : <small>{teamName.length}/20</small>}
        <div><button type="button" onClick={() => { setTeamName(''); setCreateOpen(false) }}>취소</button><button type="button" disabled={!teamName.trim() || teams.includes(teamName.trim())} onClick={createTeam}>팀 만들기</button></div>
      </section></div> : null}
      <main className="page team-page">
        <section className="team-hero"><span className="team-big-avatar">{activeTeam.slice(0, 1)}</span><div><span className="tag tag--purple">{members.length}명 참여 중</span><h1>{activeTeam}</h1><p>대학생 AI 사용 실태 조사</p></div></section>
        <section className="team-progress-card"><div><span>팀 응답 진행률</span><strong>81<small>%</small></strong></div><Progress value={81} tone="purple" /><p>교환 중인 설문 2개 · 남은 응답 3개</p></section>
        <section>
          <div className="section-title"><div><span>MEMBERS</span><h2>팀원별 진행 현황</h2></div><button type="button" onClick={() => { navigator.clipboard?.writeText('SUNI-TEAM-4A2'); setCopied(true) }}>{copied ? '초대 코드 복사됨' : '팀원 초대'}</button></div>
          <div className="member-list">{members.map(([name, role, done, total], index) => <article className={selectedMember === name ? 'is-selected' : ''} key={name} onClick={(event) => { event.stopPropagation(); if (index !== 0) setSelectedMember((current) => current === name ? null : name) }}><span className={`member-avatar m${index}`}>{name.slice(0, 1)}</span><div><b>{name}{index === 0 ? ' (나)' : ''}</b><small>{role}</small></div>{selectedMember === name && index !== 0 ? <button className="member-remove" type="button" onClick={(event) => { event.stopPropagation(); removeMember(name) }}><Icon name="trash" size={15} /> 삭제</button> : <em>{done}/{total} 완료</em>}<Progress value={done / total * 100} tone={index % 2 ? 'pink' : 'blue'} /></article>)}</div>
        </section>
        <section className="team-permissions"><h3>팀 권한</h3><button type="button" onClick={() => setPermissionOpen(permissionOpen === 'edit' ? null : 'edit')}><Icon name="edit" /><span><b>공동 설문 편집</b><small>관리자와 편집자 2명</small></span><Icon name="chevron" /></button>{permissionOpen === 'edit' ? <div className="permission-panel"><b>편집 권한</b>{members.map(([name, role], index) => <label key={name}><span>{name}<small>{role}</small></span><input type="checkbox" defaultChecked={index < 2} disabled={index === 0} /></label>)}</div> : null}<button type="button" onClick={() => setPermissionOpen(permissionOpen === 'exchange' ? null : 'exchange')}><Icon name="exchange" /><span><b>팀 교환 신청</b><small>관리자만 신청 가능</small></span><Icon name="chevron" /></button>{permissionOpen === 'exchange' ? <div className="permission-panel"><b>신청 가능 역할</b><label><span>관리자만</span><input type="radio" name="exchange-permission" defaultChecked /></label><label><span>관리자와 편집자</span><input type="radio" name="exchange-permission" /></label><label><span>모든 팀원</span><input type="radio" name="exchange-permission" /></label></div> : null}</section>
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
  const activeRequestCount = requests.filter((request) => !TERMINAL_REQUEST_STATUSES.has(request.status)).length
  return (
    <div className="screen has-nav">
      <TopBar title="마이페이지" right={<button className="round-icon" type="button" onClick={() => navigate('profileEdit')}><Icon name="edit" /></button>} />
      <main className="page profile-page">
        <section className="profile-head"><div className="profile-avatar">나</div><div><h1>{profile.name}</h1><p><Icon name="shield" size={14} /> {profile.university} · 인증 완료</p><span>{profile.major}</span></div></section>
        <section className="trust-card"><div><span>나의 신뢰도</span><strong>{profile.trust}<small>%</small></strong><em>★★★★★</em></div><Progress value={profile.trust} tone="purple" /><p>성실한 교환 12회 · 받은 후기 8개</p></section>
        <section className="profile-stats"><span><b>{surveys.filter((survey) => survey.mine).length || 1}</b><small>만든 설문</small></span><span><b>27</b><small>참여 설문</small></span><span><b>{activeRequestCount}</b><small>진행 교환</small></span></section>
        <section className="profile-menu">
          <button type="button" onClick={() => navigate('mySurveys', mySurvey.id, { survey: mySurvey })}><i className="blue"><Icon name="clipboard" /></i><span><b>내 설문 관리</b><small>결과·공유·편집·응답 마감</small></span><Icon name="chevron" /></button>
          <button type="button" onClick={() => navigate('team')}><i className="purple"><Icon name="team" /></i><span><b>팀 워크스페이스</b><small>팀원 {profile.teamSize}명 · 공동 관리</small></span><Icon name="chevron" /></button>
          <button type="button" onClick={() => navigate('exchangeHistory')}><i className="pink"><Icon name="exchange" /></i><span><b>교환 기록</b><small>완료 12회 · 진행 {activeRequestCount}회</small></span><Icon name="chevron" /></button>
          <button type="button" onClick={() => navigate('favorites')}><i className="cream"><Icon name="heart" /></i><span><b>즐겨찾기 유저</b><small>{favoriteIds.length || 2}명 · 원클릭 교환 가능</small></span><Icon name="chevron" /></button>
        </section>
        <section className="profile-menu compact">
          <button type="button" onClick={() => navigate('profileEdit')}><span><b>기본 정보 관리</b><small>자동 매칭과 설문 응답에 활용</small></span><Icon name="chevron" /></button>
          <button type="button" onClick={() => navigate('schoolVerification')}><span><b>학교 인증 정보</b><small>{profile.university}</small></span><Icon name="chevron" /></button>
          <button type="button" onClick={() => navigate('policy')}><span><b>신고 및 이용 정책</b><small>건강한 설문 교환을 위한 기준</small></span><Icon name="chevron" /></button>
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
        <div className="profile-form">{fields.map(([label, key, options]) => <div className="profile-form-row" key={key}><span>{label}</span><DesignSelect value={draft[key]} onChange={(value) => setDraft({ ...draft, [key]: value })} options={options} ariaLabel={`${label} 선택`} /></div>)}<label><span>거주 지역</span><input value={draft.region} onChange={(event) => setDraft({ ...draft, region: event.target.value })} /></label></div>
        <section className="lifestyle-options"><h3>라이프스타일</h3>{[['흡연', 'smoking'], ['음주', 'drinking'], ['운동', 'exercise'], ['운전면허', 'license'], ['자동차', 'car']].map(([label, key]) => <label key={key}><span>{label}</span><input value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label>)}</section>
      </main>
    </div>
  )
}

function MySurveysScreen({ surveys, setSurveys, requests, setRequests, selectedSurvey, navigate, onBack }) {
  const mine = surveys.filter((survey) => survey.mine)
  const list = mine.length ? mine : [{ ...selectedSurvey, id: 'my-demo', mine: true, title: '대학생의 AI 활용과 취업 준비', participants: 53, target: 100 }]
  const [closedIds, setClosedIds] = useStoredState('suniversity-closed-surveys', [])
  const [pendingClose, setPendingClose] = useState(null)
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)
  const hasDraft = Boolean(localStorage.getItem('suniversity-new-draft'))
  const belongsToSurvey = (request, surveyId) => request.sourceSurveyId === surveyId || (!request.sourceSurveyId && list.length === 1)
  const activeExchanges = (surveyId) => requests.filter((request) => belongsToSurvey(request, surveyId) && !TERMINAL_REQUEST_STATUSES.has(request.status))
  const activeExchangeCount = requests.filter((request) => !TERMINAL_REQUEST_STATUSES.has(request.status)).length
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])
  const showToast = (message) => {
    window.clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = window.setTimeout(() => setToast(''), 1800)
  }
  const reopenSurvey = (id) => {
    setClosedIds((current) => current.filter((value) => value !== id))
    setSurveys((current) => current.map((survey) => survey.id === id ? { ...survey, closed: false } : survey))
    showToast('새로운 응답을 다시 받을 수 있어요')
  }
  const closeSurvey = () => {
    if (!pendingClose) return
    const surveyId = pendingClose.id
    setClosedIds((current) => current.includes(surveyId) ? current : [...current, surveyId])
    setSurveys((current) => current.map((survey) => survey.id === surveyId ? { ...survey, closed: true } : survey))
    setRequests((current) => current.map((request) => (
      belongsToSurvey(request, surveyId) && !TERMINAL_REQUEST_STATUSES.has(request.status)
        ? { ...request, status: 'cancelled', cancelReason: 'owner-closed' }
        : request
    )))
    setPendingClose(null)
    showToast('응답을 마감하고 미완료 교환을 정리했어요')
  }
  return (
    <div className="screen">
      <TopBar title="내 설문 관리" onBack={onBack} right={<button type="button" className="round-icon" onClick={() => navigate('create')}><Icon name="plus" /></button>} />
      <main className="page manage-page">
        <section className="manage-summary"><span><b>{list.length}</b><small>게시한 설문</small></span><span><b>{list.reduce((sum, survey) => sum + survey.participants, 0)}</b><small>모은 응답</small></span><span><b>{activeExchangeCount}</b><small>진행 교환</small></span></section>
        {hasDraft ? <button type="button" className="draft-banner" onClick={() => navigate('create')}><i><Icon name="edit" /></i><span><b>작성 중인 임시저장이 있어요</b><small>이어서 문항을 완성해 보세요.</small></span><Icon name="chevron" /></button> : null}
        <div className="section-title"><div><span>MY SURVEYS</span><h2>게시한 설문</h2></div></div>
        <div className="manage-survey-list">{list.map((survey) => {
          const deadlineState = getDeadlineState(survey.deadline)
          const timedOut = deadlineState.expired
          const closed = timedOut || Boolean(survey.closed) || closedIds.includes(survey.id)
          const exchangeCount = activeExchanges(survey.id).length
          return <article key={survey.id} className={closed ? 'is-closed' : ''}>
            <header><span className={`tag ${closed ? 'tag--gray' : 'tag--blue'}`}>{timedOut ? '기한 만료' : closed ? '응답 마감' : '응답 수집 중'}</span><small>{formatDeadline(survey.deadline)} 마감</small></header>
            <h3>{survey.title}</h3>
            <p>{survey.questionCount}문항 · 응답 {survey.participants}/{survey.target}명</p>
            <Progress value={survey.participants / survey.target * 100} />
            {!closed && (deadlineState.within24Hours || exchangeCount > 0) ? <div className={`manage-status-note ${deadlineState.within24Hours ? 'is-urgent' : ''}`}>
              <Icon name={deadlineState.within24Hours ? 'clock' : 'exchange'} size={16} />
              <span>
                <b>{deadlineState.within24Hours ? `${deadlineState.hours}시간 후 마감${exchangeCount ? ` · 교환 ${exchangeCount}건 진행 중` : ''}` : `진행 중인 교환 ${exchangeCount}건`}</b>
                <small>{deadlineState.within24Hours ? '새 교환 신청은 종료됐고, 성사된 교환은 마감 전까지 완료해야 해요.' : '수동 마감하면 완료되지 않은 교환도 함께 종료돼요.'}</small>
              </span>
            </div> : null}
            <div className="manage-actions"><button type="button" onClick={() => navigate('creatorResults', survey.id, { survey })}><Icon name="chart" /> 결과</button><button type="button" onClick={() => navigate('shareSurvey', survey.id, { survey })}><Icon name="share" /> 공유</button><button type="button" disabled={timedOut || closed} onClick={() => navigate('create')}><Icon name="edit" /> 수정</button><button type="button" disabled={timedOut} className={closed ? '' : 'danger'} onClick={() => closed ? reopenSurvey(survey.id) : setPendingClose(survey)}>{timedOut ? '기한 만료' : closed ? '다시 받기' : '응답 마감'}</button></div>
          </article>
        })}</div>
      </main>
      {pendingClose ? <Modal onClose={() => setPendingClose(null)} className="close-survey-modal">
        <div className="close-modal-icon"><Icon name="clock" /></div>
        <span className="modal-kicker">CLOSE SURVEY</span>
        <h2>이 설문의 응답을<br />마감할까요?</h2>
        <p><b>{pendingClose.title}</b> 설문은 더 이상 새로운 응답과 교환 신청을 받지 않아요.</p>
        <div className="close-impact-list">
          <span><Icon name="close" size={16} /><em>새로운 응답과 교환 신청 차단</em></span>
          <span><Icon name="exchange" size={16} /><em>미완료 교환 {activeExchanges(pendingClose.id).length}건 자동 종료</em></span>
          <span><Icon name="chart" size={16} /><em>기존 응답과 결과 데이터는 그대로 유지</em></span>
        </div>
        <div className="close-modal-actions"><button type="button" className="secondary-button" onClick={() => setPendingClose(null)}>계속 받기</button><button type="button" className="danger-button" onClick={closeSurvey}>응답 마감</button></div>
      </Modal> : null}
      {toast ? <div className="toast"><Icon name="check" size={17} />{toast}</div> : null}
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
  const statusLabels = { completed: '교환 완료', rejected: '교환 거절', cancelled: '자동 취소', expired: '기한 만료', incoming: '수락 대기', requested: '수락 대기', 'waiting-me': '내 응답 대기', 'waiting-partner': '상대 응답 대기' }
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
        <div className="history-list">{items.map((item) => <button type="button" key={item.id} onClick={() => item.surveyId ? navigate('exchangeStatus', item.id) : null}><span className={`history-status ${item.status}`} aria-label={statusLabels[item.status] || '교환 진행 중'}>{item.status === 'completed' ? <Icon name="check" /> : item.status === 'rejected' || item.status === 'cancelled' ? <Icon name="close" /> : <Icon name="clock" />}</span><div><b>{item.title}</b><p>{item.partner} · {item.type}</p><small>{statusLabels[item.status] || '진행 중'} · {item.date || item.deadline} {item.trust ? `· 신뢰도 ${item.trust}%` : ''}</small></div>{item.surveyId ? <Icon name="chevron" /> : <span className="history-archive-label">보관됨</span>}</button>)}</div>
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
      <TopBar title="설문 이야기" onBack={onBack} />
      <main className="page discussion-page">
        <section className="discussion-topic"><span className="tag tag--blue">{survey.category}</span><h1>{survey.title}</h1><p>서로 다른 답을 존중하며 자유롭게 이야기해 보세요.</p></section>
        <div className="identity-selector"><span>댓글 작성 이름</span><button type="button" className={identity === 'anonymous' ? 'is-active' : ''} onClick={() => setIdentity('anonymous')}>익명 퍼즐</button><button type="button" className={identity === 'nickname' ? 'is-active' : ''} onClick={() => setIdentity('nickname')}>나경 · 고려대</button></div>
        <section className="comment-composer"><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="이 설문에 대한 생각을 남겨보세요." /><button type="button" disabled={!comment.trim()} onClick={addComment}>등록</button></section>
        <div className="discussion-head"><b>댓글 {comments.length + comments.reduce((sum, item) => sum + item.replies.length, 0)}개</b><span>공감순</span></div>
        <div className="comment-list">{comments.map((item) => <article key={item.id} className={`team-${item.team}`}>
          <header><span className="comment-avatar">{item.author.slice(0, 1)}</span><div><b>{item.author}</b><small>방금 전</small></div></header>
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
  const ended = ['cancelled', 'expired', 'rejected'].includes(request.status)
  const complete = request.status === 'completed' || (request.ours === request.people && request.theirs === request.people)
  const simulate = () => setRequests((current) => current.map((item) => item.id === request.id ? { ...item, theirs: item.people, ours: item.people, status: 'completed' } : item))
  if (ended) {
    const endedCopy = request.status === 'rejected'
      ? ['교환이 성사되지 않았어요', '상대가 이번 교환 신청을 수락하지 않았어요. 다른 설문에 다시 신청해 보세요.']
      : request.status === 'expired'
        ? ['설문 마감으로 교환이 종료됐어요', '마감 기한 안에 양측 응답이 완료되지 않아 결과와 통계에 반영되지 않았어요.']
        : request.cancelReason === 'owner-closed'
          ? ['작성자가 설문 응답을 마감했어요', '미완료 교환도 함께 종료됐어요. 기존에 완료된 응답 데이터는 그대로 유지됩니다.']
          : ['마감 24시간 전에 자동 취소됐어요', '성사되지 않은 신청을 정리했어요. 포인트나 응답 결과에는 영향을 주지 않아요.']
    return (
      <div className="screen">
        <TopBar title="교환 진행 상황" onBack={onBack} />
        <main className="page exchange-ended-page">
          <i><Icon name="clock" size={34} /></i>
          <span className="tag tag--gray">교환 종료</span>
          <h1>{endedCopy[0]}</h1>
          <p>{endedCopy[1]}</p>
          <section><b>{request.title}</b><small>{request.partner} · {request.type} · {request.deadline} 마감</small></section>
          <button type="button" className="primary-button" onClick={onBack}>교환 기록으로 돌아가기</button>
        </main>
      </div>
    )
  }
  return (
    <div className="screen">
      <TopBar title="교환 진행 상황" onBack={onBack} />
      <main className="page status-page">
        <div className="status-visual"><span>•ᴗ•</span><i><Icon name="exchange" /></i><span>•ᴗ•</span></div>
        <span className={`tag ${complete ? 'tag--blue' : 'tag--purple'}`}>{complete ? '교환 완료' : '응답 진행 중'}</span>
        <h1>{request.title}</h1>
        <p>{request.partner}와 {request.type} · {request.people}명 참여</p>
        <section className="status-timeline"><span className="done"><i><Icon name="check" /></i><div><b>교환 성사</b><small>양측이 교환 조건을 확인했어요.</small></div></span><span className={request.ours === request.people ? 'done' : ''}><i>{request.ours === request.people ? <Icon name="check" /> : '2'}</i><div><b>우리 팀 응답</b><small>{request.ours}/{request.people}명 완료</small><Progress value={request.ours / request.people * 100} /></div></span><span className={request.theirs === request.people ? 'done' : ''}><i>{request.theirs === request.people ? <Icon name="check" /> : '3'}</i><div><b>상대 팀 응답</b><small>{request.theirs}/{request.people}명 완료</small><Progress value={request.theirs / request.people * 100} tone="pink" /></div></span><span className={complete ? 'done' : ''}><i>{complete ? <Icon name="check" /> : '4'}</i><div><b>결과 반영</b><small>{complete ? '응답과 통계에 반영됐어요.' : '양측 완료 후 자동으로 반영돼요.'}</small></div></span></section>
        {!complete && import.meta.env.DEV ? <button type="button" className="preview-state-button" onClick={simulate}><Icon name="spark" size={15} /> 개발 미리보기 · 교환 완료 상태 보기</button> : complete ? <section className="rating-card"><h3>이번 교환은 어땠나요?</h3><p>평가는 상대 팀의 신뢰도에 반영돼요.</p><div>{[1, 2, 3, 4, 5].map((star) => <button type="button" className={rated >= star ? 'is-active' : ''} onClick={() => setRated(star)} key={star}><Icon name="star" /></button>)}</div>{rated ? <small>평가를 저장했어요. 간단한 후기는 마이페이지에서 남길 수 있어요.</small> : null}</section> : null}
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

function PolicyScreen({ onBack }) {
  return (
    <div className="screen">
      <TopBar title="신고 및 이용 정책" onBack={onBack} />
      <main className="page help-page policy-page">
        <span className="eyebrow">SAFE COMMUNITY</span>
        <h1>서로의 시간을 존중하는<br />설문 커뮤니티를 만들어요.</h1>
        <p className="policy-intro">신뢰할 수 있는 교환과 편안한 대화를 위해 아래 기준을 적용하고 있어요.</p>
        <section className="help-flow">{[['1', '설문 내용', '개인정보 요구·허위 정보·불쾌감을 주는 문항은 등록할 수 없어요.'], ['2', '교환 약속', '성사된 교환은 마감 전에 성실하게 응답해 주세요. 반복 미완료는 신뢰도에 반영돼요.'], ['3', '댓글과 답글', '비방·차별·광고성 댓글은 신고 후 숨김 또는 이용 제한될 수 있어요.']].map(([number, title, text]) => <span key={number}><i>{number}</i><p><b>{title}</b><small>{text}</small></p></span>)}</section>
        <section className="policy-report-card"><Icon name="shield" size={22} /><div><b>문제가 있는 콘텐츠를 발견했나요?</b><p>설문이나 댓글의 신고 기능으로 접수하면 운영 기준에 따라 확인해요. 신고자의 정보는 상대에게 공개되지 않습니다.</p></div></section>
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
  const navigationHistory = useRef([])
  const selectedSurvey = screenMeta.survey || surveys.find((survey) => survey.id === selectedId) || surveys[0]
  const selectedRequest = requests.find((request) => request.id === selectedId)
  const unread = notifications.filter((notice) => !notice.read).length
  useEffect(() => {
    const syncDeadlines = () => setRequests((current) => current.map((request) => {
      if (!request.deadlineISO || TERMINAL_REQUEST_STATUSES.has(request.status)) return request
      const deadlineState = getDeadlineState(request.deadlineISO)
      if (deadlineState.missing) return request
      if (deadlineState.expired) return { ...request, status: 'expired', expireReason: 'deadline' }
      if (deadlineState.within24Hours && ['incoming', 'requested'].includes(request.status)) return { ...request, status: 'cancelled', cancelReason: 'deadline-window' }
      return request
    }))
    syncDeadlines()
    const timer = window.setInterval(syncDeadlines, 60000)
    return () => window.clearInterval(timer)
  }, [setRequests])
  useEffect(() => {
    const deadlineNotices = requests
      .filter((request) => ['cancelled', 'expired'].includes(request.status))
      .map((request) => ({
        id: `deadline-${request.id}-${request.status}`,
        type: 'deadline',
        title: request.status === 'cancelled' ? request.cancelReason === 'owner-closed' ? '설문 마감으로 교환이 종료됐어요' : '교환 신청이 자동 취소됐어요' : '교환 가능 기간이 종료됐어요',
        body: request.status === 'cancelled' ? request.cancelReason === 'owner-closed' ? `작성자가 응답을 마감해 ${request.title} 교환을 종료했어요.` : `${request.title} 설문이 마감 24시간 전이라 신청을 정리했어요.` : `${request.title} 설문이 마감되어 진행 중인 교환을 종료했어요.`,
        time: '방금 전',
        read: false,
      }))
    if (!deadlineNotices.length) return
    setNotifications((current) => {
      const existing = new Set(current.map((notice) => notice.id))
      const additions = deadlineNotices.filter((notice) => !existing.has(notice.id))
      return additions.length ? [...additions, ...current] : current
    })
  }, [requests, setNotifications])

  const navigate = (next, id = null, meta = {}) => {
    navigationHistory.current.push({ screen, selectedId, screenMeta })
    setScreen(next)
    setSelectedId(id)
    setScreenMeta(meta)
    window.scrollTo(0, 0)
  }
  const back = () => {
    const previous = navigationHistory.current.pop() || { screen: 'home', selectedId: null, screenMeta: {} }
    setScreen(previous.screen)
    setSelectedId(previous.selectedId)
    setScreenMeta(previous.screenMeta)
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
  const openGeneratedSurvey = (draft) => {
    localStorage.setItem('suniversity-new-draft', JSON.stringify(draft))
    navigate('create')
  }
  const completeSurvey = (surveyId, response, isExchange) => {
    setCompleted((current) => [...new Set([...current, surveyId])])
    setAnswers((current) => ({ ...current, [surveyId]: response }))
    if (isExchange && screenMeta.exchangeId) {
      setRequests((current) => current.map((request) => request.id === screenMeta.exchangeId ? { ...request, ours: request.people, status: 'waiting-partner' } : request))
    }
  }
  const addRequest = (survey, mode, people) => {
    if (isSurveyClosed(survey)) return { ok: false, message: '이미 응답이 마감된 설문이에요.' }
    const deadlineState = getDeadlineState(survey.deadline)
    if (deadlineState.within24Hours) return { ok: false, message: `마감까지 ${deadlineState.hours}시간 남아 새 교환을 신청할 수 없어요.` }
    const activeRequests = requests.filter((request) => !TERMINAL_REQUEST_STATUSES.has(request.status))
    if (activeRequests.filter((request) => request.surveyId === survey.id).length >= 10) return { ok: false, message: '이 설문은 미완료 교환 신청 10개가 모두 찼어요.' }
    if (activeRequests.some((request) => request.surveyId === survey.id && request.status !== 'incoming')) return { ok: false, message: '이미 진행 중인 교환 신청이 있어요.' }
    const sourceSurvey = surveys.find((item) => item.mine && !isSurveyClosed(item))
    const request = { id: `exchange-${Date.now()}`, type: mode === 'team' ? '팀 교환' : '개인 교환', status: 'requested', sourceSurveyId: sourceSurvey?.id || 'my-demo', surveyId: survey.id, title: survey.title, partner: survey.owner, people: mode === 'team' ? people : 1, ours: 0, theirs: 0, deadline: formatDeadline(survey.deadline), deadlineISO: survey.deadline }
    setRequests((current) => [request, ...current])
    return { ok: true }
  }

  const common = { navigate, surveys, requests, setRequests, profile, unread, notifications, setNotifications }
  if (screen === 'home') return <HomeScreen {...common} completed={completed} />
  if (screen === 'community') return <CommunityScreen navigate={navigate} surveys={surveys} completed={completed} />
  if (screen === 'exchange') return <ExchangeScreen {...common} />
  if (screen === 'surveyDetail') return <SurveyDetailScreen survey={selectedSurvey} onBack={back} navigate={navigate} profile={profile} onRequest={addRequest} completed={completed.includes(selectedSurvey.id)} favorite={favorites.includes(selectedSurvey.id)} onFavorite={(id) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} />
  if (screen === 'autoMatch') return <AutoMatchScreen onBack={back} profile={profile} surveys={surveys} navigate={navigate} onMatched={addRequest} />
  if (screen === 'createHub') return <CreateHubScreen navigate={navigate} />
  if (screen === 'aiCreate') return <AISurveyChatScreen onBack={back} navigate={navigate} onGenerate={openGeneratedSurvey} />
  if (screen === 'create') return <CreateSurveyScreen onBack={back} profile={profile} onPublish={publishSurvey} />
  if (screen === 'participate') return <ParticipateScreen survey={selectedSurvey} onBack={back} onComplete={completeSurvey} isExchange={Boolean(screenMeta.exchangeId)} />
  if (screen === 'respondentResult') return <RespondentResultScreen survey={selectedSurvey} onBack={() => navigate('home')} navigate={navigate} />
  if (screen === 'creatorResults') return <CreatorResultsScreen survey={selectedSurvey} onBack={back} navigate={navigate} />
  if (screen === 'shareSurvey') return <ShareSurveyScreen survey={selectedSurvey} onBack={back} />
  if (screen === 'team') return <EnhancedTeamScreen onBack={back} />
  if (screen === 'notifications') return <NotificationsScreen navigate={navigate} notifications={notifications} setNotifications={setNotifications} />
  if (screen === 'profile') return <ProfileScreen {...common} favoriteIds={favorites} />
  if (screen === 'profileEdit') return <ProfileEditScreen profile={profile} setProfile={setProfile} onBack={back} />
  if (screen === 'mySurveys') return <MySurveysScreen surveys={surveys} setSurveys={setSurveys} requests={requests} setRequests={setRequests} selectedSurvey={selectedSurvey} navigate={navigate} onBack={back} />
  if (screen === 'favorites') return <FavoritesScreen onBack={back} navigate={navigate} />
  if (screen === 'exchangeHistory') return <ExchangeHistoryScreen requests={requests} onBack={back} navigate={navigate} />
  if (screen === 'schoolVerification') return <SchoolVerificationScreen profile={profile} onBack={back} />
  if (screen === 'discussion') return <DiscussionScreen survey={selectedSurvey} onBack={back} />
  if (screen === 'exchangeStatus') return <ExchangeStatusScreen request={selectedRequest} onBack={back} setRequests={setRequests} />
  if (screen === 'exchangeHelp') return <ExchangeHelpScreen onBack={back} />
  if (screen === 'policy') return <PolicyScreen onBack={back} />
  return <HomeScreen {...common} completed={completed} />
}

export default App
