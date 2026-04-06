/**
 * Optimized Shipped Machines Page
 */
'use strict';

let allMachines = [], searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => { initSearch(); loadShippedMachines(); });

function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');
    if (!searchInput || !clearBtn) return;

    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        clearBtn.classList.toggle('visible', this.value.length > 0);
        searchTimeout = setTimeout(() => performSearch(this.value.trim()), 250);
    });

    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); clearTimeout(searchTimeout); performSearch(this.value.trim()); }
    });

    clearBtn.addEventListener('click', function(e) {
        e.preventDefault();
        searchInput.value = '';
        searchInput.focus();
        this.classList.remove('visible');
        performSearch('');
    });

    searchInput.focus();
}

async function loadShippedMachines() {
    try {
        const response = await fetch('/api/drafts?status=shipped');
        const result = await response.json();
        
        if (result.success) {
            allMachines = result.drafts;
            displayMachines(allMachines);
            setTimeout(() => loadAllCustomerData(), 100);
        } else {
            showEmptyState('📦', 'Нет отгруженных станков', 'Станки со статусом "Отгружен" появятся здесь автоматически');
            allMachines = [];
        }
    } catch (error) { Utils.showStatus(`Ошибка загрузки: ${error.message}`, 'error'); }
}

async function loadAllCustomerData() {
    const shippedList = document.getElementById('shippedList');
    if (!shippedList) return;
    
    for (const el of shippedList.querySelectorAll('.draft-item')) {
        const draftId = el.dataset.draftId;
        if (draftId) {
            try {
                const response = await fetch(`/api/drafts/${draftId}/customer`);
                const result = await response.json();
                if (result.success) updateDraftCustomerDisplay(el, result.customer_data || {});
            } catch (error) { console.log(`Ошибка загрузки заказчика для ${draftId}:`, error); }
        }
    }
}

function performSearch(query) { displayMachines(query.trim() ? searchMachines(query) : allMachines); }

function searchMachines(query) {
    const q = query.toLowerCase().trim();
    return allMachines.filter(m => [m.display_name, m.machine_type, m.serial_number, m.customer, m.work_type].some(f => (f || '').toLowerCase().includes(q)));
}

function displayMachines(machines) {
    const shippedList = document.getElementById('shippedList');
    const noResults = document.getElementById('noResults');
    if (!shippedList || !noResults) return;

    if (machines.length > 0) {
        shippedList.innerHTML = '';
        const sorted = [...machines].sort((a, b) => {
            const numA = extractNumberFromSerial(a.serial_number);
            const numB = extractNumberFromSerial(b.serial_number);
            return (numA !== null && numB !== null) ? numB - numA : (b.serial_number || '').localeCompare(a.serial_number || '');
        });
        
        sorted.forEach(draft => shippedList.appendChild(createShippedElement(draft)));
        shippedList.style.display = 'grid';
        noResults.style.display = 'none';
    } else {
        shippedList.style.display = 'none';
        noResults.style.display = 'block';
    }
}

function extractNumberFromSerial(serial) {
    if (!serial) return null;
    const nums = serial.match(/\d+/g);
    if (!nums) return null;
    const num = parseInt(nums.join(''), 10);
    return isNaN(num) ? null : num;
}

function createShippedElement(draft) {
    const div = document.createElement('div');
    div.className = 'draft-item status-shipped clickable-draft';
    div.dataset.draftId = draft.id;

    div.innerHTML = `<div class="draft-info">
        <div class="info-item"><span class="info-label">Название:</span><span class="info-value draft-title">${Utils.escapeHtml(draft.display_name)}</span></div>
        <div class="info-item"><span class="info-label">Тип работы:</span><span class="info-value">${Utils.escapeHtml(draft.work_type)}</span></div>
        <div class="info-item"><span class="info-label">Заказчик:</span><span class="info-value customer-value" id="customer-${draft.id}">${Utils.escapeHtml(draft.customer || 'Не указан')}</span></div>
    </div>`;

    div.addEventListener('click', (e) => {
        if (!e.target.classList.contains('customer-value')) window.location.href = `/view-machine.html?id=${draft.id}`;
    });
    return div;
}

function updateDraftCustomerDisplay(el, data) {
    const customerEl = el.querySelector('.customer-value');
    if (!customerEl) return;

    if (data && data.customerName) customerEl.textContent = data.customerName;
    customerEl.classList.remove('customer-clickable', 'customer-has-info');
    customerEl.onclick = null;
    customerEl.style.cursor = 'default';

    if (data && (data.productionAddress || data.hotelName || data.contactPerson || data.contactPhone)) {
        customerEl.classList.add('customer-has-info');
        let tooltip = data.customerName || customerEl.textContent;
        if (data.productionAddress) tooltip += `\n🏭 ${data.productionAddress}`;
        if (data.hotelName) { tooltip += `\n🏨 ${data.hotelName}`; if (data.hotelAddress) tooltip += ` (${data.hotelAddress})`; }
        if (data.contactPerson) tooltip += `\n👤 ${data.contactPerson}`;
        if (data.contactPhone) tooltip += `\n📞 ${data.contactPhone}`;
        if (data.contactEmail) tooltip += `\n📧 ${data.contactEmail}`;
        customerEl.title = tooltip;
    } else { customerEl.title = ''; }
}

function showEmptyState(icon, title, message) {
    const shippedList = document.getElementById('shippedList');
    if (shippedList) {
        shippedList.innerHTML = `<div class="empty-state"><div class="icon">${icon}</div><h3>${Utils.escapeHtml(title)}</h3><p>${Utils.escapeHtml(message)}</p></div>`;
        shippedList.style.display = 'block';
    }
}

window.clearSearch = function() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');
    if (searchInput) { searchInput.value = ''; searchInput.focus(); searchInput.dispatchEvent(new Event('input')); }
    if (clearBtn) clearBtn.classList.remove('visible');
};
