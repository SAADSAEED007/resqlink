import Joi from 'joi'
import { MonitoringLocation, NormalizedWeatherForecast, WeatherProvider, WeatherProviderError, WeatherPayloadError } from './weather-provider'

const number = Joi.number().strict().required()
const nonnegative = number.min(0)
const percent = number.min(0).max(100)
const epoch = number.integer().min(1).max(8640000000000)
const condition = Joi.object({ text: Joi.string().trim().min(1).max(160).required(), code: number.integer() })
    .unknown(true)
    .required()
const schema = Joi.object({
    location: Joi.object({ lat: number.min(-90).max(90), lon: number.min(-180).max(180), tz_id: Joi.string().valid('Asia/Karachi').required() })
        .unknown(true)
        .required(),
    current: Joi.object({
        last_updated_epoch: epoch,
        temp_c: number.min(-100).max(70),
        feelslike_c: number.min(-120).max(100),
        humidity: percent,
        wind_kph: nonnegative.max(500),
        gust_kph: nonnegative.max(600),
        precip_mm: nonnegative.max(3000),
        condition
    })
        .unknown(true)
        .required(),
    forecast: Joi.object({
        forecastday: Joi.array()
            .length(3)
            .items(
                Joi.object({
                    date: Joi.string().isoDate().required(),
                    day: Joi.object({
                        maxtemp_c: number.min(-100).max(70),
                        mintemp_c: number.min(-100).max(70),
                        totalprecip_mm: nonnegative.max(3000),
                        daily_chance_of_rain: percent,
                        condition
                    })
                        .unknown(true)
                        .required(),
                    hour: Joi.array()
                        .length(24)
                        .items(
                            Joi.object({
                                time_epoch: epoch,
                                precip_mm: nonnegative.max(3000),
                                chance_of_rain: percent,
                                wind_kph: nonnegative.max(500),
                                gust_kph: nonnegative.max(600)
                            }).unknown(true)
                        )
                        .required()
                }).unknown(true)
            )
            .required()
    })
        .unknown(true)
        .required()
}).unknown(true)

interface ProviderBody {
    location: { lat: number; lon: number; tz_id: string }
    current: {
        last_updated_epoch: number
        temp_c: number
        feelslike_c: number
        humidity: number
        wind_kph: number
        gust_kph: number
        precip_mm: number
        condition: { text: string; code: number }
    }
    forecast: {
        forecastday: {
            date: string
            day: {
                maxtemp_c: number
                mintemp_c: number
                totalprecip_mm: number
                daily_chance_of_rain: number
                condition: { text: string; code: number }
            }
            hour: { time_epoch: number; precip_mm: number; chance_of_rain: number; wind_kph: number; gust_kph: number }[]
        }[]
    }
}

// Compatibility codes for the existing WMO icon contract. Original provider codes
// and condition text remain available; classification never uses these icons.
function iconCode(code: number) {
    if (code === 1000) return 0
    if (code === 1003) return 2
    if ([1006, 1009].includes(code)) return 3
    if ([1030, 1135, 1147].includes(code)) return 45
    if ([1087, 1273, 1276, 1279, 1282].includes(code)) return 95
    if ([1066, 1069, 1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264].includes(code)) return 73
    if ([1063, 1072, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1240, 1243, 1246].includes(code)) return 61
    throw new WeatherPayloadError('WeatherAPI condition code is unsupported')
}

export function normalizeWeatherApi(input: unknown, location: MonitoringLocation, now = Date.now()): NormalizedWeatherForecast {
    const checked = schema.validate(input, { convert: false })
    if (checked.error) throw new WeatherPayloadError('WeatherAPI returned incomplete or invalid forecast data')
    const data = checked.value as ProviderBody
    if (Math.abs(data.location.lat - location.latitude) > 0.2 || Math.abs(data.location.lon - location.longitude) > 0.2)
        throw new WeatherPayloadError('WeatherAPI returned a different monitoring location')
    if (Math.abs(now - data.current.last_updated_epoch * 1000) > 7200000) throw new WeatherPayloadError('WeatherAPI observation is outdated')
    const hourly = data.forecast.forecastday.flatMap((day) =>
        day.hour.map((hour) => ({
            time: new Date(hour.time_epoch * 1000).toISOString(),
            precipitationMm: hour.precip_mm,
            probabilityPercent: hour.chance_of_rain,
            windKmh: hour.wind_kph,
            gustKmh: hour.gust_kph
        }))
    )
    if (hourly.some((row, i) => i > 0 && Date.parse(row.time) - Date.parse(hourly[i - 1].time) !== 3600000))
        throw new WeatherPayloadError('WeatherAPI hourly forecast intervals do not align')
    const start = Math.ceil(now / 3600000) * 3600000
    const window = hourly.filter((row) => Date.parse(row.time) >= start && Date.parse(row.time) < start + 86400000)
    if (window.length !== 24 || Date.parse(window[0].time) !== start) throw new WeatherPayloadError('WeatherAPI next 24-hour evidence is incomplete')
    const days = data.forecast.forecastday.map((day) => ({
        time: new Date(`${day.date}T00:00:00+05:00`).toISOString(),
        weatherCode: iconCode(day.day.condition.code),
        maxC: day.day.maxtemp_c,
        minC: day.day.mintemp_c,
        precipitationMm: day.day.totalprecip_mm,
        probabilityPercent: day.day.daily_chance_of_rain
    }))
    if (days.some((day, i) => day.minC > day.maxC || (i > 0 && Date.parse(day.time) - Date.parse(days[i - 1].time) !== 86400000)))
        throw new WeatherPayloadError('WeatherAPI daily forecast intervals do not align')
    return {
        provider: 'WeatherAPI.com',
        ...location,
        timezone: data.location.tz_id,
        retrievedAt: new Date(now).toISOString(),
        freshness: 'fresh',
        current: {
            time: new Date(data.current.last_updated_epoch * 1000).toISOString(),
            temperatureC: data.current.temp_c,
            weatherCode: iconCode(data.current.condition.code),
            providerConditionCode: data.current.condition.code,
            condition: data.current.condition.text,
            windKmh: data.current.wind_kph,
            gustKmh: data.current.gust_kph,
            feelsLikeC: data.current.feelslike_c,
            humidityPercent: data.current.humidity,
            precipitationMm: data.current.precip_mm
        },
        next24Hours: {
            start: new Date(start).toISOString(),
            end: new Date(start + 86400000).toISOString(),
            hourlyPeriods: 24,
            precipitationMm: Math.round(window.reduce((sum, row) => sum + row.precipitationMm, 0) * 100) / 100,
            maxProbabilityPercent: Math.max(...window.map((row) => row.probabilityPercent)),
            maxWindKmh: Math.max(...window.map((row) => row.windKmh)),
            maxGustKmh: Math.max(...window.map((row) => row.gustKmh)),
            peakHourlyPrecipitationMm: Math.max(...window.map((row) => row.precipitationMm))
        },
        hourly,
        days,
        units: { temperature: '\u00b0C', precipitation: 'mm', probability: '%', wind: 'km/h' },
        attribution: 'Powered by WeatherAPI.com',
        limitations: [
            'Representative monitoring point, not a district-wide hazard forecast.',
            'Rainfall summary covers the next 24 complete forecast hours; the partial current hour is excluded. See interval timestamps.',
            'Three calendar-day outlook. No official alerts requested. Prototype attention levels are not flood predictions.'
        ]
    }
}

export class WeatherAPIProvider implements WeatherProvider {
    readonly name = 'WeatherAPI.com'
    async getForecast(location: MonitoringLocation, signal: AbortSignal) {
        const key = process.env.WEATHERAPI_KEY?.trim()
        if (!key) throw new WeatherProviderError('WEATHERAPI_KEY is not configured on the backend', 503, null, true)
        const url = new URL('https://api.weatherapi.com/v1/forecast.json')
        url.searchParams.set('key', key)
        url.searchParams.set('q', `${location.latitude},${location.longitude}`)
        url.searchParams.set('days', '3')
        url.searchParams.set('aqi', 'no')
        url.searchParams.set('alerts', 'no')
        try {
            const response = await fetch(url, { signal })
            if (!response.ok) {
                const configuration = response.status === 401 || response.status === 403
                throw new WeatherProviderError(
                    configuration ? 'WeatherAPI credentials or subscription require backend review' : 'WeatherAPI forecast request failed',
                    response.status,
                    response.headers.get('retry-after'),
                    configuration
                )
            }
            const body: unknown = await response.json()
            if (body && typeof body === 'object' && 'error' in body) throw new WeatherProviderError('WeatherAPI returned a provider error', 502)
            return normalizeWeatherApi(body, location)
        } catch (error) {
            if (error instanceof WeatherProviderError) throw error
            throw new WeatherProviderError('WeatherAPI request timed out or could not be completed', null)
        }
    }
}
