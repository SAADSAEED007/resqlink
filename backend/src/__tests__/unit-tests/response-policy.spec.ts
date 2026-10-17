import { calculatePriority, distanceKm, assertAssignable, assertTransition } from '../../APIs/response/priority.service'
import { incidentSchema, teamSchema, validate } from '../../APIs/response/validation'
import Incident from '../../APIs/response/models/incident.model'
import Team from '../../APIs/response/models/team.model'
import { IncidentInput, RiskInput } from '../../APIs/response/types'
const full: RiskInput = {
    emergencyType: 'FLOOD',
    peopleAffected: 1,
    location: { latitude: 24.86, longitude: 67.01 },
    vulnerablePeople: { elderly: 0, children: 0, disabled: 0, medicalNeeds: 0 },
    waterLevel: 'NONE',
    immediateDanger: false
}
const input = { reporterName: 'Demo reporter', description: 'SIMULATED flood report', ...full }
describe('explainable priority', () => {
    it('sums known factors, clamps to 100, and returns explicit reasons', () => {
        const result = calculatePriority({
            ...full,
            emergencyType: 'MEDICAL',
            peopleAffected: 5,
            waterLevel: 'HIGH',
            immediateDanger: true,
            vulnerablePeople: { elderly: 1, children: 1, disabled: 1, medicalNeeds: 1 }
        })
        expect(result.priorityScore).toBe(100)
        expect(result.priorityLevel).toBe('CRITICAL')
        expect(result.confidenceLevel).toBe('HIGH')
        expect(result.priorityReasons).toContain('Immediate danger reported')
    })
    it('scores real boundary combinations', () => {
        expect(calculatePriority({ ...full, emergencyType: 'MEDICAL', peopleAffected: 2 }).priorityLevel).toBe('MEDIUM')
        expect(calculatePriority({ ...full, immediateDanger: true, waterLevel: 'HIGH' }).priorityLevel).toBe('HIGH')
        expect(
            calculatePriority({ ...full, immediateDanger: true, waterLevel: 'HIGH', emergencyType: 'MEDICAL', peopleAffected: 2 }).priorityLevel
        ).toBe('CRITICAL')
    })
    it('does not treat missing risk information or location as proof of safety', () => {
        const result = calculatePriority({ emergencyType: 'FLOOD', peopleAffected: 1 })
        expect(result.confidenceLevel).toBe('LOW')
        expect(result.priorityReasons.join(' ')).toMatch(/Manual review required.*location/)
        expect(result.priorityReasons.join(' ')).toMatch(/does not establish safety/)
    })
    it('lowers confidence for unknown water and incomplete vulnerability', () => {
        expect(calculatePriority({ ...full, waterLevel: 'UNKNOWN' }).confidenceLevel).toBe('MEDIUM')
        expect(calculatePriority({ ...full, vulnerablePeople: { children: 0 }, waterLevel: 'UNKNOWN' }).confidenceLevel).toBe('LOW')
    })
})
describe('input and model validation', () => {
    it('accepts absent coordinates without manufacturing a location', () => {
        const payload = validate<IncidentInput>(incidentSchema, { ...input, location: undefined })
        expect(payload.location).toBeUndefined()
    })
    it.each([{ latitude: 91, longitude: 67 }, { latitude: 24, longitude: -181 }, { latitude: 24 }])(
        'rejects invalid or incomplete coordinates %o',
        (location) => {
            expect(() => validate(incidentSchema, { ...input, location })).toThrow()
        }
    )
    it.each([
        { peopleAffected: 0 },
        { vulnerablePeople: { children: -1 } },
        { peopleAffected: 1.5 },
        { immediateDanger: 'unknown' },
        { priorityScore: 100 },
        { description: '<script>alert(1)</script>' }
    ])('rejects invalid counts, injected state, and unsafe text %o', (patch) => {
        expect(() => validate(incidentSchema, { ...input, ...patch })).toThrow()
    })
    it('trims text and rejects team BUSY without assignment', () => {
        expect(validate<IncidentInput>(incidentSchema, { ...input, reporterName: '  Demo reporter  ' }).reporterName).toBe('Demo reporter')
        expect(() =>
            validate(teamSchema, {
                name: 'Demo team',
                teamCode: 'DEMO',
                capabilities: ['MEDICAL'],
                capacity: 3,
                location: full.location,
                status: 'BUSY'
            })
        ).toThrow()
    })
    it('also enforces model coordinate and capacity bounds', () => {
        const invalid = new Incident({
            ...input,
            ...calculatePriority(full),
            locationVerificationRequired: false,
            location: { latitude: -91, longitude: 67 }
        })
        expect(invalid.validateSync()?.errors['location.latitude']).toBeDefined()
        expect(
            new Team({ name: 'Demo', teamCode: 'DEMO', capabilities: ['MEDICAL'], capacity: 0, location: full.location }).validateSync()?.errors
                .capacity
        ).toBeDefined()
    })
})
describe('assignment policy and geographic matching', () => {
    it('rejects busy, incompatible, or duplicate assignments', () => {
        expect(() => assertAssignable({ status: 'PENDING', emergencyType: 'FLOOD' }, { status: 'BUSY', capabilities: ['WATER_RESCUE'] })).toThrow(
            'unavailable'
        )
        expect(() => assertAssignable({ status: 'PENDING', emergencyType: 'FLOOD' }, { status: 'AVAILABLE', capabilities: ['MEDICAL'] })).toThrow(
            'capability'
        )
        expect(() =>
            assertAssignable({ status: 'ASSIGNED', emergencyType: 'FLOOD' }, { status: 'AVAILABLE', capabilities: ['WATER_RESCUE'] })
        ).toThrow('already')
    })
    it('permits an eligible capable team without dispatching', () => {
        expect(() =>
            assertAssignable({ status: 'PENDING', emergencyType: 'FLOOD' }, { status: 'AVAILABLE', capabilities: ['WATER_RESCUE'] })
        ).not.toThrow()
    })
    it('rejects arbitrary status transitions', () => {
        expect(() => assertTransition('PENDING', 'RESOLVED')).toThrow()
        expect(() => assertTransition('PENDING', 'ASSIGNED')).toThrow()
        expect(() => assertTransition('ASSIGNED', 'IN_PROGRESS')).not.toThrow()
        expect(() => assertTransition('IN_PROGRESS', 'RESOLVED')).not.toThrow()
    })
    it('calculates approximate distance including identical coordinates', () => {
        expect(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(111.195, 2)
        expect(distanceKm(full.location!, full.location!)).toBe(0)
    })
})
