# 🪙 GoldQuant AI - Risk Manager Dashboard

**GoldQuant AI** là bảng quản lý rủi ro giao dịch tài khoản vàng (XAUUSD) chuyên nghiệp tích hợp AI. Hệ thống được xây dựng trên nền tảng **Next.js 16 (App Router)** và **Tailwind CSS 4.0**, kết nối **Firebase Firestore** thời gian thực nhằm giúp các nhà giao dịch chuyên nghiệp (Prop Traders, Fund Managers) giám sát, phân tích chỉ số rủi ro gộp và đưa ra gợi ý điều chỉnh quy mô vốn (Capital Scaling) thông minh.

---

## 📸 Hình Ảnh Minh Họa Giao Diện VIP

### 📊 1. Giao Diện Tổng Quan (Risk Dashboard Overview)
Bảng điều khiển gộp hiển thị 6 chỉ số tài chính quan trọng của toàn hệ thống (Tổng vốn, Tổng lợi nhuận, Profit Factor trung bình, Drawdown trung bình, Tổng số lệnh và Điểm số rủi ro AI).
![Risk Dashboard Overview](./src/pic/risk_dashboard_overview_1783782099145.png)

### 📈 2. Giao Diện Chi Tiết Tài Khoản (Account Detail View)
Khi click chọn một tài khoản cụ thể, hệ thống sẽ mở phân hệ phân tích chi tiết với công cụ đánh giá rủi ro AI độc quyền, biểu đồ Recharts trực quan hóa và bảng lịch sử giao dịch dạng kính mờ ảo.
![Account Detail View](./src/pic/account_detail_view_1783782109777.png)

### 🎥 3. Video Trải Nghiệm Tương Tác UI
Minh họa các hiệu ứng Glassmorphism, Neon Glow và các tương tác chuyển trang mượt mà.
![UI VIP Demo](./src/pic/dashboard_upgraded_visual_1783782078001.webp)

---

## ⚡ Các Tính Năng Nổi Bật

- **Dashboard Quản Lý Rủi Ro Gộp (Risk Pooling):** Giám sát trạng thái hoạt động của nhiều tài khoản giao dịch MT5 cùng lúc, tính toán chỉ số sụt giảm tài sản gộp (Drawdown) và tổng lợi nhuận hệ thống quy đổi theo tỷ giá USD/VND thời gian thực.
- **AI Risk Score & Assessment:** Chẩn đoán và cho điểm rủi ro tài khoản (từ 0 - 100) dựa trên 6 yếu tố: tỷ lệ sinh lời (Profitability), tính ổn định (Stability), kiểm soát rủi ro (Risk Control), hiệu quả sử dụng vốn (Capital Eff.), tính nhất quán (Consistency), và khả năng phục hồi (Recovery).
- **Phân Tích Phiên Giao Dịch (Session Analytics):** Trực quan hóa số lệnh, khối lượng (lot volume) và lợi nhuận ròng chia theo 3 phiên giao dịch chính: Á (Asia), Âu (Europe), và Mỹ (US) thông qua biểu đồ cột Recharts.
- **Tải Lên & Tự Động Phân Tích Lịch Sử:** Hỗ trợ kéo thả các tệp xuất báo cáo lịch sử giao dịch từ MetaTrader 5 với các định dạng **CSV, HTML, Excel (.xlsx/.xls)** hoặc **TXT**.
- **Cơ Chế AI Capital Scaling:** Đưa ra khuyến nghị tăng hoặc giảm quy mô vốn tài khoản (ví dụ: tăng 15% quy mô) dựa trên hệ số Sharpe và mức độ kiểm soát drawdown thực tế.
- **Thông Báo Telegram Realtime:** Tự động gửi báo cáo hiệu suất và cảnh báo rủi ro tức thời về kênh Telegram của chủ sở hữu khi có thay đổi số dư hoặc nạp lịch sử mới.

---

## 🛠️ Stack Công Nghệ

- **Framework:** Next.js 16.2.10 (App Router với Turbopack)
- **Runtime & UI Logic:** React 19.2.4 & TypeScript
- **Styling:** Tailwind CSS v4.0 (phong cách Dark Matter & Glassmorphism Premium)
- **State Management:** Zustand 5.0.14
- **Database:** Firebase Firestore (lưu trữ đồng bộ đám mây)
- **Charts:** Recharts 3.9.2 (biểu đồ trực quan tương tác tốt)
- **Icons:** Lucide React 1.24.0

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Cục Bộ

### 1. Yêu cầu hệ thống
- **Node.js** phiên bản 18.x trở lên.
- **npm** hoặc **yarn / pnpm**.

### 2. Cài đặt các gói phụ thuộc (Dependencies)
Clone dự án về máy, di chuyển vào thư mục gốc và chạy lệnh cài đặt:
```bash
npm install
```

### 3. Khởi chạy Development Server
Khởi động dev server với công cụ Turbopack siêu tốc:
```bash
npm run dev
```
Mở trình duyệt truy cập: [http://localhost:3000](http://localhost:3000) để trải nghiệm.

### 4. Biên dịch Production Build
Kiểm tra TypeScript và tối ưu hóa đóng gói mã nguồn để deploy:
```bash
npm run build
```

---

## 📁 Cấu Trúc Dự Án Chính

```text
Dashbboard-Gold/
├── .agents/                  # Thư mục chứa cấu hình và tri thức AI Skills
│   └── skills/               # Các bộ kỹ năng UI/UX Pro Max đã nạp
├── docs/
│   └── images/               # Thư mục lưu trữ hình ảnh/video minh họa README
├── src/
│   ├── app/
│   │   ├── admin/            # Phân hệ quản trị hệ thống
│   │   ├── api/              # Các route API xử lý phía máy chủ (ví dụ gửi Telegram)
│   │   ├── rebate/           # Công cụ tính toán Rebate hoàn phí
│   │   ├── globals.css       # File cấu hình Tailwind 4 & premium animations
│   │   ├── layout.tsx        # Cấu hình Root Layout chính
│   │   └── page.tsx          # Trang chủ Dashboard quản lý rủi ro
│   ├── components/
│   │   ├── AccountCard.tsx   # Thẻ hiển thị tài khoản VIP
│   │   ├── AppLayout.tsx     # Bố cục bọc ngoài tích hợp ambient blobs background
│   │   ├── DetailDashboard.tsx # Phân tích rủi ro AI & biểu đồ phiên giao dịch
│   │   ├── DetailTransactions.tsx # Bảng lịch sử lệnh & phân trang
│   │   ├── FileUpload.tsx    # Khung kéo thả tải file báo cáo MT5
│   │   └── *Modal.tsx        # Các hộp thoại Create/Edit/Update vốn
│   ├── store/
│   │   └── useTradingStore.ts # Quản lý global state bằng Zustand & tích hợp Firebase
│   └── utils/
│       ├── analytics.ts      # Thuật toán tính toán chỉ số Sharpe, PF, ROI, AI Risk
│       ├── currency.ts       # Quy đổi USC/USD và tỷ giá USD/VND thời gian thực
│       └── fileParser.ts     # Bộ phân tích định dạng file báo cáo MT5 (CSV, HTML, Excel)
├── package.json
└── tsconfig.json
```

---

## 📘 Hướng Dẫn Xuất Báo Cáo Lịch Sử Từ MT5

Để hệ thống phân tích lịch sử lệnh chính xác, boss vui lòng xuất file từ phần mềm MetaTrader 5 theo các bước sau:

1. Mở phần mềm **MT5** trên máy tính.
2. Tại khu vực **Toolbox** phía dưới, chọn tab **History**.
3. Nhấp chuột phải vào bất kỳ dòng lệnh nào → Chọn **Report** → Chọn định dạng **HTML** hoặc **Open XML (Excel)**.
4. Kéo thả trực tiếp file vừa xuất vào khung **Upload History** trên giao diện của GoldQuant AI. Hệ thống sẽ tự động nhận diện cấu trúc tệp và cập nhật ngay lập tức.
