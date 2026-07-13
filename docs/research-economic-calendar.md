# Nghiên cứu: Lịch sự kiện kinh tế (Forex Factory + MT5)

Ngày: 2026-07-12 · GoldQuant AI

## 1. Forex Factory Calendar

**URL UI:** https://www.forexfactory.com/calendar

### Export công khai (ổn định nhất cho web app)

Forex Factory cung cấp **Weekly Export** (không cần login):

| Format | URL |
|--------|-----|
| JSON | `https://nfs.faireconomy.media/ff_calendar_thisweek.json` |
| CSV | `https://nfs.faireconomy.media/ff_calendar_thisweek.csv` |
| XML | `https://nfs.faireconomy.media/ff_calendar_thisweek.xml` |
| ICS | `https://nfs.faireconomy.media/ff_calendar_thisweek.ics` |

**Schema JSON (thực tế):**
```json
{
  "title": "CPI m/m",
  "country": "USD",
  "date": "2026-07-15T08:30:00-04:00",
  "impact": "High",
  "forecast": "0.2%",
  "previous": "0.1%"
}
```

**Hạn chế:**
- Chỉ **tuần hiện tại** (this week), không full history.
- Field `actual` thường **không có** trên weekly JSON (phải xem HTML calendar sau khi release).
- Trang HTML `forexfactory.com/calendar` hay **403** nếu scrape bot; JSON trên `nfs.faireconomy.media` hoạt động tốt (HTTP 200, probe 2026-07-12).
- Timezone feed: thường America/New_York (−04:00/−05:00). GoldQuant convert sang `Asia/Ho_Chi_Minh` khi hiển thị.

### Không khuyến nghị
- Scrape HTML FF trực tiếp (Cloudflare/403, dễ gãy layout).
- Selenium full-page (nặng, chậm cho Next.js serverless).

---

## 2. MetaTrader 5 Economic Calendar

**Trong terminal:** View → Toolbox → **Calendar** (hoặc chart event marks).

**MQL5 API (chỉ chạy trong EA/Indicator trên MT5):**
- Docs: https://www.mql5.com/en/docs/calendar
- Web: https://www.mql5.com/en/economic-calendar

| Hàm | Mục đích |
|-----|----------|
| `CalendarValueHistory` | Load event theo khoảng thời gian |
| `CalendarValueLast` | Realtime delta (change_id) |
| `CalendarEventById` | Metadata sự kiện |
| `CalendarCountries` | Danh sách quốc gia |

**Cấu trúc chính `MqlCalendarValue`:** time, actual, forecast, previous, revised, event_id.

### Vì sao web app không gọi MT5 Calendar trực tiếp?
- API chỉ có trong **process MT5** (MQL5), không có HTTP public từ MetaQuotes cho app web.
- Để đưa vào GoldQuant cần **cầu nối**:

```
MT5 EA  →  WebRequest POST  →  /api/quant/calendar/ingest  →  Firestore
         (mỗi 1–5 phút hoặc on CalendarValueLast)
```

**Allowlist WebRequest trong MT5:** Tools → Options → Expert Advisors → Allow WebRequest for:
- `https://your-domain.com`

---

## 3. Kiến trúc GoldQuant (đã implement)

```
nfs.faireconomy.media/ff_calendar_thisweek.json
        │
        ▼
src/utils/economicCalendar.ts   (parse, filter XAU/USD High, cache 5m)
        │
        ├── GET /api/quant/calendar
        ├── UI NewsCalendar component
        └── inject → AI Advisor system prompt
```

**Filter “★XAU relevant”:**
- USD High/Medium impact
- Keywords: CPI, NFP, FOMC, GDP, PPI, Retail Sales, PCE, ISM, Powell…

---

## 4. Roadmap tiếp

| Phase | Việc |
|-------|------|
| ✅ Now | FF weekly JSON + UI + AI inject |
| P1 | Telegram alert 15–30 phút trước High Impact USD |
| P2 | EA MQL5 push MT5 Calendar → webhook GoldQuant (actual realtime) |
| P3 | Lưu history actual/forecast vào Firestore để backtest tin |

---

## 5. Pháp lý / ToS

- FF export là **công cụ trader**; không spam request (cache 5 phút đủ).
- Attribution: hiển thị “Forex Factory” + link calendar trên UI.
- Không redistributed raw dump thương mại lớn nếu ToS cấm.

---

## 6. Endpoint nội bộ

```
GET /api/quant/calendar?gold=1&upcoming=1&limit=30
GET /api/quant/calendar?currency=USD&impact=High
GET /api/quant/calendar?force=1
```
