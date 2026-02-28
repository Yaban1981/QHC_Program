# QHC Admin Dashboard – Phase A (DB tabs + migration)

## What we added (Google Sheets)
- Tournois
- Inscriptions
- Equipes
- EquipeMembres
- Config
- AuditLog

## Script
Apps Script file: DbSetupAndMigration.gs

### Run order
1) setupDbTabs()
2) importTournoisFromEvents() (optional)
3) migrateInscriptionsFromDisponibilitesJson()

## Notes
- Keeps 'Réponses QHC 2026' as MVP player table
- Generates Inscriptions from disponibilites_json using Tournois.form_field_key
- Idempotent upsert on (joueur_timestamp, tournoi_id)
