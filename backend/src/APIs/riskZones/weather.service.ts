import Joi from 'joi'
import { CustomError } from '../../utils/errors'

const numeric = Joi.number().required()
const array = Joi.array().items(numeric).min(1).required()
const providerSchema = Joi.object({
    latitude: numeric.min(-90).max(90),
    longitude: numeric.min(-180).max(180),
    timezone: Joi.string().valid('Asia/Karachi').required(),
    current: Joi.object({ time: numeric, temperature_2m: numeric, weather_code: numeric.integer(), wind_speed_10m: numeric.min(0) })
        .unknown(true)
        .required(),
    hourly: Joi.object({ time: array, precipitation: array, precipitation_probability: array, wind_speed_10m: array }).required(),
    daily: Joi.object({
        time: array,
        weather_code: array,
        temperature_2m_max: array,
        temperature_2m_min: array,
        precipitation_sum: array,
        precipitation_probability_max: array
    }).required()
}).unknown(true)
export function coordinates(lat: unknown, lon: unknown) {
    if (lat === null || lon === null || lat === undefined || lon === undefined || lat === '' || lon === '')
        throw new CustomError('Valid community coordinates are required', 422)
    const latitude = Number(lat),
        longitude = Number(lon)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
        throw new CustomError('Invalid coordinates', 400)
    return { latitude, longitude }
}
export function normalizeWeather(input: unknown, now = Date.now()) {
    const checked = providerSchema.validate(input)
    if (checked.error) {
        console.warn('weather.validation_failed', { path: checked.error.details[0].path.join('.'), type: checked.error.details[0].type })
        throw new CustomError('Weather provider returned incomplete data', 502)
    }
    const data = checked.value as {
        latitude: number
        longitude: number
        timezone: string
        current: { time: number; temperature_2m: number; weather_code: number; wind_speed_10m: number }
        hourly: Record<string, number[]>
        daily: Record<string, number[]>
    }
    for (const series of [data.hourly, data.daily]) {
        if (Object.values(series).some((values) => values.length !== series.time.length))
            throw new CustomError('Weather forecast arrays do not align', 502)
        if (series.time.some((time, index) => index > 0 && time <= series.time[index - 1]))
            throw new CustomError('Weather forecast timestamps are invalid', 502)
    }
    const hourly = data.hourly.time.map((time, i) => ({
        time: new Date(time * 1000).toISOString(),
        precipitationMm: data.hourly.precipitation[i],
        probabilityPercent: data.hourly.precipitation_probability[i],
        windKmh: data.hourly.wind_speed_10m[i]
    }))
    const window = hourly.filter(
        (row) => Date.parse(row.time) > data.current.time * 1000 && Date.parse(row.time) <= data.current.time * 1000 + 86400000
    )
    if (
        window.length !== 24 ||
        hourly.some((row) => row.precipitationMm < 0 || row.probabilityPercent < 0 || row.probabilityPercent > 100 || row.windKmh < 0) ||
        Math.abs(now - data.current.time * 1000) > 7200000
    )
        throw new CustomError('Weather forecast coverage is incomplete or outdated', 502)
    const days = data.daily.time.map((time, i) => ({
        time: new Date(time * 1000).toISOString(),
        weatherCode: data.daily.weather_code[i],
        maxC: data.daily.temperature_2m_max[i],
        minC: data.daily.temperature_2m_min[i],
        precipitationMm: data.daily.precipitation_sum[i],
        probabilityPercent: data.daily.precipitation_probability_max[i]
    }))
    if (days.length < 4 || days.some((day) => day.precipitationMm < 0 || day.probabilityPercent < 0 || day.probabilityPercent > 100))
        throw new CustomError('Daily forecast is incomplete', 502)
    return {
        provider: 'Open-Meteo',
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: 'Asia/Karachi',
        retrievedAt: new Date(now).toISOString(),
        freshness: 'fresh' as 'fresh' | 'cached' | 'stale',
        current: {
            time: new Date(data.current.time * 1000).toISOString(),
            temperatureC: data.current.temperature_2m,
            weatherCode: data.current.weather_code,
            windKmh: data.current.wind_speed_10m
        },
        next24Hours: {
            start: new Date(data.current.time * 1000).toISOString(),
            end: new Date(data.current.time * 1000 + 86400000).toISOString(),
            precipitationMm: Math.round(window.reduce((total, row) => total + row.precipitationMm, 0) * 10) / 10,
            maxProbabilityPercent: Math.max(...window.map((row) => row.probabilityPercent)),
            hourlyPeriods: 24
        },
        hourly,
        days,
        units: { temperature: '\u00b0C', precipitation: 'mm', probability: '%', wind: 'km/h' },
        attribution: 'Weather data by Open-Meteo (CC BY 4.0)'
    }
}
export type Forecast = ReturnType<typeof normalizeWeather>
const cache = new Map<string, { value: Forecast; expires: number }>()
const pending = new Map<string, Promise<Forecast>>()
export function clearWeatherCache() {
    cache.clear()
    pending.clear()
    rateLimitedUntil = 0
}
export async function forecast(lat: unknown, lon: unknown, refresh = false): Promise<Forecast> {
    const point = coordinates(lat, lon),
        key = `${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}`
    const old = cache.get(key)
    if (!refresh && old && old.expires > Date.now()) return { ...old.value, freshness: 'cached' }
    const running = pending.get(key)
    if (running) return running
    const task: Promise<Forecast> = (async (): Promise<Forecast> => {
        // Register the pending promise before any synchronous cooldown failure.
        await Promise.resolve()
        try {
            if (Date.now() < rateLimitedUntil) throw new CustomError('Weather provider rate limited; retry later', 503)
            const query = new URLSearchParams({
                latitude: point.latitude.toFixed(3),
                longitude: point.longitude.toFixed(3),
                timezone: 'Asia/Karachi',
                timeformat: 'unixtime',
                temperature_unit: 'celsius',
                wind_speed_unit: 'kmh',
                precipitation_unit: 'mm',
                forecast_days: '4',
                current: 'temperature_2m,weather_code,wind_speed_10m',
                hourly: 'precipitation,precipitation_probability,wind_speed_10m',
                daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max'
            })
            const response = await fetchWeather(`https://api.open-meteo.com/v1/forecast?${query}`)
            const value = normalizeWeather(await response.json())
            if (cache.size >= 500) cache.delete(cache.keys().next().value as string)
            cache.set(key, { value, expires: Date.now() + 900000 })
            return value
        } catch (error) {
            console.warn('weather.forecast_failed', {
                coordinates: key,
                error: error instanceof CustomError ? error.message : error instanceof Error ? error.name : 'UnknownError'
            })
            if (old && Date.now() - Date.parse(old.value.retrievedAt) < 3600000) return { ...old.value, freshness: 'stale' }
            if (error instanceof CustomError) throw error
            throw new CustomError('Weather provider unavailable; retry later', 503)
        } finally {
            pending.delete(key)
        }
    })()
    pending.set(key, task)
    return task
}

// Two attempts at most; each bounded to five seconds so the three-worker
// seven-district overview completes within the browser's 35-second deadline.
async function fetchWeather(url: string): Promise<Response> {
    for (let attempt = 0; attempt < 2; attempt++) {
        let response: Response
        try {
            response = await fetch(url, { signal: AbortSignal.timeout(5000) })
        } catch (error) {
            console.warn('weather.transport_failed', {
                attempt: attempt + 1,
                error: error instanceof Error ? error.name : 'UnknownError',
                code: (error as { cause?: { code?: string } })?.cause?.code
            })
            if (attempt === 0) continue
            throw new CustomError('Weather provider connection failed or timed out', 503)
        }
        if (response.ok) return response
        console.warn('weather.provider_http', { status: response.status, attempt: attempt + 1 })
        // Do not immediately retry a rate-limited provider. Subsequent requests
        // must honor its Retry-After window, including manual refreshes.
        if (response.status === 429) {
            const header = response.headers?.get('retry-after')
            const seconds = header ? Number(header) : NaN
            const until = Number.isFinite(seconds) ? Date.now() + seconds * 1000 : Date.parse(header || '')
            rateLimitedUntil = Math.max(Date.now() + 60000, Number.isFinite(until) ? until : 0)
            throw new CustomError('Weather provider rate limited; retry later', 503)
        }
        if (response.status < 500 || attempt === 1) throw new CustomError(`Weather provider HTTP ${response.status}`, 503)
    }
    throw new CustomError('Weather provider unavailable', 503)
}
let rateLimitedUntil = 0
