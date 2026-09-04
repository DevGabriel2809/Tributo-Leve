from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from urllib.request import urlopen

server = ThreadingHTTPServer(('127.0.0.1', 0), SimpleHTTPRequestHandler)
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()
try:
    port = server.server_address[1]
    with urlopen(f'http://127.0.0.1:{port}/index.html', timeout=5) as response:
        body = response.read().decode('utf-8')
        assert response.status == 200
        assert '<title>Tributo Leve' in body
        assert 'id="root"' in body
        assert '/src/main.tsx' in body
    with urlopen(f'http://127.0.0.1:{port}/data.json', timeout=5) as response:
        assert response.status == 200 and len(response.read()) > 100_000
    print('OK: site served successfully over HTTP')
finally:
    server.shutdown()
    server.server_close()
