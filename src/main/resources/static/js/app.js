// ============================================================
//  BOTTINO MONITORING - app.js
// ============================================================

let sessionToken    = null;
let currentUsername = null;
let currentRole     = null;   // 'configurador' | 'operador'
let currentTab      = 'status';
let editingId       = null;
let schneiderConfig = null;
let allVariables    = { status: [], analog: [], command: [] };
// Tracks per-variable history config: key = "type-id"
let historyConfigs  = {};

// ============================================================
//  DOM REFS
// ============================================================
const loginScreen   = document.getElementById('login-screen');
const tokenScreen   = document.getElementById('token-screen');
const mainScreen    = document.getElementById('main-screen');
const loginForm     = document.getElementById('login-form');
const tokenForm     = document.getElementById('token-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const tokenInput    = document.getElementById('token-input');
const loginError    = document.getElementById('login-error');
const tokenError    = document.getElementById('token-error');

// ============================================================
//  TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type, duration) {
    type     = type     || 'info';
    duration = duration || 3500;
    var container = document.getElementById('toast-container');
    var toast = document.createElement('div');
    var icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.className = 'toast toast-' + type;
    toast.innerHTML =
        '<span class="toast-icon">' + (icons[type] || 'ℹ️') + '</span>' +
        '<span class="toast-msg">'  + escapeHtml(message)   + '</span>' +
        '<button class="toast-close" onclick="this.parentElement.remove()">✕</button>';
    container.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('show'); });
    setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() { if (toast.parentElement) toast.remove(); }, 350);
    }, duration);
}

function showConfirm(message, title) {
    title = title || 'Confirmar';
    return new Promise(function(resolve) {
        document.getElementById('confirm-title').textContent   = title;
        document.getElementById('confirm-message').textContent = message;
        var modal  = document.getElementById('modal-confirm');
        var btnOk  = document.getElementById('confirm-ok');
        var btnCan = document.getElementById('confirm-cancel');
        modal.classList.add('show');
        function cleanup(result) {
            modal.classList.remove('show');
            btnOk.removeEventListener('click', onOk);
            btnCan.removeEventListener('click', onCancel);
            resolve(result);
        }
        function onOk()     { cleanup(true);  }
        function onCancel() { cleanup(false); }
        btnOk.addEventListener('click',  onOk);
        btnCan.addEventListener('click', onCancel);
    });
}

function showPrompt(message, defaultValue, title) {
    defaultValue = defaultValue || '';
    title        = title        || 'Ingresar valor';
    return new Promise(function(resolve) {
        document.getElementById('prompt-title').textContent   = title;
        document.getElementById('prompt-message').textContent = message;
        var input  = document.getElementById('prompt-input');
        input.value = defaultValue;
        var modal  = document.getElementById('modal-prompt');
        var btnOk  = document.getElementById('prompt-ok');
        var btnCan = document.getElementById('prompt-cancel');
        modal.classList.add('show');
        setTimeout(function() { input.focus(); input.select(); }, 80);
        function cleanup(result) {
            modal.classList.remove('show');
            btnOk.removeEventListener('click',  onOk);
            btnCan.removeEventListener('click',  onCancel);
            input.removeEventListener('keydown', onKey);
            resolve(result);
        }
        function onOk()     { cleanup(input.value.trim() || null); }
        function onCancel() { cleanup(null); }
        function onKey(e) {
            if (e.key === 'Enter')  onOk();
            if (e.key === 'Escape') onCancel();
        }
        btnOk.addEventListener('click',  onOk);
        btnCan.addEventListener('click', onCancel);
        input.addEventListener('keydown', onKey);
    });
}

// ============================================================
//  BOOTSTRAP
// ============================================================
initEventListeners();
checkSession();

function initEventListeners() {
    loginForm.addEventListener('submit', handleLogin);
    tokenForm.addEventListener('submit', handleTokenValidation);
    document.getElementById('token-back-btn').addEventListener('click', backToLogin);

    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { switchTab(btn.dataset.tab); });
    });
    document.querySelectorAll('.add-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { showAddForm(btn.dataset.type); });
    });
    document.querySelectorAll('.batch-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { showBatchSection(btn.dataset.type); });
    });
    document.querySelectorAll('.variable-form').forEach(function(f) {
        f.addEventListener('submit', handleSaveVariable);
    });
    document.querySelectorAll('.cancel-form-btn').forEach(function(btn) {
        btn.addEventListener('click', hideForm);
    });
    document.querySelectorAll('.batch-cancel-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { hideBatchSection(btn.dataset.type); });
    });

    ['status', 'analog', 'command'].forEach(function(t) {
        document.getElementById(t + '-upload-btn').addEventListener('click', function() {
            document.getElementById(t + '-csv-input').click();
        });
        document.getElementById(t + '-csv-input').addEventListener('change', function(e) {
            handleCSVUpload(e, t);
        });
    });

    document.getElementById('excel-import-btn').addEventListener('click', function() {
        document.getElementById('excel-import-input').click();
    });
    document.getElementById('excel-import-input').addEventListener('change', handleExcelUpload);

    document.querySelectorAll('.sidebar-nav-item').forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            switchSidebarTab(item.dataset.sidebar);
        });
    });

    var userMenu = document.getElementById('user-menu');
    userMenu.addEventListener('click', function(e) {
        e.stopPropagation();
        userMenu.classList.toggle('open');
        document.getElementById('user-dropdown').classList.toggle('show');
    });
    document.addEventListener('click', function() {
        userMenu.classList.remove('open');
        document.getElementById('user-dropdown').classList.remove('show');
    });

    document.getElementById('menu-user-info').addEventListener('click', openUserInfoModal);
    document.getElementById('menu-schneider-config').addEventListener('click', openSchneiderConfigModal);
    document.getElementById('menu-logout').addEventListener('click', handleLogout);

    document.querySelectorAll('[data-modal]').forEach(function(el) {
        el.addEventListener('click', function() { closeModal(el.dataset.modal); });
    });
    document.querySelectorAll('.modal-overlay').forEach(function(ov) {
        ov.addEventListener('click', function(e) {
            if (e.target === ov && ov.id !== 'modal-confirm' && ov.id !== 'modal-prompt') closeModal(ov.id);
        });
    });

    document.getElementById('btn-save-config').addEventListener('click', handleConfigSave);
    document.getElementById('btn-test-connection').addEventListener('click', openTestConnectionModal);
    document.getElementById('btn-run-test').addEventListener('click', handleTestConnection);

    document.getElementById('btn-save-symbol-props').addEventListener('click', saveSymbolProps);
    document.getElementById('sym-var-type').addEventListener('change', onSymVarTypeChange);
    document.getElementById('sym-var-name').addEventListener('change', onSymVarNameChange);
    document.getElementById('sym-var-condition').addEventListener('change', onSymConditionChange);

    document.getElementById('btn-new-panel').addEventListener('click', createNewPanel);
    document.getElementById('btn-save-panel').addEventListener('click', saveCurrentPanel);

    document.getElementById('tool-select').addEventListener('click',  function() { setPanelTool('select'); });
    document.getElementById('tool-connect').addEventListener('click', function() { setPanelTool('connect'); });
    var toolTextBtn    = document.getElementById('tool-text');
    var toolVartextBtn = document.getElementById('tool-vartext');
    if (toolTextBtn)    toolTextBtn.addEventListener('click',    function() { setPanelTool('text'); });
    if (toolVartextBtn) toolVartextBtn.addEventListener('click', function() { setPanelTool('vartext'); });
    document.getElementById('tool-delete').addEventListener('click',  deleteSelected);
    document.getElementById('tool-clear').addEventListener('click',   clearCanvas);
}

// ============================================================
//  AUTH
// ============================================================
function checkSession() {
    var t = localStorage.getItem('sessionToken');
    var u = localStorage.getItem('username');
    var r = localStorage.getItem('userRole');
    if (t && u) { sessionToken = t; currentUsername = u; currentRole = r || 'configurador'; showMainScreen(); }
}

async function handleLogin(e) {
    e.preventDefault();
    var username = usernameInput.value.trim();
    var password = passwordInput.value.trim();
    try {
        var r    = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: username, password: password }) });
        var data = await r.json();
        if (!data.success) { showError(loginError, data.message); return; }
        currentUsername = username;
        currentRole     = data.role || 'configurador';
        if (data.requiresToken) {
            loginScreen.classList.remove('active');
            tokenScreen.classList.add('active');
        } else {
            sessionToken = data.sessionToken;
            localStorage.setItem('sessionToken', sessionToken);
            localStorage.setItem('username', username);
            localStorage.setItem('userRole', currentRole);
            showMainScreen();
        }
    } catch(err) { showError(loginError, 'Connection error. Please try again.'); }
}

async function handleTokenValidation(e) {
    e.preventDefault();
    var token = tokenInput.value.trim();
    try {
        var r    = await fetch('/api/auth/validate-token', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: currentUsername, token: token }) });
        var data = await r.json();
        if (!data.success) { showError(tokenError, data.message); return; }
        sessionToken = data.sessionToken;
        currentRole  = data.role || 'configurador';
        localStorage.setItem('sessionToken', sessionToken);
        localStorage.setItem('username', currentUsername);
        localStorage.setItem('userRole', currentRole);
        showMainScreen();
    } catch(err) { showError(tokenError, 'Connection error. Please try again.'); }
}

function handleLogout() {
    sessionToken = null; currentUsername = null; currentRole = null; schneiderConfig = null;
    localStorage.removeItem('sessionToken'); localStorage.removeItem('username'); localStorage.removeItem('userRole');
    loginScreen.classList.add('active');
    tokenScreen.classList.remove('active');
    mainScreen.classList.remove('active');
    usernameInput.value = ''; passwordInput.value = ''; tokenInput.value = '';
    hideError(loginError); hideError(tokenError);
    if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
    panelDataReady = false;
}

function backToLogin() {
    tokenScreen.classList.remove('active');
    loginScreen.classList.add('active');
    tokenInput.value = ''; hideError(tokenError);
}

function showMainScreen() {
    loginScreen.classList.remove('active');
    tokenScreen.classList.remove('active');
    mainScreen.classList.add('active');
    document.getElementById('user-avatar').textContent     = (currentUsername || 'U')[0].toUpperCase();
    document.getElementById('user-name-label').textContent = currentUsername || 'User';
    applyRoleUI();
    switchSidebarTab('variables');
    switchTab('status');
    loadSchneiderConfig();
    loadAllVariablesCache();
    initPanelCanvas();
    buildSymbolPalette();
    loadPanelListFromDB();
    startVariablePolling();
}

// ============================================================
//  ROLE-BASED UI
// ============================================================
function isOperador() { return currentRole === 'operador'; }

function applyRoleUI() {
    var op = isOperador();
    // Hide Variables tab for operador
    var varNavItem = document.querySelector('.sidebar-nav-item[data-sidebar="variables"]');
    if (varNavItem) varNavItem.style.display = op ? 'none' : '';
    // If operador and currently on variables tab, switch to panel
    if (op && document.getElementById('sidebar-variables') && document.getElementById('sidebar-variables').classList.contains('active')) {
        switchSidebarTab('panel');
    }

    // Role badge next to username
    var roleLabel = document.getElementById('user-role-label');
    if (roleLabel) {
        roleLabel.textContent = op ? 'OPERADOR' : 'CONFIGURADOR';
        roleLabel.className   = 'user-role-badge ' + (op ? 'role-operador' : 'role-configurador');
    }

    // Panel tools: hide edit tools for operador
    var editOnlyEls = document.querySelectorAll('.operator-hide');
    editOnlyEls.forEach(function(el) { el.style.display = op ? 'none' : ''; });

    // Symbol palette & search: hide for operador (can't drag symbols)
    var paletteSection = document.getElementById('palette-section');
    if (paletteSection) paletteSection.style.display = op ? 'none' : '';
}

// ============================================================
//  TAB SWITCHING
// ============================================================
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.tab === tab); });
    document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
    document.getElementById(tab + '-tab').classList.add('active');
    loadVariables(tab);
}

function switchSidebarTab(name) {
    // Auto-save panel when leaving the panel view (configurador only)
    var wasOnPanel = document.getElementById('view-panel') && document.getElementById('view-panel').classList.contains('active');
    if (wasOnPanel && name !== 'panel' && !isOperador() && currentPanelId && panelDataReady) {
        saveCurrentPanel();
    }
    document.querySelectorAll('.sidebar-nav-item').forEach(function(b) { b.classList.toggle('active', b.dataset.sidebar === name); });
    document.querySelectorAll('.sidebar-pane').forEach(function(p) { p.classList.remove('active'); });
    document.getElementById('sidebar-' + name).classList.add('active');
    document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
    if (name === 'panel') {
        document.getElementById('view-panel').classList.add('active');
        setTimeout(resizePanelCanvas, 50);
        loadAllVariablesCache().then(function() {
            evaluateAllSymbolRules();
            refreshAllVisuals();
        });
    } else if (name === 'oscilo') {
        document.getElementById('view-oscilo').classList.add('active');
    } else {
        document.getElementById('view-variables').classList.add('active');
    }
}

// ============================================================
//  VARIABLES
// ============================================================
async function loadVariables(type) {
    try {
        var headers = currentUsername ? { 'X-Username': currentUsername } : {};
        var r = await fetch('/api/variables/' + type, { headers: headers });
        if (!r.ok) throw new Error();
        var vars = await r.json();
        allVariables[type] = vars;
        await loadHistoryConfigs(type, vars);
        renderTable(type, vars);
    } catch(err) {
        document.getElementById(type + '-tbody').innerHTML = '<tr><td colspan="5" class="loading" style="color:red;">Error loading data.</td></tr>';
    }
}

function renderTable(type, variables) {
    var tbody = document.getElementById(type + '-tbody');
    if (!variables.length) { tbody.innerHTML = '<tr><td colspan="5" class="loading">No variables found.</td></tr>'; return; }
    tbody.innerHTML = variables.map(function(v) {
        var cfg = historyConfigs[type + '-' + v.id] || { saveHistory: false, saveMaxHistory: false };
        var verBtn = cfg.saveHistory || cfg.saveMaxHistory
            ? '<button class="btn btn-history-view" onclick="openHistoryModal(\'' + type + '\',' + v.id + ',\'' + escapeHtml(v.name) + '\')">📈 Ver historial variables</button>'
            : '';
        // 3-dot menu items
        var menuItems = '';
        if (!cfg.saveHistory) {
            menuItems += '<li onclick="enableHistory(\'' + type + '\',' + v.id + ',\'history\')">💾 Guardar variables historial</li>';
        } else {
            menuItems += '<li class="active-item" onclick="disableHistory(\'' + type + '\',' + v.id + ',\'history\')">✅ Historial activo (desactivar)</li>';
        }
        if (!cfg.saveMaxHistory) {
            menuItems += '<li onclick="enableHistory(\'' + type + '\',' + v.id + ',\'max\')">📊 Guardar variables historial maximos</li>';
        } else {
            menuItems += '<li class="active-item" onclick="disableHistory(\'' + type + '\',' + v.id + ',\'max\')">✅ Historial máx. activo (desactivar)</li>';
        }

        return '<tr>' +
            '<td>' + v.id + '</td>' +
            '<td><strong>' + escapeHtml(v.name) + '</strong></td>' +
            '<td>' + escapeHtml(String(v.value)) + '</td>' +
            '<td>' + escapeHtml(v.description || '-') + '</td>' +
            '<td><div class="action-buttons">' +
            verBtn +
            '<button class="btn btn-warning" onclick="editVariable(\'' + type + '\',' + v.id + ')">✏️ Edit</button>' +
            '<button class="btn btn-danger"  onclick="deleteVariable(\'' + type + '\',' + v.id + ')">🗑️ Delete</button>' +
            '<div class="three-dot-wrapper">' +
              '<button class="btn btn-three-dot" onclick="toggleDotMenu(event,\'' + type + '-dot-' + v.id + '\')">⋯</button>' +
              '<ul class="dot-menu" id="' + type + '-dot-' + v.id + '">' + menuItems + '</ul>' +
            '</div>' +
            '</div></td></tr>';
    }).join('');
}

// ============================================================
//  HISTORY CONFIG LOADING
// ============================================================
async function loadHistoryConfigs(type, variables) {
    for (var i = 0; i < variables.length; i++) {
        var v = variables[i];
        var key = type + '-' + v.id;
        try {
            var r = await fetch('/api/variables/history/' + type + '/' + v.id + '/config');
            if (r.ok) { historyConfigs[key] = await r.json(); }
        } catch(e) { historyConfigs[key] = { saveHistory: false, saveMaxHistory: false }; }
    }
}

function toggleDotMenu(e, menuId) {
    e.stopPropagation();
    // Close all other dot menus
    document.querySelectorAll('.dot-menu.open').forEach(function(m) {
        if (m.id !== menuId) m.classList.remove('open');
    });
    var menu = document.getElementById(menuId);
    if (menu) menu.classList.toggle('open');
}

// Close dot menus on outside click
document.addEventListener('click', function() {
    document.querySelectorAll('.dot-menu.open').forEach(function(m) { m.classList.remove('open'); });
});

async function enableHistory(type, id, mode) {
    var key = type + '-' + id;
    document.querySelectorAll('.dot-menu.open').forEach(function(m) { m.classList.remove('open'); });
    try {
        var r = await fetch('/api/variables/history/' + type + '/' + id + '/enable', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: mode })
        });
        if (r.ok) {
            var cfg = historyConfigs[key] || { saveHistory: false, saveMaxHistory: false };
            if (mode === 'max') cfg.saveMaxHistory = true;
            else cfg.saveHistory = true;
            historyConfigs[key] = cfg;
            var label = mode === 'max' ? 'historial de máximos' : 'historial';
            showToast('✅ Guardado de ' + label + ' activado', 'success');
            // Re-render current tab
            renderTable(currentTab, allVariables[currentTab]);
        }
    } catch(e) { showToast('Error al activar historial', 'error'); }
}

async function disableHistory(type, id, mode) {
    var key = type + '-' + id;
    document.querySelectorAll('.dot-menu.open').forEach(function(m) { m.classList.remove('open'); });
    try {
        var r = await fetch('/api/variables/history/' + type + '/' + id + '/disable', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: mode })
        });
        if (r.ok) {
            var cfg = historyConfigs[key] || { saveHistory: false, saveMaxHistory: false };
            if (mode === 'max') cfg.saveMaxHistory = false;
            else cfg.saveHistory = false;
            historyConfigs[key] = cfg;
            var label = mode === 'max' ? 'historial de máximos' : 'historial';
            showToast('⏹ Guardado de ' + label + ' desactivado', 'info');
            renderTable(currentTab, allVariables[currentTab]);
        }
    } catch(e) { showToast('Error al desactivar historial', 'error'); }
}

async function loadAllVariablesCache() {
    for (var i = 0; i < ['status','analog','command'].length; i++) {
        var type = ['status','analog','command'][i];
        try {
            var headers = currentUsername ? { 'X-Username': currentUsername } : {};
            var r = await fetch('/api/variables/' + type, { headers: headers, cache: 'no-store' });
            allVariables[type] = r.ok ? await r.json() : [];
        } catch(err) { allVariables[type] = []; }
    }
}

// ============================================================
//  POLLING
// ============================================================
var pollingInterval = null;

function startVariablePolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(async function() {
        try {
            await loadAllVariablesCache();
            renderTable(currentTab, allVariables[currentTab]);
            evaluateAllSymbolRules();
            canvasSymbols.forEach(function(s) { updateSymbolDrawing(s); });
            varTextLabels.forEach(function(l) { updateVarTextElement(l); });
            checkRTUAlert();
        } catch(e) { console.error('[poll error]', e); }
    }, 1000);
}

function checkRTUAlert() {
    var all = allVariables.status.concat(allVariables.analog).concat(allVariables.command);
    var disconnected = all.some(function(v) { return String(v.value) === '-99'; });
    var banner = document.getElementById('rtu-alert-banner');
    if (banner) banner.style.display = disconnected ? 'flex' : 'none';
}

function evaluateAllSymbolRules() {
    canvasSymbols.forEach(function(sym) {
        var rule = sym.props.rule;
        if (!rule || !rule.varType || !rule.varName || !rule.condition) return;
        var vars   = allVariables[rule.varType] || [];
        var varObj = vars.find(function(v) { return v.name === rule.varName; });
        if (!varObj) return;
        var val    = parseFloat(varObj.value);
        var thresh = parseFloat(rule.threshold);
        var match  = false;
        if      (rule.condition === 'eq') match = String(varObj.value) === String(rule.threshold);
        else if (rule.condition === 'gt') match = !isNaN(val) && !isNaN(thresh) && val > thresh;
        else if (rule.condition === 'lt') match = !isNaN(val) && !isNaN(thresh) && val < thresh;
        sym.props.ruleActiveColor = match ? rule.actionColor : null;
        updateSymbolDrawing(sym);
    });
}

// ============================================================
//  FORM FUNCTIONS
// ============================================================
function showAddForm(type) {
    hideBatchSection(type);
    var sec  = document.getElementById(type + '-form-section');
    var form = sec.querySelector('.variable-form');
    document.getElementById(type + '-form-title').textContent = 'New ' + capitalize(type) + ' Variable';
    form.querySelector('.variable-name').value        = '';
    form.querySelector('.variable-description').value = '';
    var vf = form.querySelector('.value-field');
    if (vf) vf.style.display = 'none';
    editingId = null;
    sec.style.display = 'block';
    form.querySelector('.variable-name').focus();
}

function hideForm() {
    document.querySelectorAll('.form-section').forEach(function(s) { s.style.display = 'none'; });
    editingId = null;
}

async function handleSaveVariable(e) {
    e.preventDefault();
    var form = e.target, type = form.dataset.type;
    var name        = form.querySelector('.variable-name').value.trim();
    var description = form.querySelector('.variable-description').value.trim();
    var variableData = { name: name, value: '', description: description || null };
    if (editingId) {
        var vi = form.querySelector('.variable-value');
        if (vi) variableData.value = vi.value.trim();
    }
    try {
        var url    = editingId ? '/api/variables/' + type + '/' + editingId : '/api/variables/' + type;
        var method = editingId ? 'PUT' : 'POST';
        var headers = { 'Content-Type': 'application/json' };
        if (currentUsername) headers['X-Username'] = currentUsername;
        var r = await fetch(url, { method: method, headers: headers, body: JSON.stringify(variableData) });
        if (r.ok) { hideForm(); loadVariables(type); showToast('Variable guardada correctamente', 'success'); }
        else showToast('Error al guardar la variable', 'error');
    } catch(err) { showToast('Error de conexión al guardar', 'error'); }
}

async function editVariable(type, id) {
    try {
        var r    = await fetch('/api/variables/' + type);
        var vars = await r.json();
        var v    = vars.find(function(x) { return x.id === id; });
        if (!v) return;
        hideBatchSection(type);
        var sec  = document.getElementById(type + '-form-section');
        var form = sec.querySelector('.variable-form');
        document.getElementById(type + '-form-title').textContent = 'Edit ' + capitalize(type) + ' Variable';
        form.querySelector('.variable-name').value        = v.name;
        form.querySelector('.variable-description').value = v.description || '';
        var vf = form.querySelector('.value-field');
        var vi = form.querySelector('.variable-value');
        if (vf && vi) { vf.style.display = 'block'; vi.value = v.value || ''; }
        editingId = id;
        sec.style.display = 'block';
        form.querySelector('.variable-name').focus();
    } catch(err) { showToast('Error al cargar la variable', 'error'); }
}

async function deleteVariable(type, id) {
    var ok = await showConfirm('¿Está seguro que desea eliminar esta variable?', 'Eliminar variable');
    if (!ok) return;
    try {
        var r = await fetch('/api/variables/' + type + '/' + id, { method: 'DELETE' });
        if (r.ok) { loadVariables(type); showToast('Variable eliminada', 'success'); }
        else showToast('Error al eliminar la variable', 'error');
    } catch(err) { showToast('Error de conexión', 'error'); }
}

// ============================================================
//  BATCH IMPORT
// ============================================================
function showBatchSection(type) {
    hideForm();
    document.getElementById(type + '-batch').style.display = 'block';
    var rd = document.getElementById(type + '-batch-result');
    rd.className = 'batch-result'; rd.textContent = '';
}
function hideBatchSection(type) {
    document.getElementById(type + '-batch').style.display = 'none';
    document.getElementById(type + '-csv-input').value = '';
    var rd = document.getElementById(type + '-batch-result');
    rd.className = 'batch-result'; rd.textContent = '';
}
async function handleCSVUpload(event, type) {
    var file = event.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) { showToast('Por favor seleccione un archivo CSV', 'warning'); return; }
    var formData = new FormData();
    formData.append('file', file);
    var rd = document.getElementById(type + '-batch-result');
    rd.className = 'batch-result'; rd.textContent = 'Uploading...'; rd.style.display = 'block';
    try {
        var headers = currentUsername ? { 'X-Username': currentUsername } : {};
        var r    = await fetch('/api/variables/' + type + '/import-csv', { method:'POST', headers: headers, body: formData });
        var data = await r.json();
        if (data.success) {
            rd.className = 'batch-result success'; rd.textContent = '✓ ' + data.message;
            loadVariables(type);
            setTimeout(function() { hideBatchSection(type); }, 3000);
        } else { rd.className = 'batch-result error'; rd.textContent = '✗ ' + data.message; }
    } catch(err) { rd.className = 'batch-result error'; rd.textContent = '✗ Error: ' + err.message; }
    event.target.value = '';
}

async function handleExcelUpload(event) {
    var file = event.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
        showToast('Por favor seleccione un archivo .xlsx', 'warning');
        event.target.value = '';
        return;
    }
    var formData = new FormData();
    formData.append('file', file);
    var rd = document.getElementById('excel-import-result');
    rd.className = 'batch-result'; rd.textContent = 'Uploading...'; rd.style.display = 'inline-block';
    try {
        var headers = currentUsername ? { 'X-Username': currentUsername } : {};
        var r = await fetch('/api/variables/import-excel', { method: 'POST', headers: headers, body: formData });
        var data = await r.json();
        if (data.success) {
            rd.className = 'batch-result success'; rd.textContent = '✓ ' + data.message;
            showToast(data.message, 'success');
            ['status', 'analog', 'command'].forEach(loadVariables);
            setTimeout(function() { rd.style.display = 'none'; }, 6000);
        } else {
            rd.className = 'batch-result error'; rd.textContent = '✗ ' + data.message;
        }
    } catch (err) {
        rd.className = 'batch-result error'; rd.textContent = '✗ Error: ' + err.message;
    }
    event.target.value = '';
}

// ============================================================
//  MODALS
// ============================================================
function openModal(id)  { document.getElementById(id).classList.add('show'); }
// ============================================================
//  HISTORY CHART MODAL
// ============================================================
var historyChartInstance = null;

async function openHistoryModal(type, id, name) {
    document.getElementById('history-modal-title').textContent = '📈 Historial: ' + name;
    document.getElementById('history-modal').classList.add('show');
    // Default: line chart, history (not max)
    window._historyModal = { type: type, id: id, name: name, chartType: 'line', trackingType: 'history' };
    // Set active toggle buttons
    document.querySelectorAll('.hm-chart-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.chart === 'line');
    });
    document.querySelectorAll('.hm-track-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.track === 'history');
    });
    await loadAndDrawHistory();
}

async function loadAndDrawHistory() {
    var m = window._historyModal;
    var url = '/api/variables/history/' + m.type + '/' + m.id + '/data?trackingType=' + m.trackingType;
    document.getElementById('history-chart-loading').style.display = 'block';
    document.getElementById('history-chart-empty').style.display = 'none';
    try {
        var r = await fetch(url);
        var records = r.ok ? await r.json() : [];
        document.getElementById('history-chart-loading').style.display = 'none';
        if (!records.length) {
            document.getElementById('history-chart-empty').style.display = 'block';
            if (historyChartInstance) { historyChartInstance.destroy(); historyChartInstance = null; }
            return;
        }
        drawHistoryChart(records, m.chartType, m.name);
    } catch(e) {
        document.getElementById('history-chart-loading').style.display = 'none';
        document.getElementById('history-chart-empty').style.display = 'block';
    }
}

function drawHistoryChart(records, chartType, name) {
    var labels = records.map(function(r) {
        var d = new Date(r.recordedAt);
        return d.toLocaleString('es-AR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    });
    var values = records.map(function(r) { return parseFloat(r.value) || 0; });

    var canvas = document.getElementById('history-chart-canvas');
    var ctx = canvas.getContext('2d');

    if (historyChartInstance) { historyChartInstance.destroy(); historyChartInstance = null; }

    var chartColors = {
        primary: 'rgba(255, 180, 0, 1)',
        fill: 'rgba(255, 180, 0, 0.15)',
        bars: values.map(function(v, i) {
            var hue = (i / values.length) * 60 + 20;
            return 'hsla(' + hue + ', 90%, 55%, 0.85)';
        }),
        pie: [
            '#FFB400','#FF6B35','#4ECDC4','#45B7D1','#96CEB4',
            '#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE'
        ]
    };

    var dataset = {};
    if (chartType === 'pie') {
        // Pie: aggregate by value
        var counts = {};
        values.forEach(function(v) { counts[v] = (counts[v] || 0) + 1; });
        var pieLabels = Object.keys(counts);
        var pieData   = pieLabels.map(function(k) { return counts[k]; });
        dataset = {
            type: 'pie',
            data: {
                labels: pieLabels,
                datasets: [{ data: pieData, backgroundColor: chartColors.pie, borderColor: '#1a1a2e', borderWidth: 2 }]
            }
        };
    } else if (chartType === 'bar') {
        dataset = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{ label: name, data: values, backgroundColor: chartColors.bars, borderColor: chartColors.primary, borderWidth: 1, borderRadius: 4 }]
            }
        };
    } else {
        // line (default)
        dataset = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{ label: name, data: values, borderColor: chartColors.primary, backgroundColor: chartColors.fill, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, fill: true, tension: 0.3 }]
            }
        };
    }

    var options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#e0e0e0', font: { size: 13 } } },
            tooltip: { backgroundColor: '#1e2235', titleColor: '#FFB400', bodyColor: '#e0e0e0' }
        }
    };

    if (chartType !== 'pie') {
        options.scales = {
            x: { ticks: { color: '#9fa8c0', maxRotation: 45, font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { ticks: { color: '#9fa8c0' }, grid: { color: 'rgba(255,255,255,0.08)' } }
        };
    }

    historyChartInstance = new Chart(ctx, { type: dataset.type, data: dataset.data, options: options });
}

function closeHistoryModal() {
    document.getElementById('history-modal').classList.remove('show');
    if (historyChartInstance) { historyChartInstance.destroy(); historyChartInstance = null; }
}

function setHistoryChartType(chartType) {
    window._historyModal.chartType = chartType;
    document.querySelectorAll('.hm-chart-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.chart === chartType);
    });
    loadAndDrawHistory();
}

function setHistoryTrackingType(trackingType) {
    window._historyModal.trackingType = trackingType;
    document.querySelectorAll('.hm-track-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.track === trackingType);
    });
    loadAndDrawHistory();
}

function closeModal(id) { document.getElementById(id).classList.remove('show'); }

function openUserInfoModal() {
    document.getElementById('ui-username').textContent = currentUsername || '-';
    if (schneiderConfig && schneiderConfig.hasConfig) {
        document.getElementById('ui-schneider-status').textContent = '✅ Configured';
        document.getElementById('ui-rtu-ip').textContent           = schneiderConfig.rtuIp || '-';
        document.getElementById('ui-schneider-user').textContent   = schneiderConfig.schneiderUsername || '-';
    } else {
        document.getElementById('ui-schneider-status').textContent = '⚠️ Not configured';
        document.getElementById('ui-rtu-ip').textContent           = '-';
        document.getElementById('ui-schneider-user').textContent   = '-';
    }
    document.getElementById('modal-avatar-big').textContent = (currentUsername || 'U')[0].toUpperCase();
    openModal('modal-user-info');
}
function openSchneiderConfigModal() { loadSchneiderConfigIntoModal(); openModal('modal-schneider-config'); }
function openTestConnectionModal() {
    document.getElementById('test-schneider-user').value = document.getElementById('config-schneider-username').value;
    document.getElementById('test-rtu-ip').value          = document.getElementById('config-rtu-ip').value;
    document.getElementById('test-schneider-pass').value  = '';
    var rd = document.getElementById('test-conn-result');
    rd.textContent = ''; rd.classList.remove('show');
    openModal('modal-test-conn');
}

// ============================================================
//  SCHNEIDER CONFIG
// ============================================================
async function loadSchneiderConfig() {
    if (!currentUsername) return;
    try {
        var r = await fetch('/api/auth/schneider-config/' + currentUsername);
        if (r.ok) schneiderConfig = await r.json();
    } catch(err) {}
}
async function loadSchneiderConfigIntoModal() {
    await loadSchneiderConfig();
    var cfg     = schneiderConfig;
    var infoBox = document.getElementById('config-current-info');
    if (cfg && cfg.hasConfig) {
        infoBox.style.display = 'block';
        document.getElementById('current-schneider-username').textContent = cfg.schneiderUsername || '-';
        document.getElementById('current-rtu-ip').textContent             = cfg.rtuIp || '-';
        document.getElementById('config-status').textContent              = 'Configured';
        document.getElementById('config-schneider-username').value        = cfg.schneiderUsername || '';
        document.getElementById('config-rtu-ip').value                    = cfg.rtuIp || '';
    } else {
        infoBox.style.display = 'none';
        document.getElementById('config-status').textContent = 'Not configured';
    }
}
async function handleConfigSave() {
    var schneiderUsername = document.getElementById('config-schneider-username').value.trim();
    var schneiderPassword = document.getElementById('config-schneider-password').value.trim();
    var rtuIp             = document.getElementById('config-rtu-ip').value.trim();
    var msg               = document.getElementById('config-message');
    if (!schneiderUsername || !schneiderPassword || !rtuIp) { showMsgEl(msg, 'Todos los campos son requeridos.', false); return; }
    try {
        var r    = await fetch('/api/auth/schneider-config', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: currentUsername, schneiderUsername: schneiderUsername, schneiderPassword: schneiderPassword, rtuIp: rtuIp }) });
        var data = await r.json();
        if (!data.success) { showMsgEl(msg, data.message, false); return; }
        showMsgEl(msg, data.message, true);
        document.getElementById('config-schneider-password').value = '';
        await loadSchneiderConfig();
        loadSchneiderConfigIntoModal();
        showToast('Configuración Schneider guardada', 'success');
        setTimeout(function() { msg.classList.remove('show'); }, 3000);
    } catch(err) { showMsgEl(msg, 'Error de conexión.', false); }
}
async function handleTestConnection() {
    var user = document.getElementById('test-schneider-user').value.trim();
    var pass = document.getElementById('test-schneider-pass').value.trim();
    var ip   = document.getElementById('test-rtu-ip').value.trim();
    var rd   = document.getElementById('test-conn-result');
    if (!user || !pass || !ip) { showMsgEl(rd, 'Todos los campos son requeridos.', false); return; }
    showMsgEl(rd, '⏳ Probando conexión...', true);
    try {
        var r    = await fetch('/api/auth/schneider-config', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: currentUsername, schneiderUsername: user, schneiderPassword: pass, rtuIp: ip }) });
        var data = await r.json();
        showMsgEl(rd, data.success ? '✅ Conexión exitosa. RTU alcanzable.' : '❌ Falló: ' + data.message, data.success);
    } catch(err) { showMsgEl(rd, '❌ Error de red durante la prueba.', false); }
}
function showMsgEl(el, text, success) {
    el.textContent      = text;
    el.style.background = success ? '#d4edda' : '#f8d7da';
    el.style.color      = success ? '#155724' : '#721c24';
    el.classList.add('show');
}

// ============================================================
//  MULTI-PANEL — DB PERSISTENCE via /api/panels
// ============================================================
var panels         = {};
var currentPanelId = null;
var panelDataReady = false;
var panelDirty     = false;

function markPanelDirty() {
    if (!panelDataReady) return;
    panelDirty = true;
    updateSaveButton();
    renderPanelList();
}

function updateSaveButton() {
    var btn = document.getElementById('btn-save-panel');
    if (!btn) return;
    btn.disabled     = !panelDirty;
    btn.style.opacity = panelDirty ? '' : '0.45';
}

async function loadPanelListFromDB() {
    if (!currentUsername) return;
    try {
        var r    = await fetch('/api/panels', { headers: { 'X-Username': currentUsername } });
        if (!r.ok) throw new Error();
        var list = await r.json();
        panels = {};
        list.forEach(function(p) {
            var canvas = { symbols: [], connections: [] };
            try { canvas = JSON.parse(p.canvasData || '{}'); } catch(e) {}
            panels[p.id] = { id: p.id, name: p.name, symbols: canvas.symbols || [], connections: canvas.connections || [], textLabels: canvas.textLabels || [], varTextLabels: canvas.varTextLabels || [] };
        });
        renderPanelList();
        var ids = Object.keys(panels).map(Number);
        if (ids.length > 0) loadPanel(ids[0]);
        else doCreatePanel('Panel Principal');
    } catch(err) { showToast('Error al cargar paneles — reintentando...', 'error'); setTimeout(loadPanelListFromDB, 5000); }
}

function renderPanelList() {
    var listEl = document.getElementById('panel-list');
    listEl.innerHTML = '';
    var ids = Object.keys(panels).map(Number);
    if (!ids.length) { listEl.innerHTML = '<div class="panel-list-empty">Sin paneles</div>'; return; }
    ids.forEach(function(id) {
        var p   = panels[id];
        var div = document.createElement('div');
        div.className = 'panel-list-item' + (id === currentPanelId ? ' active' : '');
        div.innerHTML =
            '<span class="panel-list-name">' + escapeHtml(p.name) + (panelDirty && id === currentPanelId ? ' *' : '') + '</span>' +
            (!isOperador() ? '<button class="panel-list-del" data-id="' + id + '" title="Eliminar panel">✕</button>' : '');
        div.addEventListener('click', function(e) {
            if (e.target.classList.contains('panel-list-del')) {
                e.stopPropagation();
                deletePanel(Number(e.target.dataset.id));
            } else {
                // Auto-save current panel before switching (configurador only)
                if (!isOperador() && currentPanelId && currentPanelId !== id) {
                    saveCurrentPanel().then(function() { loadPanel(id); });
                } else {
                    loadPanel(id);
                }
            }
        });
        listEl.appendChild(div);
    });
}

async function createNewPanel() {
    var name = await showPrompt('Nombre del nuevo panel:', 'Panel ' + (Object.keys(panels).length + 1), 'Nuevo Panel');
    if (!name) return;
    doCreatePanel(name);
}

async function doCreatePanel(name) {
    try {
        var headers = { 'Content-Type': 'application/json', 'X-Username': currentUsername };
        var body    = JSON.stringify({ name: name, canvasData: JSON.stringify({ symbols: [], connections: [] }) });
        var r       = await fetch('/api/panels', { method: 'POST', headers: headers, body: body });
        if (!r.ok) throw new Error();
        var saved = await r.json();
        panels[saved.id] = { id: saved.id, name: saved.name, symbols: [], connections: [], textLabels: [], varTextLabels: [] };
        renderPanelList();
        loadPanel(saved.id);
        showToast('Panel "' + saved.name + '" creado', 'success');
    } catch(err) { showToast('Error al crear el panel', 'error'); }
}

function loadPanel(id) {
    id = Number(id);
    if (!panels[id]) return;
    currentPanelId = id;
    var data = panels[id];
    canvasSymbols = data.symbols     ? JSON.parse(JSON.stringify(data.symbols))     : [];
    connections   = data.connections ? JSON.parse(JSON.stringify(data.connections)) : [];
    textLabels    = data.textLabels    ? JSON.parse(JSON.stringify(data.textLabels))    : [];
    varTextLabels = data.varTextLabels ? JSON.parse(JSON.stringify(data.varTextLabels)) : [];
    selectedId = null; connectFrom = null; dragState = null;
    if (symLayer)  symLayer.innerHTML  = '';
    if (connLayer) connLayer.innerHTML = '';
    canvasSymbols.forEach(function(sym)  { createSymbolElement(sym); });
    connections.forEach(function(conn)   { createConnectionElement(conn); });
    textLabels.forEach(function(lbl)    { createTextElement(lbl); });
    varTextLabels.forEach(function(lbl) { createVarTextElement(lbl); });
    document.getElementById('current-panel-name').textContent = data.name;
    panelDataReady = true;
    panelDirty     = false;
    renderPanelList();
    updateSaveButton();
    evaluateAllSymbolRules();
}

async function saveCurrentPanel() {
    if (!currentPanelId || !panels[currentPanelId]) { showToast('No hay panel activo para guardar', 'warning'); return; }
    panels[currentPanelId].symbols     = JSON.parse(JSON.stringify(canvasSymbols));
    panels[currentPanelId].connections = JSON.parse(JSON.stringify(connections));
    panels[currentPanelId].textLabels    = JSON.parse(JSON.stringify(textLabels));
    panels[currentPanelId].varTextLabels = JSON.parse(JSON.stringify(varTextLabels));
    try {
        var p       = panels[currentPanelId];
        var headers = { 'Content-Type': 'application/json', 'X-Username': currentUsername };
        var body    = JSON.stringify({ name: p.name, canvasData: JSON.stringify({ symbols: p.symbols, connections: p.connections, textLabels: p.textLabels || [], varTextLabels: p.varTextLabels || [] }) });
        var r       = await fetch('/api/panels/' + currentPanelId, { method: 'PUT', headers: headers, body: body });
        if (!r.ok) throw new Error();
        showToast('Panel "' + p.name + '" guardado correctamente', 'success');
        panelDirty = false;
        updateSaveButton();
        renderPanelList();
    } catch(err) { showToast('Error al guardar el panel en la base de datos', 'error'); }
}

async function deletePanel(id) {
    id = Number(id);
    var ok = await showConfirm('¿Eliminar el panel "' + (panels[id] ? panels[id].name : '') + '"? Esta acción no se puede deshacer.', 'Eliminar panel');
    if (!ok) return;
    try {
        var r = await fetch('/api/panels/' + id, { method: 'DELETE', headers: { 'X-Username': currentUsername } });
        if (!r.ok) throw new Error();
        delete panels[id];
        if (currentPanelId === id) {
            currentPanelId = null;
            canvasSymbols = []; connections = [];
            if (symLayer)  symLayer.innerHTML  = '';
            if (connLayer) connLayer.innerHTML = '';
            document.getElementById('current-panel-name').textContent = '';
        }
        renderPanelList();
        var ids = Object.keys(panels).map(Number);
        if (ids.length) loadPanel(ids[0]);
        else doCreatePanel('Panel Principal');
        showToast('Panel eliminado', 'success');
    } catch(err) { showToast('Error al eliminar el panel', 'error'); }
}

// ============================================================
//  PANEL CANVAS
// ============================================================
var ANSI_SYMBOLS = [
    { id:'cb',    label:'CB — Clásico',    short:'CB',  color:'#F59E0B', draw: drawCircuitBreaker },
    { id:'cb2',   label:'CB — Cuchilla',    short:'CB',  color:'#F59E0B', draw: function(w,h,p,c){ return drawCBKnife(w,h,p,c,null); } },
    { id:'cb3',   label:'CB — Cuadrado',    short:'CB',  color:'#F59E0B', draw: function(w,h,p,c){ return drawCBSquare(w,h,p,c,null); } },
    { id:'disc',  label:'DS — Con tope',    short:'DS',  color:'#F59E0B', draw: function(w,h,p,c){ return drawDiscWithStop(w,h,p,c,null); } },
    { id:'disc2', label:'DS — Sin tope',    short:'DS',  color:'#F59E0B', draw: function(w,h,p,c){ return drawDiscNoStop(w,h,p,c,null); } },
    { id:'xfmr',  label:'Transformer',     short:'TF',  color:'#38BDF8', draw: drawTransformer    },
    { id:'motor', label:'Motor',           short:'M',   color:'#38BDF8', draw: drawMotor          },
    { id:'gen',   label:'Generator',       short:'G',   color:'#10B981', draw: drawGenerator      },
    { id:'cap',   label:'Capacitor Bank',  short:'CAP', color:'#F59E0B', draw: drawCapacitor      },
    { id:'load',  label:'Load',            short:'LD',  color:'#A78BFA', draw: drawLoad           },
    { id:'bus',   label:'Bus Bar',         short:'BUS', color:'#F59E0B', draw: drawBusBar         },
    { id:'fuse',  label:'Fuse',            short:'FU',  color:'#EF4444', draw: drawFuse           },
    { id:'relay', label:'Relay',           short:'RY',  color:'#38BDF8', draw: drawRelay          },
    { id:'ied',   label:'IED',             short:'IED', color:'#A78BFA', draw: drawIED            },
    { id:'txtlbl',label:'Texto Fijo',        short:'T',   color:'#667eea', draw: drawTextLblPreview  },
    { id:'vartxt',label:'Texto Variable',    short:'TV',  color:'#10B981', draw: drawVarTxtPreview   },
    { id:'setpt', label:'Set Point',         short:'SP',  color:'#38BDF8', draw: drawSetPoint        },
    { id:'anlg',  label:'Analog',            short:'AN',  color:'#F59E0B', draw: drawAnalogSym       },
    { id:'alarm', label:'Alarma',            short:'AL',  color:'#EF4444', draw: drawAlarmSym        },
];

var panelTool     = 'select';
var canvasSymbols = [];
var connections   = [];
var selectedId    = null;
var connectFrom   = null;
var dragState     = null;
var wasDragged    = false;
var panelInited   = false;
var svgEl, symLayer, connLayer;

function initPanelCanvas() {
    if (panelInited) return;
    panelInited = true;
    svgEl     = document.getElementById('panel-canvas');
    symLayer  = document.getElementById('symbols-layer');
    connLayer = document.getElementById('connections-layer');
    resizePanelCanvas();
    window.addEventListener('resize', resizePanelCanvas);
    svgEl.addEventListener('mousemove',  onCanvasMouseMove);
    svgEl.addEventListener('mouseup',    onCanvasMouseUp);
    svgEl.addEventListener('mouseleave', onCanvasMouseLeave);
    svgEl.addEventListener('dragover',   function(e) { e.preventDefault(); });
    svgEl.addEventListener('drop',       onCanvasDrop);
    svgEl.addEventListener('click', function(e) {
        if (e.target === svgEl || e.target.id === 'connections-layer' || e.target.id === 'symbols-layer') {
            // text/vartext tools now handled as palette symbols
            selectedId = null;
            if (connectFrom) { setConnectHighlight(connectFrom, false); connectFrom = null; }
            refreshAllVisuals();
        }
    });
}

function resizePanelCanvas() {
    var container = document.getElementById('panel-canvas-container');
    if (!container || !svgEl) return;
    svgEl.setAttribute('width',  container.clientWidth);
    svgEl.setAttribute('height', container.clientHeight);
}

function buildSymbolPalette() {
    var palette = document.getElementById('symbol-palette');
    palette.innerHTML = '';
    ANSI_SYMBOLS.forEach(function(sym) {
        var div = document.createElement('div');
        div.className        = 'symbol-item';
        div.draggable        = true;
        div.dataset.symType  = sym.id;
        div.dataset.symLabel = sym.label.toLowerCase();
        div.innerHTML = sym.draw(38, 30, true) + '<span>' + sym.label + '</span>';
        div.addEventListener('dragstart', function(e) { e.dataTransfer.setData('symType', sym.id); });
        palette.appendChild(div);
    });
    var searchInput = document.getElementById('symbol-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            var q = searchInput.value.toLowerCase().trim();
            document.querySelectorAll('#symbol-palette .symbol-item').forEach(function(item) {
                item.style.display = (!q || item.dataset.symLabel.includes(q) || item.dataset.symType.includes(q)) ? '' : 'none';
            });
        });
    }
}

function onCanvasDrop(e) {
    e.preventDefault();
    var symType = e.dataTransfer.getData('symType');
    if (!symType) return;
    var rect = svgEl.getBoundingClientRect();
    addSymbol(symType, e.clientX - rect.left, e.clientY - rect.top);
}

function addSymbol(type, x, y) {
    var id  = 'sym_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    var def = ANSI_SYMBOLS.find(function(s) { return s.id === type; });
    var props = { label: def ? def.short + (canvasSymbols.length + 1) : 'X', status: '', notes: '', color: '', rule: null, ruleActiveColor: null };
    if (type === 'cb' || type === 'cb2' || type === 'cb3') {
        props.cbConfig = {
            statusMode: 'double',
            statusVarDouble: '', statusVarOpen: '', statusVarClose: '',
            cmdVar: '', cmdTime: 0,
            lrVar: '',
            lockEnabled: false, lockVar: '',
            sboEnabled: false, sboWriteVar: '', sboTimeout: 10
        };
    }
    if (type === 'txtlbl') {
        props.textConfig = { text: 'Texto', color: '#FFFFFF', fontSize: 14 };
    }
    if (type === 'vartxt') {
        props.varTextConfig = {
            fontSize: 14, varName: '',
            states: [
                { text: 'Estado 0', color: '#EF4444' },
                { text: 'Estado 1', color: '#F59E0B' },
                { text: 'Estado 2', color: '#10B981' },
                { text: 'Estado 3', color: '#38BDF8' }
            ]
        };
    }
    if (type === 'setpt') {
        props.setptConfig = { varName: '', description: '' };
    }
    if (type === 'anlg') {
        props.anlgConfig = { varName: '' };
    }
    if (type === 'alarm') {
        props.alarmConfig = {
            varType: 'analog', varName: '',
            greenMax: 10, yellowMax: 20, redMax: 30
        };
    }
    if (type === 'ied') {
        props.iedConfig = {
            name: 'IED',
            connections: 1,
            analogSignals:  [],  // [{name, varName, unit}]
            digitalSignals: []   // [{name, varName, colorOn, colorOff}]
        };
    }
    if (type === 'disc' || type === 'disc2') {
        props.discConfig = {
            statusMode: 'double',
            statusVarDouble: '', statusVarOpen: '', statusVarClose: '', statusVarSimpleSimple: '',
            cmdVar: '', cmdTime: 0,
            lrVar: '',
            lockEnabled: false, lockVar: '',
            sboEnabled: false, sboWriteVar: '', sboTimeout: 10
        };
    }
    props.rotation = props.rotation || 0;
    var sym = { id: id, type: type, x: x, y: y, props: props };
    canvasSymbols.push(sym);
    createSymbolElement(sym);
    markPanelDirty();
}

function createSymbolElement(sym) {
    var outer = document.getElementById(sym.id);
    if (outer) { updateSymbolDrawing(sym); return; }
    outer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    outer.id = sym.id;
    outer.classList.add('canvas-symbol');
    var inner = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    inner.classList.add('sym-drawing');
    outer.appendChild(inner);
    var hitRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    var isWide = (sym.type === 'setpt' || sym.type === 'anlg' || sym.type === 'alarm');
    hitRect.setAttribute('width', isWide ? '76' : '56');
    hitRect.setAttribute('height', isWide ? '52' : '72');
    hitRect.setAttribute('x', '-3');    hitRect.setAttribute('y', '-4');
    hitRect.setAttribute('fill', 'transparent');
    outer.appendChild(hitRect);
    symLayer.appendChild(outer);

    outer.addEventListener('mousedown', function(e) {
        if (panelTool === 'connect') return;
        e.stopPropagation();
        selectedId = sym.id; refreshAllVisuals();
        var rect = svgEl.getBoundingClientRect();
        dragState = { symbolId: sym.id, offsetX: (e.clientX - rect.left) - sym.x, offsetY: (e.clientY - rect.top) - sym.y };
    });
    outer.addEventListener('click', function(e) {
        e.stopPropagation();
        if (panelTool === 'connect') handleConnectClick(sym.id);
        else { selectedId = sym.id; refreshAllVisuals(); }
    });
    outer.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        if (sym.type === 'ied')    { openIEDModal(sym.id); return; }
        if (sym.type === 'setpt')  { openSetPtOperateModal(sym.id); return; }
        if (sym.type === 'anlg')   { if (!isOperador()) openSymbolPropsModal(sym.id); return; }
        if (sym.type === 'txtlbl') { if (!isOperador()) openSymbolPropsModal(sym.id); return; }
        if (sym.type === 'vartxt') { if (!isOperador()) openSymbolPropsModal(sym.id); return; }
        if (sym.type === 'alarm')  { if (!isOperador()) openSymbolPropsModal(sym.id); return; }
        if (sym.type === 'cb' || sym.type === 'cb2' || sym.type === 'cb3' || sym.type === 'disc' || sym.type === 'disc2') openCBOperateModal(sym.id);
        else if (!isOperador()) openSymbolPropsModal(sym.id);
    });
    updateSymbolDrawing(sym);
}

function updateSymbolDrawing(sym) {
    var outer = document.getElementById(sym.id);
    if (!outer) return;
    var inner = outer.querySelector('.sym-drawing');
    if (!inner) return;
    var def   = ANSI_SYMBOLS.find(function(s) { return s.id === sym.type; });
    var color = sym.props.ruleActiveColor || sym.props.color || (def ? def.color : '#667eea');

    // Resolve visual state for CB variants and Disc
    var cbState   = null;
    var discState = null;
    var isCBType   = (sym.type === 'cb' || sym.type === 'cb2' || sym.type === 'cb3');
    var isDiscType = (sym.type === 'disc' || sym.type === 'disc2');
    if (isCBType   && sym.props.cbConfig)   cbState   = resolveCBState(sym);
    if (isDiscType && sym.props.discConfig)  discState = resolveDiscState(sym);

    var drawingHTML;
    if (sym.type === 'cb') {
        drawingHTML = drawCircuitBreaker(50, 38, false, color, cbState);
    } else if (sym.type === 'cb2') {
        drawingHTML = drawCBKnife(50, 38, false, color, cbState);
    } else if (sym.type === 'cb3') {
        drawingHTML = drawCBSquare(50, 38, false, color, cbState);
    } else if (sym.type === 'disc') {
        drawingHTML = drawDiscWithStop(50, 38, false, color, discState);
    } else if (sym.type === 'disc2') {
        drawingHTML = drawDiscNoStop(50, 38, false, color, discState);
    } else if (sym.type === 'ied') {
        drawingHTML = drawIED(50, 38, false, color, resolveIEDLights(sym));
    } else if (sym.type === 'txtlbl') {
        drawingHTML = renderTxtLblSVG(sym, color);
    } else if (sym.type === 'vartxt') {
        drawingHTML = renderVarTxtSVG(sym);
    } else if (sym.type === 'setpt') {
        drawingHTML = renderSetPtSVG(sym, color);
    } else if (sym.type === 'anlg') {
        drawingHTML = renderAnlgSVG(sym, color);
    } else if (sym.type === 'alarm') {
        drawingHTML = renderAlarmSVG(sym);
    } else {
        drawingHTML = (def ? def.draw(50, 38, false, color) : defaultSymbolSVG());
    }

    var stateLabel = '';
    if (isCBType) {
        if (cbState === 'open')         stateLabel = 'ABIERTO';
        else if (cbState === 'closed')  stateLabel = 'CERRADO';
        else if (cbState === 'error')   stateLabel = 'ERROR';
        else if (cbState === 'transit') stateLabel = '...';
    } else if (isDiscType) {
        if (discState === 'open')         stateLabel = 'ABIERTO';
        else if (discState === 'closed')  stateLabel = 'CERRADO';
        else if (discState === 'error')   stateLabel = 'ERROR';
        else if (discState === 'transit') stateLabel = '...';
    } else if (sym.type === 'txtlbl' || sym.type === 'vartxt' || sym.type === 'setpt' || sym.type === 'anlg' || sym.type === 'alarm') {
        stateLabel = '';
    } else {
        stateLabel = sym.props.status ? '[' + sym.props.status + ']' : '';
    }

    inner.innerHTML =
        drawingHTML +
        '<text class="sym-label"    x="25" y="53">' + escapeHtml(sym.props.label || '') + '</text>' +
        '<text class="sym-sublabel" x="25" y="63">' + escapeHtml(stateLabel) + '</text>';
    var rot = sym.props.rotation || 0;
    var tx = sym.x - 25, ty = sym.y - 24;
    if (rot !== 0) {
        outer.setAttribute('transform', 'translate(' + sym.x + ',' + sym.y + ') rotate(' + rot + ') translate(-25,-24)');
    } else {
        outer.setAttribute('transform', 'translate(' + tx + ',' + ty + ')');
    }
    outer.classList.toggle('selected',   sym.id === selectedId);
    outer.classList.toggle('connecting', sym.id === connectFrom);
}

function refreshAllVisuals() {
    canvasSymbols.forEach(function(s) { updateSymbolDrawing(s); });
    connections.forEach(function(c) { updateConnectionDrawing(c); });
    textLabels.forEach(function(l) { updateTextElement(l); });
    varTextLabels.forEach(function(l) { updateVarTextElement(l); });
}

function createConnectionElement(conn) {
    var el = document.getElementById(conn.id);
    if (el) { updateConnectionDrawing(conn); return; }
    el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    el.id = conn.id; el.classList.add('canvas-connection');
    connLayer.appendChild(el);
    el.addEventListener('click', function(e) {
        e.stopPropagation();
        if (panelTool !== 'connect') { selectedId = conn.id; refreshAllVisuals(); }
    });
    updateConnectionDrawing(conn);
}

function updateConnectionDrawing(conn) {
    var el   = document.getElementById(conn.id);
    if (!el) return;
    var from = canvasSymbols.find(function(s) { return s.id === conn.fromId; });
    var to   = canvasSymbols.find(function(s) { return s.id === conn.toId; });
    if (!from || !to) return;
    var isSelected = conn.id === selectedId;
    var color  = isSelected ? '#e74c3c' : '#667eea';
    var marker = isSelected ? 'url(#arrowhead-sel)' : 'url(#arrowhead)';
    var mx = (from.x + to.x) / 2;
    var d  = 'M ' + from.x + ' ' + from.y + ' L ' + mx + ' ' + from.y + ' L ' + mx + ' ' + to.y + ' L ' + to.x + ' ' + to.y;
    el.innerHTML =
        '<path d="' + d + '" stroke="transparent" stroke-width="12" fill="none"/>' +
        '<path d="' + d + '" stroke="' + color + '" stroke-width="2.5" fill="none" stroke-linejoin="round" marker-end="' + marker + '"/>';
    el.classList.toggle('selected', isSelected);
}

function handleConnectClick(symId) {
    if (!connectFrom) {
        connectFrom = symId; setConnectHighlight(symId, true);
    } else if (connectFrom === symId) {
        setConnectHighlight(connectFrom, false); connectFrom = null;
    } else {
        var conn = { id: 'conn_' + Date.now(), fromId: connectFrom, toId: symId };
        connections.push(conn);
        setConnectHighlight(connectFrom, false); connectFrom = null;
        createConnectionElement(conn); refreshAllVisuals();
        markPanelDirty();
    }
}

function setConnectHighlight(symId, on) {
    var el = document.getElementById(symId);
    if (el) el.classList.toggle('connecting', on);
}

function onCanvasMouseMove(e) {
    if (!dragState) return;
    wasDragged = true;
    var rect = svgEl.getBoundingClientRect();
    // Check if dragging a text label
    var lbl = textLabels.find(function(l) { return l.id === dragState.symbolId; });
    if (lbl) {
        lbl.x = e.clientX - rect.left - dragState.offsetX;
        lbl.y = e.clientY - rect.top  - dragState.offsetY;
        updateTextElement(lbl);
        return;
    }
    // Check if dragging a vartext label
    var vlbl = varTextLabels.find(function(l) { return l.id === dragState.symbolId; });
    if (vlbl) {
        vlbl.x = e.clientX - rect.left - dragState.offsetX;
        vlbl.y = e.clientY - rect.top  - dragState.offsetY;
        updateVarTextElement(vlbl);
        return;
    }
    var sym  = canvasSymbols.find(function(s) { return s.id === dragState.symbolId; });
    if (!sym) return;
    sym.x = e.clientX - rect.left - dragState.offsetX;
    sym.y = e.clientY - rect.top  - dragState.offsetY;
    updateSymbolDrawing(sym);
    connections.filter(function(c) { return c.fromId === sym.id || c.toId === sym.id; }).forEach(function(c) { updateConnectionDrawing(c); });
}
function onCanvasMouseUp()    { if (wasDragged) markPanelDirty(); wasDragged = false; dragState = null; }
function onCanvasMouseLeave() { if (wasDragged) markPanelDirty(); wasDragged = false; dragState = null; }


// ============================================================
//  TEXT LABELS — add, render, edit
// ============================================================
var textLabels = [];   // { id, x, y, text, color, fontSize }

function addTextSymbol(x, y) {
    var id = 'txt_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
    var lbl = { id: id, x: x, y: y, text: 'Texto', color: '#FFFFFF', fontSize: 14 };
    textLabels.push(lbl);
    markPanelDirty();
    createTextElement(lbl);
    // Immediately open edit modal
    setPanelTool('select');
    openTextEditModal(id);
}

function createTextElement(lbl) {
    var existing = document.getElementById(lbl.id);
    if (existing) { updateTextElement(lbl); return; }

    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.id = lbl.id;
    g.classList.add('canvas-text-label');
    g.style.cursor = 'move';
    symLayer.appendChild(g);

    g.addEventListener('mousedown', function(e) {
        if (panelTool === 'connect') return;
        e.stopPropagation();
        selectedId = lbl.id; refreshAllVisuals();
        var rect = svgEl.getBoundingClientRect();
        dragState = { symbolId: lbl.id, offsetX: (e.clientX - rect.left) - lbl.x, offsetY: (e.clientY - rect.top) - lbl.y };
    });
    g.addEventListener('click', function(e) {
        e.stopPropagation();
        selectedId = lbl.id; refreshAllVisuals();
    });
    g.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        if (!isOperador()) openTextEditModal(lbl.id);
    });

    updateTextElement(lbl);
}

function updateTextElement(lbl) {
    var g = document.getElementById(lbl.id);
    if (!g) return;
    var fs   = lbl.fontSize || 14;
    var txt  = lbl.text || '';
    // Multi-line support: split on 

    var lines = txt.split('\n');
    var isSelected = (lbl.id === selectedId);

    // Build tspan elements for each line
    var tspans = lines.map(function(line, i) {
        return '<tspan x="0" dy="' + (i === 0 ? '0' : (fs * 1.3) + 'px') + '">' + escapeHtml(line) + '</tspan>';
    }).join('');

    // Background rect for selection highlight
    var totalH = fs * 1.3 * lines.length;
    var approxW = Math.max.apply(null, lines.map(function(l) { return l.length; })) * fs * 0.6 + 10;

    g.innerHTML =
        (isSelected ? '<rect x="-5" y="-' + (fs + 2) + '" width="' + (approxW + 10) + '" height="' + (totalH + 8) + '" fill="rgba(102,126,234,0.15)" stroke="#667eea" stroke-width="1" stroke-dasharray="4 2" rx="3"/>' : '') +
        '<text font-size="' + fs + '" fill="' + lbl.color + '" font-family="sans-serif" font-weight="500" text-anchor="start">' +
        tspans + '</text>';
    g.setAttribute('transform', 'translate(' + lbl.x + ',' + lbl.y + ')');
}

function openTextEditModal(id) {
    var lbl = textLabels.find(function(l) { return l.id === id; });
    if (!lbl) return;
    editingSymbolId = id;
    document.getElementById('text-edit-content').value   = lbl.text || '';
    document.getElementById('text-edit-color').value     = lbl.color || '#FFFFFF';
    document.getElementById('text-edit-fontsize').value  = lbl.fontSize || 14;
    openModal('modal-text-edit');
}

function saveTextEdit() {
    var lbl = textLabels.find(function(l) { return l.id === editingSymbolId; });
    if (!lbl) return;
    lbl.text     = document.getElementById('text-edit-content').value;
    lbl.color    = document.getElementById('text-edit-color').value;
    lbl.fontSize = parseInt(document.getElementById('text-edit-fontsize').value) || 14;
    updateTextElement(lbl);
    markPanelDirty();
    closeModal('modal-text-edit');
    showToast('Texto actualizado', 'success');
}

function deleteTextLabel(id) {
    var idx = textLabels.findIndex(function(l) { return l.id === id; });
    if (idx === -1) return;
    var el = document.getElementById(id);
    if (el) el.remove();
    textLabels.splice(idx, 1);
    if (selectedId === id) selectedId = null;
    refreshAllVisuals();
    markPanelDirty();
}


// ============================================================
//  VARIABLE TEXT LABELS — dynamic text driven by status vars
// ============================================================
var varTextLabels = [];
// Each: { id, x, y, fontSize, varName,
//         states: [ {text, color}, {text, color}, {text, color}, {text, color} ] }

function addVarTextSymbol(x, y) {
    var id = 'vartxt_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
    var lbl = {
        id: id, x: x, y: y, fontSize: 14, varName: '',
        states: [
            { text: 'Estado 0', color: '#EF4444' },
            { text: 'Estado 1', color: '#F59E0B' },
            { text: 'Estado 2', color: '#10B981' },
            { text: 'Estado 3', color: '#38BDF8' }
        ]
    };
    varTextLabels.push(lbl);
    markPanelDirty();
    createVarTextElement(lbl);
    setPanelTool('select');
    openVarTextEditModal(id);
}

function createVarTextElement(lbl) {
    var existing = document.getElementById(lbl.id);
    if (existing) { updateVarTextElement(lbl); return; }

    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.id = lbl.id;
    g.classList.add('canvas-vartext-label');
    g.style.cursor = 'move';
    symLayer.appendChild(g);

    g.addEventListener('mousedown', function(e) {
        if (panelTool === 'connect') return;
        e.stopPropagation();
        selectedId = lbl.id; refreshAllVisuals();
        var rect = svgEl.getBoundingClientRect();
        dragState = { symbolId: lbl.id, offsetX: (e.clientX - rect.left) - lbl.x, offsetY: (e.clientY - rect.top) - lbl.y };
    });
    g.addEventListener('click', function(e) {
        e.stopPropagation();
        selectedId = lbl.id; refreshAllVisuals();
    });
    g.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        if (!isOperador()) openVarTextEditModal(lbl.id);
    });

    updateVarTextElement(lbl);
}

function updateVarTextElement(lbl) {
    var g = document.getElementById(lbl.id);
    if (!g) return;
    var fs = lbl.fontSize || 14;

    // Resolve current state from variable
    var currentVal = lbl.varName ? getVarValue('status', lbl.varName) : null;
    var stateIdx   = (currentVal !== null) ? parseInt(currentVal) : null;
    var isSelected = (lbl.id === selectedId);

    var displayText  = '—';
    var displayColor = '#888888';

    if (stateIdx !== null && stateIdx >= 0 && stateIdx <= 3 && lbl.states[stateIdx]) {
        displayText  = lbl.states[stateIdx].text  || '—';
        displayColor = lbl.states[stateIdx].color || '#FFFFFF';
    } else if (!lbl.varName) {
        displayText  = '[sin variable]';
        displayColor = '#4a6080';
    }

    var lines  = displayText.split('\n');
    var tspans = lines.map(function(line, i) {
        return '<tspan x="0" dy="' + (i === 0 ? '0' : (fs * 1.3) + 'px') + '">' + escapeHtml(line) + '</tspan>';
    }).join('');
    var totalH  = fs * 1.3 * lines.length;
    var approxW = Math.max.apply(null, lines.map(function(l) { return l.length; })) * fs * 0.6 + 10;

    g.innerHTML =
        (isSelected ? '<rect x="-5" y="-' + (fs + 2) + '" width="' + (approxW + 10) + '" height="' + (totalH + 8) + '" fill="rgba(102,126,234,0.15)" stroke="#667eea" stroke-width="1" stroke-dasharray="4 2" rx="3"/>' : '') +
        '<text font-size="' + fs + '" fill="' + displayColor + '" font-family="sans-serif" font-weight="600" text-anchor="start">' +
        tspans + '</text>';
    g.setAttribute('transform', 'translate(' + lbl.x + ',' + lbl.y + ')');
}

function openVarTextEditModal(id) {
    var lbl = varTextLabels.find(function(l) { return l.id === id; });
    if (!lbl) return;
    editingSymbolId = id;
    // Populate variable dropdown
    populateCBVarSelect('vartext-var-select', 'status', lbl.varName || '');
    document.getElementById('vartext-fontsize').value = lbl.fontSize || 14;
    // Populate 4 states
    for (var i = 0; i < 4; i++) {
        document.getElementById('vartext-text-' + i).value  = lbl.states[i] ? lbl.states[i].text  : '';
        document.getElementById('vartext-color-' + i).value = lbl.states[i] ? lbl.states[i].color : '#FFFFFF';
    }
    openModal('modal-vartext-edit');
}

function saveVarTextEdit() {
    var lbl = varTextLabels.find(function(l) { return l.id === editingSymbolId; });
    if (!lbl) return;
    lbl.varName  = document.getElementById('vartext-var-select').value;
    lbl.fontSize = parseInt(document.getElementById('vartext-fontsize').value) || 14;
    for (var i = 0; i < 4; i++) {
        lbl.states[i] = {
            text:  document.getElementById('vartext-text-' + i).value,
            color: document.getElementById('vartext-color-' + i).value
        };
    }
    updateVarTextElement(lbl);
    markPanelDirty();
    closeModal('modal-vartext-edit');
    showToast('Texto variable guardado', 'success');
}

function deleteVarTextLabel(id) {
    var idx = varTextLabels.findIndex(function(l) { return l.id === id; });
    if (idx === -1) return;
    var el = document.getElementById(id);
    if (el) el.remove();
    varTextLabels.splice(idx, 1);
    if (selectedId === id) selectedId = null;
    refreshAllVisuals();
    markPanelDirty();
}


// ============================================================
//  NEW SYMBOL DRAW + RENDER FUNCTIONS
// ============================================================

// ── Palette previews ─────────────────────────────────────────
function drawTextLblPreview(w, h, preview, c) {
    c = c || '#667eea';
    var inner = '<rect x="4" y="10" width="42" height="22" rx="4" fill="#1C2235" stroke="' + c + '" stroke-width="2"/>' +
                '<text x="25" y="26" font-size="9" fill="' + c + '" text-anchor="middle" font-family="sans-serif" font-weight="700">T</text>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawVarTxtPreview(w, h, preview, c) {
    c = c || '#10B981';
    var inner = '<rect x="4" y="10" width="42" height="22" rx="4" fill="#1C2235" stroke="' + c + '" stroke-width="2"/>' +
                '<text x="25" y="26" font-size="8" fill="' + c + '" text-anchor="middle" font-family="sans-serif" font-weight="700">TV</text>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawSetPoint(w, h, preview, c) {
    c = c || '#38BDF8';
    var inner = '<rect x="4" y="4" width="42" height="34" rx="5" fill="#1C2235" stroke="' + c + '" stroke-width="2" class="sym-body"/>' +
                '<text x="25" y="17" font-size="7" fill="' + c + '" text-anchor="middle" font-family="sans-serif" font-weight="700">Set</text>' +
                '<text x="25" y="28" font-size="7" fill="' + c + '" text-anchor="middle" font-family="sans-serif" font-weight="700">Point</text>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawAnalogSym(w, h, preview, c) {
    c = c || '#F59E0B';
    var inner = '<rect x="4" y="4" width="42" height="34" rx="5" fill="#1C2235" stroke="' + c + '" stroke-width="2" class="sym-body"/>' +
                '<text x="25" y="25" font-size="8" fill="' + c + '" text-anchor="middle" font-family="sans-serif" font-weight="700">ANLG</text>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawAlarmSym(w, h, preview, c) {
    c = c || '#EF4444';
    var inner = '<rect x="4" y="4" width="42" height="34" rx="5" fill="#1C2235" stroke="' + c + '" stroke-width="2" class="sym-body"/>' +
                '<text x="25" y="25" font-size="8" fill="' + c + '" text-anchor="middle" font-family="sans-serif" font-weight="700">ALARM</text>';
    return preview ? symSVG(w, h, inner) : inner;
}

// ── Canvas render functions ───────────────────────────────────
function renderTxtLblSVG(sym, c) {
    var cfg = sym.props.textConfig || {};
    var fs  = cfg.fontSize || 14;
    var txt = cfg.text || '';
    var col = cfg.color || '#FFFFFF';
    var lines = txt.split('\n');
    var tspans = lines.map(function(l, i) {
        return '<tspan x="0" dy="' + (i === 0 ? '0' : (fs * 1.3) + 'px') + '">' + escapeHtml(l) + '</tspan>';
    }).join('');
    return '<text font-size="' + fs + '" fill="' + col + '" font-family="sans-serif" font-weight="500" text-anchor="start">' + tspans + '</text>';
}

function renderVarTxtSVG(sym) {
    var cfg = sym.props.varTextConfig || {};
    var fs  = cfg.fontSize || 14;
    var val = cfg.varName ? getVarValue('status', cfg.varName) : null;
    var idx = val !== null ? parseInt(val) : null;
    var txt = '[sin variable]', col = '#4a6080';
    if (idx !== null && cfg.states && cfg.states[idx]) {
        txt = cfg.states[idx].text  || '—';
        col = cfg.states[idx].color || '#FFFFFF';
    }
    var lines = txt.split('\n');
    var tspans = lines.map(function(l, i) {
        return '<tspan x="0" dy="' + (i === 0 ? '0' : (fs * 1.3) + 'px') + '">' + escapeHtml(l) + '</tspan>';
    }).join('');
    return '<text font-size="' + fs + '" fill="' + col + '" font-family="sans-serif" font-weight="600" text-anchor="start">' + tspans + '</text>';
}

function renderSetPtSVG(sym, c) {
    c = c || '#38BDF8';
    var cfg  = sym.props.setptConfig || {};
    var val  = cfg.varName ? getVarValue('command', cfg.varName) : null;
    var desc = cfg.description || 'Set Point';
    var valTxt = val !== null ? String(val) : '—';
    return '<rect x="0" y="0" width="70" height="42" rx="5" fill="#1C2235" stroke="' + c + '" stroke-width="2" class="sym-body"/>' +
           '<text x="35" y="14" font-size="8" fill="' + c + '" text-anchor="middle" font-family="sans-serif" font-weight="700">' + escapeHtml(desc.slice(0,15)) + '</text>' +
           '<text x="35" y="32" font-size="13" fill="#F59E0B" text-anchor="middle" font-family="monospace" font-weight="700">' + escapeHtml(valTxt) + '</text>';
}

function renderAnlgSVG(sym, c) {
    c = c || '#F59E0B';
    var cfg = sym.props.anlgConfig || {};
    var val = cfg.varName ? getVarValue('analog', cfg.varName) : null;
    var valTxt = val !== null ? parseFloat(val).toFixed(2) : '—';
    return '<rect x="0" y="0" width="70" height="42" rx="5" fill="#1C2235" stroke="' + c + '" stroke-width="2" class="sym-body"/>' +
           '<text x="35" y="14" font-size="8" fill="' + c + '" text-anchor="middle" font-family="sans-serif" font-weight="700">ANALOG</text>' +
           '<text x="35" y="32" font-size="12" fill="#FFFFFF" text-anchor="middle" font-family="monospace">' + escapeHtml(valTxt) + '</text>';
}

function renderAlarmSVG(sym) {
    var cfg  = sym.props.alarmConfig || {};
    var val  = cfg.varName ? getVarValue(cfg.varType || 'analog', cfg.varName) : null;
    var bgColor = '#1C2235', borderColor = '#4a6080', label = 'ALARM';
    if (val !== null) {
        var n = parseFloat(val);
        if (!isNaN(n)) {
            if      (n <= (cfg.greenMax  || 10)) { bgColor = '#064e3b'; borderColor = '#10B981'; }
            else if (n <= (cfg.yellowMax || 20)) { bgColor = '#451a03'; borderColor = '#F59E0B'; }
            else                                  { bgColor = '#450a0a'; borderColor = '#EF4444'; }
        }
    }
    var valTxt = val !== null ? (cfg.varType === 'status' ? String(parseInt(val)) : parseFloat(val).toFixed(1)) : '—';
    return '<rect x="0" y="0" width="70" height="42" rx="5" fill="' + bgColor + '" stroke="' + borderColor + '" stroke-width="2.5" class="sym-body"/>' +
           '<text x="35" y="14" font-size="8" fill="' + borderColor + '" text-anchor="middle" font-family="sans-serif" font-weight="700">ALARM</text>' +
           '<text x="35" y="32" font-size="12" fill="#FFFFFF" text-anchor="middle" font-family="monospace">' + escapeHtml(valTxt) + '</text>';
}

function onAlarmVarTypeChange() {
    var type = document.getElementById('alarm-var-type').value;
    populateCBVarSelect('alarm-var-name', type, document.getElementById('alarm-var-name').value || '');
    var threshEl = document.getElementById('alarm-thresholds');
    if (threshEl) threshEl.style.display = (type === 'status') ? 'none' : '';
}

// ── Set Point operate modal ───────────────────────────────────
var setptOperateSymId = null;
function openSetPtOperateModal(symId) {
    var sym = canvasSymbols.find(function(s) { return s.id === symId; });
    if (!sym) return;
    setptOperateSymId = symId;
    var cfg = sym.props.setptConfig || {};
    var val = cfg.varName ? getVarValue('command', cfg.varName) : null;
    document.getElementById('setpt-modal-desc').textContent = cfg.description || 'Set Point';
    document.getElementById('setpt-modal-varname').textContent = cfg.varName || '—';
    document.getElementById('setpt-modal-input').value = val !== null ? val : '';
    var cfgBtn = document.getElementById('setpt-modal-cfg-btn');
    if (cfgBtn) cfgBtn.style.display = isOperador() ? 'none' : '';
    openModal('modal-setpt-operate');
}

function setptSave() {
    var sym = canvasSymbols.find(function(s) { return s.id === setptOperateSymId; });
    if (!sym) return;
    var cfg = sym.props.setptConfig || {};
    if (!cfg.varName) { showToast('No hay variable asignada', 'warning'); return; }
    var newVal = document.getElementById('setpt-modal-input').value.trim();
    writeCBVariable('command', cfg.varName, newVal, 0);
    closeModal('modal-setpt-operate');
    showToast('Valor actualizado', 'success');
}

function setptStep(delta) {
    var input = document.getElementById('setpt-modal-input');
    var cur   = parseFloat(input.value) || 0;
    input.value = (cur + delta).toString();
}

function setPanelTool(tool) {
    panelTool = tool;
    document.querySelectorAll('.tool-btn').forEach(function(b) { b.classList.remove('active'); });
    var btn = document.getElementById('tool-' + tool);
    if (btn) btn.classList.add('active');
    var container = document.getElementById('panel-canvas-container');
    if (container) { container.classList.remove('mode-connect', 'mode-select'); container.classList.add('mode-' + tool); }
    if (connectFrom) { setConnectHighlight(connectFrom, false); connectFrom = null; }
}

async function deleteSelected() {
    if (!selectedId) return;
    // Check if it's a text label
    var txtIdx = textLabels.findIndex(function(l) { return l.id === selectedId; });
    if (txtIdx !== -1) {
        var ok = await showConfirm('¿Eliminar este texto?', 'Eliminar texto');
        if (!ok) return;
        deleteTextLabel(selectedId);
        return;
    }
    // Check if it's a vartext label
    var vtxtIdx = varTextLabels.findIndex(function(l) { return l.id === selectedId; });
    if (vtxtIdx !== -1) {
        var ok2 = await showConfirm('¿Eliminar este texto variable?', 'Eliminar texto variable');
        if (!ok2) return;
        deleteVarTextLabel(selectedId);
        return;
    }
    var symIdx = canvasSymbols.findIndex(function(s) { return s.id === selectedId; });
    if (symIdx !== -1) {
        var ok = await showConfirm('¿Eliminar este símbolo y sus conexiones?', 'Eliminar símbolo');
        if (!ok) return;
        var el = document.getElementById(selectedId);
        if (el) el.remove();
        var removedId = selectedId;
        canvasSymbols.splice(symIdx, 1);
        connections = connections.filter(function(c) {
            if (c.fromId === removedId || c.toId === removedId) {
                var ce = document.getElementById(c.id);
                if (ce) ce.remove();
                return false;
            }
            return true;
        });
    } else {
        var ci = connections.findIndex(function(c) { return c.id === selectedId; });
        if (ci !== -1) { var ce2 = document.getElementById(selectedId); if (ce2) ce2.remove(); connections.splice(ci, 1); }
    }
    selectedId = null;
    markPanelDirty();
}

async function clearCanvas() {
    var ok = await showConfirm('¿Limpiar todos los símbolos y conexiones del canvas?', 'Limpiar canvas');
    if (!ok) return;
    canvasSymbols = []; connections = []; selectedId = null; connectFrom = null;
    symLayer.innerHTML = ''; connLayer.innerHTML = '';
    markPanelDirty();
}

// ============================================================
//  SYMBOL PROPERTIES MODAL
// ============================================================
var editingSymbolId = null;

function openSymbolPropsModal(id) {
    var sym = canvasSymbols.find(function(s) { return s.id === id; });
    if (!sym) return;
    editingSymbolId = id;
    var def = ANSI_SYMBOLS.find(function(d) { return d.id === sym.type; });
    document.getElementById('symbol-props-title').textContent = '⚙ ' + (def ? def.label : 'Symbol');

    document.getElementById('sym-prop-notes').value = sym.props.notes || '';

    var isCB   = (sym.type === 'cb' || sym.type === 'cb2' || sym.type === 'cb3');
    var isDisc = (sym.type === 'disc' || sym.type === 'disc2');
    var isIED    = (sym.type === 'ied');
    var isTxtLbl = (sym.type === 'txtlbl');
    var isVarTxt = (sym.type === 'vartxt');
    var isSetPt  = (sym.type === 'setpt');
    var isAnlg   = (sym.type === 'anlg');
    var isAlarm  = (sym.type === 'alarm');
    var isSpecial = (isCB || isDisc || isIED || isTxtLbl || isVarTxt || isSetPt || isAnlg || isAlarm);
    document.getElementById('ied-config-section').style.display    = isIED    ? '' : 'none';
    document.getElementById('txtlbl-config-section').style.display = isTxtLbl ? '' : 'none';
    document.getElementById('vartxt-config-section').style.display = isVarTxt ? '' : 'none';
    document.getElementById('setpt-config-section').style.display  = isSetPt  ? '' : 'none';
    document.getElementById('anlg-config-section').style.display   = isAnlg   ? '' : 'none';
    document.getElementById('alarm-config-section').style.display  = isAlarm  ? '' : 'none';
    // Populate rotation
    document.getElementById('sym-rotation').value = sym.props.rotation || 0;
    document.getElementById('cb-config-section').style.display   = isCB   ? '' : 'none';
    document.getElementById('disc-config-section').style.display = isDisc ? '' : 'none';
    document.getElementById('generic-rule-section').style.display = isSpecial ? 'none' : '';

    if (isCB) {
        var cfg = sym.props.cbConfig || {};
        populateCBVarSelect('cb-status-var-double', 'status', cfg.statusVarDouble || '');
        populateCBVarSelect('cb-status-var-open',   'status', cfg.statusVarOpen   || '');
        populateCBVarSelect('cb-status-var-close',  'status', cfg.statusVarClose  || '');
        populateCBVarSelect('cb-lr-var',            'status', cfg.lrVar           || '', true);
        populateCBVarSelect('cb-lock-var',          'status', cfg.lockVar         || '');
        populateCBVarSelect('cb-cmd-var',           'command', cfg.cmdVar         || '');
        populateCBVarSelect('cb-sbo-write-var',     'command', cfg.sboWriteVar    || '', true);
        document.getElementById('cb-status-mode').value    = cfg.statusMode || 'double';
        document.getElementById('cb-cmd-time').value       = cfg.cmdTime    !== undefined ? cfg.cmdTime : 0;
        document.getElementById('cb-lock-enabled').checked = !!cfg.lockEnabled;
        document.getElementById('cb-sbo-enabled').checked  = !!cfg.sboEnabled;
        document.getElementById('cb-sbo-timeout').value    = cfg.sboTimeout || 10;
        onCBStatusModeChange();
        onCBLockChange();
        onCBSBOChange();
    } else if (isDisc) {
        var dcfg = sym.props.discConfig || {};
        populateCBVarSelect('disc-status-var-double',       'status', dcfg.statusVarDouble      || '');
        populateCBVarSelect('disc-status-var-open',         'status', dcfg.statusVarOpen        || '');
        populateCBVarSelect('disc-status-var-close',        'status', dcfg.statusVarClose       || '');
        populateCBVarSelect('disc-status-var-simplesimple', 'status', dcfg.statusVarSimpleSimple|| '');
        populateCBVarSelect('disc-lr-var',                  'status', dcfg.lrVar               || '', true);
        populateCBVarSelect('disc-lock-var',                'status', dcfg.lockVar             || '');
        populateCBVarSelect('disc-cmd-var',                 'command', dcfg.cmdVar             || '');
        populateCBVarSelect('disc-sbo-write-var',           'command', dcfg.sboWriteVar        || '', true);
        document.getElementById('disc-status-mode').value    = dcfg.statusMode || 'double';
        document.getElementById('disc-cmd-time').value       = dcfg.cmdTime    !== undefined ? dcfg.cmdTime : 0;
        document.getElementById('disc-lock-enabled').checked = !!dcfg.lockEnabled;
        document.getElementById('disc-sbo-enabled').checked  = !!dcfg.sboEnabled;
        document.getElementById('disc-sbo-timeout').value    = dcfg.sboTimeout || 10;
        onDiscStatusModeChange();
        onDiscLockChange();
        onDiscSBOChange();
    } else if (isIED) {
        populateIEDConfigSection(sym);
    } else if (isTxtLbl) {
        var tc = sym.props.textConfig || {};
        document.getElementById('txtlbl-text').value     = tc.text     || '';
        document.getElementById('txtlbl-color').value    = tc.color    || '#FFFFFF';
        document.getElementById('txtlbl-fontsize').value = tc.fontSize || 14;
    } else if (isVarTxt) {
        var vc = sym.props.varTextConfig || {};
        populateCBVarSelect('vartxt-var-select', 'status', vc.varName || '');
        document.getElementById('vartxt-fontsize').value = vc.fontSize || 14;
        for (var i = 0; i < 4; i++) {
            document.getElementById('vartxt-st-text-' + i).value  = vc.states && vc.states[i] ? vc.states[i].text  : '';
            document.getElementById('vartxt-st-color-' + i).value = vc.states && vc.states[i] ? vc.states[i].color : '#FFFFFF';
        }
    } else if (isSetPt) {
        var sc = sym.props.setptConfig || {};
        populateCBVarSelect('setpt-var-select', 'command', sc.varName || '');
        document.getElementById('setpt-description').value = sc.description || '';
    } else if (isAnlg) {
        var ac = sym.props.anlgConfig || {};
        populateCBVarSelect('anlg-var-select', 'analog', ac.varName || '');
    } else if (isAlarm) {
        var alc = sym.props.alarmConfig || {};
        document.getElementById('alarm-var-type').value  = alc.varType  || 'analog';
        document.getElementById('alarm-green-max').value = alc.greenMax !== undefined ? alc.greenMax : 10;
        document.getElementById('alarm-yellow-max').value= alc.yellowMax!== undefined ? alc.yellowMax: 20;
        document.getElementById('alarm-red-max').value   = alc.redMax   !== undefined ? alc.redMax   : 30;
        onAlarmVarTypeChange();
        populateCBVarSelect('alarm-var-name', alc.varType || 'analog', alc.varName || '');
    } else {
        document.getElementById('sym-prop-status').value = sym.props.status || '';
        var rule    = sym.props.rule || {};
        var varType = rule.varType || '';
        document.getElementById('sym-var-type').value = varType;
        populateVarDropdown(varType, rule.varName || '');
        document.getElementById('sym-var-condition').value    = rule.condition   || '';
        document.getElementById('sym-var-threshold').value    = rule.threshold   || '';
        document.getElementById('sym-var-action-color').value = rule.actionColor || '#e74c3c';
        updateRuleRows(varType, rule.varName || '', rule.condition || '');
        if (varType && rule.varName) showCurrentVarValue(varType, rule.varName);
    }
    openModal('modal-symbol-props');
}

function populateVarDropdown(type, selectedName) {
    var varSel = document.getElementById('sym-var-name');
    if (!type) { varSel.innerHTML = '<option value="">-- select variable --</option>'; return; }
    var vars = allVariables[type] || [];
    varSel.innerHTML = '<option value="">-- select variable --</option>' +
        vars.map(function(v) {
            var desc = v.description ? ' — ' + escapeHtml(v.description) : '';
            return '<option value="' + escapeHtml(v.name) + '"' + (v.name === selectedName ? ' selected' : '') + '>' + escapeHtml(v.name) + desc + '</option>';
        }).join('');
}

function showCurrentVarValue(type, name) {
    var vars   = allVariables[type] || [];
    var varObj = vars.find(function(v) { return v.name === name; });
    var el     = document.getElementById('rule-current-val-display');
    if (el) el.textContent = varObj ? String(varObj.value) : '\u2014';
}

function onSymVarTypeChange() {
    var type = document.getElementById('sym-var-type').value;
    populateVarDropdown(type, '');
    updateRuleRows(type, '', '');
}
function onSymVarNameChange() {
    var type = document.getElementById('sym-var-type').value;
    var name = document.getElementById('sym-var-name').value;
    showCurrentVarValue(type, name);
    updateRuleRows(type, name, document.getElementById('sym-var-condition').value);
}
function onSymConditionChange() {
    var type      = document.getElementById('sym-var-type').value;
    var name      = document.getElementById('sym-var-name').value;
    var condition = document.getElementById('sym-var-condition').value;
    updateRuleRows(type, name, condition);
}

function updateRuleRows(type, name, condition) {
    document.getElementById('rule-var-row').style.display        = type           ? '' : 'none';
    document.getElementById('rule-block').style.display          = (type && name) ? '' : 'none';
    document.getElementById('rule-threshold-row').style.display  = condition      ? '' : 'none';
    document.getElementById('rule-action-row').style.display     = condition      ? '' : 'none';
}

function populateCBVarSelect(elId, type, selected, addBlank) {
    var el   = document.getElementById(elId);
    if (!el) return;
    var vars = allVariables[type] || [];
    var blank = addBlank ? '<option value="">-- sin asignar --</option>' : '<option value="">-- seleccionar --</option>';
    el.innerHTML = blank + vars.map(function(v) {
        return '<option value="' + escapeHtml(v.name) + '"' + (v.name === selected ? ' selected' : '') + '>' + escapeHtml(v.name) + (v.description ? ' — ' + escapeHtml(v.description) : '') + '</option>';
    }).join('');
}

function onCBStatusModeChange() {
    var mode = document.getElementById('cb-status-mode').value;
    document.getElementById('cb-double-vars').style.display = (mode === 'double') ? '' : 'none';
    document.getElementById('cb-simple-vars').style.display = (mode === 'simple') ? '' : 'none';
}
function onCBLockChange() {
    var on = document.getElementById('cb-lock-enabled').checked;
    document.getElementById('cb-lock-var-row').style.display = on ? '' : 'none';
}
function onCBSBOChange() {
    var on = document.getElementById('cb-sbo-enabled').checked;
    document.getElementById('cb-sbo-config').style.display = on ? '' : 'none';
}

function saveSymbolProps() {
    var sym = canvasSymbols.find(function(s) { return s.id === editingSymbolId; });
    if (!sym) return;
    sym.props.notes    = document.getElementById('sym-prop-notes').value.trim();
    sym.props.rotation = parseInt(document.getElementById('sym-rotation').value) || 0;

    if (sym.type === 'cb' || sym.type === 'cb2' || sym.type === 'cb3') {
        var cfg = sym.props.cbConfig || {};
        cfg.statusMode     = document.getElementById('cb-status-mode').value;
        cfg.statusVarDouble= document.getElementById('cb-status-var-double').value;
        cfg.statusVarOpen  = document.getElementById('cb-status-var-open').value;
        cfg.statusVarClose = document.getElementById('cb-status-var-close').value;
        cfg.cmdVar         = document.getElementById('cb-cmd-var').value;
        cfg.cmdTime        = parseInt(document.getElementById('cb-cmd-time').value) || 0;
        cfg.lrVar          = document.getElementById('cb-lr-var').value;
        cfg.lockEnabled    = document.getElementById('cb-lock-enabled').checked;
        cfg.lockVar        = document.getElementById('cb-lock-var').value;
        cfg.sboEnabled     = document.getElementById('cb-sbo-enabled').checked;
        cfg.sboWriteVar    = document.getElementById('cb-sbo-write-var').value;
        cfg.sboTimeout     = parseInt(document.getElementById('cb-sbo-timeout').value) || 10;
        sym.props.cbConfig = cfg;
    } else if (sym.type === 'ied') {
        saveIEDConfig(sym);
    } else if (sym.type === 'txtlbl') {
        sym.props.textConfig = {
            text:     document.getElementById('txtlbl-text').value,
            color:    document.getElementById('txtlbl-color').value,
            fontSize: parseInt(document.getElementById('txtlbl-fontsize').value) || 14
        };
    } else if (sym.type === 'vartxt') {
        var states = [];
        for (var i = 0; i < 4; i++) {
            states.push({
                text:  document.getElementById('vartxt-st-text-' + i).value,
                color: document.getElementById('vartxt-st-color-' + i).value
            });
        }
        sym.props.varTextConfig = {
            varName:  document.getElementById('vartxt-var-select').value,
            fontSize: parseInt(document.getElementById('vartxt-fontsize').value) || 14,
            states:   states
        };
    } else if (sym.type === 'setpt') {
        sym.props.setptConfig = {
            varName:     document.getElementById('setpt-var-select').value,
            description: document.getElementById('setpt-description').value.trim()
        };
    } else if (sym.type === 'anlg') {
        sym.props.anlgConfig = {
            varName: document.getElementById('anlg-var-select').value
        };
    } else if (sym.type === 'alarm') {
        sym.props.alarmConfig = {
            varType:   document.getElementById('alarm-var-type').value,
            varName:   document.getElementById('alarm-var-name').value,
            greenMax:  parseFloat(document.getElementById('alarm-green-max').value)  || 10,
            yellowMax: parseFloat(document.getElementById('alarm-yellow-max').value) || 20,
            redMax:    parseFloat(document.getElementById('alarm-red-max').value)    || 30
        };
    } else if (sym.type === 'disc' || sym.type === 'disc2') {
        var dcfg = sym.props.discConfig || {};
        dcfg.statusMode            = document.getElementById('disc-status-mode').value;
        dcfg.statusVarDouble       = document.getElementById('disc-status-var-double').value;
        dcfg.statusVarOpen         = document.getElementById('disc-status-var-open').value;
        dcfg.statusVarClose        = document.getElementById('disc-status-var-close').value;
        dcfg.statusVarSimpleSimple = document.getElementById('disc-status-var-simplesimple').value;
        dcfg.cmdVar                = document.getElementById('disc-cmd-var').value;
        dcfg.cmdTime               = parseInt(document.getElementById('disc-cmd-time').value) || 0;
        dcfg.lrVar                 = document.getElementById('disc-lr-var').value;
        dcfg.lockEnabled           = document.getElementById('disc-lock-enabled').checked;
        dcfg.lockVar               = document.getElementById('disc-lock-var').value;
        dcfg.sboEnabled            = document.getElementById('disc-sbo-enabled').checked;
        dcfg.sboWriteVar           = document.getElementById('disc-sbo-write-var').value;
        dcfg.sboTimeout            = parseInt(document.getElementById('disc-sbo-timeout').value) || 10;
        sym.props.discConfig = dcfg;
    } else {
        sym.props.status = document.getElementById('sym-prop-status').value;
        var varType     = document.getElementById('sym-var-type').value;
        var varName     = document.getElementById('sym-var-name').value;
        var condition   = document.getElementById('sym-var-condition').value;
        var threshold   = document.getElementById('sym-var-threshold').value.trim();
        var actionColor = document.getElementById('sym-var-action-color').value;
        sym.props.rule = (varType && varName && condition)
            ? { varType: varType, varName: varName, condition: condition, threshold: threshold, actionColor: actionColor }
            : null;
        sym.props.ruleActiveColor = null;
    }
    closeModal('modal-symbol-props');
    updateSymbolDrawing(sym);
    evaluateAllSymbolRules();
    showToast('Configuración del símbolo guardada', 'success');
    markPanelDirty();
}

// ============================================================
//  ANSI/IEC SYMBOL DRAWINGS
// ============================================================
function symSVG(w, h, inner) {
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 50 40" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
}
function defaultSymbolSVG() {
    return '<rect class="sym-body" x="5" y="5" width="40" height="30" rx="4" fill="#1C2235" stroke="#F59E0B" stroke-width="2"/>';
}
function drawCircuitBreaker(w, h, preview, c, cbState) {
    // cbState: 'open' | 'closed' | 'error' | 'transit' | undefined (generic)
    c = c || '#F59E0B';
    var inner;
    if (cbState === 'open') {
        // Open: square with a gap (line broken inside)
        inner = '<rect class="sym-body" x="10" y="7" width="30" height="26" rx="3" fill="#1C2235" stroke="' + c + '" stroke-width="2"/>' +
                '<line x1="25" y1="7" x2="25" y2="0" stroke="' + c + '" stroke-width="2"/>' +
                '<line x1="25" y1="33" x2="25" y2="40" stroke="' + c + '" stroke-width="2"/>' +
                '<line x1="14" y1="20" x2="20" y2="20" stroke="' + c + '" stroke-width="2"/>' +
                '<line x1="30" y1="20" x2="36" y2="20" stroke="' + c + '" stroke-width="2"/>' +
                '<line x1="20" y1="20" x2="28" y2="14" stroke="' + c + '" stroke-width="2" stroke-linecap="round"/>';
    } else if (cbState === 'closed') {
        // Closed: continuous line through square
        inner = '<rect class="sym-body" x="10" y="7" width="30" height="26" rx="3" fill="#1C2235" stroke="' + c + '" stroke-width="2"/>' +
                '<line x1="25" y1="7" x2="25" y2="0" stroke="' + c + '" stroke-width="2"/>' +
                '<line x1="25" y1="33" x2="25" y2="40" stroke="' + c + '" stroke-width="2"/>' +
                '<line x1="13" y1="20" x2="37" y2="20" stroke="' + c + '" stroke-width="2.5"/>' +
                '<circle cx="25" cy="20" r="3" fill="' + c + '"/>';
    } else if (cbState === 'error') {
        // Error: red X overlay
        var ec = '#EF4444';
        inner = '<rect class="sym-body" x="10" y="7" width="30" height="26" rx="3" fill="#2A0A0A" stroke="' + ec + '" stroke-width="2"/>' +
                '<line x1="25" y1="7" x2="25" y2="0" stroke="' + ec + '" stroke-width="2"/>' +
                '<line x1="25" y1="33" x2="25" y2="40" stroke="' + ec + '" stroke-width="2"/>' +
                '<line x1="15" y1="12" x2="35" y2="28" stroke="' + ec + '" stroke-width="2.5" stroke-linecap="round"/>' +
                '<line x1="35" y1="12" x2="15" y2="28" stroke="' + ec + '" stroke-width="2.5" stroke-linecap="round"/>';
    } else if (cbState === 'transit') {
        // Transit: dashed line (indeterminate)
        inner = '<rect class="sym-body" x="10" y="7" width="30" height="26" rx="3" fill="#1C2235" stroke="#888" stroke-width="2"/>' +
                '<line x1="25" y1="7" x2="25" y2="0" stroke="#888" stroke-width="2"/>' +
                '<line x1="25" y1="33" x2="25" y2="40" stroke="#888" stroke-width="2"/>' +
                '<line x1="13" y1="20" x2="37" y2="20" stroke="#888" stroke-width="2" stroke-dasharray="3 2"/>';
    } else {
        // Generic / palette preview
        inner = '<rect class="sym-body" x="10" y="7" width="30" height="26" rx="3" fill="#1C2235" stroke="' + c + '" stroke-width="2"/>' +
                '<line x1="25" y1="7" x2="25" y2="0" stroke="' + c + '" stroke-width="2"/>' +
                '<line x1="25" y1="33" x2="25" y2="40" stroke="' + c + '" stroke-width="2"/>' +
                '<line x1="17" y1="20" x2="33" y2="20" stroke="' + c + '" stroke-width="1.5"/>' +
                '<circle cx="25" cy="13" r="4" fill="' + c + '"/>';
    }
    return preview ? symSVG(w, h, inner) : inner;
}
function drawDisconnector(w, h, preview, c) {
    c = c || '#F59E0B';
    var inner = '<line x1="3" y1="20" x2="18" y2="20" stroke="' + c + '" stroke-width="2.5"/><line x1="32" y1="20" x2="47" y2="20" stroke="' + c + '" stroke-width="2.5"/><line x1="18" y1="20" x2="30" y2="11" stroke="' + c + '" stroke-width="2" stroke-linecap="round"/><circle cx="18" cy="20" r="3.5" fill="#1C2235" stroke="' + c + '" stroke-width="2" class="sym-body"/><circle cx="32" cy="20" r="3.5" fill="#1C2235" stroke="' + c + '" stroke-width="2"/>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawTransformer(w, h, preview, c) {
    c = c || '#38BDF8';
    var inner = '<circle cx="18" cy="20" r="10" fill="#1C2235" stroke="' + c + '" stroke-width="2" class="sym-body"/><circle cx="32" cy="20" r="10" fill="#1C2235" stroke="' + c + '" stroke-width="2"/><line x1="0" y1="20" x2="8" y2="20" stroke="' + c + '" stroke-width="2"/><line x1="42" y1="20" x2="50" y2="20" stroke="' + c + '" stroke-width="2"/>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawMotor(w, h, preview, c) {
    c = c || '#38BDF8';
    var inner = '<circle cx="25" cy="20" r="16" fill="#1C2235" stroke="' + c + '" stroke-width="2" class="sym-body"/><text x="25" y="25" font-size="13" font-weight="bold" fill="' + c + '" text-anchor="middle" font-family="sans-serif">M</text><line x1="0" y1="20" x2="9" y2="20" stroke="' + c + '" stroke-width="2"/>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawGenerator(w, h, preview, c) {
    c = c || '#10B981';
    var inner = '<circle cx="25" cy="20" r="16" fill="#1C2235" stroke="' + c + '" stroke-width="2" class="sym-body"/><text x="25" y="25" font-size="13" font-weight="bold" fill="' + c + '" text-anchor="middle" font-family="sans-serif">G</text><line x1="0" y1="20" x2="9" y2="20" stroke="' + c + '" stroke-width="2"/>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawCapacitor(w, h, preview, c) {
    c = c || '#F59E0B';
    var inner = '<line x1="4" y1="20" x2="20" y2="20" stroke="' + c + '" stroke-width="2"/><line x1="30" y1="20" x2="46" y2="20" stroke="' + c + '" stroke-width="2"/><line x1="20" y1="8" x2="20" y2="32" stroke="' + c + '" stroke-width="3.5" class="sym-body"/><line x1="30" y1="8" x2="30" y2="32" stroke="' + c + '" stroke-width="3.5"/>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawLoad(w, h, preview, c) {
    c = c || '#A78BFA';
    var inner = '<polygon class="sym-body" points="25,6 42,34 8,34" fill="#1C2235" stroke="' + c + '" stroke-width="2"/><line x1="25" y1="0" x2="25" y2="6" stroke="' + c + '" stroke-width="2"/>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawBusBar(w, h, preview, c) {
    c = c || '#F59E0B';
    var inner = '<rect class="sym-body" x="2" y="15" width="46" height="10" rx="2" fill="' + c + '" stroke="' + c + '" stroke-width="1"/>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawFuse(w, h, preview, c) {
    c = c || '#EF4444';
    var inner = '<rect class="sym-body" x="14" y="13" width="22" height="14" rx="3" fill="#1C2235" stroke="' + c + '" stroke-width="2"/><line x1="4" y1="20" x2="14" y2="20" stroke="' + c + '" stroke-width="2"/><line x1="36" y1="20" x2="46" y2="20" stroke="' + c + '" stroke-width="2"/><line x1="14" y1="20" x2="36" y2="20" stroke="' + c + '" stroke-width="1.5" stroke-dasharray="3 2"/>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawRelay(w, h, preview, c) {
    c = c || '#38BDF8';
    var inner = '<rect class="sym-body" x="9" y="7" width="32" height="26" rx="3" fill="#1C2235" stroke="' + c + '" stroke-width="2"/><text x="25" y="24" font-size="11" font-weight="bold" fill="' + c + '" text-anchor="middle" font-family="sans-serif">RY</text><line x1="0" y1="20" x2="9" y2="20" stroke="' + c + '" stroke-width="2"/><line x1="41" y1="20" x2="50" y2="20" stroke="' + c + '" stroke-width="2"/>';
    return preview ? symSVG(w, h, inner) : inner;
}

// ============================================================
//  CIRCUIT BREAKER — STATE RESOLUTION


// ── CB Tipo 2: Cuchilla vertical (knife switch) ──────────────
// ABIERTO: línea vertical arriba + X + cuchilla diagonal abajo-izquierda
// CERRADO: línea vertical continua + X
function drawCBKnife(w, h, preview, c, cbState) {
    c = c || '#F59E0B';
    var inner;
    if (cbState === 'open') {
        inner =
            '<line x1="25" y1="0"  x2="25" y2="12" stroke="' + c + '" stroke-width="2.5"/>' +
            '<line x1="21" y1="12" x2="29" y2="12" stroke="' + c + '" stroke-width="2"/>' +
            '<line x1="23" y1="9"  x2="27" y2="15" stroke="' + c + '" stroke-width="1.5"/>' +
            '<line x1="27" y1="9"  x2="23" y2="15" stroke="' + c + '" stroke-width="1.5"/>' +
            '<line x1="25" y1="12" x2="10" y2="32" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round"/>' +
            '<line x1="10" y1="32" x2="10" y2="40" stroke="' + c + '" stroke-width="2.5"/>';
    } else if (cbState === 'closed') {
        inner =
            '<line x1="25" y1="0"  x2="25" y2="40" stroke="' + c + '" stroke-width="2.5"/>' +
            '<line x1="21" y1="16" x2="29" y2="16" stroke="' + c + '" stroke-width="2"/>' +
            '<line x1="23" y1="13" x2="27" y2="19" stroke="' + c + '" stroke-width="1.5"/>' +
            '<line x1="27" y1="13" x2="23" y2="19" stroke="' + c + '" stroke-width="1.5"/>';
    } else if (cbState === 'error') {
        var ec = '#EF4444';
        inner =
            '<line x1="25" y1="0"  x2="25" y2="40" stroke="' + ec + '" stroke-width="2.5"/>' +
            '<rect x="14" y="10" width="22" height="20" rx="2" fill="#2A0A0A" stroke="' + ec + '" stroke-width="1.5"/>' +
            '<line x1="17" y1="13" x2="33" y2="27" stroke="' + ec + '" stroke-width="2" stroke-linecap="round"/>' +
            '<line x1="33" y1="13" x2="17" y2="27" stroke="' + ec + '" stroke-width="2" stroke-linecap="round"/>';
    } else if (cbState === 'transit') {
        inner =
            '<line x1="25" y1="0"  x2="25" y2="12" stroke="#888" stroke-width="2.5"/>' +
            '<line x1="25" y1="12" x2="10" y2="32" stroke="#888" stroke-width="2" stroke-dasharray="3 2"/>' +
            '<line x1="10" y1="32" x2="10" y2="40" stroke="#888" stroke-width="2.5"/>';
    } else {
        // Generic/palette — show open state
        inner =
            '<line x1="25" y1="0"  x2="25" y2="12" stroke="' + c + '" stroke-width="2.5"/>' +
            '<line x1="21" y1="12" x2="29" y2="12" stroke="' + c + '" stroke-width="2"/>' +
            '<line x1="23" y1="9"  x2="27" y2="15" stroke="' + c + '" stroke-width="1.5"/>' +
            '<line x1="27" y1="9"  x2="23" y2="15" stroke="' + c + '" stroke-width="1.5"/>' +
            '<line x1="25" y1="12" x2="10" y2="32" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round"/>' +
            '<line x1="10" y1="32" x2="10" y2="40" stroke="' + c + '" stroke-width="2.5"/>';
    }
    return preview ? symSVG(w, h, inner) : inner;
}

// ── CB Tipo 3: Cuadrado (square) ─────────────────────────────
// ABIERTO: línea vertical + cuadrado vacío
// CERRADO: línea vertical + cuadrado relleno
function drawCBSquare(w, h, preview, c, cbState) {
    c = c || '#F59E0B';
    var inner;
    if (cbState === 'open') {
        inner =
            '<line x1="25" y1="0"  x2="25" y2="11" stroke="' + c + '" stroke-width="2.5"/>' +
            '<rect x="12" y="11" width="26" height="22" rx="1" fill="#1C2235" stroke="' + c + '" stroke-width="2" class="sym-body"/>' +
            '<line x1="25" y1="33" x2="25" y2="44" stroke="' + c + '" stroke-width="2.5"/>';
    } else if (cbState === 'closed') {
        inner =
            '<line x1="25" y1="0"  x2="25" y2="11" stroke="' + c + '" stroke-width="2.5"/>' +
            '<rect x="12" y="11" width="26" height="22" rx="1" fill="' + c + '" stroke="' + c + '" stroke-width="2" class="sym-body"/>' +
            '<line x1="25" y1="33" x2="25" y2="44" stroke="' + c + '" stroke-width="2.5"/>';
    } else if (cbState === 'error') {
        var ec = '#EF4444';
        inner =
            '<line x1="25" y1="0"  x2="25" y2="11" stroke="' + ec + '" stroke-width="2.5"/>' +
            '<rect x="12" y="11" width="26" height="22" rx="1" fill="#2A0A0A" stroke="' + ec + '" stroke-width="2"/>' +
            '<line x1="16" y1="15" x2="34" y2="29" stroke="' + ec + '" stroke-width="2" stroke-linecap="round"/>' +
            '<line x1="34" y1="15" x2="16" y2="29" stroke="' + ec + '" stroke-width="2" stroke-linecap="round"/>' +
            '<line x1="25" y1="33" x2="25" y2="44" stroke="' + ec + '" stroke-width="2.5"/>';
    } else if (cbState === 'transit') {
        inner =
            '<line x1="25" y1="0"  x2="25" y2="11" stroke="#888" stroke-width="2.5"/>' +
            '<rect x="12" y="11" width="26" height="22" rx="1" fill="#1C2235" stroke="#888" stroke-width="2" stroke-dasharray="3 2"/>' +
            '<line x1="25" y1="33" x2="25" y2="44" stroke="#888" stroke-width="2.5"/>';
    } else {
        // Generic/palette — show open state
        inner =
            '<line x1="25" y1="0"  x2="25" y2="11" stroke="' + c + '" stroke-width="2.5"/>' +
            '<rect x="12" y="11" width="26" height="22" rx="1" fill="#1C2235" stroke="' + c + '" stroke-width="2" class="sym-body"/>' +
            '<line x1="25" y1="33" x2="25" y2="44" stroke="' + c + '" stroke-width="2.5"/>';
    }
    return preview ? symSVG(w, h, inner) : inner;
}



// ============================================================
//  IED — DRAW + STATE + MODALS
// ============================================================

function drawIED(w, h, preview, c, lights) {
    c = c || '#A78BFA';
    // lights: { red, yellow, green } booleans
    lights = lights || {};
    var rC = lights.red    ? '#EF4444' : '#1C2235';
    var yC = lights.yellow ? '#F59E0B' : '#1C2235';
    var gC = lights.green  ? '#10B981' : '#1C2235';
    var inner =
        // Body rectangle
        '<rect class="sym-body" x="4" y="4" width="42" height="32" rx="3" fill="#1C2235" stroke="' + c + '" stroke-width="2"/>' +
        // Name label inside box
        '<text x="25" y="16" font-size="7" fill="' + c + '" text-anchor="middle" font-family="sans-serif" font-weight="700">IED</text>' +
        // Three indicator lights
        '<circle cx="13" cy="26" r="4" fill="' + rC + '" stroke="#0d1a26" stroke-width="1"/>' +
        '<circle cx="25" cy="26" r="4" fill="' + yC + '" stroke="#0d1a26" stroke-width="1"/>' +
        '<circle cx="37" cy="26" r="4" fill="' + gC + '" stroke="#0d1a26" stroke-width="1"/>' +
        // Connection line at bottom
        '<line x1="25" y1="36" x2="25" y2="44" stroke="' + c + '" stroke-width="2"/>';
    return preview ? symSVG(w, h, inner) : inner;
}

function resolveIEDLights(sym) {
    var cfg = sym.props.iedConfig;
    if (!cfg) return {};
    var red = false, yellow = false, green = false;
    (cfg.digitalSignals || []).forEach(function(sig) {
        var val = sig.varName ? parseInt(getVarValue('status', sig.varName) || '0') : null;
        if (val === null) return;
        var active = val === 1 ? sig.colorOn : sig.colorOff;
        if (active === 'red')    red    = true;
        if (active === 'yellow') yellow = true;
        if (active === 'green')  green  = true;
    });
    return { red: red, yellow: yellow, green: green };
}

// ── IED Config Section (inside symbol props modal) ──────────
function populateIEDConfigSection(sym) {
    var cfg = sym.props.iedConfig || {};
    document.getElementById('ied-cfg-name').value        = cfg.name        || 'IED';
    document.getElementById('ied-cfg-connections').value = cfg.connections || 1;

    // Render analog signals
    renderIEDAnalogRows(cfg.analogSignals || []);
    renderIEDDigitalRows(cfg.digitalSignals || []);
}

function renderIEDAnalogRows(signals) {
    var container = document.getElementById('ied-analog-rows');
    container.innerHTML = '';
    signals.forEach(function(sig, i) {
        container.appendChild(buildIEDAnalogRow(sig, i));
    });
}

function buildIEDAnalogRow(sig, i) {
    var div = document.createElement('div');
    div.className = 'ied-signal-row';
    div.dataset.idx = i;

    var vars = allVariables['analog'] || [];
    var varOptions = '<option value="">-- seleccionar --</option>' +
        vars.map(function(v) {
            return '<option value="' + escapeHtml(v.name) + '"' + (v.name === sig.varName ? ' selected' : '') + '>' + escapeHtml(v.name) + '</option>';
        }).join('');

    var units = ['V','kV','A','kA','W','kW','MW','VAR','kVAR','Hz','°','%','Ω','custom'];
    var unitOptions = units.map(function(u) {
        return '<option value="' + u + '"' + (sig.unit === u ? ' selected' : '') + '>' + u + '</option>';
    }).join('');

    div.innerHTML =
        '<input type="text" class="form-control ied-sig-name" maxlength="15" placeholder="Nombre (máx 15)" value="' + escapeHtml(sig.name || '') + '" style="flex:2;">' +
        '<select class="form-control ied-sig-var" style="flex:3;">' + varOptions + '</select>' +
        '<select class="form-control ied-sig-unit" style="flex:1;">' + unitOptions + '</select>' +
        '<input type="text" class="form-control ied-sig-unit-custom" placeholder="Unidad" value="' + escapeHtml(sig.unitCustom || '') + '" style="flex:1;' + (sig.unit === 'custom' ? '' : 'display:none;') + '">' +
        '<button class="btn btn-sm" onclick="removeIEDAnalogRow(this)" style="background:#EF4444;color:#fff;padding:4px 8px;flex-shrink:0;">✕</button>';

    div.querySelector('.ied-sig-unit').addEventListener('change', function() {
        var customEl = div.querySelector('.ied-sig-unit-custom');
        customEl.style.display = this.value === 'custom' ? '' : 'none';
    });
    return div;
}

function addIEDAnalogRow() {
    var container = document.getElementById('ied-analog-rows');
    if (container.children.length >= 12) { showToast('Máximo 12 señales analógicas', 'warning'); return; }
    var idx = container.children.length;
    container.appendChild(buildIEDAnalogRow({ name:'', varName:'', unit:'V', unitCustom:'' }, idx));
}

function removeIEDAnalogRow(btn) {
    btn.closest('.ied-signal-row').remove();
}

function renderIEDDigitalRows(signals) {
    var container = document.getElementById('ied-digital-rows');
    container.innerHTML = '';
    signals.forEach(function(sig, i) {
        container.appendChild(buildIEDDigitalRow(sig, i));
    });
}

function buildIEDDigitalRow(sig, i) {
    var div = document.createElement('div');
    div.className = 'ied-signal-row';
    div.dataset.idx = i;

    var vars = allVariables['status'] || [];
    var varOptions = '<option value="">-- seleccionar --</option>' +
        vars.map(function(v) {
            return '<option value="' + escapeHtml(v.name) + '"' + (v.name === sig.varName ? ' selected' : '') + '>' + escapeHtml(v.name) + '</option>';
        }).join('');

    var colorOpts = function(sel) {
        return ['none','red','yellow','green'].map(function(c) {
            var labels = { none:'Ninguno', red:'Rojo', yellow:'Amarillo', green:'Verde' };
            return '<option value="' + c + '"' + (sel === c ? ' selected' : '') + '>' + labels[c] + '</option>';
        }).join('');
    };

    div.innerHTML =
        '<input type="text" class="form-control ied-sig-name" maxlength="15" placeholder="Nombre" value="' + escapeHtml(sig.name || '') + '" style="flex:2;">' +
        '<select class="form-control ied-sig-var" style="flex:3;">' + varOptions + '</select>' +
        '<select class="form-control ied-sig-color-on"  style="flex:1.5;">' + colorOpts(sig.colorOn  || 'none') + '</select>' +
        '<select class="form-control ied-sig-color-off" style="flex:1.5;">' + colorOpts(sig.colorOff || 'none') + '</select>' +
        '<button class="btn btn-sm" onclick="removeIEDDigitalRow(this)" style="background:#EF4444;color:#fff;padding:4px 8px;flex-shrink:0;">✕</button>';
    return div;
}

function addIEDDigitalRow() {
    var container = document.getElementById('ied-digital-rows');
    if (container.children.length >= 20) { showToast('Máximo 20 señales digitales', 'warning'); return; }
    var idx = container.children.length;
    container.appendChild(buildIEDDigitalRow({ name:'', varName:'', colorOn:'none', colorOff:'none' }, idx));
}

function removeIEDDigitalRow(btn) {
    btn.closest('.ied-signal-row').remove();
}

function collectIEDAnalogSignals() {
    var rows = document.querySelectorAll('#ied-analog-rows .ied-signal-row');
    return Array.from(rows).map(function(row) {
        var unit = row.querySelector('.ied-sig-unit').value;
        return {
            name:      row.querySelector('.ied-sig-name').value.trim(),
            varName:   row.querySelector('.ied-sig-var').value,
            unit:      unit,
            unitCustom: unit === 'custom' ? row.querySelector('.ied-sig-unit-custom').value.trim() : ''
        };
    }).filter(function(s) { return s.name || s.varName; });
}

function collectIEDDigitalSignals() {
    var rows = document.querySelectorAll('#ied-digital-rows .ied-signal-row');
    return Array.from(rows).map(function(row) {
        return {
            name:     row.querySelector('.ied-sig-name').value.trim(),
            varName:  row.querySelector('.ied-sig-var').value,
            colorOn:  row.querySelector('.ied-sig-color-on').value,
            colorOff: row.querySelector('.ied-sig-color-off').value
        };
    }).filter(function(s) { return s.name || s.varName; });
}

function saveIEDConfig(sym) {
    sym.props.iedConfig = {
        name:           document.getElementById('ied-cfg-name').value.trim().slice(0,15) || 'IED',
        connections:    parseInt(document.getElementById('ied-cfg-connections').value) || 1,
        analogSignals:  collectIEDAnalogSignals(),
        digitalSignals: collectIEDDigitalSignals()
    };
}

// ── IED Operate Modal (double-click on canvas) ───────────────
var iedOperateSymId = null;

function openIEDModal(symId) {
    var sym = canvasSymbols.find(function(s) { return s.id === symId; });
    if (!sym) return;
    iedOperateSymId = symId;
    renderIEDOperateModal(sym);
    openModal('modal-ied-operate');
}

function renderIEDOperateModal(sym) {
    var cfg = sym.props.iedConfig || {};
    document.getElementById('ied-modal-name').textContent = cfg.name || 'IED';

    // Analog table
    var analogBody = document.getElementById('ied-operate-analog-body');
    analogBody.innerHTML = '';
    var analogs = cfg.analogSignals || [];
    if (analogs.length === 0) {
        analogBody.innerHTML = '<tr><td colspan="3" style="color:#4a6080;text-align:center;padding:8px;">Sin señales analógicas configuradas</td></tr>';
    } else {
        analogs.forEach(function(sig) {
            var val = sig.varName ? getVarValue('analog', sig.varName) : null;
            var display = val !== null ? parseFloat(val).toFixed(2) : '—';
            var unit = sig.unit === 'custom' ? sig.unitCustom : sig.unit;
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td style="padding:6px 10px;border-bottom:1px solid #1e3a5f;color:#c8d6e5;">' + escapeHtml(sig.name) + '</td>' +
                '<td style="padding:6px 10px;border-bottom:1px solid #1e3a5f;color:#F59E0B;font-family:monospace;text-align:right;">' + display + '</td>' +
                '<td style="padding:6px 10px;border-bottom:1px solid #1e3a5f;color:#7a8fa6;">' + escapeHtml(unit || '') + '</td>';
            analogBody.appendChild(tr);
        });
    }

    // Digital table
    var digitalBody = document.getElementById('ied-operate-digital-body');
    digitalBody.innerHTML = '';
    var digitals = cfg.digitalSignals || [];
    if (digitals.length === 0) {
        digitalBody.innerHTML = '<tr><td colspan="2" style="color:#4a6080;text-align:center;padding:8px;">Sin señales digitales configuradas</td></tr>';
    } else {
        digitals.forEach(function(sig) {
            var val = sig.varName ? parseInt(getVarValue('status', sig.varName) || '0') : null;
            var activeColor = (val === 1) ? sig.colorOn : (val === 0 ? sig.colorOff : 'none');
            var dotColor = { red: '#EF4444', yellow: '#F59E0B', green: '#10B981', none: '#2a3f55' }[activeColor] || '#2a3f55';
            var dotClass = (activeColor === 'red' || activeColor === 'yellow') ? 'ied-light-blink' : '';
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td style="padding:6px 10px;border-bottom:1px solid #1e3a5f;color:#c8d6e5;">' + escapeHtml(sig.name) + '</td>' +
                '<td style="padding:6px 10px;border-bottom:1px solid #1e3a5f;text-align:center;">' +
                  '<span class="ied-light ' + dotClass + '" style="display:inline-block;width:14px;height:14px;border-radius:50%;background:' + dotColor + ';box-shadow:' + (activeColor !== 'none' ? '0 0 6px ' + dotColor : 'none') + ';"></span>' +
                '</td>';
            digitalBody.appendChild(tr);
        });
    }
}

// ── Seccionador Tipo 1: Con tope (barrera horizontal) ────────
// ABIERTO: línea arriba + barra horizontal (tope) + cuchilla diagonal + línea abajo
// CERRADO: línea continua + barra horizontal cruzada en el centro
function drawDiscWithStop(w, h, preview, c, discState) {
    c = c || '#F59E0B';
    var inner;
    if (discState === 'open') {
        inner =
            '<line x1="25" y1="0"  x2="25" y2="14" stroke="' + c + '" stroke-width="2.5"/>' +
            '<line x1="17" y1="14" x2="33" y2="14" stroke="' + c + '" stroke-width="2.5"/>' +
            '<line x1="25" y1="14" x2="14" y2="30" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round"/>' +
            '<line x1="14" y1="30" x2="14" y2="44" stroke="' + c + '" stroke-width="2.5"/>';
    } else if (discState === 'closed') {
        inner =
            '<line x1="25" y1="0"  x2="25" y2="44" stroke="' + c + '" stroke-width="2.5"/>' +
            '<line x1="17" y1="20" x2="33" y2="20" stroke="' + c + '" stroke-width="2.5"/>';
    } else if (discState === 'error') {
        var ec = '#EF4444';
        inner =
            '<line x1="25" y1="0"  x2="25" y2="14" stroke="' + ec + '" stroke-width="2.5"/>' +
            '<line x1="17" y1="14" x2="33" y2="14" stroke="' + ec + '" stroke-width="2.5"/>' +
            '<line x1="25" y1="14" x2="14" y2="30" stroke="' + ec + '" stroke-width="2" stroke-dasharray="3 2"/>' +
            '<line x1="14" y1="30" x2="14" y2="44" stroke="' + ec + '" stroke-width="2.5"/>' +
            '<line x1="18" y1="18" x2="28" y2="28" stroke="' + ec + '" stroke-width="1.5" stroke-linecap="round"/>' +
            '<line x1="28" y1="18" x2="18" y2="28" stroke="' + ec + '" stroke-width="1.5" stroke-linecap="round"/>';
    } else if (discState === 'transit') {
        inner =
            '<line x1="25" y1="0"  x2="25" y2="14" stroke="#888" stroke-width="2.5"/>' +
            '<line x1="17" y1="14" x2="33" y2="14" stroke="#888" stroke-width="2.5"/>' +
            '<line x1="25" y1="14" x2="14" y2="30" stroke="#888" stroke-width="2" stroke-dasharray="3 2"/>' +
            '<line x1="14" y1="30" x2="14" y2="44" stroke="#888" stroke-width="2.5"/>';
    } else {
        // Generic/palette — show open
        inner =
            '<line x1="25" y1="0"  x2="25" y2="14" stroke="' + c + '" stroke-width="2.5"/>' +
            '<line x1="17" y1="14" x2="33" y2="14" stroke="' + c + '" stroke-width="2.5"/>' +
            '<line x1="25" y1="14" x2="14" y2="30" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round"/>' +
            '<line x1="14" y1="30" x2="14" y2="44" stroke="' + c + '" stroke-width="2.5"/>';
    }
    return preview ? symSVG(w, h, inner) : inner;
}

// ── Seccionador Tipo 2: Sin tope ──────────────────────────────
// ABIERTO: línea arriba + cuchilla diagonal + línea abajo
// CERRADO: línea vertical continua
function drawDiscNoStop(w, h, preview, c, discState) {
    c = c || '#F59E0B';
    var inner;
    if (discState === 'open') {
        inner =
            '<line x1="25" y1="0"  x2="25" y2="16" stroke="' + c + '" stroke-width="2.5"/>' +
            '<line x1="25" y1="16" x2="14" y2="30" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round"/>' +
            '<line x1="14" y1="30" x2="14" y2="44" stroke="' + c + '" stroke-width="2.5"/>';
    } else if (discState === 'closed') {
        inner =
            '<line x1="25" y1="0"  x2="25" y2="44" stroke="' + c + '" stroke-width="2.5"/>';
    } else if (discState === 'error') {
        var ec = '#EF4444';
        inner =
            '<line x1="25" y1="0"  x2="25" y2="16" stroke="' + ec + '" stroke-width="2.5"/>' +
            '<line x1="25" y1="16" x2="14" y2="30" stroke="' + ec + '" stroke-width="2" stroke-dasharray="3 2"/>' +
            '<line x1="14" y1="30" x2="14" y2="44" stroke="' + ec + '" stroke-width="2.5"/>' +
            '<line x1="18" y1="18" x2="28" y2="28" stroke="' + ec + '" stroke-width="1.5" stroke-linecap="round"/>' +
            '<line x1="28" y1="18" x2="18" y2="28" stroke="' + ec + '" stroke-width="1.5" stroke-linecap="round"/>';
    } else if (discState === 'transit') {
        inner =
            '<line x1="25" y1="0"  x2="25" y2="16" stroke="#888" stroke-width="2.5"/>' +
            '<line x1="25" y1="16" x2="14" y2="30" stroke="#888" stroke-width="2" stroke-dasharray="3 2"/>' +
            '<line x1="14" y1="30" x2="14" y2="44" stroke="#888" stroke-width="2.5"/>';
    } else {
        // Generic/palette — show open
        inner =
            '<line x1="25" y1="0"  x2="25" y2="16" stroke="' + c + '" stroke-width="2.5"/>' +
            '<line x1="25" y1="16" x2="14" y2="30" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round"/>' +
            '<line x1="14" y1="30" x2="14" y2="44" stroke="' + c + '" stroke-width="2.5"/>';
    }
    return preview ? symSVG(w, h, inner) : inner;
}

// ============================================================
//  SECCIONADOR — STATE RESOLUTION
// ============================================================
function resolveDiscState(sym) {
    var cfg = sym.props.discConfig;
    if (!cfg) return null;
    if (cfg.statusMode === 'double') {
        var v = parseInt(getVarValue('status', cfg.statusVarDouble) || 'x');
        if (isNaN(v)) return null;
        if (v === 0) return 'transit';
        if (v === 1) return 'open';
        if (v === 2) return 'closed';
        if (v === 3) return 'error';
        return null;
    } else if (cfg.statusMode === 'simple') {
        var o = getVarValue('status', cfg.statusVarOpen);
        var c = getVarValue('status', cfg.statusVarClose);
        var ov = o !== null ? parseInt(o) : null;
        var cv = c !== null ? parseInt(c) : null;
        if (ov === 1 && cv === 1) return 'error';
        if (ov === 1 && cv === 0) return 'open';
        if (ov === 0 && cv === 1) return 'closed';
        if (ov === 0 && cv === 0) return 'transit';
        return null;
    } else {
        // simple-simple: one variable, 0=open 1=closed
        var ss = getVarValue('status', cfg.statusVarSimpleSimple);
        if (ss === null) return null;
        return parseInt(ss) === 0 ? 'open' : 'closed';
    }
}

// Disc config modal helpers (mirror CB helpers)
function onDiscStatusModeChange() {
    var mode = document.getElementById('disc-status-mode').value;
    document.getElementById('disc-double-vars').style.display        = (mode === 'double')       ? '' : 'none';
    document.getElementById('disc-simple-vars').style.display        = (mode === 'simple')       ? '' : 'none';
    document.getElementById('disc-simplesimple-vars').style.display  = (mode === 'simplesimple') ? '' : 'none';
}
function onDiscLockChange() {
    var on = document.getElementById('disc-lock-enabled').checked;
    document.getElementById('disc-lock-var-row').style.display = on ? '' : 'none';
}
function onDiscSBOChange() {
    var on = document.getElementById('disc-sbo-enabled').checked;
    document.getElementById('disc-sbo-config').style.display = on ? '' : 'none';
}

// Full disconnector draw with state (cuchilla / knife-switch style)
function drawDisconnectorFull(w, h, preview, c, discState) {
    c = c || '#F59E0B';
    var inner;
    if (discState === 'open') {
        // Open: blade rotated ~45°, gap visible
        inner = '<line x1="4" y1="20" x2="18" y2="20" stroke="' + c + '" stroke-width="2.5"/>' +
                '<line x1="32" y1="20" x2="46" y2="20" stroke="' + c + '" stroke-width="2.5"/>' +
                '<line x1="18" y1="20" x2="30" y2="11" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round"/>' +
                '<circle cx="18" cy="20" r="3.5" fill="#1C2235" stroke="' + c + '" stroke-width="2" class="sym-body"/>' +
                '<circle cx="32" cy="20" r="3.5" fill="#1C2235" stroke="' + c + '" stroke-width="2"/>';
    } else if (discState === 'closed') {
        // Closed: blade horizontal, continuous
        inner = '<line x1="4" y1="20" x2="46" y2="20" stroke="' + c + '" stroke-width="2.5"/>' +
                '<circle cx="18" cy="20" r="3.5" fill="#1C2235" stroke="' + c + '" stroke-width="2" class="sym-body"/>' +
                '<circle cx="32" cy="20" r="3.5" fill="#1C2235" stroke="' + c + '" stroke-width="2"/>';
    } else if (discState === 'error') {
        var ec = '#EF4444';
        inner = '<line x1="4" y1="20" x2="18" y2="20" stroke="' + ec + '" stroke-width="2.5"/>' +
                '<line x1="32" y1="20" x2="46" y2="20" stroke="' + ec + '" stroke-width="2.5"/>' +
                '<line x1="18" y1="20" x2="30" y2="11" stroke="' + ec + '" stroke-width="2.5"/>' +
                '<circle cx="18" cy="20" r="3.5" fill="#2A0A0A" stroke="' + ec + '" stroke-width="2" class="sym-body"/>' +
                '<circle cx="32" cy="20" r="3.5" fill="#2A0A0A" stroke="' + ec + '" stroke-width="2"/>' +
                '<line x1="21" y1="13" x2="29" y2="27" stroke="' + ec + '" stroke-width="1.5" stroke-linecap="round"/>' +
                '<line x1="29" y1="13" x2="21" y2="27" stroke="' + ec + '" stroke-width="1.5" stroke-linecap="round"/>';
    } else if (discState === 'transit') {
        inner = '<line x1="4" y1="20" x2="18" y2="20" stroke="#888" stroke-width="2.5"/>' +
                '<line x1="32" y1="20" x2="46" y2="20" stroke="#888" stroke-width="2.5"/>' +
                '<line x1="18" y1="20" x2="30" y2="15" stroke="#888" stroke-width="2" stroke-dasharray="3 2"/>' +
                '<circle cx="18" cy="20" r="3.5" fill="#1C2235" stroke="#888" stroke-width="2" class="sym-body"/>' +
                '<circle cx="32" cy="20" r="3.5" fill="#1C2235" stroke="#888" stroke-width="2"/>';
    } else {
        // Generic/palette
        inner = '<line x1="4" y1="20" x2="18" y2="20" stroke="' + c + '" stroke-width="2.5"/>' +
                '<line x1="32" y1="20" x2="46" y2="20" stroke="' + c + '" stroke-width="2.5"/>' +
                '<line x1="18" y1="20" x2="30" y2="11" stroke="' + c + '" stroke-width="2" stroke-linecap="round"/>' +
                '<circle cx="18" cy="20" r="3.5" fill="#1C2235" stroke="' + c + '" stroke-width="2" class="sym-body"/>' +
                '<circle cx="32" cy="20" r="3.5" fill="#1C2235" stroke="' + c + '" stroke-width="2"/>';
    }
    return preview ? symSVG(w, h, inner) : inner;
}

// ============================================================
function resolveCBState(sym) {
    var cfg = sym.props.cbConfig;
    if (!cfg) return null;
    if (cfg.statusMode === 'double') {
        var varObj = getVarValue('status', cfg.statusVarDouble);
        if (varObj === null) return null;
        var v = parseInt(varObj);
        if (v === 0) return 'transit';
        if (v === 1) return 'open';
        if (v === 2) return 'closed';
        if (v === 3) return 'error';
        return null;
    } else {
        // simple: two separate variables
        var openObj  = getVarValue('status', cfg.statusVarOpen);
        var closeObj = getVarValue('status', cfg.statusVarClose);
        var o = openObj  !== null ? parseInt(openObj)  : null;
        var c = closeObj !== null ? parseInt(closeObj) : null;
        if (o === 1 && c === 1) return 'error';
        if (o === 1 && c === 0) return 'open';
        if (o === 0 && c === 1) return 'closed';
        if (o === 0 && c === 0) return 'transit';
        return null;
    }
}

function getVarValue(type, name) {
    if (!name) return null;
    var vars = allVariables[type] || [];
    var v    = vars.find(function(x) { return x.name === name; });
    return v ? v.value : null;
}

// ============================================================
//  CIRCUIT BREAKER — OPERATION MODAL
// ============================================================
var cbOperateSymId   = null;
var cbSBOSelected    = false;
var cbSBOTimerHandle = null;
var cbPulseHandle    = null;

function openCBOperateModal(symId) {
    var sym = canvasSymbols.find(function(s) { return s.id === symId; });
    if (!sym) return;
    cbOperateSymId = symId;
    cbSBOSelected  = false;
    clearCBSBOTimer();
    clearCBPulse();

    var isCBVariant = (sym.type === 'cb' || sym.type === 'cb2' || sym.type === 'cb3');
    var isDiscVariant = (sym.type === 'disc' || sym.type === 'disc2');
    var cfg   = isDiscVariant ? (sym.props.discConfig || {}) : (sym.props.cbConfig || {});
    var state = isDiscVariant ? resolveDiscState(sym) : resolveCBState(sym);
    var lrVal     = cfg.lrVar ? parseInt(getVarValue('status', cfg.lrVar) || '0') : 0;
    var isRemote  = (lrVal === 1);
    var lockVal   = (cfg.lockEnabled && cfg.lockVar) ? parseInt(getVarValue('status', cfg.lockVar) || '0') : 0;

    // Title
    var titleIcon = (sym.type === 'disc' || sym.type === 'disc2') ? '🔌' : '⚡';
    var titleDefault = (sym.type === 'disc' || sym.type === 'disc2') ? 'Seccionador' : 'Interruptor';
    // for cb2/cb3 same icon as cb
    document.getElementById('cb-operate-title').textContent = titleIcon + ' ' + (sym.props.label || titleDefault);

    // State display
    var stateText = { open: 'ABIERTO', closed: 'CERRADO', error: 'ERROR', transit: 'TRÁNSITO' };
    document.getElementById('cb-state-value').textContent = stateText[state] || '—';
    document.getElementById('cb-state-value').className   = 'cb-state-value cb-state-' + (state || 'unknown');
    document.getElementById('cb-lr-value').textContent    = isRemote ? 'REMOTO' : 'LOCAL';
    document.getElementById('cb-lr-value').className      = 'cb-state-value ' + (isRemote ? 'cb-remote' : 'cb-local');

    var blockMsg  = document.getElementById('cb-block-msg');
    var sboSection= document.getElementById('cb-sbo-select-section');
    var actBtns   = document.getElementById('cb-action-buttons');

    // Hide/show operation controls based on role
    var isOp = isOperador();
    document.getElementById('cb-action-buttons').style.display      = isOp ? '' : 'none';
    document.getElementById('cb-sbo-select-section').style.display  = 'none'; // reset, shown later if needed

    // Reset block message
    blockMsg.style.display = 'none';

    if (!isOp) {
        // Configurador: solo ve estado, no puede operar
        // action buttons ya están ocultos arriba
    } else if (isRemote) {
        // Scenario 2: Remote — cannot operate
        actBtns.style.display  = 'none';
        blockMsg.style.display = '';
        blockMsg.className     = 'cb-block-msg cb-block-remote';
        blockMsg.innerHTML     = '🔒 El interruptor está en modo <strong>REMOTO</strong>.<br>No es posible operar desde este panel.';
    } else if (cfg.sboEnabled) {
        // Scenario 4: SBO
        sboSection.style.display = '';
        actBtns.style.display    = 'none';
        document.getElementById('cb-sbo-timer-display').style.display = 'none';
    } else {
        // Normal (scenarios 1 & 3)
        updateCBActionButtons(state, lockVal);
    }

    // Hide "Configurar" button for operador
    var cfgBtn = document.getElementById('btn-cb-config-from-operate');
    if (cfgBtn) cfgBtn.style.display = isOperador() ? 'none' : '';

    document.getElementById('modal-cb-operate').classList.add('show');
}

function updateCBActionButtons(state, lockVal) {
    var btnOpen  = document.getElementById('btn-cb-open');
    var btnClose = document.getElementById('btn-cb-close');
    var blockMsg = document.getElementById('cb-block-msg');
    blockMsg.style.display = 'none';

    var sym = canvasSymbols.find(function(s) { return s.id === cbOperateSymId; });
    var cfg = sym ? ((sym.type === 'disc' || sym.type === 'disc2') ? (sym.props.discConfig || {}) : (sym.props.cbConfig || {})) : {};
    var currentLock = (cfg.lockEnabled && cfg.lockVar) ? parseInt(getVarValue('status', cfg.lockVar) || '0') : 0;

    if (state === 'open') {
        // If close lock is active, ABRIR stays enabled (operator can confirm open)
        btnOpen.disabled  = (currentLock !== 1);
        btnOpen.classList.toggle('cb-btn-disabled', currentLock !== 1);
        btnClose.disabled = (currentLock === 1);
        btnClose.classList.toggle('cb-btn-disabled', currentLock === 1);
        if (currentLock === 1) {
            blockMsg.style.display = '';
            blockMsg.className     = 'cb-block-msg cb-block-lock';
            blockMsg.innerHTML     = '🔒 <strong>Bloqueo de cierre activo.</strong><br>No es posible cerrar el seccionador.';
        }
    } else if (state === 'closed') {
        btnClose.disabled = true;
        btnClose.classList.add('cb-btn-disabled');
        btnOpen.disabled  = false;
        btnOpen.classList.remove('cb-btn-disabled');
    } else {
        btnOpen.disabled  = false;  btnOpen.classList.remove('cb-btn-disabled');
        btnClose.disabled = (currentLock === 1);
        btnClose.classList.toggle('cb-btn-disabled', currentLock === 1);
    }
}

function cbDoSelect() {
    var sym = canvasSymbols.find(function(s) { return s.id === cbOperateSymId; });
    if (!sym) return;
    var cfg = (sym.type === 'disc' || sym.type === 'disc2') ? (sym.props.discConfig || {}) : (sym.props.cbConfig || {});
    cbSBOSelected = true;

    // Write SBO_WRITE if configured
    if (cfg.sboWriteVar) {
        writeCBVariable('command', cfg.sboWriteVar, '1', 0);
    }

    // Hide SBO select section, show action buttons
    document.getElementById('cb-sbo-select-section').style.display = 'none';
    document.getElementById('cb-action-buttons').style.display      = '';

    var state   = sym.type === 'disc' ? resolveDiscState(sym) : resolveCBState(sym);
    var lockVal = (cfg.lockEnabled && cfg.lockVar) ? parseInt(getVarValue('status', cfg.lockVar) || '0') : 0;
    updateCBActionButtons(state, lockVal);

    // Show countdown timer above the buttons
    var timerEl = document.getElementById('cb-sbo-timer-display');
    timerEl.style.display = '';
    // Move the timer outside of the now-hidden SBO section so it stays visible
    var actionBtns = document.getElementById('cb-action-buttons');
    actionBtns.parentNode.insertBefore(timerEl, actionBtns);

    var remaining = cfg.sboTimeout || 10;
    timerEl.textContent = 'Time-out SBO: ' + remaining + 's';

    cbSBOTimerHandle = setInterval(function() {
        remaining--;
        if (remaining <= 0) {
            clearCBSBOTimer();
            closeCBOperateModal();
            showToast('SBO: tiempo de espera agotado', 'warning');
        } else {
            timerEl.textContent = 'Time-out SBO: ' + remaining + 's';
        }
    }, 1000);
}

function cbDoOpen() {
    var sym = canvasSymbols.find(function(s) { return s.id === cbOperateSymId; });
    if (!sym) return;
    var cfg = (sym.type === 'disc' || sym.type === 'disc2') ? (sym.props.discConfig || {}) : (sym.props.cbConfig || {});
    if (!cfg.cmdVar) { showToast('No hay variable comando asignada', 'warning'); return; }
    clearCBSBOTimer();
    writeCBVariable('command', cfg.cmdVar, '1', cfg.cmdTime || 0);
    closeCBOperateModal();
    showToast('Comando ABRIR enviado', 'success');
}

function cbDoClose() {
    var sym = canvasSymbols.find(function(s) { return s.id === cbOperateSymId; });
    if (!sym) return;
    var cfg = (sym.type === 'disc' || sym.type === 'disc2') ? (sym.props.discConfig || {}) : (sym.props.cbConfig || {});
    // Check close lock
    if (cfg.lockEnabled && cfg.lockVar) {
        var lv = parseInt(getVarValue('status', cfg.lockVar) || '0');
        if (lv === 1) {
            showToast('Bloqueo de cierre activo — operación cancelada', 'error');
            return;
        }
    }
    if (!cfg.cmdVar) { showToast('No hay variable comando asignada', 'warning'); return; }
    clearCBSBOTimer();
    writeCBVariable('command', cfg.cmdVar, '2', cfg.cmdTime || 0);
    closeCBOperateModal();
    showToast('Comando CERRAR enviado', 'success');
}

function writeCBVariable(type, name, value, pulseTime) {
    if (!name) return;
    var vars = allVariables[type] || [];
    var v    = vars.find(function(x) { return x.name === name; });
    if (!v) {
        showToast('Variable "' + name + '" no encontrada en ' + type, 'warning');
        return;
    }

    // Update local cache immediately
    v.value = value;
    evaluateAllSymbolRules();
    refreshAllVisuals();

    // Persist to backend
    fetch('/api/variables/' + type + '/' + v.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Username': currentUsername },
        body: JSON.stringify({ name: v.name, value: value, description: v.description || '' })
    }).then(function(r) {
        if (!r.ok) showToast('Error al escribir ' + name, 'error');
    }).catch(function() {
        showToast('Error de conexión al escribir ' + name, 'error');
    });

    // If pulseTime > 0, schedule return to '0'
    if (pulseTime > 0) {
        clearCBPulse();
        cbPulseHandle = setTimeout(function() {
            v.value = '0';
            fetch('/api/variables/' + type + '/' + v.id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-Username': currentUsername },
                body: JSON.stringify({ name: v.name, value: '0', description: v.description || '' })
            }).catch(function() {});
            evaluateAllSymbolRules();
            refreshAllVisuals();
        }, pulseTime * 1000);
    }
}

function clearCBSBOTimer() {
    if (cbSBOTimerHandle) { clearInterval(cbSBOTimerHandle); cbSBOTimerHandle = null; }
}
function clearCBPulse() {
    if (cbPulseHandle) { clearTimeout(cbPulseHandle); cbPulseHandle = null; }
}
function closeCBOperateModal() {
    clearCBSBOTimer();
    cbSBOSelected = false;
    document.getElementById('modal-cb-operate').classList.remove('show');
}

function openCBConfigFromOperate() {
    closeCBOperateModal();
    openSymbolPropsModal(cbOperateSymId);
}

// ============================================================
//  UTILITIES
// ============================================================
function showError(el, msg) {
    el.textContent = msg; el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 5000);
}
function hideError(el) { el.classList.remove('show'); }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
