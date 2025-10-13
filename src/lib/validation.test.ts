import { describe, it, expect } from 'vitest'
import { isValidProductCode } from './validation'

// Ensure core regression: code 3NkNwR2JcB is considered valid and casing preserved

describe('isValidProductCode', () => {
  it('accepts mixed-case alphanumeric codes like 3NkNwR2JcB', () => {
    const code = '3NkNwR2JcB'
    expect(isValidProductCode(code)).toBe(true)
  })

  it('rejects all-numeric codes', () => {
    expect(isValidProductCode('1234567')).toBe(false)
  })

  it('rejects too short', () => {
    expect(isValidProductCode('Ab12')).toBe(false)
  })

  it('rejects non-alphanumeric', () => {
    expect(isValidProductCode('ABC-123')).toBe(false)
  })
})
