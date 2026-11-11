# Quản lý Vũ khí - Trang bị bằng mã QR (bản demo)

Bản demo dựng lại từ `React Artifact.html` gồm **frontend Next.js** và **backend Node.js (Express) + SQLite**.

> Dữ liệu mẫu phục vụ huấn luyện quản lý — không dùng cho nghiệp vụ thật.

## Cấu trúc

```
army/
├── backend/            Express + better-sqlite3 (cổng 4000)
│   ├── src/server.js   khởi động API
│   ├── src/db.js       schema SQLite (weapons, maintenance, loans)
│   ├── src/routes/     weapons, maintenance, loans, stats/alerts
│   ├── src/seed*.js    dữ liệu mẫu (36 vũ khí)
│   └── data/army.db    file DB (tự tạo)
└── frontend/           Next.js 15 + Tailwind 4 (cổng 3000)
    └── src/app/        / (tổng quan), /weapons, /scan, /maintenance, /loans, /alerts
```

Frontend gọi `/api/*`, Next.js chuyển tiếp sang backend (`API_URL`, mặc định `http://localhost:4000`).

## Chạy

Yêu cầu Node.js ≥ 20.

```bash
npm install            # cài concurrently ở thư mục gốc
npm run install:all    # cài backend + frontend
npm run seed           # nạp dữ liệu mẫu (hoặc bấm "Nạp dữ liệu mẫu" trên giao diện)
npm run dev            # chạy cả BE (4000) và FE (3000)
```

Mở http://localhost:3000 và đăng nhập. Lần chạy đầu tiên (DB chưa có tài khoản), backend tự tạo **admin / admin123**. Bạn cần **đổi mật khẩu ngay** (bấm biểu tượng chìa khoá trên thanh trên cùng), hoặc đặt `ADMIN_USERNAME` / `ADMIN_PASSWORD` trong `backend/.env` trước lần chạy đầu tiên.

Nạp lại dữ liệu mẫu từ đầu: `npm --prefix backend run seed:reset`.

Xoá sạch toàn bộ dữ liệu (giữ cấu trúc bảng, reset id về 1): `npm run db:clear` (hỏi xác nhận) hoặc `npm run db:clear -- --yes`. Cả `db:clear` và `seed:reset` đều **tự sao lưu trước** khi xoá.

Cấu hình: `backend/.env` (`PORT`, `DB_PATH`, `CORS_ORIGIN`, `UPLOAD_DIR`, `BACKUP_DIR`, `BACKUP_INTERVAL_HOURS`, `BACKUP_KEEP` — xem `backend/.env.example`), `frontend/.env.local` (`API_URL`).

## Sao lưu & khôi phục

- Mỗi bản sao lưu là 1 thư mục `backend/backups/<ngày_giờ>_<loại>/` gồm `army.db` + `uploads/` (ảnh).
- **Tự động:** server kiểm tra mỗi giờ, nếu bản gần nhất cũ hơn `BACKUP_INTERVAL_HOURS` (mặc định 24) thì sao lưu. `0` = tắt. Giữ `BACKUP_KEEP` bản mới nhất (mặc định 30), bản cũ hơn tự xoá.
- **Thủ công:** admin bấm **Sao lưu ngay** ở trang **Sao lưu** (`/admin/backups`), hoặc chạy `npm --prefix backend run backup` (chạy được cả khi server đang chạy).
- **Khôi phục:** dừng server (Ctrl+C), rồi trong `backend/`:
  - `npm run restore` → liệt kê các bản sao lưu
  - `npm run restore -- 2026-11-11_003954_auto` → khôi phục (hỏi xác nhận). Dữ liệu hiện tại được sao lưu thành bản `before-restore` trước khi bị thay.
- Sao lưu nằm cùng ổ đĩa với dữ liệu → nên chép định kỳ thư mục `backend/backups/` sang USB / ổ khác.

## Đăng nhập & phân quyền

- **Không có trang tự đăng ký.** Chỉ admin tạo tài khoản ở trang **Tài khoản** (`/admin/users`), và có thể đổi vai trò, khoá/mở khoá, đặt lại mật khẩu hoặc xoá tài khoản.
- **Phiên hiệu đơn vị** (vd "Trung đội 2 — Đại đội 7") đặt riêng cho từng tài khoản và hiện trên đầu trang khi tài khoản đó đăng nhập. Admin đặt khi tạo / sửa ở `/admin/users` (bấm vào dòng phiên hiệu dưới tên); mỗi người cũng tự sửa được ở **Tài khoản của tôi** (`/account`). Để trống = tiêu đề mặc định. Mọi thay đổi đều ghi nhật ký.
- **Admin:** thêm / sửa / thanh lý vũ khí, đổi tình trạng, đổi ảnh, quản lý **Loại trang bị** (`/admin/types`) và tài khoản, xem **Nhật ký** (`/admin/audit`), **Sao lưu** (`/admin/backups`), nạp dữ liệu mẫu.
- **User:** xem tất cả, quét QR, ghi bảo dưỡng, ghi mượn — trả, in tem.
- Khoá tài khoản, đổi vai trò hoặc đặt lại mật khẩu → người đó bị đăng xuất khỏi mọi thiết bị. Admin không tự hạ quyền hay tự khoá được, và hệ thống luôn giữ ít nhất 1 admin đang hoạt động.
- Mật khẩu được băm bằng scrypt. Phiên đăng nhập lưu trong bảng `sessions` (cookie `sid` httpOnly, mặc định 7 ngày, đổi bằng `SESSION_DAYS`). Sai mật khẩu 10 lần trong 15 phút thì bị chặn tạm thời.
- Danh mục loại vũ khí nằm trong bảng `weapon_types`; `DEFAULT_WEAPON_TYPES` trong `constants.js` chỉ dùng để khởi tạo lần đầu. Đổi tên một loại thì các vũ khí thuộc loại đó đổi theo. Chỉ xoá được loại khi không còn vũ khí nào thuộc loại đó.
- `db:clear` và `seed:reset` chỉ xoá dữ liệu vũ khí, bảo dưỡng và mượn trả; **giữ nguyên tài khoản và danh mục loại**.

## Nghiệp vụ

- Bảo dưỡng tiếp theo = ngày bảo dưỡng + 30 ngày; còn 0–7 ngày → *sắp đến hạn*; < 0 → *quá hạn*.
- Phiếu bảo dưỡng kết quả **Đạt** → tình trạng vũ khí về **Tốt** (trừ khi đang mượn).
- Mượn: chỉ cho vũ khí **Tốt** và chưa quá hạn bảo dưỡng; vũ khí chuyển **Đang mượn**.
- Trả: ghi giờ trả (≥ giờ mượn), ghi chú tình trạng, và chọn **tình trạng vũ khí sau khi nhận lại** (Tốt / Đang bảo dưỡng / Hỏng — mặc định Tốt).
- Tình trạng **Đang mượn** chỉ do phiếu mượn — trả quyết định: không tự đặt tay được, và khi đang mượn thì không đổi tay sang tình trạng khác (ghi trả trước).
- **Sửa thông tin** (admin): nút **Sửa** ở danh sách vũ khí hoặc **Sửa thông tin** ở thẻ chi tiết — sửa tên, loại, số hiệu, đơn vị, người chịu trách nhiệm, mã QR, ngày bảo dưỡng gần nhất (đổi ngày này thì hạn tiếp theo tính lại). Đổi các thông tin in trên tem → nhớ in lại tem.
- **Thanh lý / ngừng sử dụng** (admin, ở thẻ chi tiết): bắt buộc nhập lý do. Vũ khí ẩn khỏi danh sách, thống kê và cảnh báo nhưng **giữ nguyên lịch sử**; không ghi bảo dưỡng / mượn hay sửa được. Xem lại bằng bộ lọc **Đã thanh lý** ở trang danh sách; bấm **Khôi phục sử dụng** để đưa trở lại.
- **Xoá hẳn** chỉ hiện với vũ khí chưa có phiếu bảo dưỡng / mượn nào (dùng khi nhập nhầm). Vũ khí đã có lịch sử thì chỉ thanh lý được.
- **Nhật ký thao tác** (bảng `audit_log`, admin xem ở `/admin/audit`): mọi thao tác thêm / sửa / đổi tình trạng / thanh lý / xoá / ảnh, ghi bảo dưỡng, mượn — trả, loại trang bị, tài khoản, đăng nhập, đổi mật khẩu, sao lưu — kèm thời gian và tài khoản thực hiện. Phiếu bảo dưỡng / mượn / trả cũng lưu tài khoản đã ghi (hiện "Ghi bởi").
- Tem QR chứa thông tin dạng chữ (mã, tên, số hiệu, loại, đơn vị, người quản lý) → camera điện thoại thường quét cũng đọc được, không cần mạng. Đổi đơn vị / người quản lý thì phải in lại tem.
- Ảnh minh hoạ: chọn khi thêm vũ khí hoặc bấm vào ảnh (dưới mã QR) ở trang chi tiết để đổi. Ảnh được thu nhỏ ở trình duyệt (≤1280px, JPEG) rồi lưu file tại `backend/data/uploads/` (đổi bằng `UPLOAD_DIR`); DB chỉ lưu tên file. `db:clear` và `seed:reset` xoá luôn ảnh.
- Vũ khí có ảnh → tem QR thêm dòng `Ảnh: <địa chỉ>/api/weapons/QRCB-xxx/photo` (link cố định, đổi ảnh không cần in lại tem). Mở link này cần đăng nhập: điện thoại chưa đăng nhập sẽ được chuyển sang trang đăng nhập, rồi tự quay lại ảnh. Địa chỉ lấy theo `NEXT_PUBLIC_SITE_URL` trong `frontend/.env.local`; để trống thì dùng địa chỉ đang mở app.
- Quét QR: nhập mã `QRCB-xxx` hoặc số hiệu `VN-xxx`; camera dùng BarcodeDetector nếu trình duyệt hỗ trợ (Chrome/Edge, cần `localhost` hoặc HTTPS).

## API chính

| Method | Đường dẫn | Mô tả |
|---|---|---|
| POST | `/api/auth/login`, `/api/auth/logout` | Đăng nhập / đăng xuất |
| GET | `/api/auth/me` | Người đang đăng nhập |
| POST | `/api/auth/password` | Tự đổi mật khẩu |
| GET/POST, PUT/DELETE `:id` | `/api/users` | Quản lý tài khoản (admin) |
| GET/POST, PUT/DELETE `:id` | `/api/weapon-types` | Danh mục loại (xem: mọi người; sửa: admin) |
| GET | `/api/stats`, `/api/alerts` | Thống kê, cảnh báo |
| GET/POST | `/api/weapons` | Danh sách (`?q&unit&status&retired=0\|1\|all`, mặc định chỉ vũ khí đang dùng) / thêm mới |
| GET/PUT/DELETE | `/api/weapons/:id\|code\|serial` | Chi tiết kèm lịch sử (`deletable`) / sửa / xoá hẳn (chỉ khi chưa có lịch sử) |
| POST | `/api/weapons/:id/retire`, `/api/weapons/:id/restore` | Thanh lý (`{reason}`) / khôi phục (admin) |
| GET/POST | `/api/maintenance` | Sổ bảo dưỡng |
| GET/POST | `/api/loans` | Sổ mượn — bàn giao |
| POST | `/api/loans/:id/return` | Ghi trả (`{returnAt, returnStatus, weaponStatus}`) |
| GET | `/api/audit` | Nhật ký (`?q&action&before&limit`, admin) |
| GET/POST | `/api/backups` | Danh sách bản sao lưu / sao lưu ngay (admin) |
| POST | `/api/seed` | Nạp dữ liệu mẫu khi DB trống (admin) |

Mọi API (trừ `/api/health` và `/api/auth/login`) đều cần đăng nhập. Thêm / sửa / xoá vũ khí và ảnh chỉ dành cho admin.
