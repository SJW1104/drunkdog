/* eslint-disable react/prop-types */
import { useState } from 'react'
import './App.css'

const surveys = [
  { eyebrow: '관심사 일치 92%', title: 'Z세대의 구독 서비스 이용 행태', meta: '고려대 세종 · 약 4분', count: '64 / 120', point: 30, tone: 'blue' },
  { eyebrow: '🔥 HOT · 소비', title: '대학생 배달앱 선택 기준 조사', meta: '익명 · 약 2분', count: '211명 참여', point: 15, tone: 'orange' },
  { eyebrow: '⏳ 마감 임박', title: '캡스톤 팀 프로젝트 협업 경험', meta: '1.5배 보상 적용', count: '2시간 남음', point: 45, tone: 'purple' },
  { eyebrow: '새 친구 · 연애', title: '대학생의 데이트 비용 인식', meta: '약 1분', count: '12 / 80', point: 10, tone: 'blue' },
  { eyebrow: '학교생활 · 수업', title: '통학 시간과 캠퍼스 만족도', meta: '약 3분', count: '38 / 100', point: 20, tone: 'blue' },
]

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

function TopBar({ title, onBack, right, brand = false }) {
  return (
    <header className={'top-bar ' + (brand ? 'top-bar--brand' : '')}>
      {onBack ? <IconButton label="뒤로 가기" onClick={onBack}>‹</IconButton> : <span className="top-spacer" />}
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
      {action ? <button type="button">{action}</button> : null}
    </div>
  )
}

function HomeScreen({ navigate }) {
  return (
    <div className="screen with-nav">
      <TopBar
        title="suniversity"
        brand
        right={
          <div className="top-actions">
            <IconButton label="검색">⌕</IconButton>
            <IconButton label="알림" badge="3" onClick={() => navigate('notifications')}>♢</IconButton>
            <button className="avatar-button" type="button" onClick={() => navigate('profile')}>MY</button>
          </div>
        }
      />

      <main className="screen-content home-content">
        <button className="checkin-card" type="button">
          <span>오늘도 반가워요 👋</span>
          <b>출석체크 +10P</b>
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
            <button className="mini-card" type="button" onClick={() => navigate('participate')}><b>캡스톤 협업 경험</b><small>2시간 남음 · +45P</small></button>
            <button className="mini-card" type="button" onClick={() => navigate('participate')}><b>통학 만족도 조사</b><small>오늘 마감 · +30P</small></button>
          </div>
        </section>

        <section>
          <SectionHeader icon="✨" title="새로 올라온 설문" count="8개" action="더보기 ›" />
          <div className="grid-two">
            <button className="mini-card" type="button" onClick={() => navigate('participate')}><b>데이트 비용 인식</b><small>방금 등록 · +10P</small></button>
            <button className="mini-card" type="button" onClick={() => navigate('participate')}><b>공모전 참여 경험</b><small>5분 전 · +20P</small></button>
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
    </div>
  )
}

function SurveyListScreen({ navigate, customSurveys = [] }) {
  const [category, setCategory] = useState('전체')
  const [query, setQuery] = useState('')
  const allSurveys = [...customSurveys, ...surveys]
  const filteredSurveys = allSurveys.filter((survey) => {
    const matchesQuery = survey.title.toLowerCase().includes(query.toLowerCase())
    const matchesCategory = category === '전체' || survey.eyebrow.includes(category)
    return matchesQuery && matchesCategory
  })
  return (
    <div className="screen">
      <TopBar title="설문 둘러보기" onBack={() => navigate('home')} right={<IconButton label="알림">♢</IconButton>} />
      <main className="screen-content list-content">
        <label className="search-box">
          <span>⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="키워드로 설문 검색" />
        </label>
        <div className="chips">
          {['전체', 'MBTI', '연애', '소비', '취업'].map((item) => (
            <button key={item} type="button" className={category === item ? 'chip is-active' : 'chip'} onClick={() => setCategory(item)}>{item}</button>
          ))}
        </div>
        <SectionHeader title="내게 맞는 설문" count="" action="추천순⌄" />
        <div className="survey-card-list">
          {filteredSurveys.map((survey, index) => (
            <button className="survey-card" key={survey.title} type="button" onClick={() => navigate('participate')}>
              <span className={'survey-eyebrow ' + survey.tone}>{survey.eyebrow}</span>
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

function ParticipateScreen({ navigate, onComplete }) {
  const questions = [
    { title: '과제나 프로젝트에 AI 도구를 얼마나 자주 활용하나요?', options: ['거의 사용하지 않아요', '월 1~2회 사용해요', '주 1~2회 사용해요', '거의 매일 사용해요'] },
    { title: '가장 자주 사용하는 AI 도구는 무엇인가요?', options: ['ChatGPT', 'Claude', 'Gemini', '기타 도구'] },
    { title: 'AI를 주로 어떤 목적으로 사용하나요?', options: ['자료 조사', '글쓰기·요약', '코딩·분석', '아이디어 발상'] },
    { title: 'AI 활용이 과제 수행에 도움이 되었나요?', options: ['매우 도움 됨', '도움 됨', '보통', '도움 되지 않음'] },
    { title: '학교에서 AI 활용 교육이 필요하다고 생각하나요?', options: ['매우 필요함', '필요함', '잘 모르겠음', '필요하지 않음'] },
  ]
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const selected = answers[questionIndex]
  const question = questions[questionIndex]
  const isLast = questionIndex === questions.length - 1

  const selectAnswer = (index) => setAnswers({ ...answers, [questionIndex]: index })
  const goNext = () => {
    if (selected === undefined) return
    if (isLast) onComplete(30)
    else setQuestionIndex(questionIndex + 1)
  }

  return (
    <div className="screen">
      <TopBar title="설문 참여" onBack={() => questionIndex ? setQuestionIndex(questionIndex - 1) : navigate('surveys')} right={<IconButton label="더보기">•••</IconButton>} />
      <main className="screen-content participate-content">
        <div className="survey-progress-label"><span>질문 {questionIndex + 1} / {questions.length}</span><span>약 {questions.length - questionIndex}분 남음</span></div>
        <div className="survey-progress"><span style={{ width: ((questionIndex + 1) / questions.length * 100) + '%' }} /></div>
        <p className="required-label">필수 질문</p>
        <h1 className="question-title">{question.title}</h1>
        <div className="option-list">
          {question.options.map((option, index) => (
            <button
              type="button"
              key={option}
              className={selected === index ? 'answer-option is-selected' : 'answer-option'}
              onClick={() => selectAnswer(index)}
            >
              {option}{selected === index ? ' ✓' : ''}
            </button>
          ))}
        </div>
        <div className="reward-banner"><strong>30P</strong><span>끝까지 응답하면<br /><b>포인트가 바로 지급돼요</b></span></div>
        <button className="primary-button" disabled={selected === undefined} type="button" onClick={goNext}>{isLast ? '응답 완료하고 30P 받기' : '다음 질문'}</button>
        <p className="privacy-note">응답은 익명으로 안전하게 저장됩니다.</p>
      </main>
    </div>
  )
}
function CreateScreen({ navigate, onPublish }) {
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('대학생의 AI 활용 경험 조사')
  const [category, setCategory] = useState('취업')
  const [targetCount, setTargetCount] = useState(100)
  const [reward, setReward] = useState(20)
  const [isPublic, setIsPublic] = useState(true)
  const [questions, setQuestions] = useState([
    ['Q1. 현재 학년을 선택해 주세요', '객관식 · 필수'],
    ['Q2. AI 도구 사용 빈도는?', '단일 선택 · 필수'],
    ['Q3. 가장 유용했던 기능은?', '복수 선택 · 선택'],
  ])

  const publish = () => {
    onPublish({ title, category, targetCount, reward, questionCount: questions.length, isPublic })
    navigate('surveys')
  }

  return (
    <div className="screen">
      <TopBar title="새 설문 만들기" onBack={() => step > 1 ? setStep(step - 1) : navigate('home')} right={<button className="text-action" type="button">임시저장</button>} />
      <div className="step-progress"><span /><span className={step >= 2 ? '' : 'pending'} /><span className={step >= 3 ? '' : 'pending'} /></div>
      <main className="screen-content create-content">
        {step === 1 ? <>
          <h1>질문을 구성해 주세요</h1>
          <p className="subtitle">직접 만들거나 AI에게 추천받을 수 있어요.</p>
          <label className="builder-field">설문 제목<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <div className="ai-helper">
            <b>✦ AI 문항 도우미</b>
            <small>주제와 대상을 분석해 중복 없는 질문, 예상 소요시간, 응답률을 제안해요.</small>
            <button type="button" onClick={() => setQuestions([...questions, ['Q' + (questions.length + 1) + '. AI 추천 문항', '단일 선택 · 필수']])}>AI로 문항 추천 · 20P</button>
          </div>
          <div className="question-list">
            {questions.map(([questionTitle, meta], index) => (
              <div className="question-card" key={questionTitle}>
                <span><b>{questionTitle}</b><small>{meta}</small></span>
                <button type="button" aria-label="질문 삭제" onClick={() => setQuestions(questions.filter((_, itemIndex) => itemIndex !== index))}>×</button>
              </div>
            ))}
          </div>
          <button className="soft-button" type="button" onClick={() => setQuestions([...questions, ['Q' + (questions.length + 1) + '. 새로운 질문', '객관식 · 선택']])}>＋ 질문 직접 추가</button>
          <button className="primary-button" disabled={!title || questions.length < 1} type="button" onClick={() => setStep(2)}>다음 · 대상 및 보상 설정</button>
        </> : null}

        {step === 2 ? <>
          <h1>대상과 보상을<br />설정해 주세요</h1>
          <p className="subtitle">원하는 응답자와 모집 규모를 정할 수 있어요.</p>
          <label className="builder-field">카테고리<select value={category} onChange={(event) => setCategory(event.target.value)}><option>취업</option><option>소비</option><option>학교생활</option><option>MBTI</option><option>연애</option></select></label>
          <label className="builder-field">목표 응답자 수<input type="number" min="10" max="1000" value={targetCount} onChange={(event) => setTargetCount(Number(event.target.value))} /></label>
          <label className="builder-field">1인당 참여 보상<input type="range" min="5" max="40" step="5" value={reward} onChange={(event) => setReward(Number(event.target.value))} /><strong>{reward}P</strong></label>
          <label className="toggle-row"><span><b>결과 공개</b><small>공개하면 커뮤니티 포인트 혜택을 받아요.</small></span><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} /></label>
          <div className="budget-card"><span>예상 필요 포인트</span><strong>{(targetCount * reward).toLocaleString()}P</strong><small>목표 응답자 수 × 참여 보상</small></div>
          <button className="primary-button" type="button" onClick={() => setStep(3)}>다음 · 등록 내용 검토</button>
        </> : null}

        {step === 3 ? <>
          <h1>등록 전에<br />확인해 주세요</h1>
          <p className="subtitle">설문을 등록한 후에도 마감 전까지 일부 정보를 수정할 수 있어요.</p>
          <div className="review-card"><small>설문 제목</small><b>{title}</b></div>
          <div className="review-grid"><div><small>카테고리</small><b>{category}</b></div><div><small>문항 수</small><b>{questions.length}개</b></div><div><small>목표 응답</small><b>{targetCount}명</b></div><div><small>참여 보상</small><b>{reward}P</b></div></div>
          <div className="review-card"><small>결과 공개</small><b>{isPublic ? '커뮤니티 공개' : '작성자만 보기'}</b></div>
          <button className="primary-button" type="button" onClick={publish}>설문 등록하기</button>
          <p className="privacy-note">등록 후 검수 과정을 거쳐 설문 목록에 공개됩니다.</p>
        </> : null}
      </main>
    </div>
  )
}

function BalanceGameScreen({ navigate, onVote }) {
  const [selected, setSelected] = useState(null)
  const [voted, setVoted] = useState(false)
  const vote = (choice) => {
    if (voted) return
    setSelected(choice)
    setVoted(true)
    onVote()
  }
  return (
    <div className="screen with-nav">
      <TopBar title="밸런스게임" onBack={() => navigate('home')} />
      <main className="screen-content balance-content">
        <p className="required-label">오늘의 밸런스 · 학교생활</p>
        <h1 className="question-title">팀플에서 더 힘든 상황은?</h1>
        <div className="balance-options">
          <button type="button" className={selected === 'A' ? 'is-selected' : ''} onClick={() => vote('A')}><small>A</small><b>회의에는 오지만<br />아무것도 안 하는 팀원</b>{voted ? <strong>58%</strong> : null}</button>
          <span>VS</span>
          <button type="button" className={selected === 'B' ? 'is-selected' : ''} onClick={() => vote('B')}><small>B</small><b>연락은 없지만<br />결과물은 잘 내는 팀원</b>{voted ? <strong>42%</strong> : null}</button>
        </div>
        {voted ? <div className="insight-card"><b>투표 완료 · +2P</b><p>1,284명의 대학생이 참여했어요. 댓글에서 선택 이유를 나눠보세요.</p></div> : <p className="privacy-note">투표하면 바로 결과를 확인하고 2P를 받아요.</p>}
      </main>
      <BottomNav active="balance" navigate={navigate} />
    </div>
  )
}
function ResultScreen({ navigate, spendPoints }) {
  return (
    <div className="screen">
      <TopBar title="설문 결과" onBack={() => navigate('home')} right={<IconButton label="공유">↗</IconButton>} />
      <main className="screen-content result-content">
        <h1>대학생의 AI 활용과<br />취업 준비</h1>
        <p className="subtitle">마감 완료 · 2026.07.21</p>
        <div className="stat-grid">
          <div><strong>104</strong><small>총 응답</small></div>
          <div><strong>92%</strong><small>완료율</small></div>
          <div><strong>3:12</strong><small>평균 시간</small></div>
        </div>
        <SectionHeader title="핵심 응답 분포" count="" action="Q3 기준" />
        <div className="chart-card">
          {[45, 70, 100, 80].map((height, index) => (
            <div className="bar-item" key={height}><span style={{ height: height + 'px' }} /><small>{['미사용', '월 1~2회', '주 1~2회', '매일'][index]}</small></div>
          ))}
        </div>
        <div className="insight-card"><b>✦ AI 핵심 인사이트</b><p>응답자의 68%가 주 1회 이상 AI를 활용하며, 취업 준비 집단에서 활용 빈도가 더 높아요.</p></div>
        <button className="primary-button" type="button" onClick={() => spendPoints(200, 'AI 심층 분석')}>심층 분석 보기 · 200P</button>
        <button className="soft-button" type="button" onClick={() => spendPoints(400, 'PPT 자동 생성')}>PPT 자동 생성 · 400P</button>
      </main>
    </div>
  )
}

function PointsScreen({ navigate, points, transactions, earnPoints, spendPoints }) {
  return (
    <div className="screen with-nav">
      <TopBar title="포인트" onBack={() => navigate('home')} right={<IconButton label="도움말">?</IconButton>} />
      <main className="screen-content points-content">
        <div className="balance-card"><small>사용 가능 포인트</small><strong><span>P</span> {points.toLocaleString()} P</strong><b>↑ 이번 달 +780P 적립</b></div>
        <SectionHeader title="포인트 더 모으기" count="" action="일일 한도 1,000P" />
        <div className="watch-card"><b>▶ 광고 보고 10P 받기</b><small>하루 최대 5회 참여할 수 있어요.</small><button type="button" onClick={() => earnPoints(10, '광고 시청 보상')}>30초 광고 시청</button></div>
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
  const notices = [
    ['관심 설문이 새로 올라왔어요', '취업 분야 · 대학생 AI 활용 조사', '방금 전'],
    ['마감 임박 보너스', '2시간 남은 설문 참여 시 포인트 1.5배', '20분 전'],
    ['응답이 도착했어요', '내 설문에 새로운 응답 12개가 모였어요', '1시간 전'],
  ]
  return (
    <div className="screen">
      <TopBar title="알림" onBack={() => navigate('home')} />
      <main className="screen-content notification-content">
        {notices.map(([title, body, time], index) => (
          <button className="notice-card" type="button" key={title} onClick={() => navigate(index === 2 ? 'result' : 'surveys')}>
            <span className="notice-dot" />
            <span><b>{title}</b><small>{body}</small></span>
            <time>{time}</time>
          </button>
        ))}
      </main>
    </div>
  )
}

function ProfileScreen({ navigate, points }) {
  return (
    <div className="screen">
      <TopBar title="마이페이지" onBack={() => navigate('home')} />
      <main className="screen-content profile-content">
        <div className="profile-hero">
          <div className="profile-avatar">SU</div>
          <span><b>설문요정</b><small>고려대학교 세종캠퍼스 · 인증 완료</small></span>
        </div>
        <div className="profile-stats"><div><b>{points.toLocaleString()}P</b><small>보유 포인트</small></div><div><b>LEVEL 7</b><small>현재 레벨</small></div><div><b>18위</b><small>전체 랭킹</small></div></div>
        <section className="settings-group">
          <button type="button" onClick={() => navigate('verify')}><span>� 학교 인증 정보</span><b>완료 ›</b></button>
          <button type="button"><span>☎ 전화번호 변경</span><b>›</b></button>
          <button type="button"><span>� 알림 설정</span><b>ON ›</b></button>
          <button type="button"><span>� 비밀번호 변경</span><b>›</b></button>
        </section>
        <section className="settings-group">
          <button type="button" onClick={() => navigate('result')}><span>▤ 내가 만든 설문</span><b>3개 ›</b></button>
          <button type="button" onClick={() => navigate('points')}><span>● 포인트 이용 내역</span><b>›</b></button>
        </section>
        <button className="logout-button" type="button" onClick={() => navigate('auth')}>로그아웃</button>
      </main>
    </div>
  )
}

function App() {
  const [screen, setScreen] = useState('home')
  const [points, setPoints] = useState(() => Number(localStorage.getItem('suniversity-points')) || 2540)
  const [publishedSurveys, setPublishedSurveys] = useState([])
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('suniversity-transactions')
    return saved ? JSON.parse(saved) : [
      { id: 1, label: '학교 인증 가입 보상', amount: 2500 },
      { id: 2, label: '설문 참여 보상', amount: 30 },
      { id: 3, label: 'AI 심층 분석', amount: -200 },
    ]
  })

  const navigate = (next) => {
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
      return
    }
    updateWallet(points - amount, [{ id: Date.now(), label, amount: -amount }, ...transactions].slice(0, 8))
  }

  const completeSurvey = (amount) => {
    earnPoints(amount, '설문 참여 보상')
    navigate('result')
  }

  const publishSurvey = (survey) => {
    setPublishedSurveys([survey, ...publishedSurveys])
  }

  const voteBalance = () => earnPoints(2, '밸런스게임 참여')

  const completeVerification = () => {
    earnPoints(2500, '학교 인증 가입 보상')
    navigate('home')
  }

  const screens = {
    auth: <AuthScreen navigate={navigate} />,
    home: <HomeScreen navigate={navigate} />,
    surveys: <SurveyListScreen navigate={navigate} customSurveys={publishedSurveys} />,
    participate: <ParticipateScreen navigate={navigate} onComplete={completeSurvey} />,
    create: <CreateScreen navigate={navigate} onPublish={publishSurvey} />,
    result: <ResultScreen navigate={navigate} spendPoints={spendPoints} />,
    points: <PointsScreen navigate={navigate} points={points} transactions={transactions} earnPoints={earnPoints} spendPoints={spendPoints} />,
    ranking: <RankingScreen navigate={navigate} />,
    balance: <BalanceGameScreen navigate={navigate} onVote={voteBalance} />,
    verify: <VerifyScreen navigate={navigate} onVerify={completeVerification} />,
    notifications: <NotificationsScreen navigate={navigate} />,
    profile: <ProfileScreen navigate={navigate} points={points} />,
  }

  return (
    <div className="prototype-stage">
      <div className="phone-frame">{screens[screen] || screens.home}</div>
    </div>
  )
}

export default App