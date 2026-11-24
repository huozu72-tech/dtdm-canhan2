let danhSachMonThucTe = [];

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/menu')
        .then(res => res.json())
        .then(data => {
            danhSachMonThucTe = data;
            if(window.hienThiMenu && document.querySelector('.tab_active')) {
                window.hienThiMenu(document.querySelector('.tab_active').dataset.loai);
            } else if(window.hienThiMenu) {
                window.hienThiMenu('tat_ca');
            }
        })
        .catch(err => console.error("Lỗi lấy danh sách món: ", err));

    taiDonChoTuServer();
});

// Trạng thái giỏ hàng
let gioHang = [];

// DOM AI
const inputChonAnh = document.getElementById('chon_anh');
const anhDaChon = document.getElementById('anh_da_chon');
const trangThaiAI = document.getElementById('trang_thai_ai');
const ketQuaAI = document.getElementById('ket_qua_ai');
const danhSachKetQuaAi = document.getElementById('danh_sach_ket_qua_ai');

if (inputChonAnh) {
    // 1. Logic AI (Mô phỏng)
    inputChonAnh.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                anhDaChon.src = event.target.result;
                anhDaChon.style.display = 'block';
                batDauPhanTichAI(file);
            };
            reader.readAsDataURL(file);
        }
    });

}

// DOM Camera elements
const modalCamera = document.getElementById('modal_camera');
const nutMoCamera = document.getElementById('nut_mo_camera');
const nutDongCamera = document.getElementById('nut_dong_camera');
const videoCamera = document.getElementById('video_camera');
const canvasCamera = document.getElementById('canvas_camera');
const selectThietBiCamera = document.getElementById('chon_thiet_bi_camera');
const nutBamChup = document.getElementById('nut_bam_chup');

let cameraStream = null;

if (nutMoCamera) {
    nutMoCamera.addEventListener('click', async () => {
        if (modalCamera) {
            modalCamera.style.display = 'flex';
        }
        await khoiDongCamera();
    });
}

if (nutDongCamera) {
    nutDongCamera.addEventListener('click', () => {
        dongCamera();
    });
}

// Bấm ra ngoài để đóng modal camera
window.addEventListener('click', (e) => {
    if (e.target === modalCamera) {
        dongCamera();
    }
});

function dongCamera() {
    if (modalCamera) {
        modalCamera.style.display = 'none';
    }
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    if (videoCamera) {
        videoCamera.srcObject = null;
    }
}

async function khoiDongCamera(preferredDeviceId = null) {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }

    const constraints = {
        video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: false
    };

    if (preferredDeviceId) {
        constraints.video.deviceId = { exact: preferredDeviceId };
    } else {
        constraints.video.facingMode = "environment";
    }

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoCamera) {
            videoCamera.srcObject = cameraStream;
        }
        await capNhatDanhSachCamera();
    } catch (err) {
        console.error("Không thể truy cập camera:", err);
        // Thử lại với cấu hình đơn giản nếu cấu hình lý tưởng thất bại
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            if (videoCamera) {
                videoCamera.srcObject = cameraStream;
            }
            await capNhatDanhSachCamera();
        } catch (fallbackErr) {
            console.error("Không thể mở camera (fallback):", fallbackErr);
            alert("Không thể mở camera. Vui lòng cấp quyền truy cập camera và thử lại.");
            dongCamera();
        }
    }
}

async function capNhatDanhSachCamera() {
    if (!selectThietBiCamera) return;
    
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        selectThietBiCamera.innerHTML = '';
        
        if (videoDevices.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Không tìm thấy camera';
            selectThietBiCamera.appendChild(opt);
            return;
        }

        let activeLabel = '';
        if (cameraStream) {
            const activeTrack = cameraStream.getVideoTracks()[0];
            if (activeTrack) {
                activeLabel = activeTrack.label;
            }
        }

        videoDevices.forEach((device, index) => {
            const opt = document.createElement('option');
            opt.value = device.deviceId;
            opt.textContent = device.label || `Camera ${index + 1} (ID: ${device.deviceId.substring(0, 5)}...)`;
            
            if (activeLabel && device.label === activeLabel) {
                opt.selected = true;
            }
            
            selectThietBiCamera.appendChild(opt);
        });
    } catch (err) {
        console.error("Lỗi lấy danh sách thiết bị camera:", err);
    }
}

if (selectThietBiCamera) {
    selectThietBiCamera.addEventListener('change', async (e) => {
        const deviceId = e.target.value;
        if (deviceId) {
            await khoiDongCamera(deviceId);
        }
    });
}

if (nutBamChup) {
    nutBamChup.addEventListener('click', () => {
        if (!cameraStream || !videoCamera || !canvasCamera) return;

        canvasCamera.width = videoCamera.videoWidth || 640;
        canvasCamera.height = videoCamera.videoHeight || 480;
        
        const ctx = canvasCamera.getContext('2d');
        if (ctx) {
            ctx.drawImage(videoCamera, 0, 0, canvasCamera.width, canvasCamera.height);
            
            canvasCamera.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
                    
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        if (anhDaChon) {
                            anhDaChon.src = event.target.result;
                            anhDaChon.style.display = 'block';
                        }
                        
                        dongCamera();
                        batDauPhanTichAI(file);
                    };
                    reader.readAsDataURL(file);
                }
            }, 'image/jpeg', 0.9);
        }
    });
}

function batDauPhanTichAI(file) {
    ketQuaAI.classList.add('an');
    trangThaiAI.classList.remove('an');
    
    // Chuẩn bị form data gửi file ảnh xuống C# Backend
    const formData = new FormData();
    formData.append('hinhAnh', file);

    fetch('/api/ai/nhan-dien', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        trangThaiAI.classList.add('an');
        if (data.success && data.danhSachMon && data.danhSachMon.length > 0) {
            if (danhSachKetQuaAi) {
                danhSachKetQuaAi.innerHTML = '';
            }
            let counter = 0;

            data.danhSachMon.forEach(tenMon => {
                const monTimThay = danhSachMonThucTe.find(m => m.ten.trim().toLowerCase() === tenMon.trim().toLowerCase());
                if (monTimThay) {
                    counter++;
                    const theMonDiv = document.createElement('div');
                    theMonDiv.className = 'the_mon_an_ai';
                    theMonDiv.innerHTML = `
                        <img src="${monTimThay.hinh}" alt="${monTimThay.ten}">
                        <div class="thong_tin_mon_ai">
                            <h4>${monTimThay.ten}</h4>
                            <p class="gia">${dinhDangTien(monTimThay.gia)}</p>
                        </div>
                        <button class="nut_hanh_dong nut_them_nhanh_ai" data-id="${monTimThay.id}">Thêm Vào Giỏ</button>
                    `;
                    if (danhSachKetQuaAi) {
                        danhSachKetQuaAi.appendChild(theMonDiv);
                    }
                }
            });

            if (counter > 0) {
                ketQuaAI.classList.remove('an');
                document.querySelectorAll('.nut_them_nhanh_ai').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const id = parseInt(this.getAttribute('data-id'));
                        const m = danhSachMonThucTe.find(x => x.id === id);
                        if (m) {
                            themVaoGio(m);
                            ketQuaAI.classList.add('an');
                            anhDaChon.style.display = 'none';
                            inputChonAnh.value = '';
                        }
                    });
                });
            } else {
                alert("Hệ thống AI nhận diện danh sách: '" + data.danhSachMon.join(', ') + "' nhưng không tìm thấy trong thực đơn!");
            }
        } else {
            alert("Lỗi nhận diện AI hoặc không tìm thấy món phù hợp: " + (data.message || ""));
        }
    })
    .catch(error => {
        trangThaiAI.classList.add('an');
        console.error("Lỗi:", error);
        alert("Lỗi kết nối tới Server AI!");
    });
}


// 2. Logic Menu Tabs & Lưới Món ăn
const danhSachMenuEl = document.getElementById('danh_sach_menu');
const cacNutTab = document.querySelectorAll('.nut_tab');

window.hienThiMenu = function(loai) {
    if (!danhSachMenuEl) return;
    
    danhSachMenuEl.innerHTML = '';
    const menuHienThi = loai === 'tat_ca' 
                        ? danhSachMonThucTe 
                        : danhSachMonThucTe.filter(m => m.loai === loai);
    
    menuHienThi.forEach(mon => {
        const theHtm = document.createElement('div');
        theHtm.className = 'the_mon_grid';
        
        let loaiLabel = '';
        if (mon.loai === 'mon_chinh') loaiLabel = 'Món chính';
        else if (mon.loai === 'mon_phu') loaiLabel = 'Món phụ';
        else if (mon.loai === 'nuoc_uong') loaiLabel = 'Đồ uống';
        else loaiLabel = 'Khác';

        const tenAnToan = escapeHtml(mon.ten);
        const hinhAnToan = escapeHtml(mon.hinh || '');
        theHtm.innerHTML = `
            <img src="${hinhAnToan}" alt="${tenAnToan}">
            <div class="chi_tiet_mon_grid">
                <div class="tieude_va_tag">
                    <h4 title="${tenAnToan}">${tenAnToan}</h4>
                    <span class="the_tag">${loaiLabel}</span>
                </div>
                <p class="mo_ta_mon">${tenAnToan} đậm đà hương vị truyền thống thơm ngon</p>
                <div class="gia_va_hanh_dong">
                    <div class="gia">${dinhDangTien(mon.gia)}</div>
                    <button class="nut_them_grid" onclick="themMonTuMenu(${mon.id})">Thêm vào giỏ</button>
                </div>
            </div>
        `;
        danhSachMenuEl.appendChild(theHtm);
    });
}

// Xử lý chuyển tab
if (cacNutTab.length > 0) {
    cacNutTab.forEach(tab => {
        tab.addEventListener('click', (e) => {
            // Xoá class active cũ
            cacNutTab.forEach(t => t.classList.remove('tab_active'));
            // Thêm active cho tab hiện tại
            e.target.classList.add('tab_active');
            // Lọc dữ liệu
            hienThiMenu(e.target.dataset.loai);
        });
    });
    // Gọi hiển thị lần đầu
    hienThiMenu('tat_ca');
}

window.themMonTuMenu = function(id) {
    const mon = danhSachMonThucTe.find(m => m.id === id);
    if(mon) themVaoGio(mon);
}

// 3. Logic Giỏ hàng và Modal
const soLuongGioHangEl = document.getElementById('so_luong_gio_hang');
const danhSachGioHangEl = document.getElementById('danh_sach_gio_hang');
const tomTatDonHangEl = document.getElementById('tom_tat_don_hang');
const tongTienHienThiEl = document.getElementById('tong_tien');

// DOM Modal
const nutMoGioHang = document.getElementById('nut_mo_gio_hang');
const modalGioHang = document.getElementById('modal_gio_hang');
const nutDongGioHang = document.getElementById('nut_dong_gio_hang');

if (nutMoGioHang) {
    nutMoGioHang.addEventListener('click', () => {
        modalGioHang.style.display = 'flex';
        capNhatGiaoDienGioHang();
    });
    
    nutDongGioHang.addEventListener('click', () => {
        modalGioHang.style.display = 'none';
    });
    
    // Bấm ra ngoài để đóng modal
    window.addEventListener('click', (e) => {
        if (e.target === modalGioHang) {
            modalGioHang.style.display = 'none';
        }
    });
}

function themVaoGio(mon) {
    const existingItem = gioHang.find(item => item.id === mon.id);
    if(existingItem) {
        existingItem.soLuong = (existingItem.soLuong || 1) + 1;
    } else {
        gioHang.push({ ...mon, soLuong: 1, cart_id: Date.now().toString() });
    }
    soLuongGioHangEl.textContent = gioHang.reduce((sum, item) => sum + (item.soLuong || 1), 0);
    // Highlight nhanh nút giỏ hàng để báo hiệu
    const icon = document.querySelector('.nut_gio_hang_nav');
    if (icon) {
        icon.style.backgroundColor = '#ff9800';
        icon.style.color = '#fff';
        setTimeout(() => {
            icon.style.backgroundColor = '#ffe0b2';
            icon.style.color = '#d84315';
        }, 300);
    }
    capNhatGiaoDienGioHang();
}

window.xoaMon = function(cartId) {
    gioHang = gioHang.filter(mon => mon.cart_id !== cartId);
    soLuongGioHangEl.textContent = gioHang.reduce((sum, item) => sum + (item.soLuong || 1), 0);
    capNhatGiaoDienGioHang();
}

window.capNhatSoLuong = function(cartId, soLuongMoi) {
    const item = gioHang.find(m => m.cart_id === cartId);
    if(item) {
        const val = parseInt(soLuongMoi);
        item.soLuong = (val > 0) ? val : 1;
        soLuongGioHangEl.textContent = gioHang.reduce((sum, item) => sum + (item.soLuong || 1), 0);
        capNhatGiaoDienGioHang();
    }
}

function capNhatGiaoDienGioHang() {
    if(!danhSachGioHangEl) return;
    
    if (gioHang.length === 0) {
        danhSachGioHangEl.innerHTML = '<p class="thong_bao_trong">Giỏ hàng đang trống.</p>';
        danhSachGioHangEl.className = 'danh_sach_trong';
        tomTatDonHangEl.style.display = 'none';
        return;
    }
    
    danhSachGioHangEl.className = '';
    let htmlContent = '';
    let tongTien = 0;
    
    gioHang.forEach(mon => {
        const itemQuantity = mon.soLuong || 1;
        htmlContent += `
            <div class="mon_trong_gio">
                <img src="${mon.hinh}" style="width: 40px; height: 40px; border-radius: 5px; object-fit: cover; margin-right: 10px;">
                <div style="flex-grow:1;">
                    <strong>${mon.ten}</strong>
                    <div style="font-size: 14px; color: #666; margin-top: 5px;">
                        ${dinhDangTien(mon.gia)} 
                        <span style="display:inline-block; margin-left:10px;">SL: 
                            <input type="number" 
                                   value="${itemQuantity}" 
                                   min="1" 
                                   style="width: 50px; text-align: center; border: 1px solid #ccc; border-radius: 4px; padding: 2px;"
                                   onchange="capNhatSoLuong('${mon.cart_id}', this.value)">
                        </span>
                    </div>
                </div>
                <div style="font-weight: bold; color: var(--primary); margin-right: 15px;">
                    ${dinhDangTien(mon.gia * itemQuantity)}
                </div>
                <div class="xoa_mon" onclick="xoaMon('${mon.cart_id}')">✖</div>
            </div>
        `;
        tongTien += (mon.gia * itemQuantity);
    });
    
    danhSachGioHangEl.innerHTML = htmlContent;
    tongTienHienThiEl.textContent = dinhDangTien(tongTien);
    tomTatDonHangEl.style.display = 'block';
}

function dinhDangTien(so) {
    return so.toLocaleString('vi-VN') + ' đ';
}

const nutXacNhan = document.getElementById('nut_xac_nhan_dat');
const nutMoThanhToan = document.getElementById('nut_mo_thanh_toan');
const soLuongDonChoEl = document.getElementById('so_luong_don_cho');
const modalThanhToan = document.getElementById('modal_thanh_toan');
const nutDongThanhToan = document.getElementById('nut_dong_thanh_toan');
const nutXacNhanThanhToan = document.getElementById('nut_xac_nhan_thanh_toan');
const nutQuayLai = document.getElementById('nut_quay_lai_danh_sach');

const manHinhDanhSach = document.getElementById('man_hinh_danh_sach_don');
const manHinhQr = document.getElementById('man_hinh_quet_qr');
const danhSachDonChoEl = document.getElementById('danh_sach_don_cho');
const tongTienThanhToanEl = document.getElementById('tong_tien_thanh_toan');

let currentOrderIdToPay = null;

// Lấy danh sách hóa đơn pending từ local và đồng bộ với SQLite server
let pendingOrders = JSON.parse(localStorage.getItem('myPendingOrders') || '[]');

function taiDonChoTuServer() {
    const userName = window.currentUserName || "Khách vãng lai";
    return fetch(`/api/orders/my?customerName=${encodeURIComponent(userName)}`)
        .then(res => {
            if (!res.ok) throw new Error('Không thể tải đơn chờ');
            return res.json();
        })
        .then(serverOrders => {
            if (!Array.isArray(serverOrders)) return;
            const normalized = serverOrders.map(o => ({
                id: o.id,
                total: o.total,
                date: o.orderDate,
                items: o.items || []
            }));

            if (userName !== "Khách vãng lai") {
                pendingOrders = normalized;
            } else {
                // Khách vãng lai chỉ giữ lại các đơn mình đã đặt mà vẫn đang chờ trên server
                const serverById = new Map(normalized.map(o => [o.id, o]));
                pendingOrders = pendingOrders
                    .filter(o => serverById.has(o.id))
                    .map(o => serverById.get(o.id));
            }
            localStorage.setItem('myPendingOrders', JSON.stringify(pendingOrders));
            capNhatHuyHieuDonCho();
        })
        .catch(err => console.warn("Không đồng bộ được đơn chờ:", err));
}

function capNhatHuyHieuDonCho() {
    if (soLuongDonChoEl) {
        soLuongDonChoEl.textContent = pendingOrders.length;
    }
}
capNhatHuyHieuDonCho();

if (nutMoThanhToan) {
    nutMoThanhToan.addEventListener('click', () => {
        hienThiDanhSachDon();
        modalThanhToan.style.display = 'flex';
        taiDonChoTuServer().then(() => {
            if (manHinhQr.style.display === 'none') {
                hienThiDanhSachDon();
            }
        });
    });
}

if (nutDongThanhToan) {
    nutDongThanhToan.addEventListener('click', () => {
        modalThanhToan.style.display = 'none';
    });
}

// Bấm ra ngoài để đóng modal thanh toán
window.addEventListener('click', (e) => {
    if (e.target === modalThanhToan) {
        modalThanhToan.style.display = 'none';
    }
});

if (nutQuayLai) {
    nutQuayLai.addEventListener('click', () => {
        manHinhQr.style.display = 'none';
        manHinhDanhSach.style.display = 'block';
    });
}

function hienThiDanhSachDon() {
    manHinhQr.style.display = 'none';
    manHinhDanhSach.style.display = 'block';

    if (pendingOrders.length === 0) {
        danhSachDonChoEl.innerHTML = '<p class="thong_bao_trong">Không có hóa đơn nào đang chờ.</p>';
        return;
    }

    let html = '';
    pendingOrders.forEach((order, index) => {
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px; background: #fff;">
                <div style="text-align: left;">
                    <div style="font-weight: bold; color: #333;">Đơn #${order.id.substring(0,8)}</div>
                    <div style="font-size: 13px; color: #666; margin-top: 5px;">${new Date(order.date).toLocaleString('vi-VN')}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: bold; color: #f23b05; font-size: 16px;">${dinhDangTien(order.total)}</div>
                    <button onclick="chonDonThanhToan(${index})" class="nut_hanh_dong nut_them_grid" style="margin-top: 5px; padding: 5px 15px; font-size: 13px;">Thanh Toán</button>
                </div>
            </div>
        `;
    });
    danhSachDonChoEl.innerHTML = html;
}

window.chonDonThanhToan = function(index) {
    const order = pendingOrders[index];
    if (!order) return;

    currentOrderIdToPay = order.id;
    tongTienThanhToanEl.textContent = dinhDangTien(order.total);
    
    manHinhDanhSach.style.display = 'none';
    manHinhQr.style.display = 'block';
}

if (nutXacNhanThanhToan) {
    nutXacNhanThanhToan.addEventListener('click', () => {
        if (!currentOrderIdToPay) return;

        nutXacNhanThanhToan.textContent = "Đang xử lý...";
        nutXacNhanThanhToan.disabled = true;

        fetch(`/api/orders/${currentOrderIdToPay}/pay`, {
            method: 'POST'
        })
        .then(res => res.json())
        .then(data => {
            if(data.success) {
                alert("Thanh toán thành công! Cảm ơn bạn.");
                // Xóa khỏi danh sách chờ
                pendingOrders = pendingOrders.filter(o => o.id !== currentOrderIdToPay);
                localStorage.setItem('myPendingOrders', JSON.stringify(pendingOrders));
                capNhatHuyHieuDonCho();
                
                hienThiDanhSachDon();
            } else {
                alert("Lỗi khi thanh toán: " + (data.message || ''));
            }
        })
        .catch(err => {
            console.error("Lỗi gửi thanh toán:", err);
            alert("Lỗi khi thanh toán: " + err.message);
        })
        .finally(() => {
            nutXacNhanThanhToan.textContent = "Đã Thanh Toán";
            nutXacNhanThanhToan.disabled = false;
        });
    });
}

function resetGioHangSauThanhToan() {
    gioHang = [];
    soLuongGioHangEl.textContent = 0;
    capNhatGiaoDienGioHang();
}

if(nutXacNhan) {
    nutXacNhan.addEventListener('click', () => {
        if (gioHang.length > 0) {
            const textBanDau = nutXacNhan.textContent;
            nutXacNhan.textContent = "Đang tạo đơn...";
            nutXacNhan.disabled = true;

            const orderBody = {
                CustomerName: window.currentUserName || "Khách vãng lai",
                Items: gioHang
            };

            let tongTien = gioHang.reduce((sum, item) => sum + (item.gia * (item.soLuong || 1)), 0);

            fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderBody)
            })
            .then(async res => {
                if (!res.ok) {
                    const errorText = await res.text();
                    try {
                        const errorJson = JSON.parse(errorText);
                        throw new Error(JSON.stringify(errorJson.errors || errorJson.title || errorJson));
                    } catch {
                        throw new Error(errorText);
                    }
                }
                return res.json();
            })
            .then(data => {
                if(data.success) {
                    alert("Đơn hàng đã được lưu (Chờ xử lý). Bạn có thể thanh toán tại mục Thanh Toán.");
                    
                    // Lưu hóa đơn vào local
                    pendingOrders.unshift({
                        id: data.orderId,
                        total: tongTien,
                        date: new Date().toISOString(),
                        items: [...gioHang]
                    });
                    localStorage.setItem('myPendingOrders', JSON.stringify(pendingOrders));
                    capNhatHuyHieuDonCho();

                    modalGioHang.style.display = 'none';
                    resetGioHangSauThanhToan();
                } else {
                    alert("Lỗi khi tạo đơn: " + (data.message || ''));
                }
            })
            .catch(err => {
                console.error("Lỗi gửi đơn:", err);
                alert("Lỗi khi tạo đơn: " + err.message);
            })
            .finally(() => {
                nutXacNhan.textContent = textBanDau;
                nutXacNhan.disabled = false;
            });
        }
    });
}

// 4. Logic Chatbox AI
const chatboxNut = document.getElementById('chatbox_ai_nut');
const chatboxKhung = document.getElementById('chatbox_ai_khung');
const chatboxDong = document.getElementById('chatbox_dong');
const chatboxInput = document.getElementById('chatbox_input');
const chatboxGui = document.getElementById('chatbox_gui');
const chatboxNoiDung = document.getElementById('chatbox_noi_dung');

if (chatboxNut && chatboxKhung) {
    chatboxNut.addEventListener('click', () => {
        chatboxKhung.style.display = chatboxKhung.style.display === 'none' ? 'flex' : 'none';
        if (chatboxKhung.style.display === 'flex') {
            chatboxInput.focus();
        }
    });

    chatboxDong.addEventListener('click', () => {
        chatboxKhung.style.display = 'none';
    });

    function themTinNhan(tinNhan, isUser) {
        const div = document.createElement('div');
        div.className = `tin_nhan ${isUser ? 'user' : 'bot'}`;
        div.textContent = tinNhan;
        chatboxNoiDung.appendChild(div);
        chatboxNoiDung.scrollTop = chatboxNoiDung.scrollHeight;
    }

    function guiTinNhanAI() {
        const text = chatboxInput.value.trim();
        if (!text) return;

        themTinNhan(text, true);
        chatboxInput.value = '';
        
        const loadingId = 'loading_' + Date.now();
        const divLoading = document.createElement('div');
        divLoading.className = 'tin_nhan bot';
        divLoading.id = loadingId;
        divLoading.innerHTML = '<i class="fas fa-ellipsis-h" style="animation: fade 1s infinite alternate;"></i>';
        chatboxNoiDung.appendChild(divLoading);
        chatboxNoiDung.scrollTop = chatboxNoiDung.scrollHeight;

        fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: text })
        })
        .then(res => res.json())
        .then(data => {
            const loadingEl = document.getElementById(loadingId);
            if(loadingEl) loadingEl.remove();

            if (data.success && data.reply) {
                themTinNhan(data.reply, false);
            } else {
                themTinNhan("Xin lỗi, tôi không thể trả lời lúc này. " + (data.message || ""), false);
            }
        })
        .catch(err => {
            console.error("Lỗi chat AI:", err);
            const loadingEl = document.getElementById(loadingId);
            if(loadingEl) loadingEl.remove();
            themTinNhan("Đã có lỗi xảy ra khi kết nối tới AI.", false);
        });
    }

    chatboxGui.addEventListener('click', guiTinNhanAI);
    chatboxInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            guiTinNhanAI();
        }
    });
}

