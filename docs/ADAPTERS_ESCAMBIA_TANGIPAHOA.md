# Adapters: Escambia + Tangipahoa (Target Plan)

This document lists target source adapters and canonical mappings for:

- Escambia County, FL (`12033`)
- Tangipahoa Parish, LA (`22105`)

## 1) Work Activity Layer

### Permits Adapter (`source_type=permit`)
- Subject: `property`
- Action examples: `permitted`, `approved`, `closed`
- Source ref: permit number / canonical URL

### Inspections Adapter (`source_type=inspection`)
- Subject: `property`
- Action examples: `inspected`, `failed`, `passed`
- Source ref: inspection id / report id

## 2) Condition Layer

### Code Enforcement Adapter (`source_type=enforcement`)
- Subject: `property` or `area`
- Action examples: `cited`, `violation`, `closed`
- Source ref: case id

### Sensor/Flood Adapter (`source_type=sensor`)
- Subject: `area`
- Action examples: `flooded`, `warning`, `cleared`
- Source ref: station id + timestamp hash

## 3) Authority Layer

### Agenda Adapter (`source_type=agenda`)
- Subject: `org`
- Action examples: `agenda_posted`
- Source ref: meeting id / agenda URL

### Ordinance Adapter (`source_type=ordinance`)
- Subject: `org` or `area`
- Action examples: `approved`, `updated`, `closed`
- Source ref: ordinance id

## 4) Trust Layer

### Health/Violation Inspection Adapter (`source_type=inspection`)
- Subject: `business`
- Action examples: `inspected`, `violation`, `closed`
- Source ref: business license id + inspection id

## Current Implemented Adapter

- `homeScoutListingsObservationAdapter` (`source_type=listing`)
- Uses real `home_scout_listings` records and maps them into canonical observations.
- `permitsObservationAdapter` (`source_type=permit`)
- Ingests real permit JSON input file into canonical observations.
- `inspectionsObservationAdapter` (`source_type=inspection`)
- Ingests real inspection JSON input file into canonical observations.
