# HANDOFF

Agentregler: v1.6
Inventory: 2026-11-13
Projektspråk: engelska (produkttext och README)

## Mål

En NES/SNES-emulator som hobbyprojekt, inte kommersiellt. Motorn hålls skild från skalet så att samma motor kan användas både på webben och som datorprogram. Webbversionen byggs först.

## Nuläge

Första spelbara NES-versionen för webben är byggd (körning A: F-003, F-004, F-005, F-009, F-011). Testad automatiskt med en egen testfil, både direkt mot motorn och i en webbläsare utan skärm, lokalt och på GitHub (bygg och tester gröna 2026-11-13). Publiceringen misslyckas tills Pages är påslaget. Inte provad med riktiga spel, med handkontroll eller på riktig telefon, och ljudet är inte lyssnat på.

Nästa steg: användaren slår på GitHub Pages (se Engångsåtgärder) och provar sidan. Därefter körning A i [BACKLOG.md](BACKLOG.md) (save states och backup).

## Publicering

GitHub Pages via GitHub Actions (.github/workflows/deploy.yml): bygger motorerna, kör testerna och publicerar dist/ till https://badbagel47.github.io/st8/ vid varje push till main (och när auto-merge har körts). Kräver att Pages är påslaget med källan "GitHub Actions" (se Engångsåtgärder). Agentens grenar (claude/…) slås ihop med main automatiskt via .github/workflows/auto-merge.yml.

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
- 2026-11-13: Vår egen kod licensieras under GPL v3 eller senare (användaren körde vidare på rekommendationen).
- 2026-11-13: Varje motor byggs som en egen fil och länkas aldrig ihop med den andra (licensskäl, docs/ENGINES.md). Motorversionerna låses, eftersom save states hör till motorversionen.

## Lagar och licenser (genomgång 2026-11-13, ingen juridisk bedömning)

- Upphovsrätt, ROM-filer: kommersiella spel är skyddade. Hanteras genom beslutet ovan.
- Licenser: Mesen har GPL v3 och Snes9x en egen licens som bara tillåter icke-kommersiell användning. De får inte länkas ihop i samma program, men kan användas sida vid sida som separata filer. Detaljer och krav i docs/ENGINES.md.
- Lagring i webbläsaren (sparfiler, inställningar): kan beröra 9 kap. 28 § lagen om elektronisk kommunikation. Bedöms i F-006. Källa: PTS.

## Miljö och begränsningar (2026-11-13)

- Agentens molnsession kan pusha direkt till main och skapa workflow-filer (provat 2026-11-13).
- Agenten kan läsa och klona publika repon (t.ex. motorernas källkod) och installera Emscripten i sessionen.
- Agenten kan inte ändra repoinställningar (standardgren, GitHub Pages); det gör användaren.

## Engångsåtgärder

- Byt standardgren till main i repoinställningarna: gjort 2026-11-13.
- Slå på GitHub Pages med källan "GitHub Actions": väntar. Agenten kan inte ändra repoinställningar.

## Dokumentkarta

- [AGENTS.md](AGENTS.md) – regler
- [BACKLOG.md](BACKLOG.md) – backlogg och körförslag
- [docs/ENGINES.md](docs/ENGINES.md) – motorer, licenser och testresultat (D-001)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – upplägg, save states och backupformat (D-002)
- [poc/engine-check](poc/engine-check) – det första provbygget av motorerna (D-001), ersatt av scripts/build-engines.sh och tests/
- [README.md](README.md) – projektbeskrivning och bygginstruktioner (engelska)
