# HANDOFF

Agentregler: v1.6
Inventory: 2026-11-13
Projektspråk: engelska (produkttext och README)

## Mål

En NES/SNES-emulator som hobbyprojekt, inte kommersiellt. Motorn hålls skild från skalet så att samma motor kan användas både på webben och som datorprogram. Webbversionen byggs först.

## Nuläge

Utredningen är klar (D-001, D-002). Båda motorerna är provbyggda för webbläsaren och save states fungerar i test. Ingen produktkod finns än, bara testet i poc/engine-check.

Nästa steg: användaren svarar på de två öppna besluten nedan, därefter körning A i [BACKLOG.md](BACKLOG.md) (första spelbara NES-versionen).

## Öppna beslut (väntar på användaren)

1. Teknik för skalet: TypeScript för webben och Tauri för datorversionen, i stället för den tidigare Rust-rekommendationen. Skäl i docs/ARCHITECTURE.md.
2. Licens för vår egen kod: GPL v3 (samma som Mesen, enklast) eller MIT (friare). Se docs/ENGINES.md.

## Publicering

Planerat: GitHub Pages från main. Inte uppsatt och inte verifierat än (ingår i F-009). Agentens grenar (claude/…) slås ihop med main automatiskt via .github/workflows/auto-merge.yml.

## Beslut

- 2026-11-13: Vi bygger inte emulatormotorer från grunden. Befintliga öppna motorer används, med eget skal runt.
- 2026-11-13: NES först, SNES som senare etapp.
- 2026-11-13: Motorer: Mesen för NES, Snes9x för SNES (väloptimerade utan funktionsförlust). En motor per system, inget motorval för användaren. Skalet byggs mot libretro-gränssnittet så att en motor kan bytas senare (t.ex. till bsnes).
- 2026-11-13: Projektet är ett hobbyprojekt och inte kommersiellt. Det är en förutsättning för Snes9x, vars licens förbjuder kommersiell användning.
- 2026-11-13: ROM-filer laddas av användaren och läses bara lokalt i webbläsaren. Inga ROM-filer i repot eller på servern.
- 2026-11-13: Save states och backup är ett kärnkrav (F-006, F-010) och ska finnas med i upplägget från början (D-002).
- 2026-11-13: Teknik för skalet: Rust var rekommenderat när motorn skulle skrivas själv. Efter D-002 är rekommendationen ändrad, se Öppna beslut.
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
- Slå på GitHub Pages för repot: väntar (behövs i F-009).

## Dokumentkarta

- [AGENTS.md](AGENTS.md) – regler
- [BACKLOG.md](BACKLOG.md) – backlogg och körförslag
- [docs/ENGINES.md](docs/ENGINES.md) – motorer, licenser och testresultat (D-001)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – upplägg, save states och backupformat (D-002)
- [poc/engine-check](poc/engine-check) – testet som provbygger och provkör motorerna
