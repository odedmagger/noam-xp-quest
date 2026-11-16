import { useEffect, useRef, useState, type RefObject } from 'react'
import { CalendarDays, ChevronDown, CircleAlert, Pencil, ShieldCheck, Swords, Zap } from 'lucide-react'
import { animate, motion, useReducedMotion } from 'motion/react'
import { readConfig } from './data/config'
import { ExamTable } from './components/ExamTable'
import { RewardLadder } from './components/RewardLadder'
import { localProgressStore } from './progress-store'
import { changeAchievement, claimReward, emptyProgress, maximumXp, rewardLadder, totalXp, type Config, type Progress, type Semester } from './quest'

function XpCount({ xp }: { xp: number }) {
  const [display, setDisplay] = useState(xp)
  const current = useRef(xp)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (reducedMotion || current.current === xp) return
    const animation = animate(current.current, xp, {
      duration: 0.35,
      onUpdate: value => {
        current.current = value
        setDisplay(Math.round(value))
      },
    })
    return () => animation.stop()
  }, [xp, reducedMotion])

  return <>{reducedMotion ? xp : display}</>
}

export default function App() {
  const [setup] = useState(() => {
    try {
      return { config: readConfig() }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  })

  if (!setup.config) return <main className="shell main-content">
    <section className="panel error-panel" role="alert">
      <CircleAlert size={24} /><h1>שגיאה בהגדרת המסלול</h1><p><bdi>{setup.error}</bdi></p>
    </section>
  </main>

  return <Dashboard config={setup.config} />
}

function Dashboard({ config }: { config: Config }) {
  const [semesterId, setSemesterId] = useState(config.activeSemesterId)
  const [parentMode, setParentMode] = useState(false)
  const writes = useRef(Promise.resolve())
  const semester = config.semesters.find(item => item.id === semesterId)!
  const active = semesterId === config.activeSemesterId

  return <>
    <header className="site-header">
      <div className="shell header-content">
        <div className="brand"><span className="brand-icon"><Swords size={20} /></span><strong>המסע של נועם</strong></div>
        <div className="header-actions">
          <label className="semester-control">
            <CalendarDays size={16} aria-hidden="true" />
            <select aria-label="בחירת סמסטר" value={semesterId} onChange={event => {
              setSemesterId(event.target.value)
              setParentMode(false)
            }}>
              {config.semesters.map(item => <option key={item.id} value={item.id}>
                {item.name}{item.id === config.activeSemesterId ? ' (פעיל)' : ''}
              </option>)}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </label>
          {active && <button className="parent-toggle" type="button" aria-pressed={parentMode} onClick={() => setParentMode(value => !value)}>
            {parentMode ? <ShieldCheck size={16} /> : <Pencil size={16} />} מצב עריכת הורה
          </button>}
        </div>
      </div>
    </header>
    <Quest key={semester.id} semester={semester} active={active} parentMode={parentMode} writes={writes} />
  </>
}

function Quest({ semester, active, parentMode, writes }: {
  semester: Semester
  active: boolean
  parentMode: boolean
  writes: RefObject<Promise<void>>
}) {
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState('')
  const [resetting, setResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const latestProgress = useRef<Progress | null>(null)
  const mounted = useRef(false)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    let cancelled = false
    mounted.current = true
    void writes.current.then(() => localProgressStore.load(semester)).then(loaded => {
      if (cancelled) return
      latestProgress.current = loaded
      setProgress(loaded)
    }).catch(() => {
      if (!cancelled) setError('לא ניתן לקרוא את ההתקדמות שנשמרה בדפדפן.')
    })
    return () => { cancelled = true; mounted.current = false }
  }, [semester, writes])

  useEffect(() => {
    if (!parentMode) setConfirmReset(false)
  }, [parentMode])

  function update(apply: (current: Progress) => Progress) {
    if (!latestProgress.current) return
    const next = apply(latestProgress.current)
    latestProgress.current = next
    setProgress(next)
    writes.current = writes.current.then(() => localProgressStore.save(semester.id, next)).then(() => {
      if (mounted.current) setError('')
    }).catch(() => {
      if (mounted.current) setError('השינוי לא נשמר בדפדפן. אפשר לנסות שוב.')
    })
  }

  function reset() {
    setConfirmReset(false)
    setResetting(true)
    writes.current = writes.current.then(() => localProgressStore.reset(semester.id)).then(() => {
      if (!mounted.current) return
      const cleared = emptyProgress()
      latestProgress.current = cleared
      setProgress(cleared)
      setError('')
    }).catch(() => {
      if (mounted.current) setError('לא ניתן לאפס את ההתקדמות בדפדפן.')
    }).finally(() => {
      if (mounted.current) setResetting(false)
    })
  }

  const editable = parentMode && progress !== null && !resetting
  const xp = progress ? totalXp(progress, semester) : 0
  const max = maximumXp(semester)
  const ladder = rewardLadder(semester, xp)

  return <main className="shell main-content">
    <div className="welcome">
      <div className="eyebrow"><span /> {active ? 'לוח התקדמות' : 'היסטוריית סמסטרים'}</div>
      <h1>המסע של נועם<span>.</span></h1>
      <p>כל הישג במבחן מקרב אותך לפרס הבא.</p>
    </div>
    {error && <p className="banner error" role="alert"><CircleAlert size={18} />{error}</p>}
    {parentMode && <div className="banner edit-banner">
      <span><Pencil size={16} />בחרו סטטוס בתא של הישג או סמנו פרס שנמסר. השינויים נשמרים אוטומטית.</span>
      {!confirmReset && <button type="button" onClick={() => setConfirmReset(true)} disabled={!editable}>איפוס סמסטר</button>}
    </div>}
    {parentMode && confirmReset && <div className="banner edit-banner error" role="group" aria-label="אישור איפוס סמסטר">
      <span>לאפס את ההישגים ואת רישום הפרסים של הסמסטר הזה?</span>
      <div className="reset-actions">
        <button type="button" autoFocus onClick={() => setConfirmReset(false)}>ביטול</button>
        <button type="button" onClick={reset}>כן, לאפס</button>
      </div>
    </div>}
    {!progress && !error && <p role="status" className="banner">טוען התקדמות…</p>}
    {progress && <div className="dashboard">
      <div className="main-column">
        <section className="hero" aria-labelledby="xp-title">
          <div className="hero-art" aria-hidden="true">
            <div className="art-grid" />
            <span className="spark spark-top">✦</span><span className="spark spark-bottom">✦</span>
            <div className="emblem-outline"><div className="emblem"><Zap size={63} fill="currentColor" strokeWidth={1.4} /></div></div>
          </div>
          <div className="hero-content">
            <div className="hero-label"><h2 id="xp-title"><Zap size={15} fill="currentColor" /> נקודות בסמסטר</h2><span className="milestone">אבן דרך {ladder.milestone} מתוך {ladder.ordered.length}</span></div>
            <div className="xp-value" dir="ltr">
              <strong aria-hidden="true"><XpCount xp={xp} /></strong><span aria-hidden="true"> / {max} XP</span>
              <span className="sr-only" aria-live="polite">{xp} מתוך {max} נקודות</span>
            </div>
            <div className="progress-details">
              <span>{ladder.next ? 'הבא בתור · ' + ladder.next.title : ladder.ordered.length ? 'הגעת לכל אבני הדרך!' : 'אין פרסים במסלול הזה'}</span>
              {ladder.next && <bdi>{ladder.next.xp - xp} XP לפרס</bdi>}
            </div>
            <div className="xp-track" role="progressbar" aria-label="התקדמות לפרס הבא" aria-valuenow={Math.round(ladder.percentage)}>
              <motion.div initial={false} animate={{ width: ladder.percentage + '%' }} transition={{ duration: reducedMotion ? 0 : 0.4 }} />
            </div>
          </div>
        </section>
        <ExamTable semester={semester} progress={progress} editable={editable}
          onChange={(exam, achievement, status) => update(current => changeAchievement(current, semester, exam, achievement, status))} />
      </div>
      <RewardLadder ladder={ladder} progress={progress} xp={xp} editable={editable}
        onClaim={id => update(current => claimReward(current, semester, id))} />
    </div>}
  </main>
}
