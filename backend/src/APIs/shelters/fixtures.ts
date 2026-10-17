import { CreateShelterInput } from './types'

export const SINDH_DEMO_SHELTERS: CreateShelterInput[] = [
    {
        name: 'SIMULATED - Government Degree College Relief Shelter, Thatta',
        address: 'Main National Highway, Near District Sports Complex, Thatta, Sindh',
        location: { latitude: 24.747, longitude: 67.923 },
        totalCapacity: 350,
        currentOccupancy: 210,
        status: 'OPEN',
        contactInformation: {
            contactPerson: 'Liaison Officer Munir Ahmed',
            phone: '+92 300 2345671',
            email: 'thatta.shelter1@simulated.resqlink.org'
        },
        notes: 'SIMULATED relief center equipped with clean water filtration and medical post. Decision support only.',
        isSimulated: true,
        demoKey: 'DEMO_SHELTER_THATTA_01',
        initialResources: [
            {
                category: 'FOOD',
                resourceName: 'Ready-to-eat dry ration boxes',
                quantity: 1200,
                unit: 'packs',
                status: 'ADEQUATE',
                minimumThreshold: 200,
                isSimulated: true,
                demoKey: 'DEMO_RES_THATTA_FOOD'
            },
            {
                category: 'DRINKING_WATER',
                resourceName: 'Bottled mineral water 5L cans',
                quantity: 850,
                unit: 'cans',
                status: 'ADEQUATE',
                minimumThreshold: 150,
                isSimulated: true,
                demoKey: 'DEMO_RES_THATTA_WATER'
            },
            {
                category: 'MEDICAL_SUPPLIES',
                resourceName: 'First aid trauma & anti-venom kits',
                quantity: 45,
                unit: 'kits',
                status: 'ADEQUATE',
                minimumThreshold: 10,
                isSimulated: true,
                demoKey: 'DEMO_RES_THATTA_MED'
            },
            {
                category: 'BLANKETS',
                resourceName: 'Thermal wool blankets',
                quantity: 320,
                unit: 'pieces',
                status: 'ADEQUATE',
                minimumThreshold: 50,
                isSimulated: true,
                demoKey: 'DEMO_RES_THATTA_BLANKET'
            },
            {
                category: 'HYGIENE_KITS',
                resourceName: 'Family hygiene & sanitization kits',
                quantity: 180,
                unit: 'kits',
                status: 'ADEQUATE',
                minimumThreshold: 30,
                isSimulated: true,
                demoKey: 'DEMO_RES_THATTA_HYGIENE'
            }
        ]
    },
    {
        name: 'SIMULATED - Mehar Model High School Camp, Dadu',
        address: 'Bypass Road, Mehar, District Dadu, Sindh',
        location: { latitude: 27.181, longitude: 67.822 },
        totalCapacity: 200,
        currentOccupancy: 200,
        status: 'FULL',
        contactInformation: {
            contactPerson: 'Principal Ghulam Rasool',
            phone: '+92 301 3456782',
            email: 'dadu.mehar@simulated.resqlink.org'
        },
        notes: 'SIMULATED facility at full capacity; overflow diverted to Sujawal or Radhan. Decision support only.',
        isSimulated: true,
        demoKey: 'DEMO_SHELTER_DADU_01',
        initialResources: [
            {
                category: 'FOOD',
                resourceName: 'Cooked emergency meal packets',
                quantity: 80,
                unit: 'packs',
                status: 'CRITICAL',
                minimumThreshold: 150,
                isSimulated: true,
                demoKey: 'DEMO_RES_DADU_FOOD'
            },
            {
                category: 'DRINKING_WATER',
                resourceName: 'Clean water storage jerrycans',
                quantity: 60,
                unit: 'jerrycans',
                status: 'LOW',
                minimumThreshold: 100,
                isSimulated: true,
                demoKey: 'DEMO_RES_DADU_WATER'
            },
            {
                category: 'MEDICAL_SUPPLIES',
                resourceName: 'Basic pain relief, ORS & fever meds',
                quantity: 12,
                unit: 'kits',
                status: 'LOW',
                minimumThreshold: 20,
                isSimulated: true,
                demoKey: 'DEMO_RES_DADU_MED'
            },
            {
                category: 'BLANKETS',
                resourceName: 'Fleece blankets',
                quantity: 25,
                unit: 'pieces',
                status: 'CRITICAL',
                minimumThreshold: 60,
                isSimulated: true,
                demoKey: 'DEMO_RES_DADU_BLANKET'
            },
            {
                category: 'HYGIENE_KITS',
                resourceName: 'Water purification chlorination tablets',
                quantity: 40,
                unit: 'packets',
                status: 'LOW',
                minimumThreshold: 80,
                isSimulated: true,
                demoKey: 'DEMO_RES_DADU_HYGIENE'
            }
        ]
    },
    {
        name: 'SIMULATED - Sujawal Public Hall Emergency Center, Sujawal',
        address: 'Badin-Sujawal Link Road, Sujawal, Sindh',
        location: { latitude: 24.606, longitude: 68.077 },
        totalCapacity: 150,
        currentOccupancy: 65,
        status: 'OPEN',
        contactInformation: {
            contactPerson: 'Community Coordinator Parveen Bibi',
            phone: '+92 302 4567893'
        },
        notes: 'SIMULATED community center hosting coastal displaced families. Decision support only.',
        isSimulated: true,
        demoKey: 'DEMO_SHELTER_SUJAWAL_01',
        initialResources: [
            {
                category: 'FOOD',
                resourceName: 'Rice and lentil emergency bags',
                quantity: 350,
                unit: 'bags',
                status: 'ADEQUATE',
                minimumThreshold: 50,
                isSimulated: true,
                demoKey: 'DEMO_RES_SUJAWAL_FOOD'
            },
            {
                category: 'DRINKING_WATER',
                resourceName: '10L clean water containers',
                quantity: 200,
                unit: 'cans',
                status: 'ADEQUATE',
                minimumThreshold: 40,
                isSimulated: true,
                demoKey: 'DEMO_RES_SUJAWAL_WATER'
            },
            {
                category: 'MEDICAL_SUPPLIES',
                resourceName: 'Maternal and infant wellness packs',
                quantity: 30,
                unit: 'kits',
                status: 'ADEQUATE',
                minimumThreshold: 10,
                isSimulated: true,
                demoKey: 'DEMO_RES_SUJAWAL_MED'
            },
            {
                category: 'BLANKETS',
                resourceName: 'Cotton blankets',
                quantity: 110,
                unit: 'pieces',
                status: 'ADEQUATE',
                minimumThreshold: 30,
                isSimulated: true,
                demoKey: 'DEMO_RES_SUJAWAL_BLANKET'
            },
            {
                category: 'HYGIENE_KITS',
                resourceName: 'Sanitary napkins and antiseptic soaps',
                quantity: 95,
                unit: 'kits',
                status: 'ADEQUATE',
                minimumThreshold: 25,
                isSimulated: true,
                demoKey: 'DEMO_RES_SUJAWAL_HYGIENE'
            }
        ]
    },
    {
        name: 'SIMULATED - Khairpur Agro Training Evacuation Center, Khairpur',
        address: 'Old Sukkur Road, Near Industrial Area, Khairpur, Sindh',
        location: { latitude: 27.529, longitude: 68.759 },
        totalCapacity: 400,
        currentOccupancy: 120,
        status: 'OPEN',
        contactInformation: {
            contactPerson: 'Site Supervisor Zulfiqar Ali',
            phone: '+92 303 5678904'
        },
        notes: 'SIMULATED large facility with generator backup and solar lighting. Decision support only.',
        isSimulated: true,
        demoKey: 'DEMO_SHELTER_KHAIRPUR_01',
        initialResources: [
            {
                category: 'FOOD',
                resourceName: 'High-energy biscuits & grain flour packs',
                quantity: 900,
                unit: 'packs',
                status: 'ADEQUATE',
                minimumThreshold: 150,
                isSimulated: true,
                demoKey: 'DEMO_RES_KHAIRPUR_FOOD'
            },
            {
                category: 'DRINKING_WATER',
                resourceName: 'Water bowser clean supply 5000L',
                quantity: 3,
                unit: 'tanks',
                status: 'ADEQUATE',
                minimumThreshold: 1,
                isSimulated: true,
                demoKey: 'DEMO_RES_KHAIRPUR_WATER'
            },
            {
                category: 'MEDICAL_SUPPLIES',
                resourceName: 'Emergency cholera and waterborne illness kits',
                quantity: 70,
                unit: 'kits',
                status: 'ADEQUATE',
                minimumThreshold: 15,
                isSimulated: true,
                demoKey: 'DEMO_RES_KHAIRPUR_MED'
            },
            {
                category: 'BLANKETS',
                resourceName: 'Heavy winter blankets',
                quantity: 400,
                unit: 'pieces',
                status: 'ADEQUATE',
                minimumThreshold: 80,
                isSimulated: true,
                demoKey: 'DEMO_RES_KHAIRPUR_BLANKET'
            },
            {
                category: 'HYGIENE_KITS',
                resourceName: 'Hygiene buckets with disinfectants',
                quantity: 250,
                unit: 'buckets',
                status: 'ADEQUATE',
                minimumThreshold: 50,
                isSimulated: true,
                demoKey: 'DEMO_RES_KHAIRPUR_HYGIENE'
            }
        ]
    },
    {
        name: 'SIMULATED - Kashmore Technical Institute Facility, Kashmore',
        address: 'Indus Highway Section 4, Kandhkot-Kashmore Road, Sindh',
        location: { latitude: 28.432, longitude: 69.584 },
        totalCapacity: 250,
        currentOccupancy: 0,
        status: 'CLOSED',
        contactInformation: {
            contactPerson: 'Security In-Charge Sikandar Khan',
            phone: '+92 304 6789015'
        },
        notes: 'SIMULATED facility closed for structural reinforcement before upcoming monsoon peak. Decision support only.',
        isSimulated: true,
        demoKey: 'DEMO_SHELTER_KASHMORE_01',
        initialResources: [
            {
                category: 'FOOD',
                resourceName: 'Emergency dry ration packs',
                quantity: 0,
                unit: 'packs',
                status: 'EXHAUSTED',
                minimumThreshold: 50,
                isSimulated: true,
                demoKey: 'DEMO_RES_KASHMORE_FOOD'
            },
            {
                category: 'DRINKING_WATER',
                resourceName: 'Chlorination purification packets',
                quantity: 15,
                unit: 'boxes',
                status: 'LOW',
                minimumThreshold: 30,
                isSimulated: true,
                demoKey: 'DEMO_RES_KASHMORE_WATER'
            },
            {
                category: 'MEDICAL_SUPPLIES',
                resourceName: 'Basic wound dressings & antiseptics',
                quantity: 5,
                unit: 'kits',
                status: 'CRITICAL',
                minimumThreshold: 15,
                isSimulated: true,
                demoKey: 'DEMO_RES_KASHMORE_MED'
            },
            {
                category: 'BLANKETS',
                resourceName: 'Packed thermal blankets',
                quantity: 50,
                unit: 'pieces',
                status: 'LOW',
                minimumThreshold: 60,
                isSimulated: true,
                demoKey: 'DEMO_RES_KASHMORE_BLANKET'
            },
            {
                category: 'HYGIENE_KITS',
                resourceName: 'Standard personal hygiene packs',
                quantity: 0,
                unit: 'kits',
                status: 'EXHAUSTED',
                minimumThreshold: 20,
                isSimulated: true,
                demoKey: 'DEMO_RES_KASHMORE_HYGIENE'
            }
        ]
    }
]

