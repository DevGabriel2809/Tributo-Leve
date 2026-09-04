from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from urllib.request import urlopen
from urllib.parse import urljoin
import re

ROOT = Path(__file__).resolve().parent
DIST = ROOT / 'dist'

if not (DIST / 'index.html').is_file():
    raise SystemExit('ERRO: dist/index.html nao existe. Execute npm run build antes do smoke HTTP.')

handler = partial(SimpleHTTPRequestHandler, directory=str(DIST))
server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()

routes = {
    '/': 'Tributo Leve',
    '/sobre/': 'Sobre o Tributo Leve',
    '/planos/': 'Planos do simulador tributário',
    '/contadores/': 'Tributo Leve para contadores',
    '/simulador-reforma-tributaria/': 'Simulador da Reforma Tributária 2027–2033',
    '/reforma-tributaria/': 'Reforma Tributária: IBS, CBS e transição',
    '/faq/': 'Perguntas frequentes sobre o Tributo Leve',
    '/privacidade/': 'Política de Privacidade',
    '/lgpd/': 'LGPD e proteção de dados',
    '/termos/': 'Termos de Uso',
    '/seguranca/': 'Segurança e divulgação responsável',
    '/simulador/': 'Simulador da Reforma Tributária 2027–2033',
}

try:
    port = server.server_address[1]
    base = f'http://127.0.0.1:{port}'

    homepage = None
    for route, expected_title in routes.items():
        with urlopen(base + route, timeout=5) as response:
            body = response.read().decode('utf-8')
            assert response.status == 200, f'{route}: HTTP {response.status}'
            assert '<div id="root"></div>' in body or 'id="root"' in body, f'{route}: root ausente'
            assert '/src/main.tsx' not in body, f'{route}: HTML de desenvolvimento vazou para dist'
            assert expected_title in body, f'{route}: titulo esperado ausente'
            if route == '/':
                homepage = body

    for route, marker in [('/robots.txt', 'Sitemap:'), ('/sitemap.xml', '<urlset')]:
        with urlopen(base + route, timeout=5) as response:
            body = response.read().decode('utf-8')
            assert response.status == 200 and marker in body, f'{route}: conteudo invalido'

    assert homepage is not None
    assets = set(re.findall(r'(?:src|href)=["\'](/assets/[^"\']+\.(?:js|css))["\']', homepage))
    assert assets, 'Nenhum asset JS/CSS versionado encontrado no HTML de producao'
    for asset in sorted(assets):
        with urlopen(base + asset, timeout=5) as response:
            payload = response.read()
            assert response.status == 200 and len(payload) > 100, f'{asset}: asset ausente ou vazio'

    print(f'OK: dist servido via HTTP — {len(routes)} rotas, robots/sitemap e {len(assets)} assets validados.')
finally:
    server.shutdown()
    server.server_close()
