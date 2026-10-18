/* eslint-disable no-console -- Standalone CLI diagnostic output for Render Shell. */
import { districts } from '../APIs/weather/districts'
import { attention } from '../APIs/weather/attention'
import { forecast } from '../APIs/riskZones/weather.service'

// Run on Render with: node dist/scripts/diagnose-weather.js
// Uses the production ingestion path without database, login, or AI dependencies.
async function diagnose() {
    await Promise.all(
        districts.map(async (district) => {
            try {
                const weather = await forecast(district.latitude, district.longitude)
                console.log(
                    JSON.stringify({
                        district: district.id,
                        provider: weather.provider,
                        current: weather.current,
                        next24Hours: weather.next24Hours,
                        retrievedAt: weather.retrievedAt,
                        attention: attention(weather).level
                    })
                )
            } catch (error) {
                process.exitCode = 1
                console.error(JSON.stringify({ district: district.id, error: error instanceof Error ? error.message : 'UnknownError' }))
            }
        })
    )
}
void diagnose()
