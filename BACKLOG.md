# BACKLOG

ID: en gemensam nummerserie. B = bugg, F = funktion, D = planering/design.

## Föreslagna körningar

- **A** – stark modell, hög nivå – Första spelbara NES-versionen på webben
  - F-003 – Ladda en egen spelfil och visa spelet i webbläsaren
  - F-004 – Lägg till ljud
  - F-005 – Styr med tangentbord och handkontroll
  - F-009 – Publicera webbversionen automatiskt via GitHub Pages
  - F-011 – Licenssida i appen med länkar till motorernas källkod, som licenserna kräver
- **B** – stark modell, hög nivå – Save states och backup
  - F-006 – Sparfiler och save states som ligger kvar i webbläsaren
  - F-010 – Backup: exportera och återställ alla sparfiler och save states som en fil
- **C** – stark modell, hög nivå – SNES
  - F-007 – Lägg till SNES med Snes9x i samma skal
- **D** – stark modell, hög nivå – Datorprogram
  - F-008 – Datorversion för Windows, Mac och Linux som återanvänder motorerna

Körning A förutsätter att de två öppna besluten i HANDOFF.md är fattade.

## Öppna

| ID | Prioritet | Beskrivning |
|---|---|---|
| F-003 | Hög | Webbskal: ladda egen ROM-fil lokalt och visa bild från NES-motorn (Mesen). Omfattar bygget av motorn och core host enligt docs/ARCHITECTURE.md. Avgör också om spelfilen ska kunna ligga kvar lokalt i webbläsaren mellan besök. |
| F-004 | Hög | Ljud i webbversionen. |
| F-005 | Hög | Styrning: tangentbord och handkontroll. Pekskärm bedöms i samband med detta. |
| F-009 | Hög | Bygg och publicering av webbversionen via GitHub Pages. Se noten om auto-merge i docs/ARCHITECTURE.md. |
| F-011 | Hög | Licenssida i appen: motorernas namn, licenstexter och länkar till exakt källkod och till detta repo (krav i GPL v3 och Snes9x-licensen, se docs/ENGINES.md). |
| F-006 | Hög | Sparfiler och save states lagrade lokalt i webbläsaren. Bedöm reglerna om lagring (LEK 9 kap. 28 §). Användarens krav: viktigt. |
| F-010 | Hög | Backup: exportera och återställ sparfiler och save states som en fil, så att inget går förlorat om webbläsarens lagring rensas. Formatet ska fungera även i datorversionen. Användarens krav: viktigt. Format enligt docs/ARCHITECTURE.md. |
| F-007 | Medel | SNES-stöd med Snes9x. |
| F-008 | Låg | Datorprogram för Windows, Mac och Linux. |

## Parkerat

Inget.

## Klart

| ID | Klart | Beskrivning |
|---|---|---|
| D-001 | 2026-11-13 | Licenser kontrollerade och båda motorerna provbyggda för webbläsaren och provkörda med save states. Resultat i docs/ENGINES.md, testet i poc/engine-check. Inte provat med riktiga spel eller i riktig webbläsare. |
| D-002 | 2026-11-13 | Upplägg framtaget i docs/ARCHITECTURE.md, inklusive save states och backup. Två beslut väntar på användaren (se HANDOFF.md). |
