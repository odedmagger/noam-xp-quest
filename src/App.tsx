import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, CircleAlert, Pencil, ShieldCheck, Swords, Zap } from 'lucide-react'
import { animate, motion, useReducedMotion } from 'motion/react'
import { readConfig } from './data/config'
import { ExamTable } from './components/ExamTable'
import { RewardLadder } from './components/RewardLadder'
import { ParentControls, useParentControls } from './components/ParentControls'
import { LegacyMigration } from './components/LegacyMigration'
import { getCloudServices } from './cloud/firebase'
import { ProgressConflict, type CloudProgress, type ProgressStore } from './cloud-progress'
import { maximumXp, rewardLadder, totalXp, type Config, type Semester } from './quest'

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
      return { config: readConfig(), services: getCloudServices() }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  })

  if (!setup.config || !setup.services) return <main className="shell main-content">
    <section className="panel error-panel" role="alert">
      <CircleAlert size={24} /><h1>שגיאה בהגדרת המסלול</h1><p><bdi>{setup.error}</bdi></p>
    </section>
  </main>

  return <Dashboard config={setup.config} services={setup.services} />
}

function Dashboard({ config, services }: { config: Config; services: ReturnType<typeof getCloudServices> }) {
  const [semesterId, setSemesterId] = useState(config.activeSemesterId)
  const parent = useParentControls(services.parent)
  const semester = config.semesters.find(item => item.id === semesterId)!
  const active = semesterId === config.activeSemesterId

  return <>
    <header className="site-header">
      <div className="shell header-content">
        <div className="brand"><span className="brand-icon"><Swords size={20} /></span><strong>המסע של נועם</strong></div>
        <div className="header-actions">
          <label className="semester-control">
            <CalendarDays size={16} aria-hidden="true" />
            <select aria-label="בחירת סמסטר" value={semesterId} onChange={event => setSemesterId(event.target.value)}>
              {config.semesters.map(item => <option key={item.id} value={item.id}>
                {item.name}{item.id === config.activeSemesterId ? ' (פעיל)' : ''}
              </option>)}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </label>
          <button className="parent-toggle" type="button" aria-expanded={parent.open} onClick={parent.toggle}>
            {parent.editing ? <ShieldCheck size={16} /> : <Pencil size={16} />} מצב הורה
          </button>
        </div>
      </div>
    </header>
    <main className="shell main-content">
      <div className="welcome">
        <div className="eyebrow"><span /> {active ? 'לוח התקדמות' : 'היסטוריית סמסטרים'}</div>
        <h1>המסע של נועם<span>.</span></h1>
        <p>כל הישג במבחן מקרב אותך לפרס הבא.</p>
      </div>
      <ParentControls controls={parent} />
      <Quest key={semester.id} semester={semester} active={active} parentMode={parent.editing} store={services.progress} />
    </main>
  </>
}

function Quest({ semester, active, parentMode, store }: {
  semester: Semester
  active: boolean
  parentMode: boolean
  store: ProgressStore
}) {
  const [snapshot, setSnapshot] = useState<CloudProgress | null>(null)
  const [connection, setConnection] = useState<'loading' | 'waiting' | 'synced' | 'error'>('loading')
  const [listenAttempt, setListenAttempt] = useState(0)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const saving = useRef(false)
  const reducedMotion = useReducedMotion()

  useEffect(() => store.subscribe(semester, event => {
    setConnection(event.kind)
    if (event.kind === 'synced') setSnapshot(event.value)
  }), [semester, store, listenAttempt])

  useEffect(() => {
    if (!parentMode) setConfirmReset(false)
  }, [parentMode])

  async function save(action: () => Promise<void>) {
    if (!canWrite || saving.current) return false
    saving.current = true
    setSaveState('saving')
    setSaveError('')
    try {
      await action()
      setSaveState('saved')
      return true
    } catch (error) {
      setSaveState('error')
      if (error instanceof ProgressConflict) {
        setSaveError(error.reason === 'existing-progress'
          ? 'כבר יש נתונים בענן. העותק המקומי נשמר ואפשר להוריד גיבוי.'
          : 'הפרס כבר לא זמין לפי הנקודות העדכניות.')
      } else {
        setSaveError('השינוי לא נשמר בענן. בדקו את החיבור וההרשאה ונסו שוב.')
      }
      return false
    } finally {
      saving.current = false
    }
  }

  const progress = snapshot?.progress
  const cloudEditable = parentMode && connection === 'synced' && !!snapshot
  const canWrite = cloudEditable && saveState !== 'saving'
  const editable = active && cloudEditable && !confirmReset
  const xp = progress ? totalXp(progress, semester) : 0
  const max = maximumXp(semester)
  const ladder = rewardLadder(semester, xp)

  return <>
    {connection === 'loading' && <p role="status" className="banner">טוען התקדמות מהענן…</p>}
    {connection === 'waiting' && <p role="status" className="banner">
      {snapshot ? 'ממתין לחיבור לענן. מוצגת ההתקדמות האחרונה שאושרה.' : 'ממתין לחיבור לענן כדי לטעון התקדמות.'}
    </p>}
    {connection === 'error' && <div className="banner parent-banner error">
      <span role="alert"><CircleAlert size={18} /> לא ניתן לקרוא התקדמות עדכנית מהענן.</span>
      <button type="button" onClick={() => {
        setConnection('loading')
        setListenAttempt(value => value + 1)
      }}>ניסיון חוזר</button>
    </div>}
    {parentMode && active && <div className="banner edit-banner">
      <span><Pencil size={16} />בחרו סטטוס בתא של הישג או סמנו פרס שנמסר. השינויים נשמרים אוטומטית.</span>
      {!confirmReset && <button type="button" onClick={() => setConfirmReset(true)} disabled={!canWrite}>איפוס סמסטר</button>}
    </div>}
    {parentMode && active && confirmReset && <div className="banner edit-banner error" role="group" aria-label="אישור איפוס סמסטר">
      <span>לאפס את ההישגים ואת רישום הפרסים של הסמסטר הזה?</span>
      <div className="reset-actions">
        <button type="button" autoFocus onClick={() => setConfirmReset(false)}>ביטול</button>
        <button type="button" disabled={!canWrite} onClick={() => {
          setConfirmReset(false)
          void save(() => store.reset(semester))
        }}>כן, לאפס</button>
      </div>
    </div>}
    {parentMode && <>
      {saveState === 'saving' && <p className="banner" role="status">שומר בענן…</p>}
      {saveState === 'saved' && <p className="banner" role="status">השינוי נשמר בענן.</p>}
      {saveError && <p className="banner error" role="alert">{saveError}</p>}
      <LegacyMigration semester={semester} snapshot={snapshot} enabled={canWrite && !confirmReset}
        onImport={legacy => save(() => store.importLegacy(semester, legacy))} />
    </>}
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
        <ExamTable semester={semester} progress={progress} editable={editable} saving={saveState === 'saving'}
          onChange={(exam, achievement, status) => { void save(() => store.updateAchievement(semester, exam, achievement, status)) }} />
      </div>
      <RewardLadder ladder={ladder} progress={progress} xp={xp} editable={editable && canWrite}
        onClaim={id => { void save(() => store.claimReward(semester, id)) }} />
    </div>}
  </>
}
