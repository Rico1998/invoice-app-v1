// --- State Management ---
const state = {
    invoices: [],
    currentInvoice: null
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadInvoices();
    renderDashboard();

    // Set default date to today
    document.getElementById('inp-date').valueAsDate = new Date();
    document.getElementById('inp-due-date').valueAsDate = new Date();
});

// --- Mobile Sidebar Toggle ---
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (!sidebar || !overlay) return;

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // Mobile: toggle 'open' class and show overlay
        const isOpen = sidebar.classList.contains('open');
        if (isOpen) {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        } else {
            sidebar.classList.add('open');
            overlay.classList.add('show');
        }
    } else {
        // Desktop: toggle 'collapsed' class (no overlay)
        sidebar.classList.toggle('collapsed');
    }
}

// --- Navigation ---
function navigateTo(viewId, filter = null) {
    // Hide all views
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));

    // Show target view
    document.getElementById(`view-${viewId}`).classList.add('active');

    // Update nav active state (find based on onclick attribute)
    if (viewId === 'dashboard') {
        const selector = filter
            ? `.nav-links li[onclick="navigateTo('dashboard', '${filter}')"]`
            : `.nav-links li[onclick="navigateTo('dashboard')"]`;

        const navItem = document.querySelector(selector);
        if (navItem) navItem.classList.add('active');

        renderDashboard(filter);
    }

    // Close mobile sidebar after navigation
    const sidebar = document.querySelector('.sidebar');
    if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('open')) {
        toggleSidebar();
    }
}

function createNewInvoice() {
    state.currentInvoice = null; // Reset for new
    resetForm();
    navigateTo('editor');
    document.getElementById('editor-title').textContent = 'New Invoice';
}

// --- Data Persistence ---
function loadInvoices() {
    const stored = localStorage.getItem('invoices');
    if (stored) {
        state.invoices = JSON.parse(stored);
    }
}

function saveInvoicesToStorage() {
    localStorage.setItem('invoices', JSON.stringify(state.invoices));
    renderDashboard(); // Refresh dashboard stats
}

// --- Dashboard Logic ---
function renderDashboard(filter = null) {
    const listEl = document.getElementById('invoice-list');
    const totalCountEl = document.getElementById('total-invoices-count');
    const totalRevenueEl = document.getElementById('total-revenue-amount');
    const headerTitle = document.querySelector('#view-dashboard h2'); // Invoice History header

    // Base Title
    let title = 'Invoice History';
    if (filter === 'overdue') title = 'Overdue Invoices (Action Required)';
    if (filter === 'pending') title = 'Pending Invoices';
    if (filter === 'paid') title = 'Paid Invoices';
    if (headerTitle) headerTitle.textContent = title;

    // Filter Logic
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filtered = [...state.invoices];
    if (filter === 'paid') {
        filtered = filtered.filter(i => i.status === 'Paid');
    } else if (filter === 'pending') {
        filtered = filtered.filter(i => {
            if (i.status === 'Paid') return false;
            const due = new Date(i.dueDate); due.setHours(0, 0, 0, 0);
            return due >= today; // Not yet overdue
        });
    } else if (filter === 'overdue') {
        filtered = filtered.filter(i => {
            if (i.status === 'Paid') return false;
            const due = new Date(i.dueDate); due.setHours(0, 0, 0, 0);
            return due < today;
        });
    }

    // Stats (Show stats for the filtered view or global? Usually global is less confusing, but local is more relevant to the view. Let's keep global stats but filter list.)
    // Actually user might want to see how much is overdue. Let's show stats for the FILTERED list if a filter is active.

    totalCountEl.textContent = filtered.length;
    const totalRevenue = filtered.reduce((sum, inv) => sum + inv.total, 0);
    totalRevenueEl.textContent = formatCurrency(totalRevenue);

    // Sorting
    // Default: Date Descending (Newest first)
    // Overdue: Due Date Ascending (Most overdue/oldest due date first)
    if (filter === 'overdue') {
        filtered.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    } else {
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // List
    listEl.innerHTML = '';
    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state" style="text-align:center; padding: 3rem; color: var(--text-muted);">
                <span class="material-icons-round" style="font-size: 3rem; margin-bottom:1rem;">sentiment_dissatisfied</span>
                <p>No invoices found in this category.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(inv => {
        const el = document.createElement('div');
        el.className = 'invoice-item';

        // Status Logic
        let status = inv.status || 'Pending';
        let statusClass = 'status-pending';
        let displayStatus = status;

        if (status === 'Paid') {
            statusClass = 'status-paid';
        } else {
            // Check if overdue
            const dueDate = new Date(inv.dueDate);
            dueDate.setHours(0, 0, 0, 0); // normalize

            if (dueDate < today) {
                statusClass = 'status-overdue';
                displayStatus = 'Overdue';
            }
        }

        const toggleLabel = status === 'Paid' ? 'Paid' : 'Mark Paid';
        const toggleIcon = status === 'Paid' ? 'check_circle' : 'radio_button_unchecked';
        // If overdue, we still show "Mark Paid" button, but the badge is red.

        el.innerHTML = `
            <div class="invoice-info">
                <div style="display:flex; align-items:center; gap: 1rem; margin-bottom: 0.25rem;">
                    <h4>${inv.clientName || 'Unknown Client'}</h4>
                    <span class="status-badge ${statusClass}">${displayStatus}</span>
                </div>
                <p>#${inv.number} • Due: ${inv.dueDate}</p>
            </div>
            <div class="invoice-actions" style="display:flex; align-items:center; gap: 2rem;">
                <span style="font-weight:600; font-size:1.1rem;">${formatCurrency(inv.total)}</span>
                <div style="display:flex; gap:0.5rem;">
                     <button class="btn-secondary" onclick="toggleStatus('${inv.id}')" style="padding: 0.5rem 1rem; font-size: 0.8rem;">
                        <span class="material-icons-round" style="font-size: 1rem;">${toggleIcon}</span> ${toggleLabel}
                     </button>
                     <button class="btn-secondary" onclick="viewInvoice('${inv.id}')" style="padding: 0.5rem 1rem;">View</button>
                     <button class="btn-danger-icon" onclick="deleteInvoice('${inv.id}')">
                        <span class="material-icons-round">delete</span>
                    </button>
                </div>
            </div>
        `;
        listEl.appendChild(el);
    });
}

// --- Invoice Editor Logic ---
function resetForm() {
    document.getElementById('inp-number').value = `INV-${String(state.invoices.length + 1).padStart(3, '0')}`;

    // Dates - Default Net 30
    // Dates - Default Net 30
    const today = new Date();
    const dateInput = document.getElementById('inp-date');
    const dueInput = document.getElementById('inp-due-date');

    dateInput.value = today.toISOString().split('T')[0];

    const setNet30 = () => {
        if (dateInput.value) {
            const d = new Date(dateInput.value);
            d.setDate(d.getDate() + 30);
            dueInput.value = d.toISOString().split('T')[0];
        }
    };

    setNet30(); // Set initial
    dateInput.onchange = setNet30; // Update when user changes date

    document.getElementById('inp-client-name').value = '';
    document.getElementById('inp-client-email').value = '';
    document.getElementById('inp-client-address').value = '';

    document.getElementById('items-list-body').innerHTML = '';
    addItemRow(); // Add one empty row
    calculateTotal();
}

function addItemRow(data = {}) {
    const tbody = document.getElementById('items-list-body');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" placeholder="Item description" class="inp-desc" value="${data.desc || ''}"></td>
        <td><input type="number" placeholder="1" class="inp-qty" value="${data.qty || 1}" min="1" oninput="calculateTotal()"></td>
        <td><input type="number" placeholder="0.00" class="inp-price" value="${data.price || ''}" min="0" step="0.01" oninput="calculateTotal()"></td>
        <td class="row-total">$0.00</td>
        <td>
            <button type="button" class="btn-danger-icon" onclick="this.closest('tr').remove(); calculateTotal()">
                <span class="material-icons-round">close</span>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
    calculateTotal();
}

function calculateTotal() {
    const rows = document.querySelectorAll('#items-list-body tr');
    let subtotal = 0;

    rows.forEach(row => {
        const qty = parseFloat(row.querySelector('.inp-qty').value) || 0;
        const price = parseFloat(row.querySelector('.inp-price').value) || 0;
        const total = qty * price;
        row.querySelector('.row-total').textContent = formatCurrency(total);
        subtotal += total;
    });

    document.getElementById('display-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('display-total').textContent = formatCurrency(subtotal); // No tax for now
    return subtotal;
}

function saveInvoice() {
    const id = state.currentInvoice ? state.currentInvoice.id : Date.now().toString();

    const items = [];
    document.querySelectorAll('#items-list-body tr').forEach(row => {
        items.push({
            desc: row.querySelector('.inp-desc').value,
            qty: parseFloat(row.querySelector('.inp-qty').value) || 0,
            price: parseFloat(row.querySelector('.inp-price').value) || 0
        });
    });

    const invoice = {
        id,
        number: document.getElementById('inp-number').value,
        date: document.getElementById('inp-date').value,
        dueDate: document.getElementById('inp-due-date').value,
        clientName: document.getElementById('inp-client-name').value,
        clientEmail: document.getElementById('inp-client-email').value,
        clientAddress: document.getElementById('inp-client-address').value,
        clientAddress: document.getElementById('inp-client-address').value,
        items,
        total: calculateTotal(),
        status: state.currentInvoice ? state.currentInvoice.status : 'Pending'
    };

    if (state.currentInvoice) {
        const idx = state.invoices.findIndex(i => i.id === id);
        state.invoices[idx] = invoice;
    } else {
        state.invoices.push(invoice);
    }

    saveInvoicesToStorage();
    navigateTo('dashboard');
}

function deleteInvoice(id) {
    if (confirm('Are you sure you want to delete this invoice?')) {
        state.invoices = state.invoices.filter(i => i.id !== id);
        saveInvoicesToStorage();
    }
}

// --- Preview / Print Logic ---
function emailInvoice(id) {
    // If called without ID (e.g. from preview button), use current
    const inv = id ? state.invoices.find(i => i.id === id) : state.currentInvoice;

    if (!inv) return;
    if (!inv.clientEmail) {
        alert('Please add a client email to this invoice first to use this feature.');
        return;
    }

    const subject = encodeURIComponent(`Invoice #${inv.number}`);
    const body = encodeURIComponent(
        `Dear ${inv.clientName},\n\n` +
        `Please find attached your invoice #${inv.number} for a total of ${formatCurrency(inv.total)}.\n\n` +
        `Due Date: ${inv.dueDate}\n\n` +
        `Thank you for your business!\n` +
        `Zizo Capital`
    );

    window.location.href = `mailto:${inv.clientEmail}?subject=${subject}&body=${body}`;
}

function toggleStatus(id) {
    const inv = state.invoices.find(i => i.id === id);
    if (inv) {
        inv.status = (inv.status === 'Paid') ? 'Pending' : 'Paid';
        saveInvoicesToStorage();
    }
}

function viewInvoice(id) {
    const inv = state.invoices.find(i => i.id === id);
    if (!inv) return;

    state.currentInvoice = inv;
    const paper = document.getElementById('invoice-paper');

    const itemsHtml = inv.items.map(item => `
        <tr>
            <td>${item.desc}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>${item.qty}</td>
            <td>${formatCurrency(item.price * item.qty)}</td>
        </tr>
    `).join('');

    paper.innerHTML = `
        <div class="invoice-paper-header">
            <div>
                <div class="invoice-paper-title">INVOICE</div>
                <div style="color: #64748b; margin-top: 0.5rem;">#${inv.number}</div>
            </div>
            <div class="invoice-paper-details">
                <div style="font-weight: 700; color: #0f172a;">Zizo Capital</div>
                <div style="color: #64748b;">xylersucks@gmail.com</div>
            </div>
        </div>

        <div class="invoice-paper-grid">
            <div>
                <h4 style="color: #64748b; font-size: 0.85rem; text-transform: uppercase; margin-bottom: 0.5rem;">Bill To</h4>
                <div style="font-weight: 600; color: #0f172a; font-size: 1.1rem; margin-bottom: 0.25rem;">${inv.clientName}</div>
                <div style="color: #64748b;">${inv.clientAddress.replace(/\n/g, '<br>')}</div>
            </div>
            <div style="text-align: right;">
                <div style="margin-bottom: 0.5rem;">
                    <span style="color: #64748b;">Date:</span>
                    <span style="font-weight: 600; color: #0f172a; margin-left: 1rem;">${inv.date}</span>
                </div>
                <div>
                    <span style="color: #64748b;">Due Date:</span>
                    <span style="font-weight: 600; color: #0f172a; margin-left: 1rem;">${inv.dueDate}</span>
                </div>
            </div>
        </div>

        <table class="paper-table">
            <thead>
                <tr>
                    <th width="50%">Description</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>

        <div class="paper-total">
            <div class="paper-total-row">
                <span>Subtotal</span>
                <span>${formatCurrency(inv.total)}</span>
            </div>
            <div class="paper-total-row final">
                <span>Total</span>
                <span>${formatCurrency(inv.total)}</span>
            </div>
        </div>

        <div style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 0.9rem;">
            Thank you for your business!
        </div>
    `;

    navigateTo('preview');
}

// --- Utils ---
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}
