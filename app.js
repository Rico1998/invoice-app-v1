import { auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, query, where, orderBy } from './firebase.js';

// --- Global State ---
const state = {
    invoices: [],
    user: null
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Auth Listener
    onAuthStateChanged(auth, (user) => {
        if (user) {
            state.user = user;
            document.getElementById('login-screen').style.opacity = '0';
            document.getElementById('app').style.filter = 'none';
            setTimeout(() => {
                document.getElementById('login-screen').style.display = 'none';
            }, 300);

            // Allow sidebar styling to persist
            const savedTheme = localStorage.getItem('theme') || 'dark';
            document.body.className = `theme-${savedTheme}`;
            updateThemeIcon(savedTheme);

            // Start Listening to DB
            loadInvoices();
        } else {
            state.user = null;
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('login-screen').style.opacity = '1';
            document.getElementById('app').style.filter = 'blur(5px)';
        }
    });

    // Login Form Handler
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('inp-email').value;
        const password = document.getElementById('inp-password').value;
        const btn = document.getElementById('btn-login');
        const errorMsg = document.getElementById('login-error');

        try {
            btn.innerHTML = 'Signing in...';
            btn.disabled = true;
            errorMsg.style.display = 'none';

            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged will handle the rest
        } catch (error) {
            console.error(error);
            errorMsg.textContent = 'Invalid email or password.';
            errorMsg.style.display = 'block';
            btn.innerHTML = 'Sign In';
            btn.disabled = false;
        }
    });

    renderDashboard();

    // Set default date to today
    document.getElementById('inp-date').valueAsDate = new Date();
    document.getElementById('inp-due-date').valueAsDate = new Date();
});


// --- Database Functions ---

// 1. Load Real-time Data
function loadInvoices() {
    if (!state.user) return;

    // Query: invoices where userId == state.user.uid
    // For simplicity in this demo, accessing 'invoices' collection. 
    // In production, you'd filter by user ID: where("uid", "==", state.user.uid)

    const q = query(collection(db, "invoices"), orderBy("date", "desc"));

    onSnapshot(q, (snapshot) => {
        state.invoices = [];
        snapshot.forEach((doc) => {
            state.invoices.push({ id: doc.id, ...doc.data() });
        });
        renderDashboard();
    }, (error) => {
        console.error("Error getting invoices:", error);
    });
}

// 2. Save Invoice
async function saveInvoice() {
    const btn = document.querySelector('#view-editor .btn-primary');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Saving...';
    btn.disabled = true;

    try {
        const number = document.getElementById('inp-number').value;
        // ... (rest of validation) ...
        const date = document.getElementById('inp-date').value;
        const dueDate = document.getElementById('inp-due-date').value;
        const clientName = document.getElementById('inp-client-name').value;
        const clientEmail = document.getElementById('inp-client-email').value;
        const clientAddress = document.getElementById('inp-client-address').value;

        // Validation
        if (!number || !clientName) {
            alert('Please fill in Invoice Number and Client Name');
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }

        // Get Items
        const items = [];
        document.querySelectorAll('#items-list-body tr').forEach(row => {
            const inputs = row.querySelectorAll('input');
            const desc = inputs[0].value;
            const qty = parseFloat(inputs[1].value) || 0;
            const price = parseFloat(inputs[2].value) || 0;
            if (desc) items.push({ description: desc, quantity: qty, price: price });
        });

        // Calculate Total
        const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

        const newInvoice = {
            number,
            date,
            dueDate,
            clientName,
            clientEmail,
            clientAddress,
            items,
            total,
            status: 'Pending',
            createdAt: new Date().toISOString(),
            uid: state.user.uid // Owner ID
        };

        await addDoc(collection(db, "invoices"), newInvoice);

        navigateTo('dashboard');
        resetForm();
    } catch (e) {
        console.error("Error adding document: ", e);
        alert('Failed to save invoice. See console.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// 3. Delete Invoice
window.deleteInvoice = async function (id) {
    if (confirm('Are you sure you want to delete this invoice?')) {
        try {
            await deleteDoc(doc(db, "invoices", id));
            // No need to reload, onSnapshot handles it!
        } catch (e) {
            console.error("Error deleting: ", e);
        }
    }
}

// 4. Toggle Status
window.toggleStatus = async function (id) {
    const inv = state.invoices.find(i => i.id === id);
    if (!inv) return;

    const newStatus = inv.status === 'Paid' ? 'Pending' : 'Paid';
    try {
        await updateDoc(doc(db, "invoices", id), {
            status: newStatus
        });
    } catch (e) {
        console.error("Error updating status: ", e);
    }
    // No need to re-render, snapshot does it
}

// --- Navigation (Exports needed for HTML onclick) ---
window.toggleTheme = toggleTheme;
window.toggleSidebar = mbToggleSidebar;
window.navigateTo = navigateTo;
window.createNewInvoice = createNewInvoice;
window.saveInvoice = saveInvoice;
window.addItemRow = addItemRow;
window.deleteRow = deleteRow;
window.exportToExcel = exportToExcel;
window.emailInvoice = emailInvoice;
window.viewInvoice = viewInvoice;
// window.deleteInvoice and toggleStatus defined above


// --- Theme Toggle ---
function toggleTheme() {
    const currentTheme = document.body.classList.contains('theme-light') ? 'light' : 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.body.className = `theme-${newTheme}`;
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');

    if (theme === 'light') {
        icon.textContent = 'dark_mode';
    } else {
        icon.textContent = 'light_mode';
    }
}

// --- Mobile Sidebar Toggle ---
function mbToggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (!sidebar || !overlay) return;

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        const isOpen = sidebar.classList.contains('open');
        if (isOpen) {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        } else {
            sidebar.classList.add('open');
            overlay.classList.add('show');
        }
    } else {
        sidebar.classList.toggle('collapsed');
    }
}

// --- Navigation ---
function navigateTo(viewId, filter = null) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));

    document.getElementById(`view-${viewId}`).classList.add('active');

    if (viewId === 'dashboard') {
        const selector = filter
            ? `.nav-links li[onclick="navigateTo('dashboard', '${filter}')"]`
            : `.nav-links li[onclick="navigateTo('dashboard')"]`;

        const navItem = document.querySelector(selector);
        if (navItem) navItem.classList.add('active');

        renderDashboard(filter);
    }

    if (window.innerWidth <= 768) {
        mbToggleSidebar();
    }
}

function createNewInvoice() {
    resetForm();
    navigateTo('editor');
}

function resetForm() {
    document.getElementById('inp-number').value = `INV-${String(state.invoices.length + 1).padStart(3, '0')}`;

    const today = new Date();
    const dateInput = document.getElementById('inp-date');
    const dueInput = document.getElementById('inp-due-date');

    dateInput.value = today.toISOString().split('T')[0];

    // Net 30 default
    const setNet30 = () => {
        if (dateInput.value) {
            const d = new Date(dateInput.value);
            d.setDate(d.getDate() + 30);
            dueInput.value = d.toISOString().split('T')[0];
        }
    };

    setNet30();
    dateInput.onchange = setNet30;

    document.getElementById('inp-client-name').value = '';
    document.getElementById('inp-client-email').value = '';
    document.getElementById('inp-client-address').value = '';

    document.getElementById('items-list-body').innerHTML = '';
    addItemRow();
    calculateTotal();
}

function addItemRow() {
    const tbody = document.getElementById('items-list-body');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" placeholder="Item description"></td>
        <td><input type="number" value="1" min="1" oninput="calculateTotal()"></td>
        <td><input type="number" value="0" min="0" step="0.01" oninput="calculateTotal()"></td>
        <td><span class="row-total">$0.00</span></td>
        <td><button type="button" class="btn-danger-icon" onclick="deleteRow(this)">×</button></td>
    `;
    tbody.appendChild(tr);
}

function deleteRow(btn) {
    const row = btn.closest('tr');
    if (document.querySelectorAll('#items-list-body tr').length > 1) {
        row.remove();
        calculateTotal();
    }
}

function calculateTotal() {
    let subtotal = 0;
    document.querySelectorAll('#items-list-body tr').forEach(row => {
        const inputs = row.querySelectorAll('input');
        const qty = parseFloat(inputs[1].value) || 0;
        const price = parseFloat(inputs[2].value) || 0;
        const total = qty * price;

        row.querySelector('.row-total').textContent = formatCurrency(total);
        subtotal += total;
    });

    document.getElementById('display-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('display-total').textContent = formatCurrency(subtotal);
}

// --- Dashboard Logic ---
function renderDashboard(filter = null) {
    const listEl = document.getElementById('invoice-list');
    const totalCountEl = document.getElementById('total-invoices-count');
    const totalRevenueEl = document.getElementById('total-revenue-amount');
    const headerTitle = document.querySelector('#view-dashboard h2');

    let title = 'Invoice History';
    if (filter === 'overdue') title = 'Overdue Invoices (Action Required)';
    if (filter === 'pending') title = 'Pending Invoices';
    if (filter === 'paid') title = 'Paid Invoices';
    if (headerTitle) headerTitle.textContent = title;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filtered = [...state.invoices];
    if (filter === 'paid') {
        filtered = filtered.filter(i => i.status === 'Paid');
    } else if (filter === 'pending') {
        filtered = filtered.filter(i => {
            if (i.status === 'Paid') return false;
            const due = new Date(i.dueDate); due.setHours(0, 0, 0, 0);
            return due >= today;
        });
    } else if (filter === 'overdue') {
        filtered = filtered.filter(i => {
            if (i.status === 'Paid') return false;
            const due = new Date(i.dueDate); due.setHours(0, 0, 0, 0);
            return due < today;
        });
    }

    totalCountEl.textContent = filtered.length;
    const totalRevenue = filtered.reduce((sum, inv) => sum + inv.total, 0);
    totalRevenueEl.textContent = formatCurrency(totalRevenue);

    if (filter === 'overdue') {
        filtered.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    } else {
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

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

        let status = inv.status || 'Pending';
        let statusClass = 'status-pending';
        let displayStatus = status;

        if (status === 'Paid') {
            statusClass = 'status-paid';
        } else {
            const dueDate = new Date(inv.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            if (dueDate < today) {
                statusClass = 'status-overdue';
                displayStatus = 'Overdue';
            }
        }

        const toggleLabel = status === 'Paid' ? 'Paid' : 'Mark Paid';
        const toggleIcon = status === 'Paid' ? 'check_circle' : 'radio_button_unchecked';

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

function viewInvoice(id) {
    const inv = state.invoices.find(i => i.id === id);
    if (!inv) return;

    navigateTo('preview');

    // Render Paper
    const container = document.getElementById('invoice-paper');
    container.innerHTML = `
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

// --- Excel Export ---
function exportToExcel() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Determine current filter from the active nav item
    let filter = null;
    let fileName = 'All_Invoices';

    const activeNav = document.querySelector('.nav-links li.active');
    if (activeNav) {
        const onclick = activeNav.getAttribute('onclick');
        if (onclick && onclick.includes("'overdue'")) {
            filter = 'overdue';
            fileName = 'Overdue_Invoices';
        } else if (onclick && onclick.includes("'pending'")) {
            filter = 'pending';
            fileName = 'Pending_Invoices';
        } else if (onclick && onclick.includes("'paid'")) {
            filter = 'paid';
            fileName = 'Paid_Invoices';
        }
    }

    // Filter invoices based on current view
    let filtered = [...state.invoices];
    if (filter === 'paid') {
        filtered = filtered.filter(i => i.status === 'Paid');
    } else if (filter === 'pending') {
        filtered = filtered.filter(i => {
            if (i.status === 'Paid') return false;
            const due = new Date(i.dueDate); due.setHours(0, 0, 0, 0);
            return due >= today;
        });
    } else if (filter === 'overdue') {
        filtered = filtered.filter(i => {
            if (i.status === 'Paid') return false;
            const due = new Date(i.dueDate); due.setHours(0, 0, 0, 0);
            return due < today;
        });
    }

    if (filtered.length === 0) {
        alert('No invoices to export in this category.');
        return;
    }

    // Prepare data for Excel
    const excelData = filtered.map(inv => {
        let status = inv.status || 'Pending';
        if (status !== 'Paid') {
            const dueDate = new Date(inv.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            if (dueDate < today) {
                status = 'Overdue';
            }
        }

        return {
            'Invoice #': inv.number,
            'Client Name': inv.clientName,
            'Client Email': inv.clientEmail,
            'Invoice Date': inv.date,
            'Due Date': inv.dueDate,
            'Status': status,
            'Total Amount': inv.total,
            'Items Count': inv.items.length
        };
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    ws['!cols'] = [
        { wch: 12 }, // Invoice #
        { wch: 20 }, // Client Name
        { wch: 25 }, // Client Email
        { wch: 12 }, // Invoice Date
        { wch: 12 }, // Due Date
        { wch: 10 }, // Status
        { wch: 12 }, // Total Amount
        { wch: 12 }  // Items Count
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');

    // Generate file and trigger download
    const timestamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `${fileName}_${timestamp}.xlsx`);
}

// --- Utils ---
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}
