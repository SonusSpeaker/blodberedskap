#!/usr/bin/env python3
"""Static website server for Blodberedskap Norge.

The browser reads statistics from the bundled dataset; no external statistics API is used.
Optional local HTTPS is enabled by supplying both TLS_CERT_FILE and TLS_KEY_FILE.
"""

from __future__ import annotations

import os
import ssl
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT
DATA = ROOT / "data"


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_dotenv(ROOT / ".env")
HOST = os.getenv("HOST", "127.0.0.1").strip()
PORT = int(os.getenv("PORT", "8000"))
TLS_CERT_FILE = os.getenv("TLS_CERT_FILE", "").strip()
TLS_KEY_FILE = os.getenv("TLS_KEY_FILE", "").strip()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)

    def translate_path(self, path: str) -> str:
        """Serve the single data file statically from /data, other files from /public."""
        parsed = urllib.parse.urlsplit(path).path
        if parsed.startswith("/data/"):
            relative = Path(urllib.parse.unquote(parsed[len("/data/") :]))
            candidate = (DATA / relative).resolve()
            try:
                candidate.relative_to(DATA.resolve())
            except ValueError:
                return str(DATA / "__not_found__")
            return str(candidate)
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))


def create_server() -> ThreadingHTTPServer:
    if bool(TLS_CERT_FILE) != bool(TLS_KEY_FILE):
        raise SystemExit("HTTPS krever både TLS_CERT_FILE og TLS_KEY_FILE i .env.")

    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    scheme = "http"
    if TLS_CERT_FILE and TLS_KEY_FILE:
        cert_path = (
            (ROOT / TLS_CERT_FILE).resolve()
            if not Path(TLS_CERT_FILE).is_absolute()
            else Path(TLS_CERT_FILE)
        )
        key_path = (
            (ROOT / TLS_KEY_FILE).resolve()
            if not Path(TLS_KEY_FILE).is_absolute()
            else Path(TLS_KEY_FILE)
        )
        if not cert_path.is_file() or not key_path.is_file():
            httpd.server_close()
            raise SystemExit(
                "Fant ikke TLS-sertifikat eller privatnøkkel. Kontroller TLS_CERT_FILE og TLS_KEY_FILE.\n"
                f"Sertifikat: {cert_path}\n"
                f"Privatnøkkel: {key_path}"
            )
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.load_cert_chain(certfile=str(cert_path), keyfile=str(key_path))
        httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
        scheme = "https"

    print(f"Blodberedskap Norge kjører på {scheme}://{HOST}:{PORT}")
    return httpd


if __name__ == "__main__":
    create_server().serve_forever()
