from datetime import datetime
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    loai = Column(String(50), nullable=False, default="mon_chinh")
    ten = Column(String(200), nullable=False)
    gia = Column(Numeric(12, 0), nullable=False, default=0)
    hinh = Column(String(500), nullable=True, default="")

    def to_dict(self):
        return {
            "id": self.id,
            "loai": self.loai,
            "ten": self.ten,
            "gia": float(self.gia or 0),
            "hinh": self.hinh or "",
        }


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    ho_ten = Column(String(150), nullable=False)
    so_dien_thoai = Column(String(30), unique=True, index=True, nullable=False)
    mat_khau_hash = Column(String(255), nullable=False)
    dia_chi = Column(String(300), nullable=True, default="")
    avatar_url = Column(String(500), nullable=True, default="")
    created_at = Column(DateTime, default=datetime.now)

    orders = relationship("Order", back_populates="customer")


class AdminAccount(Base):
    __tablename__ = "admin_accounts"

    id = Column(Integer, primary_key=True, index=True)
    ho_ten = Column(String(150), nullable=False)
    so_dien_thoai = Column(String(30), unique=True, index=True, nullable=False)
    mat_khau_hash = Column(String(255), nullable=False)
    avatar_url = Column(String(500), nullable=True, default="")
    created_at = Column(DateTime, default=datetime.now)


class Order(Base):
    __tablename__ = "orders"

    id = Column(String(64), primary_key=True, index=True)
    customer_name = Column(String(150), nullable=False, default="Khách vãng lai")
    order_date = Column(DateTime, default=datetime.now)
    total = Column(Numeric(12, 0), nullable=False, default=0)
    status = Column(String(40), nullable=False, default="Pending")
    ghi_chu = Column(Text, nullable=True, default="")
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)

    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "customerName": self.customer_name,
            "orderDate": self.order_date.isoformat() if self.order_date else datetime.now().isoformat(),
            "total": float(self.total or 0),
            "status": self.status,
            "ghiChu": self.ghi_chu or "",
            "customerId": self.customer_id,
            "items": [it.to_dict() for it in self.items],
        }


class OrderItem(Base):
    __tablename__ = "order_items"

    internal_id = Column(Integer, primary_key=True, autoincrement=True)
    cart_id = Column(String(64), nullable=True)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id", ondelete="SET NULL"), nullable=True)
    loai = Column(String(50), nullable=True)
    ten = Column(String(200), nullable=False)
    gia = Column(Numeric(12, 0), nullable=False, default=0)
    hinh = Column(String(500), nullable=True)
    so_luong = Column(Integer, nullable=False, default=1)
    order_id = Column(String(64), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)

    order = relationship("Order", back_populates="items")

    def to_dict(self):
        return {
            "internalId": self.internal_id,
            "cart_Id": self.cart_id,
            "id": self.menu_item_id,
            "loai": self.loai or "",
            "ten": self.ten,
            "gia": float(self.gia or 0),
            "hinh": self.hinh or "",
            "soLuong": self.so_luong,
            "orderId": self.order_id,
        }


SEED_MENU_ITEMS = [
    {"loai": "mon_chinh", "ten": "Chân Giò Muối Chiên Giòn", "gia": 120000, "hinh": "/images/monchinh/chan-giou-muoi-chien-gion.png"},
    {"loai": "mon_chinh", "ten": "Ếch Nướng Muối Ớt Lá Chanh", "gia": 85000, "hinh": "/images/monchinh/ech-nuong-muoi-ot-la-chanh.png"},
    {"loai": "mon_chinh", "ten": "Gà Nướng Mật Ong", "gia": 150000, "hinh": "/images/monchinh/ga-nuong-mat-ong.png"},
    {"loai": "mon_chinh", "ten": "Gà Quay Bánh Bao", "gia": 160000, "hinh": "/images/monchinh/ga-quay-banh-bao.png"},
    {"loai": "mon_chinh", "ten": "Tôm Chiên Xù", "gia": 95000, "hinh": "/images/monchinh/tom-chien-xu.png"},
    {"loai": "mon_chinh", "ten": "Tôm Nướng Muối Ớt", "gia": 105000, "hinh": "/images/monchinh/tom-nuong-muoi-ot.png"},
    {"loai": "mon_phu", "ten": "Chân Gà Sả Tắc", "gia": 60000, "hinh": "/images/monphu/Chan-ga-sa-tac.png"},
    {"loai": "mon_phu", "ten": "Chân Gà Sốt Thái", "gia": 65000, "hinh": "/images/monphu/chan-ga-sot-thai.png"},
    {"loai": "mon_phu", "ten": "Gỏi Ngó Sen", "gia": 55000, "hinh": "/images/monphu/goi-ngo-sen.png"},
    {"loai": "mon_phu", "ten": "Gỏi Xoài Tôm Khô", "gia": 70000, "hinh": "/images/monphu/goi-xoai-tom-kho.png"},
    {"loai": "mon_phu", "ten": "Gỏi Xoài Tôm Thịt", "gia": 80000, "hinh": "/images/monphu/goi-xoai-tom-thit.png"},
    {"loai": "nuoc_uong", "ten": "7Up", "gia": 15000, "hinh": "/images/nuocuong/7up.png"},
    {"loai": "nuoc_uong", "ten": "Coca Cola", "gia": 15000, "hinh": "/images/nuocuong/cocacola.png"},
    {"loai": "nuoc_uong", "ten": "Pepsi", "gia": 15000, "hinh": "/images/nuocuong/pepsi.png"},
    {"loai": "nuoc_uong", "ten": "Sting", "gia": 15000, "hinh": "/images/nuocuong/sting.png"},
]
