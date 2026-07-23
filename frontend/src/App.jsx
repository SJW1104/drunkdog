/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import { useAsyncData } from './hooks/useAsyncData.js'
import mockApi from './services/mockApi.js'
import './App.css'

const navItems = [
  { id: 'home', label: '홈' },
  { id: 'surveys', label: '설문' },
  { id: 'balance', label: '밸런스게임' },
  { id: 'ranking', label: '랭킹' },
  { id: 'points', label: '포인트' },
]
const bottomNavScreens = new Set(navItems.map((item) => item.id))

function IconButton({ children, label, onClick, badge }) {
  return (
    <button className="icon-button" type="button" aria-label={label} onClick={onClick}>
      {children}
      {badge ? <span className="notification-badge">{badge}</span> : null}
    </button>
  )
}

function SearchIcon() {
  return <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m15.5 15.5 4.2 4.2" /></svg>
}
function TicketIcon() {
  return <svg className="ticket-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16v3a2.5 2.5 0 0 0 0 5v3H4v-3a2.5 2.5 0 0 0 0-5v-3Z" /><path d="M9 8.5v7M12 8.5h4M12 12h4M12 15.5h3" /></svg>
}
function ChevronRightIcon() {
  return <svg className="chevron-right-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
}
function BellIcon() {
  return (
    <svg className="bell-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  )
}
function BalanceScaleIcon() {
  return (
    <svg className="balance-scale-icon" viewBox="0 0 28 24" aria-hidden="true">
      <path className="scale-beam" d="M5 7.5h18" />
      <path d="M14 4v16M10 20h8" />
      <path d="M7 7.5 3.5 14h7L7 7.5ZM21 7.5 17.5 14h7L21 7.5Z" />
      <path className="scale-bowl" d="M3.5 14c.5 2.3 2 3.5 3.5 3.5s3-1.2 3.5-3.5M17.5 14c.5 2.3 2 3.5 3.5 3.5s3-1.2 3.5-3.5" />
      <circle cx="14" cy="5" r="1.7" />
    </svg>
  )
}
function BottomNavIcon({ name }) {
  if (name === 'balance') return <BalanceScaleIcon />
  const paths = {
    home: <><path d="m4 11 8-6.5 8 6.5" /><path d="M6.5 10v9h11v-9M10 19v-5h4v5" /></>,
    surveys: <><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M9 3.5v-1h6v1M9 8h6M9 12h6M9 16h4" /><path d="m7.5 8 .6.6 1.1-1.2" /></>,
    ranking: <><path d="M7 4h10v3.5c0 3.2-2.1 5.5-5 5.5s-5-2.3-5-5.5V4Z" /><path d="M7 6H4.5v1.5c0 2 1.2 3.4 3.2 3.6M17 6h2.5v1.5c0 2-1.2 3.4-3.2 3.6M12 13v4M8.5 20h7M9.5 17h5" /></>,
    points: <><circle cx="12" cy="12" r="8.5" /><path d="M9 8.5h3.8a2.7 2.7 0 0 1 0 5.4H9V7M9 17v-3.1" /></>,
  }
  return <svg className="bottom-nav-svg" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
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
  const activeIndex = Math.max(0, navItems.findIndex((item) => item.id === active))
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴" style={{ '--active-index': activeIndex }}>
      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className={active === item.id ? 'nav-item is-active' : 'nav-item'}
          onClick={() => navigate(item.id)}
        >
          <span className="nav-icon"><BottomNavIcon name={item.id} /></span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

function PointPill({ value }) {
  return <span className="point-pill"><b>P</b> +{value}P</span>
}

function SurveyRow({ title, meta, point, onClick, completed = false }) {
  return (
    <button className={completed ? 'survey-row is-completed' : 'survey-row'} type="button" onClick={onClick}>
      <span>
        <strong>{title}</strong>
        <small>{meta}</small>
      </span>
      <PointPill value={point} />
    </button>
  )
}

function SectionHeader({ icon, title, count, action, onAction }) {
  return (
    <div className="section-header">
      <strong><span>{icon}</span> {title} <small>{count}</small></strong>
      {action ? <button type="button" onClick={onAction} className={action.includes('1.5배') ? 'section-action is-boost' : 'section-action'}>{action}</button> : null}
    </div>
  )
}

function HomeScreen({ navigate, isCheckedIn, onCheckIn, onParticipate, completedSurveys }) {
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [homeSearchQuery, setHomeSearchQuery] = useState('')
  const searchableSurveys = [
    { id: 'home-ai', title: '대학생의 AI 활용과 취업 준비', category: 'AI · 취업', point: 20 },
    { id: 'home-delivery', title: '배달앱 선택 기준과 소비 습관', category: '소비', point: 15 },
    { id: 'home-capstone', title: '캡스톤 협업 경험', category: '팀플 · 프로젝트', point: 45 },
    { id: 'home-commute', title: '통학 만족도 조사', category: '대학생활', point: 30 },
    { id: 'home-date', title: '데이트 비용 인식', category: '연애 · 소비', point: 10 },
    { id: 'home-contest', title: '공모전 참여 경험', category: '공모전', point: 20 },
    { id: 'home-subscription', title: 'Z세대 구독 서비스 이용 행태', category: '트렌드 · 소비', point: 30 },
    { id: 'home-career-cost', title: '대학생 취업 준비 비용 조사', category: '취업', point: 20 },
  ]
  const searchResults = searchableSurveys.filter((survey) => `${survey.title} ${survey.category}`.toLowerCase().includes(homeSearchQuery.trim().toLowerCase()))
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [readNotices, setReadNotices] = useState(() => JSON.parse(localStorage.getItem('suniversity-read-notices') || '[]'))
  const { data: homeNoticeData, isLoading: noticesLoading } = useAsyncData(mockApi.getNotifications)
  const homeNotices = homeNoticeData || []
  const unreadCount = homeNotices.filter((notice) => !readNotices.includes(notice.id)).length
  const openNotice = (notice) => { const next = [...new Set([...readNotices, notice.id])]; setReadNotices(next); localStorage.setItem('suniversity-read-notices', JSON.stringify(next)); setNotificationOpen(false); navigate(notice.target) }
  const readAllNotices = () => { const next = homeNotices.map((notice) => notice.id); setReadNotices(next); localStorage.setItem('suniversity-read-notices', JSON.stringify(next)) }
  return (
    <div className="screen with-nav">
      <TopBar
        title="suniversity"
        brand
        right={
          <div className="top-actions">
            <IconButton label="검색" onClick={() => setSearchOpen(true)}><SearchIcon /></IconButton>
            <IconButton label="알림" badge={unreadCount || null} onClick={() => setNotificationOpen(true)}><BellIcon /></IconButton>
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
          <button type="button" onClick={() => onParticipate('sponsored-campus')}>참여하기</button>
        </div>

        <section>
          <SectionHeader icon="🔥" title="HOT 설문" count="5개" action="전체보기 ›" onAction={() => navigate('surveys')} />
          <div className="stack-sm">
            <SurveyRow title="대학생의 AI 활용과 취업 준비" meta="82 / 100명 · 약 3분" point={20} completed={completedSurveys.includes('home-ai')} onClick={() => onParticipate('home-ai')} />
            <SurveyRow title="배달앱 선택 기준과 소비 습관" meta="211명 참여 · 약 2분" point={15} completed={completedSurveys.includes('home-delivery')} onClick={() => onParticipate('home-delivery')} />
          </div>
        </section>

        <section>
          <SectionHeader icon="⏰" title="마감임박" count="4개" action="보상 1.5배" />
          <div className="grid-two">
            <button className={completedSurveys.includes('home-capstone') ? 'mini-card is-completed' : 'mini-card'} type="button" onClick={() => onParticipate('home-capstone')}><b>캡스톤 협업 경험</b><small>2시간 남음 · <em className="point-text">+45P</em></small></button>
            <button className={completedSurveys.includes('home-commute') ? 'mini-card is-completed' : 'mini-card'} type="button" onClick={() => onParticipate('home-commute')}><b>통학 만족도 조사</b><small>오늘 마감 · <em className="point-text">+30P</em></small></button>
          </div>
        </section>

        <section>
          <SectionHeader icon="✨" title="새로 올라온 설문" count="8개" action="전체보기 ›" onAction={() => navigate('surveys')} />
          <div className="grid-two">
            <button className={completedSurveys.includes('home-date') ? 'mini-card is-completed' : 'mini-card'} type="button" onClick={() => onParticipate('home-date')}><b>데이트 비용 인식</b><small>방금 등록 · <em className="point-text">+10P</em></small></button>
            <button className={completedSurveys.includes('home-contest') ? 'mini-card is-completed' : 'mini-card'} type="button" onClick={() => onParticipate('home-contest')}><b>공모전 참여 경험</b><small>5분 전 · <em className="point-text">+20P</em></small></button>
          </div>
        </section>

        <section>
          <SectionHeader icon="💙" title="관심 분야 설문" count="" action="취업 · 소비 기반" />
          <div className="stack-sm">
            <SurveyRow title="Z세대 구독 서비스 이용 행태" meta="관심사 일치 92% · 약 4분" point={30} completed={completedSurveys.includes('home-subscription')} onClick={() => onParticipate('home-subscription')} />
            <SurveyRow title="대학생 취업 준비 비용 조사" meta="관심사 일치 87% · 약 3분" point={20} completed={completedSurveys.includes('home-career-cost')} onClick={() => onParticipate('home-career-cost')} />
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
      {searchOpen ? <div className="search-overlay"><div className="search-overlay-head"><button type="button" onClick={() => { setSearchOpen(false); setHomeSearchQuery('') }}>‹</button><label><SearchIcon /><input autoFocus value={homeSearchQuery} onChange={(event) => setHomeSearchQuery(event.target.value)} placeholder="설문 제목이나 카테고리 검색" /></label></div><main><div className="search-suggestions"><span>추천 검색어</span>{['AI', '취업', '팀플', '소비'].map((keyword) => <button type="button" key={keyword} onClick={() => setHomeSearchQuery(keyword)}>{keyword}</button>)}</div><div className="search-result-head"><b>{homeSearchQuery.trim() ? `'${homeSearchQuery}' 검색 결과` : '추천 설문'}</b><small>{searchResults.length}개</small></div><div className="search-result-list">{searchResults.map((survey) => <button type="button" key={survey.id} className={completedSurveys.includes(survey.id) ? 'is-completed' : ''} onClick={() => { setSearchOpen(false); setHomeSearchQuery(''); onParticipate(survey.id) }}><span><small>{survey.category}</small><b>{survey.title}</b></span><strong>{completedSurveys.includes(survey.id) ? '참여 완료' : `+${survey.point}P`}</strong></button>)}{searchResults.length === 0 ? <div className="empty-state"><b>검색 결과가 없어요</b><p>다른 검색어를 입력해 보세요.</p></div> : null}</div></main></div> : null}
      {notificationOpen ? <div className="notification-popover-backdrop" role="presentation" onClick={() => setNotificationOpen(false)}><section className="notification-popover" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><div className="notification-popover-head"><span><b>알림</b><small>새 소식을 빠르게 확인해 보세요.</small></span><button type="button" onClick={readAllNotices}>모두 읽음</button></div>{noticesLoading ? <div className="loading-state"><i /><i /><i /></div> : <div className="notification-popover-list">{homeNotices.map((notice) => <button type="button" key={notice.id} className={readNotices.includes(notice.id) ? 'is-read' : ''} onClick={() => openNotice(notice)}><i /><span><b>{notice.title}</b><small>{notice.body}</small></span><time>{notice.time}</time></button>)}</div>}<button className="notification-close" type="button" onClick={() => setNotificationOpen(false)}>닫기</button></section></div> : null}
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

function SurveyListScreen({ navigate, customSurveys = [], onParticipate, completedSurveys }) {
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
        <TopBar title="설문" onBack={() => navigate('home')} />
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
      </div>
    )
  }

  return (
    <div className="screen with-nav">
      <TopBar title="설문 둘러보기" onBack={() => setShowCategories(true)} />
      <main className="screen-content list-content">
        <label className="search-box">
          <SearchIcon />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="키워드로 설문 검색" />
        </label>

        <div className="survey-category-tabs" aria-label="설문 카테고리">
          {categories.map(([label]) => <button type="button" key={label} className={category === label ? 'is-active' : ''} onClick={() => setCategory(label)}>{label}</button>)}
        </div>

        <SectionHeader title="내게 맞는 설문" count="" action="추천순⌄" />
        {isLoading ? <div className="loading-state" aria-label="설문 불러오는 중"><i /><i /><i /></div> : null}
        {error ? <div className="empty-state"><b>설문을 불러오지 못했어요</b><p>{error.message}</p><button type="button" onClick={reload}>다시 시도</button></div> : null}
        {!isLoading && !error && filteredSurveys.length === 0 ? <div className="empty-state"><b>조건에 맞는 설문이 없어요</b><p>검색어나 카테고리를 바꿔보세요.</p><button type="button" onClick={() => { setQuery(''); setCategory('전체'); setShowCategories(true) }}>필터 초기화</button></div> : null}
        <div className="survey-card-list">
          {!isLoading && !error && filteredSurveys.map((survey, index) => (
            <button className={`${completedSurveys.includes(String(survey.id || survey.title)) ? 'survey-card is-completed' : 'survey-card'} tone-${survey.tone || 'blue'}`} key={survey.title} type="button" onClick={() => onParticipate(String(survey.id || survey.title))}>
              <span className={'survey-eyebrow ' + survey.tone}>{survey.eyebrow}</span>{completedSurveys.includes(String(survey.id || survey.title)) ? <span className="completed-label">참여 완료</span> : null}
              <div className="survey-title-row"><strong>{survey.title}</strong><PointPill value={survey.point} /></div>
              <div className="survey-meta"><span>{survey.meta}</span><span>{survey.count}</span></div>
              {index === 0 ? <div className="progress-line"><span /></div> : null}
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}

const surveyContentMap = {
  'home-delivery': { title: '배달앱, 결국 무엇을 보고 고르나요?', badge: '배달 고수', questions: [
    { title: '배달앱을 고를 때 제일 먼저 보는 건 뭔가요?', options: ['배달비', '할인 쿠폰', '리뷰', '도착 시간'], rates: [36, 29, 23, 12] },
    { title: '일주일에 배달을 몇 번쯤 시켜 먹나요?', options: ['거의 안 먹어요', '1~2번', '3~4번', '5번 이상'], rates: [14, 48, 29, 9] },
    { title: '조금 더 비싸도 주문하고 싶은 가게는?', options: ['맛이 확실한 곳', '양이 많은 곳', '빨리 오는 곳', '리뷰가 좋은 곳'], rates: [43, 22, 14, 21] },
  ]},
  'home-capstone': { title: '우리 팀플, 정말 잘 굴러가고 있나요?', badge: '팀플 생존왕', questions: [
    { title: '팀플에서 가장 힘든 순간은 언제인가요?', options: ['역할을 나눌 때', '연락이 안 될 때', '의견이 부딪힐 때', '마감 직전'], rates: [13, 41, 19, 27] },
    { title: '회의는 일주일에 몇 번이 적당한가요?', options: ['필요할 때만', '1번', '2~3번', '거의 매일'], rates: [25, 49, 22, 4] },
    { title: '팀원을 고를 수 있다면 가장 중요한 건?', options: ['책임감', '실력', '소통', '친밀감'], rates: [51, 24, 21, 4] },
  ]},
  default: { title: '대학생들은 AI를 어디까지 믿고 쓸까?', badge: 'AI 활용 만렙 새내기', questions: [
    { title: '과제할 때 AI, 얼마나 자주 꺼내 쓰나요?', options: ['거의 안 써요', '한 달에 1~2번 써요', '일주일에 1~2번 써요', '거의 매일 써요'], rates: [8, 15, 46, 31] },
    { title: '가장 손이 자주 가는 AI는 무엇인가요?', options: ['ChatGPT', 'Claude', 'Gemini', '다른 도구'], rates: [64, 12, 19, 5] },
    { title: 'AI에게 주로 어떤 일을 부탁하나요?', options: ['자료 찾기', '글쓰기·요약', '코딩·분석', '아이디어 얻기'], rates: [28, 34, 21, 17] },
    { title: '솔직히 AI가 과제에 얼마나 도움 됐나요?', options: ['정말 많이 됐어요', '꽤 도움 됐어요', '그저 그래요', '별로 안 됐어요'], rates: [33, 42, 19, 6] },
  ]},
}
function getSurveyContent(id = '') {
  if (surveyContentMap[id]) return surveyContentMap[id]
  const text = String(id)
  if (text.includes('배달')) return surveyContentMap['home-delivery']
  if (text.includes('캡스톤') || text.includes('협업')) return surveyContentMap['home-capstone']
  return surveyContentMap.default
}
function ParticipateScreen({ onComplete, onExit, surveyId, isSaved, onToggleSaved }) {
  const { title: surveyTitle, badge, questions } = getSurveyContent(surveyId)
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
      window.setTimeout(() => onComplete(30, badge, surveyTitle, answers, questions), 1200)
    } else setQuestionIndex(questionIndex + 1)
  }
  if (isSubmitting) return <div className="screen"><main className="screen-content result-wait"><div className="result-wait-spinner" /><h1>응답을 분석하고 있어요</h1><p>나와 비슷한 대학생을 찾는 중이에요.<br />잠시만 기다려 주세요!</p></main></div>
  return (
    <div className="screen">
      <TopBar title="설문 참여" onBack={() => questionIndex ? setQuestionIndex(questionIndex - 1) : onExit()} right={<IconButton label="더보기" onClick={() => setShowMenu(!showMenu)}>•••</IconButton>} />
      {showMenu ? <div className="survey-more-menu"><button type="button" onClick={() => { navigator.clipboard?.writeText(window.location.href); setShowMenu(false) }}>설문 링크 공유</button><button type="button" className={isSaved ? 'is-saved' : ''} onClick={() => { onToggleSaved(surveyId); setShowMenu(false) }}>{isSaved ? '관심 설문에서 삭제' : '관심 설문 저장'}</button><button type="button" className="danger" onClick={() => { window.alert('신고가 접수되었습니다.'); setShowMenu(false) }}>설문 신고</button></div> : null}
      <main className="screen-content participate-content">
        <div className="survey-progress-label"><span>질문 {questionIndex + 1} / {questions.length}</span><span>{Math.round((questionIndex + 1) / questions.length * 100)}% 진행</span></div>
        <div className="survey-progress"><span style={{ width: ((questionIndex + 1) / questions.length * 100) + '%' }} /></div>
        <p className="required-label">{surveyTitle} · 지금까지의 응답</p>
        <h1 className="question-title">{question.title}</h1>
        <div className="option-list">{question.options.map((option, index) => <button type="button" key={option} className={`answer-option${selected === index ? ' is-selected' : ''}${selected !== undefined ? ' has-rate' : ''}`} onClick={() => selectAnswer(index)}><span>{option}{selected === index ? ' ✓' : ''}</span>{selected !== undefined ? <span className="live-rate"><i style={{ width: `${question.rates[index]}%` }} /><b>{question.rates[index]}%</b></span> : null}</button>)}</div>
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
  const editId = savedDraft.editId

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
  const addAiQuestion = () => {
    if (!spendPoints(20, 'AI 문항 추천')) return
    setQuestions([...questions, { id: `ai-${Date.now()}`, title: 'AI를 쓰고 나서 과제 시간이 얼마나 줄었나요?', type: 'single', required: true, options: ['거의 줄지 않았어요', '30분 정도 줄었어요', '1시간 이상 줄었어요', '절반 이상 줄었어요'] }])
  }

  const saveDraft = () => {
    localStorage.setItem('suniversity-survey-draft', JSON.stringify({ editId, title, category, targetCount, reward, isPublic, questions }))
    setSaveLabel('저장 완료')
    window.setTimeout(() => setSaveLabel('임시저장'), 1400)
  }

  const publish = async () => {
    const budget = editId ? 0 : targetCount * reward
    if (points < budget) {
      setPublishError(`등록에 ${budget.toLocaleString()}P가 필요해요. 현재 ${points.toLocaleString()}P를 보유하고 있어요.`)
      return
    }
    setIsPublishing(true)
    setPublishError('')
    try {
      const survey = await mockApi.createSurvey({ id: editId || undefined, editId, title: title.trim(), category, targetCount, reward, questionCount: questions.length, questions, isPublic })
      if (budget && !spendPoints(budget, '설문 참여 보상 예산')) return
      onPublish({ ...survey, id: editId || survey.id, editId, eyebrow: `${editId ? '수정됨' : '새 설문'} · ${category}`, meta: `${questions.length}문항 · 약 ${Math.max(1, Math.ceil(questions.length * 0.6))}분`, count: `0 / ${targetCount}`, point: reward, tone: 'blue' })
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
      <TopBar title={editId ? '설문 수정하기' : '새 설문 만들기'} onBack={() => step > 1 ? setStep(step - 1) : navigate(editId ? 'mySurveys' : 'home')} right={<button className="text-action" type="button" onClick={saveDraft}>{saveLabel}</button>} />
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
            <button type="button" onClick={addAiQuestion}>AI로 문항 추천 · 20P</button>
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
          {!editId && points < targetCount * reward ? <p className="publish-error">포인트가 부족해요. 포인트 화면에서 설문이나 광고에 참여해 주세요.</p> : null}
          {publishError ? <p className="publish-error">{publishError}</p> : null}
          <button className="primary-button" disabled={isPublishing || (!editId && points < targetCount * reward)} type="button" onClick={publish}>{isPublishing ? '저장 중...' : editId ? '수정 내용 저장하기' : `${(targetCount * reward).toLocaleString()}P 결제하고 등록하기`}</button>
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
  const isMe = name.startsWith('나')
  return <span className={`team-avatar team-${team.toLowerCase()} ${small ? 'is-small' : ''}`}>{isMe ? <svg className="avatar-person-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2" /><path d="M5.5 19c.7-4 3-6 6.5-6s5.8 2 6.5 6" /></svg> : name.slice(0, 1)}</span>
}

function BalanceGameScreen({ navigate, onVote, selectedTitle }) {
  const [activeGame, setActiveGame] = useState(null)
  const [votes, setVotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('suniversity-balance-votes') || '{}') } catch { return {} }
  })
  const [posts, setPosts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('suniversity-balance-posts') || 'null') || initialDebates } catch { return initialDebates }
  })
  const [draft, setDraft] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [likedPosts, setLikedPosts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('suniversity-liked-balance-posts') || '[]') } catch { return [] }
  })
  const selected = activeGame ? votes[activeGame.id] : null
  const myDisplayName = selectedTitle ? `나 · ${selectedTitle}` : '나'
  useEffect(() => {
    localStorage.setItem('suniversity-balance-posts', JSON.stringify(posts))
  }, [posts])

  const vote = (choice) => {
    if (selected) return
    const nextVotes = { ...votes, [activeGame.id]: choice }
    setVotes(nextVotes)
    localStorage.setItem('suniversity-balance-votes', JSON.stringify(nextVotes))
    onVote()
  }
  const addPost = () => {
    if (!draft.trim() || !selected) return
    setPosts([{ id: Date.now(), gameId: activeGame.id, team: selected, author: myDisplayName, text: draft.trim(), likes: 0, replies: [] }, ...posts])
    setDraft('')
  }
  const addReply = (postId) => {
    if (!replyDraft.trim() || !selected) return
    setPosts(posts.map((post) => post.id === postId ? { ...post, replies: [...post.replies, { id: Date.now(), author: myDisplayName, text: replyDraft.trim(), team: selected }] } : post))
    setReplyDraft('')
    setReplyingTo(null)
  }
  const togglePostLike = (postId) => {
    const liked = likedPosts.includes(postId)
    const nextLiked = liked ? likedPosts.filter((id) => id !== postId) : [...likedPosts, postId]
    setLikedPosts(nextLiked)
    setPosts(posts.map((post) => post.id === postId ? { ...post, likes: post.likes + (liked ? -1 : 1) } : post))
    localStorage.setItem('suniversity-liked-balance-posts', JSON.stringify(nextLiked))
  }
  const deletePost = (postId) => {
    if (window.confirm('이 의견을 삭제할까요?')) setPosts(posts.filter((post) => post.id !== postId))
  }

  if (!activeGame) return (
    <div className="screen with-nav">
      <TopBar title="밸런스 게임" onBack={() => navigate('home')} />
      <main className="screen-content balance-feed">
        <div className="balance-feed-heading"><span>생각이 갈리는 순간</span><h1>당신의 선택은<br />어느 쪽인가요?</h1><p>카드를 골라 투표하고 같은 편과 의견을 나눠보세요.</p></div>
        <div className="balance-feed-grid">
          {balanceGames.map((game) => <button className={votes[game.id] ? 'balance-feed-card is-completed' : 'balance-feed-card'} type="button" key={game.id} onClick={() => setActiveGame(game)}>
            <span className="balance-category">{game.category}</span><strong>{game.question}</strong>
            <div><span className="blue-preview">{game.a}</span><b>VS</b><span className="red-preview">{game.b}</span></div>
            <small>{votes[game.id] ? `참여 완료 · ${votes[game.id]} 선택 · 결과 보기 →` : `${game.participants}명 참여 · 의견 보기 →`}</small>
          </button>)}
        </div>
      </main>
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
          <div className={`my-team-banner team-${selected.toLowerCase()}`}><TeamAvatar team={selected} name={myDisplayName} /><span><small>{myDisplayName}</small><b>{selected === 'A' ? activeGame.aLabel : activeGame.bLabel} 토론에 참여 중</b></span><strong>참여 완료</strong></div>
          <section className="debate-section">
            <div className="debate-title"><span>찬성과 반대, 서로의 생각을 확인해보세요</span><b>의견 토론장</b></div>
            <div className={`debate-composer team-${selected.toLowerCase()}`}><TeamAvatar team={selected} name={myDisplayName} /><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`${selected === 'A' ? activeGame.aLabel : activeGame.bLabel}을 선택한 이유를 남겨보세요`} /><button type="button" onClick={addPost}>등록</button></div>
            <div className="debate-feed-head"><span>전체 의견</span><b>{gamePosts.length}개</b></div>
            <div className="debate-list debate-list-unified">
              {gamePosts.length ? gamePosts.map((post) => <article className={`debate-post team-${post.team.toLowerCase()}`} key={post.id}>
                <div className="post-head"><TeamAvatar team={post.team} name={post.author} /><span><b>{post.author}</b><small>{post.team === 'A' ? activeGame.aLabel : activeGame.bLabel}</small></span></div>
                <p>{post.text}</p><div className="post-actions"><button type="button" className={likedPosts.includes(post.id) ? 'is-liked' : ''} onClick={() => togglePostLike(post.id)}>공감 {post.likes}</button><button type="button" onClick={() => setReplyingTo(replyingTo === post.id ? null : post.id)}>답글 {post.replies.length}</button>{post.author.startsWith('나') ? <button type="button" onClick={() => deletePost(post.id)}>삭제</button> : <button type="button" onClick={() => window.alert('신고가 접수됐어요.')}>신고</button>}</div>
                {post.replies.map((reply) => <div className={`debate-reply team-${(reply.team || post.team).toLowerCase()}`} key={reply.id}><TeamAvatar team={reply.team || post.team} name={reply.author} small /><span><b>{reply.author}</b><p>{reply.text}</p></span></div>)}
                {replyingTo === post.id ? <div className={`reply-composer team-${selected.toLowerCase()}`}><TeamAvatar team={selected} name={myDisplayName} small /><input value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} placeholder="답글 입력" /><button type="button" onClick={() => addReply(post.id)}>등록</button></div> : null}
              </article>) : <div className="empty-debate">아직 의견이 없어요. 첫 의견을 남겨보세요.</div>}
            </div>
          </section>
        </>}
      </main>
    </div>
  )
}
function ResultScreen({ navigate, spendPoints, resultInfo }) {
  const [deepAnalysis, setDeepAnalysis] = useState(() => localStorage.getItem('suniversity-deep-analysis') === resultInfo.title)
  const [resultQuestion, setResultQuestion] = useState(0)
  const answers = resultInfo.answers || {}
  const questions = resultInfo.questions || surveyContentMap.default.questions
  const selectedRates = questions.map((question, index) => question.rates?.[answers[index]]).filter(Number.isFinite)
  const matchRate = selectedRates.length ? Math.round(selectedRates.reduce((sum, rate) => sum + rate, 0) / selectedRates.length) : 68
  const maleRate = Math.min(78, Math.max(42, matchRate + 4))
  const schoolRate = Math.min(82, Math.max(45, matchRate + 9))
  const shareResult = async () => {
    const text = `SUNIVERSITY 설문 결과: ${resultInfo.badge || 'AI 활용 만렙 새내기'}`
    if (navigator.share) await navigator.share({ title: 'SUNIVERSITY 설문 결과', text, url: window.location.href })
    else { await navigator.clipboard?.writeText(`${text} ${window.location.href}`); window.alert('결과 링크를 복사했어요.') }
  }
  const unlockDeepAnalysis = () => {
    if (deepAnalysis || spendPoints(200, 'AI 심층 분석')) {
      setDeepAnalysis(true)
      localStorage.setItem('suniversity-deep-analysis', resultInfo.title || '')
      const viewedHistory = (() => {
        try { return JSON.parse(localStorage.getItem('suniversity-viewed-surveys') || '[]') } catch { return [] }
      })()
      const viewedSurvey = { id: `viewed-${resultInfo.title || resultInfo.badge}`, title: resultInfo.title || '대학생 AI 활용 조사', badge: resultInfo.badge || 'AI 활용 만렙 새내기', viewedAt: new Date().toLocaleDateString('ko-KR') }
      localStorage.setItem('suniversity-viewed-surveys', JSON.stringify([viewedSurvey, ...viewedHistory.filter((item) => item.id !== viewedSurvey.id)]))
    }
  }
  const downloadReport = () => {
    if (!spendPoints(400, 'PPT 자동 생성')) return
    const report = `SUNIVERSITY 설문 결과 보고서\n\n설문: ${resultInfo.title || '대학생 AI 활용 조사'}\n응답 성향: ${resultInfo.badge || 'AI 활용 만렙 새내기'}\n나와 같은 답변: ${matchRate}%\n우리 학교 비교: ${schoolRate}%\n\n핵심 인사이트\n선택한 답변은 전체 응답자 중 평균 ${matchRate}%가 함께 골랐습니다.`
    const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'suniversity-result-report.txt'; link.click(); URL.revokeObjectURL(url)
  }
  const detailQuestion = questions[resultQuestion]
  return (<div className="screen"><TopBar title="설문 결과" onBack={() => navigate('home')} right={<IconButton label="공유" onClick={shareResult}>↗</IconButton>} /><main className="screen-content result-content"><span className="result-nickname">이번 설문의 내 별명</span><h1>{resultInfo.badge || 'AI 활용 만렙 새내기'}</h1><p className="subtitle">{resultInfo.title || '대학생 AI 활용 조사'}에서 발견한 나의 응답 성향이에요.</p><div className="stat-grid"><div><strong>104</strong><small>총 응답</small></div><div><strong>{Math.max(74, matchRate)}%</strong><small>완료율</small></div><div><strong>{questions.length}:12</strong><small>평균 시간</small></div></div><SectionHeader title="문항별 응답 분포" count="" action={`Q${resultQuestion + 1}/${questions.length}`} /><div className="result-question-tabs">{questions.map((_, index) => <button type="button" className={resultQuestion === index ? 'is-active' : ''} key={index} onClick={() => setResultQuestion(index)}>Q{index + 1}</button>)}</div><article className="result-question-card"><b>{detailQuestion.title}</b>{detailQuestion.options?.map((option, index) => { const rate = detailQuestion.rates?.[index] ?? Math.round(100 / detailQuestion.options.length); return <div className={answers[resultQuestion] === index ? 'is-my-answer' : ''} key={option}><span><em>{option}</em><strong>{rate}%</strong></span><i><small style={{ width: `${rate}%` }} /></i></div> })}</article><SectionHeader title="나와 같은 답을 고른 사람" count="" action={`${matchRate}%`} /><div className="match-card"><strong>{matchRate}%</strong><span>내가 고른 답을 선택한<br />대학생의 평균 비율이에요.</span></div><SectionHeader title="그룹별 응답 비교" count="" action={`Q${resultQuestion + 1} 기준`} /><div className="comparison-grid"><article><b>남녀 비교</b><p><span style={{ width: `${maleRate}%` }}>남 {maleRate}%</span><span style={{ width: `${100 - maleRate}%` }}>여 {100 - maleRate}%</span></p><small>내 답변과 같은 선택을 한 응답자를 성별로 비교했어요.</small></article><article><b>학교 비교</b><p><span style={{ width: `${schoolRate}%` }}>우리 학교 {schoolRate}%</span><span style={{ width: `${100 - schoolRate}%` }}>타교 {100 - schoolRate}%</span></p><small>우리 학교에서 같은 답을 고른 비율이 더 높아요.</small></article></div><div className="insight-card"><b>✦ AI 핵심 인사이트</b><p>선택한 답변은 전체 응답자 중 평균 {matchRate}%가 함께 골랐어요. {matchRate >= 50 ? '대학생 다수가 공감하는 성향이에요.' : '비교적 뚜렷한 나만의 성향이에요.'}</p></div>{deepAnalysis ? <div className="deep-analysis-card"><span>AI 심층 분석 완료</span><h2>응답 패턴을 더 자세히 봤어요</h2><p>일관성 있는 선택을 했고, 우리 학교 응답자와의 유사도가 {schoolRate}%예요. 관심 분야가 비슷한 사용자 그룹에서는 같은 선택이 더 자주 나타났어요.</p><ul><li>응답 일관성: 높음</li><li>우리 학교 유사도: {schoolRate}%</li><li>전체 응답 유사도: {matchRate}%</li></ul></div> : null}<button className="primary-button" type="button" onClick={unlockDeepAnalysis}>{deepAnalysis ? '심층 분석 확인 완료' : '심층 분석 보기 · 200P'}</button><button className="soft-button" type="button" onClick={downloadReport}>PPT 초안 생성 · 400P</button></main></div>)
}
function PointsScreen({ navigate, points, transactions, spendPoints, adEarned, onWatchAd }) {
  const gifts = [{ id: 1, icon: '☕', name: '아메리카노', detail: '모바일 교환권', price: 3000 }, { id: 2, icon: '🍦', name: '편의점 상품권', detail: '3,000원권', price: 3500 }, { id: 3, icon: '🍔', name: '햄버거 세트', detail: '세트 교환권', price: 5000 }, { id: 4, icon: '🎬', name: '영화 관람권', detail: '주중·주말 공통', price: 9000 }]
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [confirmGift, setConfirmGift] = useState(null)
  const [couponOpen, setCouponOpen] = useState(false)
  const [coupons, setCoupons] = useState(() => JSON.parse(localStorage.getItem('suniversity-coupons') || '[]'))
  const [adSeconds, setAdSeconds] = useState(() => Math.max(0, Math.ceil((Number(localStorage.getItem('suniversity-ad-deadline')) - Date.now()) / 1000)))
  useEffect(() => {
    if (!adSeconds) return undefined
    const timer = window.setInterval(() => setAdSeconds((seconds) => {
      if (seconds <= 1) { window.clearInterval(timer); localStorage.removeItem('suniversity-ad-deadline'); onWatchAd(); return 0 }
      return seconds - 1
    }), 1000)
    return () => window.clearInterval(timer)
  }, [adSeconds, onWatchAd])
  const startAd = () => {
    localStorage.setItem('suniversity-ad-deadline', String(Date.now() + 30000))
    setAdSeconds(30)
  }
  const exchange = () => {
    if (confirmGift && spendPoints(confirmGift.price, `${confirmGift.name} 교환`)) {
      const nextCoupons = [{ ...confirmGift, couponId: Date.now(), code: `SUN-${String(Date.now()).slice(-8)}` }, ...coupons]
      setCoupons(nextCoupons); localStorage.setItem('suniversity-coupons', JSON.stringify(nextCoupons))
      setConfirmGift(null); setCatalogOpen(false); setCouponOpen(true)
    }
  }
  const markCouponUsed = (couponId) => {
    if (!window.confirm('쿠폰을 사용 완료로 처리할까요?')) return
    const next = coupons.map((coupon) => coupon.couponId === couponId ? { ...coupon, used: true } : coupon)
    setCoupons(next); localStorage.setItem('suniversity-coupons', JSON.stringify(next))
  }
  const giftCard = (gift) => <button className="gift-card" type="button" key={gift.id} onClick={() => setConfirmGift(gift)}><div className="gift-image">{gift.icon}</div><span><b>{gift.name}</b><small>{gift.detail}</small></span><strong>{gift.price.toLocaleString()}P</strong></button>
  return <div className="screen with-nav"><TopBar title="포인트" onBack={() => navigate('home')} right={<IconButton label="쿠폰함" onClick={() => setCouponOpen(true)}><TicketIcon /></IconButton>} /><main className="screen-content points-content"><div className="balance-card"><small>사용 가능 포인트</small><strong><span>P</span> {points.toLocaleString()} P</strong><b>↑ 이번 달 +780P 적립</b></div><SectionHeader title="포인트 더 모으기" count="" action={`${adEarned.toLocaleString()}/1,000P`} /><div className="watch-card"><b>광고 보고 100P 받기</b><small>{adSeconds ? `광고 재생 중 · ${adSeconds}초 남음` : `오늘 광고 보상 ${adEarned.toLocaleString()}P / 1,000P`}</small><div className="daily-ad-progress"><span style={{ width: adSeconds ? `${(30 - adSeconds) / 30 * 100}%` : `${Math.min(100, adEarned / 10)}%` }} /></div><button type="button" disabled={adEarned >= 1000 || adSeconds > 0} onClick={startAd}>{adEarned >= 1000 ? '오늘 한도 달성' : adSeconds ? `${adSeconds}초 후 보상 지급` : '30초 광고 시청'}</button></div><div className="gift-heading"><b>기프티콘 교환</b><button type="button" onClick={() => setCatalogOpen(true)}>전체보기</button></div>{gifts.slice(0, 2).map(giftCard)}<p className="foot-note">설문 참여 후 광고를 보면 20문항까지 보상을 2배로 받을 수 있어요.</p><div className="transaction-list"><b>최근 포인트 내역</b>{transactions.map((item) => <div key={item.id}><span>{item.label}</span><strong className={item.amount > 0 ? 'plus' : 'minus'}>{item.amount > 0 ? '+' : ''}{item.amount}P</strong></div>)}</div></main>{catalogOpen ? <div className="modal-backdrop gift-catalog-backdrop" onClick={() => setCatalogOpen(false)}><section className="gift-catalog" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setCatalogOpen(false)} type="button">×</button><h2>기프티콘 전체보기</h2><p>모은 포인트로 원하는 상품을 교환해 보세요.</p>{gifts.map(giftCard)}</section></div> : null}{couponOpen ? <div className="modal-backdrop gift-catalog-backdrop" onClick={() => setCouponOpen(false)}><section className="gift-catalog coupon-wallet" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setCouponOpen(false)} type="button">×</button><h2>내 쿠폰함</h2><p>교환한 모바일 쿠폰을 확인하세요.</p>{coupons.length ? coupons.map((coupon) => <article className={coupon.used ? 'is-used' : ''} key={coupon.couponId}><span>{coupon.icon}</span><div><b>{coupon.name}</b><small>{coupon.code}</small></div><button type="button" disabled={coupon.used} onClick={() => markCouponUsed(coupon.couponId)}>{coupon.used ? '사용 완료' : '사용하기'}</button></article>) : <div className="empty-state"><b>보유한 쿠폰이 없어요</b></div>}</section></div> : null}{confirmGift ? <div className="modal-backdrop" onClick={() => setConfirmGift(null)}><section className="exchange-confirm" onClick={(event) => event.stopPropagation()}><span>{confirmGift.icon}</span><h2>{confirmGift.name}</h2><p>{confirmGift.price.toLocaleString()}P를 사용해 교환할까요?<br />현재 {points.toLocaleString()}P 보유 중이에요.</p><div><button type="button" onClick={() => setConfirmGift(null)}>취소</button><button type="button" disabled={points < confirmGift.price} onClick={exchange}>{points < confirmGift.price ? '포인트 부족' : '교환하기'}</button></div></section></div> : null}</div>
}
function RankingScreen({ navigate, selectedTitle }) {
  const [rankingFilter, setRankingFilter] = useState('all')
  const names = ['설문요정', '응답왕', '과제구조대', '통계마스터', '논문졸업', '척척응답', '리서치캣', '데이터덕', '마감수호대', '표본장인', '인사이트', '응답부자', '캠퍼스픽', '분석너드', '질문대장', '설문홀릭', '답변척척', '포인트왕', '논문한줄', '통계요정', '리서치룸', '표본천재', '응답착착', '데이터숲', '설문러버', '분석한입', '캠퍼스톡', '과제탈출', '질문봇', '응답완료']
  const schools = ['고려대학교', '홍익대학교', '연세대학교', '중앙대학교', '성균관대학교', '고려대학교', '한양대학교', '서울대학교', '고려대학교', '건국대학교', '이화여자대학교', '고려대학교', '경희대학교', '서강대학교', '고려대학교', '숙명여자대학교', '건국대학교', '고려대학교', '성균관대학교', '국민대학교', '고려대학교', '숭실대학교', '동국대학교', '고려대학교', '서울시립대학교', '한국외국어대학교', '고려대학교', '광운대학교', '세종대학교', '고려대학교']
  const allLeaders = names.map((name, index) => ({ id: index + 1, rank: index + 1, name, school: schools[index], points: 18920 - (index * 430) - (index > 2 ? index * 35 : 0) }))
  const visibleLeaders = (rankingFilter === 'school' ? allLeaders.filter((leader) => leader.school === '고려대학교') : allLeaders).map((leader, index) => ({ ...leader, displayRank: index + 1 }))
  const myRank = rankingFilter === 'school' ? 7 : 18
  const neighbors = rankingFilter === 'school'
    ? [{ rank: 6, name: '캠퍼스픽', school: '고려대학교', points: '5,710P' }, { rank: 8, name: '리서치룸', school: '고려대학교', points: '5,390P' }]
    : [{ rank: 17, name: '답변척척', school: '건국대학교', points: '5,620P' }, { rank: 19, name: '논문한줄', school: '성균관대학교', points: '5,430P' }]
  return (
    <div className="screen with-nav">
      <TopBar title="응답자 랭킹" onBack={() => navigate('home')} right={<IconButton label="정보">i</IconButton>} />
      <main className="screen-content ranking-content">
        <div className="chips ranking-tabs"><button className={rankingFilter === 'all' ? 'chip is-active' : 'chip'} type="button" onClick={() => setRankingFilter('all')}>전체</button><button className={rankingFilter === 'school' ? 'chip is-active' : 'chip'} type="button" onClick={() => setRankingFilter('school')}>우리 학교</button></div>
        <div className="rank-stack">
          <div className="rank-neighbor rank-neighbor--previous"><span className="neighbor-rank">{neighbors[0].rank}</span><span><b>{neighbors[0].name}</b><small>{neighbors[0].school}</small></span><strong>{neighbors[0].points}</strong></div>
          <div className="my-rank"><span className="my-rank-label">MY RANK</span><span className="rank-circle">{myRank}</span><span><b>나 · {selectedTitle || '설문요정'}</b><small>LEVEL 7 · 다음 레벨까지 460P</small></span><strong>5,540P</strong></div>
          <div className="rank-neighbor rank-neighbor--next"><span className="neighbor-rank">{neighbors[1].rank}</span><span><b>{neighbors[1].name}</b><small>{neighbors[1].school}</small></span><strong>{neighbors[1].points}</strong></div>
        </div>
        <div className="hall-heading"><span>HALL OF FAME</span><h2>{rankingFilter === 'school' ? '고려대학교 명예의 전당' : '명예의 전당'}</h2><small>{rankingFilter === 'school' ? '인증된 고려대학교 학생 랭킹' : '이번 시즌 가장 활발한 응답자 30명'}</small></div>
        <div className="leader-list">
          {visibleLeaders.map((leader) => <div className={leader.displayRank <= 3 ? `leader-row leader-row--top leader-row--${leader.displayRank}` : 'leader-row'} key={leader.id}><b>{leader.displayRank <= 3 ? ['🥇', '🥈', '🥉'][leader.displayRank - 1] : leader.displayRank}</b><span><strong>{leader.name}</strong><small>{leader.school}</small></span><em>{leader.points.toLocaleString()}P</em></div>)}
        </div>
        <div className="weekly-card"><b>이번 주 도전</b><p>설문 3개 더 참여하고 레벨업 보상 100P를 받아보세요.</p></div>
      </main>
    </div>
  )
}

function VerifyScreen({ navigate, onVerify }) {
  const [phoneVerified, setPhoneVerified] = useState(true)
  const [studentCardUploaded, setStudentCardUploaded] = useState(() => localStorage.getItem('suniversity-student-card') === 'uploaded')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [interests, setInterests] = useState(() => JSON.parse(localStorage.getItem('suniversity-interests') || '["취업","소비"]'))
  const toggleInterest = (interest) => {
    const next = interests.includes(interest) ? interests.filter((item) => item !== interest) : [...interests, interest]
    setInterests(next); localStorage.setItem('suniversity-interests', JSON.stringify(next))
  }
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
          <button type="button" onClick={() => setCameraOpen(true)}>{studentCardUploaded ? '학생증 다시 촬영하기' : '학생증 촬영하기'}</button>
        </div>
        <div className="review-note">{studentCardUploaded ? '✓ 인증 심사 진행 중 · 최대 24시간' : '학생증을 등록하면 인증 심사가 시작돼요.'}</div>
        <label className="field-label">관심 분야 선택</label>
        <div className="chips interest-chips">{['취업', '학교생활', '소비', 'MBTI', '연애'].map((interest) => <button className={interests.includes(interest) ? 'chip is-active' : 'chip'} type="button" key={interest} onClick={() => toggleInterest(interest)}>{interest}</button>)}</div>
        <button className="primary-button" disabled={!phoneVerified || !studentCardUploaded || !interests.length} type="button" onClick={onVerify}>인증 완료하고 2,500P 받기</button>
      </main>
      {cameraOpen ? <div className="modal-backdrop camera-backdrop"><section className="camera-modal"><button className="modal-close" type="button" onClick={() => setCameraOpen(false)}>×</button><span>학생증 촬영</span><div className="camera-preview"><i /><b>학생증을 사각형 안에 맞춰주세요</b><small>학교명과 이름이 선명하게 보여야 해요.</small></div><button className="camera-shutter" type="button" aria-label="촬영" onClick={() => { setStudentCardUploaded(true); localStorage.setItem('suniversity-student-card', 'uploaded'); setCameraOpen(false) }} /><p>이 화면은 프론트엔드 촬영 흐름을 확인하기 위한 미리보기예요.</p></section></div> : null}
    </div>
  )
}

function PhoneChangeScreen({ navigate }) {
  const [step, setStep] = useState(1)
  const [code, setCode] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [message, setMessage] = useState('')
  const currentPhone = localStorage.getItem('suniversity-phone') || '010-1234-5678'
  const verifyCurrent = () => {
    if (code !== '123456') { setMessage('테스트 인증번호 123456을 입력해 주세요.'); return }
    setMessage(''); setCode(''); setStep(2)
  }
  const savePhone = () => {
    if (!/^010-\d{4}-\d{4}$/.test(newPhone) || code !== '123456') { setMessage('새 전화번호와 인증번호를 확인해 주세요.'); return }
    localStorage.setItem('suniversity-phone', newPhone); setStep(3)
  }
  return <div className="screen"><TopBar title="전화번호 변경" onBack={() => step === 2 ? setStep(1) : navigate('profile')} /><main className="screen-content secure-setting">{step === 1 ? <><span>STEP 1</span><h1>현재 번호를<br />먼저 확인할게요</h1><p>{currentPhone}로 전송된 인증번호를 입력해 주세요.</p><button className="send-code" type="button" onClick={() => setMessage('인증번호를 보냈어요. 테스트 번호는 123456입니다.')}>인증번호 보내기</button><label>인증번호<input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} /></label><button className="primary-button" type="button" onClick={verifyCurrent}>현재 번호 인증하기</button></> : null}{step === 2 ? <><span>STEP 2</span><h1>새 전화번호를<br />인증해 주세요</h1><label>새 전화번호<input value={newPhone} onChange={(event) => setNewPhone(event.target.value)} placeholder="010-0000-0000" /></label><button className="send-code" type="button" onClick={() => setMessage('새 번호로 인증번호를 보냈어요. 테스트 번호는 123456입니다.')}>인증번호 보내기</button><label>인증번호<input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} /></label><button className="primary-button" type="button" onClick={savePhone}>인증하고 변경하기</button></> : null}{step === 3 ? <div className="setting-complete"><i>✓</i><h1>전화번호를 변경했어요</h1><p>{newPhone}로 안전하게 변경되었습니다.</p><button className="primary-button" type="button" onClick={() => navigate('profile')}>설정으로 돌아가기</button></div> : null}{message && step < 3 ? <p className="setting-message">{message}</p> : null}</main></div>
}

function PasswordChangeScreen({ navigate }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [complete, setComplete] = useState(false)
  const changePassword = () => {
    const savedPassword = localStorage.getItem('suniversity-password') || 'password123'
    if (currentPassword !== savedPassword) { setMessage('현재 비밀번호가 일치하지 않아요. 테스트 비밀번호는 password123입니다.'); return }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) { setMessage('영문과 숫자를 포함해 8자 이상 입력해 주세요.'); return }
    if (newPassword !== confirmPassword) { setMessage('새 비밀번호 확인이 일치하지 않아요.'); return }
    localStorage.setItem('suniversity-password', newPassword); setComplete(true)
  }
  return <div className="screen"><TopBar title="비밀번호 변경" onBack={() => navigate('profile')} /><main className="screen-content secure-setting">{!complete ? <><span>SECURITY</span><h1>새 비밀번호로<br />안전하게 바꿔요</h1><p>현재 비밀번호를 확인한 다음 새 비밀번호를 저장합니다.</p><label>현재 비밀번호<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label>새 비밀번호<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label>새 비밀번호 확인<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><button className="primary-button" type="button" onClick={changePassword}>비밀번호 변경하기</button>{message ? <p className="setting-message is-error">{message}</p> : null}</> : <div className="setting-complete"><i>✓</i><h1>비밀번호를 변경했어요</h1><p>다음 로그인부터 새 비밀번호를 사용해 주세요.</p><button className="primary-button" type="button" onClick={() => navigate('profile')}>설정으로 돌아가기</button></div>}</main></div>
}

function AuthScreen({ navigate }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ id: '', nickname: '', password: '', passwordConfirm: '' })
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [authError, setAuthError] = useState('')
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const canSubmit = form.id.trim().length >= 4 && form.password.length >= 8 && (mode === 'login' || (form.nickname.trim().length >= 2 && form.password === form.passwordConfirm && termsAccepted))
  const submitAuth = () => {
    if (!canSubmit) { setAuthError('입력 내용을 다시 확인해 주세요.'); return }
    localStorage.setItem('suniversity-test-user', JSON.stringify({ id: form.id.trim(), nickname: form.nickname.trim() || '설문요정' }))
    setAuthError('')
    navigate(mode === 'signup' ? 'verify' : 'home')
  }

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
        {mode === 'signup' ? <label className="auth-terms"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /><span>서비스 이용약관과 개인정보 처리방침에 동의합니다.</span></label> : null}
        {form.password && form.password.length < 8 ? <p className="auth-error">비밀번호는 8자 이상 입력해 주세요.</p> : null}
        {mode === 'signup' && form.passwordConfirm && form.password !== form.passwordConfirm ? <p className="auth-error">비밀번호가 서로 다릅니다.</p> : null}
        {authError ? <p className="auth-error">{authError}</p> : null}
        <button className="primary-button" disabled={!canSubmit} type="button" onClick={submitAuth}>
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
function MySurveysScreen({ navigate, hasDraft, publishedSurveys }) {
  const [items, setItems] = useState(() => {
    const saved = JSON.parse(localStorage.getItem('suniversity-managed-surveys') || 'null')
    const defaults = saved || [{ id: 1, title: '대학생의 AI 활용 경험 조사', responses: 82, target: 100, status: '진행 중' }, { id: 2, title: '캠퍼스 통학 만족도 조사', responses: 100, target: 100, status: '마감' }, { id: 3, title: '취업 준비 비용 조사', responses: 34, target: 80, status: '진행 중' }]
    const knownIds = new Set(defaults.map((item) => String(item.id)))
    return [...publishedSurveys.filter((survey) => !knownIds.has(String(survey.id))).map((survey) => ({ id: survey.id, title: survey.title, responses: 0, target: survey.targetCount || 100, status: '진행 중' })), ...defaults]
  })
  const [tab, setTab] = useState('published')
  const [draftExists, setDraftExists] = useState(hasDraft)
  useEffect(() => { localStorage.setItem('suniversity-managed-surveys', JSON.stringify(items)) }, [items])
  const closeSurvey = (id) => {
    if (window.confirm('설문을 마감하면 더 이상 응답을 받을 수 없어요. 마감할까요?')) setItems(items.map((item) => item.id === id ? { ...item, status: '마감' } : item))
  }
  const deleteSurvey = (id) => {
    if (window.confirm('이 설문을 삭제할까요? 삭제 후 복구할 수 없어요.')) setItems(items.filter((item) => item.id !== id))
  }
  const editSurvey = (item) => {
    localStorage.setItem('suniversity-survey-draft', JSON.stringify({ editId: item.id, title: item.title, category: '연구·프로젝트', targetCount: item.target, reward: 20, isPublic: true, questions: [{ id: `edit-${item.id}-1`, title: '이 주제에 대해 얼마나 관심이 있나요?', type: 'single', required: true, options: ['매우 관심 있어요', '조금 관심 있어요', '보통이에요', '관심 없어요'] }, { id: `edit-${item.id}-2`, title: '가장 중요하게 생각하는 점은 무엇인가요?', type: 'single', required: true, options: ['편리함', '비용', '신뢰도', '주변 추천'] }] }))
    navigate('create')
  }
  return <div className="screen"><TopBar title="내 설문 관리" onBack={() => navigate('profile')} /><main className="screen-content manage-surveys"><div className="manage-tabs"><button className={tab === 'published' ? 'is-active' : ''} onClick={() => setTab('published')} type="button">등록한 설문</button><button className={tab === 'draft' ? 'is-active' : ''} onClick={() => setTab('draft')} type="button">임시저장</button></div>{tab === 'published' ? <div className="manage-list">{items.map((item) => <article key={item.id}><div><span>{item.status}</span><b>{item.title}</b><small>{item.responses} / {item.target}명 응답</small><i><em style={{ width: `${item.responses / item.target * 100}%` }} /></i></div><div><button type="button" onClick={() => navigate('result')}>결과</button><button type="button" onClick={() => editSurvey(item)}>수정</button><button type="button" disabled={item.status === '마감'} onClick={() => closeSurvey(item.id)}>마감</button><button type="button" className="danger" onClick={() => deleteSurvey(item.id)}>삭제</button></div></article>)}</div> : draftExists ? <div className="draft-manage-card"><span>임시저장</span><b>작성 중인 설문이 있어요</b><p>마지막 작성 내용을 이어서 편집할 수 있어요.</p><button type="button" onClick={() => navigate('create')}>이어서 작성하기</button><button type="button" onClick={() => { localStorage.removeItem('suniversity-survey-draft'); setDraftExists(false) }}>삭제</button></div> : <div className="empty-state"><b>임시저장 설문이 없어요</b></div>}</main></div>
}
function SavedSurveysScreen({ navigate, savedSurveys, completedSurveys, onParticipate, onRemove }) {
  return (
    <div className="screen">
      <TopBar title="관심 설문" onBack={() => navigate('profile')} />
      <main className="screen-content saved-surveys-content">
        <div className="saved-surveys-heading"><span>나중에 참여하려고 저장한 설문</span><b>{savedSurveys.length}개</b></div>
        {savedSurveys.length ? <div className="saved-survey-list">{savedSurveys.map((id) => {
          const survey = getSurveyContent(id)
          const completed = completedSurveys.includes(id)
          return <article className={completed ? 'is-completed' : ''} key={id}><button type="button" onClick={() => onParticipate(id)}><span><small>{completed ? '참여 완료' : '관심 설문'}</small><b>{survey.title}</b><em>{survey.questions.length}문항 · 약 3분</em></span><strong>{completed ? '완료' : '+30P'}</strong></button><button className="saved-survey-remove" type="button" aria-label={`${survey.title} 관심 설문에서 삭제`} onClick={() => onRemove(id)}>삭제</button></article>
        })}</div> : <div className="empty-state"><b>저장한 관심 설문이 없어요</b><p>설문 참여 화면의 더보기에서<br />관심 설문을 저장할 수 있어요.</p><button type="button" onClick={() => navigate('surveys')}>설문 둘러보기</button></div>}
      </main>
    </div>
  )
}
function ViewedSurveysScreen({ navigate, onOpenResult }) {
  const [selectedSurvey, setSelectedSurvey] = useState(null)
  const viewedSurveys = (() => {
    try { return JSON.parse(localStorage.getItem('suniversity-viewed-surveys') || '[]') } catch { return [] }
  })()
  if (selectedSurvey) return <div className="screen"><TopBar title="열람한 설문" onBack={() => setSelectedSurvey(null)} /><main className="screen-content viewed-survey-detail"><span className="category-kicker">VIEWED SURVEY</span><h1>{selectedSurvey.title}</h1><p>이 설문에서 열어본 결과와 심층 분석을 다시 확인할 수 있어요.</p><div className="review-grid"><div><small>상태</small><b>응답 완료</b></div><div><small>분석</small><b>열람 완료</b></div><div><small>획득 호칭</small><b>{selectedSurvey.badge}</b></div><div><small>열람일</small><b>{selectedSurvey.viewedAt}</b></div></div><div className="review-card"><small>설문 정보</small><b>설문 내용과 기본 정보만 먼저 확인하고, 아래 버튼을 눌러야 심층 분석 결과로 이동해요.</b></div><button className="primary-button" type="button" onClick={() => onOpenResult(selectedSurvey)}>심층 분석 다시 보기</button></main></div>
  return <div className="screen"><TopBar title="내가 열람한 설문" onBack={() => navigate('profile')} /><main className="screen-content survey-library"><span className="category-kicker">VIEWED</span><h1>열람한 설문</h1><p>설문을 선택하면 기본 정보를 먼저 확인할 수 있어요.</p>{viewedSurveys.length ? <div className="survey-library-list">{viewedSurveys.map((survey) => <button type="button" key={survey.id} onClick={() => setSelectedSurvey(survey)}><span><small>심층 분석 열람 완료</small><b>{survey.title}</b><em>{survey.badge} · {survey.viewedAt}</em></span><strong>›</strong></button>)}</div> : <div className="empty-state"><b>열람한 설문이 없어요</b><p>설문 결과에서 심층 분석을 열면 여기에 저장돼요.</p></div>}</main></div>
}
function ProfileScreen({ navigate, points, hasDraft, badges, savedCount, selectedTitle, onSelectTitle }) {
  const [notificationEnabled, setNotificationEnabled] = useState(() => localStorage.getItem('suniversity-notifications') !== 'off')
  const toggleNotifications = () => { const next = !notificationEnabled; setNotificationEnabled(next); localStorage.setItem('suniversity-notifications', next ? 'on' : 'off') }
  return (
    <div className="screen">
      <TopBar title="마이페이지" onBack={() => navigate('home')} />
      <main className="screen-content profile-content">
        <div className="profile-hero">
          <div className="profile-avatar">SU</div>
          <span><b>설문요정</b><small>고려대학교 세종캠퍼스 · 인증 완료</small></span>
        </div>
        <div className="profile-stats"><div><b>{points.toLocaleString()}P</b><small>보유 포인트</small></div><div><b>LEVEL 7</b><small>현재 레벨</small></div><div><b>18위</b><small>전체 랭킹</small></div></div>
        {badges.length ? <section className="profile-badges"><div><b>내 설문 별명</b><small>대표 호칭을 고르면 랭킹과 밸런스게임 토론에 표시돼요.</small>{selectedTitle ? <em>현재 호칭 · {selectedTitle}</em> : null}</div><div>{badges.map((badge) => <button type="button" className={selectedTitle === badge ? 'is-selected' : ''} key={badge} onClick={() => onSelectTitle(badge)}>{badge}{selectedTitle === badge ? ' ✓' : ''}</button>)}</div></section> : null}
        <section className="settings-group">
          <button type="button" onClick={() => navigate('verify')}><span><UiIcon name="school" /> 학교 인증 정보</span><b>완료 <ChevronRightIcon /></b></button>
          <button type="button" onClick={() => navigate('phoneChange')}><span><UiIcon name="phone" /> 전화번호 변경</span><b><ChevronRightIcon /></b></button>
          <button type="button" onClick={toggleNotifications}><span><UiIcon name="bell" /> 알림 설정</span><b>{notificationEnabled ? 'ON' : 'OFF'} ›</b></button>
          <button type="button" onClick={() => navigate('passwordChange')}><span><UiIcon name="lock" /> 비밀번호 변경</span><b><ChevronRightIcon /></b></button>
        </section>

        <section className="settings-group">
          <button type="button" onClick={() => navigate('savedSurveys')}><span><UiIcon name="bell" /> 관심 설문</span><b>{savedCount ? `${savedCount}개` : '없음'} <ChevronRightIcon /></b></button>
          <button type="button" onClick={() => navigate('viewedSurveys')}><span><UiIcon name="all" /> 내가 열람한 설문</span><b><ChevronRightIcon /></b></button>
          <button type="button" onClick={() => navigate('mySurveys')}><span><UiIcon name="survey" /> 내가 만든 설문</span><b>3개 <ChevronRightIcon /></b></button>
          <button type="button" onClick={() => navigate('mySurveys')}><span><UiIcon name="draft" /> 임시저장 설문</span><b>{hasDraft ? '1개' : '없음'} <ChevronRightIcon /></b></button>
          <button type="button" onClick={() => navigate('points')}><span><UiIcon name="coin" /> 포인트 이용 내역</span><b><ChevronRightIcon /></b></button>
        </section>
        <button className="logout-button" type="button" onClick={() => navigate('auth')}>로그아웃</button><button className="withdraw-button" type="button" onClick={() => { if (window.confirm('정말 탈퇴할까요? 저장된 참여 기록이 삭제됩니다.')) { localStorage.clear(); navigate('auth') } }}>회원 탈퇴</button>
      </main>
    </div>
  )
}

function App() {
  const [screen, setScreen] = useState(() => localStorage.getItem('suniversity-current-screen') || 'home')
  const [lastCheckin, setLastCheckin] = useState(() => localStorage.getItem('suniversity-last-checkin') || '')
  const [participationSource, setParticipationSource] = useState(() => localStorage.getItem('suniversity-participation-source') || 'surveys')
  const [activeSurveyId, setActiveSurveyId] = useState(() => localStorage.getItem('suniversity-active-survey'))
  const [completedSurveys, setCompletedSurveys] = useState(() => JSON.parse(localStorage.getItem('suniversity-completed-surveys') || '[]'))
  const [savedSurveys, setSavedSurveys] = useState(() => JSON.parse(localStorage.getItem('suniversity-saved-surveys') || '[]'))
  const [points, setPoints] = useState(() => {
    if (localStorage.getItem('suniversity-test-balance-50000') !== 'applied') {
      localStorage.setItem('suniversity-test-balance-50000', 'applied')
      localStorage.setItem('suniversity-points', '50000')
      return 50000
    }
    return Number(localStorage.getItem('suniversity-points')) || 50000
  })
  const [adReward, setAdReward] = useState(() => {
    const today = new Date().toISOString().slice(0, 10)
    try {
      const saved = JSON.parse(localStorage.getItem('suniversity-daily-ad-reward'))
      return saved?.date === today ? saved : { date: today, amount: 0 }
    } catch {
      return { date: today, amount: 0 }
    }
  })
  const [publishedSurveys, setPublishedSurveys] = useState(() => JSON.parse(localStorage.getItem('suniversity-published-surveys') || '[]'))
  const [lastResult, setLastResult] = useState(() => JSON.parse(localStorage.getItem('suniversity-last-result') || '{}'))
  const [badges, setBadges] = useState(() => JSON.parse(localStorage.getItem('suniversity-survey-badges') || '[]'))
  const [selectedTitle, setSelectedTitle] = useState(() => localStorage.getItem('suniversity-selected-title') || '')
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('suniversity-transactions')
    return saved ? JSON.parse(saved) : [
      { id: 1, label: '학교 인증 가입 보상', amount: 2500 },
      { id: 2, label: '설문 참여 보상', amount: 30 },
      { id: 3, label: 'AI 심층 분석', amount: -200 },
    ]
  })
  useEffect(() => {
    window.history.replaceState({ screen: localStorage.getItem('suniversity-current-screen') || 'home' }, '')
    const handlePopState = (event) => {
      const next = event.state?.screen || 'home'
      setScreen(next)
      localStorage.setItem('suniversity-current-screen', next)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (next) => {
    setScreen(next)
    localStorage.setItem('suniversity-current-screen', next)
    if (window.history.state?.screen !== next) window.history.pushState({ screen: next }, '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startSurvey = (surveyId) => {
    const id = String(surveyId)
    if (completedSurveys.includes(id)) { window.alert('이미 참여를 완료한 설문이에요. 중복 참여는 할 수 없어요.'); return }
    setParticipationSource(screen)
    localStorage.setItem('suniversity-participation-source', screen)
    setActiveSurveyId(id)
    setScreen('participate')
    localStorage.setItem('suniversity-current-screen', 'participate')
    localStorage.setItem('suniversity-active-survey', id)
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

  const completeSurvey = (amount, badge, title, answers, questions) => {
    earnPoints(amount, '설문 참여 보상')
    const resultInfo = { badge, title, answers, questions }; setLastResult(resultInfo); localStorage.setItem('suniversity-last-result', JSON.stringify(resultInfo))
    if (activeSurveyId && !completedSurveys.includes(activeSurveyId)) { const nextCompleted = [activeSurveyId, ...completedSurveys]; setCompletedSurveys(nextCompleted); localStorage.setItem('suniversity-completed-surveys', JSON.stringify(nextCompleted)) }
    if (badge && !badges.includes(badge)) { const next = [badge, ...badges]; setBadges(next); localStorage.setItem('suniversity-survey-badges', JSON.stringify(next)) }
    navigate('resultAccess')
  }

  const toggleSavedSurvey = (surveyId) => {
    const id = String(surveyId)
    const next = savedSurveys.includes(id) ? savedSurveys.filter((savedId) => savedId !== id) : [id, ...savedSurveys]
    setSavedSurveys(next)
    localStorage.setItem('suniversity-saved-surveys', JSON.stringify(next))
  }
  const selectProfileTitle = (title) => {
    setSelectedTitle(title)
    localStorage.setItem('suniversity-selected-title', title)
  }
  const openViewedResult = (survey) => {
    const nextResult = { ...lastResult, title: survey.title, badge: survey.badge }
    setLastResult(nextResult)
    localStorage.setItem('suniversity-last-result', JSON.stringify(nextResult))
    navigate('result')
  }

  const publishSurvey = (survey) => {
    const next = survey.editId ? publishedSurveys.map((item) => String(item.id) === String(survey.editId) ? survey : item) : [survey, ...publishedSurveys]
    setPublishedSurveys(next)
    localStorage.setItem('suniversity-published-surveys', JSON.stringify(next))
  }

  const checkInToday = () => {
    const today = new Date().toISOString().slice(0, 10)
    if (lastCheckin === today) return
    setLastCheckin(today)
    localStorage.setItem('suniversity-last-checkin', today)
    earnPoints(10, '일일 출석체크')
  }
  const watchAd = () => {
    if (adReward.amount >= 1000) return
    const nextReward = { date: new Date().toISOString().slice(0, 10), amount: Math.min(1000, adReward.amount + 100) }
    setAdReward(nextReward)
    localStorage.setItem('suniversity-daily-ad-reward', JSON.stringify(nextReward))
    earnPoints(100, '광고 시청 보상')
  }
  const voteBalance = () => earnPoints(2, '밸런스게임 참여')

  const completeVerification = () => {
    earnPoints(2500, '학교 인증 가입 보상')
    navigate('home')
  }

  const screens = {
    auth: <AuthScreen navigate={navigate} />,
    home: <HomeScreen navigate={navigate} isCheckedIn={lastCheckin === new Date().toISOString().slice(0, 10)} onCheckIn={checkInToday} onParticipate={startSurvey} completedSurveys={completedSurveys} />,
    surveys: <SurveyListScreen navigate={navigate} customSurveys={publishedSurveys} onParticipate={startSurvey} completedSurveys={completedSurveys} />,
    participate: <ParticipateScreen navigate={navigate} onComplete={completeSurvey} onExit={() => navigate(participationSource)} surveyId={activeSurveyId} isSaved={savedSurveys.includes(String(activeSurveyId))} onToggleSaved={toggleSavedSurvey} />,
    create: <CreateScreen navigate={navigate} onPublish={publishSurvey} points={points} spendPoints={spendPoints} />,
    resultAccess: <ResultAccessScreen navigate={navigate} points={points} unlockResult={(price) => { if (spendPoints(price, '설문 결과 열람')) navigate('result') }} />,
    result: <ResultScreen navigate={navigate} spendPoints={spendPoints} resultInfo={lastResult} />,
    points: <PointsScreen navigate={navigate} points={points} transactions={transactions} spendPoints={spendPoints} adEarned={adReward.amount} onWatchAd={watchAd} />,
    ranking: <RankingScreen navigate={navigate} selectedTitle={selectedTitle} />,
    balance: <BalanceGameScreen navigate={navigate} onVote={voteBalance} selectedTitle={selectedTitle} />,
    verify: <VerifyScreen navigate={navigate} onVerify={completeVerification} />,
    notifications: <NotificationsScreen navigate={navigate} />,
    mySurveys: <MySurveysScreen navigate={navigate} hasDraft={Boolean(localStorage.getItem('suniversity-survey-draft'))} publishedSurveys={publishedSurveys} />,
    savedSurveys: <SavedSurveysScreen navigate={navigate} savedSurveys={savedSurveys} completedSurveys={completedSurveys} onParticipate={startSurvey} onRemove={toggleSavedSurvey} />,
    viewedSurveys: <ViewedSurveysScreen navigate={navigate} onOpenResult={openViewedResult} />,
    profile: <ProfileScreen navigate={navigate} points={points} hasDraft={Boolean(localStorage.getItem('suniversity-survey-draft'))} badges={badges} savedCount={savedSurveys.length} selectedTitle={selectedTitle} onSelectTitle={selectProfileTitle} />,
    phoneChange: <PhoneChangeScreen navigate={navigate} />,
    passwordChange: <PasswordChangeScreen navigate={navigate} />,
  }

  return (
    <div className="prototype-stage">
      <div className="device-shell">
        <span className="device-speaker" aria-hidden="true" />
        <span className="device-camera" aria-hidden="true" />
        <span className="device-button device-button--volume" aria-hidden="true" />
        <span className="device-button device-button--power" aria-hidden="true" />
        <div className="phone-frame">
          {screens[screen] || screens.home}
          {bottomNavScreens.has(screen) ? <BottomNav active={screen} navigate={navigate} /> : null}
        </div>
      </div>
    </div>
  )
}

export default App
