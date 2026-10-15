# Edytor PDF

Edytor plików PDF w stylu Acrobata: **edycja istniejącego tekstu**, nowy tekst, obrazy, podpis, kształty, rysunek,
zakreślenia i komentarze (prawdziwe adnotacje PDF), wymazywanie i zaczernianie, strony, formularze, numeracja stron,
znak wodny, nagłówek i stopka, PDF z obrazów, drukowanie. Działa w przeglądarce i jako program dla Windows (Electron).
Wszystko dzieje się lokalnie – pliki nigdzie nie są wysyłane.

- **Program dla Windows (instalator, automatyczne aktualizacje):** https://aktualizacje.gmarczak.xyz/edytor/
- **Wersja w przeglądarce:** zbuduj (`python3 zbuduj.py`) i otwórz `app/edytor.html` z dowolnego serwera plików
  (`npm run serve` → http://localhost:8765/edytor.html). Bez okien systemowych: otwieranie przez wybór pliku, zapis przez pobranie.

## Jak działa edycja istniejącego tekstu

1. pdf.js daje listę napisów strony (czcionka, kody znaków, rozmiar, macierz położenia, kolor) – własny przebieg po liście
   operacji z `getOperatorList()` (`zrodlo/kod/03-tekst-analiza.js`).
2. Surowy strumień treści strony (pdf-lib) jest dzielony na operacje własnym tokenizerem; i-ta operacja `Tj/TJ/'/"` odpowiada
   i-temu napisowi pdf.js, a zgodność bajtów napisu z kodami znaków jest sprawdzana – tak wiemy, *gdzie w pliku* jest każdy napis.
3. Napisy na jednej linii bazowej (także w różnych czcionkach) tworzą wiersz do edycji. Po zmianie:
   - **A)** jeśli oryginalna czcionka ma potrzebne znaki (kody znane z dokumentu, WinAnsi, cmap czcionki) – napis jest podmieniany
     w strumieniu tą samą czcionką w tym samym miejscu;
   - **B)** w innym razie stary napis jest usuwany ze strumienia, a nowy rysowany czcionką Liberation dobraną do oryginału
     (Sans/Serif/Mono, pogrubienie, kursywa, rozmiar, kolor);
   - **C)** gdy napisu nie da się znaleźć w strumieniu (osadzony obiekt), jest zakrywany kolorem tła i rysowany na nowo.
   Niezmienione fragmenty wiersza zostają nietknięte; gdy nowy tekst nie mieści się przed sąsiednim fragmentem, cały wiersz
   jest rysowany od nowa z zachowaniem odstępów. Przeciągnięcie ramki wiersza przesuwa go (`Td` w strumieniu, ta sama czcionka).
4. Zaczernianie usuwa z pliku znaki leżące pod ramką – także fragment napisu (reszta zostaje na miejscu dzięki `TJ`).

Nowe obiekty (tekst, obrazy, kształty, adnotacje, pola) leżą na stronie jako warstwa i trafiają do pliku przy zapisie (pdf-lib).
Pliki z hasłem właściciela są odszyfrowywane przez qpdf (WASM); przy haśle otwarcia program pyta o hasło.

## Pliki

| Ścieżka | Co to jest |
|---|---|
| `zrodlo/edytor.html` | Wygląd (CSS) i szkielet okna. |
| `zrodlo/kod/NN-nazwa.js` | Kod po sekcjach: podstawy, widok, analiza tekstu, edycja tekstu, obiekty, wtapianie, strony, formularze, plik, interfejs. |
| `zrodlo/biblioteki/` | pdf-lib 1.17.1, pdf.js 3.11.174, fontkit 1.1.1, JSZip 3.10.1, qpdf-wasm 0.3.0 – identyczne z paczkami npm. |
| `zrodlo/czcionki/` | Liberation Sans/Serif/Mono (SIL OFL 1.1) – do nowego tekstu, mają polskie znaki. |
| `app/` | Zbudowany program: `edytor.html` + `edytor-N.js` + `lib/` + `czcionki/` oraz część Electrona (`main.js`, `core.js`, `preload.js`, `desktop-shim.js`). |
| `zbuduj.py` | Buduje `app/` ze `zrodlo/`. |
| `instalator/` | Instalator PowerShell dla Windows (pobiera Electron z GitHuba i program z serwera aktualizacji). |
| `testy/test_programu.js` | Test w oknie Electrona (Playwright): `npm install && xvfb-run -a npm test`. |

```bash
python3 zbuduj.py      # buduje app/
npm install            # Electron + Playwright
npm start              # uruchamia program (npx electron app plik.pdf)
```

## Licencje

Kod edytora: MIT. Biblioteki: pdf-lib (MIT), pdf.js (Apache 2.0), fontkit (MIT), JSZip (MIT), qpdf (Apache 2.0),
czcionki Liberation (SIL Open Font License 1.1). Ikony SVG własne.
