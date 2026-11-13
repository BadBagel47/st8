# BACKLOG

ID: en gemensam nummerserie. B = bugg, F = funktion, D = planering/design.

## Föreslagna körningar

- **A** – stark modell, hög nivå – SNES
  - F-007 – Lägg till SNES med Snes9x i samma skal
- **B** – stark modell, hög nivå – Datorprogram
  - F-008 – Datorversion för Mac och Linux som återanvänder motorerna

## Öppna

| ID | Prioritet | Beskrivning |
|---|---|---|
| F-007 | Medel | SNES-stöd med Snes9x. |
| F-008 | Låg | Datorprogram för Mac och Linux (inte Windows, användarens beslut 2026-11-13). |

## Parkerat

Inget.

## Klart

| ID | Klart | Beskrivning |
|---|---|---|
| D-001 | 2026-11-13 | Licenser kontrollerade och båda motorerna provbyggda för webbläsaren och provkörda med save states. Resultat i docs/ENGINES.md, testet i poc/engine-check. Inte provat med riktiga spel eller i riktig webbläsare. |
| F-003 | 2026-11-13 | Öppna egen .nes-fil (knapp eller dra och släpp) och spela i webbläsaren, med paus, omstart och helskärm. Testat automatiskt med egen testfil. |
| F-004 | 2026-11-13 | Ljud via AudioWorklet med omsampling som håller ljud och bild i takt, samt volym och ljud av. Ljud produceras i test, men ingen har lyssnat. |
| F-005 | 2026-11-13 | Tangentbord, upp till två handkontroller och skärmknappar på pekskärmar. Tangentbord testat i webbläsare; handkontroll och pekskärm inte provade på riktig enhet. |
| F-009 | 2026-11-13 | Bygg, test och publicering via GitHub Actions till GitHub Pages. Bygg och tester gröna på GitHub; själva publiceringen väntar på att Pages slås på och är inte verifierad. |
| F-011 | 2026-11-13 | Licenssida med licenstexter och länkar till exakt källkodsversion för st8 och Mesen. Testad i webbläsare. |
| F-006 | 2026-11-13 | Spelets egna sparfil och save states sparas i webbläsaren: fyra platser med bild (F2/F4 för plats 1), "där du slutade" som skrivs löpande, automatiska lägen var femte minut. Export/import av .srm och äldre kopior som kan väljas tillbaka. Testat automatiskt i webbläsare, även efter omladdning. |
| F-010 | 2026-11-13 | Backup av allt eller ett spel som en ZIP-fil, och återställning som slår ihop utan att skriva över (äldre kopior behålls). Påminnelse om backup. Testat automatiskt, även återställning i en tom webbläsare. |
| D-002 | 2026-11-13 | Upplägg framtaget i docs/ARCHITECTURE.md, inklusive save states och backup. Besluten är fattade (se HANDOFF.md). |
