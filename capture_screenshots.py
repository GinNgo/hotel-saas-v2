import base64
import json
import os
import shutil
import sys
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

DIST_DIR = Path(r"C:\Dev\hotel-saas-v2\frontend\dist\frontend\browser")
ARTIFACTS_DIR = Path(r"C:\Users\ngovo\.gemini\antigravity\brain\b24752d6-e881-4372-b79e-186db67e5233\screenshots")
DESKTOP_DIR = Path(r"C:\Users\ngovo\OneDrive\Máy tính\HOTEL_SAAS_TEAM_HANDOFF\06_HINH_ANH_GIAO_DIEN")

PORT = 4280

class SPAHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST_DIR), **kwargs)

    def do_GET(self):
        url_path = self.path.split('?')[0]
        file_path = DIST_DIR / url_path.lstrip('/')
        if not file_path.exists() and not url_path.startswith('/api'):
            self.path = '/index.html'
        try:
            return super().do_GET()
        except (ConnectionAbortedError, BrokenPipeError, ConnectionResetError):
            pass

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (ConnectionAbortedError, BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, format, *args):
        pass

def start_server():
    httpd = HTTPServer(('127.0.0.1', PORT), SPAHandler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    return httpd

def create_mock_jwt():
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "email": "tuanan.hotelpms@luxestay.vn",
        "fullName": "Ngô Võ Tuấn An",
        "globalRole": "SuperAdmin",
        "tenantId": "t1-1111-2222-3333-444444444444",
        "propertyId": "p1-1111-2222-3333-444444444444",
        "roleName": "Chủ khách sạn (SuperAdmin)",
        "permissions": json.dumps([
            "ROOMS:15",
            "ROOM_TYPES:15",
            "HOUSEKEEPING:15",
            "PROPERTIES:15",
            "RESERVATIONS:15",
            "PAYMENTS:15"
        ]),
        "exp": 1893456000
    }
    h_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip('=')
    p_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('=')
    return f"{h_b64}.{p_b64}.signature_mock_token"

def run_automation():
    print(f"[1/4] Starting local SPA Server on http://127.0.0.1:{PORT}...")
    server = start_server()
    time.sleep(1)

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    DESKTOP_DIR.mkdir(parents=True, exist_ok=True)

    token = create_mock_jwt()
    memberships = [
        {
            "propertyId": "p1-1111-2222-3333-444444444444",
            "propertyName": "LuxeStay Da Nang Riverside Hotel",
            "propertyCode": "DN-01",
            "roleName": "Chủ khách sạn (SuperAdmin)"
        }
    ]

    routes = [
        # Guest / Public
        {"name": "01_guest_booking_home", "path": "/booking", "auth": False, "desc": "Cổng Đặt phòng Trực tuyến OTA (Booking Portal)"},
        {"name": "02_guest_ai_concierge_chat", "path": "/booking", "auth": False, "action": "open_ai_chat", "desc": "Trợ lý ảo AI Concierge 24/7 & Semantic Search"},
        {"name": "03_guest_booking_hold", "path": "/booking/hold/sample-hold-token-dn01", "auth": False, "desc": "Màn hình Tạm giữ phòng 15 Phút"},
        {"name": "04_guest_lookup", "path": "/booking/lookup", "auth": False, "desc": "Tra cứu Đặt phòng Khách hàng"},
        {"name": "05_partner_register", "path": "/partner-register", "auth": False, "desc": "Đăng ký Mở Khách sạn / Đối tác"},
        {"name": "06_auth_login", "path": "/login", "auth": False, "desc": "Màn hình Đăng nhập Quản trị viên"},
        {"name": "07_auth_register", "path": "/register", "auth": False, "desc": "Màn hình Đăng ký Khách lẻ"},
        # Admin / PMS
        {"name": "08_admin_dashboard", "path": "/dashboard", "auth": True, "desc": "Bảng điều khiển Vận hành & Room Readiness Bar"},
        {"name": "09_admin_subscriptions_quota", "path": "/subscriptions", "auth": True, "desc": "Quản lý Gói cước SaaS & Hạn ngạch Quota"},
        {"name": "10_admin_pms_reports", "path": "/reports", "auth": True, "desc": "Báo cáo Doanh thu & Chỉ số PMS (ADR, RevPAR, Occupancy)"},
        {"name": "11_admin_payments_cashier", "path": "/payments", "auth": True, "desc": "Thu ngân & Nhật ký Giao dịch Folio"},
        {"name": "12_admin_property_policies", "path": "/policies", "auth": True, "desc": "Chính sách Chi nhánh & Buffer Dọn phòng"},
        {"name": "13_admin_room_rates", "path": "/rates", "auth": True, "desc": "Bảng giá phòng & Lịch sử Biến động giá"},
        {"name": "14_system_forbidden_403", "path": "/forbidden", "auth": True, "desc": "Trang 403 Forbidden phân quyền bảo mật"}
    ]

    print("[2/4] Launching Playwright Headless Browser...")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            headless=True
        )
        context = browser.new_context(
            viewport={"width": 1440, "height": 1024},
            device_scale_factor=1.5
        )
        page = context.new_page()

        print("[3/4] Capturing UI screenshots across all 14 screens...")
        captured_list = []

        for item in routes:
            url = f"http://127.0.0.1:{PORT}{item['path']}"
            print(f"  -> Testing: {item['desc']} ({item['path']})...")

            page.goto(f"http://127.0.0.1:{PORT}/login", wait_until="domcontentloaded")

            if item['auth']:
                # Set localStorage before page loads
                page.evaluate(f"""() => {{
                    localStorage.setItem('hotel_saas_access_token', '{token}');
                    localStorage.setItem('hotel_saas_refresh_token', 'mock_refresh_token');
                    localStorage.setItem('hotel_saas_active_property_id', 'p1-1111-2222-3333-444444444444');
                    localStorage.setItem('hotel_saas_active_property_name', 'LuxeStay Da Nang Riverside Hotel');
                    localStorage.setItem('hotel_saas_active_property_code', 'DN-01');
                    localStorage.setItem('hotel_saas_memberships', JSON.stringify({json.dumps(memberships)}));
                }}""")
            else:
                page.evaluate("""() => {
                    localStorage.clear();
                }""")

            page.goto(url, wait_until="domcontentloaded")
            time.sleep(1.8)  # Let signals, charts, and animations settle

            if item.get("action") == "open_ai_chat":
                try:
                    ai_btn = page.locator("button[aria-label='Mở trợ lý ảo AI Concierge']")
                    if ai_btn.is_visible():
                        ai_btn.click()
                        time.sleep(1.2)
                except Exception as ex:
                    print(f"     Note: Could not click AI button: {ex}")

            img_name = f"{item['name']}.png"
            artifact_path = ARTIFACTS_DIR / img_name
            desktop_path = DESKTOP_DIR / img_name

            page.screenshot(path=str(artifact_path), full_page=False)
            shutil.copy2(artifact_path, desktop_path)

            file_size_kb = round(os.path.getsize(artifact_path) / 1024, 1)
            print(f"     [OK] Saved {img_name} ({file_size_kb} KB)")
            captured_list.append({"name": item['name'], "file": img_name, "desc": item['desc'], "size_kb": file_size_kb})

        browser.close()

    print(f"\n[4/4] Hoàn tất chụp {len(captured_list)}/14 màn hình thành công 100%!")
    print(f"Artifacts: {ARTIFACTS_DIR}")
    print(f"Desktop:   {DESKTOP_DIR}")
    return captured_list

if __name__ == "__main__":
    run_automation()
