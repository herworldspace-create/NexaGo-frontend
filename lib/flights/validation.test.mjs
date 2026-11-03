import { isIsoDate, normalizeAirportCode, validateFlightSearch } from './validation.mjs'

const base = { origin: 'LOS', destination: 'ABV', departureDate: '2027-01-10', adults: 1, cabinClass: 'economy' }
const assert = (condition, message) => { if (!condition) throw new Error(message) }

assert(validateFlightSearch(base, '2027-01-01') === null, 'domestic Nigerian route should pass')
assert(validateFlightSearch({ ...base, destination: 'LHR' }, '2027-01-01') === null, 'international route should pass')
assert(normalizeAirportCode(' los ') === 'LOS', 'airport code should trim and uppercase')
assert(normalizeAirportCode(null) === '', 'missing code should safely normalize')
assert(validateFlightSearch({ ...base, origin: ' los ', destination: ' abv ' }, '2027-01-01') === null, 'normalized codes should pass search')
assert(!isIsoDate('2027-02-29'), 'invalid leap date should fail')
assert(isIsoDate('2028-02-29'), 'valid leap date should pass')
assert(!isIsoDate('2027-13-01'), 'out-of-range month should fail')
assert(validateFlightSearch({ ...base, departureDate: '2027-01-10', returnDate: '2027-01-10' }, '2027-01-01') === null, 'same-day return should pass')
assert(Boolean(validateFlightSearch({ ...base, returnDate: '2027-01-09' }, '2027-01-01')), 'return before departure should fail')
assert(validateFlightSearch({ ...base, returnDate: '2027-01-11' }, '2027-01-01') === null, 'future return should pass')
assert(Boolean(validateFlightSearch(base, '2027-02-30')), 'invalid current date should fail')
assert(Boolean(validateFlightSearch({ ...base, destination: 'LOS' }, '2027-01-01')), 'same-airport route should fail')
assert(Boolean(validateFlightSearch({ ...base, adults: 5 }, '2027-01-01')), 'passenger count above four should fail')
assert(Boolean(validateFlightSearch({ ...base, cabinClass: 'secret' }, '2027-01-01')), 'unsupported cabin should fail')
