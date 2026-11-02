import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import assert from 'node:assert/strict'

const source = readFileSync(new URL('./apps-script.gs', import.meta.url), 'utf8')
const headers = ['submitted_at', 'full_name', 'email_for_app', 'linkedin_url', 'country', 'has_iphone', 'goal', 'race_date', 'returning_after_break', 'runs_per_week_now', 'source', 'utm_campaign', 'consent']
const row = Object.fromEntries(headers.map(key => [key, key === 'full_name' ? '=1+1' : 'test']))

function harness(columns = [...headers, 'notes']) {
  const writes = []
  let released = 0
  let opened = 0
  const sheet = {
    getLastColumn: () => columns.length,
    getRange: () => ({ getValues: () => [columns] }),
    appendRow: values => writes.push(values),
  }
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'fictional-test-secret' }) },
    SpreadsheetApp: { openById: id => { assert.equal(id, '10w2yrMINJvIWNGstlb5-doeySJFFoiNVv5JlVaxLhZc'); opened++; return { getSheets: () => [sheet], getSheetByName: name => { assert.equal(name, 'Untitled'); return sheet } } } },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => { released++ } }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
  })
  vm.runInContext(source, context)
  return {
    post: (secret = 'fictional-test-secret', data = row) => context.doPost({ postData: { contents: JSON.stringify({ secret, row: data }) } }),
    writes, context, released: () => released, opened: () => opened,
  }
}

test('explicit spreadsheet ID, reordered headers, formula escaping and untouched founder fields', () => {
  const h = harness(['notes', ...headers.toReversed()])
  assert.equal(h.post().ok, true)
  assert.equal(h.opened(), 1)
  assert.equal(h.writes.length, 1)
  assert.equal(h.writes[0][0], '')
  assert.equal(h.writes[0].at(-2), "'=1+1")
  assert.equal(h.released(), 1)
})
test('bad secret cannot open or append to the sheet', () => {
  const h = harness()
  assert.equal(h.post('wrong').ok, false)
  assert.equal(h.opened(), 0)
  assert.equal(h.writes.length, 0)
})
test('missing row is rejected', () => {
  const h = harness()
  assert.equal(h.post('fictional-test-secret', null).ok, false)
  assert.equal(h.writes.length, 0)
})
test('missing required sheet header fails without appending', () => {
  const h = harness(headers.filter(key => key !== 'email_for_app'))
  assert.equal(h.post().ok, false)
  assert.equal(h.writes.length, 0)
  assert.equal(h.released(), 1)
})
test('duplicate required sheet header fails without appending', () => {
  const h = harness([...headers, 'email_for_app'])
  assert.equal(h.post().ok, false)
  assert.equal(h.writes.length, 0)
})
test('formula prefixes are stored as text', () => {
  const h = harness()
  for (const prefix of ['=', '+', '-', '@']) assert.equal(h.context.asText_(prefix + 'test'), "'" + prefix + 'test')
  assert.equal(h.context.asText_('plain text'), 'plain text')
  assert.equal(h.context.asText_('2026-11-02'), '2026-11-02')
})
