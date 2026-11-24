import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from urllib.parse import quote, unquote

from fastapi import FastAPI, Request, Depends, Form, UploadFile, File, Body
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.config import DEFAULT_ADMIN_NAME, DEFAULT_ADMIN_PHONE, DEFAULT_ADMIN_PASSWORD
from app.database import Base, engine, get_db, SessionLocal
from app.models import MenuItem, Customer, AdminAccount, Order, OrderItem, SEED_MENU_ITEMS
from app.security import hash_password, verify_password

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"
TEMPLATES_DIR = APP_DIR / "templates"

app = FastAPI(title="Nhà Hàng AI - Đặt Món & Quản Lý Thực Đơn (MSSV 2324802010383)")

app.mount("/css", StaticFiles(directory=STATIC_DIR / "css"), name="css")
app.mount("/js", StaticFiles(directory=STATIC_DIR / "js"), name="js")
app.mount("/images", StaticFiles(directory=STATIC_DIR / "images"), name="images")

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(MenuItem).count() == 0:
            for m in SEED_MENU_ITEMS:
                db.add(MenuItem(**m))
            db.commit()
        if db.query(AdminAccount).count() == 0:
            db.add(
                AdminAccount(
                    ho_ten=DEFAULT_ADMIN_NAME,
                    so_dien_thoai=DEFAULT_ADMIN_PHONE,
                    mat_khau_hash=hash_password(DEFAULT_ADMIN_PASSWORD),
                )
            )
            db.commit()
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    init_db()


def read_cookie(request: Request, name: str) -> Optional[str]:
    val = request.cookies.get(name)
    return unquote(val) if val else None


def set_cookie_utf8(response, key: str, value: str):
    response.set_cookie(key=key, value=quote(str(value)), httponly=False, samesite="lax")


def get_current_customer(request: Request, db: Session) -> Optional[Customer]:
    uid = read_cookie(request, "UserId")
    if uid and uid.isdigit():
        c = db.query(Customer).filter(Customer.id == int(uid)).first()
        if c:
            return c
    uname = read_cookie(request, "UserName")
    if uname:
        return db.query(Customer).filter(Customer.ho_ten == uname).first()
    return None


def get_current_admin(request: Request, db: Session) -> Optional[AdminAccount]:
    aid = read_cookie(request, "AdminId")
    if aid and aid.isdigit():
        a = db.query(AdminAccount).filter(AdminAccount.id == int(aid)).first()
        if a:
            return a
    aname = read_cookie(request, "AdminUserName")
    if aname:
        return db.query(AdminAccount).filter(AdminAccount.ho_ten == aname).first()
    return None


def save_upload_image(upload: UploadFile, subfolder: str, prefix: str = "") -> str:
    dest_dir = STATIC_DIR / "images" / subfolder
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(upload.filename or "image.png").name
    unique_name = f"{prefix}{uuid.uuid4().hex}_{safe_name}"
    dest_path = dest_dir / unique_name
    with open(dest_path, "wb") as f:
        f.write(upload.file.read())
    return f"/images/{subfolder}/{unique_name}"


# ==================== CUSTOMER PAGES ====================

@app.get("/", response_class=HTMLResponse)
def root():
    return RedirectResponse("/Home/Index", status_code=302)


@app.get("/Home/Index", response_class=HTMLResponse)
def home_index(request: Request):
    return templates.TemplateResponse(
        "home/index.html",
        {
            "request": request,
            "user_name": read_cookie(request, "UserName"),
            "admin_name": read_cookie(request, "AdminUserName"),
            "has_customer_id": bool(read_cookie(request, "UserId")),
        },
    )


@app.get("/Home/Login", response_class=HTMLResponse)
def home_login_get(request: Request):
    return templates.TemplateResponse("home/login.html", {"request": request, "error": None})


@app.post("/Home/Login", response_class=HTMLResponse)
def home_login_post(
    request: Request,
    email: str = Form(""),
    mat_khau: str = Form(""),
    db: Session = Depends(get_db),
):
    identifier = email.strip()
    if not identifier or not mat_khau:
        return templates.TemplateResponse(
            "home/login.html",
            {"request": request, "error": "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu."},
        )

    user = (
        db.query(Customer)
        .filter(or_(Customer.so_dien_thoai == identifier, Customer.ho_ten == identifier))
        .first()
    )
    if user and verify_password(mat_khau, user.mat_khau_hash):
        resp = RedirectResponse("/Home/Index", status_code=303)
        set_cookie_utf8(resp, "UserName", user.ho_ten)
        set_cookie_utf8(resp, "UserId", str(user.id))
        return resp

    return templates.TemplateResponse(
        "home/login.html",
        {"request": request, "error": "Tên đăng nhập hoặc mật khẩu không chính xác."},
    )


@app.get("/Home/Logout")
def home_logout():
    resp = RedirectResponse("/Home/Login", status_code=302)
    resp.delete_cookie("UserName")
    resp.delete_cookie("UserId")
    return resp


@app.get("/Home/TaoTaiKhoan", response_class=HTMLResponse)
def home_register_get(request: Request):
    return templates.TemplateResponse("home/register.html", {"request": request, "error": None})


@app.post("/Home/TaoTaiKhoan", response_class=HTMLResponse)
def home_register_post(
    request: Request,
    ho_ten: str = Form(""),
    sdt: str = Form(""),
    mat_khau: str = Form(""),
    db: Session = Depends(get_db),
):
    name = ho_ten.strip()
    phone = sdt.strip()
    if not name or not phone or not mat_khau:
        return templates.TemplateResponse(
            "home/register.html",
            {"request": request, "error": "Vui lòng điền đầy đủ thông tin."},
        )

    if db.query(Customer).filter(Customer.so_dien_thoai == phone).first():
        return templates.TemplateResponse(
            "home/register.html",
            {"request": request, "error": "Số điện thoại này đã được đăng ký."},
        )

    db.add(
        Customer(
            ho_ten=name,
            so_dien_thoai=phone,
            mat_khau_hash=hash_password(mat_khau),
        )
    )
    db.commit()
    return RedirectResponse("/Home/Login", status_code=303)


@app.get("/Home/Profile", response_class=HTMLResponse)
def home_profile_get(request: Request, db: Session = Depends(get_db)):
    user = get_current_customer(request, db)
    if not user:
        return RedirectResponse("/Home/Login", status_code=302)
    return templates.TemplateResponse(
        "home/profile.html",
        {"request": request, "user": user, "error": None, "success": None},
    )


@app.post("/Home/Profile", response_class=HTMLResponse)
def home_profile_post(
    request: Request,
    HoTen: str = Form(""),
    SoDienThoai: str = Form(""),
    DiaChi: str = Form(""),
    MatKhau: str = Form(""),
    Avatar: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    user = get_current_customer(request, db)
    if not user:
        return RedirectResponse("/Home/Login", status_code=302)

    name = HoTen.strip()
    phone = SoDienThoai.strip()
    if not name or not phone:
        return templates.TemplateResponse(
            "home/profile.html",
            {"request": request, "user": user, "error": "Họ tên và số điện thoại không được để trống.", "success": None},
        )

    dup = db.query(Customer).filter(Customer.so_dien_thoai == phone, Customer.id != user.id).first()
    if dup:
        return templates.TemplateResponse(
            "home/profile.html",
            {"request": request, "user": user, "error": "Số điện thoại này đã được sử dụng bởi tài khoản khác.", "success": None},
        )

    user.ho_ten = name
    user.so_dien_thoai = phone
    user.dia_chi = DiaChi.strip()
    if MatKhau:
        user.mat_khau_hash = hash_password(MatKhau)
    if Avatar and Avatar.filename:
        user.avatar_url = save_upload_image(Avatar, "avatars")

    db.commit()
    db.refresh(user)
    resp = templates.TemplateResponse(
        "home/profile.html",
        {"request": request, "user": user, "error": None, "success": "Cập nhật thông tin thành công!"},
    )
    set_cookie_utf8(resp, "UserName", user.ho_ten)
    set_cookie_utf8(resp, "UserId", str(user.id))
    return resp


# ==================== ADMIN PAGES ====================

@app.get("/Admin")
@app.get("/Admin/Admin/Index", response_class=HTMLResponse)
def admin_index(request: Request):
    admin_name = read_cookie(request, "AdminUserName")
    if not admin_name:
        return RedirectResponse("/Admin/Admin/Login", status_code=302)
    return templates.TemplateResponse(
        "admin/index.html",
        {"request": request, "title": "Thống Kê", "active_page": "Index", "admin_name": admin_name},
    )


@app.get("/Admin/Admin/Menu", response_class=HTMLResponse)
def admin_menu(request: Request):
    admin_name = read_cookie(request, "AdminUserName")
    if not admin_name:
        return RedirectResponse("/Admin/Admin/Login", status_code=302)
    return templates.TemplateResponse(
        "admin/menu.html",
        {"request": request, "title": "Quản Lý Món Ăn - Menu", "active_page": "Menu", "admin_name": admin_name},
    )


@app.get("/Admin/Admin/Orders", response_class=HTMLResponse)
def admin_orders(request: Request):
    admin_name = read_cookie(request, "AdminUserName")
    if not admin_name:
        return RedirectResponse("/Admin/Admin/Login", status_code=302)
    return templates.TemplateResponse(
        "admin/orders.html",
        {"request": request, "title": "Quản Lý Đơn Hàng", "active_page": "Orders", "admin_name": admin_name},
    )


@app.get("/Admin/Admin/Login", response_class=HTMLResponse)
def admin_login_get(request: Request):
    return templates.TemplateResponse("admin/login.html", {"request": request, "error": None})


@app.post("/Admin/Admin/Login", response_class=HTMLResponse)
def admin_login_post(
    request: Request,
    email: str = Form(""),
    mat_khau: str = Form(""),
    db: Session = Depends(get_db),
):
    identifier = email.strip()
    if not identifier or not mat_khau:
        return templates.TemplateResponse(
            "admin/login.html",
            {"request": request, "error": "Vui lòng nhập đầy đủ tài khoản và mật khẩu."},
        )

    admin = (
        db.query(AdminAccount)
        .filter(or_(AdminAccount.so_dien_thoai == identifier, AdminAccount.ho_ten == identifier))
        .first()
    )
    if admin and verify_password(mat_khau, admin.mat_khau_hash):
        resp = RedirectResponse("/Admin/Admin/Index", status_code=303)
        set_cookie_utf8(resp, "AdminUserName", admin.ho_ten)
        set_cookie_utf8(resp, "AdminId", str(admin.id))
        return resp

    return templates.TemplateResponse(
        "admin/login.html",
        {"request": request, "error": "Tên đăng nhập hoặc mật khẩu không chính xác."},
    )


@app.get("/Admin/Admin/Logout")
def admin_logout():
    resp = RedirectResponse("/Admin/Admin/Login", status_code=302)
    resp.delete_cookie("AdminUserName")
    resp.delete_cookie("AdminId")
    return resp


@app.get("/Admin/Admin/TaoTaiKhoan", response_class=HTMLResponse)
def admin_register_get(request: Request):
    return templates.TemplateResponse("admin/register.html", {"request": request, "error": None})


@app.post("/Admin/Admin/TaoTaiKhoan", response_class=HTMLResponse)
def admin_register_post(
    request: Request,
    ho_ten: str = Form(""),
    sdt: str = Form(""),
    mat_khau: str = Form(""),
    db: Session = Depends(get_db),
):
    name = ho_ten.strip()
    phone = sdt.strip()
    if not name or not phone or not mat_khau:
        return templates.TemplateResponse(
            "admin/register.html",
            {"request": request, "error": "Vui lòng điền đầy đủ thông tin."},
        )

    if db.query(AdminAccount).filter(AdminAccount.so_dien_thoai == phone).first():
        return templates.TemplateResponse(
            "admin/register.html",
            {"request": request, "error": "Số điện thoại này đã được đăng ký."},
        )

    db.add(
        AdminAccount(
            ho_ten=name,
            so_dien_thoai=phone,
            mat_khau_hash=hash_password(mat_khau),
        )
    )
    db.commit()
    return RedirectResponse("/Admin/Admin/Login", status_code=303)


@app.get("/Admin/Admin/GoToUserPage")
def admin_go_user(request: Request):
    resp = RedirectResponse("/Home/Index", status_code=302)
    set_cookie_utf8(resp, "UserName", read_cookie(request, "AdminUserName") or "Admin")
    return resp


# ==================== REST API ====================

@app.get("/api/menu")
def api_get_menu(db: Session = Depends(get_db)):
    items = db.query(MenuItem).order_by(MenuItem.id.asc()).all()
    return [m.to_dict() for m in items]


@app.post("/api/orders")
def api_create_order(request: Request, payload: dict = Body(...), db: Session = Depends(get_db)):
    items_raw = payload.get("Items") or payload.get("items") or []
    if not items_raw:
        return JSONResponse({"success": False, "message": "Dữ liệu đơn hàng không hợp lệ."}, status_code=400)

    customer_name = (payload.get("CustomerName") or payload.get("customerName") or read_cookie(request, "UserName") or "Khách vãng lai").strip()
    customer = get_current_customer(request, db)
    menu_lookup = {m.id: m for m in db.query(MenuItem).all()}

    order = Order(
        id=uuid.uuid4().hex,
        customer_name=customer_name,
        order_date=datetime.now(),
        status="Pending",
        ghi_chu=payload.get("ghiChu") or payload.get("GhiChu") or "",
        customer_id=customer.id if customer else None,
    )

    total = 0.0
    for it in items_raw:
        mid = it.get("id") or it.get("Id")
        mid_int = int(mid) if mid is not None and str(mid).isdigit() and int(mid) in menu_lookup else None
        db_menu = menu_lookup.get(mid_int) if mid_int else None
        qty = max(1, int(it.get("soLuong") or it.get("SoLuong") or 1))
        gia = float(it.get("gia") or it.get("Gia") or (db_menu.gia if db_menu else 0))
        ten = (it.get("ten") or it.get("Ten") or (db_menu.ten if db_menu else "Món ăn")).strip()
        loai = it.get("loai") or it.get("Loai") or (db_menu.loai if db_menu else "mon_chinh")
        hinh = it.get("hinh") or it.get("Hinh") or (db_menu.hinh if db_menu else "")
        order.items.append(
            OrderItem(
                cart_id=str(it.get("cart_id") or it.get("cart_Id") or uuid.uuid4().hex),
                menu_item_id=mid_int,
                loai=loai,
                ten=ten,
                gia=gia,
                hinh=hinh,
                so_luong=qty,
            )
        )
        total += gia * qty

    order.total = total
    db.add(order)
    db.commit()
    return {"success": True, "message": "Order created successfully", "orderId": order.id, "total": total}


@app.post("/api/orders/{order_id}/pay")
def api_pay_order(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return JSONResponse({"success": False, "message": "Không tìm thấy đơn hàng."}, status_code=404)
    order.status = "Completed"
    db.commit()
    return {"success": True, "message": "Payment successful"}


@app.get("/api/orders/my")
def api_my_orders(request: Request, customerName: Optional[str] = None, db: Session = Depends(get_db)):
    resolved = (customerName or read_cookie(request, "UserName") or "").strip()
    customer = get_current_customer(request, db)
    q = db.query(Order).filter(Order.status.in_(["Pending", "Confirmed"]))
    if customer:
        q = q.filter(or_(Order.customer_id == customer.id, Order.customer_name == resolved))
    elif resolved:
        q = q.filter(Order.customer_name == resolved)
    else:
        return []
    return [o.to_dict() for o in q.order_by(Order.order_date.desc()).all()]


# --- ADMIN ORDERS CRUD ---

@app.get("/api/admin/orders")
def api_admin_orders(db: Session = Depends(get_db)):
    orders = db.query(Order).order_by(Order.order_date.desc()).all()
    return [o.to_dict() for o in orders]


@app.put("/api/admin/orders/{order_id}")
def api_admin_update_order(order_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return JSONResponse({"success": False, "message": "Không tìm thấy đơn hàng."}, status_code=404)

    if payload.get("customerName"):
        order.customer_name = payload["customerName"]
    if payload.get("status"):
        order.status = payload["status"]
    if "ghiChu" in payload and payload["ghiChu"] is not None:
        order.ghi_chu = payload["ghiChu"]

    valid_ids = {m.id for m in db.query(MenuItem.id).all()}
    order.items.clear()
    db.flush()

    total = 0.0
    for it in payload.get("items") or []:
        qty = max(1, int(it.get("soLuong") or 1))
        gia = float(it.get("gia") or 0)
        mid = it.get("id")
        mid_int = int(mid) if mid is not None and str(mid).isdigit() and int(mid) in valid_ids else None
        order.items.append(
            OrderItem(
                cart_id=str(it.get("cart_id") or it.get("cart_Id") or uuid.uuid4().hex),
                menu_item_id=mid_int,
                loai=it.get("loai") or "",
                ten=it.get("ten") or "Món ăn",
                gia=gia,
                hinh=it.get("hinh") or "",
                so_luong=qty,
            )
        )
        total += gia * qty

    order.total = total
    db.commit()
    return {"success": True}


@app.delete("/api/admin/orders/{order_id}")
def api_admin_delete_order(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return JSONResponse({"success": False, "message": "Không tìm thấy đơn hàng."}, status_code=404)
    db.delete(order)
    db.commit()
    return {"success": True}


@app.delete("/api/admin/orders")
def api_admin_delete_all_orders(db: Session = Depends(get_db)):
    for o in db.query(Order).all():
        db.delete(o)
    db.commit()
    return {"success": True}


@app.post("/api/admin/orders/delete-multiple")
def api_admin_delete_multiple_orders(ids: list[str] = Body(...), db: Session = Depends(get_db)):
    for o in db.query(Order).filter(Order.id.in_(ids)).all():
        db.delete(o)
    db.commit()
    return {"success": True}


# --- ADMIN MENU CRUD ---

FOLDER_MAP = {"mon_chinh": "monchinh", "mon_phu": "monphu", "nuoc_uong": "nuocuong"}


@app.post("/api/admin/menu")
def api_admin_create_menu(
    loai: str = Form("mon_chinh"),
    ten: str = Form(...),
    gia: float = Form(...),
    hinh: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    ten = ten.strip()
    if not ten or gia < 0:
        return JSONResponse({"success": False, "message": "Tên món không được trống và giá phải >= 0."}, status_code=400)
    loai_clean = loai.strip() or "mon_chinh"
    hinh_url = ""
    if hinh and hinh.filename:
        hinh_url = save_upload_image(hinh, FOLDER_MAP.get(loai_clean, "other"))
    item = MenuItem(loai=loai_clean, ten=ten, gia=gia, hinh=hinh_url)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"success": True, "item": item.to_dict()}


@app.put("/api/admin/menu/{item_id}")
def api_admin_update_menu(
    item_id: int,
    loai: str = Form("mon_chinh"),
    ten: str = Form(...),
    gia: float = Form(...),
    hinh: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    ten = ten.strip()
    if not ten or gia < 0:
        return JSONResponse({"success": False, "message": "Tên món không được trống và giá phải >= 0."}, status_code=400)
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        return JSONResponse({"success": False, "message": "Không tìm thấy món ăn."}, status_code=404)
    item.loai = loai.strip() or item.loai
    item.ten = ten
    item.gia = gia
    if hinh and hinh.filename:
        item.hinh = save_upload_image(hinh, FOLDER_MAP.get(item.loai, "other"))
    db.commit()
    db.refresh(item)
    return {"success": True, "item": item.to_dict()}


@app.delete("/api/admin/menu/{item_id}")
def api_admin_delete_menu(item_id: int, db: Session = Depends(get_db)):
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        return JSONResponse({"success": False, "message": "Không tìm thấy món ăn."}, status_code=404)
    db.query(OrderItem).filter(OrderItem.menu_item_id == item_id).update({OrderItem.menu_item_id: None})
    db.delete(item)
    db.commit()
    return {"success": True}


# --- DASHBOARD & PROFILE API ---

@app.get("/api/admin/dashboard-stats")
def api_dashboard_stats(db: Session = Depends(get_db)):
    orders = db.query(Order).all()
    tong_don = len(orders)
    don_cho = sum(1 for o in orders if o.status in ("Pending", "Confirmed"))
    doanh_thu = sum(float(o.total or 0) for o in orders if o.status in ("Completed", "Paid"))
    tong_mon = db.query(MenuItem).count()
    return {"contacts": tong_don, "deals": don_cho, "campaign": tong_mon, "worth": doanh_thu}


@app.get("/api/admin/chart-data")
def api_chart_data(db: Session = Depends(get_db)):
    orders = db.query(Order).all()
    today = datetime.now().date()
    labels, completed, in_progress = [], [], []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        labels.append(d.strftime("%d/%m"))
        completed.append(sum(1 for o in orders if o.order_date and o.order_date.date() == d and o.status in ("Completed", "Paid")))
        in_progress.append(sum(1 for o in orders if o.order_date and o.order_date.date() == d and o.status in ("Pending", "Confirmed")))
    return {"labels": labels, "completed": completed, "inProgress": in_progress}


@app.get("/api/admin/profile")
def api_admin_profile(request: Request, db: Session = Depends(get_db)):
    admin = get_current_admin(request, db)
    if not admin:
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    return {"hoTen": admin.ho_ten, "avatarUrl": admin.avatar_url}


@app.post("/api/admin/avatar")
def api_admin_avatar(request: Request, avatar: Optional[UploadFile] = File(None), db: Session = Depends(get_db)):
    admin = get_current_admin(request, db)
    if not admin:
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    if not avatar or not avatar.filename:
        return JSONResponse({"success": False, "message": "No file uploaded"}, status_code=400)
    admin.avatar_url = save_upload_image(avatar, "avatars", prefix="admin_")
    db.commit()
    return {"success": True, "avatarUrl": admin.avatar_url}


# --- AI HELPER ENDPOINTS ---

@app.post("/api/ai/chat")
def api_ai_chat(payload: dict = Body(...), db: Session = Depends(get_db)):
    msg = (payload.get("message") or "").strip().lower()
    items = db.query(MenuItem).order_by(MenuItem.id.asc()).all()
    matches = [m for m in items if any(w in m.ten.lower() for w in msg.split() if len(w) >= 2)]
    if matches:
        sugg = ", ".join(f"{m.ten} ({int(m.gia):,} đ)" for m in matches[:4])
        return {"success": True, "reply": f"Nhà Hàng Việt gợi ý cho bạn: {sugg}. Bạn có thể bấm Thêm vào giỏ hàng ngay bên dưới!"}
    top3 = ", ".join(f"{m.ten} ({int(m.gia):,} đ)" for m in items[:3])
    return {"success": True, "reply": f"Xin chào! Các món bán chạy hôm nay gồm: {top3}. Bạn thích món chính, món phụ hay nước uống?"}


@app.post("/api/ai/nhan-dien")
def api_ai_recognize(hinhAnh: Optional[UploadFile] = File(None), db: Session = Depends(get_db)):
    items = db.query(MenuItem).order_by(MenuItem.id.asc()).limit(2).all()
    return {"success": True, "danhSachMon": [m.ten for m in items]}
