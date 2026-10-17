export const SHELTER_STATUSES = ['OPEN', 'FULL', 'CLOSED'] as const
export type ShelterStatus = (typeof SHELTER_STATUSES)[number]

export const RESOURCE_CATEGORIES = [
    'FOOD',
    'DRINKING_WATER',
    'MEDICAL_SUPPLIES',
    'BLANKETS',
    'HYGIENE_KITS',
    'OTHER'
] as const
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number]

export const RESOURCE_STATUSES = ['ADEQUATE', 'LOW', 'CRITICAL', 'EXHAUSTED'] as const
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number]

export interface ShelterLocation {
    latitude: number
    longitude: number
}

export interface ContactInformation {
    contactPerson?: string | null
    phone?: string | null
    email?: string | null
}

export interface IShelter {
    name: string
    address: string
    location: ShelterLocation
    totalCapacity: number
    currentOccupancy: number
    availableSpaces: number
    status: ShelterStatus
    contactInformation?: ContactInformation
    notes?: string | null
    isSimulated: boolean
    demoKey?: string
    createdAt?: Date
    updatedAt?: Date
}

export interface IReliefResource {
    shelterId: import('mongoose').Types.ObjectId
    category: ResourceCategory
    resourceName: string
    quantity: number
    unit: string
    status: ResourceStatus
    minimumThreshold: number
    notes?: string | null
    lastRestockedAt: Date
    updatedBy?: import('mongoose').Types.ObjectId | null
    isSimulated: boolean
    demoKey?: string
    createdAt?: Date
    updatedAt?: Date
}

export interface CreateResourceInput {
    category: ResourceCategory
    resourceName: string
    quantity: number
    unit: string
    status?: ResourceStatus
    minimumThreshold?: number
    notes?: string
    isSimulated?: boolean
    demoKey?: string
}

export interface CreateShelterInput {
    name: string
    address: string
    location: ShelterLocation
    totalCapacity: number
    currentOccupancy?: number
    status?: ShelterStatus
    contactInformation?: ContactInformation
    notes?: string
    isSimulated?: boolean
    demoKey?: string
    initialResources?: CreateResourceInput[]
}

export interface UpdateShelterInput {
    name?: string
    address?: string
    location?: ShelterLocation
    totalCapacity?: number
    currentOccupancy?: number
    status?: ShelterStatus
    contactInformation?: ContactInformation
    notes?: string
}

export interface UpdateResourceInput {
    category?: ResourceCategory
    resourceName?: string
    quantity?: number
    unit?: string
    status?: ResourceStatus
    minimumThreshold?: number
    notes?: string
}

