/* eslint-disable no-console -- Assert that bounded provider logs never contain credentials. */
jest.mock('../../handlers/logger', () => ({ __esModule: true, default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }))
import { WeatherAPIProvider, normalizeWeatherApi } from '../../APIs/weather/providers/weatherapi.provider'
import { clearWeatherCache, forecast, getCachedForecast, WEATHER_CACHE_TTL_MS, weatherProviderStatus } from '../../APIs/riskZones/weather.service'
import { districtWeather } from '../../APIs/weather/monitoring.service'
import { attention } from '../../APIs/weather/attention'
import { districts } from '../../APIs/weather/districts'

const originalFetch = global.fetch
const originalKey = process.env.WEATHERAPI_KEY
const originalProvider = process.env.WEATHER_PROVIDER
const now = Date.parse('2026-10-18T08:25:00Z')
const point: { latitude: number; longitude: number } = { latitude: districts[0].latitude, longitude: districts[0].longitude }
// Synthetic provider fixtures only. No sample data enters runtime services.
function fixture(location = point) {
    const start = Date.parse('2026-10-17T19:00:00Z') / 1000
    return {
        location: { lat: location.latitude, lon: location.longitude, tz_id: 'Asia/Karachi' },
        current: {
            last_updated_epoch: now / 1000 - 600,
            temp_c: 30,
            feelslike_c: 32,
            humidity: 60,
            wind_kph: 12,
            gust_kph: 18,
            precip_mm: 0.2,
            condition: { text: 'Partly cloudy', code: 1003 }
        },
        forecast: {
            forecastday: Array.from({ length: 3 }, (_, d) => ({
                date: `2026-10-${18 + d}`,
                day: {
                    maxtemp_c: 33,
                    mintemp_c: 25,
                    totalprecip_mm: 999,
                    daily_chance_of_rain: 70,
                    condition: { text: 'Partly cloudy', code: 1003 }
                },
                hour: Array.from({ length: 24 }, (_, h) => ({
                    time_epoch: start + d * 86400 + h * 3600,
                    precip_mm: 1,
                    chance_of_rain: 60,
                    wind_kph: 20,
                    gust_kph: 30
                }))
            }))
        }
    }
}
const response = (body: unknown, status = 200, retryAfter?: string) =>
    Promise.resolve({
        ok: status < 400,
        status,
        headers: new Headers(retryAfter ? { 'Retry-After': retryAfter } : {}),
        json: () => Promise.resolve(body)
    } as Response)
beforeEach(() => {
    jest.useFakeTimers({ now })
    process.env.WEATHERAPI_KEY = 'test-only-not-a-real-secret'
    delete process.env.WEATHER_PROVIDER
    clearWeatherCache()
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
})
afterEach(() => {
    clearWeatherCache()
    jest.useRealTimers()
    jest.restoreAllMocks()
    global.fetch = originalFetch
    if (originalKey === undefined) delete process.env.WEATHERAPI_KEY
    else process.env.WEATHERAPI_KEY = originalKey
    if (originalProvider === undefined) delete process.env.WEATHER_PROVIDER
    else process.env.WEATHER_PROVIDER = originalProvider
})
test('normalizes three days, epoch/timezone, units, current values and complete future hours', () => {
    const value = normalizeWeatherApi(fixture(), point, now)
    expect(value.provider).toBe('WeatherAPI.com')
    expect(value.current).toMatchObject({
        temperatureC: 30,
        windKmh: 12,
        gustKmh: 18,
        precipitationMm: 0.2,
        feelsLikeC: 32,
        humidityPercent: 60,
        condition: 'Partly cloudy'
    })
    expect(value.current.time).toBe('2026-10-18T08:15:00.000Z')
    expect(value.retrievedAt).toBe('2026-10-18T08:25:00.000Z')
    expect(value.next24Hours).toMatchObject({
        start: '2026-10-18T09:00:00.000Z',
        end: '2026-10-19T09:00:00.000Z',
        precipitationMm: 24,
        hourlyPeriods: 24,
        maxWindKmh: 20,
        maxGustKmh: 30,
        peakHourlyPrecipitationMm: 1
    })
    expect(value.days[0]).toMatchObject({ time: '2026-10-17T19:00:00.000Z', precipitationMm: 999 })
    expect(value.days).toHaveLength(3)
    expect(value.units).toMatchObject({ precipitation: 'mm', wind: 'km/h' })
})
test.each(['rain', 'wind', 'coverage', 'stale'])('attention rejects missing or stale %s evidence', (kind) => {
    const value = normalizeWeatherApi(fixture(), point, now)
    if (kind === 'rain') value.next24Hours.precipitationMm = NaN
    if (kind === 'wind') value.current.windKmh = NaN
    if (kind === 'coverage') value.next24Hours.hourlyPeriods = 23
    if (kind === 'stale') value.freshness = 'stale'
    expect(attention(value).level).toBe('DATA_UNAVAILABLE')
    expect(attention(value).missingEvidence.length).toBeGreaterThan(0)
})
test.each([
    'missing day',
    'missing hour',
    'missing rain',
    'missing wind',
    'NaN',
    'string number',
    'bad probability',
    'wrong location',
    'wrong timezone',
    'duplicate timestamp',
    'old observation',
    'unknown condition'
])('rejects %s without substituting zeros', (kind) => {
    const data = fixture()
    switch (kind) {
        case 'missing day':
            data.forecast.forecastday.pop()
            break
        case 'missing hour':
            data.forecast.forecastday[0].hour.pop()
            break
        case 'missing rain':
            delete (data.forecast.forecastday[1].hour[0] as Partial<(typeof data.forecast.forecastday)[1]['hour'][0]>).precip_mm
            break
        case 'missing wind':
            delete (data.forecast.forecastday[1].hour[0] as Partial<(typeof data.forecast.forecastday)[1]['hour'][0]>).wind_kph
            break
        case 'NaN':
            data.current.temp_c = NaN
            break
        case 'string number':
            ;(data.current as unknown as Record<string, unknown>).temp_c = '30'
            break
        case 'bad probability':
            data.forecast.forecastday[1].hour[0].chance_of_rain = 101
            break
        case 'wrong location':
            data.location.lat = 27
            break
        case 'wrong timezone':
            data.location.tz_id = 'Europe/London'
            break
        case 'duplicate timestamp':
            data.forecast.forecastday[1].hour[0].time_epoch = data.forecast.forecastday[0].hour[23].time_epoch
            break
        case 'old observation':
            data.current.last_updated_epoch -= 10800
            break
        case 'unknown condition':
            data.current.condition.code = 9999
            break
    }
    expect(() => normalizeWeatherApi(data, point, now)).toThrow('WeatherAPI')
})
test('rejects a contiguous but incomplete future 24-hour interval', () => {
    const data = fixture()
    const later = Date.parse('2026-10-20T18:30:00Z')
    data.current.last_updated_epoch = later / 1000
    expect(() => normalizeWeatherApi(data, point, later)).toThrow('incomplete')
})
test('missing key makes zero provider requests and yields explicit unavailable district state', async () => {
    delete process.env.WEATHERAPI_KEY
    const fetcher = jest.fn()
    global.fetch = fetcher
    const value = await districtWeather('hyderabad')
    expect(value.weather).toBeNull()
    expect(value.error).toMatch(/WEATHERAPI_KEY/)
    expect(value.attention.level).toBe('DATA_UNAVAILABLE')
    expect(weatherProviderStatus().configured).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
})
test.each([400, 401, 403, 429, 500, 503])('handles HTTP %s without logging credentials or provider body', async (status) => {
    global.fetch = jest.fn(() => response({ error: { message: 'sensitive provider body test-only-not-a-real-secret' } }, status))
    const promise = forecast(point.latitude, point.longitude)
    const assertion = expect(promise).rejects.toMatchObject({ statusCode: 503 })
    await jest.advanceTimersByTimeAsync(30)
    await assertion
    expect(weatherProviderStatus().state).toBe('COOLDOWN')
    expect(JSON.stringify((console.warn as jest.Mock).mock.calls)).not.toContain('test-only-not-a-real-secret')
})
test('deduplicates simultaneous reads and shares fresh cache across detail requests', async () => {
    const fetcher = jest.fn<Promise<Response>, [unknown]>(() => response(fixture()))
    global.fetch = fetcher
    const promise = Promise.all([forecast(point.latitude, point.longitude), forecast(point.latitude, point.longitude)])
    await jest.advanceTimersByTimeAsync(30)
    const [a, b] = await promise
    expect(a).toEqual(b)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const value = await districtWeather('hyderabad')
    expect(value.weather?.freshness).toBe('cached')
    expect(value.weather?.retrievedAt).toBe(a.retrievedAt)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const url = new URL(String(fetcher.mock.calls[0]?.[0]))
    expect(url.origin + url.pathname).toBe('https://api.weatherapi.com/v1/forecast.json')
    expect(url.searchParams.get('days')).toBe('3')
    expect(url.searchParams.get('q')).toBe(`${point.latitude},${point.longitude}`)
})
test('expiry, 429 Retry-After, stale timestamps, blocked repeated reads and recovery', async () => {
    const fetcher = jest.fn<Promise<Response>, [unknown, unknown?]>(() => response(fixture()))
    global.fetch = fetcher
    const initial = forecast(point.latitude, point.longitude)
    await jest.advanceTimersByTimeAsync(30)
    const first = await initial
    jest.setSystemTime(now + WEATHER_CACHE_TTL_MS + 1000)
    fetcher.mockImplementation(() => response({}, 429, '600'))
    const refresh = forecast(point.latitude, point.longitude)
    await jest.advanceTimersByTimeAsync(30)
    const stale = await refresh
    expect(stale.freshness).toBe('stale')
    expect(stale.retrievedAt).toBe(first.retrievedAt)
    expect(attention(stale).level).toBe('DATA_UNAVAILABLE')
    const deadline = Date.parse(weatherProviderStatus().retryAt!)
    expect(deadline).toBeGreaterThanOrEqual(Date.now() + 599000)
    await forecast(point.latitude, point.longitude)
    expect(fetcher).toHaveBeenCalledTimes(2)
    jest.setSystemTime(deadline + 1)
    fetcher.mockImplementation(() => response(fixture()))
    const recover = forecast(point.latitude, point.longitude)
    await jest.advanceTimersByTimeAsync(30)
    expect((await recover).freshness).toBe('fresh')
    expect(weatherProviderStatus().state).toBe('READY')
})
test('invalid district payload does not block the next district and request concurrency is one', async () => {
    let active = 0,
        peak = 0
    global.fetch = jest.fn(async (input: string | URL | Request) => {
        active++
        peak = Math.max(peak, active)
        const q = new URL(String(input)).searchParams.get('q')!.split(',').map(Number)
        const body = q[0] === point.latitude ? {} : fixture({ latitude: q[0], longitude: q[1] })
        await Promise.resolve()
        active--
        return await response(body)
    })
    const pending = Promise.all([districtWeather('hyderabad'), districtWeather('sukkur')])
    await jest.advanceTimersByTimeAsync(1100)
    const [first, second] = await pending
    expect(first.weather).toBeNull()
    expect(second.weather?.provider).toBe('WeatherAPI.com')
    expect(peak).toBe(1)
    expect(weatherProviderStatus().state).toBe('READY')
})
test('network errors are sanitized and timeout abort is bounded at 12 seconds', async () => {
    global.fetch = jest.fn(
        (_input, options) =>
            new Promise<Response>((_resolve, reject) => {
                options?.signal?.addEventListener('abort', () => reject(new Error('https://api.weatherapi.com/?key=test-only-not-a-real-secret')))
            })
    )
    const promise = forecast(point.latitude, point.longitude)
    const assertion = expect(promise).rejects.toThrow('temporarily unavailable')
    await jest.advanceTimersByTimeAsync(12030)
    await assertion
    expect(JSON.stringify((console.warn as jest.Mock).mock.calls)).not.toContain('test-only-not-a-real-secret')
})
test('adapter rejects provider error objects even on HTTP 200', async () => {
    global.fetch = jest.fn(() => response({ error: { code: 2006, message: 'Invalid key' } }))
    await expect(new WeatherAPIProvider().getForecast(point, new AbortController().signal)).rejects.toThrow('provider error')
})
test('expired snapshots are removed after one hour', async () => {
    global.fetch = jest.fn(() => response(fixture()))
    const promise = forecast(point.latitude, point.longitude)
    await jest.advanceTimersByTimeAsync(30)
    const value = await promise
    jest.setSystemTime(Date.parse(value.retrievedAt) + 3600001)
    expect(getCachedForecast(point.latitude, point.longitude)).toBeNull()
})
