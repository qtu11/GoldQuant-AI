# Brand assets — deploy cùng project

## Browser tab (favicon)

Next.js lấy tự động từ `src/app/`:

| File | Tab / thiết bị |
|------|----------------|
| `src/app/favicon.ico` | Favicon tab Chrome/Edge |
| `src/app/icon.png` | Icon app |
| `src/app/apple-icon.png` | iOS home screen |

Bản copy trong `public/`:

| File | URL |
|------|-----|
| `public/favicon.ico` | `/favicon.ico` |
| `public/favicon-16.png` | 16×16 |
| `public/favicon-32.png` | 32×32 |
| `public/icon-192.png` | 192×192 |
| `public/icon-512.png` | 512×512 |
| `public/logo-neon.jpg` | Sidebar |

## Share link preview (Open Graph)

| File | Dùng cho |
|------|----------|
| `public/og-image.jpg` | Ảnh card khi gửi link |
| `public/og-dashboard.png` | Backup |
| `public/site.webmanifest` | Tên app + theme |

## Deploy

1. Copy cả `public/` **và** `src/app/favicon.ico` + `icon.png` + `apple-icon.png`
2. Env: `NEXT_PUBLIC_SITE_URL=https://your-domain.com`
3. Hard refresh: **Ctrl+Shift+R** (Chrome cache favicon rất mạnh)

Kiểm tra: mở `http://localhost:3000/favicon.ico` — phải thấy logo GoldQuant, không phải icon Next mặc định.
