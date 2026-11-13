# BACKLOG

ID: en gemensam nummerserie. B = bugg, F = funktion, D = planering/design.

## Föreslagna körningar

- **A** – stark modell, hög nivå – Save states och backup
  - F-006 – Sparfiler och save states som ligger kvar i webbläsaren
  - F-010 – Backup: exportera och återställ alla sparfiler och save states som en fil
- **B** – stark modell, hög nivå – SNES
  - F-007 – Lägg till SNES med Snes9x i samma skal
- **C** – stark modell, hög nivå – Datorprogram
  - F-008 – Datorversion för Windows, Mac och Linux som återanvänder motorerna

## Öppna

| ID | Prioritet | Beskrivning |
|---|---|---|
| F-006 | Hög | Sparfiler och save states lagrade lokalt i webbläsaren. Fram till dess försvinner spelets egna sparningar när sidan laddas om. Bedöm reglerna om lagring (LEK 9 kap. 28 §). Användarens krav: viktigt. |
| F-010 | Hög | Backup: exportera och återställ sparfiler och save states som en fil, så att inget går förlorat om webbläsarens lagring rensas. Formatet ska fungera även i datorversionen. Användarens krav: viktigt. Format enligt docs/ARCHITECTURE.md. |
| F-007 | Medel | SNES-stöd med Snes9x. |
| F-008 | Låg | Datorprogram för Windows, Mac och Linux. |

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
| D-002 | 2026-11-13 | Upplägg framtaget i docs/ARCHITECTURE.md, inklusive save states och backup. Besluten är fattade (se HANDOFF.md). |
