/**
 * Reserva Global Importados - Panel de Administración
 * Login con Firebase Auth + protecciones básicas de fuerza bruta
 */

// ─────────────────────────────────────────────
// CONFIGURACIÓN DE SEGURIDAD
// ─────────────────────────────────────────────
const SECURITY_CONFIG = {
    maxAttempts: 5,
    lockTime: 15 * 60 * 1000,      // 15 minutos
    sessionDuration: 8 * 60 * 60 * 1000, // 8 horas
    tokenRefreshInterval: 30 * 60 * 1000, // 30 minutos
    rateLimit: {
        windowMs: 15 * 60 * 1000,  // 15 minutos
        maxRequests: 10
    }
};

// 🔒 Lista blanca de administradores autorizados
const ADMIN_EMAILS = ['rodrigoatatat@gmail.com'];

let loginAttempts = 0;
let isLocked = false;
let lockUntil = 0;
let requestCount = 0;
let rateLimitReset = Date.now() + SECURITY_CONFIG.rateLimit.windowMs;

// ─────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('adminLoginForm');
    loadSecurityState();
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    loadSessionState();
    loadSavedCredentials();
    setupEventListeners();
});

function setupEventListeners() {
    const inputs = ['adminUsername', 'adminPassword'];
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', () => {
                const errorDiv = document.querySelector('.error-message');
                if (errorDiv) errorDiv.remove();
            });
        }
    });
}

// ─────────────────────────────────────────────
// UTILIDAD DE HASH (no almacena contraseñas reales)
// ─────────────────────────────────────────────
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString(16);
}

// ─────────────────────────────────────────────
// SESIÓN
// ─────────────────────────────────────────────
function loadSessionState() {
    const sessionToken = localStorage.getItem('gi_admin_session_token');
    const sessionExpiry = localStorage.getItem('gi_admin_session_expiry');
    const sessionHash = localStorage.getItem('gi_admin_session_hash');

    if (sessionToken && sessionExpiry && Date.now() < parseInt(sessionExpiry)) {
        const expectedHash = simpleHash(sessionToken + SECURITY_CONFIG.sessionDuration);
        if (sessionHash === expectedHash) {
            window.location.href = 'admin.html';
        } else {
            clearSession();
        }
    }
}

function createSession(userId, userEmail) {
    const sessionToken = 'gi_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
    const expiry = Date.now() + SECURITY_CONFIG.sessionDuration;
    const sessionHash = simpleHash(sessionToken + expiry);

    localStorage.setItem('gi_admin_session_token', sessionToken);
    localStorage.setItem('gi_admin_session_expiry', expiry.toString());
    localStorage.setItem('gi_admin_session_hash', sessionHash);
    localStorage.setItem('gi_admin_user_id', userId);
    localStorage.setItem('gi_admin_user_email', userEmail);

    logSecurityEvent('login_success', userEmail);
}

function clearSession() {
    localStorage.removeItem('gi_admin_session_token');
    localStorage.removeItem('gi_admin_session_expiry');
    localStorage.removeItem('gi_admin_session_hash');
    localStorage.removeItem('gi_admin_user_id');
    localStorage.removeItem('gi_admin_user_email');
}

// ─────────────────────────────────────────────
// "RECORDARME"
// ─────────────────────────────────────────────
function saveCredentials(email, remember) {
    if (remember && email) {
        localStorage.setItem('gi_admin_saved_email', email);
        localStorage.setItem('gi_admin_has_saved_creds', 'true');
    } else {
        localStorage.removeItem('gi_admin_saved_email');
        localStorage.removeItem('gi_admin_has_saved_creds');
    }
}

function loadSavedCredentials() {
    if (localStorage.getItem('gi_admin_has_saved_creds') === 'true') {
        const savedEmail = localStorage.getItem('gi_admin_saved_email');
        const emailInput = document.getElementById('adminUsername');
        const rememberCheckbox = document.getElementById('rememberMe');

        if (savedEmail && emailInput) emailInput.value = savedEmail;
        if (rememberCheckbox) rememberCheckbox.checked = true;

        const passwordInput = document.getElementById('adminPassword');
        if (passwordInput && savedEmail) setTimeout(() => passwordInput.focus(), 100);
    }
}

// ─────────────────────────────────────────────
// RATE LIMIT
// ─────────────────────────────────────────────
function checkRateLimit() {
    if (Date.now() > rateLimitReset) {
        requestCount = 0;
        rateLimitReset = Date.now() + SECURITY_CONFIG.rateLimit.windowMs;
    }
    requestCount++;
    if (requestCount > SECURITY_CONFIG.rateLimit.maxRequests) {
        showError('Demasiados intentos. Esperá 15 minutos.');
        return false;
    }
    return true;
}

// ─────────────────────────────────────────────
// MODAL "OLVIDÉ MI CONTRASEÑA"
// ─────────────────────────────────────────────
function showForgotPassword(e) {
    if (e) e.preventDefault();

    const lastResetAttempt = localStorage.getItem('gi_admin_last_reset_attempt');
    if (lastResetAttempt && Date.now() - parseInt(lastResetAttempt) < 60000) {
        showError('Esperá un minuto antes de solicitar otro enlace');
        return;
    }

    const modal = document.getElementById('forgotModal');
    if (modal) modal.style.display = 'flex';
}

function closeForgotModal() {
    const modal = document.getElementById('forgotModal');
    if (modal) modal.style.display = 'none';
    const resetMessage = document.getElementById('resetMessage');
    if (resetMessage) { resetMessage.innerText = ""; resetMessage.style.color = ""; }
    const resetEmail = document.getElementById('resetEmail');
    if (resetEmail) resetEmail.value = "";
}

async function sendResetEmail() {
    const emailInput = document.getElementById('resetEmail');
    const msg = document.getElementById('resetMessage');
    const email = emailInput ? emailInput.value.trim() : "";

    if (!email) {
        if (msg) { msg.innerText = "⚠️ Ingresá un email válido"; msg.style.color = "#ff5f6d"; }
        return;
    }

    localStorage.setItem('gi_admin_last_reset_attempt', Date.now().toString());

    const btn = document.querySelector('#forgotModal .login-btn');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...'; }

    try {
        await firebase.auth().sendPasswordResetEmail(email);
        if (msg) { msg.innerText = "✓ Enlace enviado. Revisá tu correo."; msg.style.color = "#2ECC71"; }
        setTimeout(() => { closeForgotModal(); showSuccess('Email de recuperación enviado'); }, 3000);
    } catch (error) {
        let errorMessage = "Error al enviar el enlace";
        switch (error.code) {
            case 'auth/user-not-found': errorMessage = "No existe una cuenta con este email"; break;
            case 'auth/invalid-email': errorMessage = "Email inválido"; break;
            case 'auth/too-many-requests': errorMessage = "Demasiados intentos. Esperá unos minutos"; break;
        }
        if (msg) { msg.innerText = "❌ " + errorMessage; msg.style.color = "#ff5f6d"; }
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
    }
}

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
function handleSuccessfulLogin(user, rememberMe) {
    if (!ADMIN_EMAILS.includes(user.email)) {
        showError("Acceso denegado. No tenés permisos de administrador.");
        firebase.auth().signOut();
        logSecurityEvent('unauthorized_access_attempt', user.email);
        return;
    }

    clearLock();

    const email = document.getElementById('adminUsername').value.trim();
    saveCredentials(email, rememberMe);
    createSession(user.uid, user.email);
    logSecurityEvent('login_success', user.email);

    showSuccess('✓ Acceso concedido. Redirigiendo...');
    setTimeout(() => { window.location.href = 'admin.html'; }, 1200);
}

async function handleLogin(e) {
    e.preventDefault();

    if (!checkRateLimit()) return;

    if (isLocked) {
        const remainingTime = Math.ceil((lockUntil - Date.now()) / 60000);
        if (remainingTime > 0) {
            showError(`Cuenta bloqueada. Intentá de nuevo en ${remainingTime} minuto(s).`);
            return;
        } else {
            clearLock();
        }
    }

    const email = document.getElementById('adminUsername').value.trim().toLowerCase();
    const password = document.getElementById('adminPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;

    if (!email || !password) { showError('Completá email y contraseña'); return; }
    if (!email.includes('@') || !email.includes('.')) { showError('Ingresá un email válido'); return; }
    if (password.length < 6) { showError('Contraseña inválida'); return; }

    setLoadingState(true);

    try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        setLoadingState(false);
        handleSuccessfulLogin(userCredential.user, rememberMe);
    } catch (error) {
        handleFailedLogin(error);
    }
}

function handleFailedLogin(error) {
    setLoadingState(false);

    let message = 'Email o contraseña incorrectos';
    switch (error.code) {
        case 'auth/user-not-found': message = 'No existe una cuenta con este email'; break;
        case 'auth/wrong-password': message = 'Contraseña incorrecta'; break;
        case 'auth/too-many-requests':
            message = 'Demasiados intentos. Cuenta temporalmente bloqueada';
            isLocked = true;
            lockUntil = Date.now() + SECURITY_CONFIG.lockTime;
            saveSecurityState();
            break;
        case 'auth/invalid-email': message = 'Email inválido'; break;
        default: message = 'Error de autenticación. Intentá nuevamente';
    }

    loginAttempts++;
    saveSecurityState();
    logSecurityEvent('login_failed', document.getElementById('adminUsername')?.value, error.code);

    if (loginAttempts >= SECURITY_CONFIG.maxAttempts) {
        isLocked = true;
        lockUntil = Date.now() + SECURITY_CONFIG.lockTime;
        saveSecurityState();
        showError(`Máximos intentos alcanzados. Bloqueado por 15 minutos.`);
    } else {
        showError(`${message}. Intentos restantes: ${SECURITY_CONFIG.maxAttempts - loginAttempts}`);
    }
}

// ─────────────────────────────────────────────
// LOGS DE SEGURIDAD (localStorage, máx 50)
// ─────────────────────────────────────────────
function logSecurityEvent(eventType, email, details = '') {
    const logEntry = { timestamp: new Date().toISOString(), eventType, email, userAgent: navigator.userAgent, details };
    const logs = JSON.parse(localStorage.getItem('gi_admin_security_logs') || '[]');
    logs.unshift(logEntry);
    if (logs.length > 50) logs.pop();
    localStorage.setItem('gi_admin_security_logs', JSON.stringify(logs));
    console.log('[SECURITY]', logEntry);
}

// ─────────────────────────────────────────────
// ESTADO DE SEGURIDAD
// ─────────────────────────────────────────────
function saveSecurityState() {
    localStorage.setItem('gi_admin_login_attempts', loginAttempts);
    localStorage.setItem('gi_admin_lock_until', lockUntil);
}
function loadSecurityState() {
    loginAttempts = parseInt(localStorage.getItem('gi_admin_login_attempts') || "0");
    lockUntil = parseInt(localStorage.getItem('gi_admin_lock_until') || "0");
    if (lockUntil && Date.now() < lockUntil) isLocked = true;
}
function clearLock() {
    loginAttempts = 0; isLocked = false; lockUntil = 0; requestCount = 0;
    saveSecurityState();
}

// ─────────────────────────────────────────────
// UI UTILS
// ─────────────────────────────────────────────
function setLoadingState(isLoading) {
    const btn = document.getElementById('loginButton');
    if (!btn) return;
    const spinner = btn.querySelector('.loading-spinner');
    const span = btn.querySelector('span');
    const icon = btn.querySelector('i');
    btn.disabled = isLoading;
    if (spinner) spinner.style.display = isLoading ? 'inline-block' : 'none';
    if (span) span.style.opacity = isLoading ? '0.5' : '1';
    if (icon) icon.style.opacity = isLoading ? '0.5' : '1';
}

function togglePassword() {
    const input = document.getElementById('adminPassword');
    const toggleBtn = document.querySelector('.toggle-password i');
    if (input.type === 'password') {
        input.type = 'text';
        toggleBtn?.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        toggleBtn?.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

window.togglePassword = togglePassword;
window.showForgotPassword = showForgotPassword;
window.closeForgotModal = closeForgotModal;
window.sendResetEmail = sendResetEmail;

// ─────────────────────────────────────────────
// TOASTS
// ─────────────────────────────────────────────
function showError(message) { createToast(message, '#3a1620', '#ff8f97', 'fa-exclamation-circle'); }
function showSuccess(message) { createToast(message, '#0f2f22', '#6fe3a8', 'fa-check-circle'); }

function createToast(message, bgColor, textColor, icon) {
    document.querySelectorAll('.custom-toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px;
        background: ${bgColor}; color: ${textColor};
        padding: 14px 20px; border-radius: 10px; z-index: 10000;
        display: flex; align-items: center; gap: 12px;
        font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        border-left: 4px solid ${textColor};
        animation: slideInRight 0.3s ease forwards;
        max-width: 350px;
    `;
    toast.innerHTML = `<i class="fas ${icon}" style="font-size: 16px;"></i> <span>${message}</span>`;
    document.body.appendChild(toast);

    if (!document.querySelector('#toastAnimations')) {
        const style = document.createElement('style');
        style.id = 'toastAnimations';
        style.textContent = `
            @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
