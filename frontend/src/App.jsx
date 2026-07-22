/* eslint-disable react/prop-types */
import { useState } from 'react'
import { useAsyncData } from './hooks/useAsyncData.js'
import mockApi from './services/mockApi.js'
import './App.css'

const navItems = [
  { id: 'home', icon: '⌂', label: '홈' },
  { id: 'surveys', icon: '▤', label: '설문' },
  { id: 'balance', icon: '▥', label: '밸런스게임' },
  { id: 'ranking', icon: '♛', label: '랭킹' },
  { id: 'points', icon: '●', label: '포인트' },
]

function IconButton({ children, label, onClick, badge }) {
  return (
    <button className="icon-button" type="button" aria-label={label} onClick={onClick}>
      {children}
      {badge ? <span className="notification-badge">{badge}</span> : null}
    </button>
  )
}

function BellIcon() {
  return (
    <svg className="bell-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  )
}
function UiIcon({ name }) {
  const paths = {
    all: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    career: <><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M9 7V5h6v2M3 12h18M10 12v2h4v-2" /></>,
    consume: <><path d="M6 8h12l1 12H5L6 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    campus: <><path d="m3 10 9-5 9 5" /><path d="M5 10v9h14v-9M9 11v8M15 11v8M3 19h18" /></>,
    mbti: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /><circle cx="12" cy="12" r="4" /></>,
    love: <path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.8l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z" />,
    school: <><path d="m3 10 9-5 9 5-9 5-9-5Z" /><path d="M7 13v4c3 2 7 2 10 0v-4M21 10v6" /></>,
    phone: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    survey: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    draft: <><path d="M4 4h11l5 5v11H4V4Z" /><path d="M14 4v6h6M8 14h8M8 17h5" /></>,
    coin: <><circle cx="12" cy="12" r="9" /><path d="M9 9.5c0-1.5 1.3-2.5 3-2.5s3 1 3 2.5-1.2 2.1-3 2.5-3 1-3 2.5 1.3 2.5 3 2.5 3-1 3-2.5M12 5v14" /></>,
  }
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name] || paths.all}</svg>
}
function TopBar({ title, onBack, right, brand = false }) {
  return (
    <header className={'top-bar ' + (brand ? 'top-bar--brand' : '')}>
      {onBack ? <IconButton label="뒤로 가기" onClick={onBack}><svg className="back-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7" /></svg></IconButton> : <span className="top-spacer" />}
      <strong className={brand ? 'wordmark' : ''}>{title}</strong>
      {right || <span className="top-spacer" />}
    </header>
  )
}

function BottomNav({ active, navigate }) {
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className={active === item.id ? 'nav-item is-active' : 'nav-item'}
          onClick={() => navigate(item.id)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

function PointPill({ value }) {
  return <span className="point-pill"><b>P</b> +{value}P</span>
}

function SurveyRow({ title, meta, point, onClick }) {
  return (
    <button className="survey-row" type="button" onClick={onClick}>
      <span>
        <strong>{title}</strong>
        <small>{meta}</small>
      </span>
      <PointPill value={point} />
    </button>
  )
}

function SectionHeader({ icon, title, count, action }) {
  return (
    <div className="section-header">
      <strong><span>{icon}</span> {title} <small>{count}</small></strong>
      {action ? <button type="button" className={action.includes('1.5배') ? 'section-action is-boost' : 'section-action'}>{action}</button> : null}
    </div>
  )
}

function HomeScreen({ navigate, isCheckedIn, onCheckIn }) {
  const [checkinOpen, setCheckinOpen] = useState(false)
  return (
    <div className="screen with-nav">
      <TopBar
        title="suniversity"
        brand
        right={
          <div className="top-actions">
            <IconButton label="검색">⌕</IconButton>
            <IconButton label="알림" badge="3" onClick={() => navigate('notifications')}><BellIcon /></IconButton>
            <button className="avatar-button" type="button" onClick={() => navigate('profile')}>MY</button>
          </div>
        }
      />

      <main className="screen-content home-content">
        <button className={isCheckedIn ? 'checkin-card is-complete' : 'checkin-card'} type="button" onClick={() => setCheckinOpen(true)}>
          <span>{isCheckedIn ? '오늘 출석을 완료했어요' : '오늘도 반가워요 👋'}</span>
          <b>{isCheckedIn ? '출석 완료 ✓' : '출석체크 +10P'}</b>
        </button>

        <div className="sponsor-card">
          <span><small>SPONSORED · 기업광고</small><b>대학생 커리어 설문 이벤트</b></span>
          <button type="button">참여하기</button>
        </div>

        <section>
          <SectionHeader icon="🔥" title="HOT 설문" count="5개" action="전체보기 ›" />
          <div className="stack-sm">
            <SurveyRow title="대학생의 AI 활용과 취업 준비" meta="82 / 100명 · 약 3분" point={20} onClick={() => navigate('participate')} />
            <SurveyRow title="배달앱 선택 기준과 소비 습관" meta="211명 참여 · 약 2분" point={15} onClick={() => navigate('participate')} />
          </div>
        </section>

        <section>
          <SectionHeader icon="⏰" title="마감임박" count="4개" action="보상 1.5배" />
          <div className="grid-two">
            <button className="mini-card" type="button" onClick={() => navigate('participate')}><b>캡스톤 협업 경험</b><small>2시간 남음 · <em className="point-text">+45P</em></small></button>
            <button className="mini-card" type="button" onClick={() => navigate('participate')}><b>통학 만족도 조사</b><small>오늘 마감 · <em className="point-text">+30P</em></small></button>
          </div>
        </section>

        <section>
          <SectionHeader icon="✨" title="새로 올라온 설문" count="8개" action="더보기 ›" />
          <div className="grid-two">
            <button className="mini-card" type="button" onClick={() => navigate('participate')}><b>데이트 비용 인식</b><small>방금 등록 · <em className="point-text">+10P</em></small></button>
            <button className="mini-card" type="button" onClick={() => navigate('participate')}><b>공모전 참여 경험</b><small>5분 전 · <em className="point-text">+20P</em></small></button>
          </div>
        </section>

        <section>
          <SectionHeader icon="💙" title="관심 분야 설문" count="" action="취업 · 소비 기반" />
          <div className="stack-sm">
            <SurveyRow title="Z세대 구독 서비스 이용 행태" meta="관심사 일치 92% · 약 4분" point={30} onClick={() => navigate('participate')} />
            <SurveyRow title="대학생 취업 준비 비용 조사" meta="관심사 일치 87% · 약 3분" point={20} onClick={() => navigate('participate')} />
          </div>
        </section>

        <section>
          <SectionHeader icon="📣" title="유저 광고" count="" />
          <div className="ad-grid">
            <span>프로젝트<br />응답 모집</span>
            <span>창업 아이디어<br />검증 설문</span>
            <span>논문 설문<br />도와주세요</span>
          </div>
        </section>
      </main>

      <button className="fab" type="button" onClick={() => navigate('create')}>＋ 설문 등록</button>
      <BottomNav active="home" navigate={navigate} />
      {checkinOpen ? <div className="modal-backdrop" role="presentation" onClick={() => setCheckinOpen(false)}>
        <section className="checkin-modal" role="dialog" aria-modal="true" aria-labelledby="checkin-title" onClick={(event) => event.stopPropagation()}>
          <button className="modal-close" type="button" aria-label="닫기" onClick={() => setCheckinOpen(false)}>×</button>
          <div className={isCheckedIn ? 'checkin-stamp is-complete' : 'checkin-stamp'}>{isCheckedIn ? '✓' : '+10P'}</div>
          <h2 id="checkin-title">{isCheckedIn ? '오늘 출석 완료!' : '오늘의 출석체크'}</h2>
          <p>{isCheckedIn ? '내일 다시 방문하면 출석 포인트를 받을 수 있어요.' : '매일 한 번 출석하고 10P를 받아보세요.'}</p>
          <div className="checkin-week">{['월', '화', '수', '목', '금', '토', '일'].map((day, index) => <span key={day} className={index < 3 || isCheckedIn && index === 3 ? 'is-stamped' : ''}><b>{index < 3 || isCheckedIn && index === 3 ? '✓' : day}</b><small>{day}</small></span>)}</div>
          <button className="primary-button" type="button" disabled={isCheckedIn} onClick={() => { onCheckIn(); setCheckinOpen(false) }}>{isCheckedIn ? '오늘 출석 완료' : '출석하고 10P 받기'}</button>
        </section>
      </div> : null}
    </div>

  )
}

function SurveyListScreen({ navigate, customSurveys = [] }) {
  const [category, setCategory] = useState('전체')
  const [query, setQuery] = useState('')
  const [showCategories, setShowCategories] = useState(true)
  const { data: fetchedSurveys, isLoading, error, reload } = useAsyncData(mockApi.getSurveys)
  const allSurveys = [...customSurveys, ...(fetchedSurveys || [])]
  const filteredSurveys = allSurveys.filter((survey) => {
    const matchesQuery = survey.title.toLowerCase().includes(query.toLowerCase())
    const matchesCategory = category === '전체' || survey.eyebrow.includes(category)
    return matchesQuery && matchesCategory
  })
  const categories = [
    ['전체', 'all', '모든 설문을 한눈에'],
    ['연구·프로젝트', 'career', '논문·팀플·캡스톤'],
    ['재미', 'mbti', '연애·심리·유머·밈'],
    ['대학생활', 'campus', '통학·학식·수강신청'],
    ['트렌드', 'all', 'AI·SNS·게임·OTT'],
    ['소비', 'consume', '쇼핑·식생활·서비스'],
    ['라이프', 'love', '운동·여행·취미'],
    ['토론', 'school', '찬반·사회 이슈·투표'],
    ['인기', 'all', 'HOT·급상승·마감 임박'],
  ]

  if (showCategories) {
    return (
      <div className="screen with-nav">
        <TopBar title="설문" onBack={() => navigate('home')} right={<IconButton label="알림" onClick={() => navigate('notifications')}><BellIcon /></IconButton>} />
        <main className="screen-content category-home">
          <span className="category-kicker">관심 분야를 골라보세요</span>
          <h1>어떤 설문을<br />찾고 있나요?</h1>
          <p>카테고리를 선택하면 관련 설문만 모아볼 수 있어요.</p>
          <div className="category-grid">
            {categories.map(([label, icon, description]) => (
              <button key={label} type="button" className={label === '전체' ? 'category-card category-card--all' : 'category-card'} onClick={() => { setCategory(label); setShowCategories(false) }}>
                <span className="category-icon"><UiIcon name={icon} /></span>
                <b>{label}</b>
                <small>{description}</small>
              </button>
            ))}
          </div>
        </main>
        <BottomNav active="surveys" navigate={navigate} />
      </div>
    )
  }

  return (
    <div className="screen with-nav">
      <TopBar title="설문 둘러보기" onBack={() => setShowCategories(true)} right={<IconButton label="알림" onClick={() => navigate('notifications')}><BellIcon /></IconButton>} />
      <main className="screen-content list-content">
        <label className="search-box">
          <span>⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="키워드로 설문 검색" />
        </label>

        <SectionHeader title="내게 맞는 설문" count="" action="추천순⌄" />
        {isLoading ? <div className="loading-state" aria-label="설문 불러오는 중"><i /><i /><i /></div> : null}
        {error ? <div className="empty-state"><b>설문을 불러오지 못했어요</b><p>{error.message}</p><button type="button" onClick={reload}>다시 시도</button></div> : null}
        {!isLoading && !error && filteredSurveys.length === 0 ? <div className="empty-state"><b>조건에 맞는 설문이 없어요</b><p>검색어나 카테고리를 바꿔보세요.</p><button type="button" onClick={() => { setQuery(''); setCategory('전체') }}>필터 초기화</button></div> : null}
        <div className="survey-card-list">
          {!isLoading && !error && filteredSurveys.map((survey, index) => (
            <button className="survey-card" key={survey.title} type="button" onClick={() => navigate('participate')}>
              <span className={'survey-eyebrow ' + survey.tone}>{survey.eyebrow}</span>
              <div className="survey-title-row"><strong>{survey.title}</strong><PointPill value={survey.point} /></div>
              <div className="survey-meta"><span>{survey.meta}</span><span>{survey.count}</span></div>
              {index === 0 ? <div className="progress-line"><span /></div> : null}
            </button>
          ))}
        </div>
      </main>
      <BottomNav active="surveys" navigate={navigate} />
    </div>
  )
}

function ParticipateScreen({ onComplete, onExit }) {
  const questions = [
    { title: '과제할 때 AI, 얼마나 자주 꺼내 쓰나요?', options: ['거의 안 써요', '한 달에 1~2번 써요', '일주일에 1~2번 써요', '거의 매일 써요'], rates: [8, 15, 46, 31] },
    { title: '가장 손이 자주 가는 AI는 무엇인가요?', options: ['ChatGPT', 'Claude', 'Gemini', '다른 도구'], rates: [64, 12, 19, 5] },
    { title: 'AI에게 주로 어떤 일을 부탁하나요?', options: ['자료 찾기', '글쓰기·요약', '코딩·분석', '아이디어 얻기'], rates: [28, 34, 21, 17] },
    { title: '솔직히 AI가 과제에 얼마나 도움 됐나요?', options: ['정말 많이 됐어요', '꽤 도움 됐어요', '그저 그래요', '별로 안 됐어요'], rates: [33, 42, 19, 6] },
    { title: '학교에서 AI 활용법을 알려주면 들을 건가요?', options: ['꼭 듣고 싶어요', '있으면 들을래요', '아직 모르겠어요', '필요 없어요'], rates: [24, 48, 21, 7] },
  ]
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [showMenu, setShowMenu] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const selected = answers[questionIndex]
  const question = questions[questionIndex]
  const isLast = questionIndex === questions.length - 1
  const selectAnswer = (index) => setAnswers({ ...answers, [questionIndex]: index })
  const goNext = () => {
    if (selected === undefined) return
    if (isLast) {
      setIsSubmitting(true)
      window.setTimeout(() => onComplete(30, 'AI 활용 만렙 새내기'), 1200)
    } else setQuestionIndex(questionIndex + 1)
  }
  if (isSubmitting) return <div className="screen"><main className="screen-content result-wait"><div className="result-wait-spinner" /><h1>응답을 분석하고 있어요</h1><p>나와 비슷한 대학생을 찾는 중이에요.<br />잠시만 기다려 주세요!</p></main></div>
  return (
    <div className="screen">
      <TopBar title="설문 참여" onBack={() => questionIndex ? setQuestionIndex(questionIndex - 1) : onExit()} right={<IconButton label="더보기" onClick={() => setShowMenu(!showMenu)}>•••</IconButton>} />
      {showMenu ? <div className="survey-more-menu"><button type="button" onClick={() => { navigator.clipboard?.writeText(window.location.href); setShowMenu(false) }}>설문 링크 공유</button><button type="button" onClick={() => setShowMenu(false)}>관심 설문 저장</button><button type="button" className="danger" onClick={() => { window.alert('신고가 접수되었습니다.'); setShowMenu(false) }}>설문 신고</button></div> : null}
      <main className="screen-content participate-content">
        <div className="survey-progress-label"><span>질문 {questionIndex + 1} / {questions.length}</span><span>{Math.round((questionIndex + 1) / questions.length * 100)}% 진행</span></div>
        <div className="survey-progress"><span style={{ width: ((questionIndex + 1) / questions.length * 100) + '%' }} /></div>
        <p className="required-label">필수 질문 · 지금까지의 응답</p>
        <h1 className="question-title">{question.title}</h1>
        <div className="option-list">{question.options.map((option, index) => <button type="button" key={option} className={selected === index ? 'answer-option is-selected' : 'answer-option'} onClick={() => selectAnswer(index)}><span>{option}{selected === index ? ' ✓' : ''}</span>{selected !== undefined ? <span className="live-rate"><i style={{ width: `${question.rates[index]}%` }} /><b>{question.rates[index]}%</b></span> : null}</button>)}</div>
        <div className="reward-banner"><strong>30P</strong><span>끝까지 응답하면<br /><b>포인트와 나만의 별명을 받아요</b></span></div>
        <button className="primary-button" disabled={selected === undefined} type="button" onClick={goNext}>{isLast ? '응답 완료하고 결과 분석하기' : '다음 질문'}</button>
        <p className="privacy-note">응답은 익명으로 안전하게 저장됩니다.</p>
      </main>
    </div>
  )
}function ResultAccessScreen({ navigate, points, unlockResult }) {
  const resultPrice = 100
  return (
    <div className="screen">
      <TopBar title="응답 완료" onBack={() => navigate('surveys')} />
      <main className="screen-content result-access-content">
        <div className="completion-icon">✓</div>
        <h1>응답이 제출됐어요</h1>
        <p>참여 보상 30P가 지급되었습니다.</p>
        <div className="result-lock-card">
          <span>설문 결과 미리보기</span>
          <b>다른 응답자의 결과가 궁금한가요?</b>
          <small>전체 응답 분포와 핵심 인사이트를 확인할 수 있어요.</small>
          <button type="button" disabled={points < resultPrice} onClick={() => unlockResult(resultPrice)}>100P로 결과 열람</button>
        </div>
        <button className="soft-button" type="button" onClick={() => navigate('surveys')}>설문 목록으로 돌아가기</button>
        <p className="privacy-note">현재 보유 포인트 {points.toLocaleString()}P</p>
      </main>
    </div>
  )
}
function CreateScreen({ navigate, onPublish, points, spendPoints }) {
  const [savedDraft] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('suniversity-survey-draft')) || {}
    } catch {
      return {}
    }
  })
  const [step, setStep] = useState(1)
  const [showGuide, setShowGuide] = useState(true)
  const [title, setTitle] = useState(savedDraft.title || '대학생의 AI 활용 경험 조사')
  const [category, setCategory] = useState(savedDraft.category || '연구·프로젝트')
  const [targetCount, setTargetCount] = useState(savedDraft.targetCount || 100)
  const [reward, setReward] = useState(savedDraft.reward || 20)
  const [isPublic, setIsPublic] = useState(savedDraft.isPublic ?? true)
  const [saveLabel, setSaveLabel] = useState('임시저장')
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [questions, setQuestions] = useState(savedDraft.questions || [
    { id: 'q1', title: '현재 학년을 선택해 주세요', type: 'single', required: true, options: ['1학년', '2학년', '3학년', '4학년 이상'] },
    { id: 'q2', title: 'AI 도구 사용 빈도는?', type: 'single', required: true, options: ['거의 사용하지 않음', '주 1~2회', '주 3회 이상'] },
    { id: 'q3', title: '가장 유용했던 기능은?', type: 'multiple', required: false, options: ['자료 조사', '글쓰기', '코딩', '아이디어 발상'] },
  ])

  const typeLabels = { single: '객관식', multiple: '복수 선택', text: '주관식' }
  const updateQuestion = (id, changes) => setQuestions(questions.map((question) => question.id === id ? { ...question, ...changes } : question))
  const addQuestion = (type = 'single') => {
    const nextNumber = questions.length + 1
    setQuestions([...questions, {
      id: `q-${Date.now()}`,
      title: `새로운 질문 ${nextNumber}`,
      type,
      required: false,
      options: type === 'text' ? [] : ['선택지 1', '선택지 2'],
    }])
  }
  const moveQuestion = (index, direction) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= questions.length) return
    const next = [...questions]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    setQuestions(next)
  }
  const updateOption = (question, optionIndex, value) => {
    const options = [...question.options]
    options[optionIndex] = value
    updateQuestion(question.id, { options })
  }
  const removeOption = (question, optionIndex) => updateQuestion(question.id, { options: question.options.filter((_, index) => index !== optionIndex) })
  const isQuestionValid = (question) => question.title.trim() && (question.type === 'text' || (question.options.length >= 2 && question.options.every((option) => option.trim())))
  const canContinue = title.trim() && questions.length > 0 && questions.every(isQuestionValid)

  const saveDraft = () => {
    localStorage.setItem('suniversity-survey-draft', JSON.stringify({ title, category, targetCount, reward, isPublic, questions }))
    setSaveLabel('저장 완료')
    window.setTimeout(() => setSaveLabel('임시저장'), 1400)
  }

  const publish = async () => {
    const budget = targetCount * reward
    if (points < budget) {
      setPublishError(`등록에 ${budget.toLocaleString()}P가 필요해요. 현재 ${points.toLocaleString()}P를 보유하고 있어요.`)
      return
    }
    setIsPublishing(true)
    setPublishError('')
    try {
      const survey = await mockApi.createSurvey({ title: title.trim(), category, targetCount, reward, questionCount: questions.length, questions, isPublic })
      if (!spendPoints(budget, '설문 참여 보상 예산')) return
      onPublish({ ...survey, eyebrow: `새 설문 · ${category}`, meta: `${questions.length}문항 · 약 ${Math.max(1, Math.ceil(questions.length * 0.6))}분`, count: `0 / ${targetCount}`, point: reward, tone: 'blue' })
      localStorage.removeItem('suniversity-survey-draft')
      navigate('surveys')
    } catch (error) {
      setPublishError(error.message)
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="screen">
      <TopBar title="새 설문 만들기" onBack={() => step > 1 ? setStep(step - 1) : navigate('home')} right={<button className="text-action" type="button" onClick={saveDraft}>{saveLabel}</button>} />
      {showGuide ? <div className="modal-backdrop builder-guide-backdrop"><section className="builder-guide"><button className="modal-close" type="button" onClick={() => setShowGuide(false)}>×</button><span>설문 작성 가이드</span><h2>친구에게 묻듯<br />쉽게 써보세요</h2><ul><li>어려운 전문용어 대신 익숙한 말을 사용해요.</li><li>한 문항에는 한 가지 내용만 물어봐요.</li><li>짧고 자연스러운 대화체가 응답률을 높여요.</li></ul><button className="primary-button" type="button" onClick={() => setShowGuide(false)}>가이드 확인했어요</button></section></div> : null}
      <div className="step-progress"><span /><span className={step >= 2 ? '' : 'pending'} /><span className={step >= 3 ? '' : 'pending'} /></div>
      <main className="screen-content create-content">
        {step === 1 ? <>
          <h1>질문을 구성해 주세요</h1>
          <p className="subtitle">문항 유형과 선택지를 직접 편집할 수 있어요.</p>
          <label className="builder-field">설문 제목<input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} /><small>딱딱한 조사명보다 결과가 궁금해지는 제목이 좋아요.</small></label><div className="title-suggestions"><b>AI 제목 제안</b><button type="button" onClick={() => setTitle('과제할 때 AI 없으면 불안한 사람, 나뿐일까?')}>과제할 때 AI 없으면 불안한 사람, 나뿐일까?</button><button type="button" onClick={() => setTitle('대학생들은 AI를 어디까지 믿고 쓸까?')}>대학생들은 AI를 어디까지 믿고 쓸까?</button></div>
          <div className="ai-helper">
            <b>✦ AI 문항 도우미</b>
            <small>주제와 대상을 분석해 중복 없는 질문과 예상 소요시간을 제안해요.</small>
            <button type="button" onClick={() => setQuestions([...questions, { id: `ai-${Date.now()}`, title: 'AI 사용이 학업 효율에 얼마나 도움이 되었나요?', type: 'single', required: true, options: ['매우 도움 됨', '도움 됨', '보통', '도움 되지 않음'] }])}>AI로 문항 추천 · 20P</button>
          </div>
          <div className="question-list">
            {questions.map((question, index) => (
              <article className="question-editor" key={question.id}>
                <div className="question-editor-head">
                  <b>Q{index + 1}</b>
                  <div className="question-move">
                    <button type="button" disabled={index === 0} aria-label="문항 위로 이동" onClick={() => moveQuestion(index, -1)}>↑</button>
                    <button type="button" disabled={index === questions.length - 1} aria-label="문항 아래로 이동" onClick={() => moveQuestion(index, 1)}>↓</button>
                    <button type="button" className="delete-question" aria-label="문항 삭제" onClick={() => setQuestions(questions.filter((item) => item.id !== question.id))}>×</button>
                  </div>
                </div>
                <small className="tone-guide">쉽고 짧게, 친구에게 말하듯 작성해 보세요.</small><input className="question-title-input" value={question.title} onChange={(event) => updateQuestion(question.id, { title: event.target.value })} aria-label={`Q${index + 1} 질문`} />
                <div className="question-settings">
                  <select value={question.type} onChange={(event) => {
                    const type = event.target.value
                    updateQuestion(question.id, { type, options: type === 'text' ? [] : (question.options.length ? question.options : ['선택지 1', '선택지 2']) })
                  }}>
                    <option value="single">객관식</option>
                    <option value="multiple">복수 선택</option>
                    <option value="text">주관식</option>
                  </select>
                  <label><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(question.id, { required: event.target.checked })} /> 필수</label>
                </div>
                {question.type !== 'text' ? <div className="option-editor">
                  {question.options.map((option, optionIndex) => <div key={`${question.id}-${optionIndex}`}>
                    <span>{question.type === 'multiple' ? '□' : '○'}</span>
                    <input value={option} aria-label={`선택지 ${optionIndex + 1}`} onChange={(event) => updateOption(question, optionIndex, event.target.value)} />
                    <button type="button" disabled={question.options.length <= 2} aria-label="선택지 삭제" onClick={() => removeOption(question, optionIndex)}>×</button>
                  </div>)}
                  <button type="button" className="add-option" onClick={() => updateQuestion(question.id, { options: [...question.options, `선택지 ${question.options.length + 1}`] })}>＋ 선택지 추가</button>
                </div> : <div className="text-answer-preview">응답자가 자유롭게 내용을 입력합니다.</div>}
                {!isQuestionValid(question) ? <small className="field-error">질문과 선택지를 모두 입력해 주세요.</small> : <small className="question-meta">{typeLabels[question.type]} · {question.required ? '필수' : '선택'}</small>}
              </article>
            ))}
          </div>
          <div className="question-type-actions">
            <button type="button" onClick={() => addQuestion('single')}>＋ 객관식</button>
            <button type="button" onClick={() => addQuestion('multiple')}>＋ 복수 선택</button>
            <button type="button" onClick={() => addQuestion('text')}>＋ 주관식</button>
          </div>
          <button className="primary-button" disabled={!canContinue} type="button" onClick={() => setStep(2)}>다음 · 대상 및 보상 설정</button>
        </> : null}

        {step === 2 ? <>
          <h1>대상과 보상을<br />설정해 주세요</h1>
          <p className="subtitle">원하는 응답자와 모집 규모를 정할 수 있어요.</p>
          <label className="builder-field">카테고리<select value={category} onChange={(event) => setCategory(event.target.value)}><option>연구·프로젝트</option><option>재미</option><option>대학생활</option><option>트렌드</option><option>소비</option><option>라이프</option><option>토론</option></select></label>
          <label className="builder-field">목표 응답자 수<input type="number" min="10" max="1000" value={targetCount} onChange={(event) => setTargetCount(Number(event.target.value))} /></label>
          <label className="builder-field">1인당 참여 보상<input type="range" min="5" max="40" step="5" value={reward} onChange={(event) => setReward(Number(event.target.value))} /><strong>{reward}P</strong></label>
          <label className="toggle-row"><span><b>결과 공개</b><small>공개하면 커뮤니티 포인트 혜택을 받아요.</small></span><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} /></label>
          <div className="budget-card"><span>예상 필요 포인트</span><strong>{(targetCount * reward).toLocaleString()}P</strong><small>목표 응답자 수 × 참여 보상</small></div>
          <button className="primary-button" type="button" onClick={() => setStep(3)}>다음 · 등록 내용 검토</button>
        </> : null}

        {step === 3 ? <>
          <h1>등록 전에<br />확인해 주세요</h1>
          <p className="subtitle">등록 후 검수를 거쳐 설문 목록에 공개됩니다.</p>
          <div className="review-card"><small>설문 제목</small><b>{title}</b></div>
          <div className="review-grid"><div><small>카테고리</small><b>{category}</b></div><div><small>문항 수</small><b>{questions.length}개</b></div><div><small>목표 응답</small><b>{targetCount}명</b></div><div><small>참여 보상</small><b>{reward}P</b></div></div>
          <div className="review-card review-questions"><small>문항 구성</small>{questions.map((question, index) => <span key={question.id}><b>Q{index + 1}. {question.title}</b><em>{typeLabels[question.type]} · {question.required ? '필수' : '선택'}</em></span>)}</div>
          <div className="review-card"><small>결과 공개</small><b>{isPublic ? '커뮤니티 공개' : '작성자만 보기'}</b></div>
          {points < targetCount * reward ? <p className="publish-error">포인트가 부족해요. 포인트 화면에서 설문이나 광고에 참여해 주세요.</p> : null}
          {publishError ? <p className="publish-error">{publishError}</p> : null}
          <button className="primary-button" disabled={isPublishing || points < targetCount * reward} type="button" onClick={publish}>{isPublishing ? '등록 중...' : `${(targetCount * reward).toLocaleString()}P 결제하고 등록하기`}</button>
        </> : null}
      </main>
    </div>
  )
}
const balanceGames = [
  { id: 1, category: '학교생활', question: '팀플에서 더 힘든 상황은?', a: '회의에는 오지만 아무것도 안 하는 팀원', b: '연락은 없지만 결과물은 잘 내는 팀원', aLabel: '참여파', bLabel: '결과파', aPercent: 58, participants: '1,284' },
  { id: 2, category: '연애', question: '연인과 다툰 뒤, 더 나은 선택은?', a: '그날 바로 끝까지 대화하기', b: '하루 식히고 차분하게 말하기', aLabel: '직진파', bLabel: '숙고파', aPercent: 46, participants: '932' },
  { id: 3, category: '진로', question: '첫 직장을 고를 때 더 중요한 것은?', a: '배울 것이 많은 낮은 연봉', b: '업무는 익숙하지만 높은 연봉', aLabel: '성장파', bLabel: '보상파', aPercent: 63, participants: '2,106' },
  { id: 4, category: '소비', question: '여행에서 하나만 포기해야 한다면?', a: '숙소의 편안함', b: '맛집과 먹거리', aLabel: '맛집파', bLabel: '숙소파', aPercent: 52, participants: '786' },
]

const initialDebates = [
  { id: 1, gameId: 1, team: 'A', author: '과제요정', text: '팀플은 과정도 함께 책임지는 게 중요해요. 회의에서 역할을 나누고 같이 움직여야 배울 수 있다고 봐요.', likes: 24, replies: [{ id: 11, author: '밤샘러', text: '맞아요. 결과만 던져주면 중간에 방향을 맞추기가 너무 어렵더라고요.' }] },
  { id: 2, gameId: 1, team: 'B', author: '효율중심', text: '연락 방식은 아쉬워도 맡은 결과를 확실히 내면 팀 전체 일정에는 더 도움이 됩니다.', likes: 18, replies: [{ id: 21, author: '마감수호대', text: '결과의 완성도를 보장한다면 저도 이쪽이에요.' }] },
]

function TeamAvatar({ team, name, small = false }) {
  return <span className={`team-avatar team-${team.toLowerCase()} ${small ? 'is-small' : ''}`}>{name.slice(0, 1)}</span>
}

function BalanceGameScreen({ navigate, onVote }) {
  const [activeGame, setActiveGame] = useState(null)
  const [votes, setVotes] = useState({})
  const [posts, setPosts] = useState(initialDebates)
  const [draft, setDraft] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyDraft, setReplyDraft] = useState('')
  const selected = activeGame ? votes[activeGame.id] : null

  const vote = (choice) => {
    if (selected) return
    setVotes({ ...votes, [activeGame.id]: choice })
    onVote()
  }
  const addPost = () => {
    if (!draft.trim() || !selected) return
    setPosts([{ id: Date.now(), gameId: activeGame.id, team: selected, author: '나', text: draft.trim(), likes: 0, replies: [] }, ...posts])
    setDraft('')
  }
  const addReply = (postId) => {
    if (!replyDraft.trim() || !selected) return
    setPosts(posts.map((post) => post.id === postId ? { ...post, replies: [...post.replies, { id: Date.now(), author: '나', text: replyDraft.trim(), team: selected }] } : post))
    setReplyDraft('')
    setReplyingTo(null)
  }

  if (!activeGame) return (
    <div className="screen with-nav">
      <TopBar title="밸런스 게임" onBack={() => navigate('home')} />
      <main className="screen-content balance-feed">
        <div className="balance-feed-heading"><span>생각이 갈리는 순간</span><h1>당신의 선택은<br />어느 쪽인가요?</h1><p>카드를 골라 투표하고 같은 편과 의견을 나눠보세요.</p></div>
        <div className="balance-feed-grid">
          {balanceGames.map((game) => <button className="balance-feed-card" type="button" key={game.id} onClick={() => setActiveGame(game)}>
            <span className="balance-category">{game.category}</span><strong>{game.question}</strong>
            <div><span className="blue-preview">{game.a}</span><b>VS</b><span className="red-preview">{game.b}</span></div>
            <small>{game.participants}명 참여 · 의견 보기 →</small>
          </button>)}
        </div>
      </main>
      <BottomNav active="balance" navigate={navigate} />
    </div>
  )

  const gamePosts = posts.filter((post) => post.gameId === activeGame.id)
  return (
    <div className="screen with-nav">
      <TopBar title="밸런스 게임" onBack={() => setActiveGame(null)} />
      <main className="screen-content balance-detail">
        <span className="balance-category">{activeGame.category} · {activeGame.participants}명 참여</span>
        <h1>{activeGame.question}</h1>
        <div className={`versus-poll ${selected ? 'has-result' : ''}`}>
          <button type="button" className={selected === 'A' ? 'poll-side poll-blue is-selected' : 'poll-side poll-blue'} onClick={() => vote('A')} style={selected ? { '--fill': `${activeGame.aPercent}%` } : undefined}><small>A · {activeGame.aLabel}</small><b>{activeGame.a}</b>{selected ? <strong>{activeGame.aPercent}%</strong> : <span>선택하기</span>}</button>
          <i>VS</i>
          <button type="button" className={selected === 'B' ? 'poll-side poll-red is-selected' : 'poll-side poll-red'} onClick={() => vote('B')} style={selected ? { '--fill': `${100 - activeGame.aPercent}%` } : undefined}><small>B · {activeGame.bLabel}</small><b>{activeGame.b}</b>{selected ? <strong>{100 - activeGame.aPercent}%</strong> : <span>선택하기</span>}</button>
        </div>
        {!selected ? <p className="vote-guide">하나를 선택하면 실시간 비율과 진영별 토론장이 열려요.</p> : <>
          <div className={`my-team-banner team-${selected.toLowerCase()}`}><TeamAvatar team={selected} name="나" /><span><small>내 선택</small><b>{selected === 'A' ? activeGame.aLabel : activeGame.bLabel} 토론에 참여 중</b></span><strong>+2P</strong></div>
          <section className="debate-section">
            <div className="debate-heading"><span>TEAM A · {activeGame.aLabel}</span><b>의견 토론장</b><span>TEAM B · {activeGame.bLabel}</span></div>
            <div className={`debate-composer team-${selected.toLowerCase()}`}><TeamAvatar team={selected} name="나" /><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`${selected === 'A' ? activeGame.aLabel : activeGame.bLabel}을 선택한 이유를 남겨보세요`} /><button type="button" onClick={addPost}>등록</button></div>
            <div className="debate-list">
              {gamePosts.length ? gamePosts.map((post) => <article className={`debate-post team-${post.team.toLowerCase()}`} key={post.id}>
                <div className="post-head"><TeamAvatar team={post.team} name={post.author} /><span><b>{post.author}</b><small>{post.team === 'A' ? activeGame.aLabel : activeGame.bLabel} · 방금 전</small></span></div>
                <p>{post.text}</p><div className="post-actions"><button type="button">공감 {post.likes}</button><button type="button" onClick={() => setReplyingTo(replyingTo === post.id ? null : post.id)}>답글 {post.replies.length}</button></div>
                {post.replies.map((reply) => <div className={`debate-reply team-${(reply.team || post.team).toLowerCase()}`} key={reply.id}><TeamAvatar team={reply.team || post.team} name={reply.author} small /><span><b>{reply.author}</b><p>{reply.text}</p></span></div>)}
                {replyingTo === post.id ? <div className={`reply-composer team-${selected.toLowerCase()}`}><TeamAvatar team={selected} name="나" small /><input value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} placeholder="답글을 입력하세요" /><button type="button" onClick={() => addReply(post.id)}>등록</button></div> : null}
              </article>) : <div className="empty-debate">첫 번째 의견을 남겨 토론을 시작해보세요.</div>}
            </div>
          </section>
        </>}
      </main>
      <BottomNav active="balance" navigate={navigate} />
    </div>
  )
}
function ResultScreen({ navigate, spendPoints }) {
  return (<div className="screen"><TopBar title="설문 결과" onBack={() => navigate('home')} right={<IconButton label="공유">↗</IconButton>} /><main className="screen-content result-content"><span className="result-nickname">이번 설문의 내 별명</span><h1>AI 활용 만렙<br />새내기</h1><p className="subtitle">AI를 능숙하게 쓰면서도 새로운 활용법을 궁금해하는 유형이에요.</p><div className="stat-grid"><div><strong>104</strong><small>총 응답</small></div><div><strong>92%</strong><small>완료율</small></div><div><strong>3:12</strong><small>평균 시간</small></div></div><SectionHeader title="나와 같은 답을 고른 사람" count="" action="68%" /><div className="match-card"><strong>68%</strong><span>응답자 10명 중 약 7명이<br />나와 비슷하게 답했어요.</span></div><SectionHeader title="그룹별 응답 비교" count="" action="Q3 기준" /><div className="comparison-grid"><article><b>남녀 비교</b><p><span style={{ width: '57%' }}>남 57%</span><span style={{ width: '43%' }}>여 43%</span></p><small>남학생의 주 1회 이상 활용 비율이 8%p 높아요.</small></article><article><b>학교 비교</b><p><span style={{ width: '64%' }}>우리 학교 64%</span><span style={{ width: '36%' }}>다른 학교 36%</span></p><small>우리 학교 학생이 코딩·분석 용도로 더 자주 사용해요.</small></article></div><div className="insight-card"><b>✦ AI 핵심 인사이트</b><p>응답자의 68%가 주 1회 이상 AI를 활용하며, 취업 준비 집단에서 활용 빈도가 더 높아요.</p></div><button className="primary-button" type="button" onClick={() => spendPoints(200, 'AI 심층 분석')}>심층 분석 보기 · 200P</button><button className="soft-button" type="button" onClick={() => spendPoints(400, 'PPT 자동 생성')}>PPT 자동 생성 · 400P</button></main></div>)
}
function PointsScreen({ navigate, points, transactions, spendPoints, adEarned, onWatchAd }) {
  return (
    <div className="screen with-nav">
      <TopBar title="포인트" onBack={() => navigate('home')} right={<IconButton label="도움말">?</IconButton>} />
      <main className="screen-content points-content">
        <div className="balance-card"><small>사용 가능 포인트</small><strong><span>P</span> {points.toLocaleString()} P</strong><b>↑ 이번 달 +780P 적립</b></div>
        <SectionHeader title="포인트 더 모으기" count="" action={`${Math.floor(adEarned / 10)}/5회`} />
        <div className="watch-card"><b>광고 보고 10P 받기</b><small>오늘 광고로 {adEarned.toLocaleString()}P를 모았어요. 하루 최대 5회, 총 50P까지 받을 수 있어요.</small><div className="daily-ad-progress"><span style={{ width: `${Math.min(100, adEarned * 2)}%` }} /></div><button type="button" disabled={adEarned >= 50} onClick={onWatchAd}>{adEarned >= 50 ? '오늘 한도 달성' : '30초 광고 시청'}</button></div>
        <SectionHeader title="기프티콘 교환" count="" action="전체보기" />
        <button className="gift-card" type="button" onClick={() => spendPoints(3000, '아메리카노 교환')}><div className="gift-image coffee">☕</div><span><b>아메리카노</b><small>모바일 교환권</small></span><strong>3,000P</strong></button>
        <div className="gift-card"><div className="gift-image cone">🍦</div><span><b>편의점 상품권</b><small>3,000원권</small></span><strong>3,500P</strong></div>
        <p className="foot-note">설문 참여 후 광고를 보면 20문항까지 보상을 2배로 받을 수 있어요.</p><div className="transaction-list"><b>최근 포인트 내역</b>{transactions.map((item) => <div key={item.id}><span>{item.label}</span><strong className={item.amount > 0 ? 'plus' : 'minus'}>{item.amount > 0 ? '+' : ''}{item.amount}P</strong></div>)}</div>
      </main>
      <BottomNav active="points" navigate={navigate} />
    </div>
  )
}

function RankingScreen({ navigate }) {
  const leaders = [
    ['1', '설문요정 · 고려대', '18,920P'],
    ['2', '응답왕 · 홍익대', '17,480P'],
    ['3', '과제구조대 · 연세대', '16,210P'],
    ['4', '통계실어 · 중앙대', '14,870P'],
    ['5', '논문졸업 · 성균관대', '13,550P'],
  ]
  return (
    <div className="screen with-nav">
      <TopBar title="응답자 랭킹" onBack={() => navigate('home')} right={<IconButton label="정보">i</IconButton>} />
      <main className="screen-content ranking-content">
        <div className="chips"><button className="chip is-active" type="button">전체</button><button className="chip" type="button">우리 학교</button><button className="chip" type="button">이번 달</button></div>
        <div className="rank-neighbor muted"><span>17위 답변척척 · 건국대</span><b>5,620P</b></div>
        <div className="my-rank"><span className="rank-circle">18</span><span><b>나 · LEVEL 7</b><small>다음 레벨까지 460P</small></span><strong>5,540P</strong></div>
        <div className="rank-neighbor muted"><span>19위 논문한줄 · 성균관대</span><b>5,430P</b></div>
        <p className="rank-tip">✨ 내 주변 순위를 더 확인해 보세요</p>
        <SectionHeader title="명예의 전당" count="" action="TOP 30" />
        <div className="leader-list">
          {leaders.map(([rank, name, point]) => <div key={rank}><b>{rank}</b><span>{name}</span><strong>{point}</strong></div>)}
        </div>
        <div className="weekly-card"><b>이번 주 도전</b><p>설문 3개 더 참여하고 레벨업 보상 100P를 받아보세요.</p></div>
      </main>
      <BottomNav active="ranking" navigate={navigate} />
    </div>
  )
}

function VerifyScreen({ navigate, onVerify }) {
  const [phoneVerified, setPhoneVerified] = useState(true)
  return (
    <div className="screen">
      <TopBar title="suniversity" brand onBack={() => navigate('home')} />
      <main className="screen-content verify-content">
        <h1>대학생 인증을<br />완료해 주세요</h1>
        <p className="subtitle">신뢰할 수 있는 응답자 커뮤니티를 위해<br />전화번호와 재학 정보를 확인합니다.</p>
        <label className="field-label">휴대전화</label>
        <button className="phone-field" type="button" onClick={() => setPhoneVerified(true)}><span>010-1234-5678</span><b>{phoneVerified ? '인증 완료 ✓' : '인증하기'}</b></button>
        <div className="student-card">
          <div className="school-icon">🎓</div>
          <h2>학생증 촬영 및 등록</h2>
          <p>학교명과 재학 상태만 확인해요.<br />인증 이미지는 심사 후 안전하게 삭제됩니다.</p>
          <button type="button">학생증 촬영하기</button>
        </div>
        <div className="review-note">✓ 인증 심사 진행 중 · 최대 24시간</div>
        <label className="field-label">관심 분야 선택</label>
        <div className="chips interest-chips"><button className="chip is-active" type="button">취업</button><button className="chip" type="button">학교생활</button><button className="chip is-active" type="button">소비</button><button className="chip" type="button">MBTI</button><button className="chip" type="button">연애</button></div>
        <button className="primary-button" type="button" onClick={onVerify}>인증 완료하고 2,500P 받기</button>
      </main>
    </div>
  )
}

function AuthScreen({ navigate }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ id: '', nickname: '', password: '', passwordConfirm: '' })
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const canSubmit = form.id && form.password && (mode === 'login' || (form.nickname && form.password === form.passwordConfirm))

  return (
    <div className="screen auth-screen">
      <main className="screen-content auth-content">
        <div className="auth-brand">suniversity</div>
        <p className="auth-slogan">설문은 쉽게, 응답은 빠르게.<br />대학생이 함께 만드는 설문 커뮤니티</p>
        <div className="auth-tabs">
          <button type="button" className={mode === 'login' ? 'is-active' : ''} onClick={() => setMode('login')}>로그인</button>
          <button type="button" className={mode === 'signup' ? 'is-active' : ''} onClick={() => setMode('signup')}>회원가입</button>
        </div>
        <div className="auth-form">
          {mode === 'signup' ? <label>닉네임<input value={form.nickname} onChange={update('nickname')} placeholder="사용할 닉네임" /></label> : null}
          <label>아이디<input value={form.id} onChange={update('id')} placeholder="아이디를 입력해 주세요" /></label>
          <label>비밀번호<input type="password" value={form.password} onChange={update('password')} placeholder="8자 이상 입력" /></label>
          {mode === 'signup' ? <label>비밀번호 확인<input type="password" value={form.passwordConfirm} onChange={update('passwordConfirm')} placeholder="비밀번호를 다시 입력" /></label> : null}
        </div>
        <button className="primary-button" disabled={!canSubmit} type="button" onClick={() => navigate(mode === 'signup' ? 'verify' : 'home')}>
          {mode === 'signup' ? '가입하고 대학생 인증하기' : '로그인'}
        </button>
        <button className="guest-button" type="button" onClick={() => navigate('home')}>프로토타입 둘러보기</button>
      </main>
    </div>
  )
}

function NotificationsScreen({ navigate }) {
  const { data: notices, isLoading, error, reload } = useAsyncData(mockApi.getNotifications)
  return (
    <div className="screen">
      <TopBar title="알림" onBack={() => navigate('home')} />
      <main className="screen-content notification-content">
        {isLoading ? <div className="loading-state"><i /><i /><i /></div> : null}
        {error ? <div className="empty-state"><b>알림을 불러오지 못했어요</b><p>{error.message}</p><button type="button" onClick={reload}>다시 시도</button></div> : null}
        {!isLoading && !error && notices?.length === 0 ? <div className="empty-state"><b>새로운 알림이 없어요</b><p>관심 설문이 등록되면 알려드릴게요.</p></div> : null}
        {notices?.map((notice) => (
          <button className="notice-card" type="button" key={notice.id} onClick={() => navigate(notice.target)}>
            <span className="notice-dot" />
            <span><b>{notice.title}</b><small>{notice.body}</small></span>
            <time>{notice.time}</time>
          </button>
        ))}
      </main>
    </div>
  )
}
function ProfileScreen({ navigate, points, hasDraft, badges }) {
  return (
    <div className="screen">
      <TopBar title="마이페이지" onBack={() => navigate('home')} />
      <main className="screen-content profile-content">
        <div className="profile-hero">
          <div className="profile-avatar">SU</div>
          <span><b>설문요정</b><small>고려대학교 세종캠퍼스 · 인증 완료</small></span>
        </div>
        <div className="profile-stats"><div><b>{points.toLocaleString()}P</b><small>보유 포인트</small></div><div><b>LEVEL 7</b><small>현재 레벨</small></div><div><b>18위</b><small>전체 랭킹</small></div></div>
        {badges.length ? <section className="profile-badges"><div><b>내 설문 별명</b><small>설문에 참여할수록 새로운 별명이 쌓여요.</small></div><div>{badges.map((badge) => <span key={badge}>{badge}</span>)}</div></section> : null}
        <section className="settings-group">
          <button type="button" onClick={() => navigate('verify')}><span><UiIcon name="school" /> 학교 인증 정보</span><b>완료 ›</b></button>
          <button type="button"><span><UiIcon name="phone" /> 전화번호 변경</span><b>›</b></button>
          <button type="button"><span><UiIcon name="bell" /> 알림 설정</span><b>ON ›</b></button>
          <button type="button"><span><UiIcon name="lock" /> 비밀번호 변경</span><b>›</b></button>
        </section>

        <section className="settings-group">
          <button type="button" onClick={() => navigate('result')}><span><UiIcon name="survey" /> 내가 만든 설문</span><b>3개 ›</b></button>
          <button type="button" onClick={() => navigate('create')}><span><UiIcon name="draft" /> 임시저장 설문</span><b>{hasDraft ? '1개' : '없음'} ›</b></button>
          <button type="button" onClick={() => navigate('points')}><span><UiIcon name="coin" /> 포인트 이용 내역</span><b>›</b></button>
        </section>
        <button className="logout-button" type="button" onClick={() => navigate('auth')}>로그아웃</button>
      </main>
    </div>
  )
}

function App() {
  const [screen, setScreen] = useState('home')
  const [lastCheckin, setLastCheckin] = useState(() => localStorage.getItem('suniversity-last-checkin') || '')
  const [participationSource, setParticipationSource] = useState('surveys')
  const [points, setPoints] = useState(() => Number(localStorage.getItem('suniversity-points')) || 2540)
  const [adReward, setAdReward] = useState(() => {
    const today = new Date().toISOString().slice(0, 10)
    try {
      const saved = JSON.parse(localStorage.getItem('suniversity-daily-ad-reward'))
      return saved?.date === today ? saved : { date: today, amount: 0 }
    } catch {
      return { date: today, amount: 0 }
    }
  })
  const [publishedSurveys, setPublishedSurveys] = useState([])
  const [badges, setBadges] = useState(() => JSON.parse(localStorage.getItem('suniversity-survey-badges') || '[]'))
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('suniversity-transactions')
    return saved ? JSON.parse(saved) : [
      { id: 1, label: '학교 인증 가입 보상', amount: 2500 },
      { id: 2, label: '설문 참여 보상', amount: 30 },
      { id: 3, label: 'AI 심층 분석', amount: -200 },
    ]
  })

  const navigate = (next) => {
    if (next === 'participate') setParticipationSource(screen)
    setScreen(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const updateWallet = (nextPoints, nextTransactions) => {
    setPoints(nextPoints)
    setTransactions(nextTransactions)
    localStorage.setItem('suniversity-points', String(nextPoints))
    localStorage.setItem('suniversity-transactions', JSON.stringify(nextTransactions))
  }

  const earnPoints = (amount, label) => {
    updateWallet(points + amount, [{ id: Date.now(), label, amount }, ...transactions].slice(0, 8))
  }

  const spendPoints = (amount, label) => {
    if (points < amount) {
      window.alert('포인트가 부족해요. 설문이나 광고에 참여해 주세요.')
      return false
    }
    updateWallet(points - amount, [{ id: Date.now(), label, amount: -amount }, ...transactions].slice(0, 8))
    return true
  }

  const completeSurvey = (amount, badge) => {
    earnPoints(amount, '설문 참여 보상')
    if (badge && !badges.includes(badge)) { const next = [badge, ...badges]; setBadges(next); localStorage.setItem('suniversity-survey-badges', JSON.stringify(next)) }
    navigate('resultAccess')
  }

  const publishSurvey = (survey) => {
    setPublishedSurveys([survey, ...publishedSurveys])
  }

  const checkInToday = () => {
    const today = new Date().toISOString().slice(0, 10)
    if (lastCheckin === today) return
    setLastCheckin(today)
    localStorage.setItem('suniversity-last-checkin', today)
    earnPoints(10, '일일 출석체크')
  }
  const watchAd = () => {
    if (adReward.amount >= 50) return
    const nextReward = { date: new Date().toISOString().slice(0, 10), amount: Math.min(50, adReward.amount + 10) }
    setAdReward(nextReward)
    localStorage.setItem('suniversity-daily-ad-reward', JSON.stringify(nextReward))
    earnPoints(10, '광고 시청 보상')
  }
  const voteBalance = () => earnPoints(2, '밸런스게임 참여')

  const completeVerification = () => {
    earnPoints(2500, '학교 인증 가입 보상')
    navigate('home')
  }

  const screens = {
    auth: <AuthScreen navigate={navigate} />,
    home: <HomeScreen navigate={navigate} isCheckedIn={lastCheckin === new Date().toISOString().slice(0, 10)} onCheckIn={checkInToday} />,
    surveys: <SurveyListScreen navigate={navigate} customSurveys={publishedSurveys} />,
    participate: <ParticipateScreen navigate={navigate} onComplete={completeSurvey} onExit={() => navigate(participationSource)} />,
    create: <CreateScreen navigate={navigate} onPublish={publishSurvey} points={points} spendPoints={spendPoints} />,
    resultAccess: <ResultAccessScreen navigate={navigate} points={points} unlockResult={(price) => { if (spendPoints(price, '설문 결과 열람')) navigate('result') }} />,
    result: <ResultScreen navigate={navigate} spendPoints={spendPoints} />,
    points: <PointsScreen navigate={navigate} points={points} transactions={transactions} spendPoints={spendPoints} adEarned={adReward.amount} onWatchAd={watchAd} />,
    ranking: <RankingScreen navigate={navigate} />,
    balance: <BalanceGameScreen navigate={navigate} onVote={voteBalance} />,
    verify: <VerifyScreen navigate={navigate} onVerify={completeVerification} />,
    notifications: <NotificationsScreen navigate={navigate} />,
    profile: <ProfileScreen navigate={navigate} points={points} hasDraft={Boolean(localStorage.getItem('suniversity-survey-draft'))} badges={badges} />,
  }

  return (
    <div className="prototype-stage">
      <div className="device-shell">
        <span className="device-speaker" aria-hidden="true" />
        <span className="device-camera" aria-hidden="true" />
        <span className="device-button device-button--volume" aria-hidden="true" />
        <span className="device-button device-button--power" aria-hidden="true" />
        <div className="phone-frame">{screens[screen] || screens.home}</div>
      </div>
    </div>
  )
}

export default App