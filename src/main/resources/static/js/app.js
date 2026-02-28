// ============================================================
//  BOTTINO MONITORING - app.js
// ============================================================

let sessionToken    = null;
let currentUsername = null;
let currentTab      = 'status';
let editingId       = null;
let schneiderConfig = null;
let allVariables    = { status: [], analog: [], command: [] };

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
    document.getElementById('tool-delete').addEventListener('click',  deleteSelected);
    document.getElementById('tool-clear').addEventListener('click',   clearCanvas);
}

// ============================================================
//  AUTH
// ============================================================
function checkSession() {
    var t = localStorage.getItem('sessionToken');
    var u = localStorage.getItem('username');
    if (t && u) { sessionToken = t; currentUsername = u; showMainScreen(); }
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
        if (data.requiresToken) {
            loginScreen.classList.remove('active');
            tokenScreen.classList.add('active');
        } else {
            sessionToken = data.sessionToken;
            localStorage.setItem('sessionToken', sessionToken);
            localStorage.setItem('username', username);
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
        localStorage.setItem('sessionToken', sessionToken);
        localStorage.setItem('username', currentUsername);
        showMainScreen();
    } catch(err) { showError(tokenError, 'Connection error. Please try again.'); }
}

function handleLogout() {
    sessionToken = null; currentUsername = null; schneiderConfig = null;
    localStorage.removeItem('sessionToken'); localStorage.removeItem('username');
    loginScreen.classList.add('active');
    tokenScreen.classList.remove('active');
    mainScreen.classList.remove('active');
    usernameInput.value = ''; passwordInput.value = ''; tokenInput.value = '';
    hideError(loginError); hideError(tokenError);
    if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
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
    switchSidebarTab('variables');
    switchTab('status');
    loadSchneiderConfig();
    loadAllVariablesCache();
    initPanelCanvas();
    loadPanelListFromDB();
    startVariablePolling();
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
    document.querySelectorAll('.sidebar-nav-item').forEach(function(b) { b.classList.toggle('active', b.dataset.sidebar === name); });
    document.querySelectorAll('.sidebar-pane').forEach(function(p) { p.classList.remove('active'); });
    document.getElementById('sidebar-' + name).classList.add('active');
    document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
    if (name === 'panel') {
        document.getElementById('view-panel').classList.add('active');
        setTimeout(resizePanelCanvas, 50);
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
        renderTable(type, await r.json());
    } catch(err) {
        document.getElementById(type + '-tbody').innerHTML = '<tr><td colspan="5" class="loading" style="color:red;">Error loading data.</td></tr>';
    }
}

function renderTable(type, variables) {
    var tbody = document.getElementById(type + '-tbody');
    if (!variables.length) { tbody.innerHTML = '<tr><td colspan="5" class="loading">No variables found.</td></tr>'; return; }
    tbody.innerHTML = variables.map(function(v) {
        return '<tr>' +
            '<td>' + v.id + '</td>' +
            '<td><strong>' + escapeHtml(v.name) + '</strong></td>' +
            '<td>' + escapeHtml(String(v.value)) + '</td>' +
            '<td>' + escapeHtml(v.description || '-') + '</td>' +
            '<td><div class="action-buttons">' +
            '<button class="btn btn-warning" onclick="editVariable(\'' + type + '\',' + v.id + ')">✏️ Edit</button>' +
            '<button class="btn btn-danger"  onclick="deleteVariable(\'' + type + '\',' + v.id + ')">🗑️ Delete</button>' +
            '</div></td></tr>';
    }).join('');
}

async function loadAllVariablesCache() {
    for (var i = 0; i < ['status','analog','command'].length; i++) {
        var type = ['status','analog','command'][i];
        try {
            var headers = currentUsername ? { 'X-Username': currentUsername } : {};
            var r = await fetch('/api/variables/' + type, { headers: headers });
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
        await loadAllVariablesCache();
        evaluateAllSymbolRules();
        checkRTUAlert();
    }, 10000);
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

// ============================================================
//  MODALS
// ============================================================
function openModal(id)  { document.getElementById(id).classList.add('show'); }
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
            panels[p.id] = { id: p.id, name: p.name, symbols: canvas.symbols || [], connections: canvas.connections || [] };
        });
    } catch(err) { showToast('Error al cargar paneles', 'error'); panels = {}; }

    renderPanelList();
    var ids = Object.keys(panels).map(Number);
    if (ids.length > 0) loadPanel(ids[0]);
    else doCreatePanel('Panel Principal');
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
            '<span class="panel-list-name">' + escapeHtml(p.name) + '</span>' +
            '<button class="panel-list-del" data-id="' + id + '" title="Eliminar panel">✕</button>';
        div.addEventListener('click', function(e) {
            if (e.target.classList.contains('panel-list-del')) {
                e.stopPropagation();
                deletePanel(Number(e.target.dataset.id));
            } else {
                loadPanel(id);
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
        panels[saved.id] = { id: saved.id, name: saved.name, symbols: [], connections: [] };
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
    selectedId = null; connectFrom = null; dragState = null;
    if (symLayer)  symLayer.innerHTML  = '';
    if (connLayer) connLayer.innerHTML = '';
    canvasSymbols.forEach(function(sym)  { createSymbolElement(sym); });
    connections.forEach(function(conn)   { createConnectionElement(conn); });
    document.getElementById('current-panel-name').textContent = data.name;
    renderPanelList();
    evaluateAllSymbolRules();
}

async function saveCurrentPanel() {
    if (!currentPanelId || !panels[currentPanelId]) { showToast('No hay panel activo para guardar', 'warning'); return; }
    panels[currentPanelId].symbols     = JSON.parse(JSON.stringify(canvasSymbols));
    panels[currentPanelId].connections = JSON.parse(JSON.stringify(connections));
    try {
        var p       = panels[currentPanelId];
        var headers = { 'Content-Type': 'application/json', 'X-Username': currentUsername };
        var body    = JSON.stringify({ name: p.name, canvasData: JSON.stringify({ symbols: p.symbols, connections: p.connections }) });
        var r       = await fetch('/api/panels/' + currentPanelId, { method: 'PUT', headers: headers, body: body });
        if (!r.ok) throw new Error();
        showToast('Panel "' + p.name + '" guardado correctamente', 'success');
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
    { id:'cb',    label:'Circuit Breaker', short:'CB',  color:'#667eea', draw: drawCircuitBreaker },
    { id:'disc',  label:'Disconnector',    short:'DS',  color:'#667eea', draw: drawDisconnector   },
    { id:'xfmr',  label:'Transformer',     short:'TF',  color:'#667eea', draw: drawTransformer    },
    { id:'motor', label:'Motor',           short:'M',   color:'#667eea', draw: drawMotor          },
    { id:'gen',   label:'Generator',       short:'G',   color:'#28a745', draw: drawGenerator      },
    { id:'cap',   label:'Capacitor Bank',  short:'CAP', color:'#667eea', draw: drawCapacitor      },
    { id:'load',  label:'Load',            short:'LD',  color:'#764ba2', draw: drawLoad           },
    { id:'bus',   label:'Bus Bar',         short:'BUS', color:'#667eea', draw: drawBusBar         },
    { id:'fuse',  label:'Fuse',            short:'FU',  color:'#dc3545', draw: drawFuse           },
    { id:'relay', label:'Relay',           short:'RY',  color:'#17a2b8', draw: drawRelay          },
];

var panelTool     = 'select';
var canvasSymbols = [];
var connections   = [];
var selectedId    = null;
var connectFrom   = null;
var dragState     = null;
var panelInited   = false;
var svgEl, symLayer, connLayer;

function initPanelCanvas() {
    if (panelInited) return;
    panelInited = true;
    svgEl     = document.getElementById('panel-canvas');
    symLayer  = document.getElementById('symbols-layer');
    connLayer = document.getElementById('connections-layer');
    buildSymbolPalette();
    resizePanelCanvas();
    window.addEventListener('resize', resizePanelCanvas);
    svgEl.addEventListener('mousemove',  onCanvasMouseMove);
    svgEl.addEventListener('mouseup',    onCanvasMouseUp);
    svgEl.addEventListener('mouseleave', onCanvasMouseLeave);
    svgEl.addEventListener('dragover',   function(e) { e.preventDefault(); });
    svgEl.addEventListener('drop',       onCanvasDrop);
    svgEl.addEventListener('click', function(e) {
        if (e.target === svgEl || e.target.id === 'connections-layer' || e.target.id === 'symbols-layer') {
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
    var sym = { id: id, type: type, x: x, y: y, props: { label: def ? def.short + (canvasSymbols.length + 1) : 'X', status: '', notes: '', color: '', rule: null, ruleActiveColor: null } };
    canvasSymbols.push(sym);
    createSymbolElement(sym);
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
    hitRect.setAttribute('width', '56'); hitRect.setAttribute('height', '72');
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
    outer.addEventListener('dblclick', function(e) { e.stopPropagation(); openSymbolPropsModal(sym.id); });
    updateSymbolDrawing(sym);
}

function updateSymbolDrawing(sym) {
    var outer = document.getElementById(sym.id);
    if (!outer) return;
    var inner = outer.querySelector('.sym-drawing');
    if (!inner) return;
    var def   = ANSI_SYMBOLS.find(function(s) { return s.id === sym.type; });
    var color = sym.props.ruleActiveColor || sym.props.color || (def ? def.color : '#667eea');
    inner.innerHTML =
        (def ? def.draw(50, 38, false, color) : defaultSymbolSVG()) +
        '<text class="sym-label"    x="25" y="53">' + escapeHtml(sym.props.label || '') + '</text>' +
        '<text class="sym-sublabel" x="25" y="63">' + escapeHtml(sym.props.status ? '[' + sym.props.status + ']' : '') + '</text>';
    outer.setAttribute('transform', 'translate(' + (sym.x - 25) + ',' + (sym.y - 24) + ')');
    outer.classList.toggle('selected',   sym.id === selectedId);
    outer.classList.toggle('connecting', sym.id === connectFrom);
}

function refreshAllVisuals() {
    canvasSymbols.forEach(function(s) { updateSymbolDrawing(s); });
    connections.forEach(function(c) { updateConnectionDrawing(c); });
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
    }
}

function setConnectHighlight(symId, on) {
    var el = document.getElementById(symId);
    if (el) el.classList.toggle('connecting', on);
}

function onCanvasMouseMove(e) {
    if (!dragState) return;
    var rect = svgEl.getBoundingClientRect();
    var sym  = canvasSymbols.find(function(s) { return s.id === dragState.symbolId; });
    if (!sym) return;
    sym.x = e.clientX - rect.left - dragState.offsetX;
    sym.y = e.clientY - rect.top  - dragState.offsetY;
    updateSymbolDrawing(sym);
    connections.filter(function(c) { return c.fromId === sym.id || c.toId === sym.id; }).forEach(function(c) { updateConnectionDrawing(c); });
}
function onCanvasMouseUp()    { dragState = null; }
function onCanvasMouseLeave() { dragState = null; }

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
}

async function clearCanvas() {
    var ok = await showConfirm('¿Limpiar todos los símbolos y conexiones del canvas?', 'Limpiar canvas');
    if (!ok) return;
    canvasSymbols = []; connections = []; selectedId = null; connectFrom = null;
    symLayer.innerHTML = ''; connLayer.innerHTML = '';
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
    document.getElementById('symbol-props-title').textContent = '⚡ ' + (def ? def.label : 'Symbol');

    document.getElementById('sym-prop-status').value = sym.props.status || '';
    document.getElementById('sym-prop-notes').value  = sym.props.notes  || '';

    var rule    = sym.props.rule || {};
    var varType = rule.varType || '';
    document.getElementById('sym-var-type').value = varType;
    populateVarDropdown(varType, rule.varName || '');
    document.getElementById('sym-var-condition').value    = rule.condition   || '';
    document.getElementById('sym-var-threshold').value    = rule.threshold   || '';
    document.getElementById('sym-var-action-color').value = rule.actionColor || '#e74c3c';

    updateRuleRows(varType, rule.varName || '', rule.condition || '');
    if (varType && rule.varName) showCurrentVarValue(varType, rule.varName);

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
    if (el) el.textContent = varObj ? String(varObj.value) : '—';
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
    document.getElementById('rule-var-row').style.display   = type             ? '' : 'none';
    document.getElementById('rule-block').style.display     = (type && name)   ? '' : 'none';
    document.getElementById('rule-threshold-row').style.display = condition    ? '' : 'none';
    document.getElementById('rule-action-row').style.display    = condition    ? '' : 'none';
}

function saveSymbolProps() {
    var sym = canvasSymbols.find(function(s) { return s.id === editingSymbolId; });
    if (!sym) return;
    sym.props.status = document.getElementById('sym-prop-status').value;
    sym.props.notes  = document.getElementById('sym-prop-notes').value.trim();
    var varType     = document.getElementById('sym-var-type').value;
    var varName     = document.getElementById('sym-var-name').value;
    var condition   = document.getElementById('sym-var-condition').value;
    var threshold   = document.getElementById('sym-var-threshold').value.trim();
    var actionColor = document.getElementById('sym-var-action-color').value;
    sym.props.rule = (varType && varName && condition)
        ? { varType: varType, varName: varName, condition: condition, threshold: threshold, actionColor: actionColor }
        : null;
    sym.props.ruleActiveColor = null;
    closeModal('modal-symbol-props');
    updateSymbolDrawing(sym);
    evaluateAllSymbolRules();
    showToast('Configuración del símbolo guardada', 'success');
}

// ============================================================
//  ANSI/IEC SYMBOL DRAWINGS
// ============================================================
function symSVG(w, h, inner) {
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 50 40" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
}
function defaultSymbolSVG() {
    return '<rect class="sym-body" x="5" y="5" width="40" height="30" rx="4" fill="white" stroke="#667eea" stroke-width="2"/>';
}
function drawCircuitBreaker(w, h, preview, c) {
    c = c || '#667eea';
    var inner = '<rect class="sym-body" x="10" y="7" width="30" height="26" rx="3" fill="white" stroke="' + c + '" stroke-width="2"/><line x1="25" y1="7" x2="25" y2="0" stroke="' + c + '" stroke-width="2"/><line x1="25" y1="33" x2="25" y2="40" stroke="' + c + '" stroke-width="2"/><line x1="17" y1="20" x2="33" y2="20" stroke="' + c + '" stroke-width="1.5"/><circle cx="25" cy="13" r="4" fill="' + c + '"/>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawDisconnector(w, h, preview, c) {
    c = c || '#667eea';
    var inner = '<line x1="3" y1="20" x2="18" y2="20" stroke="' + c + '" stroke-width="2.5"/><line x1="32" y1="20" x2="47" y2="20" stroke="' + c + '" stroke-width="2.5"/><line x1="18" y1="20" x2="30" y2="11" stroke="' + c + '" stroke-width="2" stroke-linecap="round"/><circle cx="18" cy="20" r="3.5" fill="white" stroke="' + c + '" stroke-width="2" class="sym-body"/><circle cx="32" cy="20" r="3.5" fill="white" stroke="' + c + '" stroke-width="2"/>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawTransformer(w, h, preview, c) {
    c = c || '#667eea';
    var inner = '<circle cx="18" cy="20" r="10" fill="white" stroke="' + c + '" stroke-width="2" class="sym-body"/><circle cx="32" cy="20" r="10" fill="white" stroke="' + c + '" stroke-width="2"/><line x1="0" y1="20" x2="8" y2="20" stroke="' + c + '" stroke-width="2"/><line x1="42" y1="20" x2="50" y2="20" stroke="' + c + '" stroke-width="2"/>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawMotor(w, h, preview, c) {
    c = c || '#667eea';
    var inner = '<circle cx="25" cy="20" r="16" fill="white" stroke="' + c + '" stroke-width="2" class="sym-body"/><text x="25" y="25" font-size="13" font-weight="bold" fill="' + c + '" text-anchor="middle" font-family="sans-serif">M</text><line x1="0" y1="20" x2="9" y2="20" stroke="' + c + '" stroke-width="2"/>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawGenerator(w, h, preview, c) {
    c = c || '#28a745';
    var inner = '<circle cx="25" cy="20" r="16" fill="white" stroke="' + c + '" stroke-width="2" class="sym-body"/><text x="25" y="25" font-size="13" font-weight="bold" fill="' + c + '" text-anchor="middle" font-family="sans-serif">G</text><line x1="0" y1="20" x2="9" y2="20" stroke="' + c + '" stroke-width="2"/>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawCapacitor(w, h, preview, c) {
    c = c || '#667eea';
    var inner = '<line x1="4" y1="20" x2="20" y2="20" stroke="' + c + '" stroke-width="2"/><line x1="30" y1="20" x2="46" y2="20" stroke="' + c + '" stroke-width="2"/><line x1="20" y1="8" x2="20" y2="32" stroke="' + c + '" stroke-width="3.5" class="sym-body"/><line x1="30" y1="8" x2="30" y2="32" stroke="' + c + '" stroke-width="3.5"/>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawLoad(w, h, preview, c) {
    c = c || '#764ba2';
    var inner = '<polygon class="sym-body" points="25,6 42,34 8,34" fill="white" stroke="' + c + '" stroke-width="2"/><line x1="25" y1="0" x2="25" y2="6" stroke="' + c + '" stroke-width="2"/>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawBusBar(w, h, preview, c) {
    c = c || '#667eea';
    var inner = '<rect class="sym-body" x="2" y="15" width="46" height="10" rx="2" fill="' + c + '" stroke="' + c + '" stroke-width="1"/>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawFuse(w, h, preview, c) {
    c = c || '#dc3545';
    var inner = '<rect class="sym-body" x="14" y="13" width="22" height="14" rx="3" fill="white" stroke="' + c + '" stroke-width="2"/><line x1="4" y1="20" x2="14" y2="20" stroke="' + c + '" stroke-width="2"/><line x1="36" y1="20" x2="46" y2="20" stroke="' + c + '" stroke-width="2"/><line x1="14" y1="20" x2="36" y2="20" stroke="' + c + '" stroke-width="1.5" stroke-dasharray="3 2"/>';
    return preview ? symSVG(w, h, inner) : inner;
}
function drawRelay(w, h, preview, c) {
    c = c || '#17a2b8';
    var inner = '<rect class="sym-body" x="9" y="7" width="32" height="26" rx="3" fill="white" stroke="' + c + '" stroke-width="2"/><text x="25" y="24" font-size="11" font-weight="bold" fill="' + c + '" text-anchor="middle" font-family="sans-serif">RY</text><line x1="0" y1="20" x2="9" y2="20" stroke="' + c + '" stroke-width="2"/><line x1="41" y1="20" x2="50" y2="20" stroke="' + c + '" stroke-width="2"/>';
    return preview ? symSVG(w, h, inner) : inner;
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
