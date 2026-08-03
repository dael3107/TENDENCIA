// Simple scroll effect for navbar
window.addEventListener('scroll', () => {
    const nav = document.querySelector('nav');
    if (window.scrollY > 50) {
        nav.classList.add('h-16', 'bg-surface/95');
        nav.classList.remove('h-20', 'bg-surface/80');
    } else {
        nav.classList.add('h-20', 'bg-surface/80');
        nav.classList.remove('h-16', 'bg-surface/95');
    }
});

// Initialize Material Symbols font variation
document.querySelectorAll('.material-symbols-outlined').forEach(span => {
    if (span.getAttribute('data-weight') === 'fill') {
        span.style.fontVariationSettings = "'FILL' 1";
    }
});

// ── Navigation Menu Toggle ──
function toggleMenu() {
    const dropdown = document.getElementById('nav-dropdown');
    dropdown.classList.toggle('hidden');
}

function closeMenu() {
    document.getElementById('nav-dropdown').classList.add('hidden');
}

// ── Share Functionality ──
function toggleShareMenu() {
    document.getElementById('share-menu').classList.toggle('hidden');
}

function shareWhatsApp() {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent('Mira esta página de TENDENCIA REDIPLAST: ');
    window.open(`https://wa.me/?text=${text}${url}`, '_blank');
    document.getElementById('share-menu').classList.add('hidden');
}

function copyPageLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        alert('Enlace copiado al portapapeles');
    }).catch(err => {
        console.error('Error al copiar: ', err);
    });
    document.getElementById('share-menu').classList.add('hidden');
}

// Custom wrapper to update inner buttons if needed
document.addEventListener('DOMContentLoaded', () => {
    window.copyPageLink = function() {
        navigator.clipboard.writeText(window.location.href).then(() => {
            alert('¡Enlace de la página copiado!');
        });
        const shareMenu = document.getElementById('share-menu');
        if (shareMenu) shareMenu.classList.add('hidden');
    }
});

function nativeShare() {
    if (navigator.share) {
        navigator.share({
            title: 'TENDENCIA REDIPLAST',
            text: 'Mira esta página de TENDENCIA REDIPLAST',
            url: window.location.href
        });
    } else {
        window.copyPageLink();
    }
    document.getElementById('share-menu').classList.add('hidden');
}

// ── Close menus when clicking outside ──
document.addEventListener('click', (e) => {
    // Close nav dropdown
    const navDropdown = document.getElementById('nav-dropdown');
    const menuToggle = document.getElementById('menu-toggle');
    if (navDropdown && menuToggle && !navDropdown.contains(e.target) && !menuToggle.contains(e.target)) {
        navDropdown.classList.add('hidden');
    }

    // Close share menu
    const shareMenu = document.getElementById('share-menu');
    const shareBtn = document.getElementById('share-btn');
    if (shareMenu && shareBtn && !shareMenu.contains(e.target) && !shareBtn.contains(e.target)) {
        shareMenu.classList.add('hidden');
    }
});