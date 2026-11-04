# Jorunns adventskalender

Start (krever Node 18+):

    $env:ADMIN_PASSWORD="velg-et-passord"; $env:BYPASS_CODE="hemmelig-kode"; node server.js

(bash: `ADMIN_PASSWORD=... BYPASS_CODE=... node server.js`)

- Kalender: http://localhost:3000/
- Direktelenke til luke: `/?luke=7` – viser hele kalenderen, zoomer inn og åpner luka
- Admin: `/admin.html` (passord = ADMIN_PASSWORD). Her redigeres tekstene og lenker kopieres.
- Skjult bypass: trykk 5 ganger raskt på tittelen "Jorunns adventskalender" og skriv inn BYPASS_CODE (eller admin-passordet). Trykk tittelen igjen for å slå av.
- Tekstene lagres i `data/messages.json` og sendes kun ut fra serveren når luka kan åpnes.
- Valgfritt: `CALENDAR_YEAR`, `PORT`, `FAKE_DATE=2026-12-10` (for testing).
