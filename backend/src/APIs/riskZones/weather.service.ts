import Joi from 'joi'
import { CustomError } from '../../utils/errors'
import { NormalizedWeatherForecast, WeatherProviderError, WeatherPayloadError } from '../weather/providers/weather-provider'
import { WeatherAPIProvider } from '../weather/providers/weatherapi.provider'

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
    if (checked.error) throw new CustomError('Weather provider returned incomplete data', 502)
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
export type Forecast = NormalizedWeatherForecast
export const WEATHER_CACHE_TTL_MS = 20 * 60000
export const WEATHER_STALE_MAX_AGE_MS = 60 * 60000
const MAX_CACHE = 500
type Point = ReturnType<typeof coordinates>
interface Job {
    key: string
    point: Point
    promise: Promise<Forecast>
    resolve: (value: Forecast) => void
    reject: (error: CustomError) => void
}
const cache = new Map<string, Forecast>()
const pending = new Map<string, Job>()
const queue = new Map<string, Job>()
const invalidUntil = new Map<string, number>()
let timer: ReturnType<typeof setTimeout> | undefined
let running = false
let controller: AbortController | undefined
let generation = 0
let lastAttempt = 0
let cooldownUntil = 0
let failures = 0
let rateLimited = false
let configurationFailure = false
const weatherApi = new WeatherAPIProvider()
function useWeatherApi() {
    return process.env.WEATHER_PROVIDER !== 'open-meteo'
}

function logWeather(event: string, details: Record<string, unknown>) {
    // Render must receive these bounded provider-transition events on stdout.
    // eslint-disable-next-line no-console
    console.warn(event, details)
}
function keyFor(point: Point) {
    return `${useWeatherApi() ? 'weatherapi:3' : 'open-meteo:4'}:${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}`
}
export function weatherProviderStatus() {
    const cooling = Date.now() < cooldownUntil
    return {
        provider: useWeatherApi() ? weatherApi.name : 'Open-Meteo',
        configured: !useWeatherApi() || !!process.env.WEATHERAPI_KEY?.trim(),
        state: cooling ? ('COOLDOWN' as const) : ('READY' as const),
        reason: cooling ? (rateLimited ? ('RATE_LIMITED' as const) : ('UNAVAILABLE' as const)) : null,
        retryAt: cooling ? new Date(cooldownUntil).toISOString() : null,
        cacheTtlSeconds: WEATHER_CACHE_TTL_MS / 1000
    }
}
export function getCachedForecast(lat: unknown, lon: unknown): Forecast | null {
    const key = keyFor(coordinates(lat, lon))
    const value = cache.get(key)
    if (!value) return null
    const age = Date.now() - Date.parse(value.retrievedAt)
    if (age >= WEATHER_STALE_MAX_AGE_MS) {
        cache.delete(key)
        return null
    }
    return { ...value, freshness: age < WEATHER_CACHE_TTL_MS ? 'cached' : 'stale' }
}
function unavailable() {
    return new CustomError(rateLimited ? 'Weather provider rate limited; retry later' : 'Weather provider temporarily unavailable; retry later', 503)
}
function finish(job: Job, value?: Forecast, error = unavailable()) {
    if (pending.get(job.key) === job) pending.delete(job.key)
    if (value) job.resolve(value)
    else {
        const old = getCachedForecast(job.point.latitude, job.point.longitude)
        if (old) job.resolve({ ...old, freshness: 'stale' })
        else job.reject(error)
    }
}
export function clearWeatherCache() {
    generation++
    clearTimeout(timer)
    timer = undefined
    controller?.abort()
    for (const job of pending.values()) job.reject(new CustomError('Weather cache was reset', 503))
    pending.clear()
    queue.clear()
    cache.clear()
    invalidUntil.clear()
    lastAttempt = 0
    cooldownUntil = 0
    failures = 0
    rateLimited = false
    configurationFailure = false
}
export async function forecast(lat: unknown, lon: unknown): Promise<Forecast> {
    const point = coordinates(lat, lon),
        key = keyFor(point)
    const old = getCachedForecast(lat, lon)
    // All callers, including browser refresh and AI/context endpoints, obey TTL.
    if (old && old.freshness !== 'stale') return old
    if (useWeatherApi() && !process.env.WEATHERAPI_KEY?.trim()) {
        if (old) return old
        throw new CustomError('WEATHERAPI_KEY is not configured on the backend', 503)
    }
    const existing = pending.get(key)
    if (existing) return existing.promise
    if (Date.now() < cooldownUntil || Date.now() < (invalidUntil.get(key) || 0)) {
        if (old) return old
        if (configurationFailure) throw new CustomError('WeatherAPI credentials or subscription require backend review', 503)
        throw unavailable()
    }
    if (pending.size >= MAX_CACHE) {
        if (old) return old
        throw new CustomError('Weather request queue is busy; retry later', 503)
    }
    let resolve!: Job['resolve'], reject!: Job['reject']
    const promise = new Promise<Forecast>((ok, fail) => {
        resolve = ok
        reject = fail
    })
    const job: Job = { point, key, promise, resolve, reject }
    pending.set(key, job)
    queue.set(key, job)
    schedule()
    return promise
}
function schedule() {
    if (running || timer || !queue.size) return
    // Coalesce district overview/detail requests and serialize all upstream work.
    timer = setTimeout(
        () => {
            timer = undefined
            void flush()
        },
        Math.max(20, 1000 - (Date.now() - lastAttempt))
    )
}
function openCircuit(status: number | null, retryAfter?: string | null) {
    failures = Math.min(failures + 1, 6)
    rateLimited = status === 429
    const base = rateLimited ? 60000 : status !== null && status < 500 ? 300000 : 30000
    const backoff = Math.min(1800000, base * 2 ** (failures - 1) * (1 + Math.random() * 0.2))
    const seconds = retryAfter?.trim() ? Number(retryAfter) : NaN
    const requested = Number.isFinite(seconds) ? Date.now() + Math.max(0, seconds) * 1000 : Date.parse(retryAfter || '')
    cooldownUntil = Math.max(Date.now() + backoff, Number.isFinite(requested) ? requested : 0)
    logWeather('weather.provider_cooldown', { status, failures, retryAt: new Date(cooldownUntil).toISOString() })
}
function providerRows(body: unknown, length: number): unknown[] {
    const rows: unknown[] = Array.isArray(body) ? (body as unknown[]) : length === 1 ? [body] : []
    if (rows.length !== length) throw new CustomError('Weather provider location count mismatch', 502)
    const ordered = new Array<unknown>(length)
    const seen = new Set<number>()
    rows.forEach((row, index) => {
        const id = row && typeof row === 'object' && 'location_id' in row ? row.location_id : index
        if (typeof id !== 'number' || !Number.isInteger(id) || id < 0 || id >= length || seen.has(id))
            throw new CustomError('Weather provider location mapping is invalid', 502)
        seen.add(id)
        ordered[id] = row
    })
    return ordered
}
async function flush() {
    if (running || !queue.size) return
    const jobs = [...queue.values()].slice(0, useWeatherApi() ? 1 : 50)
    for (const job of jobs) queue.delete(job.key)
    if (Date.now() < cooldownUntil) {
        jobs.forEach((job) => finish(job))
        schedule()
        return
    }
    running = true
    const epoch = generation
    controller = new AbortController()
    const timeout = setTimeout(() => controller?.abort(), useWeatherApi() ? 12000 : 8000)
    lastAttempt = Date.now()
    try {
        if (useWeatherApi()) {
            const value = await weatherApi.getForecast(jobs[0].point, controller.signal)
            if (epoch !== generation) return
            if (failures) logWeather('weather.provider_recovered', { provider: weatherApi.name })
            failures = 0
            cooldownUntil = 0
            rateLimited = false
            configurationFailure = false
            if (cache.size >= MAX_CACHE && !cache.has(jobs[0].key)) cache.delete(cache.keys().next().value as string)
            cache.set(jobs[0].key, value)
            finish(jobs[0], value)
            return
        }
        const query = new URLSearchParams({
            latitude: jobs.map((job) => job.point.latitude.toFixed(3)).join(','),
            longitude: jobs.map((job) => job.point.longitude.toFixed(3)).join(','),
            timezone: 'Asia/Karachi',
            timeformat: 'unixtime',
            forecast_days: '4',
            temperature_unit: 'celsius',
            wind_speed_unit: 'kmh',
            precipitation_unit: 'mm',
            current: 'temperature_2m,weather_code,wind_speed_10m',
            hourly: 'precipitation,precipitation_probability,wind_speed_10m',
            daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max'
        })
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`, { signal: controller.signal })
        if (epoch !== generation) return
        if (!response.ok) {
            openCircuit(response.status, response.headers?.get('retry-after'))
            jobs.forEach((job) => finish(job))
            return
        }
        const rows = providerRows((await response.json()) as unknown, jobs.length)
        if (epoch !== generation) return
        if (failures) logWeather('weather.provider_recovered', { locations: jobs.length })
        failures = 0
        cooldownUntil = 0
        rateLimited = false
        jobs.forEach((job, index) => {
            try {
                const value = normalizeWeather(rows[index])
                if (cache.size >= MAX_CACHE && !cache.has(job.key)) cache.delete(cache.keys().next().value as string)
                cache.set(job.key, value)
                invalidUntil.delete(job.key)
                finish(job, value)
            } catch (error) {
                logWeather('weather.payload_invalid', {
                    coordinates: job.key,
                    error: error instanceof CustomError ? error.message : 'Invalid payload'
                })
                if (invalidUntil.size >= MAX_CACHE) invalidUntil.delete(invalidUntil.keys().next().value as string)
                invalidUntil.set(job.key, Date.now() + 60000)
                finish(job, undefined, new CustomError('Weather provider returned incomplete data', 502))
            }
        })
    } catch (error) {
        if (epoch === generation) {
            if (error instanceof WeatherPayloadError) {
                if (invalidUntil.size >= MAX_CACHE) invalidUntil.delete(invalidUntil.keys().next().value as string)
                invalidUntil.set(jobs[0].key, Date.now() + 60000)
                logWeather('weather.payload_invalid', { provider: weatherApi.name })
                finish(jobs[0], undefined, new CustomError(error.message, 502))
                return
            }
            const providerError = error instanceof WeatherProviderError ? error : null
            configurationFailure = !!providerError?.configuration
            openCircuit(providerError?.status ?? null, providerError?.retryAfter)
            logWeather('weather.provider_request_failed', { error: error instanceof Error ? error.name : 'UnknownError', locations: jobs.length })
            jobs.forEach((job) =>
                finish(
                    job,
                    undefined,
                    configurationFailure
                        ? new CustomError('WeatherAPI credentials or subscription require backend review', 503)
                        : error instanceof CustomError
                          ? error
                          : unavailable()
                )
            )
        }
    } finally {
        clearTimeout(timeout)
        controller = undefined
        running = false
        schedule()
    }
}
