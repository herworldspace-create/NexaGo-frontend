import { isIsoDate, validateFlightSearch } from './validation.mjs'

const base = { origin: 'LOS', destination: 'ABV', departureDate: '2027-01-10', adults: 1, cabinClass: 'economy' }
function assert(condition, message) { if (!condition) throw new Error(message) }

assert(validateFlightSearch(base, '2027-01-01') === null, 'domestic Nigerian route should pass')
assert(validateFlightSearch({ ...base, destination: 'LHR' }, '2027-01-01') === null, 'international route should pass')
assert(!isIsoDate('2027-02-29'), 'impossible date should fail')
assert(Boolean(validateFlightSearch({ ...base, departureDate: '2027-02-29' }, '2027-01-01')), 'invalid departure should fail')
assert(Boolean(validateFlightSearch({ ...base, returnDate: '2027-01-09' }, '2027-01-01')), 'return before departure should fail')
assert(Boolean(validateFlightSearch({ ...base, destination: 'LOS' }, '2027-01-01')), 'same-airport route should fail')
assert(Boolean(validateFlightSearch({ ...base, adults: 5 }, '2027-01-01')), 'passenger count above four should fail')
assert(Boolean(validateFlightSearch({ ...base, cabinClass: 'secret' }, '2027-01-01')), 'unsupported cabin should fail')
