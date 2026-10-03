"""
Ottimizza il primo caricamento della SPA senza uno step di build.

Il server risponde in HTTP/1.1, quindi il browser apre al massimo 6 connessioni
e ogni file in più costa un round trip: ~75 fogli di stile dietro catene di
@import e ~125 moduli JS erano il costo principale di una prima visita.

- css_bundle(): unisce i fogli di stile risolvendo gli @import nello stesso
  ordine del browser, così la cascata resta identica.
- module_preloads(): elenca i moduli importati staticamente da index.js, da
  dichiarare come <link rel="modulepreload"> per scaricarli tutti in parallelo
  invece di scoprirli import dopo import.

I risultati restano in memoria e vengono ricalcolati quando cambia uno dei file
da cui dipendono.
"""
import hashlib
import os
import posixpath
import re

COMMENT_RE = re.compile(r'/\*.*?\*/', re.S)
IMPORT_RE = re.compile(r'''@import\s+(?:url\(\s*)?['"]([^'"]+)['"]\s*\)?\s*;''')
CSS_URL_RE = re.compile(r'''url\(\s*(['"]?)([^'")]+)\1\s*\)''')
# Import statici: "import x from '...'", "import '...'", "export ... from '...'".
# Gli import() dinamici sono esclusi di proposito: si caricano solo quando servono.
JS_IMPORT_RE = re.compile(r'''^\s*(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]''', re.M)
JS_LINE_COMMENT_RE = re.compile(r'^\s*//.*$', re.M)


class AssetBundler:
    def __init__(self, root):
        self.root = root
        self._cache = {}

    def _path(self, url_path):
        return os.path.join(self.root, *url_path.lstrip('/').split('/'))

    def _mtimes(self, url_paths):
        mtimes = {}
        for url_path in url_paths:
            try:
                mtimes[url_path] = os.path.getmtime(self._path(url_path))
            except OSError:
                mtimes[url_path] = None
        return mtimes

    def _cached(self, key, build):
        """build() -> (valore, file letti); ricalcolato se uno dei file cambia."""
        entry = self._cache.get(key)
        if entry and self._mtimes(entry[1]) == entry[1]:
            return entry[0]
        value, files = build()
        self._cache[key] = (value, self._mtimes(files))
        return value

    # --- CSS ---------------------------------------------------------------

    def css_bundle(self, entries):
        """
        Unisce i fogli di stile `entries` (url assoluti, es. '/assets/css/main.css').
        Restituisce (css, etag).
        """
        def build():
            files = set()
            parts = [self._inline_css(url_path, files, ()) for url_path in entries]
            css = '\n'.join(parts)
            etag = hashlib.sha1(css.encode('utf-8')).hexdigest()[:16]
            return (css, etag), files
        return self._cached(('css',) + tuple(entries), build)

    def _inline_css(self, url_path, files, stack):
        if url_path in stack:  # import circolare: il browser lo ignora
            return ''
        files.add(url_path)
        try:
            with open(self._path(url_path), encoding='utf-8') as f:
                text = f.read()
        except OSError:
            return f'/* missing stylesheet: {url_path} */'

        base = posixpath.dirname(url_path)
        # Il browser considera solo gli @import che precedono ogni altra regola:
        # quelli più avanti sono ignorati e qui restano nel testo, dove sono
        # ignorati allo stesso modo.
        out, pos = [], 0
        while True:
            lead = re.match(r'(?:\s+|/\*.*?\*/)*', text[pos:], re.S)
            pos += lead.end()
            match = IMPORT_RE.match(text, pos)
            if not match:
                break
            target = posixpath.normpath(posixpath.join(base, match.group(1)))
            out.append(self._inline_css(target, files, stack + (url_path,)))
            pos = match.end()

        body = CSS_URL_RE.sub(lambda m: self._absolute_css_url(m, base), text[pos:])
        out.append(f'/* {url_path} */\n{body}{self._close_like_eof(url_path, body)}')
        return '\n'.join(out)

    @staticmethod
    def _close_like_eof(url_path, body):
        """
        In un file a sé il browser chiude a fine file i blocchi rimasti aperti;
        concatenato, un errore di graffe si mangerebbe i file successivi.
        Qui si riproduce la fine del file.
        """
        scan = re.sub(r'"(?:\\.|[^"\\\n])*"|\'(?:\\.|[^\'\\\n])*\'', '""', body)
        if scan.count('/*') > scan.count('*/'):
            return '*/'
        scan = COMMENT_RE.sub('', scan)
        depth = 0
        for ch in scan:
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
        if depth > 0:
            print(f'[asset_bundler] {url_path}: {depth} unclosed "{{", closed as at end of file')
            return '\n' + '}' * depth
        if depth < 0:
            # Una "}" in più finisce nel selettore della regola seguente e la
            # invalida: questa regola vuota la assorbe al posto del file dopo
            print(f'[asset_bundler] {url_path}: stray "}}" contained before the next file')
            return '\n.asset-bundler-boundary {}'
        return ''

    @staticmethod
    def _absolute_css_url(match, base):
        # Gli url() relativi puntano alla cartella del file originale, non al bundle
        quote, url = match.group(1), match.group(2).strip()
        if re.match(r'^(?:[a-z][a-z0-9+.-]*:|/|#)', url, re.I):
            return match.group(0)
        return f'url({quote}{posixpath.normpath(posixpath.join(base, url))}{quote})'

    # --- JS ----------------------------------------------------------------

    def module_preloads(self, entry):
        """Url dei moduli raggiunti da `entry` con import statici (entry inclusa)."""
        def build():
            seen, order, stack = set(), [], [entry]
            while stack:
                url_path = stack.pop()
                if url_path in seen:
                    continue
                seen.add(url_path)
                order.append(url_path)
                stack.extend(reversed(self._js_imports(url_path)))
            return order, seen
        return self._cached(('js', entry), build)

    def _js_imports(self, url_path):
        try:
            with open(self._path(url_path), encoding='utf-8') as f:
                src = f.read()
        except OSError:
            return []
        src = JS_LINE_COMMENT_RE.sub('', COMMENT_RE.sub('', src))
        base = posixpath.dirname(url_path)
        imports = []
        for spec in JS_IMPORT_RE.findall(src):
            if spec.startswith('/'):
                imports.append(posixpath.normpath(spec))
            elif spec.startswith('.'):
                imports.append(posixpath.normpath(posixpath.join(base, spec)))
            # gli import da CDN o bare specifier non si precaricano
        return imports
