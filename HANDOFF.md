# HANDOFF

Agentregler: v1.6
Inventory: 2026-11-13
Projektspråk: engelska (produkttext och README)

## Mål

En NES/SNES-emulator som hobbyprojekt, inte kommersiellt. Motorn hålls skild från skalet så att samma motor kan användas både på webben och som datorprogram. Webbversionen byggs först.

## Nuläge

Repot är nytt. Det finns bara grunddokument, ingen kod. Nästa steg är D-001 och D-002 i [BACKLOG.md](BACKLOG.md).

## Publicering

Planerat: GitHub Pages från main. Inte uppsatt och inte verifierat än (ingår i F-009). Agentens grenar (claude/…) slås ihop med main automatiskt via .github/workflows/auto-merge.yml.

## Beslut

- 2026-11-13: Vi bygger inte emulatormotorer från grunden. Befintliga öppna motorer används, med eget skal runt.
- 2026-11-13: NES först, SNES som senare etapp.
- 2026-11-13: Motorer: Mesen för NES, Snes9x för SNES (väloptimerade utan funktionsförlust). En motor per system, inget motorval för användaren. Skalet byggs mot libretro-gränssnittet så att en motor kan bytas senare (t.ex. till bsnes).
- 2026-11-13: Projektet är ett hobbyprojekt och inte kommersiellt. Det är en förutsättning för Snes9x, vars licens förbjuder kommersiell användning.
- 2026-11-13: ROM-filer laddas av användaren och läses bara lokalt i webbläsaren. Inga ROM-filer i repot eller på servern.
- 2026-11-13: Teknik för skalet: Rust rekommenderat (webb via WebAssembly, datorprogram direkt). Slutligt upplägg bestäms i D-002.

## Lagar och licenser (genomgång 2026-11-13, ingen juridisk bedömning)

- Upphovsrätt, ROM-filer: kommersiella spel är skyddade. Hanteras genom beslutet ovan.
- Licenser: Mesen har GPL v3, vilket innebär att vårt projekt måste ha öppen källkod under en förenlig licens. Snes9x har en egen licens som bara tillåter icke-kommersiell användning. Hur de två går ihop i samma projekt utreds i D-001.
- Lagring i webbläsaren (sparfiler, inställningar): kan beröra 9 kap. 28 § lagen om elektronisk kommunikation. Bedöms i F-006. Källa: PTS.

## Miljö och begränsningar (2026-11-13)

- Agentens molnsession har GitHub-åtkomst till detta repo. Om push direkt till main och skapande av workflow-filer fungerar noteras här efter första försöket.

## Engångsåtgärder

- Slå på GitHub Pages för repot: väntar (behövs i F-009).

## Dokumentkarta

- [AGENTS.md](AGENTS.md) – regler
- [BACKLOG.md](BACKLOG.md) – backlogg och körförslag
