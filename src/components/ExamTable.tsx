import { BookOpen, Check, ChevronDown, Circle, FlaskConical, Languages, ListChecks, Medal, Sigma, Target, X } from 'lucide-react'
import { examXp, isGrade, isStatus, maximumExamXp, maximumGradeXp, type Grade, type Progress, type Semester, type Status } from '../quest'

const examIcons = { math: Sigma, language: Languages, science: FlaskConical, book: BookOpen }
const statuses = {
  pending: { label: 'ממתין', icon: Circle },
  achieved: { label: 'הושג', icon: Check },
  failed: { label: 'לא הושג', icon: X },
}

export function ExamTable({ semester, progress, editable, saving, onStudyChange, onGradeChange }: {
  semester: Semester
  progress: Progress
  editable: boolean
  saving: boolean
  onStudyChange: (examId: string, status: Status) => void
  onGradeChange: (examId: string, grade: Grade) => void
}) {
  const { study, grade } = semester
  const exams = [...semester.exams].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date)
    if (a.date === b.date) return 0
    return a.date ? -1 : 1
  })

  return <section className="panel exams-panel" aria-labelledby="exams-title">
    <div className="section-heading">
      <span className="section-icon blue"><ListChecks size={21} /></span>
      <div><h2 id="exams-title">משימות המבחנים</h2><p>למידה וציון בכל מבחן</p></div>
    </div>
    {exams.length ? <table aria-label="הישגים במבחנים">
      <thead><tr>
        <th scope="col">מבחן</th>
        <th scope="col">{study.title}<span className="column-xp" dir="ltr">+{study.xp} XP</span></th>
        <th scope="col">{grade.title}<span className="column-xp" dir="ltr" lang="en">Up to {maximumGradeXp(grade)} XP</span></th>
        <th scope="col" className="total-cell">סה״כ</th>
      </tr></thead>
      <tbody>{exams.map(exam => {
        const Icon = examIcons[exam.icon as keyof typeof examIcons] ?? BookOpen
        const score = examXp(progress, semester, exam.id)
        const status = progress.exams[exam.id]?.study ?? 'pending'
        const { icon: StatusIcon, label: statusLabel } = statuses[status]
        const studyContent = <><StatusIcon size={14} aria-hidden="true" /><span>{statusLabel}</span></>
        const selected = grade.options.find(option => option.id === progress.exams[exam.id]?.grade)
        const gradeContent = <>
          {selected && <Medal size={17} className={'grade-medal ' + selected.medal} aria-hidden="true" />}
          <span>{selected?.title ?? grade.pendingTitle}</span>
        </>
        const controlName = (title: string) => [exam.subject, exam.title, title].filter(Boolean).join(' – ')
        return <tr key={exam.id}>
          <th scope="row"><div className="exam-name">
            <span className={'exam-icon ' + (exam.icon ?? '')}><Icon size={17} /></span>
            <span><strong>{exam.subject}</strong>{exam.title && <small>{exam.title}</small>}
              {exam.date && <time dateTime={exam.date} dir="ltr">{exam.date.split('-').reverse().join('.')}</time>}
            </span>
          </div></th>
          <td data-title={study.title}>
            {editable ? <label className={'status editable ' + status}>
              <span className="status-content" key={status} aria-hidden="true">{studyContent}</span>
              <ChevronDown size={12} aria-hidden="true" />
              <select value={status} aria-label={controlName(study.title)} aria-disabled={saving}
                onChange={event => {
                  const value = event.target.value
                  if (!saving && isStatus(value)) onStudyChange(exam.id, value)
                }}>
                {Object.entries(statuses).map(([value, { label }]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label> : <span className={'status ' + status}>{studyContent}</span>}
          </td>
          <td data-title={grade.title}>
            {editable ? <label className="status grade-control editable">
              <span className="status-content" key={selected?.id} aria-hidden="true">{gradeContent}</span>
              <ChevronDown size={12} aria-hidden="true" />
              <select value={selected?.id ?? 'pending'} aria-label={controlName(grade.title)} aria-disabled={saving}
                onChange={event => {
                  const value = event.target.value
                  if (!saving && isGrade(value)) onGradeChange(exam.id, value)
                }}>
                <option value="pending">{grade.pendingTitle}</option>
                {grade.options.map(option => <option value={option.id} key={option.id}>{option.title}</option>)}
              </select>
            </label> : <span className="status grade-control">{gradeContent}</span>}
          </td>
          <td className={'total-cell ' + (score ? 'scored' : '')} data-title="סה״כ"><bdi dir="ltr">{score} XP</bdi></td>
        </tr>
      })}</tbody>
    </table> : <p className="empty">עדיין לא הוגדרו מבחנים לסמסטר הזה.</p>}
    <div className="table-footer"><Target size={15} /><span>עד <bdi dir="ltr">{maximumExamXp(semester)} XP</bdi> בכל מבחן</span></div>
  </section>
}
