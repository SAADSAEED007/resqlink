jest.mock('../../handlers/logger', () => ({ __esModule: true, default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }))
import { districts, district } from '../../APIs/weather/districts'
import { attention } from '../../APIs/weather/attention'
import { forecast, normalizeWeather, coordinates, clearWeatherCache, weatherProviderStatus } from '../../APIs/riskZones/weather.service'
import { evidence, generateAnalysis, clearAnalysisCache } from '../../APIs/riskZones/intelligence.service'
import { overview } from '../../APIs/weather/monitoring.service'
import { ICommunityRiskZone } from '../../APIs/riskZones/types'
import request from 'supertest'
import app from '../../app'

function fixture() {
    const current = Math.floor(Date.now() / 900000) * 900,
        start = Math.floor((current + 18000) / 86400) * 86400 - 18000
    return {
        latitude: 25.4,
        longitude: 68.4,
        timezone: 'Asia/Karachi',
        current: { time: current, temperature_2m: 29, weather_code: 3, wind_speed_10m: 10 },
        hourly: {
            time: Array.from({ length: 96 }, (_, i) => start + i * 3600),
            precipitation: Array(96).fill(1),
            precipitation_probability: Array(96).fill(60),
            wind_speed_10m: Array(96).fill(10)
        },
        daily: {
            time: Array.from({ length: 4 }, (_, i) => start + i * 86400),
            weather_code: [3, 61, 3, 0],
            temperature_2m_max: [30, 29, 31, 32],
            temperature_2m_min: [24, 23, 24, 25],
            precipitation_sum: [24, 24, 24, 24],
            precipitation_probability_max: [60, 70, 60, 40]
        }
    }
}
const originalFetch = global.fetch,
    originalKey = process.env.GROQ_API_KEY
const originalProvider = process.env.WEATHER_PROVIDER
beforeEach(() => {
    process.env.WEATHER_PROVIDER = 'open-meteo'
    clearWeatherCache()
    clearAnalysisCache()
    delete process.env.GROQ_API_KEY
})
afterEach(() => {
    if (originalProvider) process.env.WEATHER_PROVIDER = originalProvider
    else delete process.env.WEATHER_PROVIDER
    global.fetch = originalFetch
    if (originalKey) process.env.GROQ_API_KEY = originalKey
    else delete process.env.GROQ_API_KEY
    jest.restoreAllMocks()
})
const response = (data: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(data) } as Response)
const weather = () => normalizeWeather(fixture())

describe('verified monitoring registry', () => {
    test('unique stable IDs and valid sourced Sindh town points', () => {
        expect(districts).toHaveLength(7)
        expect(new Set(districts.map((d) => d.id)).size).toBe(7)
        for (const d of districts) {
            expect(d.latitude).toBeGreaterThan(23)
            expect(d.latitude).toBeLessThan(29)
            expect(d.longitude).toBeGreaterThan(66)
            expect(d.longitude).toBeLessThan(71)
            expect(d.coordinateSource).toMatch(/geonames.org/)
            expect(d.districtNameSource).toMatch(/pbs.gov.pk/)
        }
    })
    test('rejects unknown district and missing/invalid coordinates', () => {
        expect(() => district('made-up')).toThrow('Unknown')
        for (const point of [
            [null, 68],
            [25, undefined],
            ['', 68],
            [91, 68],
            [25, 181],
            [Infinity, 68],
            ['NaN', 68]
        ])
            expect(() => coordinates(...(point as [unknown, unknown]))).toThrow()
    })
})
describe('forecast normalization and cache', () => {
    test('repeated browsing and refresh checks cannot bypass successful cache', async () => {
        const fetcher = jest.fn(() => response(fixture()))
        global.fetch = fetcher
        await forecast(25.4, 68.4)
        await Promise.all([forecast(25.4, 68.4), forecast(25.4, 68.4)])
        expect(fetcher).toHaveBeenCalledTimes(1)
    })
    test('transient failure waits for shared backoff instead of retrying immediately', async () => {
        const fetcher = jest
            .fn()
            .mockImplementationOnce(() => response({}, 503))
            .mockImplementationOnce(() => response(fixture()))
        global.fetch = fetcher
        await expect(forecast(25.4, 68.4)).rejects.toMatchObject({ statusCode: 503 })
        expect(fetcher).toHaveBeenCalledTimes(1)
        jest.spyOn(Date, 'now').mockReturnValue(Date.parse(weatherProviderStatus().retryAt!) + 1)
        expect((await forecast(25.4, 68.4)).current.temperatureC).toBe(29)
        expect(fetcher).toHaveBeenCalledTimes(2)
    })
    test('429 honors Retry-After across locations and forced refresh', async () => {
        const fetcher = jest.fn().mockResolvedValue({ ok: false, status: 429, headers: new Headers({ 'Retry-After': '120' }) })
        global.fetch = fetcher
        await expect(forecast(25.4, 68.4)).rejects.toThrow('rate limited')
        await expect(forecast(26, 68)).rejects.toThrow('rate limited')
        expect(fetcher).toHaveBeenCalledTimes(1)
        const now = Date.now()
        jest.spyOn(Date, 'now').mockReturnValue(now + 121000)
        fetcher.mockImplementation(() => response(fixture()))
        await expect(forecast(26, 68)).resolves.toHaveProperty('provider', 'Open-Meteo')
    })
    test('aggregates only next 24 hourly periods and preserves mm versus probability', () => {
        const raw = fixture()
        raw.hourly.precipitation[0] = 9999
        const result = normalizeWeather(raw)
        expect(result.next24Hours.precipitationMm).toBe(24)
        expect(result.next24Hours.maxProbabilityPercent).toBe(60)
        expect(result.units.precipitation).toBe('mm')
        expect(result.timezone).toBe('Asia/Karachi')
        expect(new Date(result.next24Hours.end).getTime() - new Date(result.next24Hours.start).getTime()).toBe(86400000)
        expect(result.days[0].time).toMatch(/T19:00:00.000Z$/)
    })
    test.each(['missing-current', 'misaligned', 'null-reading', 'invalid-probability', 'outdated'])('rejects malformed provider case %s', (kind) => {
        const raw = fixture()
        if (kind === 'missing-current') delete (raw as Partial<typeof raw>).current
        if (kind === 'misaligned') raw.hourly.precipitation.pop()
        if (kind === 'null-reading') raw.hourly.precipitation[0] = null as unknown as number
        if (kind === 'invalid-probability') raw.hourly.precipitation_probability[0] = 101
        if (kind === 'outdated') raw.current.time -= 86400
        expect(() => normalizeWeather(raw)).toThrow()
    })
    test('caches and coalesces requests for rounded coordinate key', async () => {
        const fetcher = jest.fn(() => response(fixture()))
        global.fetch = fetcher
        const values = await Promise.all([forecast(25.4, 68.4), forecast(25.4, 68.4)])
        expect(values[0].current.temperatureC).toBe(29)
        expect(fetcher).toHaveBeenCalledTimes(1)
        expect((await forecast(25.4, 68.4)).freshness).toBe('cached')
        expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('timezone=Asia%2FKarachi'), expect.anything())
    })
    test.each([500, 429, 400])('controls provider HTTP %s', async (status) => {
        global.fetch = jest.fn(() => response({}, status))
        await expect(forecast(25.4, 68.4)).rejects.toMatchObject({ statusCode: 503 })
    })
    test('controls provider timeout/network failure', async () => {
        global.fetch = jest.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError'))
        await expect(forecast(25.4, 68.4)).rejects.toMatchObject({ statusCode: 503 })
    })
    test('returns labeled stale cache on failure, never fresh', async () => {
        global.fetch = jest.fn(() => response(fixture()))
        await forecast(25.4, 68.4)
        const now = Date.now()
        jest.spyOn(Date, 'now').mockReturnValue(now + 21 * 60000)
        global.fetch = jest.fn(() => response({}, 500))
        expect((await forecast(25.4, 68.4)).freshness).toBe('stale')
    })
    test('seven-location batch maps shuffled location IDs and isolates malformed districts', async () => {
        let active = 0,
            max = 0
        const fetcher = jest.fn(async () => {
            active++
            max = Math.max(max, active)
            await new Promise((resolve) => setTimeout(resolve, 2))
            active--
            return response(
                districts
                    .map((_record, index) => ({
                        ...fixture(),
                        location_id: index,
                        current: index === 0 ? null : { ...fixture().current, temperature_2m: 20 + index }
                    }))
                    .reverse()
            )
        })
        global.fetch = fetcher
        const result = await overview()
        expect(result.items).toHaveLength(7)
        expect(result.unavailable).toBe(1)
        expect(result.items.find((item) => item.id === 'hyderabad')?.attention.level).toBe('DATA_UNAVAILABLE')
        expect(max).toBe(1)
        expect(fetcher).toHaveBeenCalledTimes(1)
        expect(result.items[1].weather?.current.temperatureC).toBe(21)
        expect(result.items[6].weather?.current.temperatureC).toBe(26)
    })
})
describe('transparent attention rules', () => {
    test.each([
        [0, 'ROUTINE'],
        [19.9, 'ROUTINE'],
        [20, 'ELEVATED'],
        [49.9, 'ELEVATED'],
        [50, 'URGENT_REVIEW']
    ])('rainfall %s maps to %s', (rain, level) => {
        const value = weather()
        value.next24Hours.precipitationMm = rain
        const before = JSON.stringify(value)
        expect(attention(value).level).toBe(level)
        expect(JSON.stringify(value)).toBe(before)
    })
    test('unavailable/stale is never routine', () => {
        expect(attention(null).level).toBe('DATA_UNAVAILABLE')
        expect(attention({ ...weather(), freshness: 'stale' }).level).toBe('DATA_UNAVAILABLE')
    })
})
const facts = [{ id: 'forecast:rain', text: 'Recorded forecast precipitation: 24 mm.' }]
const analysisInput = () => ({
    id: 'hyderabad',
    facts,
    model: 'openai/gpt-oss-20b',
    reviewLevel: 'ELEVATED',
    weather: weather(),
    version: 'v1',
    missingInformation: ['River levels unavailable.']
})
const validSelection = { summaryEvidenceReferences: ['forecast:rain'], insightEvidenceReferences: ['forecast:rain'], actionIds: ['MONITOR_WEATHER'] }
const completion = (value: unknown) => ({ choices: [{ message: { content: typeof value === 'string' ? value : JSON.stringify(value) } }] })
describe('Groq evidence selection', () => {
    test('missing key is controlled and invokes no provider', async () => {
        global.fetch = jest.fn()
        await expect(generateAnalysis(analysisInput())).rejects.toMatchObject({ statusCode: 503 })
        expect(global.fetch).not.toHaveBeenCalled()
    })
    test('valid structured output uses verbatim evidence, authoritative level, and cache', async () => {
        process.env.GROQ_API_KEY = 'test-key'
        global.fetch = jest.fn(() => response(completion(validSelection)))
        const result = (await generateAnalysis(analysisInput())) as { summary: string; reviewLevel: string }
        expect(result.summary).toBe(facts[0].text)
        expect(result.reviewLevel).toBe('ELEVATED')
        await generateAnalysis(analysisInput())
        expect(global.fetch).toHaveBeenCalledTimes(1)
        const call = jest.mocked(global.fetch).mock.calls[0]
        expect(
            (JSON.parse(String(call[1]?.body)) as { response_format: { json_schema: { strict: boolean } } }).response_format.json_schema.strict
        ).toBe(true)
    })
    test.each([
        ['bad-json', 'not json'],
        ['unsupported-fact', { ...validSelection, summaryEvidenceReferences: ['invented:flood'] }],
        ['arbitrary-claim', { ...validSelection, summary: 'District will flood' }]
    ])('rejects %s', async (_label, value) => {
        process.env.GROQ_API_KEY = 'test-key'
        global.fetch = jest.fn(() => response(completion(value)))
        await expect(generateAnalysis(analysisInput())).rejects.toMatchObject({ statusCode: 502 })
    })
    test.each([
        [401, 502],
        [404, 502],
        [429, 429],
        [500, 502]
    ])('handles Groq %s', async (status, expected) => {
        process.env.GROQ_API_KEY = 'test-key'
        global.fetch = jest.fn(() => response({}, status))
        await expect(generateAnalysis(analysisInput())).rejects.toMatchObject({ statusCode: expected })
    })
    test('handles timeout without leaking error details', async () => {
        process.env.GROQ_API_KEY = 'test-key'
        global.fetch = jest.fn().mockRejectedValue(new Error('secret-bearing upstream error'))
        await expect(generateAnalysis(analysisInput())).rejects.toThrow('Groq request timed out or failed')
    })
    test('evidence excludes free-text identity/contact and does not mutate recorded severity', () => {
        const zone = {
            hazardSeverity: 'HIGH',
            hazardType: 'FLASH_FLOOD',
            assessmentStatus: 'PENDING_ASSESSMENT',
            connectivityStatus: 'UNKNOWN',
            notes: 'Citizen Alice phone +923001234567',
            accessObstacles: ['Alice home'],
            fieldAssessment: {
                priorityUrgency: 'URGENT',
                assessmentNotes: 'Alice alice@example.com',
                assignedOfficer: 'Officer Bob',
                requestedAt: new Date()
            }
        } as ICommunityRiskZone
        const before = JSON.stringify(zone),
            payload = JSON.stringify(evidence(zone, null))
        expect(payload).not.toMatch(/Alice|Bob|92300|example.com/)
        expect(JSON.stringify(zone)).toBe(before)
    })
    test('district and AI endpoints require coordinator authentication', async () => {
        await request(app).get('/api/weather/districts').expect(401)
        await request(app).post('/api/weather/districts/hyderabad/ai-analysis').send({}).expect(401)
    })
})
