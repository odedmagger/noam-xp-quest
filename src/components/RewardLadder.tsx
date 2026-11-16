import { Check, Film, Gamepad2, Gift, LockKeyhole, Trophy } from 'lucide-react'
import { canClaim, type Progress, type rewardLadder } from '../quest'

const icons = { gift: Gift, game: Gamepad2, film: Film, trophy: Trophy }

export function RewardLadder({ ladder, progress, xp, editable, onClaim }: {
  ladder: ReturnType<typeof rewardLadder>
  progress: Progress
  xp: number
  editable: boolean
  onClaim: (id: string) => void
}) {
  return <aside className="panel reward-panel" aria-labelledby="rewards-title">
    <div className="section-heading">
      <span className="section-icon gold"><Trophy size={21} /></span>
      <div><h2 id="rewards-title">מסלול הפרסים</h2><p>{ladder.milestone} מתוך {ladder.ordered.length} אבני דרך הושגו</p></div>
    </div>
    {ladder.ordered.length ? <ol className="reward-list">
      {ladder.ordered.map(reward => {
        const Icon = icons[reward.icon as keyof typeof icons] ?? Gift
        const claimed = progress.claimed.includes(reward.id)
        const unlocked = xp >= reward.xp
        const next = reward.id === ladder.next?.id
        const label = claimed ? 'נמסר' : unlocked ? 'נפתח' : next ? 'היעד הבא' : 'נעול'
        return <li className={next ? 'next' : unlocked ? 'unlocked' : ''} key={reward.id}>
          <span className="reward-marker" aria-hidden="true">
            {claimed ? <Check size={18} /> : unlocked || next ? <Icon size={19} /> : <LockKeyhole size={16} />}
          </span>
          <div className="reward-info">
            <div className="reward-meta"><bdi dir="ltr">{reward.xp} XP</bdi><span className="reward-state">{label}</span></div>
            <strong>{reward.title}</strong>
            {reward.description && <small>{reward.description}</small>}
            {claimed && !unlocked && <small className="below-threshold">נמסר בעבר. ה־XP כרגע מתחת לרף.</small>}
            {editable && canClaim(progress, reward, xp) && <button className="claim-button" type="button"
              onClick={() => onClaim(reward.id)} aria-label={'סימון כנמסר: ' + reward.title}>סימון כנמסר</button>}
          </div>
        </li>
      })}
    </ol> : <p className="empty">עדיין לא הוגדרו פרסים.</p>}
    <p className="reward-footer">מסלול חדש מתחיל בכל סמסטר.</p>
  </aside>
}
