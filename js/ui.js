import { logout, BASE_PATH } from './auth.js';

const ADMIN_NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', href: '/admin/index.html' },
    { id: 'tests', label: 'Tests', icon: 'quiz', href: '/admin/tests.html' },
    { id: 'questions', label: 'Questions', icon: 'help_outline', href: '/admin/questions.html' },
    { id: 'users', label: 'Users', icon: 'group', href: '/admin/users.html' },
    { id: 'results', label: 'Results', icon: 'assessment', href: '/admin/results.html' },
];

export function renderAdminSidebar(activePage) {
    const navItems = ADMIN_NAV_ITEMS.map(item => {
        const isActive = item.id === activePage;
        const activeClass = isActive
            ? 'bg-primary/5 text-primary font-bold'
            : 'text-slate-500 hover:text-primary hover:bg-slate-50';
        return `
            <a href="${BASE_PATH}${item.href}" class="flex items-center gap-3 py-3 px-4 rounded-xl transition-all duration-300 ${activeClass}">
                <span class="material-symbols-outlined text-[20px]">${item.icon}</span>
                <span class="text-[12px]">${item.label}</span>
            </a>`;
    }).join('');

    return `
        <div class="flex flex-col h-full">
            <div class="p-5 mb-4">
                <div class="flex items-center gap-3">
                    <div class="size-10 bg-gradient-to-br from-primary to-indigo-600 rounded-xl flex items-center justify-center">
                        <span class="material-symbols-outlined text-white text-[20px]">school</span>
                    </div>
                    <div>
                        <div class="text-sm font-bold text-slate-800">LeanTest</div>
                        <div class="text-[10px] text-slate-400 font-medium">Admin Panel</div>
                    </div>
                </div>
            </div>
            <nav class="flex-1 px-3 space-y-1">
                ${navItems}
            </nav>
            <div class="p-3 border-t border-slate-100">
                <button onclick="window.__logout()" class="flex items-center gap-3 py-3 px-4 rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-50 transition-all duration-300 w-full">
                    <span class="material-symbols-outlined text-[20px]">logout</span>
                    <span class="text-[12px]">Sign Out</span>
                </button>
            </div>
        </div>`;
}

export function renderHeader(user, breadcrumb = '') {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    return `
        <div class="flex items-center justify-between h-full px-6">
            <div class="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-medium">${breadcrumb}</div>
            <div class="flex items-center gap-4">
                <div class="text-[11px] font-bold text-slate-700">${dateStr} ${timeStr}</div>
                <div class="flex items-center gap-2 pl-4 border-l border-slate-100">
                    <div class="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-[16px]">person</span>
                    </div>
                    <span class="text-[12px] font-medium text-slate-600">${user.displayName || user.username}</span>
                </div>
            </div>
        </div>`;
}

export function renderStudentHeader(user) {
    return `
        <div class="flex items-center justify-between h-full px-6">
            <div class="flex items-center gap-3">
                <div class="size-10 bg-gradient-to-br from-primary to-indigo-600 rounded-xl flex items-center justify-center">
                    <span class="material-symbols-outlined text-white text-[20px]">school</span>
                </div>
                <div>
                    <div class="text-sm font-bold text-slate-800">LeanTest</div>
                    <div class="text-[10px] text-slate-400 font-medium">Student Portal</div>
                </div>
            </div>
            <div class="flex items-center gap-4">
                <a href="${BASE_PATH}/progress.html" class="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors">
                    <span class="material-symbols-outlined text-[18px]">trending_up</span>
                    <span class="text-[12px] font-medium">My Progress</span>
                </a>
                <div class="flex items-center gap-2 pl-4 border-l border-slate-100">
                    <div class="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary text-[16px]">person</span>
                    </div>
                    <span class="text-[12px] font-medium text-slate-600">${user.displayName || user.username}</span>
                </div>
                <button onclick="window.__logout()" class="size-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors" title="Sign Out">
                    <span class="material-symbols-outlined text-slate-400 text-[18px]">logout</span>
                </button>
            </div>
        </div>`;
}

export function showToast(message, type = 'success') {
    const existing = document.getElementById('toast-container');
    if (existing) existing.remove();

    const colors = {
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        warning: 'bg-amber-500',
        info: 'bg-blue-500'
    };
    const icons = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };

    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = `fixed top-4 right-4 z-50 ${colors[type]} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-[12px] font-medium transition-all duration-300 opacity-0 translate-y-[-8px]`;
    container.innerHTML = `
        <span class="material-symbols-outlined text-[18px]">${icons[type]}</span>
        ${message}`;
    document.body.appendChild(container);

    requestAnimationFrame(() => {
        container.classList.remove('opacity-0', 'translate-y-[-8px]');
        container.classList.add('opacity-100', 'translate-y-0');
    });

    setTimeout(() => {
        container.classList.remove('opacity-100', 'translate-y-0');
        container.classList.add('opacity-0', 'translate-y-[-8px]');
        setTimeout(() => container.remove(), 300);
    }, 3000);
}

export function showModal(title, content, onConfirm, confirmText = 'Confirm', confirmClass = 'bg-primary hover:bg-indigo-600') {
    const existing = document.getElementById('modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center opacity-0 transition-opacity duration-300';
    overlay.innerHTML = `
        <div class="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 transform scale-95 transition-transform duration-300" id="modal-content">
            <h3 class="text-sm font-bold text-slate-800 mb-2">${title}</h3>
            <div class="text-[12px] text-slate-600 mb-6">${content}</div>
            <div class="flex justify-end gap-3">
                <button id="modal-cancel" class="border border-slate-200 text-slate-500 px-4 py-2 rounded-xl text-[11px] font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                <button id="modal-confirm" class="${confirmClass} text-white px-4 py-2 rounded-xl text-[11px] font-bold shadow-lg transition-colors">${confirmText}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.classList.remove('opacity-0');
        overlay.classList.add('opacity-100');
        document.getElementById('modal-content').classList.remove('scale-95');
        document.classList.add('scale-100');
    });

    const close = () => {
        overlay.classList.remove('opacity-100');
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.remove(), 300);
    };

    document.getElementById('modal-cancel').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    document.getElementById('modal-confirm').onclick = () => {
        close();
        if (onConfirm) onConfirm();
    };
}

export function emptyState(icon, message, subtitle = '') {
    return `
        <div class="flex flex-col items-center justify-center py-16">
            <span class="material-symbols-outlined text-slate-300 text-4xl mb-2">${icon}</span>
            <p class="text-sm font-medium text-slate-400">${message}</p>
            ${subtitle ? `<p class="text-[11px] text-slate-400 mt-1">${subtitle}</p>` : ''}
        </div>`;
}

export function statCard(icon, value, label, color = 'text-slate-800') {
    return `
        <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group">
            <span class="material-symbols-outlined text-[18px] text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity">${icon}</span>
            <div class="text-2xl font-bold ${color} mt-2">${value}</div>
            <div class="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-1">${label}</div>
        </div>`;
}

export function badge(text, color = 'slate') {
    const colors = {
        slate: 'bg-slate-100 text-slate-600',
        emerald: 'bg-emerald-50 text-emerald-700',
        amber: 'bg-amber-50 text-amber-700',
        red: 'bg-red-50 text-red-600',
        blue: 'bg-blue-50 text-blue-600',
        indigo: 'bg-indigo-50 text-indigo-700'
    };
    return `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${colors[color] || colors.slate}">${text}</span>`;
}

export function difficultyBadge(difficulty) {
    const map = { easy: 'emerald', medium: 'amber', hard: 'red' };
    return badge(difficulty, map[difficulty] || 'slate');
}

export function initLogout() {
    window.__logout = () => {
        showModal('Sign Out', 'Are you sure you want to sign out?', logout, 'Sign Out', 'bg-red-500 hover:bg-red-600');
    };
}

export function pageShell(sidebarHtml, headerHtml) {
    return { sidebarHtml, headerHtml };
}

// ── Context Menu ──────────────────────────────────────────────────

export function showContextMenu(items, x, y) {
    hideContextMenu();
    const menu = document.createElement('div');
    menu.id = 'context-menu';
    menu.className = 'context-menu';

    // Adjust position to stay within viewport
    const menuWidth = 180;
    const menuHeight = items.length * 40;
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 8;

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    menu.innerHTML = items.map((item, i) => {
        if (item.divider) return '<div class="context-menu-divider"></div>';
        return `
            <div class="context-menu-item ${item.danger ? 'danger' : ''}" data-idx="${i}">
                <span class="material-symbols-outlined text-[16px]">${item.icon}</span>
                <span>${item.label}</span>
            </div>`;
    }).join('');

    document.body.appendChild(menu);

    menu.querySelectorAll('.context-menu-item').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.idx);
            hideContextMenu();
            if (items[idx] && items[idx].action) items[idx].action();
        });
    });

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', hideContextMenu, { once: true });
    }, 10);
}

export function hideContextMenu() {
    const existing = document.getElementById('context-menu');
    if (existing) existing.remove();
}

// ── Folder Picker Modal ───────────────────────────────────────────

export function showFolderPickerModal(treeHtml, onClose) {
    const existing = document.getElementById('folder-picker-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'folder-picker-modal';
    overlay.className = 'fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center opacity-0 transition-opacity duration-300';
    overlay.innerHTML = `
        <div class="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 max-h-[70vh] flex flex-col transform scale-95 transition-transform duration-300" id="picker-modal-content">
            <div class="flex items-center justify-between p-4 border-b border-slate-100">
                <h3 class="text-sm font-bold text-slate-800">Select Question Folder</h3>
                <button id="picker-close" class="size-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
                    <span class="material-symbols-outlined text-slate-400 text-[18px]">close</span>
                </button>
            </div>
            <div class="flex-1 overflow-y-auto p-4" id="picker-tree-container">
                ${treeHtml}
            </div>
            <div class="p-4 border-t border-slate-100 flex justify-end gap-3">
                <button id="picker-cancel" class="border border-slate-200 text-slate-500 px-4 py-2 rounded-xl text-[11px] font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                <button id="picker-confirm" class="bg-primary text-white px-4 py-2 rounded-xl text-[11px] font-bold hover:bg-indigo-600 shadow-lg transition-colors">Select</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.classList.remove('opacity-0');
        overlay.classList.add('opacity-100');
        document.getElementById('picker-modal-content').classList.remove('scale-95');
    });

    const close = () => {
        overlay.classList.remove('opacity-100');
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.remove(), 300);
        if (onClose) onClose();
    };

    document.getElementById('picker-close').onclick = close;
    document.getElementById('picker-cancel').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    return { close, overlay };
}

// ── Prompt Modal (for rename, etc.) ───────────────────────────────

export function showPromptModal(title, placeholder, currentValue, onConfirm) {
    const existing = document.getElementById('modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center opacity-0 transition-opacity duration-300';
    overlay.innerHTML = `
        <div class="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6 transform scale-95 transition-transform duration-300" id="modal-content">
            <h3 class="text-sm font-bold text-slate-800 mb-4">${title}</h3>
            <input type="text" id="prompt-input" value="${currentValue || ''}" placeholder="${placeholder}"
                class="w-full border border-slate-200 rounded-xl px-3 py-2 text-[12px] focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none mb-4" />
            <div class="flex justify-end gap-3">
                <button id="modal-cancel" class="border border-slate-200 text-slate-500 px-4 py-2 rounded-xl text-[11px] font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                <button id="modal-confirm" class="bg-primary hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-[11px] font-bold shadow-lg transition-colors">OK</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.classList.remove('opacity-0');
        overlay.classList.add('opacity-100');
        document.getElementById('modal-content').classList.remove('scale-95');
        document.getElementById('prompt-input').focus();
        document.getElementById('prompt-input').select();
    });

    const close = () => {
        overlay.classList.remove('opacity-100');
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.remove(), 300);
    };

    document.getElementById('modal-cancel').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    document.getElementById('modal-confirm').onclick = () => {
        const value = document.getElementById('prompt-input').value.trim();
        if (value) {
            close();
            onConfirm(value);
        }
    };
    document.getElementById('prompt-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const value = document.getElementById('prompt-input').value.trim();
            if (value) {
                close();
                onConfirm(value);
            }
        }
        if (e.key === 'Escape') close();
    });
}
