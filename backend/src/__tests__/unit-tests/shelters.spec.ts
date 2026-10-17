/* Supertest response.body and Jest matchers are dynamic. */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import mongoose from 'mongoose'


import Shelter from '../../APIs/shelters/models/shelter.model'
import ReliefResource from '../../APIs/shelters/models/relief-resource.model'
import {
    calculateAvailability,
    assessResourceStatus,
    distanceKm,
    createShelter,
    updateShelter,
    listShelters,
    getShelterById,
    createOrUpdateResource,
    updateResource,
    getShelterResources,
    seedDemoShelters
} from '../../APIs/shelters/shelters.service'
import {
    createShelterSchema,
    updateShelterSchema,
    createResourceSchema,
    updateResourceSchema,
    shelterQuerySchema,
    idSchema,
    validate
} from '../../APIs/shelters/validation'
import { SINDH_DEMO_SHELTERS } from '../../APIs/shelters/fixtures'
import { CreateShelterInput, CreateResourceInput } from '../../APIs/shelters/types'
import request from 'supertest'
import app from '../../app'
import query from '../../APIs/user/_shared/repo/user.repository'
import jwt from '../../utils/jwt'
import config from '../../config/config'
import { EUserRoles } from '../../constant/users'


beforeEach(() => {
    jest.spyOn(Shelter, 'init').mockResolvedValue(new Shelter())
    jest.spyOn(ReliefResource, 'init').mockResolvedValue(new ReliefResource())
})

afterEach(() => {
    jest.restoreAllMocks()
})

describe('shelters & relief resources - input validation schemas', () => {
    const validShelterPayload: CreateShelterInput = {
        name: 'SIMULATED - Thatta Relief Camp',
        address: 'National Highway, Thatta, Sindh',
        location: { latitude: 24.747, longitude: 67.923 },
        totalCapacity: 300,
        currentOccupancy: 100,
        status: 'OPEN',
        contactInformation: {
            contactPerson: 'Mr. Tariq',
            phone: '+92 300 1234567',
            email: 'tariq@resqlink.org'
        },
        notes: 'Equipped with medical station'
    }

    const validResourcePayload: CreateResourceInput = {
        category: 'FOOD',
        resourceName: 'Ready-to-eat ration packs',
        quantity: 500,
        unit: 'packs',
        status: 'ADEQUATE',
        minimumThreshold: 100
    }

    it('validates a complete shelter payload successfully', () => {
        const result = validate<CreateShelterInput>(createShelterSchema, validShelterPayload)
        expect(result.name).toBe('SIMULATED - Thatta Relief Camp')
        expect(result.totalCapacity).toBe(300)
        expect(result.currentOccupancy).toBe(100)
        expect(result.status).toBe('OPEN')
    })

    it.each([
        [{ ...validShelterPayload, name: '' }],
        [{ ...validShelterPayload, address: 'ab' }],
        [{ ...validShelterPayload, totalCapacity: 0 }],
        [{ ...validShelterPayload, totalCapacity: -5 }],
        [{ ...validShelterPayload, location: { latitude: 95, longitude: 67 } }],
        [{ ...validShelterPayload, location: { latitude: 24, longitude: -200 } }],
        [{ ...validShelterPayload, status: 'INVALID_STATUS' }]
    ])('rejects invalid shelter inputs (%o)', (invalidInput) => {
        expect(() => validate(createShelterSchema, invalidInput)).toThrow()
    })

    it('validates a valid relief resource payload', () => {
        const result = validate<CreateResourceInput>(createResourceSchema, validResourcePayload)
        expect(result.category).toBe('FOOD')
        expect(result.quantity).toBe(500)
        expect(result.unit).toBe('packs')
    })

    it.each([
        [{ ...validResourcePayload, category: 'WEAPONS' }],
        [{ ...validResourcePayload, quantity: -10 }],
        [{ ...validResourcePayload, unit: '' }],
        [{ ...validResourcePayload, status: 'UNKNOWN' }]
    ])('rejects invalid relief resource inputs (%o)', (invalidInput) => {
        expect(() => validate(createResourceSchema, invalidInput)).toThrow()
    })

    it('validates shelter update schema and rejects empty payload', () => {
        expect(() => validate(updateShelterSchema, {})).toThrow()
        const validUpdate = validate(updateShelterSchema, { currentOccupancy: 150 })
        expect(validUpdate).toEqual({ currentOccupancy: 150 })
    })

    it('validates resource update schema and rejects empty payload', () => {
        expect(() => validate(updateResourceSchema, {})).toThrow()
        const validUpdate = validate(updateResourceSchema, { quantity: 200, status: 'ADEQUATE' })
        expect(validUpdate).toEqual({ quantity: 200, status: 'ADEQUATE' })
    })

    it('validates query parameters and sets defaults', () => {
        const query = validate(shelterQuerySchema, {
            status: 'OPEN',
            availableOnly: true,
            latitude: 24.86,
            longitude: 67.01
        })
        expect(query).toMatchObject({
            status: 'OPEN',
            availableOnly: true,
            latitude: 24.86,
            longitude: 67.01,
            radiusKm: 25,
            page: 1,
            limit: 20
        })
    })

    it('validates 24-character hexadecimal IDs', () => {
        const id = new mongoose.Types.ObjectId().toHexString()
        expect(validate(idSchema, id)).toBe(id)
        expect(() => validate(idSchema, 'invalid-id-xyz')).toThrow()
    })
})

describe('shelters - availability calculation & overcapacity prevention', () => {
    it('calculates available spaces correctly when occupancy is below capacity', () => {
        const result = calculateAvailability(300, 120, 'OPEN')
        expect(result.availableSpaces).toBe(180)
        expect(result.status).toBe('OPEN')
    })

    it('automatically transitions status to FULL when available spaces reach zero', () => {
        const result = calculateAvailability(200, 200, 'OPEN')
        expect(result.availableSpaces).toBe(0)
        expect(result.status).toBe('FULL')
    })

    it('automatically reopens to OPEN when capacity frees up and status was FULL', () => {
        const result = calculateAvailability(200, 150, 'FULL')
        expect(result.availableSpaces).toBe(50)
        expect(result.status).toBe('OPEN')
    })

    it('preserves CLOSED status even if available spaces exist', () => {
        const result = calculateAvailability(200, 0, 'CLOSED')
        expect(result.availableSpaces).toBe(200)
        expect(result.status).toBe('CLOSED')
    })

    it('throws error when occupancy is negative', () => {
        expect(() => calculateAvailability(200, -10)).toThrow('Occupancy cannot be negative')
    })

    it('strictly prevents overcapacity by rejecting occupancy exceeding capacity', () => {
        expect(() => calculateAvailability(200, 250)).toThrow('Current occupancy (250) cannot exceed total capacity (200)')
    })
})

describe('shelters - resource status assessment', () => {
    it('accurately assesses status based on quantity versus minimum threshold', () => {
        expect(assessResourceStatus(0, 50)).toBe('EXHAUSTED')
        expect(assessResourceStatus(-5, 50)).toBe('EXHAUSTED')
        expect(assessResourceStatus(20, 50)).toBe('CRITICAL') // <= 50 * 0.5 = 25
        expect(assessResourceStatus(40, 50)).toBe('LOW') // <= 50
        expect(assessResourceStatus(100, 50)).toBe('ADEQUATE')
    })

    it('preserves explicitly requested status over automated heuristic', () => {
        expect(assessResourceStatus(100, 50, 'CRITICAL')).toBe('CRITICAL')
    })
})

describe('shelters - distance calculation and nearby search', () => {
    it('calculates straight line Haversine distance between coordinates', () => {
        const locA = { latitude: 24.86, longitude: 67.01 } // Karachi
        const locB = { latitude: 25.39, longitude: 68.35 } // Hyderabad
        const distance = distanceKm(locA, locB)
        expect(distance).toBeGreaterThan(140)
        expect(distance).toBeLessThan(160)
        expect(distanceKm(locA, locA)).toBe(0)
    })

    it('filters shelters within the given radius and sorts closest first', async () => {
        const origin = { latitude: 24.86, longitude: 67.01 }
        const closeShelter = {
            _id: new mongoose.Types.ObjectId(),
            name: 'Close Shelter',
            location: { latitude: 24.9, longitude: 67.05 }, // ~6 km away
            totalCapacity: 100,
            currentOccupancy: 20,
            availableSpaces: 80,
            status: 'OPEN'
        }
        const farShelter = {
            _id: new mongoose.Types.ObjectId(),
            name: 'Far Shelter',
            location: { latitude: 27.5, longitude: 68.5 }, // ~300 km away
            totalCapacity: 200,
            currentOccupancy: 50,
            availableSpaces: 150,
            status: 'OPEN'
        }

        jest.spyOn(Shelter, 'find').mockReturnValue({
            lean: jest.fn().mockResolvedValue([closeShelter, farShelter])
        } as unknown as ReturnType<typeof Shelter.find>)

        const result = await listShelters({
            page: 1,
            limit: 10,
            latitude: origin.latitude,
            longitude: origin.longitude,
            radiusKm: 25
        })

        expect(result.items).toHaveLength(1)
        expect(result.items[0].name).toBe('Close Shelter')
        expect((result.items[0] as { approximateDistanceKm: number }).approximateDistanceKm).toBeLessThan(25)
        expect(result.searchContext).toBeDefined()
        expect(result.searchContext?.radiusKm).toBe(25)
    })
})

describe('shelters & resources - service workflows', () => {
    const shelterId = new mongoose.Types.ObjectId()
    const coordinatorId = new mongoose.Types.ObjectId()

    it('creates shelter with initial relief resources atomically', async () => {
        const input: CreateShelterInput = {
            name: 'SIMULATED - Thatta Relief Hub',
            address: 'National Highway, Thatta',
            location: { latitude: 24.747, longitude: 67.923 },
            totalCapacity: 400,
            currentOccupancy: 150,
            status: 'OPEN',
            initialResources: [
                {
                    category: 'FOOD',
                    resourceName: 'Rice packs',
                    quantity: 300,
                    unit: 'packs',
                    minimumThreshold: 50
                }
            ]
        }

        const fakeResource = new ReliefResource({

            _id: new mongoose.Types.ObjectId(),
            shelterId,
            ...input.initialResources![0],
            status: 'ADEQUATE'
        })

        jest.spyOn(Shelter, 'create').mockImplementation(((doc: unknown) => Promise.resolve(new Shelter(doc))) as never)
        jest.spyOn(ReliefResource, 'create').mockResolvedValue(fakeResource as never)

        const result = await createShelter(input, String(coordinatorId))

        expect(result.shelter.name).toBe('SIMULATED - Thatta Relief Hub')
        expect(result.shelter.availableSpaces).toBe(250)
        expect(result.resources).toHaveLength(1)
        expect(result.resources[0].resourceName).toBe('Rice packs')
    })

    it('updates shelter occupancy, recalculates availability, and saves', async () => {
        const existingShelter = new Shelter({
            _id: shelterId,
            name: 'Initial Name',
            address: 'Initial Address',
            location: { latitude: 24.8, longitude: 67.1 },
            totalCapacity: 500,
            currentOccupancy: 200,
            availableSpaces: 300,
            status: 'OPEN'
        })

        jest.spyOn(existingShelter, 'save').mockResolvedValue(existingShelter)
        jest.spyOn(Shelter, 'findById').mockResolvedValue(existingShelter as unknown as ReturnType<typeof Shelter.findById>)

        const updated = await updateShelter(String(shelterId), {
            currentOccupancy: 500
        })

        expect(updated.currentOccupancy).toBe(500)
        expect(updated.availableSpaces).toBe(0)
        expect(updated.status).toBe('FULL')
    })

    it('rejects update exceeding total capacity with 400 Bad Request', async () => {
        const existingShelter = new Shelter({
            _id: shelterId,
            name: 'Initial Name',
            address: 'Initial Address',
            location: { latitude: 24.8, longitude: 67.1 },
            totalCapacity: 200,
            currentOccupancy: 100,
            availableSpaces: 100,
            status: 'OPEN'
        })

        jest.spyOn(Shelter, 'findById').mockResolvedValue(existingShelter as unknown as ReturnType<typeof Shelter.findById>)

        await expect(updateShelter(String(shelterId), { currentOccupancy: 250 })).rejects.toThrow(
            'Current occupancy (250) cannot exceed total capacity (200)'
        )
    })

    it('throws 404 when updating non-existent shelter', async () => {
        jest.spyOn(Shelter, 'findById').mockResolvedValue(null as unknown as ReturnType<typeof Shelter.findById>)
        await expect(updateShelter(String(shelterId), { currentOccupancy: 50 })).rejects.toThrow('Shelter not found')
    })

    it('retrieves shelter along with its associated relief resources', async () => {
        const fakeShelter = new Shelter({
            _id: shelterId,
            name: 'Thatta Shelter',
            totalCapacity: 200,
            currentOccupancy: 50,
            availableSpaces: 150,
            status: 'OPEN'
        })

        const fakeResources = [
            { shelterId, category: 'FOOD', resourceName: 'Ration box', quantity: 200, unit: 'boxes', status: 'ADEQUATE' }
        ]

        jest.spyOn(Shelter, 'findById').mockResolvedValue(fakeShelter as unknown as ReturnType<typeof Shelter.findById>)
        jest.spyOn(ReliefResource, 'find').mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(fakeResources)
        } as unknown as ReturnType<typeof ReliefResource.find>)

        const result = await getShelterById(String(shelterId))
        expect(result.shelter.name).toBe('Thatta Shelter')
        expect(result.resources).toHaveLength(1)
        expect(result.resources[0].category).toBe('FOOD')
    })

    it('creates or updates resource for a shelter and assesses status', async () => {
        const fakeShelter = new Shelter({ _id: shelterId, name: 'Active Shelter' })
        jest.spyOn(Shelter, 'findById').mockResolvedValue(fakeShelter as unknown as ReturnType<typeof Shelter.findById>)

        const createSpy = jest.spyOn(ReliefResource, 'create').mockImplementation(((doc: unknown) =>
            Promise.resolve(new ReliefResource(doc))) as never)

        const resource = await createOrUpdateResource(
            String(shelterId),
            {
                category: 'DRINKING_WATER',
                resourceName: 'Clean water bottles',
                quantity: 5,
                unit: 'cans',
                minimumThreshold: 20 // 5 <= 20*0.5 -> CRITICAL
            },
            String(coordinatorId)
        )

        expect(createSpy).toHaveBeenCalledTimes(1)
        expect(resource.status).toBe('CRITICAL')
        expect(resource.minimumThreshold).toBe(20)
    })

    it('updates existing resource quantity and automatically updates status', async () => {
        const resourceId = new mongoose.Types.ObjectId()
        const existingResource = new ReliefResource({
            _id: resourceId,
            shelterId,
            category: 'FOOD',
            resourceName: 'Rations',
            quantity: 10,
            unit: 'bags',
            status: 'CRITICAL',
            minimumThreshold: 50
        })

        jest.spyOn(existingResource, 'save').mockResolvedValue(existingResource)
        jest.spyOn(ReliefResource, 'findOne').mockResolvedValue(
            existingResource as unknown as ReturnType<typeof ReliefResource.findOne>
        )

        const updated = await updateResource(
            String(shelterId),
            String(resourceId),
            { quantity: 200 },
            String(coordinatorId)
        )

        expect(updated.quantity).toBe(200)
        expect(updated.status).toBe('ADEQUATE')
    })

    it('gets resources specifically for a shelter', async () => {
        const fakeShelter = new Shelter({ _id: shelterId, name: 'Active Shelter' })
        jest.spyOn(Shelter, 'findById').mockResolvedValue(fakeShelter as unknown as ReturnType<typeof Shelter.findById>)
        jest.spyOn(ReliefResource, 'find').mockReturnValue({
            sort: jest.fn().mockResolvedValue([{ category: 'FOOD' }, { category: 'BLANKETS' }])
        } as unknown as ReturnType<typeof ReliefResource.find>)

        const resources = await getShelterResources(String(shelterId))
        expect(resources).toHaveLength(2)
    })

    it('seeds Sindh demo shelters and relief inventories idempotently', async () => {
        let findShelterCount = 0
        jest.spyOn(Shelter, 'findOne').mockImplementation((() => {
            findShelterCount++
            if (findShelterCount === 1) {
                return Promise.resolve(new Shelter(SINDH_DEMO_SHELTERS[0]))
            }
            return Promise.resolve(null)
        }) as unknown as typeof Shelter.findOne)

        jest.spyOn(ReliefResource, 'findOne').mockResolvedValue(null as unknown as ReturnType<typeof ReliefResource.findOne>)

        const shelterCreateSpy = jest
            .spyOn(Shelter, 'create')
            .mockImplementation(((doc: unknown) => Promise.resolve(new Shelter(doc))) as never)
        const resourceCreateSpy = jest
            .spyOn(ReliefResource, 'create')
            .mockImplementation(((doc: unknown) => Promise.resolve(new ReliefResource(doc))) as never)
        jest.spyOn(ReliefResource, 'find').mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
        } as unknown as ReturnType<typeof ReliefResource.find>)

        const result = await seedDemoShelters()

        expect(result).toHaveLength(5)
        // 1 was existing, 4 created
        expect(shelterCreateSpy).toHaveBeenCalledTimes(4)
        expect(resourceCreateSpy).toHaveBeenCalled()
    })
})

describe('shelters - fixtures integrity', () => {
    it('verifies that all Sindh demo fixtures are simulated with valid coordinates and inventories', () => {
        expect(SINDH_DEMO_SHELTERS.length).toBe(5)
        for (const shelter of SINDH_DEMO_SHELTERS) {
            expect(shelter.isSimulated).toBe(true)
            expect(shelter.demoKey).toBeTruthy()
            expect(shelter.name.startsWith('SIMULATED -')).toBe(true)
            expect(shelter.location.latitude).toBeGreaterThanOrEqual(-90)
            expect(shelter.location.latitude).toBeLessThanOrEqual(90)
            expect(shelter.location.longitude).toBeGreaterThanOrEqual(-180)
            expect(shelter.location.longitude).toBeLessThanOrEqual(180)
            expect(shelter.totalCapacity).toBeGreaterThan(0)
            expect(shelter.initialResources).toBeDefined()
            expect(shelter.initialResources!.length).toBeGreaterThanOrEqual(5)
            // Includes all 5 core resource categories
            const categories = shelter.initialResources!.map((r) => r.category)
            expect(categories).toContain('FOOD')
            expect(categories).toContain('DRINKING_WATER')
            expect(categories).toContain('MEDICAL_SUPPLIES')
            expect(categories).toContain('BLANKETS')
            expect(categories).toContain('HYGIENE_KITS')
        }
    })
})

describe('shelters - HTTP router & RBAC protection', () => {
    const adminId = new mongoose.Types.ObjectId()
    const userId = new mongoose.Types.ObjectId()
    const validShelterId = new mongoose.Types.ObjectId().toHexString()

    config.TOKENS.ACCESS.SECRET = config.TOKENS.ACCESS.SECRET || 'test-secret-key-32-bytes-minimum-length-needed'
    const adminCookie = `accessToken=${jwt.generateToken({ userId: String(adminId) }, config.TOKENS.ACCESS.SECRET, 3600)}`
    const userCookie = `accessToken=${jwt.generateToken({ userId: String(userId) }, config.TOKENS.ACCESS.SECRET, 3600)}`

    beforeEach(() => {
        jest.spyOn(query, 'findUserById').mockImplementation(((id: string) => {
            if (id === String(adminId)) {
                return Promise.resolve({
                    _id: adminId,
                    name: 'Admin Coordinator',
                    role: EUserRoles.ADMIN
                })
            }
            if (id === String(userId)) {
                return Promise.resolve({
                    _id: userId,
                    name: 'Regular User',
                    role: EUserRoles.USER
                })
            }
            return Promise.resolve(null)
        }) as never)
    })

    it('GET /api/shelters is publicly accessible and returns 200', async () => {
        jest.spyOn(Shelter, 'find').mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([])
        } as unknown as ReturnType<typeof Shelter.find>)
        jest.spyOn(Shelter, 'countDocuments').mockResolvedValue(0 as unknown as number)

        const res = await request(app).get('/api/shelters')
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.items).toEqual([])
    })

    it('GET /api/shelters/:id rejects malformed hexadecimal ID with 400', async () => {
        const res = await request(app).get('/api/shelters/invalid-id-xyz')
        expect(res.status).toBe(400)
        expect(res.body.success).toBe(false)
    })

    it('POST /api/shelters rejects unauthenticated request with 401', async () => {
        const res = await request(app).post('/api/shelters').send({ name: 'Test Shelter' })
        expect(res.status).toBe(401)
        expect(res.body.message).toContain('Authentication required')
    })

    it('POST /api/shelters rejects non-admin user with 403', async () => {
        const res = await request(app)
            .post('/api/shelters')
            .set('Cookie', [userCookie])
            .send({
                name: 'SIMULATED - Shelter',
                address: 'Some Address',
                location: { latitude: 24.8, longitude: 67.1 },
                totalCapacity: 100
            })
        expect(res.status).toBe(403)
        expect(res.body.message).toContain('Coordinator (admin) access required')
    })

    it('POST /api/shelters allows authorized coordinator and returns 201', async () => {
        jest.spyOn(Shelter, 'create').mockImplementation(((doc: unknown) => Promise.resolve(new Shelter(doc))) as never)

        const res = await request(app)
            .post('/api/shelters')
            .set('Cookie', [adminCookie])
            .send({
                name: 'SIMULATED - Authorized Coordinator Shelter',
                address: 'Main Boulevard, Karachi',
                location: { latitude: 24.86, longitude: 67.01 },
                totalCapacity: 250,
                currentOccupancy: 50
            })
        expect(res.status).toBe(201)
        expect(res.body.success).toBe(true)
        expect(res.body.data.shelter.name).toBe('SIMULATED - Authorized Coordinator Shelter')
    })

    it('POST /api/shelters/:id/resources rejects unauthenticated request with 401', async () => {
        const res = await request(app).post(`/api/shelters/${validShelterId}/resources`).send({})
        expect(res.status).toBe(401)
    })

    it('PATCH /api/shelters/:id rejects unauthenticated request with 401', async () => {
        const res = await request(app).patch(`/api/shelters/${validShelterId}`).send({ currentOccupancy: 10 })
        expect(res.status).toBe(401)
    })

    it('POST /api/shelters/seed rejects non-admin user with 403', async () => {
        const res = await request(app).post('/api/shelters/seed').set('Cookie', [userCookie])
        expect(res.status).toBe(403)
    })
})

