import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, CircleAlert, Swords, Zap } from 'lucide-react'
import { animate, motion, useReducedMotion } from 'motion/react'
import { readConfig } from './data/config'
import { ExamTable } from './components/ExamTable'
import { RewardLadder } from './components/RewardLadder'
import { LegacyMigration } from './components/LegacyMigration'
import { getCloudServices } from './cloud/firebase'
import { ProgressConflict, type CloudProgress, type ProgressStore } from './cloud-progress'
import { changeGrade, changeStudy, claimReward, maximumXp, rewardLadder, totalXp, type Config, type Progress, type Semester } from './quest'

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
      return { config: readConfig(), store: getCloudServices() }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  })

  if (!setup.config || !setup.store) return <main className="shell main-content">
    <section className="panel error-panel" role="alert">
      <CircleAlert size={24} /><h1>שגיאה בהגדרת המסלול</h1><p><bdi>{setup.error}</bdi></p>
    </section>
  </main>

  return <Dashboard config={setup.config} store={setup.store} />
}

function Dashboard({ config, store }: { config: Config; store: ProgressStore }) {
  const [semesterId, setSemesterId] = useState(config.activeSemesterId)
  const semester = config.semesters.find(item => item.id === semesterId)!
  const active = semesterId === config.activeSemesterId

  return <>
    <header className="site-header">
      <div className="shell header-content">
        <div className="brand"><span className="brand-icon"><Swords size={20} /></span><strong>המסע של נועם</strong></div>
        <label className="semester-control">
          <CalendarDays size={16} aria-hidden="true" />
          <select aria-label="בחירת סמסטר" value={semesterId} onChange={event => setSemesterId(event.target.value)}>
            {config.semesters.map(item => <option key={item.id} value={item.id}>
              {item.name}{item.id === config.activeSemesterId ? ' (פעיל)' : ''}
            </option>)}
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </label>
      </div>
    </header>
    <main className="shell main-content">
      <div className="welcome">
        <div className="eyebrow"><span /> {active ? 'לוח התקדמות' : 'היסטוריית סמסטרים'}</div>
        <h1>המסע של נועם<span>.</span></h1>
        <p>כל הישג במבחן מקרב אותך לפרס הבא.</p>
      </div>
      <Quest key={semester.id} semester={semester} active={active} store={store} />
    </main>
  </>
}

type SaveAction = {
  run: () => Promise<CloudProgress>
  preview?: (progress: Progress) => Progress
}

type SaveState =
  | { kind: 'idle' | 'saved' }
  | { kind: 'saving'; progress: Progress }
  | { kind: 'error'; message: string; retry?: SaveAction }

function Quest({ semester, active, store }: { semester: Semester; active: boolean; store: ProgressStore }) {
  const [snapshot, setSnapshot] = useState<CloudProgress | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const saving = useRef(false)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    let current = true
    void store.load(semester).then(value => {
      if (current) setSnapshot(value)
    }).catch(() => {
      if (current) setLoadFailed(true)
    })
    return () => { current = false }
  }, [semester, store, loadAttempt])

  async function save(action: SaveAction) {
    if (!active || !snapshot || saving.current) return false
    const progress = action.preview?.(snapshot.progress) ?? snapshot.progress
    if (action.preview && progress === snapshot.progress) return false
    saving.current = true
    setSaveState({ kind: 'saving', progress })
    try {
      setSnapshot(await action.run())
      setSaveState({ kind: 'saved' })
      return true
    } catch (error) {
      if (error instanceof ProgressConflict) {
        setSnapshot(error.current)
        const message = error.reason === 'existing-progress'
          ? 'כבר יש נתונים בענן. העותק המקומי נשמר ואפשר להוריד גיבוי.'
          : 'הפרס כבר לא זמין לפי הנקודות העדכניות.'
        setSaveState({ kind: 'error', message })
      } else {
        setSaveState({ kind: 'error', message: 'השינוי לא נשמר. אפשר לבדוק את החיבור ולנסות שוב.', retry: action })
      }
      return false
    } finally {
      saving.current = false
    }
  }

  const isSaving = saveState.kind === 'saving'
  const progress = isSaving ? saveState.progress : snapshot?.progress
  const retry = saveState.kind === 'error' ? saveState.retry : undefined
  const editable = active && !!snapshot
  const xp = progress ? totalXp(progress, semester) : 0
  const max = maximumXp(semester)
  const ladder = rewardLadder(semester, xp)

  return <>
    {!snapshot && !loadFailed && <p role="status" className="banner">טוען התקדמות מהענן…</p>}
    {loadFailed && <div className="banner action-banner error">
      <span role="alert"><CircleAlert size={18} /> לא ניתן לטעון את ההתקדמות מהענן.</span>
      <button type="button" onClick={() => {
        setLoadFailed(false)
        setLoadAttempt(value => value + 1)
      }}>ניסיון חוזר</button>
    </div>}
    {active && snapshot && <div className="save-feedback" role="status">
      {saveState.kind === 'saving' ? 'שומר בענן…' : saveState.kind === 'saved' ? 'השינוי נשמר בענן.' : null}
    </div>}
    {saveState.kind === 'error' && <div className="banner action-banner error">
      <span role="alert">{saveState.message}</span>
      {retry && <button type="button" onClick={() => { void save(retry) }}>ניסיון חוזר</button>}
    </div>}
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
        <ExamTable semester={semester} progress={progress} editable={editable} saving={isSaving}
          onStudyChange={(exam, status) => {
            void save({
              preview: value => changeStudy(value, semester, exam, status),
              run: () => store.updateStudy(semester, exam, status),
            })
          }}
          onGradeChange={(exam, grade) => {
            void save({
              preview: value => changeGrade(value, semester, exam, grade),
              run: () => store.updateGrade(semester, exam, grade),
            })
          }} />
      </div>
      <RewardLadder ladder={ladder} progress={progress} xp={xp} editable={editable} saving={isSaving}
        onClaim={id => {
          void save({
            preview: value => claimReward(value, semester, id),
            run: () => store.claimReward(semester, id),
          })
        }} />
    </div>}
    {snapshot && <LegacyMigration semester={semester} snapshot={snapshot} importAllowed={active} enabled={!isSaving}
      onImport={legacy => save({ run: () => store.importLegacy(semester, legacy) })} />}
  </>
}
