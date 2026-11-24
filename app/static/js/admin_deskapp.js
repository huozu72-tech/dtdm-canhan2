/* --- ADMIN DESKAPP JS LOGIC --- */

document.addEventListener('DOMContentLoaded', () => {
    // Check for showLast param
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('showLast') === 'true') {
        fetch('/api/admin/orders')
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    openOrderModal(data[0].id);
                }
            });
    }

    // Load admin profile (avatar)
    fetch('/api/admin/profile')
        .then(res => {
            if (res.ok) return res.json();
            throw new Error('Not logged in or no profile');
        })
        .then(data => {
            if (data.avatarUrl) {
                const img = document.getElementById('adminAvatarImg');
                if (img) img.src = data.avatarUrl;
            }
        })
        .catch(err => console.log(err));
});

function uploadAdminAvatar(input) {
    if (input.files && input.files[0]) {
        const formData = new FormData();
        formData.append('avatar', input.files[0]);

        fetch('/api/admin/avatar', {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const img = document.getElementById('adminAvatarImg');
                if (img) img.src = data.avatarUrl;
            } else {
                alert('Có lỗi xảy ra khi tải ảnh lên!');
            }
        })
        .catch(err => {
            console.error(err);
            alert('Lỗi mạng!');
        });
    }
}
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
                let statusColor = '#f59e0b'; // Pending
                if(order.status === 'Completed') statusColor = '#10b981';
                if(order.status === 'Confirmed') statusColor = '#3b82f6';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="text-align: center;"><input type="checkbox" class="order-checkbox" value="${order.id}" onchange="updateDeleteSelectedButton()"></td>
                    <td>#${order.id.substring(0, 8)}</td>
                    <td>${order.customerName}</td>
                    <td>${new Date(order.orderDate).toLocaleString('vi-VN')}</td>
                    <td><strong>${dinhDangTien(order.total)}</strong></td>
                    <td><span style="color: ${statusColor}; font-weight:bold;">${order.status}</span></td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="openOrderModal('${order.id}')"><i class="fas fa-eye"></i> Chi tiết</button>
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
                // For printing usage
                if(document.getElementById('modalOrderStatusText')) {
                    document.getElementById('modalOrderStatusText').textContent = order.status;
                }
                
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

let availableMenuMap = {};

function loadAvailableMenuForEditing() {
    const select = document.getElementById('availableMenuItems');
    if(!select) return;

    fetch('/api/menu')
        .then(res => res.json())
        .then(data => {
            availableMenuMap = {};
            select.innerHTML = '<option value="">-- Chọn món để thêm --</option>';
            data.forEach(m => {
                availableMenuMap[m.id] = m;
                const opt = document.createElement('option');
                opt.value = String(m.id);
                opt.textContent = `${m.ten} - ${dinhDangTien(m.gia)}`;
                select.appendChild(opt);
            });
        })
        .catch(err => console.error('Lỗi tải menu chỉnh sửa:', err));
}

function addItemToOrder() {
    if(!currentOrderInfo) return;
    const val = document.getElementById('availableMenuItems').value;
    if(!val) return;
    const menuObj = availableMenuMap[val];
    if(!menuObj) return;
    
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
    .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Không thể lưu thay đổi đơn hàng!');
        }
        return data;
    })
    .then(() => {
        alert('Lưu thay đổi thành công!');
        closeOrderModal();
        loadOrders();
    })
    .catch(err => {
        console.error(err);
        alert(err.message || 'Lỗi khi lưu đơn hàng!');
    });
}

function deleteOrder() {
    if(!currentOrderInfo) return;
    if(confirm('Bạn có chắc chắn muốn xoá đơn hàng này khỏi hệ thống?')) {
        fetch(`/api/admin/orders/${currentOrderInfo.id}`, { method: 'DELETE' })
        .then(async res => {
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || 'Không thể xoá đơn hàng!');
            }
            closeOrderModal();
            loadOrders();
        })
        .catch(err => {
            console.error(err);
            alert(err.message || 'Lỗi khi xoá đơn hàng!');
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

function toggleSelectAllOrders(source) {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
    updateDeleteSelectedButton();
}

function updateDeleteSelectedButton() {
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    const btn = document.getElementById('btnDeleteSelected');
    if (btn) {
        btn.style.display = checkboxes.length > 0 ? 'inline-block' : 'none';
    }
}

function deleteSelectedOrders() {
    const checked = document.querySelectorAll('.order-checkbox:checked');
    if (checked.length === 0) return;
    
    const ids = Array.from(checked).map(cb => cb.value);
    if (confirm(`Bạn có chắc chắn muốn xóa ${ids.length} đơn hàng đã chọn?`)) {
        fetch('/api/admin/orders/delete-multiple', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ids)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const selectAllBtn = document.getElementById('selectAllOrders');
                if(selectAllBtn) selectAllBtn.checked = false;
                updateDeleteSelectedButton();
                loadOrders();
            }
        });
    }
}

function deleteAllOrders() {
    if (confirm('Bạn có CỰC KỲ CHẮC CHẮN muốn xóa TẤT CẢ đơn hàng? Hành động này không thể hoàn tác!')) {
        fetch('/api/admin/orders', {
            method: 'DELETE'
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const selectAllBtn = document.getElementById('selectAllOrders');
                if(selectAllBtn) selectAllBtn.checked = false;
                updateDeleteSelectedButton();
                loadOrders();
            }
        });
    }
}

/* --- ADMIN MENU SCRIPTS --- */

let currentMenuData = [];

function loadMenu() {
    fetch('/api/menu')
        .then(res => res.json())
        .then(data => {
            currentMenuData = data;
            
            // Restore previous active tab filter if applicable
            const activeTab = document.querySelector('.tab-btn.active');
            let loai = 'tat_ca';
            if (activeTab && activeTab.dataset.loai) {
                loai = activeTab.dataset.loai;
            }
            if(loai === 'tat_ca') {
                renderMenuGrid(currentMenuData);
            } else {
                renderMenuGrid(currentMenuData.filter(m => m.loai === loai));
            }
        });
}

function filterMenu(loai, btnElement) {
    if(btnElement) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('btn-primary', 'active');
            btn.classList.add('btn-secondary');
        });
        btnElement.classList.remove('btn-secondary');
        btnElement.classList.add('btn-primary', 'active');
    }

    if(loai === 'tat_ca') {
        renderMenuGrid(currentMenuData);
    } else {
        const filtered = currentMenuData.filter(m => m.loai === loai);
        renderMenuGrid(filtered);
    }
}

function escapeAdminHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderMenuGrid(data) {
    const grid = document.getElementById('menuGrid');
    if(!grid) return;
    grid.innerHTML = '';
    data.forEach(item => {
        const safeName = escapeAdminHtml(item.ten);
        const safeImg = escapeAdminHtml(item.hinh || '');
        grid.innerHTML += `
                    <div class="menu-card">
                        <img src="${safeImg}" alt="${safeName}" onerror="this.src='https://via.placeholder.com/150'">
                        <h4>${safeName}</h4>
                        <p>${dinhDangTien(item.gia)}</p>
                        <div class="actions">
                            <button class="btn btn-secondary btn-sm" onclick="editMenuById(${item.id})"><i class="fas fa-edit"></i> Sửa</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteMenu(${item.id})"><i class="fas fa-trash"></i> Xoá</button>
                        </div>
                    </div>
                `;
    });
}

function editMenuById(id) {
    const item = currentMenuData.find(m => m.id === id);
    if (item) {
        editMenu(item);
    }
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
    document.getElementById('menuTen').value = item.ten || '';
    document.getElementById('menuGia').value = item.gia ?? 0;
    document.getElementById('menuLoai').value = item.loai || 'mon_chinh';
    document.getElementById('menuHinh').value = '';
    document.getElementById('modalMenuTitle').textContent = 'Sửa Món';
    
    const preview = document.getElementById('menuHinhPreview');
    if(item.hinh) {
        preview.src = item.hinh;
        preview.style.display = 'block';
    } else {
        preview.src = '';
        preview.style.display = 'none';
    }
    
    document.getElementById('menuModal').style.display = 'flex';
}

function saveMenu() {
    const id = document.getElementById('menuId').value;
    const ten = document.getElementById('menuTen').value.trim();
    const gia = document.getElementById('menuGia').value;
    const loai = document.getElementById('menuLoai').value;

    if (!ten || gia === '' || Number(gia) < 0) {
        alert('Vui lòng nhập đầy đủ tên món và giá hợp lệ (>= 0)!');
        return;
    }

    const formData = new FormData();
    formData.append('ten', ten);
    formData.append('gia', gia);
    formData.append('loai', loai);
    
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
    .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Lỗi lưu món!');
        }
        return data;
    })
    .then(() => {
        closeMenuModal();
        loadMenu();
    })
    .catch(err => {
        console.error(err);
        alert(err.message || 'Lỗi lưu món!');
    });
}

function deleteMenu(id) {
    if(confirm('Bạn có chắc xoá bản ghi món ăn này?')) {
        fetch(`/api/admin/menu/${id}`, { method: 'DELETE' })
        .then(async res => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Không thể xoá món ăn này!');
            }
            loadMenu();
        })
        .catch(err => {
            console.error(err);
            alert(err.message || 'Lỗi khi xoá món ăn!');
        });
    }
}
