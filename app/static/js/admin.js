/* --- ADMIN ORDERS SCRIPTS --- */

function dinhDangTien(so) {
    return Number(so).toLocaleString('vi-VN') + ' đ';
}

function loadOrders() {
    const tableBody = document.querySelector('#ordersTable tbody');
    if(!tableBody) return;

    fetch('/api/admin/orders')
        .then(res => res.json())
        .then(data => {
            tableBody.innerHTML = '';
            data.forEach(order => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>#${order.id.substring(0, 8)}</td>
                    <td>${order.customerName}</td>
                    <td>${new Date(order.orderDate).toLocaleString('vi-VN')}</td>
                    <td>${dinhDangTien(order.total)}</td>
                    <td><span style="color: ${order.status === 'Completed' ? '#10b981' : '#f59e0b'}">${order.status}</span></td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="openOrderModal('${order.id}')">Chi tiết</button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        })
        .catch(err => console.error(err));
}

let currentOrderInfo = null;

function openOrderModal(id) {
    fetch('/api/admin/orders')
        .then(res => res.json())
        .then(orders => {
            const order = orders.find(o => o.id === id);
            if(order) {
                currentOrderInfo = order;
                document.getElementById('modalOrderTitle').textContent = `Chi Tiết Đơn Hàng #${order.id.substring(0,8)}`;
                document.getElementById('modalCustomerName').textContent = order.customerName;
                document.getElementById('modalOrderStatus').value = order.status;
                
                renderOrderItemsModal();
                
                document.getElementById('orderModal').style.display = 'flex';
            }
        });
}

window.updateOrderItemQuantity = function(index, quantityVal) {
    if(!currentOrderInfo) return;
    const val = parseInt(quantityVal);
    currentOrderInfo.items[index].soLuong = (val > 0) ? val : 1;
    renderOrderItemsModal();
};

function renderOrderItemsModal() {
    const container = document.getElementById('modalOrderItems');
    container.innerHTML = '';
    let total = 0;

    currentOrderInfo.items.forEach((item, index) => {
        const qty = item.soLuong || 1;
        total += item.gia * qty;
        
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #f0f0f0;">
                <span style="flex-grow:1">${index + 1}. ${item.ten}</span>
                <span class="no-print" style="margin-right:20px;">
                    <input type="number" min="1" value="${qty}" style="width:50px; text-align:center; border:1px solid #ccc; border-radius:4px; padding:2px;" onchange="updateOrderItemQuantity(${index}, this.value)">
                </span>
                <span class="print-only" style="display:none; margin-right:20px;">x${qty}</span>
                <span style="min-width: 100px; text-align:right;">${dinhDangTien(item.gia * qty)} <i class="fas fa-trash no-print" style="color:red; cursor:pointer; margin-left:15px;" title="Xoá món" onclick="removeOrderItem(${index})"></i></span>
            </div>
        `;
    });
    
    currentOrderInfo.total = total;
    document.getElementById('modalOrderTotal').textContent = dinhDangTien(total);
}

function removeOrderItem(index) {
    currentOrderInfo.items.splice(index, 1);
    renderOrderItemsModal();
}

function loadAvailableMenuForEditing() {
    const select = document.getElementById('availableMenuItems');
    if(!select) return;

    fetch('/api/menu')
        .then(res => res.json())
        .then(data => {
            select.innerHTML = '<option value="">-- Chọn món để thêm --</option>';
            data.forEach(m => {
                select.innerHTML += `<option value='${JSON.stringify(m)}'>${m.ten} - ${dinhDangTien(m.gia)}</option>`;
            });
        });
}

function addItemToOrder() {
    const val = document.getElementById('availableMenuItems').value;
    if(!val) return;
    const menuObj = JSON.parse(val);
    
    const existing = currentOrderInfo.items.find(i => i.id === menuObj.id);
    if(existing) {
        existing.soLuong = (existing.soLuong || 1) + 1;
    } else {
        currentOrderInfo.items.push({
            cart_id: Date.now().toString(),
            internalId: 0,
            id: menuObj.id,
            loai: menuObj.loai,
            ten: menuObj.ten,
            gia: menuObj.gia,
            hinh: menuObj.hinh,
            soLuong: 1
        });
    }
    renderOrderItemsModal();
}

function saveOrderChanges() {
    if(!currentOrderInfo) return;
    
    currentOrderInfo.status = document.getElementById('modalOrderStatus').value;

    fetch(`/api/admin/orders/${currentOrderInfo.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(currentOrderInfo)
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            alert('Lưu đơn hàng thành công!');
            closeOrderModal();
            loadOrders();
        }
    });
}

function deleteOrder() {
    if(!currentOrderInfo) return;
    if(confirm('Bạn có chắc chắn muốn xoá đơn hàng này?')) {
        fetch(`/api/admin/orders/${currentOrderInfo.id}`, { method: 'DELETE' })
        .then(() => {
            closeOrderModal();
            loadOrders();
        });
    }
}

function closeOrderModal() {
    const m = document.getElementById('orderModal');
    if(m) m.style.display = 'none';
}

function printInvoice() {
    window.print();
}

/* --- ADMIN MENU SCRIPTS --- */

function loadMenu() {
    const grid = document.getElementById('menuGrid');
    if(!grid) return;

    fetch('/api/menu')
        .then(res => res.json())
        .then(data => {
            grid.innerHTML = '';
            data.forEach(item => {
                grid.innerHTML += `
                    <div class="menu-card">
                        <img src="${item.hinh}" alt="${item.ten}" onerror="this.src='https://via.placeholder.com/150'">
                        <h4>${item.ten}</h4>
                        <p>${dinhDangTien(item.gia)}</p>
                        <div class="actions">
                            <button class="btn btn-secondary btn-sm" onclick='editMenu(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Sửa</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteMenu(${item.id})">Xoá</button>
                        </div>
                    </div>
                `;
            });
        });
}

function openMenuModal() {
    document.getElementById('menuForm').reset();
    document.getElementById('menuId').value = '';
    document.getElementById('menuHinhPreview').style.display = 'none';
    document.getElementById('modalMenuTitle').textContent = 'Thêm Món Mới';
    document.getElementById('menuModal').style.display = 'flex';
}

function closeMenuModal() {
    document.getElementById('menuModal').style.display = 'none';
}

function editMenu(item) {
    document.getElementById('menuId').value = item.id;
    document.getElementById('menuTen').value = item.ten;
    document.getElementById('menuGia').value = item.gia;
    document.getElementById('menuLoai').value = item.loai;
    document.getElementById('modalMenuTitle').textContent = 'Sửa Món';
    
    if(item.hinh) {
        document.getElementById('menuHinhPreview').src = item.hinh;
        document.getElementById('menuHinhPreview').style.display = 'block';
    }
    
    document.getElementById('menuModal').style.display = 'flex';
}

function saveMenu() {
    const id = document.getElementById('menuId').value;
    const formData = new FormData();
    formData.append('ten', document.getElementById('menuTen').value);
    formData.append('gia', document.getElementById('menuGia').value);
    formData.append('loai', document.getElementById('menuLoai').value);
    
    const hinhFile = document.getElementById('menuHinh').files[0];
    if(hinhFile) {
        formData.append('hinh', hinhFile);
    }

    const url = id ? `/api/admin/menu/${id}` : '/api/admin/menu';
    const method = id ? 'PUT' : 'POST';

    fetch(url, {
        method: method,
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            closeMenuModal();
            loadMenu();
        } else {
            alert('Lỗi lưu món!');
        }
    });
}

function deleteMenu(id) {
    if(confirm('Bạn có chắc xoá món này?')) {
        fetch(`/api/admin/menu/${id}`, { method: 'DELETE' })
        .then(() => loadMenu());
    }
}
