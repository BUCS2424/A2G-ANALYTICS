/** Country/continent values are stored as "US:United States" (ISO code prefix). */
export function isoCodeOf(value: string): string | null {
  const code = value.split(':')[0]
  return /^[A-Z]{2}$/.test(code) ? code : null
}

export function flagEmoji(value: string): string | null {
  const isoCode = isoCodeOf(value)
  if (!isoCode) return null
  const codePoints = [...isoCode].map((c) => 127397 + c.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}
