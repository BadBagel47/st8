# HANDOFF

Agentregler: v1.6
Inventory: 2026-11-13
Projektspråk: engelska (produkttext och README)

## Mål

En NES/SNES-emulator som hobbyprojekt, inte kommersiellt. Motorn hålls skild från skalet så att samma motor kan användas både på webben och som datorprogram. Webbversionen byggs först.

## Nuläge

Webbversionen spelar NES och SNES, med sparningar och backup (F-003–F-007, F-009–F-011). Datorversion för Mac och Linux finns (F-008). Allt är testat automatiskt med egna testfiler: direkt mot motorerna, i en webbläsare utan skärm och, för datorversionen, med ett självtest i ett riktigt fönster (Linux här, Mac på GitHub). Inte provat med riktiga spel, med handkontroll eller på riktig telefon, och ljudet är inte lyssnat på. Webbsidan är publicerad och datorversionerna ligger på releasen desktop-latest (verifierat via GitHub Actions 2026-11-13; sidan går inte att öppna från agentens miljö).

Nästa steg: användaren provar med riktiga spel, på telefon och på Mac/Linux. Förslag på körning i [BACKLOG.md](BACKLOG.md).

## Publicering

GitHub Pages via GitHub Actions (.github/workflows/deploy.yml): bygger motorerna, kör testerna och publicerar dist/ till https://badbagel47.github.io/st8/ vid varje push till main (och när auto-merge har körts). Kräver att Pages är påslaget med källan "GitHub Actions" (se Engångsåtgärder). Agentens grenar (claude/…) slås ihop med main automatiskt via .github/workflows/auto-merge.yml.

Datorversionen: .github/workflows/desktop.yml bygger Mac (universell dmg) och Linux (AppImage, deb), kör självtestet och lägger filerna på releasen "desktop-latest": https://github.com/BadBagel47/st8/releases/tag/desktop-latest. Mac-appen är inte signerad (se F-012).

## Bygga lokalt

Se README.md. Kortfattat: Emscripten 7.0.0 aktiverat, sedan `npm ci`, `npm run build:engines`, `npm test`, `npm run build`, `npm run test:e2e`. Motorernas källkod ligger som git-submoduler under engines/ på låsta versioner.

## Beslut

- 2026-11-13: Vi bygger inte emulatormotorer från grunden. Befintliga öppna motorer används, med eget skal runt.
- 2026-11-13: NES först, SNES som senare etapp.
- 2026-11-13: Motorer: Mesen för NES, Snes9x för SNES (väloptimerade utan funktionsförlust). En motor per system, inget motorval för användaren. Skalet byggs mot libretro-gränssnittet så att en motor kan bytas senare (t.ex. till bsnes).
- 2026-11-13: Projektet är ett hobbyprojekt och inte kommersiellt. Det är en förutsättning för Snes9x, vars licens förbjuder kommersiell användning.
- 2026-11-13: ROM-filer laddas av användaren och läses bara lokalt i webbläsaren. Inga ROM-filer i repot eller på servern.
- 2026-11-13: Save states och backup är ett kärnkrav (F-006, F-010) och ska finnas med i upplägget från början (D-002).
- 2026-11-13: Teknik för skalet: TypeScript för webben och Tauri för datorversionen (användaren körde vidare på rekommendationen efter D-002; ersätter den tidigare Rust-rekommendationen).
- 2026-11-13: Datorversionen (F-008) görs bara för Mac och Linux, inte Windows.
- 2026-11-13: Datorversionen sparar som filer i appens datamapp (inte webbvyns lagring), i samma struktur som backupen.
- 2026-11-13: Vår egen kod licensieras under GPL v3 eller senare (användaren körde vidare på rekommendationen).
- 2026-11-13: Varje motor byggs som en egen fil och länkas aldrig ihop med den andra (licensskäl, docs/ENGINES.md). Motorversionerna låses, eftersom save states hör till motorversionen.

## Lagar och licenser (genomgång 2026-11-13, ingen juridisk bedömning)

- Upphovsrätt, ROM-filer: kommersiella spel är skyddade. Hanteras genom beslutet ovan.
- Licenser: Mesen har GPL v3 och Snes9x en egen licens som bara tillåter icke-kommersiell användning. De får inte länkas ihop i samma program, men kan användas sida vid sida som separata filer. Detaljer och krav i docs/ENGINES.md.
- Lagring på användarens enhet (sparfiler, save states, inställningar i IndexedDB): bedömning 2026-11-13, ingen juridisk rådgivning. 9 kap. 28 § LEK kräver samtycke för lagring i användarens utrustning, utom när lagringen behövs för en tjänst som användaren uttryckligen har begärt. Sparningar som användaren själv gör och spelets egna sparfil bedöms falla under undantaget. Ingen spårning, ingen statistik, inga tredjepartstjänster och inget skickas någonstans. Appen säger tydligt att sparningar bara finns på enheten. Källa: PTS.

## Miljö och begränsningar (2026-11-13)

- Agentens molnsession kan pusha direkt till main och skapa workflow-filer (provat 2026-11-13).
- Agenten kan inte nå badbagel47.github.io från sin miljö (nätverket stoppar adressen); publiceringen kontrolleras via GitHub Actions.
- Agenten kan installera Linux-paket och köra datorappen i ett virtuellt fönster (xvfb).
- Agenten kan läsa och klona publika repon (t.ex. motorernas källkod) och installera Emscripten i sessionen.
- Agenten kan inte ändra repoinställningar (standardgren, GitHub Pages); det gör användaren.

## Engångsåtgärder

- Byt standardgren till main i repoinställningarna: gjort 2026-11-13.
- Slå på GitHub Pages med källan "GitHub Actions": gjort 2026-11-13.

## Dokumentkarta

- [AGENTS.md](AGENTS.md) – regler
- [BACKLOG.md](BACKLOG.md) – backlogg och körförslag
- [docs/ENGINES.md](docs/ENGINES.md) – motorer, licenser och testresultat (D-001)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – upplägg, save states och backupformat (D-002)
- [poc/engine-check](poc/engine-check) – det första provbygget av motorerna (D-001), ersatt av scripts/build-engines.sh och tests/
- [README.md](README.md) – projektbeskrivning och bygginstruktioner (engelska)
