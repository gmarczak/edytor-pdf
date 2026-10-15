Edytor PDF służy do poprawiania gotowych dokumentów: zmiany wiersza tekstu, zakreślenia, podpisu, zaczernienia danych. Ten system opisuje wygląd aplikacji napisanej w HTML i CSS — zmienne z `tokens.json`, klasy `ep-…` w `components/bundle.css` i zestaw ikon w `components/bundle.js`. Aplikacja ma dwa tryby — **jasny (Papier)** i **ciemny (Grafit)** — przełączane przyciskiem w pasku aplikacji albo automatycznie według ustawień systemu. Ten sam kod działa w obu trybach i w trzech układach ekranu (Klasyczny, Karty, Skupienie) — porównanie w sekcji „Trzy układy do wyboru”.

## Zasady

- **Dokument jest najważniejszy.** Interfejs stoi w neutralnych `surface`, strona leży na `canvas` jako `paper` z cieniem `shadow-page`. Nic poza stroną nie dostaje cienia, chyba że pływa nad obszarem roboczym.
- **Jeden akcent na ekran.** `accent` wypełnia wyłącznie przycisk „Zapisz” (`ep-btn--primary`). Aktywne narzędzie i aktywna karta używają spokojniejszej pary `accent-soft` + `accent-ink`.
- **Linie zamiast cieni.** Panele, grupy narzędzi i pasek stanu oddziela `line` (1px). Cień `shadow-pop` mają tylko paski pływające i podpowiedzi.
- **Stan widać bez koloru.** Aktywne narzędzie ma wypełnione tło, aktywna karta — podkreślenie, wybrana miniatura — obwódkę i plakietkę z numerem, stan zapisu — słowo. Kolor tylko to wzmacnia.
- **Narzędzie = ikona + podpis.** Same ikony tylko w układzie Skupienie, zawsze z `aria-label` i podpowiedzią (`ep-tooltip`) zawierającą skrót.

## Teksty interfejsu

- Po polsku, w formie „ty”. Podpowiedzi w trybie rozkazującym: „Najedź kursorem na wiersz tekstu.”, „Kliknij, aby go zmienić.”
- Nazwy narzędzi to krótkie czasowniki lub rzeczowniki, jak dotąd: „Zaznacz”, „Zakreśl”, „Podkreśl”, „Zaczernij”, „Podpis”, „Łącze”. Jedno–dwa słowa.
- Wielka litera tylko na początku: „Edytuj tekst”, nie „EDYTUJ TEKST”. Wersaliki wyłącznie w stylu `overline` (małe etykiety sekcji, przez `text-transform`).
- Bez wykrzykników i emoji. Wielokropek jako jeden znak „…”: „Szukaj w dokumencie…”.
- Klawisze zawsze w `ep-kbd`: „Enter zapisuje, Esc anuluje.” Skrót podawaj w podpowiedzi narzędzia, nie w podpisie.
- Liczby w stylu `numeric` (cyfry o stałej szerokości): „2 / 12”, „100%”, „12 pt”.
- Stan zapisu słowem: „Zapisano” albo „Niezapisane zmiany”. Ostrzeżenia mówią, co się stanie: „Zaczernienie jest nieodwracalne po zapisaniu pliku.”

## Kolor

| Tryb | `data-theme` | Charakter |
|---|---|---|
| Jasny — Papier (domyślny) | `papier` | ciepłe jasne szarości, ciemnozielony akcent, biała strona |
| Ciemny — Grafit | `grafit` | grafitowe panele, miętowy akcent, strona lekko przygaszona, żeby nie oślepiała |

Oba tryby mają te same nazwy tokenów — w CSS nigdy nie sprawdzaj, który tryb jest włączony, tylko używaj tokenów. Wyjątek to ikona przełącznika (księżyc w jasnym, słońce w ciemnym), którą przełącza `bundle.css`.

- Tekst: `ink` na `surface`, `surface-raised`, `surface-sunken`, `surface-hover` i `canvas`. Etykiety narzędzi, opisy, numery stron: `ink-muted` na tych samych tłach. `ink-disabled` tylko dla wyłączonych kontrolek.
- Pasek aplikacji: tło `chrome`, tekst `on-chrome`, drugorzędny tekst `on-chrome-muted`, menu pod kursorem `chrome-hover`, dolna krawędź `chrome-line`. W Papier pasek zlewa się z paskiem narzędzi w jeden nagłówek.
- Akcja główna: `accent` z tekstem `on-accent` (w Grafit ciemnym — nigdy nie wpisuj białego na sztywno).
- Aktywne narzędzie, aktywna szyna, aktywna karta: `accent-soft` + `accent-ink`.
- Wybrana miniatura i wybrana próbka koloru: obwódka `selected`, numer `on-selected` na `selected`.
- Fokus klawiatury: `outline: 2px solid var(--focus); outline-offset: 2px`. Kolor `focus` ma min. 3:1 na każdym tle w obu trybach, także na `chrome`.
- Wiersz tekstu w trybie Edytuj tekst: pod kursorem `edit-fill` + obrys 1px `edit-line`, w edycji obrys 2px `edit-line` i kursor w tym samym kolorze.
- Akcje nieodwracalne (Zaczernij, usuwanie): ikona i tekst `danger`, tło ostrzeżenia `danger-soft`, zawsze ze słowem. Niezapisane zmiany: kropka `warning` + słowo.
- Kolory adnotacji `annot-yellow`, `annot-green`, `annot-blue`, `annot-pink` (zakreślacz) i `annot-red` (linie) są takie same w obu trybach — leżą na papierze, nie na interfejsie.
- Każda para tekst/tło z opisów tokenów ma co najmniej 4.5:1 w obu trybach; obramowania kontrolek (`line-strong`), fokus i obwódka wyboru — co najmniej 3:1.

## Tryb jasny i ciemny

- Przełącznik w pasku aplikacji (`ep-themetoggle`) stoi między wyszukiwaniem a Cofnij/Ponów. Pokazuje tryb, na który przełączy: księżyc w jasnym, słońce w ciemnym; `aria-pressed="true"` oznacza tryb ciemny.
- W menu Widok → Wygląd jest pełny wybór: **Jasny / Ciemny / Jak w systemie** (`ep-thememode`). Domyślnie „Jak w systemie”.
- Wybór zapisuje się w `localStorage` (klucz `ep-theme`); „Jak w systemie” go usuwa i dalej śledzi zmianę ustawień Windows / macOS.
- Strona PDF w trybie ciemnym zostaje jasna (`paper` lekko przygaszony) — dokument ma wyglądać jak wydruk. Adnotacje mają te same kolory w obu trybach.
- Zmiana trybu wysyła zdarzenie `ep:theme` (`detail.theme`, `detail.mode`), jeśli coś poza CSS musi zareagować, np. podgląd renderowany w canvas.

## Typografia

Interfejs: **IBM Plex Sans** 400/500/600. Liczby: **IBM Plex Mono** 400/500. Pliki są w `fonts/` (licencja SIL OFL 1.1, `fonts/OFL.txt`) i mają pełne polskie znaki. Przykładowa treść strony w podglądach używa rodziny `doc` (Liberation Sans) — prawdziwą stronę rysuje silnik PDF.

| Styl | Gdzie |
|---|---|
| `app-title` 15/20 600 | nazwa aplikacji, tylko w pasku aplikacji |
| `panel-title` 14/20 600 | nagłówek panelu właściwości |
| `body` 13/20 400 | domyślny tekst interfejsu |
| `menu` 13/20 500 | menu, karty, nazwa pliku |
| `button` 13/20 600 | przyciski |
| `small` 12/18 400 | pasek stanu, uwagi, podpowiedzi |
| `tool-label` 11/14 500 | podpis pod ikoną narzędzia |
| `overline` 11/16 600, +0.06em | etykiety sekcji w panelu (wersaliki przez CSS) |
| `numeric` / `code` 12/16 Mono | numer strony, powiększenie, rozmiar, wersja, klawisze |

Nie schodź poniżej 11px. 11px tylko dla `tool-label` i `overline`.

## Odstępy, wymiary, kształty

- Siatka 4px: `space-1` (4) … `space-10` (40). Odstęp ikona–tekst `space-2`, padding paneli `space-4`, odstęp sekcji w panelu `space-6`, margines strony `space-8`.
- Kontrolki mają wysokość `control-h` (32px), w pływających paskach i nawigacji stron `control-h-sm` (28px). Ikony `icon-size` (18px), w małych kontrolkach 16px.
- Układ: `appbar-h` 44, `toolbar-h` 60, `statusbar-h` 28, panel stron `sidebar-w` 232, panel właściwości `inspector-w` 272, szyna `rail-w` 48.
- Promienie: `radius-sm` (6) przyciski, pola, narzędzia; `radius-md` (10) uwagi i menu; `radius-lg` (14) pływające paski; `radius-pill` plakietki i pasek stron; `radius-xs` (4) klawisze. Strona PDF ma ostre rogi.
- Cienie: `shadow-page` strona, `shadow-pop` elementy pływające, `shadow-raise` wybrany segment przełącznika i miniatury.

## Stany

| Stan | Jak wygląda | Atrybut |
|---|---|---|
| pod kursorem | tło `surface-hover` (na pasku aplikacji `chrome-hover`) | `:hover` |
| aktywne narzędzie / przełącznik | tło `accent-soft`, ikona i podpis `accent-ink` | `aria-pressed="true"` |
| wybrana karta | tekst `ink` 600 + podkreślenie 2px `accent-ink` (`accent` na `chrome`) | `aria-selected="true"` |
| bieżąca strona | obwódka 2px `selected`, numer na plakietce | `aria-current="page"` |
| fokus | obwódka 2px `focus`, odstęp 2px | `:focus-visible` |
| wyłączone | tekst i ikona `ink-disabled`, bez tła | `disabled` |
| niebezpieczne | ikona/tekst `danger` | `.ep-tool--danger`, `.ep-btn--danger` |

Przejścia kolorów 120 ms. Migający kursor w edycji wyłącza się przy `prefers-reduced-motion`.

## Ikony

Zestaw: **Lucide 0.460.0** (licencja ISC), linia 1.75px, zaokrąglone końce, rozmiar `icon-size`. `components/bundle.js` wstawia je do strony jako sprite; użycie: `<svg class="ep-icon" aria-hidden="true"><use href="#i-select"/></svg>`. Pojedyncze pliki są w grupie zasobów „Ikony” (rysowane `currentColor` — kolor bierzesz z CSS, a w `<img>` są czarne).

Ikony aplikacji nie zostały dostarczone, więc Lucide to zamiennik w tym samym stylu co obecne (cienka linia, zaokrąglenia). Jeśli masz własny zestaw, podmień symbole w sprite'cie, zachowując identyfikatory `i-…`. „Zaczernij” to jedyna ikona wypełniona (prostokąt w `danger`).

## Wdrożenie w aplikacji

```html
<html lang="pl" data-theme="papier">
<head>
  <!-- ustaw tryb przed narysowaniem strony, żeby nie mignęła jasna wersja -->
  <script>try{var m=localStorage.getItem('ep-theme');document.documentElement.dataset.theme=
    m||(matchMedia('(prefers-color-scheme: dark)').matches?'grafit':'papier')}catch(e){}</script>
  <link rel="stylesheet" href="tokens.css">            <!-- zmienne z tokens.json -->
  <link rel="stylesheet" href="components/bundle.css"> <!-- klasy ep-… -->
  <script src="components/bundle.js" defer></script>   <!-- ikony, tryby, proste przełączanie -->
</head>
<body>
  …
  <script>
    addEventListener('DOMContentLoaded', function () {
      EdytorPDF.initTheme();      // zapisany wybór albo ustawienie systemu + śledzenie zmian
      EdytorPDF.wire(document);   // przełącznik trybu, narzędzia, karty, miniatury
    });
  </script>
</body>
```

- Tryb ustawiasz w kodzie: `EdytorPDF.setTheme('grafit')` (ciemny), `'papier'` (jasny), `'auto'` (jak w systemie); `EdytorPDF.toggleTheme()` przełącza jasny ↔ ciemny.
- Stany ustawiaj atrybutami ARIA (`aria-pressed`, `aria-selected`, `aria-current`, `aria-checked`, `hidden`) — CSS reaguje na nie bez dodatkowych klas.
- `EdytorPDF.wire(document)` podpina przełącznik trybu oraz przełączanie narzędzi, kart, miniatur i próbek. Jeśli aplikacja ma już własną logikę, nie wywołuj go — wystarczy ustawiać atrybuty.
- Każdy komponent ma w opisie gotowy fragment HTML; trzy pełne ekrany i porównanie obu trybów są w grupie „Układy”.
