import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { readConfig } from '../data/config'
import { emptyProgress, rewardLadder, type Progress } from '../quest'
import { ExamTable } from './ExamTable'
import { RewardLadder } from './RewardLadder'

const config = readConfig()
const semester = config.semesters.find(item => item.id === config.activeSemesterId)!
const progress = emptyProgress()
const callbacks = { onStudyChange: vi.fn(), onGradeChange: vi.fn() }

function renderExams(outcomes: Progress, editable = true, saving = false) {
  return renderToStaticMarkup(<ExamTable semester={semester} progress={outcomes} editable={editable} saving={saving} {...callbacks} />)
}

describe('student dashboard controls', () => {
  it('shows exams by ascending date and keeps tied and undated exams in configuration order', () => {
    const exams = [
      { id: 'no-date-first', subject: 'Undated first' },
      { id: 'later', subject: 'Later', date: '2027-01-01' },
      { id: 'early-first', subject: 'Early first', date: '2026-12-31' },
      { id: 'no-date-second', subject: 'Undated second' },
      { id: 'early-second', subject: 'Early second', date: '2026-12-31' },
    ]
    const markup = renderToStaticMarkup(<ExamTable semester={{ ...semester, exams }} progress={progress}
      editable={false} saving={false} {...callbacks} />)
    const subjects = [...markup.matchAll(/<strong>([^<]+)<\/strong>/g)].map(match => match[1])
    expect(subjects).toEqual(['Early first', 'Early second', 'Later', 'Undated first', 'Undated second'])
    expect(exams.map(exam => exam.id)).toEqual(['no-date-first', 'later', 'early-first', 'no-date-second', 'early-second'])
  })

  it('offers two controls per exam with all study and grade options available', () => {
    const active = renderExams(progress)
    const historical = renderExams(progress, false)
    const selects = active.match(/<select .*?<\/select>/g) ?? []
    expect(selects).toHaveLength(semester.exams.length * 2)
    for (const [index, select] of selects.entries()) {
      const values = [...select.matchAll(/<option value="([^"]+)"/g)].map(match => match[1])
      expect(values).toEqual(index % 2 ? ['pending', ...semester.grade.options.map(option => option.id)] : ['pending', 'achieved', 'failed'])
      expect(select).toMatch(/<option value="pending"[^>]*>ממתין<\/option>/)
    }
    expect(historical).not.toContain('<select')
    expect(historical).toContain('<span class="status grade-control"><span>ממתין</span></span>')
    expect(historical).not.toContain('grade-medal')
    expect(active).toContain('ציון<span class="column-xp" dir="ltr" lang="en">Up to 15 XP</span>')
  })

  it.each(semester.grade.options)('shows the $medal medal alongside the grade $title', option => {
    const outcomes = { exams: { [semester.exams[0].id]: { grade: option.id } }, claimed: [] }
    const historical = renderExams(outcomes, false)
    expect(historical).toContain('grade-medal ' + option.medal)
    expect(historical).toContain('<span>' + option.title + '</span>')
  })

  it('keeps status controls mounted while a save is pending', () => {
    const saving = renderExams(progress, true, true)
    expect(saving).toContain('aria-disabled="true"')
    expect(saving).toContain('<select')
  })

  it('shows a claim action only for eligible unclaimed rewards in the active view', () => {
    const reward = [...semester.rewards].sort((a, b) => a.xp - b.xp)[0]
    const render = (xp: number, editable: boolean, claimed: string[]) => renderToStaticMarkup(<RewardLadder
      ladder={rewardLadder(semester, xp)} progress={{ ...progress, claimed }} xp={xp}
      editable={editable} saving={false} onClaim={vi.fn()} />)
    const initial = render(0, true, [])
    expect(initial).toContain('מסלול ההישגים')
    expect(initial).toContain('רמות הושגו')
    expect(initial).not.toContain('claim-button')
    expect(render(reward.xp, true, [])).toContain('claim-button')
    expect(render(reward.xp, false, [])).not.toContain('claim-button')
    const delivered = render(0, true, [reward.id])
    expect(delivered).not.toContain('claim-button')
    expect(delivered).toContain('נמסר בעבר')
  })
})
