import { describe, expect, it } from 'vitest'
import { readConfig, validateConfig } from './data/config'
import { deserializeProgress, serializeProgress, storageKey } from './progress-store'
import { canClaim, changeAchievement, claimReward, emptyProgress, maximumXp, rewardLadder, totalXp, type Progress, type Semester } from './quest'

const active: Semester = {
  id: 'test-active',
  name: 'סמסטר פעיל',
  exams: ['math', 'english', 'science', 'hebrew'].map(id => ({ id, subject: id })),
  achievements: [
    { id: 'studied', title: 'למדתי', xp: 10 },
    { id: 'mastery', title: 'שולט היטב', xp: 10 },
    { id: 'excellent', title: 'מצטיין', xp: 5, requires: 'mastery' },
  ],
  rewards: [25, 50, 75, 100].map(xp => ({ id: 'reward-' + xp, title: 'פרס', xp })),
}
const historical = { ...active, id: 'test-historical' }
const semesters = [active, historical]
const firstExam = active.exams[0].id

function earnFullExam(progress: Progress, examId = firstExam) {
  const prepared = changeAchievement(progress, active, examId, 'studied', 'achieved')
  return changeAchievement(prepared, active, examId, 'excellent', 'achieved')
}

describe('achievement rules', () => {
  it('scores zero for pending, failed and empty exams', () => {
    let progress = changeAchievement(emptyProgress(), active, firstExam, 'studied', 'pending')
    progress = changeAchievement(progress, active, firstExam, 'mastery', 'failed')
    expect(totalXp(progress, active)).toBe(0)
    const empty = { ...active, exams: [], rewards: [] }
    expect(maximumXp(empty)).toBe(0)
    expect(totalXp(progress, empty)).toBe(0)
  })

  it('calculates the maximum from the configured exams', () => {
    const progress = active.exams.reduce((earned, exam) => earnFullExam(earned, exam.id), emptyProgress())
    expect(totalXp(progress, active)).toBe(100)
    expect(maximumXp(active)).toBe(100)
    expect(maximumXp({ ...active, exams: [...active.exams, ...active.exams.slice(0, 2)] })).toBe(150)
  })

  it('achieving excellent also achieves mastery without awarding study XP', () => {
    const progress = changeAchievement(emptyProgress(), active, firstExam, 'excellent', 'achieved')
    expect(progress.exams[firstExam]).toEqual({ excellent: 'achieved', mastery: 'achieved' })
    expect(totalXp(progress, active)).toBe(15)
  })

  it.each(['pending', 'failed'] as const)('revokes excellent when mastery changes to %s and keeps study XP', status => {
    const full = earnFullExam(emptyProgress())
    const revoked = changeAchievement(full, active, firstExam, 'mastery', status)
    expect(revoked.exams[firstExam]).toEqual({ excellent: 'pending', mastery: status, studied: 'achieved' })
    expect(totalXp(revoked, active)).toBe(10)
    expect(totalXp(full, active)).toBe(25)
  })
})

describe('rewards', () => {
  it('unlocks at the exact threshold and updates the next goal', () => {
    const [first, second] = active.rewards
    const earned = earnFullExam(emptyProgress())
    expect(rewardLadder(active, 24).next).toEqual(first)
    expect(rewardLadder(active, 25)).toMatchObject({ next: second, milestone: 1, percentage: 0 })
    expect(rewardLadder(active, 100)).toMatchObject({ next: undefined, milestone: 4, percentage: 100 })
    expect(canClaim(earned, first, 25)).toBe(true)
    expect(claimReward(emptyProgress(), active, first.id).claimed).toEqual([])
  })

  it('preserves delivery after XP decreases and never charges XP or adds duplicate claims', () => {
    const reward = active.rewards[0]
    const progress = claimReward(earnFullExam(emptyProgress()), active, reward.id)
    expect(totalXp(progress, active)).toBe(25)
    expect(claimReward(progress, active, reward.id)).toBe(progress)
    const corrected = changeAchievement(progress, active, firstExam, 'mastery', 'failed')
    expect(corrected.claimed).toEqual([reward.id])
    expect(totalXp(corrected, active)).toBe(10)
    expect(rewardLadder(active, 10).milestone).toBe(0)
    expect(deserializeProgress(serializeProgress(corrected), active)).toEqual(corrected)
  })
})

describe('progress persistence', () => {
  it('starts a separate semester at zero and keeps old progress under its key', () => {
    const earned = earnFullExam(emptyProgress())
    const store = new Map([[storageKey(active.id), serializeProgress(earned)]])
    const load = (semester: typeof active) => deserializeProgress(store.get(storageKey(semester.id)) ?? null, semester)
    expect(totalXp(load(historical), historical)).toBe(0)
    expect(totalXp(load(active), active)).toBe(25)
  })

  it('handles malformed and outdated values while retaining valid data', () => {
    for (const value of [null, '{', 'null', '[]']) expect(deserializeProgress(value, active)).toEqual(emptyProgress())
    const value = JSON.stringify({
      exams: { [firstExam]: { studied: 'invalid', excellent: 'achieved', obsolete: 'achieved' }, removed: {} },
      claimed: ['obsolete', active.rewards[0].id, active.rewards[0].id, 123],
    })
    expect(deserializeProgress(value, active)).toEqual({
      exams: { [firstExam]: { excellent: 'achieved', mastery: 'achieved' } },
      claimed: [active.rewards[0].id],
    })
  })
})

describe('configuration validation', () => {
  it('loads the bundled configuration', () => {
    expect(readConfig().semesters.length).toBeGreaterThan(0)
  })

  it('rejects malformed and duplicate IDs', () => {
    expect(() => validateConfig({ activeSemesterId: 'NO!', semesters })).toThrow('מזהה לא תקין')
    expect(() => validateConfig({ activeSemesterId: active.id, semesters: [{ ...active, exams: [active.exams[0], active.exams[0]] }] })).toThrow('מזהה כפול')
  })

  it('rejects cycles and missing prerequisites', () => {
    for (const requires of ['missing', 'excellent']) {
      const achievements = active.achievements.map(item => item.id === 'mastery' ? { ...item, requires } : item)
      expect(() => validateConfig({ activeSemesterId: active.id, semesters: [{ ...active, achievements }] })).toThrow('תלות לא תקינה')
    }
  })

  it('rejects impossible rewards and missing active semesters', () => {
    expect(() => validateConfig({ activeSemesterId: active.id, semesters: [{ ...active, exams: [] }] })).toThrow('רף הפרס גבוה')
    expect(() => validateConfig({ activeSemesterId: 'missing', semesters })).toThrow('הסמסטר הפעיל אינו קיים')
  })
})
