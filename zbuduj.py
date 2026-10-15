# Buduje pliki programu „Edytor PDF” (folder edytor/app/) ze źródła edytor/zrodlo/.
# Użycie: python3 edytor/zbuduj.py [folder_wyjściowy]   (domyślnie edytor/app/)
#
# Źródło: zrodlo/edytor.html (wygląd i szkielet okna) + zrodlo/kod/NN-nazwa.js (kod, po jednej sekcji na plik)
#         + zrodlo/biblioteki/ (pdf-lib, pdf.js, fontkit, JSZip – identyczne z paczkami npm) + zrodlo/czcionki/ (Liberation, licencja OFL).
# Wynik:  app/edytor.html, app/edytor-N.js (kod podzielony na kawałki po ~6 KB po kompresji – tak samo jak w programie
#         „Certyfikaty”: aktualizacja pobiera tylko zmienione pliki), app/lib/, app/czcionki/.
import sys, os, json, re, gzip, glob, shutil
HERE = os.path.dirname(os.path.abspath(__file__)); Z = os.path.join(HERE, 'zrodlo', '')
OUT = (sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'app')).rstrip('/\\') + os.sep
os.makedirs(OUT + 'lib', exist_ok=True); os.makedirs(OUT + 'czcionki', exist_ok=True)
# biblioteki do lib/; pdf.worker opakowany w „window.__PDFW = …” (strona tworzy z niego worker przez blob:)
for f in ['pdf-lib.min.js', 'pdf.min.js', 'fontkit.umd.min.js', 'jszip.min.js']:
    shutil.copyfile(Z + 'biblioteki/' + f, OUT + 'lib/' + f)
# qpdf (WASM) – do odszyfrowywania plików z hasłem właściciela; w przeglądarce fabryka modułu nazywa się „Module” – dajemy jej własną nazwę
open(OUT + 'lib/qpdf.js', 'w').write(open(Z + 'biblioteki/qpdf.js').read() + '\nwindow.createQpdf = Module;\n')
shutil.copyfile(Z + 'biblioteki/qpdf.wasm', OUT + 'lib/qpdf.wasm')
open(OUT + 'lib/pdf.worker.js', 'w').write('window.__PDFW = ' + json.dumps(open(Z + 'biblioteki/pdf.worker.min.js').read()) + ';\n')
# system projektowy (tokens.css, bundle.css, bundle.js, czcionki IBM Plex) do design/
os.makedirs(OUT + 'design/fonts', exist_ok=True)
for f in ['tokens.css', 'bundle.css', 'bundle.js']: shutil.copyfile(Z + 'design/' + f, OUT + 'design/' + f)
for f in os.listdir(Z + 'design/fonts'):
    if f.endswith('.woff2'): shutil.copyfile(Z + 'design/fonts/' + f, OUT + 'design/fonts/' + f)
# czcionki Liberation (do wstawiania nowego tekstu – mają polskie znaki, metrycznie zgodne z Arial/Times/Courier)
for f in sorted(os.listdir(Z + 'czcionki')):
    if f.endswith('.ttf'): shutil.copyfile(Z + 'czcionki/' + f, OUT + 'czcionki/' + f)
# kod: wszystkie pliki zrodlo/kod/*.js po kolei, każdy to jedna sekcja „/* ============ NAZWA ============ */”
code = ''
for f in sorted(glob.glob(Z + 'kod/*.js')):
    name = os.path.basename(f)[3:-3].upper()
    code += f'/* ============ {name} ============ */\n' + open(f, encoding='utf-8').read().rstrip() + '\n\n'
# usuń stare kawałki edytor-N.js i podziel kod na nowe (nowy kawałek, gdy po kompresji przekroczyłby ok. 6 KB)
for old in glob.glob(OUT + 'edytor-*.js'): os.remove(old)
secs = re.split(r'(?m)^(?=/\* ============ )', code); parts = ['']
for sec in secs:
    if parts[-1] and len(gzip.compress((parts[-1] + sec).encode(), 9)) > 6000: parts.append('')
    parts[-1] += sec
for k, pc in enumerate(parts, 1): open(OUT + f'edytor-{k}.js', 'w', encoding='utf-8').write(pc)
# edytor.html: biblioteki jako odnośniki do lib/, kod jako odnośniki do edytor-N.js
s = open(Z + 'edytor.html', encoding='utf-8').read()
rep = {'<script id="s-pdflib">/*PDFLIB*/</script>': '<script src="lib/pdf-lib.min.js"></script>',
       '<script id="s-fontkit">/*FONTKIT*/</script>': '<script src="lib/fontkit.umd.min.js"></script>',
       '<script id="s-pdfjs">/*PDFJS*/</script>': '<script src="lib/pdf.min.js"></script>',
       '<script id="s-worker">/*WORKER*/</script>': '<script src="lib/pdf.worker.js"></script>',
       '<script id="s-jszip">/*JSZIP*/</script>': '<script src="lib/jszip.min.js"></script><script src="lib/qpdf.js"></script>',
       '<script id="s-kod">/*KOD*/</script>': ''.join(f'<script src="edytor-{k}.js"></script>' for k in range(1, len(parts) + 1)),
       '<body>': '<body><script src="desktop-shim.js"></script>'}
for a, b in rep.items(): assert s.count(a) == 1, a; s = s.replace(a, b)
open(OUT + 'edytor.html', 'w', encoding='utf-8').write(s)
print('edytor.html', len(s) // 1024, 'KB +', len(parts), 'pliki edytor-N.js', [len(gzip.compress(x.encode(), 9)) for x in parts])
