import mongoose, { FilterQuery } from 'mongoose'
import Shelter, { ShelterRecord } from './models/shelter.model'
import ReliefResource, { ReliefResourceRecord } from './models/relief-resource.model'
import {
    CreateShelterInput,
    UpdateShelterInput,
    CreateResourceInput,
    UpdateResourceInput,
    ShelterStatus,
    ResourceStatus,
    ShelterLocation
} from './types'
import { SINDH_DEMO_SHELTERS } from './fixtures'
import { CustomError } from '../../utils/errors'

export interface ShelterQuery {
    page: number
    limit: number
    status?: ShelterStatus
    availableOnly?: boolean
    minAvailableSpaces?: number
    latitude?: number
    longitude?: number
    radiusKm?: number
    isSimulated?: boolean
}

export function distanceKm(a: ShelterLocation, b: ShelterLocation): number {
    const rad = (n: number) => (n * Math.PI) / 180
    const h =
        Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
        Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)))
}

export function calculateAvailability(
    totalCapacity: number,
    currentOccupancy: number,
    requestedStatus?: ShelterStatus
): { availableSpaces: number; status: ShelterStatus } {
    if (currentOccupancy < 0) {
        throw new CustomError('Occupancy cannot be negative', 400)
    }
    if (currentOccupancy > totalCapacity) {
        throw new CustomError(`Current occupancy (${currentOccupancy}) cannot exceed total capacity (${totalCapacity})`, 400)
    }

    const availableSpaces = Math.max(0, totalCapacity - currentOccupancy)

    let status: ShelterStatus
    if (requestedStatus === 'CLOSED') {
        status = 'CLOSED'
    } else if (availableSpaces === 0) {
        status = 'FULL'
    } else if (requestedStatus === 'FULL' && availableSpaces > 0) {
        // Automatically open if space is available and not closed
        status = 'OPEN'
    } else {
        status = requestedStatus || 'OPEN'
    }

    return { availableSpaces, status }
}

export function assessResourceStatus(quantity: number, threshold: number, requestedStatus?: ResourceStatus): ResourceStatus {
    if (requestedStatus) return requestedStatus
    if (quantity <= 0) return 'EXHAUSTED'
    if (quantity <= threshold * 0.5) return 'CRITICAL'
    if (quantity <= threshold) return 'LOW'
    return 'ADEQUATE'
}

export async function createShelter(input: CreateShelterInput, coordinatorId?: string) {
    const occupancy = input.currentOccupancy ?? 0
    const { availableSpaces, status } = calculateAvailability(input.totalCapacity, occupancy, input.status)

    const shelter = await Shelter.create({
        ...input,
        currentOccupancy: occupancy,
        availableSpaces,
        status
    })

    const resources: ReliefResourceRecord[] = []
    if (input.initialResources && input.initialResources.length > 0) {
        for (const resInput of input.initialResources) {
            const threshold = resInput.minimumThreshold ?? 10
            const resStatus = assessResourceStatus(resInput.quantity, threshold, resInput.status)
            const createdRes = await ReliefResource.create({
                ...resInput,
                shelterId: shelter._id,
                minimumThreshold: threshold,
                status: resStatus,
                updatedBy: coordinatorId ? new mongoose.Types.ObjectId(coordinatorId) : null
            })
            resources.push(createdRes)
        }
    }

    return {
        shelter,
        resources
    }
}

export async function updateShelter(id: string, input: UpdateShelterInput) {
    const shelter = await Shelter.findById(id)
    if (!shelter) throw new CustomError('Shelter not found', 404)

    const totalCapacity = input.totalCapacity ?? shelter.totalCapacity
    const currentOccupancy = input.currentOccupancy ?? shelter.currentOccupancy
    const requestedStatus = input.status ?? shelter.status

    const { availableSpaces, status } = calculateAvailability(totalCapacity, currentOccupancy, requestedStatus)

    if (input.name !== undefined) shelter.name = input.name
    if (input.address !== undefined) shelter.address = input.address
    if (input.location !== undefined) shelter.location = input.location
    if (input.contactInformation !== undefined) shelter.contactInformation = input.contactInformation
    if (input.notes !== undefined) shelter.notes = input.notes

    shelter.totalCapacity = totalCapacity
    shelter.currentOccupancy = currentOccupancy
    shelter.availableSpaces = availableSpaces
    shelter.status = status

    await shelter.save()
    return shelter
}

export async function listShelters(query: ShelterQuery) {
    const filter: FilterQuery<ShelterRecord> = {}

    if (query.status) {
        filter.status = query.status
    }
    if (query.availableOnly) {
        filter.status = 'OPEN'
        filter.availableSpaces = { $gt: 0 }
    }
    if (query.minAvailableSpaces !== undefined && query.minAvailableSpaces > 0) {
        filter.availableSpaces = { ...(filter.availableSpaces as Record<string, unknown>), $gte: query.minAvailableSpaces }
    }
    if (query.isSimulated !== undefined) {
        filter.isSimulated = query.isSimulated
    }

    // Nearby radius search if coordinates are supplied
    if (query.latitude !== undefined && query.longitude !== undefined) {
        const queryLoc: ShelterLocation = { latitude: query.latitude, longitude: query.longitude }
        const radius = query.radiusKm ?? 25

        const allCandidates = await Shelter.find(filter).lean()
        const withDistance = allCandidates
            .map((shelter) => {
                const distance = distanceKm(queryLoc, shelter.location)
                return {
                    ...shelter,
                    approximateDistanceKm: Math.round(distance * 100) / 100,
                    distanceType: 'APPROXIMATE_STRAIGHT_LINE_KM'
                }
            })
            .filter((item) => item.approximateDistanceKm <= radius)
            .sort((a, b) => a.approximateDistanceKm - b.approximateDistanceKm)

        const total = withDistance.length
        const startIndex = (query.page - 1) * query.limit
        const items = withDistance.slice(startIndex, startIndex + query.limit)

        return {
            items,
            pagination: {
                page: query.page,
                limit: query.limit,
                total,
                totalPages: Math.ceil(total / query.limit)
            },
            searchContext: {
                centerLocation: queryLoc,
                radiusKm: radius,
                distanceType: 'APPROXIMATE_STRAIGHT_LINE_KM',
                note: 'Decision support only; straight-line distance is not travel time.'
            }
        }
    }

    const [items, total] = await Promise.all([
        Shelter.find(filter)
            .sort({ availableSpaces: -1, createdAt: -1 })
            .skip((query.page - 1) * query.limit)
            .limit(query.limit)
            .lean(),
        Shelter.countDocuments(filter)
    ])

    return {
        items,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit)
        }
    }
}

export async function getShelterById(id: string) {
    const shelter = await Shelter.findById(id)
    if (!shelter) throw new CustomError('Shelter not found', 404)

    const resources = await ReliefResource.find({ shelterId: shelter._id }).sort({ category: 1 }).lean()
    return {
        shelter,
        resources
    }
}

export async function createOrUpdateResource(shelterId: string, input: CreateResourceInput, coordinatorId?: string) {
    const shelter = await Shelter.findById(shelterId)
    if (!shelter) throw new CustomError('Shelter not found', 404)

    const threshold = input.minimumThreshold ?? 10
    const status = assessResourceStatus(input.quantity, threshold, input.status)

    const resource = await ReliefResource.create({
        ...input,
        shelterId: shelter._id,
        minimumThreshold: threshold,
        status,
        lastRestockedAt: new Date(),
        updatedBy: coordinatorId ? new mongoose.Types.ObjectId(coordinatorId) : null
    })

    return resource
}

export async function updateResource(
    shelterId: string,
    resourceId: string,
    input: UpdateResourceInput,
    coordinatorId?: string
) {
    const resource = await ReliefResource.findOne({ _id: resourceId, shelterId })
    if (!resource) throw new CustomError('Relief resource not found for this shelter', 404)

    if (input.category !== undefined) resource.category = input.category
    if (input.resourceName !== undefined) resource.resourceName = input.resourceName
    if (input.quantity !== undefined) resource.quantity = input.quantity
    if (input.unit !== undefined) resource.unit = input.unit
    if (input.minimumThreshold !== undefined) resource.minimumThreshold = input.minimumThreshold
    if (input.notes !== undefined) resource.notes = input.notes

    const threshold = resource.minimumThreshold
    resource.status = assessResourceStatus(resource.quantity, threshold, input.status)
    resource.lastRestockedAt = new Date()
    if (coordinatorId) resource.updatedBy = new mongoose.Types.ObjectId(coordinatorId)

    await resource.save()
    return resource
}

export async function getShelterResources(shelterId: string) {
    const shelter = await Shelter.findById(shelterId)
    if (!shelter) throw new CustomError('Shelter not found', 404)

    return ReliefResource.find({ shelterId: shelter._id }).sort({ category: 1 })
}

export async function seedDemoShelters() {
    const seededShelters = []

    for (const fixture of SINDH_DEMO_SHELTERS) {
        let shelter = await Shelter.findOne({ demoKey: fixture.demoKey })
        if (!shelter) {
            const { availableSpaces, status } = calculateAvailability(
                fixture.totalCapacity,
                fixture.currentOccupancy ?? 0,
                fixture.status
            )
            shelter = await Shelter.create({
                name: fixture.name,
                address: fixture.address,
                location: fixture.location,
                totalCapacity: fixture.totalCapacity,
                currentOccupancy: fixture.currentOccupancy ?? 0,
                availableSpaces,
                status,
                contactInformation: fixture.contactInformation,
                notes: fixture.notes,
                isSimulated: true,
                demoKey: fixture.demoKey
            })
        }

        if (fixture.initialResources) {
            for (const resInput of fixture.initialResources) {
                const existingRes = await ReliefResource.findOne({ demoKey: resInput.demoKey })
                if (!existingRes) {
                    const threshold = resInput.minimumThreshold ?? 10
                    await ReliefResource.create({
                        ...resInput,
                        shelterId: shelter._id,
                        minimumThreshold: threshold,
                        status: assessResourceStatus(resInput.quantity, threshold, resInput.status),
                        isSimulated: true
                    })
                }
            }
        }

        const resources = await ReliefResource.find({ shelterId: shelter._id }).lean()
        seededShelters.push({ shelter, resources })
    }

    return seededShelters
}

