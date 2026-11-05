## Atrybuty trackingu na nowych stronach mirumee.com

Tworząc lub edytując stronę mirumee.com (Webflow), zawsze dodaj atrybuty `data-*` dla GA4. Skrypt trackingu działa już na całej stronie, wystarczy markup.

### Jak to działa
- `<a>`/`<button>` z `data-track="<akcja>"` wysyła event `<akcja>_click` (myślniki zamieniane na `_`).
- `data-track-location` mówi, gdzie na stronie (`hero`, `section`, `footer-cta`…), a `data-track-name` co to jest (osoba, klient, oferta). URL linku dochodzi sam.
- Linki z `href="#"` albo bez `href` nie są śledzone. Daj CTA prawdziwy URL lub kotwicę, albo użyj `<button>`.

### Słownik akcji
| Element | `data-track` | `data-track-name` |
|---|---|---|
| Link do /contact | `cta` | np. `talk-to-expert` |
| Kalendarz / umówienie rozmowy | `booking` | osoba, np. `iwo-rzepiela` |
| Rejestracja na event | `register` | slug eventu |
| Link do case study | `case-study` | slug klienta |
| Link zewnętrzny (strona klienta) | `outbound` | slug klienta/strony |
| Pobranie pliku | `download` | slug pliku |
| Aplikacja na ofertę pracy | `apply` | slug oferty |
| Rozwijanie / „pokaż więcej” | `expand` | slug sekcji |
| Zakładki / kroki | `tab` | np. `step-01` |
| Zamknięcie overlayu / powrót / do góry | `case-study-close` / `case-study-home` / `scroll-top` | slug strony |

```html
<a href="/contact?to=24022103" data-track="cta" data-track-location="hero" data-track-name="talk-to-expert">Talk to an expert</a>
```

Zasady:
- Otaguj każde główne CTA (zwykle 1–3: hero, środek strony, CTA na końcu), każde z inną `data-track-location`.
- Wartości pisz w lowercase-kebab-case, bez tekstu z copy.
- Nie taguj nawigacji, stopki, ikon social ani linków prawnych (nav i stopka są już śledzone).

### Kontakt i handlowcy
- `/contact?to=<pipedriveUserId>` przypisuje leada do osoby. Bez `?to=` albo z nieznanym ID trafia do domyślnej osoby.
- ID: Maciej Switek `24022103` (domyślny), Michał Ociepka `17062690`, Iwo Rzepiela `25079049`.
- Linki do kalendarza: `/app/api/calendar?to=<id>`, a nie Calendly czy Google Calendar wpisane na sztywno. Tag: `booking`.

### Formularze leadowe
- Pola nazwij `name`, `email`, `phone` (opcjonalne) i `message`.
- Na `<form>` dodaj `data-lead-form="<slug-strony>"`.
- W kodzie stopki strony wstaw `<script src="/app/contact-form.js"></script>`.

Lead trafia do Pipedrive, a GA4 dostaje `generate_lead`. Nie używaj natywnej obsługi formularzy Webflow.

### Strony HTML jako Code Embed
- Atrybuty `data-*` wpisz bezpośrednio w HTML.
- Na **każdym** Code Embed strony ustaw w Webflow custom attribute `class` = `<slug-strony>` (dla case studies `case-study-<slug>`). Sprawdź, czy nie istnieje już styl o tej nazwie.

### Przed oddaniem
1. Wypisz wszystkie klikalne elementy z ich `data-track`/location/name i zaznacz nieotagowane linki do kontaktu, kalendarza, rejestracji, plików i stron zewnętrznych.
2. Sprawdź, czy nie zostały placeholdery (`#`, `[registration URL]`, `[Thursday, DD Month 2026]`).
3. Nie publikuj strony bez wyraźnej zgody. Zmiany zostają w Designerze do przeglądu.
