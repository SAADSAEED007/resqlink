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
    if (weather && weather.freshness !== 'stale') {
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
        inputs: weather
            ? {
                  precipitationMm: weather.next24Hours.precipitationMm,
                  maxProbabilityPercent: weather.next24Hours.maxProbabilityPercent,
                  forecastStart: weather.next24Hours.start,
                  forecastEnd: weather.next24Hours.end
              }
            : null,
        policy: rules
    }
}
