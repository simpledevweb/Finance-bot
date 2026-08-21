import http.server
import socketserver
import os
import json
import webbrowser

PORT = 1000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(DIRECTORY, 'database.json')
MAX_DB_BYTES = 5 * 1024 * 1024

def validate_database(payload):
    if not isinstance(payload, dict):
        raise ValueError('Database payload must be a JSON object')
    for key in ('accounts', 'transactions'):
        if key in payload and not isinstance(payload[key], list):
            raise ValueError(f"'{key}' must be an array")
    if 'settings' in payload and not isinstance(payload['settings'], dict):
        raise ValueError("'settings' must be an object")

def write_database(payload):
    temp_file = DB_FILE + '.tmp'
    with open(temp_file, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(temp_file, DB_FILE)

class FinanceRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/db':
            if os.path.exists(DB_FILE):
                try:
                    with open(DB_FILE, 'r', encoding='utf-8') as f:
                        data = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(data.encode('utf-8'))
                    return
                except Exception as e:
                    print("Error reading database.json:", e)
            self.send_response(404)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Not found'}).encode('utf-8'))
            return
        
        return super().do_GET()

    def do_POST(self):
        if self.path == '/api/db':
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length <= 0 or content_length > MAX_DB_BYTES:
                self.send_response(413)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Payload size is invalid'}).encode('utf-8'))
                return
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                parsed = json.loads(body)
                validate_database(parsed)
                write_database(parsed)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'message': 'database.json yangilandi'}).encode('utf-8'))
                print("💾 database.json yangilandi (real-time save).")
            except Exception as e:
                print("Error writing database.json:", e)
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

if __name__ == '__main__':
    os.chdir(DIRECTORY)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), FinanceRequestHandler) as httpd:
        print("=======================================================")
        print("🚀 Finance Web Dashboard Serveri Ishga Tushdi!")
        print(f"📍 Manzil: http://localhost:{PORT}")
        print(f"💾 Baza fayli: {DB_FILE}")
        print("=======================================================")
        webbrowser.open(f"http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer to'xtatildi.")
