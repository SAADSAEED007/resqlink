import mongoose from 'mongoose'

import CommunityRiskZone from '../../APIs/riskZones/models/community-risk-zone.model'
import {
    createRiskZone,
    listRiskZones,
    getRiskZone,
    requestFieldAssessment,
    updateAssessmentStatus,
    seedDemoRiskZones
} from '../../APIs/riskZones/risk-zones.service'
import { riskZoneSchema, fieldAssessmentSchema, statusUpdateSchema, riskZoneQuerySchema, idSchema, validate } from '../../APIs/riskZones/validation'
import { SINDH_DEMO_FIXTURES } from '../../APIs/riskZones/fixtures'
import { CommunityRiskZoneInput } from '../../APIs/riskZones/types'

beforeEach(() => {
    jest.spyOn(CommunityRiskZone, 'init').mockResolvedValue(new CommunityRiskZone())
})

afterEach(() => {
    jest.restoreAllMocks()
})

describe('community risk zones - input validation schemas', () => {
    const validZonePayload: CommunityRiskZoneInput = {
        communityName: 'Goth Haji Ismail',
        district: 'Thatta',
        tehsil: 'Mirpur Sakro',
        approximateLocation: {
            latitude: 24.55,
            longitude: 67.65,
            landmarkDescription: 'Adjacent to main canal culvert'
        },
        hazardType: 'FLOOD_INUNDATION',
        hazardSeverity: 'CRITICAL',
        connectivityStatus: 'NO_CELL_COVERAGE',
        accessObstacles: ['Damaged access bridge', 'Submerged causeway'],
        vulnerablePopulation: {
            estimatedTotalPopulation: 450,
            estimatedVulnerableCount: 120,
            vulnerabilityDetails: 'High elderly and child population'
        },
        informationConfidence: 'MEDIUM',
        confidenceReasons: ['Local union council report from 6 hours ago']
    }

    it('validates a complete risk zone payload successfully', () => {
        const result = validate<CommunityRiskZoneInput>(riskZoneSchema, validZonePayload)
        expect(result.communityName).toBe('Goth Haji Ismail')
        expect(result.hazardSeverity).toBe('CRITICAL')
        expect(result.connectivityStatus).toBe('NO_CELL_COVERAGE')
        expect(result.assessmentStatus).toBe('PENDING_ASSESSMENT')
    })

    it('accepts approximate location without coordinates', () => {
        const payload = {
            ...validZonePayload,
            approximateLocation: {
                landmarkDescription: 'Village 5km north of Dadu bypass',
                latitude: null,
                longitude: null
            }
        }
        const result = validate<CommunityRiskZoneInput>(riskZoneSchema, payload)
        expect(result.approximateLocation.landmarkDescription).toBe('Village 5km north of Dadu bypass')
        expect(result.approximateLocation.latitude).toBeNull()
        expect(result.approximateLocation.longitude).toBeNull()
        expect(result.approximateLocation.isLocationEstimated).toBe(true)
    })

    it.each([
        [{ ...validZonePayload, communityName: '' }],
        [{ ...validZonePayload, district: ' ' }],
        [{ ...validZonePayload, hazardType: 'TSUNAMI' }],
        [{ ...validZonePayload, hazardSeverity: 'EXTREME' }],
        [{ ...validZonePayload, approximateLocation: { landmarkDescription: 'ab' } }]
    ])('rejects invalid risk zone inputs (%o)', (invalidInput) => {
        expect(() => validate(riskZoneSchema, invalidInput)).toThrow()
    })

    it('validates field assessment request schema', () => {
        const validAssessment = {
            priorityUrgency: 'URGENT',
            assignedOfficer: 'Officer Tariq Baloch',
            assessmentNotes: 'Community report of water level rising; survey team required'
        }
        const validated = validate(fieldAssessmentSchema, validAssessment)
        expect(validated).toEqual(validAssessment)

        expect(() => validate(fieldAssessmentSchema, { priorityUrgency: 'INVALID', assessmentNotes: 'notes' })).toThrow()
        expect(() => validate(fieldAssessmentSchema, { priorityUrgency: 'ROUTINE', assessmentNotes: 'low' })).toThrow()
    })

    it('validates status update schema', () => {
        const validStatus = {
            status: 'ASSESSMENT_COMPLETED',
            notes: 'Field team visited on boat; confirmed 80 families relocated safely'
        }
        const validated = validate(statusUpdateSchema, validStatus)
        expect(validated).toEqual(validStatus)

        expect(() => validate(statusUpdateSchema, { status: 'UNKNOWN_STATUS', notes: 'Valid note' })).toThrow()
        expect(() => validate(statusUpdateSchema, { status: 'MONITORING_ONLY', notes: 'a' })).toThrow()
    })

    it('validates risk zone query parameters and defaults', () => {
        const query = validate(riskZoneQuerySchema, {
            hazardSeverity: 'HIGH',
            assessmentStatus: 'PENDING_ASSESSMENT',
            district: 'Dadu'
        })
        expect(query).toMatchObject({
            hazardSeverity: 'HIGH',
            assessmentStatus: 'PENDING_ASSESSMENT',
            district: 'Dadu',
            page: 1,
            limit: 20,
            sort: 'severity'
        })
    })

    it('validates 24-character hexadecimal IDs', () => {
        const validId = new mongoose.Types.ObjectId().toHexString()
        expect(validate(idSchema, validId)).toBe(validId)
        expect(() => validate(idSchema, 'invalid-id-123')).toThrow()
    })
})

describe('community risk zones - service logic', () => {
    const coordinatorId = new mongoose.Types.ObjectId()
    const zoneId = new mongoose.Types.ObjectId()

    it('creates risk zone with safe confidence reasons when coordinates are missing', async () => {
        const input: CommunityRiskZoneInput = {
            communityName: 'Goth Pir Bakhsh',
            district: 'Sujawal',
            approximateLocation: {
                latitude: null,
                longitude: null,
                landmarkDescription: 'Near coastal dyke kilometer 14'
            },
            hazardType: 'RIVER_BREACH',
            hazardSeverity: 'HIGH',
            connectivityStatus: 'NO_CELL_COVERAGE',
            informationConfidence: 'HIGH'
        }

        const createSpy = jest
            .spyOn(CommunityRiskZone, 'create')
            .mockImplementation(((doc: unknown) => Promise.resolve(new CommunityRiskZone(doc))) as never)


        const created = await createRiskZone(input)
        expect(createSpy).toHaveBeenCalledTimes(1)
        expect(created.approximateLocation.isLocationEstimated).toBe(true)
        // High confidence must be downgraded to MEDIUM when coordinates are missing
        expect(created.informationConfidence).toBe('MEDIUM')
        expect(created.confidenceReasons?.some((r: string) => /coordinates unavailable/i.test(r))).toBe(true)
        expect(created.confidenceReasons?.some((r: string) => /no active cellular coverage/i.test(r))).toBe(true)
    })

    it('lists risk zones and orders by severity hierarchy (CRITICAL > HIGH > MODERATE > LOW)', async () => {
        const mockZones = [
            { hazardSeverity: 'MODERATE', communityName: 'Zone C', createdAt: new Date('2026-10-17T10:00:00Z') },
            { hazardSeverity: 'CRITICAL', communityName: 'Zone A', createdAt: new Date('2026-10-17T09:00:00Z') },
            { hazardSeverity: 'HIGH', communityName: 'Zone B', createdAt: new Date('2026-10-17T08:00:00Z') },
            { hazardSeverity: 'LOW', communityName: 'Zone D', createdAt: new Date('2026-10-17T11:00:00Z') }
        ]

        jest.spyOn(CommunityRiskZone, 'find').mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(mockZones)
        } as unknown as ReturnType<typeof CommunityRiskZone.find>)
        jest.spyOn(CommunityRiskZone, 'countDocuments').mockResolvedValue(4 as unknown as number)

        const result = await listRiskZones({
            page: 1,
            limit: 10,
            sort: 'severity'
        })

        expect(result.pagination.total).toBe(4)
        expect(result.items.map((i) => i.hazardSeverity)).toEqual(['CRITICAL', 'HIGH', 'MODERATE', 'LOW'])
    })

    it('gets a single risk zone or throws 404 if not found', async () => {
        jest.spyOn(CommunityRiskZone, 'findById').mockResolvedValue(null)
        await expect(getRiskZone(String(zoneId))).rejects.toThrow('Community risk zone not found')

        const existingZone = new CommunityRiskZone({
            _id: zoneId,
            communityName: 'Existing Zone',
            district: 'Thatta',
            approximateLocation: { landmarkDescription: 'Near school' },
            hazardType: 'FLOOD_INUNDATION',
            hazardSeverity: 'HIGH'
        })
        jest.spyOn(CommunityRiskZone, 'findById').mockResolvedValue(existingZone)
        const retrieved = await getRiskZone(String(zoneId))
        expect(retrieved.communityName).toBe('Existing Zone')
    })

    it('requests field assessment and transitions status to ASSESSMENT_DISPATCHED', async () => {
        const zone = new CommunityRiskZone({
            _id: zoneId,
            communityName: 'Village Mehar',
            district: 'Dadu',
            approximateLocation: { landmarkDescription: 'Along embankment' },
            hazardType: 'FLOOD_INUNDATION',
            hazardSeverity: 'CRITICAL',
            assessmentStatus: 'PENDING_ASSESSMENT',
            statusHistory: []
        })

        jest.spyOn(zone, 'save').mockResolvedValue(zone)
        jest.spyOn(CommunityRiskZone, 'findById').mockResolvedValue(zone)

        const updated = await requestFieldAssessment(
            String(zoneId),
            {
                priorityUrgency: 'CRITICAL',
                assignedOfficer: 'Field Officer Aslam',
                assessmentNotes: 'Immediate verification needed for vulnerable hamlets'
            },
            String(coordinatorId)
        )

        expect(updated.assessmentStatus).toBe('ASSESSMENT_DISPATCHED')
        expect(updated.fieldAssessment).toBeDefined()
        expect(updated.fieldAssessment?.priorityUrgency).toBe('CRITICAL')
        expect(updated.fieldAssessment?.assignedOfficer).toBe('Field Officer Aslam')
        expect(updated.statusHistory).toHaveLength(1)
        expect(updated.statusHistory[0].previousStatus).toBe('PENDING_ASSESSMENT')
        expect(updated.statusHistory[0].newStatus).toBe('ASSESSMENT_DISPATCHED')
    })

    it('updates assessment status and sets completedAt when completed', async () => {
        const zone = new CommunityRiskZone({
            _id: zoneId,
            communityName: 'Village Mehar',
            district: 'Dadu',
            approximateLocation: { landmarkDescription: 'Along embankment' },
            hazardType: 'FLOOD_INUNDATION',
            hazardSeverity: 'CRITICAL',
            assessmentStatus: 'ASSESSMENT_DISPATCHED',
            fieldAssessment: {
                priorityUrgency: 'CRITICAL',
                assignedOfficer: 'Field Officer Aslam',
                assessmentNotes: 'Dispatch notes',
                requestedBy: coordinatorId,
                requestedAt: new Date(),
                completedAt: null
            },
            statusHistory: []
        })

        jest.spyOn(zone, 'save').mockResolvedValue(zone)
        jest.spyOn(CommunityRiskZone, 'findById').mockResolvedValue(zone)

        const updated = await updateAssessmentStatus(
            String(zoneId),
            'ASSESSMENT_COMPLETED',
            'Field officer completed reconnaissance; safe shelter identified',
            String(coordinatorId)
        )

        expect(updated.assessmentStatus).toBe('ASSESSMENT_COMPLETED')
        expect(updated.fieldAssessment?.completedAt).toBeInstanceOf(Date)
        expect(updated.statusHistory).toHaveLength(1)
        expect(updated.statusHistory[0].newStatus).toBe('ASSESSMENT_COMPLETED')
    })

    it('rejects duplicate status transition with 409 conflict', async () => {
        const zone = new CommunityRiskZone({
            _id: zoneId,
            communityName: 'Village Mehar',
            district: 'Dadu',
            approximateLocation: { landmarkDescription: 'Along embankment' },
            hazardType: 'FLOOD_INUNDATION',
            hazardSeverity: 'CRITICAL',
            assessmentStatus: 'ASSESSMENT_DISPATCHED',
            statusHistory: []
        })

        jest.spyOn(CommunityRiskZone, 'findById').mockResolvedValue(zone)

        await expect(
            updateAssessmentStatus(String(zoneId), 'ASSESSMENT_DISPATCHED', 'Attempting duplicate dispatch', String(coordinatorId))
        ).rejects.toThrow('Risk zone is already in the requested assessment status')
    })

    it('seeds Sindh demo fixtures idempotently', async () => {
        let findOneCount = 0
        jest.spyOn(CommunityRiskZone, 'findOne').mockImplementation((() => {
            findOneCount++
            // Pretend the first one already exists, the remaining 4 are new
            if (findOneCount === 1) {
                return Promise.resolve(new CommunityRiskZone(SINDH_DEMO_FIXTURES[0]))
            }
            return Promise.resolve(null)
        }) as unknown as typeof CommunityRiskZone.findOne)

        const createSpy = jest
            .spyOn(CommunityRiskZone, 'create')
            .mockImplementation(((doc: unknown) => Promise.resolve(new CommunityRiskZone(doc))) as never)


        const seeded = await seedDemoRiskZones()

        expect(seeded).toHaveLength(5)
        expect(findOneCount).toBe(5)
        // 1 was already present, so 4 created
        expect(createSpy).toHaveBeenCalledTimes(4)
    })
})

describe('community risk zones - fixtures integrity', () => {
    it('contains realistic Sindh disaster fixtures marked as simulated', () => {
        expect(SINDH_DEMO_FIXTURES.length).toBeGreaterThanOrEqual(5)
        for (const fixture of SINDH_DEMO_FIXTURES) {
            expect(fixture.isSimulated).toBe(true)
            expect(fixture.demoKey).toBeDefined()
            expect(fixture.communityName).toBeTruthy()
            expect(fixture.district).toBeTruthy()
            expect(fixture.approximateLocation.landmarkDescription).toBeTruthy()
            expect(['FLOOD_INUNDATION', 'FLASH_FLOOD', 'RIVER_BREACH', 'HEATWAVE', 'WATER_SHORTAGE', 'OTHER']).toContain(fixture.hazardType)
            expect(['CRITICAL', 'HIGH', 'MODERATE', 'LOW']).toContain(fixture.hazardSeverity)
        }
    })
})
