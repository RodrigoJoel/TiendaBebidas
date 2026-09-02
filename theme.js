/**
 * Toggle de modo claro/oscuro - Reserva Global Importados
 * El tema aplicado al cargar la pagina se decide antes (ver script inline
 * en el <head> de cada pagina) para evitar el flash del tema por defecto.
 */
(function () {
  var KEY = 'gi_theme';

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function syncIcon() {
    var icon = document.getElementById('themeIcon');
    if (!icon) return;
    icon.textContent = currentTheme() === 'light' ? '🌙' : '☀️';
  }

  function toggleTheme() {
    var next = currentTheme() === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
    syncIcon();
  }

  window.toggleTheme = toggleTheme;
  document.addEventListener('DOMContentLoaded', syncIcon);
})();
