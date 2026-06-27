// Runnable self-check (no test framework): `npm run check` in frontend/.
import assert from 'node:assert/strict'
import { parseContactsCsv } from './csv'

// 1. Quoted comma inside a field is preserved; basic header order.
let rows = parseContactsCsv('Name,Phone,Email\n"Doe, John",+91 99,john@x.com')
assert.equal(rows.length, 1)
assert.equal(rows[0].name, 'Doe, John')
assert.equal(rows[0].phone, '+91 99')
assert.equal(rows[0].email, 'john@x.com')
assert.equal(rows[0].valid, true)

// 2. Reordered + extra columns: only name/phone/email kept, others ignored.
rows = parseContactsCsv('Email ID,Department,Full Name,Mobile Number\na@b.com,Sales,Asha,12345')
assert.equal(rows[0].name, 'Asha')
assert.equal(rows[0].email, 'a@b.com')
assert.equal(rows[0].phone, '12345')

// 3. Missing/invalid email is flagged, not dropped.
rows = parseContactsCsv('Name,Phone,Email\nBob,999,not-an-email\nNoEmail,111,')
assert.equal(rows.length, 2)
assert.equal(rows[0].valid, false)
assert.equal(rows[1].valid, false)

// 4. Empty input => empty array (no crash).
assert.deepEqual(parseContactsCsv(''), [])
assert.deepEqual(parseContactsCsv('\n  \n'), [])

// 5. Headerless data falls back to name,phone,email order.
rows = parseContactsCsv('Ravi,+91 88,ravi@x.com')
assert.equal(rows[0].name, 'Ravi')
assert.equal(rows[0].email, 'ravi@x.com')

console.log('csv.check.ts: all assertions passed ✓')
