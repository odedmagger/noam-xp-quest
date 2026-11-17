import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestContext, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, disableNetwork, doc, enableNetwork, getDoc, getDocs, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createFirestoreStore } from '../../src/cloud/firestore-store'
import { ProgressConflict } from '../../src/cloud-progress'
import { readConfig } from '../../src/data/config'
import { currentStudent } from '../../src/data/student'
import { changeGrade, emptyProgress, totalXp } from '../../src/quest'

const projectId = 'demo-noam-xp-quest'
const config = readConfig()
const semester = config.semesters.find(item => item.id === config.activeSemesterId)!
const historical = config.semesters.find(item => item.id !== config.activeSemesterId)!
const examId = semester.exams[0].id
const firstReward = [...semester.rewards].sort((a, b) => a.xp - b.xp)[0]
const semesterPath = currentStudent.semesterCollection
let env: RulesTestEnvironment

beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') {
    throw new Error('Start the loopback test emulator with npm run test:emulator.')
  }
  env = await initializeTestEnvironment({
    projectId,
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') },
  })
})

beforeEach(async () => { await env.clearFirestore() })
afterAll(async () => { await env?.cleanup() })

// Modular SDK calls accept the compat client supplied by rules-unit-testing.
function firestore(context: RulesTestContext) {
  return context.firestore() as unknown as Firestore
}

const guest = () => firestore(env.unauthenticatedContext())
const store = (db = guest()) => createFirestoreStore(collection(db, semesterPath))

function validData() {
  return { schemaVersion: 1, statuses: { [examId + ':studied']: 'achieved' }, claims: {}, updatedAt: serverTimestamp() }
}

function gradeData() {
  return { ...validData(), schemaVersion: 2, grades: { [examId]: 'excellent' } }
}

async function seed(id: string, data: object) {
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), semesterPath, id), data))
}

describe('Firestore Security Rules', () => {
  it('allows an unauthenticated client to create, read and update active semester progress and claims', async () => {
    const ref = doc(guest(), semesterPath, semester.id)
    expect((await assertSucceeds(getDoc(ref))).exists()).toBe(false)
    await assertSucceeds(setDoc(ref, validData()))
    await assertSucceeds(setDoc(ref, {
      ...validData(), statuses: { [examId + ':studied']: 'failed' }, claims: { [firstReward.id]: true },
    }))
    expect((await assertSucceeds(getDoc(ref))).data()?.claims).toEqual({ [firstReward.id]: true })
  })

  it('allows historical reads and prevents writes to history and unknown semester IDs', async () => {
    const db = guest()
    const old = doc(db, semesterPath, historical.id)
    await assertFails(setDoc(old, validData()))
    await seed(historical.id, validData())
    expect((await assertSucceeds(getDoc(old))).exists()).toBe(true)
    await assertFails(setDoc(old, validData()))
    const unknown = doc(db, semesterPath, 'unconfigured')
    await assertFails(getDoc(unknown))
    await assertFails(setDoc(unknown, validData()))
  })

  it('denies listing, account records and unrelated or nested collections', async () => {
    const db = guest()
    await assertFails(getDocs(collection(db, semesterPath)))
    for (const ref of [
      doc(db, 'accounts', 'someone'),
      doc(db, 'parents', 'obsolete'),
      doc(db, semesterPath, semester.id, 'private', 'note'),
    ]) {
      await assertFails(getDoc(ref))
      await assertFails(setDoc(ref, validData()))
    }
  })

  it('rejects malformed documents, unexpected fields, unknown keys and client timestamps', async () => {
    const ref = doc(guest(), semesterPath, semester.id)
    for (const data of [
      { ...validData(), statuses: { [examId + ':studied']: 'yes' } },
      { ...validData(), statuses: { [examId + ':studied']: { status: 'achieved' } } },
      { ...validData(), statuses: { 'unknown:studied': 'achieved' } },
      { ...validData(), claims: { [firstReward.id]: false } },
      { ...validData(), claims: { unknown: true } },
      { ...validData(), statuses: [] },
      { ...validData(), schemaVersion: 2 },
      { ...validData(), grades: {} },
      { ...gradeData(), grades: [] },
      { ...gradeData(), grades: { [examId]: 'outstanding' } },
      { ...gradeData(), grades: { [examId]: { grade: 'mastery' } } },
      { ...gradeData(), grades: { [examId]: null } },
      { ...gradeData(), grades: { unknown: 'excellent' } },
      { ...gradeData(), statuses: { [examId + ':mastery']: 'achieved' } },
      { ...validData(), xp: 999 },
      { ...validData(), updatedAt: new Date(0) },
    ]) await assertFails(setDoc(ref, data))
  })

  it('protects recorded keys and denies document deletion', async () => {
    const ref = doc(guest(), semesterPath, semester.id)
    const delivered = { ...validData(), claims: { [firstReward.id]: true } }
    await assertSucceeds(setDoc(ref, delivered))
    await assertFails(setDoc(ref, { ...delivered, claims: {} }))
    await assertFails(setDoc(ref, { ...delivered, statuses: {} }))
    await assertFails(setDoc(ref, { ...delivered, statuses: { ...delivered.statuses, unknown: 'pending' } }))
    await assertFails(deleteDoc(ref))
  })

  it('allows a v1-to-v2 upgrade without removing or rewriting legacy outcomes', async () => {
    const ref = doc(guest(), semesterPath, semester.id)
    const legacy = { ...validData(), statuses: { ...validData().statuses, [examId + ':mastery']: 'achieved' } }
    const upgraded = { ...gradeData(), statuses: legacy.statuses }
    await assertSucceeds(setDoc(ref, legacy))
    await assertFails(setDoc(ref, gradeData()))
    await assertFails(setDoc(ref, { ...upgraded, statuses: { ...legacy.statuses, [examId + ':mastery']: 'failed' } }))
    await assertSucceeds(setDoc(ref, upgraded))
    await assertFails(setDoc(ref, { ...upgraded, grades: {} }))
    await assertFails(setDoc(ref, legacy))
    await assertSucceeds(setDoc(ref, { ...upgraded, grades: { [examId]: 'pending' } }))
  })
})

describe('Firestore progress repository', () => {
  it('preserves simultaneous first saves in an empty semester', async () => {
    const writes = await Promise.allSettled([
      store().updateGrade(semester, examId, 'excellent'),
      store().updateStudy(semester, examId, 'achieved'),
    ])
    expect(writes.filter(result => result.status === 'rejected')).toEqual([])
    expect((await store().load(semester)).progress.exams[examId]).toEqual({ study: 'achieved', grade: 'excellent' })
  })

  it('saves and loads each grade from another client while preserving history', async () => {
    const other = historical.exams[0].id
    await seed(historical.id, { ...validData(), statuses: { [other + ':mastery']: 'achieved' } })
    const historyRef = doc(guest(), semesterPath, historical.id)
    const historyBefore = (await getDoc(historyRef)).data()
    const first = store()
    expect(await first.load(semester)).toEqual({ exists: false, progress: emptyProgress() })
    const second = store()
    for (const grade of ['competent', 'excellent', 'partial', 'mastery', 'pending'] as const) {
      const saved = await first.updateGrade(semester, examId, grade)
      expect(saved.progress.exams[examId]).toEqual({ grade })
      expect(await second.load(semester)).toEqual(saved)
    }
    expect(totalXp((await first.load(historical)).progress, historical)).toBe(10)
    expect((await getDoc(historyRef)).data()).toEqual(historyBefore)
  })

  it('derives legacy grades without writes and keeps the version during a study edit', async () => {
    const [, { id: second }, { id: third }] = semester.exams
    const statuses = {
      [examId + ':studied']: 'achieved',
      [examId + ':excellent']: 'achieved',
      [examId + ':mastery']: 'failed',
      [second + ':mastery']: 'achieved',
      [second + ':excellent']: 'pending',
      [third + ':excellent']: 'failed',
      [third + ':mastery']: 'failed',
    }
    await seed(semester.id, { ...validData(), statuses, claims: { [firstReward.id]: true } })
    const ref = doc(guest(), semesterPath, semester.id)
    const before = (await getDoc(ref)).data()
    const client = store()
    const first = await client.load(semester)
    expect(first.progress).toEqual({
      exams: { [examId]: { study: 'achieved', grade: 'excellent' }, [second]: { grade: 'mastery' }, [third]: { grade: 'pending' } },
      claimed: [firstReward.id],
    })
    expect(await client.load(semester)).toEqual(first)
    expect((await getDoc(ref)).data()).toEqual(before)
    await client.updateStudy(semester, second, 'failed')
    expect((await getDoc(ref)).data()).toMatchObject({ schemaVersion: 1, statuses: { ...statuses, [second + ':studied']: 'failed' } })
    expect((await getDoc(ref)).data()).not.toHaveProperty('grades')
  })

  it('preserves concurrent updates, retired values and claims and keeps an explicit unset grade', async () => {
    const second = semester.exams[1].id
    const statuses = { ...validData().statuses, [examId + ':mastery']: 'achieved', 'retired:studied': 'achieved' }
    const claims = { [firstReward.id]: true, vbucks: true }
    await seed(semester.id, { ...validData(), statuses, claims })
    const writes = await Promise.allSettled([
      store().updateGrade(semester, examId, 'pending'),
      store().updateGrade(semester, second, 'competent'),
      store().updateStudy(semester, second, 'failed'),
    ])
    expect(writes.filter(result => result.status === 'rejected')).toEqual([])
    const ref = doc(guest(), semesterPath, semester.id)
    const converted = (await getDoc(ref)).data()
    expect(converted).toMatchObject({
      schemaVersion: 2, statuses: { ...statuses, [second + ':studied']: 'failed' },
      grades: { [examId]: 'pending', [second]: 'competent' }, claims,
    })
    const refreshed = await store().load(semester)
    expect(refreshed.progress).toEqual({
      exams: { [examId]: { study: 'achieved', grade: 'pending' }, [second]: { study: 'failed', grade: 'competent' } },
      claimed: [firstReward.id],
    })
    expect(await store().updateGrade(semester, examId, 'pending')).toEqual(refreshed)
    expect((await getDoc(ref)).data()).toEqual(converted)
  })

  it('preserves eligible reward claims after an XP correction and a refresh', async () => {
    const client = store()
    await expect(client.claimReward(semester, firstReward.id)).rejects.toMatchObject({ reason: 'reward-unavailable' })
    await client.updateStudy(semester, examId, 'achieved')
    await client.updateGrade(semester, examId, 'excellent')
    const saved = await client.updateGrade(semester, semester.exams[1].id, 'excellent')
    expect(totalXp(saved.progress, semester)).toBe(firstReward.xp)
    const claimed = await client.claimReward(semester, firstReward.id)
    expect(totalXp(claimed.progress, semester)).toBe(firstReward.xp)
    await client.claimReward(semester, firstReward.id)
    await client.updateGrade(semester, examId, 'mastery')
    const refreshed = (await store().load(semester)).progress
    expect(totalXp(refreshed, semester)).toBeLessThan(firstReward.xp)
    expect(refreshed.claimed).toEqual([firstReward.id])
  })

  it('allows an explicit import once, preserves claims and rejects a conflicting or empty import', async () => {
    const client = store()
    const legacy = changeGrade(emptyProgress(), semester, examId, 'excellent')
    await expect(client.importLegacy(semester, emptyProgress())).rejects.toThrow('No valid legacy progress')
    const restored = { ...legacy, claimed: [firstReward.id] }
    expect((await client.importLegacy(semester, { ...restored, claimed: [firstReward.id, firstReward.id, 'removed'] })).progress).toEqual(restored)
    await expect(store().importLegacy(semester, legacy)).rejects.toBeInstanceOf(ProgressConflict)
    expect((await client.load(semester)).progress).toEqual(restored)
  })

  it('rejects offline reads instead of treating a cached miss as empty', async () => {
    const db = guest()
    await disableNetwork(db)
    try {
      await expect(store(db).load(semester)).rejects.toMatchObject({ code: 'unavailable' })
    } finally {
      await enableNetwork(db)
    }
  })

  it('reports write failures and rejects malformed remote data without overwriting either record', async () => {
    await expect(store().updateGrade(historical, historical.exams[0].id, 'excellent')).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(store().updateStudy(historical, historical.exams[0].id, 'achieved')).rejects.toMatchObject({ code: 'permission-denied' })
    await seed(semester.id, { schemaVersion: 99 })
    await expect(store().load(semester)).rejects.toThrow('Invalid cloud progress')
    await expect(store().updateStudy(semester, examId, 'achieved')).rejects.toThrow('Invalid cloud progress')
    expect((await getDoc(doc(guest(), semesterPath, semester.id))).data()).toEqual({ schemaVersion: 99 })
  })
})
