// Global variables
let sessionToken = null;
let currentUsername = null;
let currentTab = 'status';
let editingId = null;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const tokenScreen = document.getElementById('token-screen');
const mainScreen = document.getElementById('main-screen');
const loginForm = document.getElementById('login-form');
const tokenForm = document.getElementById('token-form');
const configForm = document.getElementById('config-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const tokenInput = document.getElementById('token-input');
const loginError = document.getElementById('login-error');
const tokenError = document.getElementById('token-error');
const configMessage = document.getElementById('config-message');
const logoutBtn = document.getElementById('logout-btn');
const tokenBackBtn = document.getElementById('token-back-btn');

// Event Listeners - Login/Token
loginForm.addEventListener('submit', handleLogin);
tokenForm.addEventListener('submit', handleTokenValidation);
configForm.addEventListener('submit', handleConfigSave);
logoutBtn.addEventListener('click', handleLogout);
tokenBackBtn.addEventListener('click', backToLogin);

// Event Listeners - Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Event Listeners - Add buttons
document.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', () => showAddForm(btn.dataset.type));
});

// Event Listeners - Batch buttons
document.querySelectorAll('.batch-btn').forEach(btn => {
    btn.addEventListener('click', () => showBatchSection(btn.dataset.type));
});

// Event Listeners - Forms
document.querySelectorAll('.variable-form').forEach(form => {
    form.addEventListener('submit', handleSaveVariable);
});

// Event Listeners - Cancel buttons
document.querySelectorAll('.cancel-form-btn').forEach(btn => {
    btn.addEventListener('click', hideForm);
});

document.querySelectorAll('.batch-cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => hideBatchSection(btn.dataset.type));
});

// CSV Upload buttons
document.getElementById('status-upload-btn').addEventListener('click', () => {
    document.getElementById('status-csv-input').click();
});
document.getElementById('analog-upload-btn').addEventListener('click', () => {
    document.getElementById('analog-csv-input').click();
});
document.getElementById('command-upload-btn').addEventListener('click', () => {
    document.getElementById('command-csv-input').click();
});

// CSV file inputs
document.getElementById('status-csv-input').addEventListener('change', (e) => {
    handleCSVUpload(e, 'status');
});
document.getElementById('analog-csv-input').addEventListener('change', (e) => {
    handleCSVUpload(e, 'analog');
});
document.getElementById('command-csv-input').addEventListener('change', (e) => {
    handleCSVUpload(e, 'command');
});

// Initialization
checkSession();

// === AUTHENTICATION FUNCTIONS ===

function checkSession() {
    const savedToken = localStorage.getItem('sessionToken');
    const savedUsername = localStorage.getItem('username');

    if (savedToken && savedUsername) {
        sessionToken = savedToken;
        currentUsername = savedUsername;
        showMainScreen();
    }
}

async function handleLogin(e) {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!data.success) {
            showError(loginError, data.message);
            return;
        }

        // Store username for token validation if needed
        currentUsername = username;

        if (data.requiresToken) {
            // Show token screen
            loginScreen.classList.remove('active');
            tokenScreen.classList.add('active');
        } else {
            // Direct login success
            sessionToken = data.sessionToken;
            localStorage.setItem('sessionToken', sessionToken);
            localStorage.setItem('username', username);
            showMainScreen();
        }
    } catch (error) {
        showError(loginError, 'Connection error. Please try again.');
        console.error('Error:', error);
    }
}

async function handleTokenValidation(e) {
    e.preventDefault();

    const token = tokenInput.value.trim();

    try {
        const response = await fetch('/api/auth/validate-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: currentUsername,
                token: token
            })
        });

        const data = await response.json();

        if (!data.success) {
            showError(tokenError, data.message);
            return;
        }

        // Token validated, go to main screen
        sessionToken = data.sessionToken;
        localStorage.setItem('sessionToken', sessionToken);
        localStorage.setItem('username', currentUsername);
        showMainScreen();
    } catch (error) {
        showError(tokenError, 'Connection error. Please try again.');
        console.error('Error:', error);
    }
}

function handleLogout() {
    sessionToken = null;
    currentUsername = null;
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('username');

    loginScreen.classList.add('active');
    tokenScreen.classList.remove('active');
    mainScreen.classList.remove('active');

    usernameInput.value = '';
    passwordInput.value = '';
    tokenInput.value = '';
    hideError(loginError);
    hideError(tokenError);
}

function backToLogin() {
    tokenScreen.classList.remove('active');
    loginScreen.classList.add('active');
    tokenInput.value = '';
    hideError(tokenError);
}

function showError(element, message) {
    element.textContent = message;
    element.classList.add('show');
    setTimeout(() => hideError(element), 5000);
}

function hideError(element) {
    element.classList.remove('show');
}

function showMainScreen() {
    loginScreen.classList.remove('active');
    tokenScreen.classList.remove('active');
    mainScreen.classList.add('active');
    switchTab('status');
    loadSchneiderConfig(); // Load current config
}

// === TAB FUNCTIONS ===

function switchTab(tab) {
    currentTab = tab;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        }
    });

    // Update tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tab}-tab`).classList.add('active');

    // Load variables for this tab (not for config)
    if (tab !== 'config') {
        loadVariables(tab);
    } else {
        loadSchneiderConfig();
    }
}

// === VARIABLE FUNCTIONS ===

async function loadVariables(type) {
    try {
        const headers = {};
        if (currentUsername) {
            headers['X-Username'] = currentUsername;
        }

        const response = await fetch(`/api/variables/${type}`, { headers });

        if (!response.ok) {
            throw new Error('Failed to load variables');
        }

        const variables = await response.json();
        renderTable(type, variables);
    } catch (error) {
        console.error('Error loading variables:', error);
        const tbody = document.getElementById(`${type}-tbody`);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="loading" style="color: red;">
                    Error loading data. Please try again.
                </td>
            </tr>
        `;
    }
}

function renderTable(type, variables) {
    const tbody = document.getElementById(`${type}-tbody`);

    if (variables.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="loading">
                    No variables found. Click "New Variable" to add one.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = variables.map(variable => `
        <tr>
            <td>${variable.id}</td>
            <td><strong>${variable.name}</strong></td>
            <td>${variable.value}</td>
            <td>${variable.description || '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-warning" onclick="editVariable('${type}', ${variable.id})">
                        ✏️ Edit
                    </button>
                    <button class="btn btn-danger" onclick="deleteVariable('${type}', ${variable.id})">
                        🗑️ Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// === FORM FUNCTIONS ===

function showAddForm(type) {
    hideBatchSection(type);

    const formSection = document.getElementById(`${type}-form-section`);
    const form = formSection.querySelector('.variable-form');

    document.getElementById(`${type}-form-title`).textContent = `New ${capitalize(type)} Variable`;
    form.querySelector('.variable-name').value = '';
    form.querySelector('.variable-description').value = '';

    // ✅ OCULTAR campo de valor
    const valueField = form.querySelector('.value-field');
    if (valueField) {
        valueField.style.display = 'none';
    }

    editingId = null;
    formSection.style.display = 'block';
    form.querySelector('.variable-name').focus();
}

function hideForm() {
    document.querySelectorAll('.form-section').forEach(section => {
        section.style.display = 'none';
    });
    editingId = null;
}

async function handleSaveVariable(e) {
    e.preventDefault();

    const form = e.target;
    const type = form.dataset.type;

    const name = form.querySelector('.variable-name').value.trim();
    const description = form.querySelector('.variable-description').value.trim();

    const variableData = {
        name,
        value: "", // Vacío por defecto
        description: description || null
    };

    // ✅ CRÍTICO: Si estamos EDITANDO, incluir el valor
    if (editingId) {
        const valueInput = form.querySelector('.variable-value');
        if (valueInput) {
            variableData.value = valueInput.value.trim();
        }
    }

    console.log('Sending data:', variableData); // ✅ Para debug

    try {
        let url = `/api/variables/${type}`;
        let method = 'POST';

        if (editingId) {
            url = `/api/variables/${type}/${editingId}`;
            method = 'PUT';
        }

        const headers = {
            'Content-Type': 'application/json'
        };

        if (currentUsername) {
            headers['X-Username'] = currentUsername;
        }

        const response = await fetch(url, {
            method,
            headers,
            body: JSON.stringify(variableData)
        });

        if (response.ok) {
            hideForm();
            loadVariables(type);
        } else {
            alert('Error saving variable');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error saving variable');
    }
}

async function editVariable(type, id) {
    try {
        const response = await fetch(`/api/variables/${type}`);
        const variables = await response.json();
        const variable = variables.find(v => v.id === id);

        if (!variable) return;

        hideBatchSection(type);

        const formSection = document.getElementById(`${type}-form-section`);
        const form = formSection.querySelector('.variable-form');

        document.getElementById(`${type}-form-title`).textContent = `Edit ${capitalize(type)} Variable`;
        form.querySelector('.variable-name').value = variable.name;
        form.querySelector('.variable-description').value = variable.description || '';

        // ✅ MOSTRAR y llenar campo de valor
        const valueField = form.querySelector('.value-field');
        const valueInput = form.querySelector('.variable-value');

        if (valueField && valueInput) {
            valueField.style.display = 'block';
            valueInput.value = variable.value || '';
        }

        editingId = id;
        formSection.style.display = 'block';
        form.querySelector('.variable-name').focus();
    } catch (error) {
        console.error('Error:', error);
        alert('Error loading variable');
    }
}

async function deleteVariable(type, id) {
    if (!confirm('Are you sure you want to delete this variable?')) {
        return;
    }

    try {
        const response = await fetch(`/api/variables/${type}/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadVariables(type);
        } else {
            alert('Error deleting variable');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error deleting variable');
    }
}

// === BATCH IMPORT FUNCTIONS ===

function showBatchSection(type) {
    hideForm();
    document.getElementById(`${type}-batch`).style.display = 'block';

    // Hide result
    const resultDiv = document.getElementById(`${type}-batch-result`);
    resultDiv.className = 'batch-result';
    resultDiv.textContent = '';
}

function hideBatchSection(type) {
    document.getElementById(`${type}-batch`).style.display = 'none';

    // Reset file input
    document.getElementById(`${type}-csv-input`).value = '';

    // Hide result
    const resultDiv = document.getElementById(`${type}-batch-result`);
    resultDiv.className = 'batch-result';
    resultDiv.textContent = '';
}

async function handleCSVUpload(event, type) {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.name.endsWith('.csv')) {
        alert('Please select a CSV file');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const resultDiv = document.getElementById(`${type}-batch-result`);
    resultDiv.className = 'batch-result';
    resultDiv.textContent = 'Uploading...';
    resultDiv.style.display = 'block';

    try {
        const headers = {};
        if (currentUsername) {
            headers['X-Username'] = currentUsername;
        }

        const response = await fetch(`/api/variables/${type}/import-csv`, {
            method: 'POST',
            headers,
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            resultDiv.className = 'batch-result success';
            resultDiv.textContent = `✓ ${data.message}`;

            // Reload variables
            loadVariables(type);

            // Hide after 3 seconds
            setTimeout(() => {
                hideBatchSection(type);
            }, 3000);
        } else {
            resultDiv.className = 'batch-result error';
            resultDiv.textContent = `✗ ${data.message}`;
        }
    } catch (error) {
        resultDiv.className = 'batch-result error';
        resultDiv.textContent = `✗ Error uploading file: ${error.message}`;
        console.error('Error:', error);
    }

    // Reset file input
    event.target.value = '';
}

// === UTILITY FUNCTIONS ===

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// === CONFIGURATION FUNCTIONS ===

async function loadSchneiderConfig() {
    if (!currentUsername) return;

    try {
        const response = await fetch(`/api/auth/schneider-config/${currentUsername}`);

        if (response.ok) {
            const config = await response.json();

            if (config.hasConfig) {
                // Show current configuration
                document.getElementById('config-current').style.display = 'block';
                document.getElementById('current-schneider-username').textContent = config.schneiderUsername || '-';
                document.getElementById('current-rtu-ip').textContent = config.rtuIp || '-';
                document.getElementById('config-status').textContent = 'Configured';

                // Pre-fill form with current values (except password)
                document.getElementById('config-schneider-username').value = config.schneiderUsername || '';
                document.getElementById('config-rtu-ip').value = config.rtuIp || '';
            } else {
                document.getElementById('config-current').style.display = 'none';
                document.getElementById('config-status').textContent = 'Not configured';
            }
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

async function handleConfigSave(e) {
    e.preventDefault();

    const schneiderUsername = document.getElementById('config-schneider-username').value.trim();
    const schneiderPassword = document.getElementById('config-schneider-password').value.trim();
    const rtuIp = document.getElementById('config-rtu-ip').value.trim();

    try {
        const response = await fetch('/api/auth/schneider-config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: currentUsername,
                schneiderUsername: schneiderUsername,
                schneiderPassword: schneiderPassword,
                rtuIp: rtuIp
            })
        });

        const data = await response.json();

        if (!data.success) {
            configMessage.textContent = data.message;
            configMessage.classList.add('show');
            configMessage.style.background = '#f8d7da';
            configMessage.style.color = '#721c24';
            setTimeout(() => configMessage.classList.remove('show'), 5000);
            return;
        }

        // Success
        configMessage.textContent = data.message;
        configMessage.classList.add('show');
        configMessage.style.background = '#d4edda';
        configMessage.style.color = '#155724';

        // Clear password field
        document.getElementById('config-schneider-password').value = '';

        // Reload config to show updated values
        setTimeout(() => {
            configMessage.classList.remove('show');
            loadSchneiderConfig();
        }, 2000);

    } catch (error) {
        configMessage.textContent = 'Connection error. Please try again.';
        configMessage.classList.add('show');
        configMessage.style.background = '#f8d7da';
        configMessage.style.color = '#721c24';
        console.error('Error:', error);
    }
}

