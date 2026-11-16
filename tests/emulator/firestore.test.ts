import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestContext, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, disableNetwork, doc, enableNetwork, getDoc, getDocs, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createFirestoreStore } from '../../src/cloud/firestore-store'
import { ProgressConflict, type CloudProgress, type ProgressStore } from '../../src/cloud-progress'
import { changeAchievement, emptyProgress, totalXp, type Semester } from '../../src/quest'

const semester: Semester = {
  id: 'test-first',
  name: 'Test semester',
  exams: [{ id: 'math', subject: 'Math' }],
  achievements: [
    { id: 'studied', title: 'Studied', xp: 10 },
    { id: 'mastery', title: 'Mastery', xp: 10 },
    { id: 'excellent', title: 'Excellent', xp: 5, requires: 'mastery' },
  ],
  rewards: [{ id: 'test-reward', title: 'Reward', xp: 25 }],
}
const historical = { ...semester, id: 'test-history' }
const examId = semester.exams[0].id
const firstReward = semester.rewards[0]
const projectId = 'demo-noam-xp-quest'
const approved = 'approved-parent'
const google = { firebase: { sign_in_provider: 'google.com' } } as const
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

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'parents', approved), { enabled: true }))
})

afterAll(async () => {
  await env?.cleanup()
})

// Rules tests return a compat client. Modular SDK calls accept it and unwrap the delegate at runtime.
function firestore(context: RulesTestContext) {
  return context.firestore() as unknown as Firestore
}

const writer = () => firestore(env.authenticatedContext(approved, google))
const reader = () => firestore(env.unauthenticatedContext())
const parentStore = () => createFirestoreStore(writer())

function validData() {
  return { schemaVersion: 1, statuses: { [examId + ':studied']: 'achieved' }, claims: {}, updatedAt: serverTimestamp() }
}

describe('Firestore Security Rules', () => {
  it('permits public semester document reads and denies collection listing, private reads and unrelated paths', async () => {
    await assertSucceeds(setDoc(doc(writer(), 'semesters', semester.id), validData()))
    const publicDb = reader()
    expect((await assertSucceeds(getDoc(doc(publicDb, 'semesters', semester.id)))).exists()).toBe(true)
    await assertFails(getDocs(collection(publicDb, 'semesters')))
    await assertFails(getDoc(doc(publicDb, 'parents', approved)))
    await assertFails(getDoc(doc(publicDb, 'semesters', semester.id, 'private', 'note')))
    await assertFails(getDoc(doc(writer(), 'unrelated', 'some-id')))
    await assertFails(setDoc(doc(writer(), 'unrelated', 'some-id'), validData()))
  })

  it('denies anonymous creates, updates and deletes and writes from unapproved sign-ins', async () => {
    const publicRef = doc(reader(), 'semesters', semester.id)
    await assertFails(setDoc(publicRef, validData()))
    await assertFails(setDoc(doc(env.authenticatedContext('other-user', google).firestore(), 'semesters', semester.id), validData()))
    await assertFails(setDoc(doc(env.authenticatedContext(approved, { firebase: { sign_in_provider: 'password' } }).firestore(),
      'semesters', semester.id), validData()))
    await assertSucceeds(setDoc(doc(writer(), 'semesters', semester.id), validData()))
    await assertFails(setDoc(publicRef, validData()))
    await assertFails(deleteDoc(publicRef))
    await assertFails(deleteDoc(doc(writer(), 'semesters', semester.id)))
  })

  it('allows approved Google parents to update statuses and reward claims', async () => {
    const ref = doc(writer(), 'semesters', semester.id)
    await assertSucceeds(setDoc(ref, validData()))
    await assertSucceeds(setDoc(ref, {
      ...validData(), statuses: { [examId + ':studied']: 'failed' }, claims: { [firstReward.id]: true },
    }))
    expect((await getDoc(ref)).data()?.claims).toEqual({ [firstReward.id]: true })
  })

  it('allows only the signed-in Google account to check its approval and denies all client allowlist mutations', async () => {
    const parent = writer()
    const unapproved = env.authenticatedContext('other-user', google).firestore()
    const own = doc(parent, 'parents', approved)
    expect((await assertSucceeds(getDoc(own))).data()?.enabled).toBe(true)
    expect((await assertSucceeds(getDoc(doc(unapproved, 'parents', 'other-user')))).exists()).toBe(false)
    await assertFails(getDoc(doc(unapproved, 'parents', approved)))
    await assertFails(getDocs(collection(parent, 'parents')))
    await assertFails(setDoc(doc(unapproved, 'parents', 'other-user'), { enabled: true }))
    await assertFails(setDoc(own, { enabled: false }))
    await assertFails(deleteDoc(own))
    await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'parents', approved), { enabled: false }))
    await assertFails(setDoc(doc(parent, 'semesters', semester.id), validData()))
  })

  it('rejects malformed statuses, invalid claims, extra fields, invalid IDs and client timestamps', async () => {
    const db = writer()
    const ref = doc(db, 'semesters', semester.id)
    for (const badData of [
      { ...validData(), statuses: { studied: 'yes' } },
      { ...validData(), statuses: { studied: { status: 'achieved' } } },
      { ...validData(), claims: { reward: false } },
      { ...validData(), statuses: [] },
      { ...validData(), schemaVersion: 2 },
      { ...validData(), xp: 999 },
      { ...validData(), updatedAt: new Date(0) },
    ]) await assertFails(setDoc(ref, badData))
    await assertFails(setDoc(doc(db, 'semesters', 'bad!'), validData()))
  })
})

function observe(store: ProgressStore, predicate: (value: CloudProgress) => boolean) {
  let stop = () => {}
  const result = new Promise<CloudProgress>((resolve, reject) => {
    stop = store.subscribe(semester, event => {
      if (event.kind === 'error') reject(new Error('Progress listener failed'))
      if (event.kind === 'synced' && predicate(event.value)) resolve(event.value)
    })
  })
  return { result, stop: () => stop() }
}

describe('Firestore progress repository', () => {
  it('waits for a confirmed server snapshot before treating a semester as empty', async () => {
    const db = reader()
    const events: string[] = []
    await disableNetwork(db)
    let offline!: () => void
    let confirmed!: () => void
    const waiting = new Promise<void>(resolve => { offline = resolve })
    const synced = new Promise<void>(resolve => { confirmed = resolve })
    const unsubscribe = createFirestoreStore(db).subscribe(semester, event => {
      events.push(event.kind)
      if (event.kind === 'waiting') offline()
      if (event.kind === 'synced') confirmed()
    })
    try {
      await waiting
      expect(events).not.toContain('synced')
      await enableNetwork(db)
      await synced
      expect(events.at(-1)).toBe('synced')
    } finally {
      unsubscribe()
    }
  })

  it('synchronizes a different client in real time and keeps semesters separate', async () => {
    const viewer = createFirestoreStore(reader())
    const parent = parentStore()
    const initial = await viewer.load(semester)
    expect(initial).toEqual({ exists: false, progress: emptyProgress() })
    const observed = observe(viewer, value => value.progress.exams[examId]?.excellent === 'achieved')
    try {
      await parent.updateAchievement(semester, examId, 'excellent', 'achieved')
      expect((await observed.result).progress.exams[examId]).toEqual({ mastery: 'achieved', excellent: 'achieved' })
      expect((await viewer.load(historical)).exists).toBe(false)
    } finally {
      observed.stop()
    }
  })

  it('preserves independent edits from concurrent parent clients and applies grade corrections atomically', async () => {
    const other = 'another-approved-parent'
    await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'parents', other), { enabled: true }))
    const first = parentStore()
    const second = createFirestoreStore(firestore(env.authenticatedContext(other, google)))
    await Promise.all([
      first.updateAchievement(semester, examId, 'excellent', 'achieved'),
      second.updateAchievement(semester, examId, 'studied', 'achieved'),
    ])
    expect(totalXp((await first.load(semester)).progress, semester)).toBe(25)
    await first.updateAchievement(semester, examId, 'mastery', 'failed')
    expect((await second.load(semester)).progress.exams[examId]).toEqual({
      studied: 'achieved', mastery: 'failed', excellent: 'pending',
    })
  })

  it('rejects premature claims and preserves a delivered reward after correction and reload', async () => {
    const parent = parentStore()
    await expect(parent.claimReward(semester, firstReward.id)).rejects.toMatchObject({ reason: 'reward-unavailable' })
    await parent.updateAchievement(semester, examId, 'studied', 'achieved')
    await parent.updateAchievement(semester, examId, 'excellent', 'achieved')
    await parent.claimReward(semester, firstReward.id)
    await parent.claimReward(semester, firstReward.id)
    await parent.updateAchievement(semester, examId, 'mastery', 'failed')
    const viewer = createFirestoreStore(reader())
    expect(await viewer.loadRewardClaims(semester)).toEqual([firstReward.id])
    expect(totalXp((await viewer.load(semester)).progress, semester)).toBe(10)
  })

  it('imports validated legacy progress once and protects existing data including deliberate resets', async () => {
    const legacy = changeAchievement(emptyProgress(), semester, examId, 'excellent', 'achieved')
    const parent = parentStore()
    await assertFails(createFirestoreStore(reader()).importLegacy(semester, legacy))
    await parent.importLegacy(semester, { ...legacy, claimed: [firstReward.id, firstReward.id, 'removed'] })
    await expect(parent.importLegacy(semester, emptyProgress())).rejects.toBeInstanceOf(ProgressConflict)
    expect((await parent.load(semester)).progress).toEqual({ ...legacy, claimed: [firstReward.id] })
    await parent.reset(semester)
    await expect(parent.importLegacy(semester, legacy)).rejects.toMatchObject({ reason: 'existing-progress' })
    expect(await parent.load(semester)).toEqual({ exists: true, progress: emptyProgress() })
  })

  it('lets just one simultaneous legacy import create the semester', async () => {
    const firstLegacy = changeAchievement(emptyProgress(), semester, examId, 'studied', 'achieved')
    const secondLegacy = changeAchievement(emptyProgress(), semester, examId, 'excellent', 'achieved')
    const first = parentStore()
    const second = parentStore()
    const results = await Promise.allSettled([first.importLegacy(semester, firstLegacy), second.importLegacy(semester, secondLegacy)])
    const winner = results.findIndex(result => result.status === 'fulfilled')
    const conflict = results.find(result => result.status === 'rejected')
    expect(winner).toBeGreaterThanOrEqual(0)
    expect(conflict?.reason).toMatchObject({ reason: 'existing-progress' })
    expect((await first.load(semester)).progress).toEqual([firstLegacy, secondLegacy][winner])
  })

  it('fails gracefully on malformed cloud data and keeps it from being silently overwritten', async () => {
    await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'semesters', semester.id), { schemaVersion: 99 }))
    const store = parentStore()
    await expect(store.load(semester)).rejects.toThrow('Invalid cloud progress')
    const watched = observe(store, () => false)
    try {
      await expect(watched.result).rejects.toThrow('Progress listener failed')
    } finally {
      watched.stop()
    }
    await expect(store.updateAchievement(semester, examId, 'studied', 'achieved')).rejects.toThrow('Invalid cloud progress')
  })
})
