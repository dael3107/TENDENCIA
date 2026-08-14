// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCtkumMkft7P8K_1XebIBZmuE3wEvLb07Q",
    authDomain: "tendencia-2026.firebaseapp.com",
    projectId: "tendencia-2026",
    storageBucket: "tendencia-2026.firebasestorage.app",
    messagingSenderId: "243604418507",
    appId: "1:243604418507:web:fe53d4bef8bc2436cc904e",
    measurementId: "G-722625418Z"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Detectar si es la página pública (inicio)
const isPublicPage = window.location.pathname.endsWith('index.html')
    || window.location.pathname === '/'
    || window.location.pathname === '';

// ── Timeout de seguridad ──
// Si Firebase tarda más de 4 segundos en responder en una página privada,
// redirigir al inicio para evitar quedarse pegado en la pantalla de carga.
let authTimeoutId = null;
if (!isPublicPage) {
    authTimeoutId = setTimeout(() => {
        console.warn('Firebase timeout - redirigiendo al inicio');
        window.location.href = 'index.html';
    }, 4000);
}

// En la página pública: ocultar el botón hasta que Firebase responda
// para evitar el flash INGRESAR -> SALIR
if (isPublicPage) {
    document.addEventListener('DOMContentLoaded', () => {
        const navAuthBtn = document.getElementById('nav-auth-btn');
        if (navAuthBtn) {
            navAuthBtn.style.opacity = '0';
            navAuthBtn.style.transition = 'opacity 0.25s ease';
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const loginModal  = document.getElementById('login-modal');
    const btnClose    = document.getElementById('btn-close-login');
    const loginForm   = document.getElementById('login-form');
    const loginError  = document.getElementById('login-error');
    const loginBtn    = document.getElementById('btn-login-submit');

    // ── Abrir modal de login ──
    window.openLoginModal = () => {
        if (loginModal) {
            loginModal.classList.remove('hidden');
            loginModal.classList.add('flex');
        }
    };

    // ── Cerrar modal de login ──
    window.closeLoginModal = () => {
        if (loginModal) {
            loginModal.classList.add('hidden');
            loginModal.classList.remove('flex');
            if (loginError) loginError.classList.add('hidden');
        }
    };

    if (btnClose) btnClose.addEventListener('click', window.closeLoginModal);

    // ── Formulario de login ──
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email    = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            loginBtn.innerHTML = '<div class="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>';
            loginBtn.disabled  = true;
            if (loginError) loginError.classList.add('hidden');

            try {
                await auth.signInWithEmailAndPassword(email, password);
                // Cerrar el modal y quedarse en el inicio con el menú ya disponible
                window.closeLoginModal();
            } catch (error) {
                console.error("Error logging in:", error);
                if (loginError) loginError.classList.remove('hidden');
                loginBtn.innerHTML = 'INGRESAR';
                loginBtn.disabled  = false;

                if (error.code === 'auth/invalid-credential'
                    || error.code === 'auth/user-not-found'
                    || error.code === 'auth/wrong-password') {
                    loginError.textContent = 'Correo o contraseña incorrectos.';
                } else {
                    loginError.textContent = 'Error al iniciar sesión. Intenta de nuevo.';
                }
            }
        });
    }

    // ── Cerrar sesión ──
    window.logout = async () => {
        try {
            await auth.signOut();
            window.location.reload();
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    // ── Observador de estado de autenticación ──
    auth.onAuthStateChanged((user) => {
        // Cancelar el timeout de seguridad porque Firebase ya respondió
        if (authTimeoutId) clearTimeout(authTimeoutId);

        const navAuthBtn = document.getElementById('nav-auth-btn');
        const menuToggle = document.getElementById('menu-toggle');

        if (user) {
            // ── USUARIO LOGUEADO ──

            // Cambiar botón a SALIR
            if (navAuthBtn) {
                navAuthBtn.innerHTML = '<span class="material-symbols-outlined text-[16px]">logout</span> SALIR';
                navAuthBtn.className = 'font-label-caps text-label-caps text-red-400 px-6 py-2 border border-red-400/30 rounded-lg hover:bg-red-400/10 transition-all duration-300 flex items-center gap-2';
                navAuthBtn.id = 'nav-auth-btn';
                navAuthBtn.onclick = window.logout;
                navAuthBtn.style.opacity = '1';
            }

            // Mostrar menú hamburguesa
            if (menuToggle) {
                menuToggle.classList.remove('hidden');
                menuToggle.classList.add('flex');
            }

            // Ocultar overlay de verificación de auth en páginas privadas
            if (!isPublicPage) {
                const authOverlay = document.getElementById('auth-loading');
                if (authOverlay) {
                    authOverlay.style.opacity = '0';
                    authOverlay.style.transition = 'opacity 0.4s ease';
                    setTimeout(() => { authOverlay.style.display = 'none'; }, 400);
                }
            }

        } else {
            // ── USUARIO NO LOGUEADO ──

            if (!isPublicPage) {
                // Página privada sin sesión → redirigir al inicio
                window.location.href = 'index.html';
            } else {
                // Página pública → mostrar botón INGRESAR
                if (navAuthBtn) {
                    navAuthBtn.innerHTML = 'INGRESAR';
                    navAuthBtn.className = 'px-6 py-2 bg-secondary text-on-secondary font-label-caps text-label-caps rounded-lg hover:opacity-90 transition-opacity uppercase tracking-widest text-black';
                    navAuthBtn.id = 'nav-auth-btn';
                    navAuthBtn.onclick = window.openLoginModal;
                    navAuthBtn.style.opacity = '1';
                }

                // Ocultar menú hamburguesa
                if (menuToggle) {
                    menuToggle.classList.add('hidden');
                    menuToggle.classList.remove('flex');
                }
            }
        }
    });
});
