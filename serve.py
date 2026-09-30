# -*- coding: utf-8 -*-
"""本地开发/使用服务器（Windows 上双击 py 文件也可以用）

为什么要用它：PWA 的"安装到桌面 + 离线可用"需要 http(s) 环境，而且 Service Worker
要求 .js 必须是 JavaScript 的 MIME 类型。Windows 注册表常把 .js 关联成 text/plain，
用 `python -m http.server` 会导致 Service Worker 注册失败，所以这里显式指定类型。

用法：
    python serve.py                # 只在本机可访问：http://127.0.0.1:8765
    python serve.py --port 9000
    python serve.py --lan          # 允许同一 WiFi 下的手机访问（会打印局域网地址）
    python serve.py --no-browser   # 不自动打开浏览器

注意：手机通过局域网 IP（http://192.168.x.x:8765）访问时属于非安全上下文，
Chrome 不会安装 PWA，但页面功能完全可用；要"装到手机桌面"需要 https 托管。
"""
import argparse
import http.server
import os
import socket
import socketserver
import sys
import threading
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))

EXTRA_TYPES = {
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=HERE, **kwargs)

    def guess_type(self, path):
        ext = os.path.splitext(str(path))[1].lower()
        if ext in EXTRA_TYPES:
            return EXTRA_TYPES[ext]
        return super().guess_type(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Service-Worker-Allowed", "/")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s\n" % (fmt % args))


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser(description="健康日记本地服务器")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--host", default=None, help="默认 127.0.0.1；--lan 等价于 0.0.0.0")
    ap.add_argument("--lan", action="store_true", help="允许局域网访问（手机可打开）")
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()

    host = args.host or ("0.0.0.0" if args.lan else "127.0.0.1")
    with Server((host, args.port), Handler) as httpd:
        url = "http://127.0.0.1:%d/index.html" % args.port
        print("健康日记已启动：")
        print("  本机：%s" % url)
        if args.lan:
            ip = lan_ip()
            if ip:
                print("  手机（同一 WiFi）：http://%s:%d/index.html" % (ip, args.port))
        print("  Ctrl+C 停止")
        if not args.no_browser:
            threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n已停止")


if __name__ == "__main__":
    main()
