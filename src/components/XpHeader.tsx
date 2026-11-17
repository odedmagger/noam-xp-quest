import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Sparkles, Zap } from 'lucide-react'
import { animate, motion, useReducedMotion } from 'motion/react'
import type { Reward } from '../quest'
import { advanceLevel, retargetLevel, startLevelProgress } from './level-progress'

const fillDuration = 0.36
const celebrationDuration = 1450
const reducedCelebrationDuration = 850
const burstAngles = Array.from({ length: 24 }, (_, index) => index * 15)
const confettiPieces = Array.from({ length: 18 }, (_, index) => ({
  position: 4 + index * 5.35 + (index % 3 - 1) * 1.6,
  delay: 80 + (index * 53) % 280,
  drift: (index % 5 - 2) * 12,
}))

function XpCount({ xp, reducedMotion, fromZero }: { xp: number; reducedMotion: boolean; fromZero: boolean }) {
  const [display, setDisplay] = useState(fromZero ? 0 : xp)
  const current = useRef(display)

  useEffect(() => {
    if (reducedMotion || current.current === xp) return
    const animation = animate(current.current, xp, {
      duration: fillDuration,
      onUpdate: value => {
        current.current = value
        setDisplay(Math.round(value))
      },
    })
    return () => animation.stop()
  }, [xp, reducedMotion])

  return <>{reducedMotion ? xp : display}</>
}

export function XpHeader({ xp, confirmedXp, maxXp, levels }: {
  xp: number
  confirmedXp: number
  maxXp: number
  levels: Reward[]
}) {
  const reducedMotion = Boolean(useReducedMotion())
  const confirmedLevel = levels.filter(level => level.xp <= confirmedXp).length
  const [sequence, setSequence] = useState(() => startLevelProgress(confirmedLevel))
  if (sequence.target !== confirmedLevel) setSequence(retargetLevel(sequence, confirmedLevel))

  const { level, phase } = sequence
  const next = levels[level]
  const reachedLevel = next ? levels.filter(target => target.xp <= next.xp).length : level
  const lowerBound = levels[level - 1]?.xp ?? 0
  const goal = next ? next.xp - lowerBound : 0
  const earned = next ? phase === 'progress' ? Math.max(0, confirmedXp - lowerBound) : goal : 0
  const percent = next ? Math.min(100, earned / goal * 100) : 100
  const celebrating = phase === 'celebrate'
  const displayedLevel = celebrating ? reachedLevel : level

  useEffect(() => {
    if (phase === 'progress') return
    const delay = phase === 'fill'
      ? (reducedMotion ? 0 : fillDuration * 1000 + 50)
      : (reducedMotion ? reducedCelebrationDuration : celebrationDuration)
    const timer = window.setTimeout(() => setSequence(current => advanceLevel(current, reachedLevel)), delay)
    return () => window.clearTimeout(timer)
  }, [phase, level, reachedLevel, reducedMotion])

  return <section className="hero" aria-labelledby="xp-title" data-level-up={celebrating || undefined}>
    <div className="hero-art" aria-hidden="true"><div className="art-grid" /></div>
    {celebrating && !reducedMotion && <div className="level-fanfare" aria-hidden="true">
      {confettiPieces.map(({ position, delay, drift }) => (
        <span className="level-confetti" key={position} style={{
          left: position + '%',
          animationDelay: delay + 'ms',
          '--confetti-drift': drift + 'px',
        } as CSSProperties} />
      ))}
    </div>}
    <div className="hero-content">
      <div className="hero-label">
        <h2 id="xp-title"><Zap size={16} fill="currentColor" /> התקדמות לרמה הבאה</h2>
        <span className="xp-total">סה״כ בסמסטר <bdi dir="ltr"><strong>{xp}</strong> / {maxXp} XP</bdi></span>
      </div>
      {levels.length > 0 && <>
        <div className="level-meter-label">
          {next ? <>
            <div className="xp-value" dir="ltr">
              <strong aria-hidden="true"><XpCount key={level} xp={earned} reducedMotion={reducedMotion} fromZero={sequence.resetBar} /></strong>
              <span aria-hidden="true">/ {goal} XP</span>
            </div>
            <span className="level-target">לרמה {reachedLevel}</span>
          </> : <p className="level-complete">הגעת לרמה הגבוהה ביותר!</p>}
        </div>
        <div className="xp-track" role="progressbar" aria-label="התקדמות לרמה הבאה"
          aria-valuenow={Math.round(percent)}
          aria-valuetext={next ? earned + ' מתוך ' + goal + ' נקודות לרמה ' + reachedLevel : 'כל הרמות הושגו'}>
          <motion.div key={level} initial={next && sequence.resetBar && !reducedMotion ? { width: 0 } : false}
            animate={{ width: percent + '%' }} transition={{ duration: reducedMotion ? 0 : fillDuration, ease: 'easeOut' }} />
        </div>
      </>}
      <div className="level-feedback" role="status">
        {celebrating ? <span className="level-celebration"><Sparkles size={16} aria-hidden="true" /> עלית לרמה {reachedLevel}!</span>
          : levels.length === 0 ? <span>עדיין לא הוגדרו רמות.</span> : null}
      </div>
    </div>
    <div className={'hero-level' + (celebrating ? ' celebrating' : '')} aria-label={'רמה נוכחית ' + displayedLevel}>
      <div className="level-emblem">
        <Zap size={19} fill="currentColor" aria-hidden="true" />
        <span>רמה</span>
        <strong>{displayedLevel}</strong>
      </div>
      {celebrating && !reducedMotion && <div className="level-burst" aria-hidden="true">
        {burstAngles.map(angle => <span className="level-particle" key={angle}
          style={{ '--spark-angle': angle + 'deg' } as CSSProperties} />)}
      </div>}
      <span className="spark spark-top" aria-hidden="true">✦</span>
      <span className="spark spark-bottom" aria-hidden="true">✦</span>
    </div>
  </section>
}
