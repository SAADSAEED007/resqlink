export interface MonitoringLocation {
    latitude: number
    longitude: number
}
export interface NormalizedWeatherForecast {
    provider: string
    latitude: number
    longitude: number
    timezone: string
    retrievedAt: string
    freshness: 'fresh' | 'cached' | 'stale'
    current: {
        time: string
        temperatureC: number
        weatherCode: number
        windKmh: number
        condition?: string
        providerConditionCode?: number
        feelsLikeC?: number
        humidityPercent?: number
        gustKmh?: number
        precipitationMm?: number
    }
    next24Hours: {
        start: string
        end: string
        precipitationMm: number
        maxProbabilityPercent: number
        hourlyPeriods: number
        maxWindKmh?: number
        maxGustKmh?: number
        peakHourlyPrecipitationMm?: number
    }
    hourly: { time: string; precipitationMm: number; probabilityPercent: number; windKmh: number; gustKmh?: number }[]
    days: { time: string; weatherCode: number; maxC: number; minC: number; precipitationMm: number; probabilityPercent: number }[]
    units: { temperature: string; precipitation: string; probability: string; wind: string }
    attribution: string
    limitations?: string[]
}
export interface WeatherProvider {
    readonly name: string
    getForecast(location: MonitoringLocation, signal: AbortSignal): Promise<NormalizedWeatherForecast>
}
// Only controlled status/code metadata crosses the provider boundary. Never retain
// request URLs, provider bodies or network exception messages containing secrets.
export class WeatherProviderError extends Error {
    constructor(
        message: string,
        public readonly status: number | null,
        public readonly retryAfter: string | null = null,
        public readonly configuration = false
    ) {
        super(message)
        this.name = 'WeatherProviderError'
    }
}
export class WeatherPayloadError extends WeatherProviderError {
    constructor(message: string) {
        super(message, 502)
        this.name = 'WeatherPayloadError'
    }
}
