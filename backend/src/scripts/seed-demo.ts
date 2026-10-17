import dotenvFlow from 'dotenv-flow'
import mongoose from 'mongoose'
import Incident from '../APIs/response/models/incident.model'
import Team from '../APIs/response/models/team.model'
import Assignment from '../APIs/response/models/assignment.model'
import { calculatePriority } from '../APIs/response/priority.service'
import { IncidentInput, TeamInput } from '../APIs/response/types'
import { incidentSchema, teamSchema, validate } from '../APIs/response/validation'
dotenvFlow.config({ silent: true })
let stage = 'guard'
async function seed() {
    if (process.env.DEMO_MODE !== 'true' || process.env.NODE_ENV !== 'development' || process.env.ENV === 'production')
        throw new Error('Demo flag required; production forbidden')
    const uri = process.env.DEMO_DATABASE_URL
    if (!uri || !new URL(uri).pathname.endsWith('_demo')) throw new Error('Separate _demo database required')
    stage = 'connect'
    await mongoose.connect(uri)
    stage = 'indexes'
    await Promise.all([Incident.init(), Team.init(), Assignment.init()])
    const full = { elderly: 0, children: 0, disabled: 0, medicalNeeds: 0 }
    const inputs: IncidentInput[] = [
        {
            reporterName: '[SIMULATED] Critical household',
            emergencyType: 'FLOOD',
            description: '[SIMULATED] High water around a fictional Karachi household.',
            peopleAffected: 6,
            location: { latitude: 24.86, longitude: 67.01 },
            immediateDanger: true,
            waterLevel: 'HIGH',
            vulnerablePeople: { elderly: 1, children: 2, disabled: 1, medicalNeeds: 1 }
        },
        {
            reporterName: '[SIMULATED] Medical report',
            emergencyType: 'MEDICAL',
            description: '[SIMULATED] Fictional medical assistance requested.',
            peopleAffected: 1,
            location: { latitude: 24.89, longitude: 67.06 },
            immediateDanger: true,
            waterLevel: 'LOW',
            vulnerablePeople: { ...full, medicalNeeds: 1 }
        },
        {
            reporterName: '[SIMULATED] Stranded family',
            emergencyType: 'STRANDED',
            description: '[SIMULATED] Fictional family needs evacuation.',
            peopleAffected: 4,
            location: { latitude: 24.91, longitude: 67.09 },
            immediateDanger: false,
            waterLevel: 'MODERATE',
            vulnerablePeople: { ...full, children: 2 }
        },
        {
            reporterName: '[SIMULATED] Supply request',
            emergencyType: 'SUPPLIES',
            description: '[SIMULATED] Fictional group needs food and water.',
            peopleAffected: 8,
            location: { latitude: 24.88, longitude: 67.04 },
            immediateDanger: false,
            waterLevel: 'LOW',
            vulnerablePeople: full
        },
        {
            reporterName: '[SIMULATED] Location unverified',
            emergencyType: 'FLOOD',
            description: '[SIMULATED] No coordinates provided for this report.',
            peopleAffected: 2,
            waterLevel: 'UNKNOWN'
        },
        {
            reporterName: '[SIMULATED] Incomplete risk report',
            emergencyType: 'FLOOD',
            description: '[SIMULATED] Vulnerability information is incomplete.',
            peopleAffected: 3,
            location: { latitude: 24.93, longitude: 67.08 },
            vulnerablePeople: { children: 1 }
        }
    ]
    const teams: TeamInput[] = [
        {
            name: '[SIMULATED] Boat crew',
            teamCode: 'DEMO-BOAT',
            capabilities: ['WATER_RESCUE', 'EVACUATION'],
            location: { latitude: 24.85, longitude: 67.02 },
            capacity: 8
        },
        {
            name: '[SIMULATED] Medical crew',
            teamCode: 'DEMO-MEDICAL',
            capabilities: ['MEDICAL'],
            location: { latitude: 24.9, longitude: 67.05 },
            capacity: 4
        },
        {
            name: '[SIMULATED] Supply crew',
            teamCode: 'DEMO-SUPPLY',
            capabilities: ['SUPPLY_DELIVERY'],
            location: { latitude: 24.87, longitude: 67.03 },
            capacity: 10
        },
        {
            name: '[SIMULATED] Busy evacuation crew',
            teamCode: 'DEMO-BUSY',
            capabilities: ['EVACUATION'],
            location: { latitude: 24.92, longitude: 67.09 },
            capacity: 6
        },
        {
            name: '[SIMULATED] Offline fire crew',
            teamCode: 'DEMO-OFFLINE',
            capabilities: ['FIRE_RESPONSE'],
            location: { latitude: 24.94, longitude: 67.1 },
            capacity: 5,
            status: 'OFFLINE'
        }
    ]
    stage = 'fixtures'
    await mongoose.connection.transaction(async (session) => {
        for (const [i, raw] of inputs.entries()) {
            const input = validate<IncidentInput>(incidentSchema, raw)
            const key = `karachi-flood-v1-incident-${i}`
            await Incident.updateOne(
                { demoKey: key, isSimulated: true },
                {
                    $setOnInsert: {
                        ...input,
                        ...calculatePriority(input),
                        locationVerificationRequired: !input.location,
                        demoKey: key,
                        isSimulated: true,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                },
                { upsert: true, runValidators: true, session, timestamps: false }
            )
        }
        for (const raw of teams) {
            const input = validate<TeamInput>(teamSchema, raw)
            await Team.updateOne(
                { demoKey: input.teamCode, isSimulated: true },
                { $setOnInsert: { ...input, demoKey: input.teamCode, isSimulated: true, createdAt: new Date(), updatedAt: new Date() } },
                { upsert: true, runValidators: true, session, timestamps: false }
            )
        }
        const busy = await Team.findOne({ demoKey: 'DEMO-BUSY', isSimulated: true }).session(session)
        const incident = await Incident.findOne({ demoKey: 'karachi-flood-v1-incident-2', isSimulated: true }).session(session)
        const exists = await Assignment.exists({ demoKey: 'karachi-flood-v1-busy' }).session(session)
        if (!exists && busy && incident && busy.status === 'AVAILABLE' && incident.status === 'PENDING') {
            await Assignment.create(
                [
                    {
                        incidentId: incident._id,
                        teamId: busy._id,
                        isSimulated: true,
                        demoKey: 'karachi-flood-v1-busy',
                        notes: 'SIMULATED seed assignment'
                    }
                ],
                { session }
            )
            busy.status = 'BUSY'
            busy.currentIncident = incident._id
            incident.status = 'ASSIGNED'
            incident.assignedTeam = busy._id
            await busy.save({ session })
            await incident.save({ session })
        }
    })
    process.stdout.write('Simulated Karachi seed complete. Existing records were not reset. No dispatch performed.\n')
}
async function run() {
    try {
        await seed()
    } catch (error) {
        process.stderr.write(
            'Demo seed stage: ' +
                stage +
                '; error type: ' +
                (error instanceof Error ? error.name : 'unknown') +
                '; code: ' +
                (typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'none') +
                '\n'
        )
        process.stderr.write('Demo seed failed. Check demo flags, separate _demo database, network access, and transaction support.\n')
        process.exitCode = 1
    } finally {
        await mongoose.disconnect()
    }
}
void run()
