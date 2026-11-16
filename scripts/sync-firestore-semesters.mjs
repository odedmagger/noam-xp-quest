import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { URL } from 'node:url'

const configPath = new URL('../src/data/semesters.json', import.meta.url)
const rulesPath = new URL('../firestore.rules', import.meta.url)
const { activeSemesterId, semesters } = JSON.parse(readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''))
const active = semesters.find(semester => semester.id === activeSemesterId)
if (!active) throw new Error('The active semester must be defined in semesters.json.')

const statusKeys = active.exams.flatMap(exam => active.achievements.map(item => exam.id + ':' + item.id))
const content = [
  '    // BEGIN GENERATED SEMESTER CONFIG',
  '    function knownSemester(id) { return id in ' + JSON.stringify(semesters.map(semester => semester.id)) + '; }',
  '    function activeSemester(id) { return id == ' + JSON.stringify(activeSemesterId) + '; }',
  '    function activeStatusKeys() { return ' + JSON.stringify(statusKeys) + '; }',
  '    function activeRewardKeys() { return ' + JSON.stringify(active.rewards.map(reward => reward.id)) + '; }',
  '    // END GENERATED SEMESTER CONFIG',
]
const original = readFileSync(rulesPath, 'utf8')
const marker = /^ {4}\/\/ BEGIN GENERATED SEMESTER CONFIG\r?\n[\s\S]*?^ {4}\/\/ END GENERATED SEMESTER CONFIG/m
if (!marker.test(original)) throw new Error('Firestore semester configuration markers are missing.')
const lineBreak = original.includes('\r\n') ? '\r\n' : '\n'
const updated = original.replace(marker, () => content.join(lineBreak))

if (process.argv.includes('--check')) {
  if (updated !== original) throw new Error('Firestore semester permissions are out of date. Run npm run rules:sync.')
} else {
  writeFileSync(rulesPath, updated)
}
