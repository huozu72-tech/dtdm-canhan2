# Bài cá nhân 2 – Triển khai ứng dụng web Nhà Hàng AI (FastAPI + PostgreSQL + Nginx + UFW)

- **Sinh viên:** Võ Đại Minh Trí — **MSSV:** `2324802010383`
- **VPS triển khai:** `vps-2324802010383` (Ubuntu Server 24.04 LTS, IP tĩnh `192.168.100.10/24`)
- **Đề tài:** Ứng dụng web **Nhà Hàng Việt / Đặt Món AI** — quản lý thực đơn món ăn, đăng ký/đăng nhập khách hàng & quản trị viên (băm mật khẩu `bcrypt`), đặt món và quản lý đơn hàng (CRUD đầy đủ).

## 1. Kiến trúc triển khai

- **Frontend:** Jinja2 + HTML/CSS/JS gọi REST API (`/api/menu`, `/api/orders`, `/api/admin/menu`, `/api/admin/orders`).
- **Backend:** Python 3.12 + **FastAPI + Uvicorn**, chạy như dịch vụ `systemd` (`dathang-ai.service`), **chỉ lắng nghe nội bộ `127.0.0.1:8000`**.
- **Cơ sở dữ liệu:** **PostgreSQL 16** chạy trên VPS, **chỉ lắng nghe `127.0.0.1:5432`**, dùng tài khoản riêng `dathang_user` (không dùng `postgres` superuser).
- **Reverse Proxy:** **Nginx** lắng nghe cổng `80` và chuyển tiếp về `http://127.0.0.1:8000`.
- **Tường lửa `ufw`:** Mặc định chặn toàn bộ kết nối vào (`deny incoming`), chỉ mở cổng `22/tcp` từ mạng ảo `192.168.100.0/24` và cổng `80/tcp`.
- **Bảo mật bí mật:** Mật khẩu CSDL và `APP_SECRET_KEY` nằm trong tệp `.env` (được loại trừ trong `.gitignore`), chỉ đưa `.env.example` lên GitHub. Mật khẩu người dùng lưu dưới dạng băm **bcrypt** (`$2b$12$...`).

## 2. Hướng dẫn cài đặt từ đầu trên Ubuntu Server 24.04 LTS

### Bước 1: Cài đặt gói hệ thống
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-venv python3-pip git nginx postgresql postgresql-contrib ufw
```

### Bước 2: Tạo CSDL và người dùng riêng trong PostgreSQL
```bash
sudo -u postgres psql <<'EOF'
CREATE DATABASE dathang_db;
CREATE USER dathang_user WITH ENCRYPTED PASSWORD 'THAY_BANG_MAT_KHAU_MANH';
ALTER ROLE dathang_user SET client_encoding TO 'utf8';
ALTER ROLE dathang_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE dathang_user SET timezone TO 'Asia/Ho_Chi_Minh';
GRANT ALL PRIVILEGES ON DATABASE dathang_db TO dathang_user;
\c dathang_db
GRANT ALL ON SCHEMA public TO dathang_user;
EOF
```

### Bước 3: Tải mã nguồn và cấu hình môi trường `.env`
```bash
sudo mkdir -p /opt/dathang-ai
sudo chown $USER:$USER /opt/dathang-ai
git clone https://github.com/huozu72-tech/dtdm-canhan2.git /opt/dathang-ai
cd /opt/dathang-ai
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
nano .env
chmod 600 .env
```

### Bước 4: Cấu hình dịch vụ `systemd` (tự khởi động cùng VPS, chỉ nghe `127.0.0.1:8000`)
```bash
sudo cp deploy/dathang-ai.service /etc/systemd/system/dathang-ai.service
sudo systemctl daemon-reload
sudo systemctl enable --now dathang-ai
sudo systemctl status dathang-ai
```

### Bước 5: Cấu hình Nginx Reverse Proxy cổng `80`
```bash
sudo cp deploy/nginx-dathang-ai.conf /etc/nginx/sites-available/dathang-ai
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/dathang-ai /etc/nginx/sites-enabled/dathang-ai
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

### Bước 6: Bật tường lửa `ufw`
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.100.0/24 to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw enable
sudo ufw status verbose
```

### Bước 7: Kiểm tra nghiệm thu
```bash
sudo ufw status verbose
sudo ss -tlnp
sudo systemctl status dathang-ai nginx postgresql --no-pager
```

Truy cập từ trình duyệt trên laptop:
- Trang người dùng (đăng ký, đăng nhập, xem thực đơn, đặt món): `http://192.168.100.10`
- Trang quản trị (đăng nhập, CRUD món ăn, quản lý đơn hàng): `http://192.168.100.10/Admin/Admin/Login`
