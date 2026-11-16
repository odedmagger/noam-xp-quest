import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { readConfig } from '../data/config'
import { emptyProgress, rewardLadder } from '../quest'
import { ExamTable } from './ExamTable'
import { RewardLadder } from './RewardLadder'

const config = readConfig()
const semester = config.semesters.find(item => item.id === config.activeSemesterId)!
const progress = emptyProgress()

describe('student dashboard controls', () => {
  it('offers all three status options inline and keeps historical rows read-only', () => {
    const active = renderToStaticMarkup(<ExamTable semester={semester} progress={progress} editable saving={false} onChange={vi.fn()} />)
    const historical = renderToStaticMarkup(<ExamTable semester={semester} progress={progress} editable={false} saving={false} onChange={vi.fn()} />)
    expect(active.match(/<select /g)).toHaveLength(semester.exams.length * semester.achievements.length)
    for (const status of ['pending', 'achieved', 'failed']) expect(active).toContain('value="' + status + '"')
    expect(historical).not.toContain('<select')
    expect(historical).toContain('ממתין')
  })

  it('keeps status controls mounted while a save is pending', () => {
    const saving = renderToStaticMarkup(<ExamTable semester={semester} progress={progress} editable saving onChange={vi.fn()} />)
    expect(saving).toContain('aria-disabled="true"')
    expect(saving).toContain('<select')
  })

  it('shows a claim action only for eligible unclaimed rewards in the active view', () => {
    const reward = [...semester.rewards].sort((a, b) => a.xp - b.xp)[0]
    const render = (xp: number, editable: boolean, claimed: string[]) => renderToStaticMarkup(<RewardLadder
      ladder={rewardLadder(semester, xp)} progress={{ ...progress, claimed }} xp={xp}
      editable={editable} saving={false} onClaim={vi.fn()} />)
    expect(render(0, true, [])).not.toContain('claim-button')
    expect(render(reward.xp, true, [])).toContain('claim-button')
    expect(render(reward.xp, false, [])).not.toContain('claim-button')
    const delivered = render(0, true, [reward.id])
    expect(delivered).not.toContain('claim-button')
    expect(delivered).toContain('נמסר בעבר')
  })
})
