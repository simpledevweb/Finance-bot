/**
 * Finance Money Manager - Web Dashboard Application
 * 100% Serverless, Netlify Ready, Offline-first JSON Store
 */

// ==================== STORAGE & DATABASE ====================
const DB_KEY = 'finance_money_manager_db';

const defaultDatabase = {
    settings: {
        userName: 'Alpamis Ibraymov',
        currency: 'UZS',
        pinEnabled: false,
        pinCode: '1904',
        privacyHidden: false
    },
    accounts: [],
    categories: {
        expense: [
            { id: 'cat_food', name: 'Oziq-ovqat & Bozor', icon: '🍔' },
            { id: 'cat_transport', name: 'Transport & Yoqilg\'i', icon: '🚕' },
            { id: 'cat_shopping', name: 'Xaridlar & Kiyim', icon: '🛍️' },
            { id: 'cat_home', name: 'Kommunal & Uy', icon: '🏠' },
            { id: 'cat_health', name: 'Salomatlik & Dori', icon: '💊' },
            { id: 'cat_fun', name: 'Ko\'ngilochar & Kafe', icon: '🍿' },
            { id: 'cat_other_exp', name: 'Boshqa xarajatlar', icon: '📦' }
        ],
        income: [
            { id: 'cat_salary', name: 'Oylik Maosh', icon: '💰' },
            { id: 'cat_business', name: 'Biznes / Savdo', icon: '📈' },
            { id: 'cat_cashback', name: 'Keshbek & Sovg\'a', icon: '🎁' },
            { id: 'cat_deposit_int', name: 'Omonat Foizi', icon: '🏦' },
            { id: 'cat_other_inc', name: 'Boshqa daromad', icon: '💵' }
        ]
    },
    transactions: []
};

// Global DB
let db = loadDatabase();
let currentTxType = 'expense';
let inputPinBuffer = '';
let dashboardBarChart = null;
let dashboardPieChart = null;
let analyticsBarChart = null;
let analyticsPieChart = null;
let currentAccFilter = 'all';
let onConfirmCallbackFunction = null;
let isLocalServerConnected = false;

function loadDatabase() {
    try {
        const saved = localStorage.getItem(DB_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error('Error reading localStorage', e);
    }
    saveDatabase(defaultDatabase);
    return JSON.parse(JSON.stringify(defaultDatabase));
}

function getApiEndpoint() {
    if (window.location.protocol === 'file:') {
        return 'http://localhost:8080/api/db';
    }
    return '/api/db';
}

async function syncWithLocalFileServer() {
    try {
        const endpoint = getApiEndpoint();
        const res = await fetch(endpoint);
        if (res.ok) {
            const data = await res.json();
            isLocalServerConnected = true;
            
            // If local server database.json already has data, load it
            if (data && Array.isArray(data.accounts) && (data.accounts.length > 0 || data.transactions.length > 0)) {
                db = data;
                localStorage.setItem(DB_KEY, JSON.stringify(db));
            } else if (db.accounts.length > 0 || db.transactions.length > 0) {
                // If database.json was empty but browser has existing data, auto-save to database.json!
                await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(db, null, 2)
                });
                console.log('Migrated existing browser data into database.json');
            }

            const statusPill = document.querySelector('.user-status-pill');
            if (statusPill) {
                statusPill.textContent = '● database.json (Faylda Faol)';
                statusPill.style.color = 'var(--success)';
            }
            updateUserSettingsUI();
            renderAll();
            console.log('✅ Real-time linked to local database.json');
        }
    } catch (err) {
        console.log('Running in browser standalone mode');
    }
}

let fileHandle = null;

async function linkLocalDatabaseFile() {
    if (!('showOpenFilePicker' in window)) {
        showToast('start.bat fayli orqali ishga tushiring');
        return;
    }
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
        });
        if (handle) {
            fileHandle = handle;
            // Write current app data directly into database.json immediately!
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(db, null, 2));
            await writable.close();

            const statusPill = document.querySelector('.user-status-pill');
            if (statusPill) {
                statusPill.textContent = '● ' + fileHandle.name + ' (Jonli Bog\'langan)';
                statusPill.style.color = 'var(--success)';
            }
            showToast('✅ ' + fileHandle.name + ' yangilandi va jonli ulandi!');
        }
    } catch (err) {
        console.log('File picker dismissed', err);
    }
}

function saveDatabase(dataToSave) {
    const data = dataToSave || db;
    // 1. Save to browser cache
    localStorage.setItem(DB_KEY, JSON.stringify(data));

    // 2. Real-time write directly to ./database.json via local server
    const endpoint = getApiEndpoint();
    fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data, null, 2)
    }).then(res => {
        if (res.ok && !isLocalServerConnected) {
            isLocalServerConnected = true;
            const statusPill = document.querySelector('.user-status-pill');
            if (statusPill) {
                statusPill.textContent = '● database.json (Faylda Faol)';
                statusPill.style.color = 'var(--success)';
            }
        }
    }).catch(() => {});

    // 3. Real-time write directly to connected file handle (File System API)
    if (fileHandle) {
        fileHandle.createWritable().then(writable => {
            writable.write(JSON.stringify(data, null, 2)).then(() => writable.close());
        }).catch(err => console.error('Error writing fileHandle:', err));
    }
}

// ==================== FORMATTERS ====================
function formatMoney(amount, hidePrivacy = false) {
    if (hidePrivacy && db.settings.privacyHidden) {
        return '•••••• ' + db.settings.currency;
    }
    const num = Number(amount) || 0;
    const formatted = num.toLocaleString('uz-UZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return `${formatted} ${db.settings.currency}`;
}

function formatDateDisplay(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    const timeStr = date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
        return `Bugun, ${timeStr}`;
    }
    const dayStr = date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${dayStr}, ${timeStr}`;
}

function showToast(msg) {
    const toast = document.getElementById('toastMessage');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2800);
}

// ==================== CUSTOM CONFIRMATION MODAL ====================
function showCustomConfirm(title, message, icon = '🗑️', onConfirm, isDanger = true) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmIcon').textContent = icon;
    
    const okBtn = document.getElementById('confirmOkBtn');
    okBtn.className = isDanger ? 'btn-danger' : 'btn-primary';
    okBtn.textContent = isDanger ? 'Ha, o\'chirish' : 'Tasdiqlash';

    onConfirmCallbackFunction = onConfirm;
    okBtn.onclick = () => {
        if (typeof onConfirmCallbackFunction === 'function') {
            onConfirmCallbackFunction();
        }
        closeConfirmModal();
    };

    document.getElementById('confirmModal').style.display = 'flex';
}

function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
    onConfirmCallbackFunction = null;
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    // PIN check
    if (db.settings.pinEnabled) {
        document.getElementById('pinLockScreen').style.display = 'flex';
    }

    // Clean up any old service worker caches to prevent outdated mobile views
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) {
                registration.unregister();
            }
        });
        if ('caches' in window) {
            caches.keys().then(names => {
                for (let name of names) caches.delete(name);
            });
        }
    }

    updateUserSettingsUI();
    renderAll();
    resetTxDateInput();
    syncWithLocalFileServer();
});

function updateUserSettingsUI() {
    const name = db.settings.userName || 'Alpamis Ibraymov';
    document.getElementById('sidebarUserName').textContent = name;
    document.getElementById('settingUserName').value = name;
    document.getElementById('settingCurrency').value = db.settings.currency || 'UZS';
    document.getElementById('settingPinEnabled').checked = !!db.settings.pinEnabled;
    document.getElementById('pinChangeRow').style.display = db.settings.pinEnabled ? 'flex' : 'none';

    document.querySelectorAll('.currency-label').forEach(el => {
        el.textContent = db.settings.currency;
    });

    updatePrivacyEyeIcon();
}

function resetTxDateInput() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const isoLocal = now.toISOString().slice(0, 16);
    const dateInput = document.getElementById('txDateTime');
    if (dateInput) dateInput.value = isoLocal;
}

// ==================== RENDER ALL ====================
function renderAll() {
    renderDashboard();
    renderAccounts();
    renderTransactionsHistory();
    renderSalaryView();
    populateSelectOptions();
    updateCharts();
}

function renderDashboard() {
    // 1. Metric Cards
    let totalNet = 0;
    let totalDeposit = 0;

    db.accounts.forEach(acc => {
        const bal = Number(acc.balance) || 0;
        totalNet += bal;
        if (acc.type === 'deposit') {
            totalDeposit += bal;
        }
    });

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let monthInc = 0;
    let monthExp = 0;

    db.transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
            if (tx.type === 'income') monthInc += Number(tx.amount);
            if (tx.type === 'expense') monthExp += Number(tx.amount);
        }
    });

    document.getElementById('totalNetWorth').textContent = formatMoney(totalNet, true);
    document.getElementById('monthIncomeText').textContent = '+' + formatMoney(monthInc, true);
    document.getElementById('monthExpenseText').textContent = '-' + formatMoney(monthExp, true);
    document.getElementById('totalDepositBalance').textContent = formatMoney(totalDeposit, true);
    document.getElementById('badgeAccountsCount').textContent = db.accounts.length;

    // 2. Dashboard Side Accounts List
    const sideList = document.getElementById('dashboardAccountsList');
    sideList.innerHTML = '';

    if (db.accounts.length === 0) {
        sideList.innerHTML = `
            <div style="text-align:center; padding:24px 10px; color:var(--text-muted);">
                <div style="font-size:32px; margin-bottom:8px;">💳</div>
                <div>Hisoblar mavjud emas</div>
                <button class="btn-primary btn-primary-sm" style="margin-top:10px;" onclick="openAddAccountModal()">+ Yangi Hisob Qo'shish</button>
            </div>
        `;
    } else {
        db.accounts.forEach(acc => {
            const item = document.createElement('div');
            item.className = 'acc-side-item';
            item.onclick = () => switchTab('tab-accounts');

            const icon = acc.type === 'card' ? '💳' : (acc.type === 'cash' ? '💵' : '🏦');
            const typeLabel = acc.type === 'card' ? 'Karta' : (acc.type === 'cash' ? 'Naqd' : 'Omonat');
            const colorClass = acc.color || 'blue';

            item.innerHTML = `
                <div class="acc-side-left">
                    <div class="acc-color-dot ${colorClass}">${icon}</div>
                    <div>
                        <div class="acc-side-title">${acc.name}</div>
                        <div class="acc-side-type">${typeLabel}</div>
                    </div>
                </div>
                <div class="acc-side-balance">${formatMoney(acc.balance, true)}</div>
            `;
            sideList.appendChild(item);
        });
    }

    // 3. Dashboard Recent Transactions Table (Last 6)
    const tableBody = document.getElementById('dashboardTransactionsTable');
    tableBody.innerHTML = '';

    const sorted = [...db.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = sorted.slice(0, 6);

    if (recent.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:35px; color:var(--text-muted);">
                    <div style="font-size:30px; margin-bottom:8px;">🕒</div>
                    <div>Hozircha hech qanday operatsiya kiritilmagan</div>
                </td>
            </tr>
        `;
    } else {
        recent.forEach(tx => {
            tableBody.appendChild(createTableRow(tx));
        });
    }
}

function getAccountDisplayName(accId, fallbackName) {
    if (!accId && !fallbackName) return 'Hisob';
    const acc = db.accounts.find(a => a.id === accId);
    if (acc) return acc.name;
    if (fallbackName) return `${fallbackName} (O'chirilgan)`;
    return "O'chirilgan hisob";
}

function createTableRow(tx, isFullTable = false) {
    const tr = document.createElement('tr');

    let typeBadge = '';
    let catOrTitle = '';
    let accInfo = '';
    let amountFormatted = '';

    if (tx.type === 'income') {
        const cat = db.categories.income.find(c => c.id === tx.categoryId);
        const accName = getAccountDisplayName(tx.accountId, tx.accountName);
        typeBadge = '<span class="table-type-pill income">➕ Kirim</span>';
        catOrTitle = `${cat ? cat.icon + ' ' + cat.name : 'Daromad'}`;
        accInfo = `<span class="table-acc-badge">${accName}</span>`;
        amountFormatted = `<span class="table-amount income">+${formatMoney(tx.amount)}</span>`;
    } else if (tx.type === 'expense') {
        const cat = db.categories.expense.find(c => c.id === tx.categoryId);
        const accName = getAccountDisplayName(tx.accountId, tx.accountName);
        typeBadge = '<span class="table-type-pill expense">➖ Chiqim</span>';
        catOrTitle = `${cat ? cat.icon + ' ' + cat.name : 'Xarajat'}`;
        accInfo = `<span class="table-acc-badge">${accName}</span>`;
        amountFormatted = `<span class="table-amount expense">-${formatMoney(tx.amount)}</span>`;
    } else if (tx.type === 'transfer') {
        const fromName = getAccountDisplayName(tx.fromAccountId, tx.fromAccountName);
        const toName = getAccountDisplayName(tx.toAccountId, tx.toAccountName);
        typeBadge = '<span class="table-type-pill transfer">⇄ O\'tkazma</span>';
        catOrTitle = 'Hisoblararo ko\'chirish';
        accInfo = `<span class="table-acc-badge">${fromName} → ${toName}</span>`;
        amountFormatted = `<span class="table-amount transfer">⇄ ${formatMoney(tx.amount)}</span>`;
    } else if (tx.type === 'deposit') {
        const fromName = getAccountDisplayName(tx.fromAccountId, tx.fromAccountName);
        const toName = getAccountDisplayName(tx.toAccountId, tx.toAccountName);
        typeBadge = '<span class="table-type-pill deposit">🏦 Omonat</span>';
        if (tx.depositSubtype === 'topup') {
            catOrTitle = 'Omonatni to\'ldirish';
            accInfo = `<span class="table-acc-badge">${fromName} → ${toName}</span>`;
            amountFormatted = `<span class="table-amount deposit">+ ${formatMoney(tx.amount)}</span>`;
        } else if (tx.depositSubtype === 'withdraw') {
            catOrTitle = 'Omonatdan yechish';
            accInfo = `<span class="table-acc-badge">${fromName} → ${toName}</span>`;
            amountFormatted = `<span class="table-amount deposit">- ${formatMoney(tx.amount)}</span>`;
        } else {
            catOrTitle = 'Omonat foiz daromadi';
            accInfo = `<span class="table-acc-badge">${toName}</span>`;
            amountFormatted = `<span class="table-amount income">+ ${formatMoney(tx.amount)}</span>`;
        }
    }

    const commentText = tx.comment ? `<small class="text-muted d-block">${tx.comment}</small>` : '';

    if (isFullTable) {
        tr.innerHTML = `
            <td>${typeBadge}</td>
            <td><strong>${catOrTitle}</strong></td>
            <td>${accInfo}</td>
            <td>${tx.comment || '<span class="text-dim">-</span>'}</td>
            <td><small class="text-muted">${formatDateDisplay(tx.date)}</small></td>
            <td class="text-right">${amountFormatted}</td>
            <td class="text-center">
                <div class="table-actions-cell">
                    <button class="btn-table-edit" onclick="openEditTransactionModal('${tx.id}')" title="Tahrirlash">✏️</button>
                    <button class="btn-table-del" onclick="confirmDeleteTransaction('${tx.id}')" title="O'chirish">🗑️</button>
                </div>
            </td>
        `;
    } else {
        tr.innerHTML = `
            <td>${typeBadge}</td>
            <td><strong>${catOrTitle}</strong>${commentText}</td>
            <td>${accInfo}</td>
            <td><small class="text-muted">${formatDateDisplay(tx.date)}</small></td>
            <td class="text-right">${amountFormatted}</td>
            <td class="text-center">
                <div class="table-actions-cell">
                    <button class="btn-table-edit" onclick="openEditTransactionModal('${tx.id}')" title="Tahrirlash">✏️</button>
                    <button class="btn-table-del" onclick="confirmDeleteTransaction('${tx.id}')" title="O'chirish">🗑️</button>
                </div>
            </td>
        `;
    }

    return tr;
}

// ==================== TAB 2: FULL ACCOUNTS WEB GRID ====================
function renderAccounts() {
    const grid = document.getElementById('fullAccountsList');
    grid.innerHTML = '';

    const filtered = currentAccFilter === 'all' 
        ? db.accounts 
        : db.accounts.filter(a => a.type === currentAccFilter);

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: span 3; text-align:center; padding:50px 20px; color:var(--text-muted); background:var(--bg-card); border:1px dashed var(--border-color); border-radius:var(--radius-lg);">
                <div style="font-size:40px; margin-bottom:12px;">💳</div>
                <h3>Hozircha hech qanday hisob mavjud emas</h3>
                <p style="margin-top:6px; font-size:13px;">Daromad va xarajatlarni hisoblash uchun birinchi bank kartangiz yoki naqd pul hamyoningizni qo'shing.</p>
                <button class="btn-primary" style="margin-top:16px;" onclick="openAddAccountModal()">➕ Yangi Hisob Qo'shish</button>
            </div>
        `;
        return;
    }

    filtered.forEach(acc => {
        const card = document.createElement('div');
        card.className = 'account-web-card';

        const icon = acc.type === 'card' ? '💳' : (acc.type === 'cash' ? '💵' : '🏦');
        const colorClass = acc.color || 'blue';
        let typeName = acc.type === 'card' ? 'Bank Kartasi' : (acc.type === 'cash' ? 'Naqd Pul' : `Omonat Jamg'armasi`);
        let metaExtra = acc.type === 'deposit' ? `Stavka: ${acc.rate || 0}% yillik (${acc.months || 12} oy)` : '';

        card.innerHTML = `
            <div>
                <div class="acc-web-top">
                    <div class="acc-icon-square ${colorClass}">${icon}</div>
                    <span class="table-type-pill ${acc.type}">${typeName}</span>
                </div>
                <div class="acc-web-card-name">${acc.name}</div>
                <div class="acc-web-card-type">${metaExtra}</div>
            </div>
            <div>
                <div class="acc-web-card-balance">${formatMoney(acc.balance, true)}</div>
                <div class="acc-web-card-footer">
                    <button class="btn-secondary btn-primary-sm" onclick="editAccount('${acc.id}')">✏️ Tahrirlash</button>
                    <button class="btn-table-del" onclick="deleteAccount('${acc.id}')" title="O'chirish">🗑️ O'chirish</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function filterAccountView(type, btnEl) {
    currentAccFilter = type;
    document.querySelectorAll('.acc-filter-tab').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    renderAccounts();
}

function openAddAccountModal() {
    document.getElementById('accountModalTitle').textContent = 'Yangi Hisob Qo\'shish';
    document.getElementById('accEditId').value = '';
    document.getElementById('accName').value = '';
    document.getElementById('accBalance').value = '';
    document.getElementById('accType').value = 'card';
    document.getElementById('depositExtraFields').style.display = 'none';
    document.getElementById('accountModal').style.display = 'flex';
}

function editAccount(id) {
    const acc = db.accounts.find(a => a.id === id);
    if (!acc) return;

    document.getElementById('accountModalTitle').textContent = 'Hisobni Tahrirlash';
    document.getElementById('accEditId').value = acc.id;
    document.getElementById('accName').value = acc.name;
    document.getElementById('accBalance').value = acc.balance;
    document.getElementById('accType').value = acc.type;
    
    if (acc.type === 'deposit') {
        document.getElementById('depositExtraFields').style.display = 'block';
        document.getElementById('accDepositRate').value = acc.rate || '';
        document.getElementById('accDepositMonths').value = acc.months || '';
    } else {
        document.getElementById('depositExtraFields').style.display = 'none';
    }

    const radio = document.querySelector(`input[name="accColor"][value="${acc.color || 'blue'}"]`);
    if (radio) radio.checked = true;

    document.getElementById('accountModal').style.display = 'flex';
}

function closeAccountModal() {
    document.getElementById('accountModal').style.display = 'none';
}

function onAccTypeChange() {
    const type = document.getElementById('accType').value;
    document.getElementById('depositExtraFields').style.display = type === 'deposit' ? 'block' : 'none';
}

function saveAccount(e) {
    e.preventDefault();
    const editId = document.getElementById('accEditId').value;
    const name = document.getElementById('accName').value.trim();
    const balance = parseFloat(document.getElementById('accBalance').value) || 0;
    const type = document.getElementById('accType').value;
    const color = document.querySelector('input[name="accColor"]:checked')?.value || 'blue';
    const rate = parseFloat(document.getElementById('accDepositRate').value) || 0;
    const months = parseInt(document.getElementById('accDepositMonths').value) || 0;

    if (!name) {
        showToast('Iltimos, hisob nomini kiriting');
        return;
    }

    if (editId) {
        const acc = db.accounts.find(a => a.id === editId);
        if (acc) {
            acc.name = name;
            acc.balance = balance;
            acc.type = type;
            acc.color = color;
            if (type === 'deposit') {
                acc.rate = rate;
                acc.months = months;
            }
            // Update historical transaction snapshots with updated account name
            db.transactions.forEach(t => {
                if (t.accountId === editId) t.accountName = name;
                if (t.fromAccountId === editId) t.fromAccountName = name;
                if (t.toAccountId === editId) t.toAccountName = name;
            });
            showToast('Hisob muvaffaqiyatli yangilandi');
        }
    } else {
        const newAcc = {
            id: 'acc_' + Date.now(),
            name,
            balance,
            type,
            color,
            rate: type === 'deposit' ? rate : undefined,
            months: type === 'deposit' ? months : undefined
        };
        db.accounts.push(newAcc);
        showToast('Yangi hisob qo\'shildi');
    }

    saveDatabase();
    closeAccountModal();
    renderAll();
}

function deleteAccount(id) {
    const acc = db.accounts.find(a => a.id === id);
    if (!acc) return;

    showCustomConfirm(
        'Hisobni o\'chirish',
        `"${acc.name}" hisobini o'chirmoqchimisiz? Tarixdagi barcha operatsiyalar yo'qolmaydi va "${acc.name}" nomi bilan xavfsiz saqlanib qoladi.`,
        '💳',
        () => {
            // Preserve snapshot of account name on all associated transactions
            db.transactions.forEach(t => {
                if (t.accountId === id && !t.accountName) t.accountName = acc.name;
                if (t.fromAccountId === id && !t.fromAccountName) t.fromAccountName = acc.name;
                if (t.toAccountId === id && !t.toAccountName) t.toAccountName = acc.name;
            });

            db.accounts = db.accounts.filter(a => a.id !== id);
            saveDatabase();
            showToast(`"${acc.name}" hisobi o'chirildi, ammo operatsiyalar tarixi saqlab qolindi!`);
            renderAll();
        }
    );
}

// ==================== TAB 3: HISTORY & ADVANCED FILTER ====================
function renderTransactionsHistory() {
    applyFilters();
}

function onDateInputFilter() {
    // When date inputs are manually selected, reset period select to 'all' or keep it custom
    document.getElementById('filterPeriod').value = 'all';
    applyFilters();
}

function onPeriodChange() {
    const period = document.getElementById('filterPeriod').value;
    const now = new Date();
    const startInput = document.getElementById('filterStartDate');
    const endInput = document.getElementById('filterEndDate');

    const toDateInputString = (date) => {
        const d = new Date(date);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
    };

    if (period === 'all') {
        startInput.value = '';
        endInput.value = '';
    } else if (period === 'today') {
        startInput.value = toDateInputString(now);
        endInput.value = toDateInputString(now);
    } else if (period === 'yesterday') {
        const yest = new Date(now);
        yest.setDate(yest.getDate() - 1);
        startInput.value = toDateInputString(yest);
        endInput.value = toDateInputString(yest);
    } else if (period === 'this_week') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startInput.value = toDateInputString(startOfWeek);
        endInput.value = toDateInputString(now);
    } else if (period === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startInput.value = toDateInputString(startOfMonth);
        endInput.value = toDateInputString(now);
    } else if (period === 'this_year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        startInput.value = toDateInputString(startOfYear);
        endInput.value = toDateInputString(now);
    }

    applyFilters();
}

function resetAllFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    document.getElementById('filterPeriod').value = 'all';
    document.getElementById('filterType').value = 'all';
    document.getElementById('filterAccount').value = 'all';
    document.getElementById('filterCategory').value = 'all';
    applyFilters();
    showToast('Barcha filtrlar tozalandi');
}

function applyFilters() {
    const query = (document.getElementById('searchInput').value || '').toLowerCase().trim();
    const type = document.getElementById('filterType').value;
    const accId = document.getElementById('filterAccount').value;
    const catId = document.getElementById('filterCategory').value;
    const startDateVal = document.getElementById('filterStartDate').value;
    const endDateVal = document.getElementById('filterEndDate').value;

    let filtered = [...db.transactions];

    // 1. Text Search Filter
    if (query) {
        filtered = filtered.filter(tx => {
            const commentMatch = (tx.comment || '').toLowerCase().includes(query);
            const amountMatch = tx.amount.toString().includes(query);
            const accNameMatch = (tx.accountName || '').toLowerCase().includes(query) ||
                                 (tx.fromAccountName || '').toLowerCase().includes(query) ||
                                 (tx.toAccountName || '').toLowerCase().includes(query);
            let catName = '';
            if (tx.categoryId) {
                const cat = db.categories.expense.concat(db.categories.income).find(c => c.id === tx.categoryId);
                if (cat) catName = cat.name.toLowerCase();
            }
            return commentMatch || amountMatch || accNameMatch || catName.includes(query);
        });
    }

    // 2. Type Filter (including Faqat Oylik Maosh)
    if (type === 'salary') {
        filtered = filtered.filter(tx => tx.type === 'income' && (tx.categoryId === 'cat_salary' || (tx.comment && tx.comment.toLowerCase().includes('maosh'))));
    } else if (type !== 'all') {
        filtered = filtered.filter(tx => tx.type === type);
    }

    // 3. Account Filter
    if (accId !== 'all') {
        filtered = filtered.filter(tx => tx.accountId === accId || tx.fromAccountId === accId || tx.toAccountId === accId);
    }

    // 4. Category Filter
    if (catId !== 'all') {
        filtered = filtered.filter(tx => tx.categoryId === catId);
    }

    // 5. Direct FROM (Dan) & TO (Gacha) Date Filter
    if (startDateVal) {
        const start = new Date(startDateVal);
        start.setHours(0, 0, 0, 0);
        filtered = filtered.filter(tx => new Date(tx.date) >= start);
    }
    if (endDateVal) {
        const end = new Date(endDateVal);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(tx => new Date(tx.date) <= end);
    }

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    let totalInc = 0;
    let totalExp = 0;
    filtered.forEach(tx => {
        if (tx.type === 'income') totalInc += Number(tx.amount);
        if (tx.type === 'expense') totalExp += Number(tx.amount);
    });

    document.getElementById('filteredCount').textContent = `${filtered.length} ta`;
    document.getElementById('filteredIncome').textContent = '+' + formatMoney(totalInc);
    document.getElementById('filteredExpense').textContent = '-' + formatMoney(totalExp);

    const fullTableBody = document.getElementById('fullHistoryTableBody');
    fullTableBody.innerHTML = '';

    if (filtered.length === 0) {
        fullTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px; color:var(--text-muted);">Qidiruv bo\'yicha operatsiyalar topilmadi</td></tr>';
        return;
    }

    filtered.forEach(tx => {
        fullTableBody.appendChild(createTableRow(tx, true));
    });
}

function confirmDeleteTransaction(txId) {
    const tx = db.transactions.find(t => t.id === txId);
    if (!tx) return;

    showCustomConfirm(
        'Operatsiyani o\'chirish',
        'Ushbu operatsiyani o\'chirmoqchimisiz? Tegishli hisob balansi avtomatik tiklanadi.',
        '🗑️',
        () => {
            rollbackTransactionImpact(tx);
            db.transactions = db.transactions.filter(t => t.id !== txId);
            saveDatabase();
            showToast('Operatsiya o\'chirildi va balans tiklandi');
            renderAll();
        }
    );
}

function rollbackTransactionImpact(tx) {
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'income') {
        const acc = db.accounts.find(a => a.id === tx.accountId);
        if (acc) acc.balance -= amount;
    } else if (tx.type === 'expense') {
        const acc = db.accounts.find(a => a.id === tx.accountId);
        if (acc) acc.balance += amount;
    } else if (tx.type === 'transfer') {
        const fromAcc = db.accounts.find(a => a.id === tx.fromAccountId);
        const toAcc = db.accounts.find(a => a.id === tx.toAccountId);
        if (fromAcc) fromAcc.balance += amount;
        if (toAcc) toAcc.balance -= amount;
    } else if (tx.type === 'deposit') {
        const fromAcc = db.accounts.find(a => a.id === tx.fromAccountId);
        const toAcc = db.accounts.find(a => a.id === tx.toAccountId);
        if (tx.depositSubtype === 'topup') {
            if (fromAcc) fromAcc.balance += amount;
            if (toAcc) toAcc.balance -= amount;
        } else if (tx.depositSubtype === 'withdraw') {
            if (fromAcc) fromAcc.balance += amount;
            if (toAcc) toAcc.balance -= amount;
        } else if (tx.depositSubtype === 'interest') {
            if (toAcc) toAcc.balance -= amount;
        }
    }
}

// ==================== TRANSACTION MODAL & SAVE / EDIT ====================
function openTransactionModal(type = 'expense') {
    if (db.accounts.length === 0) {
        showToast('Iltimos, avval bitta hisob (karta yoki naqd pul) qo\'shing');
        openAddAccountModal();
        return;
    }

    document.getElementById('txId').value = '';
    document.getElementById('txModalTitle').textContent = 'Yangi Operatsiya';
    setTxType(type);
    resetTxDateInput();
    document.getElementById('txAmount').value = '';
    document.getElementById('txComment').value = '';
    document.getElementById('txModal').style.display = 'flex';
}

function openEditTransactionModal(id) {
    const tx = db.transactions.find(t => t.id === id);
    if (!tx) return showToast('Operatsiya topilmadi');

    document.getElementById('txId').value = tx.id;
    document.getElementById('txModalTitle').textContent = 'Operatsiyani Tahrirlash';

    setTxType(tx.type);

    document.getElementById('txAmount').value = tx.amount;

    if (tx.date) {
        const d = new Date(tx.date);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        document.getElementById('txDateTime').value = d.toISOString().slice(0, 16);
    }

    document.getElementById('txComment').value = tx.comment || '';

    if (tx.type === 'income' || tx.type === 'expense') {
        if (tx.accountId) document.getElementById('txAccount').value = tx.accountId;
        if (tx.categoryId) document.getElementById('txCategory').value = tx.categoryId;
    } else if (tx.type === 'transfer') {
        if (tx.fromAccountId) document.getElementById('txFromAccount').value = tx.fromAccountId;
        if (tx.toAccountId) document.getElementById('txToAccount').value = tx.toAccountId;
    } else if (tx.type === 'deposit') {
        if (tx.depositSubtype) {
            document.getElementById('txDepositSubtype').value = tx.depositSubtype;
            onDepositSubtypeChange();
        }
        if (tx.depositSubtype === 'interest') {
            if (tx.toAccountId) document.getElementById('txAccount').value = tx.toAccountId;
        } else {
            if (tx.fromAccountId) document.getElementById('txFromAccount').value = tx.fromAccountId;
            if (tx.toAccountId) document.getElementById('txToAccount').value = tx.toAccountId;
        }
    }

    document.getElementById('txModal').style.display = 'flex';
}

function closeTxModal() {
    document.getElementById('txModal').style.display = 'none';
}

function setTxType(type) {
    currentTxType = type;

    ['expense', 'income', 'transfer', 'deposit'].forEach(t => {
        const btn = document.getElementById('btnType' + t.charAt(0).toUpperCase() + t.slice(1));
        if (btn) btn.classList.toggle('active', t === type);
    });

    const groupSingle = document.getElementById('groupSingleAccount');
    const groupTransfer = document.getElementById('groupTransferAccounts');
    const groupDeposit = document.getElementById('groupDepositSubtype');
    const groupCategory = document.getElementById('groupCategory');

    if (type === 'income' || type === 'expense') {
        groupSingle.style.display = 'block';
        groupTransfer.style.display = 'none';
        groupDeposit.style.display = 'none';
        groupCategory.style.display = 'block';
        document.getElementById('lblSingleAccount').textContent = type === 'income' ? 'Qaysi hisobga tushdi:' : 'Qaysi hisobdan chiqdi:';
        populateCategoriesForType(type);
    } else if (type === 'transfer') {
        groupSingle.style.display = 'none';
        groupTransfer.style.display = 'block';
        groupDeposit.style.display = 'none';
        groupCategory.style.display = 'none';
    } else if (type === 'deposit') {
        groupSingle.style.display = 'none';
        groupTransfer.style.display = 'block';
        groupDeposit.style.display = 'block';
        groupCategory.style.display = 'none';
        onDepositSubtypeChange();
    }
}

function onDepositSubtypeChange() {
    const sub = document.getElementById('txDepositSubtype').value;
    const groupTransfer = document.getElementById('groupTransferAccounts');
    
    if (sub === 'interest') {
        groupTransfer.style.display = 'none';
        document.getElementById('groupSingleAccount').style.display = 'block';
        document.getElementById('lblSingleAccount').textContent = 'Qaysi omonat hisobiga foiz qo\'shilsin:';
        
        const sel = document.getElementById('txAccount');
        sel.innerHTML = '';
        db.accounts.filter(a => a.type === 'deposit').forEach(a => {
            sel.appendChild(new Option(`${a.name} (${formatMoney(a.balance)})`, a.id));
        });
    } else {
        groupTransfer.style.display = 'block';
        document.getElementById('groupSingleAccount').style.display = 'none';
        populateTransferAccounts(sub);
    }
}

function populateSelectOptions() {
    const filterAcc = document.getElementById('filterAccount');
    if (filterAcc) {
        filterAcc.innerHTML = '<option value="all">Barcha hisoblar</option>';
        db.accounts.forEach(a => {
            filterAcc.appendChild(new Option(`${a.name} (${formatMoney(a.balance)})`, a.id));
        });
    }

    const salaryAccFilter = document.getElementById('salaryAccountFilter');
    if (salaryAccFilter) {
        salaryAccFilter.innerHTML = '<option value="all">Barcha hisoblar</option>';
        db.accounts.forEach(a => {
            salaryAccFilter.appendChild(new Option(`${a.name} (${formatMoney(a.balance)})`, a.id));
        });
    }

    const filterCat = document.getElementById('filterCategory');
    if (filterCat) {
        filterCat.innerHTML = '<option value="all">Barcha kategoriyalar</option>';
        db.categories.expense.concat(db.categories.income).forEach(c => {
            filterCat.appendChild(new Option(`${c.icon} ${c.name}`, c.id));
        });
    }

    const txAcc = document.getElementById('txAccount');
    if (txAcc) {
        txAcc.innerHTML = '';
        db.accounts.forEach(a => {
            txAcc.appendChild(new Option(`${a.name} (${formatMoney(a.balance)})`, a.id));
        });
    }

    populateTransferAccounts();
    populateCategoriesForType(currentTxType);
}

function populateCategoriesForType(type) {
    const catSel = document.getElementById('txCategory');
    catSel.innerHTML = '';
    const list = type === 'income' ? db.categories.income : db.categories.expense;
    list.forEach(c => {
        catSel.appendChild(new Option(`${c.icon} ${c.name}`, c.id));
    });
}

function populateTransferAccounts(depositSubtype = null) {
    const fromSel = document.getElementById('txFromAccount');
    const toSel = document.getElementById('txToAccount');
    fromSel.innerHTML = '';
    toSel.innerHTML = '';

    if (depositSubtype === 'topup') {
        db.accounts.filter(a => a.type !== 'deposit').forEach(a => {
            fromSel.appendChild(new Option(`${a.name} (${formatMoney(a.balance)})`, a.id));
        });
        db.accounts.filter(a => a.type === 'deposit').forEach(a => {
            toSel.appendChild(new Option(`${a.name} (${formatMoney(a.balance)})`, a.id));
        });
    } else if (depositSubtype === 'withdraw') {
        db.accounts.filter(a => a.type === 'deposit').forEach(a => {
            fromSel.appendChild(new Option(`${a.name} (${formatMoney(a.balance)})`, a.id));
        });
        db.accounts.filter(a => a.type !== 'deposit').forEach(a => {
            toSel.appendChild(new Option(`${a.name} (${formatMoney(a.balance)})`, a.id));
        });
    } else {
        db.accounts.forEach(a => {
            fromSel.appendChild(new Option(`${a.name} (${formatMoney(a.balance)})`, a.id));
            toSel.appendChild(new Option(`${a.name} (${formatMoney(a.balance)})`, a.id));
        });
        if (toSel.options.length > 1) {
            toSel.selectedIndex = 1;
        }
    }
}

function saveTransaction(e) {
    e.preventDefault();
    const editId = document.getElementById('txId').value;
    const amount = parseFloat(document.getElementById('txAmount').value);
    const dateVal = document.getElementById('txDateTime').value;
    const comment = document.getElementById('txComment').value.trim();

    if (!amount || amount <= 0) {
        showToast('Iltimos, to\'g\'ri summa kiriting');
        return;
    }

    // If editing existing transaction, rollback previous balance impact first
    let existingTx = null;
    if (editId) {
        existingTx = db.transactions.find(t => t.id === editId);
        if (existingTx) {
            rollbackTransactionImpact(existingTx);
        }
    }

    const txDate = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString();
    const txObj = {
        id: editId || ('tx_' + Date.now()),
        type: currentTxType,
        amount,
        date: txDate,
        comment
    };

    if (currentTxType === 'income') {
        const accId = document.getElementById('txAccount').value;
        const catId = document.getElementById('txCategory').value;
        const acc = db.accounts.find(a => a.id === accId);
        if (!acc) return showToast('Hisob topilmadi');

        acc.balance += amount;
        txObj.accountId = accId;
        txObj.accountName = acc.name;
        txObj.categoryId = catId;
    } else if (currentTxType === 'expense') {
        const accId = document.getElementById('txAccount').value;
        const catId = document.getElementById('txCategory').value;
        const acc = db.accounts.find(a => a.id === accId);
        if (!acc) return showToast('Hisob topilmadi');

        acc.balance -= amount;
        txObj.accountId = accId;
        txObj.accountName = acc.name;
        txObj.categoryId = catId;
    } else if (currentTxType === 'transfer') {
        const fromId = document.getElementById('txFromAccount').value;
        const toId = document.getElementById('txToAccount').value;
        if (fromId === toId) {
            showToast('Bir xil hisoblar orasida o\'tkazma qilib bo\'lmaydi');
            return;
        }
        const fromAcc = db.accounts.find(a => a.id === fromId);
        const toAcc = db.accounts.find(a => a.id === toId);
        if (!fromAcc || !toAcc) return showToast('Hisoblar topilmadi');

        fromAcc.balance -= amount;
        toAcc.balance += amount;
        txObj.fromAccountId = fromId;
        txObj.toAccountId = toId;
        txObj.fromAccountName = fromAcc.name;
        txObj.toAccountName = toAcc.name;
    } else if (currentTxType === 'deposit') {
        const subtype = document.getElementById('txDepositSubtype').value;
        txObj.depositSubtype = subtype;

        if (subtype === 'topup' || subtype === 'withdraw') {
            const fromId = document.getElementById('txFromAccount').value;
            const toId = document.getElementById('txToAccount').value;
            const fromAcc = db.accounts.find(a => a.id === fromId);
            const toAcc = db.accounts.find(a => a.id === toId);
            if (!fromAcc || !toAcc) return showToast('Omonat hisoblari topilmadi');

            fromAcc.balance -= amount;
            toAcc.balance += amount;
            txObj.fromAccountId = fromId;
            txObj.toAccountId = toId;
            txObj.fromAccountName = fromAcc.name;
            txObj.toAccountName = toAcc.name;
        } else if (subtype === 'interest') {
            const toId = document.getElementById('txAccount').value;
            const toAcc = db.accounts.find(a => a.id === toId);
            if (!toAcc) return showToast('Omonat hisobi topilmadi');

            toAcc.balance += amount;
            txObj.toAccountId = toId;
            txObj.toAccountName = toAcc.name;
        }
    }

    if (editId && existingTx) {
        const index = db.transactions.findIndex(t => t.id === editId);
        if (index !== -1) {
            db.transactions[index] = txObj;
        }
        showToast('Operatsiya muvaffaqiyatli tahrirlandi');
    } else {
        db.transactions.unshift(txObj);
        showToast('Operatsiya muvaffaqiyatli saqlandi');
    }

    saveDatabase();
    closeTxModal();
    renderAll();
}

// ==================== CHARTS & ANALYTICS ====================
function updateCharts() {
    const range = document.getElementById('statsMonthSelect')?.value || 'this_month';
    const now = new Date();

    let filtered = [...db.transactions];
    if (range === 'this_month') {
        filtered = filtered.filter(tx => {
            const d = new Date(tx.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
    } else if (range === 'last_month') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        filtered = filtered.filter(tx => {
            const d = new Date(tx.date);
            return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
        });
    }

    let totalInc = 0;
    let totalExp = 0;
    const categoryTotals = {};

    filtered.forEach(tx => {
        if (tx.type === 'income') totalInc += Number(tx.amount);
        if (tx.type === 'expense') {
            totalExp += Number(tx.amount);
            const catId = tx.categoryId || 'other';
            categoryTotals[catId] = (categoryTotals[catId] || 0) + Number(tx.amount);
        }
    });

    const catLabels = [];
    const catData = [];
    const catColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

    Object.keys(categoryTotals).forEach(catId => {
        const cat = db.categories.expense.find(c => c.id === catId);
        catLabels.push(cat ? `${cat.icon} ${cat.name}` : 'Boshqa');
        catData.push(categoryTotals[catId]);
    });

    if (catData.length === 0) {
        catLabels.push('Xarajat yo\'q');
        catData.push(1);
    }

    // 1. Dashboard Bar Chart
    const ctxBarDash = document.getElementById('incomeExpenseChart')?.getContext('2d');
    if (ctxBarDash) {
        if (dashboardBarChart) dashboardBarChart.destroy();
        dashboardBarChart = new Chart(ctxBarDash, {
            type: 'bar',
            data: {
                labels: ['Daromad (Kirim)', 'Xarajat (Chiqim)'],
                datasets: [{
                    data: [totalInc, totalExp],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });
    }

    // 2. Dashboard Donut Chart
    const ctxPieDash = document.getElementById('categoryExpenseChart')?.getContext('2d');
    if (ctxPieDash) {
        if (dashboardPieChart) dashboardPieChart.destroy();
        dashboardPieChart = new Chart(ctxPieDash, {
            type: 'doughnut',
            data: {
                labels: catLabels,
                datasets: [{ data: catData, backgroundColor: catColors, borderWidth: 0 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                cutout: '72%'
            }
        });
    }

    // 3. Analytics View Charts
    const ctxBarAnalytics = document.getElementById('analyticsBarChart')?.getContext('2d');
    if (ctxBarAnalytics) {
        if (analyticsBarChart) analyticsBarChart.destroy();
        analyticsBarChart = new Chart(ctxBarAnalytics, {
            type: 'bar',
            data: {
                labels: ['Jami Kirim (Daromad)', 'Jami Chiqim (Xarajat)'],
                datasets: [{
                    data: [totalInc, totalExp],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderRadius: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });
    }

    const ctxPieAnalytics = document.getElementById('analyticsPieChart')?.getContext('2d');
    if (ctxPieAnalytics) {
        if (analyticsPieChart) analyticsPieChart.destroy();
        analyticsPieChart = new Chart(ctxPieAnalytics, {
            type: 'pie',
            data: {
                labels: catLabels,
                datasets: [{ data: catData, backgroundColor: catColors, borderWidth: 0 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }
            }
        });
    }

    // Category breakdown side list
    const breakdownList = document.getElementById('categoryBreakdownList');
    if (breakdownList) {
        breakdownList.innerHTML = '';
        Object.keys(categoryTotals).forEach((catId, idx) => {
            const cat = db.categories.expense.find(c => c.id === catId);
            const amount = categoryTotals[catId];
            const percent = totalExp > 0 ? Math.round((amount / totalExp) * 100) : 0;
            const color = catColors[idx % catColors.length];

            const item = document.createElement('div');
            item.className = 'cat-bar-item';
            item.innerHTML = `
                <div class="cat-bar-header">
                    <span>${cat ? cat.icon + ' ' + cat.name : 'Boshqa'}</span>
                    <strong>${formatMoney(amount)} (${percent}%)</strong>
                </div>
                <div class="cat-bar-bg">
                    <div class="cat-bar-fill" style="width: ${percent}%; background: ${color};"></div>
                </div>
            `;
            breakdownList.appendChild(item);
        });
    }
}

// ==================== TAB NAVIGATION ====================
function switchTab(tabId) {
    document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');

    // Sidebar active state
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
        const onclickAttr = btn.getAttribute('onclick') || '';
        btn.classList.toggle('active', onclickAttr.includes(tabId));
    });

    // Update Topbar Title
    const titles = {
        'tab-dashboard': 'Boshqaruv Paneli (Dashboard)',
        'tab-accounts': 'Hisoblarim va Balanslar',
        'tab-history': 'Operatsiyalar Tarixi & Filtr',
        'tab-salary': '💰 Oylik Maoshlar Hisoboti & Tarixi',
        'tab-analytics': 'Moliya Tahlili va Grafiklar',
        'tab-settings': 'Sozlamalar va Zaxira Nusxa'
    };
    if (titles[tabId]) {
        document.getElementById('currentPageTitle').textContent = titles[tabId];
    }

    if (tabId === 'tab-salary') {
        renderSalaryView();
    }

    if (tabId === 'tab-analytics' || tabId === 'tab-dashboard') {
        setTimeout(updateCharts, 50);
    }
}

// ==================== PRIVACY & PIN SECURITY ====================
function toggleBalanceVisibility() {
    db.settings.privacyHidden = !db.settings.privacyHidden;
    saveDatabase();
    updatePrivacyEyeIcon();
    renderAll();
}

function updatePrivacyEyeIcon() {
    const eye = document.getElementById('eyeIcon');
    if (eye) {
        eye.textContent = db.settings.privacyHidden ? '🔒' : '👁';
    }
}

function toggleQuickLock() {
    if (!db.settings.pinEnabled) {
        showToast('PIN qulfini Sozlamalar menyusida yoqishingiz mumkin');
        switchTab('tab-settings');
        return;
    }
    inputPinBuffer = '';
    updatePinDots();
    document.getElementById('pinLockScreen').style.display = 'flex';
}

function pressPin(val) {
    const errorEl = document.getElementById('pinError');
    errorEl.textContent = '';

    if (val === 'del') {
        inputPinBuffer = inputPinBuffer.slice(0, -1);
    } else if (inputPinBuffer.length < 4) {
        inputPinBuffer += val;
    }

    updatePinDots();

    if (inputPinBuffer.length === 4) {
        setTimeout(verifyPin, 150);
    }
}

function updatePinDots() {
    const dots = document.querySelectorAll('.pin-dots .dot');
    dots.forEach((dot, idx) => {
        dot.classList.toggle('filled', idx < inputPinBuffer.length);
    });
}

function verifyPin() {
    const correctPin = db.settings.pinCode || '1904';
    if (inputPinBuffer === correctPin) {
        document.getElementById('pinLockScreen').style.display = 'none';
        inputPinBuffer = '';
        updatePinDots();
    } else {
        document.getElementById('pinError').textContent = 'PIN kod noto\'g\'ri!';
        inputPinBuffer = '';
        updatePinDots();
    }
}

function togglePinSecurity(enabled) {
    db.settings.pinEnabled = enabled;
    saveDatabase();
    document.getElementById('pinChangeRow').style.display = enabled ? 'flex' : 'none';
    showToast(enabled ? 'PIN himoya yoqildi' : 'PIN himoya o\'chirildi');
}

function saveNewPin() {
    const newPin = document.getElementById('settingNewPin').value.trim();
    if (newPin.length !== 4 || isNaN(newPin)) {
        showToast('PIN kod aynan 4 ta raqam bo\'lishi shart');
        return;
    }
    db.settings.pinCode = newPin;
    saveDatabase();
    document.getElementById('settingNewPin').value = '';
    showToast('Yangi PIN kod saqlandi');
}

function saveUserName() {
    const name = document.getElementById('settingUserName').value.trim();
    if (name) {
        db.settings.userName = name;
        saveDatabase();
        updateUserSettingsUI();
        showToast('Ism saqlandi');
    }
}

function changeCurrency(curr) {
    db.settings.currency = curr;
    saveDatabase();
    updateUserSettingsUI();
    renderAll();
    showToast('Valyuta o\'zgartirildi');
}

// ==================== EXPORT / IMPORT JSON & CSV ====================
function exportDataJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
    const dlAnchor = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `finance_database_backup_${dateStr}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('JSON Baza yuklab olindi!');
}

function importDataJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported && Array.isArray(imported.accounts) && Array.isArray(imported.transactions)) {
                db = imported;
                saveDatabase();
                updateUserSettingsUI();
                renderAll();
                showToast('Ma\'lumotlar bazasi qayta tiklandi!');
            } else {
                showToast('Xatolik: Noto\'g\'ri JSON fayl formati!');
            }
        } catch (err) {
            showToast('JSON faylni o\'qishda xatolik yuz berdi!');
        }
    };
    reader.readAsText(file);
}

function exportTransactionsCSV() {
    if (db.transactions.length === 0) {
        showToast('Eksport qilish uchun operatsiyalar yo\'q');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "ID,Sana,Turi,Summa,Valyuta,Hisob,Kategoriya,Izoh\n";

    db.transactions.forEach(tx => {
        const date = new Date(tx.date).toLocaleString('uz-UZ');
        const type = tx.type;
        const amount = tx.amount;
        const curr = db.settings.currency;
        const accName = `"${getAccountDisplayName(tx.accountId || tx.fromAccountId, tx.accountName || tx.fromAccountName)}"`
        const cat = db.categories.expense.concat(db.categories.income).find(c => c.id === tx.categoryId);
        const catName = cat ? `"${cat.name}"` : '""';
        const comment = `"${(tx.comment || '').replace(/"/g, '""')}"`;

        csvContent += `${tx.id},${date},${type},${amount},${curr},${accName},${catName},${comment}\n`;
    });

    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", encodeURI(csvContent));
    dlAnchor.setAttribute("download", `finance_transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('CSV fayl yuklab olindi!');
}

function resetDatabase() {
    showCustomConfirm(
        'Bazani tozalash',
        'DIQQAT! Barcha hisoblar va barcha operatsiyalar o\'chiriladi. Baza butunlay toza (0 ta hisob va 0 ta tarix) holatga keltiriladi. Davom etasizmi?',
        '⚠️',
        () => {
            db.accounts = [];
            db.transactions = [];
            saveDatabase();
            updateUserSettingsUI();
            renderAll();
            showToast('Baza butunlay tozalandi (0 ta hisob, 0 ta tarix)!');
        }
    );
}

// ==================== TAB: SALARY (OYLIK MAOSH) MODULE ====================
function openSalaryTransactionModal() {
    if (db.accounts.length === 0) {
        showToast('Iltimos, avval bitta hisob (karta yoki naqd pul) qo\'shing');
        openAddAccountModal();
        return;
    }

    setTxType('income');
    resetTxDateInput();
    document.getElementById('txAmount').value = '';
    document.getElementById('txComment').value = 'Oylik maosh';
    document.getElementById('txCategory').value = 'cat_salary';
    document.getElementById('txModal').style.display = 'flex';
}

function renderSalaryView() {
    applySalaryFilters();
}

function onSalaryPeriodChange() {
    const period = document.getElementById('salaryPeriodSelect').value;
    const now = new Date();
    const startInput = document.getElementById('salaryStartDate');
    const endInput = document.getElementById('salaryEndDate');

    const toDateInputString = (date) => {
        const d = new Date(date);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
    };

    if (period === 'all') {
        startInput.value = '';
        endInput.value = '';
    } else if (period === 'this_year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        startInput.value = toDateInputString(startOfYear);
        endInput.value = toDateInputString(now);
    } else if (period === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startInput.value = toDateInputString(startOfMonth);
        endInput.value = toDateInputString(now);
    }

    applySalaryFilters();
}

function resetSalaryFilters() {
    document.getElementById('salarySearchInput').value = '';
    document.getElementById('salaryStartDate').value = '';
    document.getElementById('salaryEndDate').value = '';
    document.getElementById('salaryPeriodSelect').value = 'all';
    document.getElementById('salaryAccountFilter').value = 'all';
    applySalaryFilters();
    showToast('Maosh filtrlari tozalandi');
}

function applySalaryFilters() {
    const query = (document.getElementById('salarySearchInput')?.value || '').toLowerCase().trim();
    const startDateVal = document.getElementById('salaryStartDate')?.value;
    const endDateVal = document.getElementById('salaryEndDate')?.value;
    const accId = document.getElementById('salaryAccountFilter')?.value || 'all';

    // Filter only Salary income transactions
    let salaries = db.transactions.filter(tx => {
        const isSalary = tx.type === 'income' && (tx.categoryId === 'cat_salary' || (tx.comment && tx.comment.toLowerCase().includes('maosh')));
        return isSalary;
    });

    if (query) {
        salaries = salaries.filter(tx => {
            const commentMatch = (tx.comment || '').toLowerCase().includes(query);
            const amountMatch = tx.amount.toString().includes(query);
            const accMatch = (tx.accountName || '').toLowerCase().includes(query);
            return commentMatch || amountMatch || accMatch;
        });
    }

    if (accId !== 'all') {
        salaries = salaries.filter(tx => tx.accountId === accId);
    }

    if (startDateVal) {
        const start = new Date(startDateVal);
        start.setHours(0, 0, 0, 0);
        salaries = salaries.filter(tx => new Date(tx.date) >= start);
    }
    if (endDateVal) {
        const end = new Date(endDateVal);
        end.setHours(23, 59, 59, 999);
        salaries = salaries.filter(tx => new Date(tx.date) <= end);
    }

    salaries.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate Summary Stats
    let totalSalary = 0;
    salaries.forEach(tx => totalSalary += Number(tx.amount));
    const count = salaries.length;

    const countSummary = document.getElementById('salaryCountSummary');
    if (countSummary) countSummary.textContent = `${count} ta`;

    const totalSummary = document.getElementById('salaryTotalSummary');
    if (totalSummary) totalSummary.textContent = '+' + formatMoney(totalSalary);

    // Render Table
    const tableBody = document.getElementById('salaryHistoryTableBody');
    if (tableBody) {
        tableBody.innerHTML = '';
        if (salaries.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding:45px 20px; color:var(--text-muted);">
                        <div style="font-size:32px; margin-bottom:8px;">💰</div>
                        <div>Oylik maosh operatsiyalari topilmadi</div>
                    </td>
                </tr>
            `;
        } else {
            salaries.forEach(tx => {
                tableBody.appendChild(createTableRow(tx, true));
            });
        }
    }
}

function exportSalaryCSV() {
    const salaries = db.transactions.filter(tx => tx.type === 'income' && (tx.categoryId === 'cat_salary' || (tx.comment && tx.comment.toLowerCase().includes('maosh'))));
    if (salaries.length === 0) {
        showToast('Eksport qilish uchun maosh yozuvlari yo\'q');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "ID,Sana,Summa,Valyuta,Hisob,Izoh\n";

    salaries.forEach(tx => {
        const date = new Date(tx.date).toLocaleString('uz-UZ');
        const amount = tx.amount;
        const curr = db.settings.currency;
        const accName = `"${getAccountDisplayName(tx.accountId, tx.accountName)}"`;
        const comment = `"${(tx.comment || '').replace(/"/g, '""')}"`;
        csvContent += `${tx.id},${date},${amount},${curr},${accName},${comment}\n`;
    });

    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", encodeURI(csvContent));
    dlAnchor.setAttribute("download", `finance_salary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('Maoshlar CSV fayli yuklab olindi!');
}
