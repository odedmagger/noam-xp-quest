import { BookOpen, Check, ChevronDown, Circle, FlaskConical, Languages, ListChecks, Sigma, Target, X } from 'lucide-react'
import { examXp, type Progress, type Semester, type Status } from '../quest'

const examIcons = { math: Sigma, language: Languages, science: FlaskConical, book: BookOpen }
const statuses = {
  pending: { label: 'ממתין', icon: Circle },
  achieved: { label: 'הושג', icon: Check },
  failed: { label: 'לא הושג', icon: X },
}

export function ExamTable({ semester, progress, editable, onChange }: {
  semester: Semester
  progress: Progress
  editable: boolean
  onChange: (examId: string, achievementId: string, status: Status) => void
}) {
  return <section className="panel exams-panel" aria-labelledby="exams-title">
    <div className="section-heading">
      <span className="section-icon blue"><ListChecks size={21} /></span>
      <div><h2 id="exams-title">משימות המבחנים</h2><p>שלושה הישגים בכל מבחן</p></div>
    </div>
    {semester.exams.length ? <table aria-label="הישגים במבחנים">
      <thead><tr>
        <th scope="col">מבחן</th>
        {semester.achievements.map(item => <th scope="col" key={item.id}>
          {item.title}<span className="column-xp" dir="ltr">+{item.xp} XP</span>
        </th>)}
        <th scope="col" className="total-cell">סה״כ</th>
      </tr></thead>
      <tbody>{semester.exams.map(exam => {
        const Icon = examIcons[exam.icon as keyof typeof examIcons] ?? BookOpen
        const score = examXp(progress, semester, exam.id)
        return <tr key={exam.id}>
          <th scope="row"><div className="exam-name">
            <span className={'exam-icon ' + (exam.icon ?? '')}><Icon size={17} /></span>
            <span><strong>{exam.subject}</strong>{exam.title && <small>{exam.title}</small>}
              {exam.date && <time dateTime={exam.date} dir="ltr">{exam.date.split('-').reverse().join('.')}</time>}
            </span>
          </div></th>
          {semester.achievements.map(item => {
            const status = progress.exams[exam.id]?.[item.id] ?? 'pending'
            const { icon: StatusIcon, label } = statuses[status]
            const content = <><StatusIcon size={14} aria-hidden="true" /><span>{label}</span></>
            return <td key={item.id} data-title={item.title}>
              {editable ? <label className={'status editable ' + status}>
                <span className="status-content" key={status} aria-hidden="true">{content}</span>
                <ChevronDown size={12} aria-hidden="true" />
                <select value={status} aria-label={[exam.subject, exam.title, item.title].filter(Boolean).join(' – ')}
                  onChange={event => onChange(exam.id, item.id, event.target.value as Status)}>
                  {(Object.keys(statuses) as Status[]).map(option =>
                    <option value={option} key={option}>{statuses[option].label}</option>)}
                </select>
              </label> : <span className={'status ' + status}>{content}</span>}
            </td>
          })}
          <td className={'total-cell ' + (score ? 'scored' : '')} data-title="סה״כ"><bdi dir="ltr">{score} XP</bdi></td>
        </tr>
      })}</tbody>
    </table> : <p className="empty">עדיין לא הוגדרו מבחנים לסמסטר הזה.</p>}
    <div className="table-footer"><Target size={15} /><span>עד <bdi dir="ltr">{semester.achievements.reduce((sum, item) => sum + item.xp, 0)} XP</bdi> בכל מבחן</span></div>
  </section>
}
