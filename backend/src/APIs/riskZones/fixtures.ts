import { CommunityRiskZoneInput } from './types'

export const SINDH_DEMO_FIXTURES: CommunityRiskZoneInput[] = [
    {
        communityName: 'Goth Ali Mohammad Mallah',
        district: 'Thatta',
        tehsil: 'Keti Bandar',
        approximateLocation: {
            latitude: 24.145,
            longitude: 67.452,
            landmarkDescription: 'Coastal creek island settlement, 7km southwest of Keti Bandar jetty',
            isLocationEstimated: true
        },
        hazardType: 'FLOOD_INUNDATION',
        hazardSeverity: 'CRITICAL',
        connectivityStatus: 'NO_CELL_COVERAGE',
        accessObstacles: ['BOAT_ONLY', 'HIGH_TIDE_RESTRICTION'],
        vulnerablePopulation: {
            estimatedTotalPopulation: 350,
            estimatedVulnerableCount: 95,
            vulnerabilityDetails: 'Isolated fishing community with elderly residents and infants; local dispensary submerged'
        },
        informationConfidence: 'MEDIUM',
        confidenceReasons: ['Report received via Coastal Guard VHF relay; cellular base transceiver station offline'],
        assessmentStatus: 'PENDING_ASSESSMENT',
        notes: 'Priority community for proactive physical welfare check before monsoon high tide',
        isSimulated: true,
        demoKey: 'SINDH-ZONE-THATTA-01'
    },
    {
        communityName: 'Village Qasim Bela',
        district: 'Dadu',
        tehsil: 'Johi',
        approximateLocation: {
            latitude: 26.689,
            longitude: 67.621,
            landmarkDescription: 'Kacha riverine zone adjacent to Main Nara Valley Drain',
            isLocationEstimated: true
        },
        hazardType: 'RIVER_BREACH',
        hazardSeverity: 'HIGH',
        connectivityStatus: 'INTERMITTENT_SIGNAL',
        accessObstacles: ['WASHED_OUT_ROADS', 'MUD_OBSTACLES'],
        vulnerablePopulation: {
            estimatedTotalPopulation: 520,
            estimatedVulnerableCount: 140,
            vulnerabilityDetails: 'Agricultural community cut off by road breaches; high reliance on contaminated floodwater'
        },
        informationConfidence: 'LOW',
        confidenceReasons: ['Secondhand reports from tractor drivers at Johi bypass; direct telecom unavailable'],
        assessmentStatus: 'PENDING_ASSESSMENT',
        notes: 'Needs field scout assessment to verify levee stability and drinking water emergency',
        isSimulated: true,
        demoKey: 'SINDH-ZONE-DADU-01'
    },
    {
        communityName: 'Basti Ghulam Sarwar',
        district: 'Sujawal',
        tehsil: 'Jati',
        approximateLocation: {
            latitude: 24.521,
            longitude: 68.214,
            landmarkDescription: 'Indus Left Bank canal cluster near Old Daro bridge',
            isLocationEstimated: false
        },
        hazardType: 'FLOOD_INUNDATION',
        hazardSeverity: 'CRITICAL',
        connectivityStatus: 'NO_CELL_COVERAGE',
        accessObstacles: ['SUBMERGED_CAUSEWAY', 'BOAT_REQUIRED'],
        vulnerablePopulation: {
            estimatedTotalPopulation: 420,
            estimatedVulnerableCount: 120,
            vulnerabilityDetails: 'Primary school shelter surrounded by 4ft water; 8 pregnant women and 35 children reported'
        },
        informationConfidence: 'MEDIUM',
        confidenceReasons: ['Reported by local irrigation patwari via emergency motorcycle messenger'],
        assessmentStatus: 'ASSESSMENT_DISPATCHED',
        notes: 'Field scout dispatched with satellite communication transceiver',
        isSimulated: true,
        demoKey: 'SINDH-ZONE-SUJAWAL-01'
    },
    {
        communityName: 'Kandiaro Riverine Settlement',
        district: 'Khairpur',
        tehsil: 'Sobhodero',
        approximateLocation: {
            latitude: 27.284,
            longitude: 68.451,
            landmarkDescription: 'Spur Bund 4, 3km north of Indus highway crossing',
            isLocationEstimated: true
        },
        hazardType: 'FLASH_FLOOD',
        hazardSeverity: 'MODERATE',
        connectivityStatus: 'INTERMITTENT_SIGNAL',
        accessObstacles: ['SLIPPERY_BUND_TRACKS'],
        vulnerablePopulation: {
            estimatedTotalPopulation: 210,
            estimatedVulnerableCount: 45,
            vulnerabilityDetails: 'Seasonal pastoral families camped on elevated embankment with livestock'
        },
        informationConfidence: 'HIGH',
        confidenceReasons: ['Verified by revenue department field staff during morning levee inspection'],
        assessmentStatus: 'MONITORING_ONLY',
        notes: 'Currently safe on elevated ground; maintain 6-hour monitoring cycle',
        isSimulated: true,
        demoKey: 'SINDH-ZONE-KHAIRPUR-01'
    },
    {
        communityName: 'Goth Jamali',
        district: 'Kashmore',
        tehsil: 'Kandhkot',
        approximateLocation: {
            latitude: 28.241,
            longitude: 69.182,
            landmarkDescription: 'Riverine forest perimeter near Tori Bund',
            isLocationEstimated: true
        },
        hazardType: 'RIVER_BREACH',
        hazardSeverity: 'HIGH',
        connectivityStatus: 'NO_CELL_COVERAGE',
        accessObstacles: ['FLOODED_TRACKS', 'HIGH_VEGETATION'],
        vulnerablePopulation: {
            estimatedTotalPopulation: 290,
            estimatedVulnerableCount: 80,
            vulnerabilityDetails: 'Zero local health facility; distance to nearest paved road 14km'
        },
        informationConfidence: 'LOW',
        confidenceReasons: ['NDMA satellite flood anomaly detection indicates standing water; no ground voice confirmation'],
        assessmentStatus: 'PENDING_ASSESSMENT',
        notes: 'Remote sensing indicates high risk; physical field reconnaissance required',
        isSimulated: true,
        demoKey: 'SINDH-ZONE-KASHMORE-01'
    }
]

