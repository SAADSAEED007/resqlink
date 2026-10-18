jest.mock('../../handlers/logger', () => ({ __esModule: true, default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }))
import {
    forecast,
    clearWeatherCache,
    getCachedForecast,
    weatherProviderStatus,
    WEATHER_CACHE_TTL_MS,
    WEATHER_STALE_MAX_AGE_MS
} from '../../APIs/riskZones/weather.service'
import { districts } from '../../APIs/weather/districts'
import { overview, districtAnalysis } from '../../APIs/weather/monitoring.service'
import { attention } from '../../APIs/weather/attention'

function payload(index = 0) {
    const current = Math.floor(Date.now() / 900000) * 900
    const start = Math.floor((current + 18000) / 86400) * 86400 - 18000
    return {
        latitude: districts[index].latitude,
        longitude: districts[index].longitude,
        timezone: 'Asia/Karachi',
        location_id: index,
        current: { time: current, temperature_2m: 30 + index, weather_code: 0, wind_speed_10m: 10 },
        hourly: {
            time: Array.from({ length: 96 }, (_, i) => start + i * 3600),
            precipitation: Array<number>(96).fill(index),
            precipitation_probability: Array<number>(96).fill(10),
            wind_speed_10m: Array<number>(96).fill(10)
        },
        daily: {
            time: Array.from({ length: 4 }, (_, i) => start + i * 86400),
            weather_code: [0, 0, 0, 0],
            temperature_2m_max: [35, 35, 35, 35],
            temperature_2m_min: [25, 25, 25, 25],
            precipitation_sum: [0, 0, 0, 0],
            precipitation_probability_max: [10, 10, 10, 10]
        }
    }
}
const originalFetch = global.fetch
const originalKey = process.env.GROQ_API_KEY
const response = (body: unknown, status = 200, retryAfter?: string) =>
    Promise.resolve({
        ok: status < 400,
        status,
        headers: new Headers(retryAfter ? { 'Retry-After': retryAfter } : {}),
        json: () => Promise.resolve(body)
    } as Response)
beforeEach(() => {
    clearWeatherCache()
    delete process.env.GROQ_API_KEY
})
afterEach(() => {
    clearWeatherCache()
    global.fetch = originalFetch
    jest.restoreAllMocks()
    if (originalKey) process.env.GROQ_API_KEY = originalKey
    else delete process.env.GROQ_API_KEY
})

test('simultaneous overviews and detail coalesce into one HTTP request; cache hits make zero more', async () => {
    const fetcher = jest.fn(() => response(districts.map((_d, index) => payload(index))))
    global.fetch = fetcher
    const [first, second, detail] = await Promise.all([overview(), overview(), forecast(districts[0].latitude, districts[0].longitude)])
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(first.items).toHaveLength(7)
    expect(second.items).toHaveLength(7)
    expect(detail.current.temperatureC).toBe(30)
    first.items.forEach((item, index) => {
        expect(item.id).toBe(districts[index].id)
        expect(item.weather?.current.temperatureC).toBe(30 + index)
    })
    const url = new URL(String(jest.mocked(global.fetch).mock.calls[0][0]))
    expect(url.searchParams.get('latitude')?.split(',')).toHaveLength(7)
    await overview()
    await forecast(districts[1].latitude, districts[1].longitude)
    expect(fetcher).toHaveBeenCalledTimes(1)
})
test('expiry refetches and preserves original timestamps on stale failure; one-hour-old data is unavailable', async () => {
    global.fetch = jest.fn(() => response(payload()))
    const first = await forecast(25, 68)
    const time = Date.now()
    const clock = jest.spyOn(Date, 'now').mockReturnValue(time + WEATHER_CACHE_TTL_MS + 1)
    const fail = jest.fn(() => response({}, 429, '3600'))
    global.fetch = fail
    const stale = await forecast(25, 68)
    expect(stale.freshness).toBe('stale')
    expect(stale.retrievedAt).toBe(first.retrievedAt)
    expect(attention(stale).level).toBe('DATA_UNAVAILABLE')
    await forecast(25, 68)
    expect(fail).toHaveBeenCalledTimes(1)
    clock.mockReturnValue(time + WEATHER_STALE_MAX_AGE_MS + 1)
    expect(getCachedForecast(25, 68)).toBeNull()
    await expect(forecast(25, 68)).rejects.toThrow('rate limited')
})
test('expired successful cache is replaced once rather than refetched by every caller', async () => {
    const fetcher = jest.fn(() => response(payload()))
    global.fetch = fetcher
    const first = await forecast(25, 68)
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + WEATHER_CACHE_TTL_MS + 1)
    const result = await Promise.all([forecast(25, 68), forecast(25, 68)])
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(result[0].retrievedAt).not.toBe(first.retrievedAt)
})
test('429 blocks all districts, logs once per transition, honors HTTP-date, and recovers as one batch', async () => {
    const now = Date.now()
    const retryAt = new Date(now + 300000).toUTCString()
    const warn = jest.spyOn(global.console, 'warn').mockImplementation(() => undefined)
    const fetcher = jest.fn(() => response({}, 429, retryAt))
    global.fetch = fetcher
    const first = await overview()
    expect(first.unavailable).toBe(7)
    expect(first.provider.reason).toBe('RATE_LIMITED')
    await overview()
    await overview()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(Date.parse(first.provider.retryAt!)).toBeGreaterThanOrEqual(Date.parse(retryAt))
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse(first.provider.retryAt!) + 1)
    fetcher.mockImplementation(() => response(districts.map((_d, index) => payload(index))))
    const recovered = await overview()
    expect(recovered.unavailable).toBe(0)
    expect(recovered.provider.state).toBe('READY')
    expect(fetcher).toHaveBeenCalledTimes(2)
})
test('missing Retry-After uses increasing capped backoff rather than a fixed one-minute retry loop', async () => {
    global.fetch = jest.fn(() => response({}, 429))
    const time = Date.now()
    const clock = jest.spyOn(Date, 'now').mockReturnValue(time)
    jest.spyOn(Math, 'random').mockReturnValue(0)
    for (const delay of [60000, 120000, 240000, 480000, 960000, 1800000, 1800000]) {
        await expect(forecast(25, 68)).rejects.toThrow('rate limited')
        const until = Date.parse(weatherProviderStatus().retryAt!)
        expect(until - Date.now()).toBe(delay)
        clock.mockReturnValue(until + 1)
    }
})
test('invalid multi-location mapping is rejected instead of assigning evidence to the wrong district', async () => {
    global.fetch = jest.fn(() => response(districts.map(() => payload(0))))
    expect((await overview()).unavailable).toBe(7)
})
test('AI without cached evidence does not invoke Open-Meteo, even with a Groq key', async () => {
    process.env.GROQ_API_KEY = 'test-only'
    global.fetch = jest.fn()
    await expect(districtAnalysis('hyderabad')).rejects.toThrow('Fresh weather evidence')
    expect(global.fetch).not.toHaveBeenCalled()
})
