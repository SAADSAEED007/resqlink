import { CustomError } from '../../utils/errors'
export const DATASET_VERSION = 'sindh-monitoring-2026-10-18-v1'
export const DISTRICT_NAME_SOURCE = 'https://www.pbs.gov.pk/result-excel/'
const entries = [
    ['hyderabad', 'Hyderabad', 25.39689, 68.37718, 1176734],
    ['sukkur', 'Sukkur', 27.70323, 68.85889, 1164408],
    ['larkana', 'Larkana', 27.55898, 68.21204, 1172128],
    ['mirpur-khas', 'Mirpur Khas', 25.5276, 69.01255, 1170295],
    ['badin', 'Badin', 24.656, 68.837, 1184055],
    ['thatta', 'Thatta', 24.74745, 67.92353, 1163582],
    ['dadu', 'Dadu', 26.73033, 67.7769, 1180809]
] as const
// PPLA2 town locations verified through GeoNames-backed Open-Meteo geocoding.
// This is a seven-district subset, not a complete province registry or boundary dataset.
export const districts = entries.map(([id, name, latitude, longitude, geonamesId]) => ({
    id,
    name,
    monitoringLocation: `${name} town`,
    latitude,
    longitude,
    geonamesId,
    coordinateSource: `https://www.geonames.org/${geonamesId}/`,
    verificationSource: `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&countryCode=PK`,
    districtNameSource: DISTRICT_NAME_SOURCE,
    datasetVersion: DATASET_VERSION,
    verifiedOn: '2026-10-18',
    limitation: 'Forecast shown for representative district monitoring location.'
}))
export function district(id: string) {
    const record = districts.find((item) => item.id === id)
    if (!record) throw new CustomError('Unknown monitored district', 404)
    return record
}
