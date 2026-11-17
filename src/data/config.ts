import { gradePolicy, isGradeId, maximumXp, studyAchievementId, studyXp, type Config, type Semester } from '../quest'
import json from './semesters.json'

type Row = Record<string, unknown>
const validId = /^[a-z0-9][a-z0-9_-]*$/

function fail(path: string, message: string): never {
  throw new Error(path + ': ' + message)
}

function object(value: unknown, path: string): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'נדרש אובייקט')
  return value as Row
}

function string(value: unknown, path: string) {
  if (typeof value !== 'string' || !value.trim()) fail(path, 'נדרש טקסט')
  return value
}

function identifier(value: unknown, path: string) {
  const id = string(value, path)
  if (!validId.test(id) || ['constructor', 'prototype'].includes(id)) fail(path, 'מזהה לא תקין')
  return id
}

function entries(value: unknown, path: string) {
  if (!Array.isArray(value)) fail(path, 'נדרשת רשימה')
  const ids = new Set<string>()
  return value.map((entry, index) => {
    const row = object(entry, path + '[' + index + ']')
    const id = identifier(row.id, path + '[' + index + '].id')
    if (ids.has(id)) fail(path, 'מזהה כפול ' + id)
    ids.add(id)
    return { row, id, path: path + '.' + id }
  })
}

function optionalText(value: unknown, path: string) {
  return value === undefined ? undefined : string(value, path)
}

function date(value: unknown, path: string) {
  if (value === undefined) return undefined
  const text = string(value, path)
  const parsed = new Date(text)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    fail(path, 'תאריך לא תקין, השתמשו ב־YYYY-MM-DD')
  }
  return text
}

function points(value: unknown, path: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) fail(path, 'נדרש מספר שלם חיובי')
  return value
}

export function validateConfig(value: unknown): Config {
  const root = object(value, 'config')
  const activeSemesterId = identifier(root.activeSemesterId, 'activeSemesterId')
  const semesters = entries(root.semesters, 'semesters').map(({ row, id, path }): Semester => {
    const startDate = date(row.startDate, path + '.startDate')
    const endDate = date(row.endDate, path + '.endDate')
    if (startDate && endDate && startDate > endDate) fail(path, 'תאריך הסיום קודם לתחילת הסמסטר')
    const exams = entries(row.exams, path + '.exams').map(({ row, id, path }) => ({
      id, subject: string(row.subject, path + '.subject'), title: optionalText(row.title, path + '.title'),
      date: date(row.date, path + '.date'), icon: optionalText(row.icon, path + '.icon'),
    }))
    const study = object(row.study, path + '.study')
    if (study.id !== studyAchievementId || study.xp !== studyXp || row.achievements !== undefined) {
      fail(path + '.study', 'נדרשת הגדרת למידה אחת בשווי 10 נקודות')
    }
    const grade = object(row.grade, path + '.grade')
    const options = entries(grade.options, path + '.grade.options').map(({ row, id, path }) => {
      if (!isGradeId(id)) fail(path, 'מזהה ציון לא תקין')
      const { xp, medal } = gradePolicy[id]
      if (row.xp !== xp || row.medal !== medal) fail(path, 'נקודות או מדליה לא תואמות לציון')
      return { id, title: string(row.title, path + '.title'), xp, medal }
    })
    if (options.length !== Object.keys(gradePolicy).length) fail(path + '.grade.options', 'נדרשים בדיוק ארבעה ציונים')
    const rewards = entries(row.rewards, path + '.rewards').map(({ row, id, path }) => ({
      id, title: string(row.title, path + '.title'), xp: points(row.xp, path + '.xp'),
      description: optionalText(row.description, path + '.description'),
      type: optionalText(row.type, path + '.type'), icon: optionalText(row.icon, path + '.icon'),
    }))
    const semester: Semester = {
      id, name: string(row.name, path + '.name'), startDate, endDate, exams, rewards,
      study: { id: studyAchievementId, title: string(study.title, path + '.study.title'), xp: studyXp },
      grade: {
        title: string(grade.title, path + '.grade.title'),
        pendingTitle: string(grade.pendingTitle, path + '.grade.pendingTitle'),
        options,
      },
    }
    const maximum = maximumXp(semester)
    if (!Number.isSafeInteger(maximum)) fail(path, 'סכום נקודות גדול מדי')
    for (const reward of rewards) {
      if (reward.xp > maximum) fail(path + '.rewards.' + reward.id, 'רף הפרס גבוה מהמקסימום: ' + maximum)
    }
    return semester
  })
  if (!semesters.some(semester => semester.id === activeSemesterId)) fail('activeSemesterId', 'הסמסטר הפעיל אינו קיים')
  return { activeSemesterId, semesters }
}

export function readConfig() {
  return validateConfig(json)
}
