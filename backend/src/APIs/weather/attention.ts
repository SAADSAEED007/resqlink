import { Forecast } from '../riskZones/weather.service'
export const ATTENTION_LEVELS = ['ROUTINE', 'ELEVATED', 'URGENT_REVIEW', 'DATA_UNAVAILABLE'] as const
export type AttentionLevel = (typeof ATTENTION_LEVELS)[number]
function setting(name: string, fallback: number) {
    const value = Number(process.env[name])
    return Number.isFinite(value) && value > 0 ? value : fallback
}
export function policy() {
    const elevated = setting('RISK_REVIEW_ELEVATED_RAIN_MM', 20)
    return {
        version: 'prototype-rainfall-v1',
        elevatedRainMm: elevated,
        urgentRainMm: Math.max(elevated, setting('RISK_REVIEW_URGENT_RAIN_MM', 50)),
        disclaimer: 'Prototype attention heuristics, not official warning thresholds. Weather forecasts alone cannot establish flooding.'
    }
}
export function attention(weather: Forecast | null) {
    const rules = policy()
    let level: AttentionLevel = 'DATA_UNAVAILABLE'
    let reasonCode = 'FORECAST_UNAVAILABLE'
    let reason = 'A fresh forecast is unavailable; no monitoring level can be assigned.'
    const missingEvidence = !weather
        ? ['Forecast unavailable.']
        : [
              ...(weather.freshness === 'stale' ? ['Forecast is stale.'] : []),
              ...(!Number.isFinite(weather.next24Hours.precipitationMm) || weather.next24Hours.precipitationMm < 0
                  ? ['Valid forecast precipitation is missing.']
                  : []),
              ...(!Number.isFinite(weather.current.windKmh) || weather.current.windKmh < 0 ? ['Valid wind evidence is missing.'] : []),
              ...(weather.next24Hours.hourlyPeriods !== 24 ? ['Complete 24-hour forecast coverage is missing.'] : [])
          ]
    if (weather && !missingEvidence.length) {
        const rain = weather.next24Hours.precipitationMm
        if (rain >= rules.urgentRainMm) {
            level = 'URGENT_REVIEW'
            reasonCode = 'RAIN_URGENT_THRESHOLD'
            reason = `Next 24-hour precipitation (${rain} mm) meets the prototype human-review threshold (${rules.urgentRainMm} mm).`
        } else if (rain >= rules.elevatedRainMm) {
            level = 'ELEVATED'
            reasonCode = 'RAIN_ELEVATED_THRESHOLD'
            reason = `Next 24-hour precipitation (${rain} mm) meets the prototype elevated-attention threshold (${rules.elevatedRainMm} mm).`
        } else {
            level = 'ROUTINE'
            reasonCode = 'BELOW_REVIEW_THRESHOLDS'
            reason = `Next 24-hour precipitation (${rain} mm) is below the configured prototype attention thresholds.`
        }
    }
    return {
        level,
        reasonCode,
        reasons: [reason],
        missingEvidence,
        observationTime: weather?.current.time || null,
        retrievedAt: weather?.retrievedAt || null,
        limitations: [
            'Rainfall-only prototype thresholds; wind and local vulnerability require separate human review.',
            'Not an official flood warning or district-wide hazard prediction.',
            ...(weather?.limitations || [])
        ],
        inputs: weather
            ? {
                  precipitationMm: weather.next24Hours.precipitationMm,
                  maxProbabilityPercent: weather.next24Hours.maxProbabilityPercent,
                  currentWindKmh: weather.current.windKmh,
                  maxWindKmh: weather.next24Hours.maxWindKmh ?? null,
                  maxGustKmh: weather.next24Hours.maxGustKmh ?? null,
                  peakHourlyPrecipitationMm: weather.next24Hours.peakHourlyPrecipitationMm ?? null,
                  forecastStart: weather.next24Hours.start,
                  forecastEnd: weather.next24Hours.end
              }
            : null,
        policy: rules
    }
}
