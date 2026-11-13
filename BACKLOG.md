# BACKLOG

ID: en gemensam nummerserie. B = bugg, F = funktion, D = planering/design.

## Föreslagna körningar

- **A** – standardmodell, medelnivå – Hantera sparningar
  - F-013 – Ta bort save states och gamla kopior, så att listan går att hålla ren

Parkerat: F-012 (kräver Apple-utvecklarkonto).

## Öppna

| ID | Prioritet | Beskrivning |
|---|---|---|
| F-013 | Låg | Ta bort save states och äldre kopior av sparfilen i sparpanelen. I dag kan inget tas bort, så listan växer med automatiska och behållna kopior. Borttagning måste bekräftas. |
| F-012 | Låg | Signera och notarisera Mac-appen så att den öppnas utan varning. Kräver ett betalt Apple-utvecklarkonto (användarens beslut). Status: Parkerad. |

## Parkerat

Inget.

## Klart

| ID | Klart | Beskrivning |
|---|---|---|
| D-001 | 2026-11-13 | Licenser kontrollerade och båda motorerna provbyggda för webbläsaren och provkörda med save states. Resultat i docs/ENGINES.md, testet i poc/engine-check. Inte provat med riktiga spel eller i riktig webbläsare. |
| F-003 | 2026-11-13 | Öppna egen .nes-fil (knapp eller dra och släpp) och spela i webbläsaren, med paus, omstart och helskärm. Testat automatiskt med egen testfil. |
| F-004 | 2026-11-13 | Ljud via AudioWorklet med omsampling som håller ljud och bild i takt, samt volym och ljud av. Ljud produceras i test, men ingen har lyssnat. |
| F-005 | 2026-11-13 | Tangentbord, upp till två handkontroller och skärmknappar på pekskärmar. Tangentbord testat i webbläsare; handkontroll och pekskärm inte provade på riktig enhet. |
| F-009 | 2026-11-13 | Bygg, test och publicering via GitHub Actions till GitHub Pages. Publicerad 2026-11-13 (verifierat via GitHub Actions). |
| F-011 | 2026-11-13 | Licenssida med licenstexter och länkar till exakt källkodsversion för st8 och Mesen. Testad i webbläsare. |
| F-006 | 2026-11-13 | Spelets egna sparfil och save states sparas i webbläsaren: fyra platser med bild (F2/F4 för plats 1), "där du slutade" som skrivs löpande, automatiska lägen var femte minut. Export/import av .srm och äldre kopior som kan väljas tillbaka. Testat automatiskt i webbläsare, även efter omladdning. |
| F-010 | 2026-11-13 | Backup av allt eller ett spel som en ZIP-fil, och återställning som slår ihop utan att skriva över (äldre kopior behålls). Påminnelse om backup. Testat automatiskt, även återställning i en tom webbläsare. |
| F-007 | 2026-11-13 | SNES med Snes9x (.sfc, .smc, .swc, .fig) i samma skal, med alla knappar, skärmknappar för X/Y/L/R, save states, sparfil och backup. Byte mellan NES och SNES startar rätt motor. Testat automatiskt med egen testfil, direkt mot motorn och i webbläsare. |
| F-008 | 2026-11-13 | Datorversion för Mac (universell) och Linux (AppImage och deb) med Tauri. Samma motorer och sida som webben; sparningar som filer i appens datamapp; spara-dialog för export. Självtest i riktigt fönster godkänt på Linux (här och på GitHub) och på Mac (på GitHub). Filerna ligger på releasen desktop-latest. |
| D-002 | 2026-11-13 | Upplägg framtaget i docs/ARCHITECTURE.md, inklusive save states och backup. Besluten är fattade (se HANDOFF.md). |
