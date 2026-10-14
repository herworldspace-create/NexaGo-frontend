const ZERO_DECIMAL = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'])
const THREE_DECIMAL = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND'])

export function toMinorUnits(amount: string, currency: string): number {
  const code = currency.toUpperCase()
  if (THREE_DECIMAL.has(code)) throw new Error(`${code} fares cannot be paid by card here.`)
  if (!/^\d+(\.\d+)?$/.test(amount)) throw new Error('The fare amount is invalid.')
  const decimals = ZERO_DECIMAL.has(code) ? 0 : 2
  const [whole, fraction = ''] = amount.split('.')
  if (fraction.replace(/0+$/, '').length > decimals) throw new Error('The fare amount has unexpected precision.')
  const minor = Number(`${whole}${fraction.padEnd(decimals, '0').slice(0, decimals)}`)
  if (!Number.isSafeInteger(minor) || minor <= 0) throw new Error('The fare amount is invalid.')
  return minor
}

export function formatMoney(amount: string | number, currency: string) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(Number(amount))
}
