# PowerPulse roadmap

- [x] Brighter design system with light/dark toggle (light default)
- [x] Landing page (no ESP32 card), business-only sign up / sign in with business type
- [x] Header with dropdown menu navigation
- [x] Live data from physical ESP32 over MQTT (HiveMQ public broker, visible in MQTT Explorer) + demo fallback
- [x] Dashboard, Circuits, Loss Analysis, History, Settings pages
- [x] Ask ZedBot AI assistant on Gemini API using business readings
- [x] Reference dataset (Zambian tariffs, appliance loads, business benchmarks, load-shedding facts) fed to ZedBot
- [x] ESP32 firmware (simulated readings, MQTT publish) delivered as a file
- [x] Tests for loss estimate and units-left rules
- [ ] Left sidebar navigation (replaces dropdown)
- [ ] History: filter by month and year
- [ ] Circuits page shows live circuits from the meter's own MQTT data
- [ ] Loss Analysis → Analysis: usage by day / week / month / year (outage cost kept as a section)
