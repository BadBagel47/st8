# BACKLOG

ID: en gemensam nummerserie. B = bugg, F = funktion, D = planering/design.

## Föreslagna körningar

- **A** – stark modell, hög nivå – Utredning och upplägg innan något byggs
  - D-001 – Kontrollera licenser och att motorerna går att bygga för webbläsaren, så att valen kan låsas
  - D-002 – Ta fram upplägget för motor, webbskal och datorskal, så att bygget får en tydlig grund
- **B** – stark modell, hög nivå – Första spelbara NES-versionen på webben
  - F-003 – Ladda en egen spelfil och visa spelet i webbläsaren
  - F-004 – Lägg till ljud
  - F-005 – Styr med tangentbord och handkontroll
  - F-009 – Publicera webbversionen automatiskt via GitHub Pages
- **C** – stark modell, hög nivå – Save states och backup
  - F-006 – Sparfiler och save states som ligger kvar i webbläsaren
  - F-010 – Backup: exportera och återställ alla sparfiler och save states som en fil
- **D** – stark modell, hög nivå – SNES
  - F-007 – Lägg till SNES med Snes9x i samma skal
- **E** – stark modell, hög nivå – Datorprogram
  - F-008 – Datorversion för Windows, Mac och Linux som återanvänder motorerna

## Öppna

| ID | Prioritet | Beskrivning |
|---|---|---|
| D-001 | Hög | Kontrollera licenser (Mesen GPL v3, Snes9x icke-kommersiell, hur de kombineras, licens för vårt projekt) och att motorerna går att bygga för webbläsaren via libretro/Emscripten. Första koll 2026-11-13: båda har byggmål för webben i sina byggfiler; inte provbyggt. |
| D-002 | Hög | Arkitektur: motor skild från skal, libretro som gränssnitt, webbskal och datorskal, teknikval för skalet (Rust rekommenderat). |
| F-003 | Hög | Webbskal: ladda egen ROM-fil lokalt och visa bild från NES-motorn (Mesen). |
| F-004 | Hög | Ljud i webbversionen. |
| F-005 | Hög | Styrning: tangentbord och handkontroll. Pekskärm bedöms i samband med detta. |
| F-009 | Hög | Bygg och publicering av webbversionen via GitHub Pages. |
| F-006 | Hög | Sparfiler och save states lagrade lokalt i webbläsaren. Bedöm reglerna om lagring (LEK 9 kap. 28 §). Användarens krav: viktigt. |
| F-010 | Hög | Backup: exportera och återställ sparfiler och save states som en fil, så att inget går förlorat om webbläsarens lagring rensas. Formatet ska fungera även i datorversionen. Användarens krav: viktigt. |
| F-007 | Medel | SNES-stöd med Snes9x. |
| F-008 | Låg | Datorprogram för Windows, Mac och Linux. |

## Parkerat

Inget.

## Klart

Inget än.
