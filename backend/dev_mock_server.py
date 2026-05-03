"""
Local development mock server.

Purpose:
- Let us test the read-only backend without EC2 or Nginx.
- Simulate a vulnerable HTTP target.
- Return wildcard CORS.
- Omit common security headers on purpose.

This file is only for local development testing.
It does not modify any system.
"""

from http.server import BaseHTTPRequestHandler, HTTPServer


HOST = "127.0.0.1"
PORT = 8088


class VulnerableDemoHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        """
        Return a simple vulnerable HTTP response.

        Intentionally missing:
        - Content-Security-Policy
        - X-Frame-Options
        - X-Content-Type-Options
        - Referrer-Policy

        Intentionally vulnerable:
        - Access-Control-Allow-Origin: *
        """

        body = b"""
        <!doctype html>
        <html>
        <head>
            <title>Local Mock Vulnerable Target</title>
        </head>
        <body>
            <h1>Local Mock Vulnerable Target</h1>
            <p>This mock server intentionally has weak security headers.</p>
        </body>
        </html>
        """

        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        """
        Keep the local server output clean.
        """
        return


def main() -> None:
    server = HTTPServer((HOST, PORT), VulnerableDemoHandler)

    print("Local mock vulnerable server running")
    print(f"URL: http://{HOST}:{PORT}")
    print()
    print("Press Ctrl+C to stop.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping local mock server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()