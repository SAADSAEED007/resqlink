import { district, districts, DATASET_VERSION } from './districts'
import { attention } from './attention'
import { forecast, getCachedForecast, weatherProviderStatus } from '../riskZones/weather.service'
import { CustomError } from '../../utils/errors'
import { evidence, generateAnalysis } from '../riskZones/intelligence.service'
import CommunityRiskZone from '../riskZones/models/community-risk-zone.model'
export async function districtWeather(id: string, cacheOnly = false) {
    const record = district(id)
    let weather: Awaited<ReturnType<typeof forecast>> | null = null
    let error = ''
    try {
        weather = cacheOnly ? getCachedForecast(record.latitude, record.longitude) : await forecast(record.latitude, record.longitude)
    } catch (e) {
        error = e instanceof CustomError ? e.message : 'Weather unavailable'
    }
    return {
        ...record,
        weather,
        attention: attention(weather),
        providerState: weather ? (weather.freshness === 'stale' ? 'STALE' : 'AVAILABLE') : 'UNAVAILABLE',
        error,
        aiConfigured: !!process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
    }
}
export async function overview() {
    // Enqueue together; the shared service serializes/batches upstream work.
    const output = await Promise.all(districts.map((record) => districtWeather(record.id)))
    return {
        datasetVersion: DATASET_VERSION,
        coverage: 'Verified seven-district subset; remaining Sindh districts are not configured.',
        retrievedAt: new Date().toISOString(),
        provider: weatherProviderStatus(),
        items: output.map((item) => ({ ...item, weather: item.weather ? { ...item.weather, hourly: undefined } : null })),
        unavailable: output.filter((item) => item.attention.level === 'DATA_UNAVAILABLE').length
    }
}
export async function districtAnalysis(id: string) {
    if (!process.env.GROQ_API_KEY) throw new CustomError('AI analysis is not configured.', 503)
    const input = await districtWeather(id, true)
    if (!input.weather || input.attention.level === 'DATA_UNAVAILABLE')
        throw new CustomError('Fresh weather evidence is required for district analysis', 503)
    const facts = [
        { id: 'district:monitoring', text: `Representative monitoring location: ${input.monitoringLocation}.` },
        { id: 'weather:attention', text: `Weather attention: ${input.attention.level}. ${input.attention.reasons.join(' ')}` },
        {
            id: 'weather:forecast',
            text: `Open-Meteo next 24-hour precipitation: ${input.weather.next24Hours.precipitationMm} mm; maximum hourly precipitation probability: ${input.weather.next24Hours.maxProbabilityPercent}%. Retrieved at ${input.weather.retrievedAt}.`
        }
    ]
    let missing = ['River levels, drainage inspections and district-wide exposure are not supplied by this weather forecast.']
    try {
        const zones = await CommunityRiskZone.find({ district: new RegExp(`^${input.name}$`, 'i'), isSimulated: false })
            .limit(10)
            .lean()
        for (const zone of zones)
            for (const fact of evidence(zone, null)) facts.push({ id: `community:${String(zone._id)}:${fact.id}`, text: fact.text })
        if (!zones.length) missing.push('No matching local community records are available.')
    } catch {
        missing = [...missing, 'Local community records could not be loaded.']
    }
    return generateAnalysis({
        id: input.id,
        facts,
        model: input.model,
        reviewLevel: input.attention.level,
        weather: input.weather,
        version: DATASET_VERSION,
        missingInformation: missing
    })
}
