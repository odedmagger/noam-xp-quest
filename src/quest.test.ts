import { describe, expect, it } from 'vitest'
import { readConfig, validateConfig } from './data/config'
import { deserializeProgress, readLegacyBackup, readLegacyProgress, serializeLegacyBackup, serializeProgress, storageKey } from './progress-store'
import { canClaim, changeGrade, changeStudy, claimReward, emptyProgress, examXp, maximumExamXp, maximumXp, rewardLadder, totalXp, type Progress, type Semester } from './quest'

const active: Semester = {
  id: 'test-active',
  name: 'סמסטר פעיל',
  exams: ['math', 'english', 'science', 'hebrew'].map(id => ({ id, subject: id })),
  study: { id: 'studied', title: 'למדתי היטב', xp: 10 },
  grade: readConfig().semesters[0].grade,
  rewards: [25, 50, 75, 100].map(xp => ({ id: 'reward-' + xp, title: 'הישג', xp })),
}
const historical = { ...active, id: 'test-historical' }
const semesters = [active, historical]
const firstExam = active.exams[0].id

function earnFullExam(progress: Progress, examId = firstExam) {
  return changeGrade(changeStudy(progress, active, examId, 'achieved'), active, examId, 'excellent')
}

describe('exam scoring', () => {
  it.each([
    ['excellent', 15], ['mastery', 10], ['competent', 0], ['partial', 0], ['pending', 0],
  ] as const)('awards %s its configured XP independently of study', (grade, xp) => {
    const graded = changeGrade(emptyProgress(), active, firstExam, grade)
    expect(examXp(graded, active, firstExam)).toBe(xp)
    for (const study of ['pending', 'failed', 'achieved'] as const) {
      const progress = changeStudy(graded, active, firstExam, study)
      expect(progress.exams[firstExam]).toEqual({ study, grade })
      expect(examXp(progress, active, firstExam)).toBe(xp + (study === 'achieved' ? 10 : 0))
    }
  })

  it('awards zero for an unrecorded exam or an empty semester', () => {
    expect(examXp(emptyProgress(), active, firstExam)).toBe(0)
    const empty = { ...active, exams: [], rewards: [] }
    expect(maximumXp(empty)).toBe(0)
    expect(totalXp(emptyProgress(), empty)).toBe(0)
  })

  it('calculates the maximum from the configured exams', () => {
    const progress = active.exams.reduce((earned, exam) => earnFullExam(earned, exam.id), emptyProgress())
    expect(maximumExamXp(active)).toBe(25)
    expect(totalXp(progress, active)).toBe(100)
    expect(maximumXp(active)).toBe(100)
    expect(maximumXp({ ...active, exams: [...active.exams, ...active.exams.slice(0, 2)] })).toBe(150)
  })

  it('accepts lower and higher corrections directly and updates the semester total', () => {
    const secondExam = active.exams[1].id
    const full = earnFullExam(earnFullExam(emptyProgress()), secondExam)
    const lower = changeGrade(full, active, firstExam, 'partial')
    expect(lower.exams[firstExam]).toEqual({ study: 'achieved', grade: 'partial' })
    expect(totalXp(lower, active)).toBe(35)
    const higher = changeGrade(lower, active, firstExam, 'mastery')
    expect(totalXp(higher, active)).toBe(45)
    expect(totalXp(full, active)).toBe(50)
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
    const corrected = changeGrade(progress, active, firstExam, 'pending')
    expect(corrected.claimed).toEqual([reward.id])
    expect(totalXp(corrected, active)).toBe(10)
    expect(rewardLadder(active, 10).milestone).toBe(0)
    expect(rewardLadder(active, totalXp(changeGrade(corrected, active, firstExam, 'excellent'), active)).milestone).toBe(1)
    expect(deserializeProgress(serializeProgress(corrected), active)).toEqual(corrected)
  })
})

describe('progress persistence', () => {
  it('keeps the original browser data and round-trips a semester-tagged backup', () => {
    const original = JSON.stringify({
      exams: { [firstExam]: { excellent: 'achieved' }, removed: { studied: 'achieved' } },
      claimed: [active.rewards[0].id, 'removed'],
    })
    const stored = new Map([[storageKey(active.id), original]])
    const storage = { getItem: (key: string) => stored.get(key) ?? null }
    const local = readLegacyProgress(storage, active)!
    const restored = readLegacyBackup(serializeLegacyBackup(active.id, original), active)
    expect(local).toEqual(restored)
    expect(restored.progress).toEqual({
      exams: { [firstExam]: { grade: 'excellent' } },
      claimed: [active.rewards[0].id],
    })
    expect(stored.get(storageKey(active.id))).toBe(original)
    expect(readLegacyProgress(storage, historical)).toBeNull()
  })

  it('rejects invalid backup data and backups for another semester', () => {
    expect(() => readLegacyBackup('{', active)).toThrow()
    expect(() => readLegacyBackup(serializeLegacyBackup(historical.id, '{}'), active)).toThrow('Invalid semester backup')
    expect(() => readLegacyBackup(serializeLegacyBackup(active.id, '{}'), active)).toThrow('Empty semester backup')
  })

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
      exams: { [firstExam]: { grade: 'excellent' } },
      claimed: [active.rewards[0].id],
    })
  })

  it.each([
    [{ mastery: 'achieved', excellent: 'failed' }, 'mastery'],
    [{ mastery: 'failed', excellent: 'achieved' }, 'excellent'],
    [{ mastery: 'achieved', excellent: 'achieved' }, 'excellent'],
    [{ mastery: 'failed', excellent: 'pending' }, 'pending'],
    [{ mastery: 'achieved', excellent: 'achieved', grade: 'pending' }, 'pending'],
    [{ excellent: 'achieved', grade: 'partial' }, 'partial'],
  ])('normalizes legacy grades once while keeping study and claims (%j)', (legacy, grade) => {
    const original = { exams: { [firstExam]: { ...legacy, studied: 'achieved' } }, claimed: [active.rewards[0].id] }
    const normalized = deserializeProgress(JSON.stringify(original), active)
    expect(normalized).toEqual({ exams: { [firstExam]: { study: 'achieved', grade } }, claimed: original.claimed })
    expect(deserializeProgress(serializeProgress(normalized), active)).toEqual(normalized)
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

  it('requires the exact grade IDs, XP values, medals and a separately labeled pending state', () => {
    const [first, ...rest] = active.grade.options
    const validate = (grade: unknown) => validateConfig({ activeSemesterId: active.id, semesters: [{ ...active, grade }] })
    expect(() => validate({ ...active.grade, options: rest })).toThrow('ארבעה ציונים')
    expect(() => validate({ ...active.grade, options: [first, first, ...rest] })).toThrow('מזהה כפול')
    expect(() => validate({ ...active.grade, options: [{ ...first, id: 'pending' }, ...rest] })).toThrow('מזהה ציון')
    expect(() => validate({ ...active.grade, options: [{ ...first, xp: 5 }, ...rest] })).toThrow('נקודות או מדליה')
    expect(() => validate({ ...active.grade, options: [{ ...first, medal: 'bronze' }, ...rest] })).toThrow('נקודות או מדליה')
    expect(() => validate({ ...active.grade, pendingTitle: '' })).toThrow('נדרש טקסט')
    expect(() => validateConfig({ activeSemesterId: active.id, semesters: [{ ...active, study: { ...active.study, xp: 20 } }] }))
      .toThrow('10 נקודות')
  })

  it('rejects impossible rewards and missing active semesters', () => {
    expect(() => validateConfig({ activeSemesterId: active.id, semesters: [{ ...active, exams: [] }] })).toThrow('רף ההישג גבוה')
    expect(() => validateConfig({ activeSemesterId: 'missing', semesters })).toThrow('הסמסטר הפעיל אינו קיים')
  })
})
