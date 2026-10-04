/* GURPS Guide — shared theme handling.
   Load in <head> (render-blocking) so the saved theme applies before first paint.
   Wires the #theme-toggle button and fires a "themechange" event for diagrams. */
(function () {
  var KEY = 'theme';
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  } catch (e) { /* storage blocked: follow the OS preference */ }

  function current() {
    var t = root.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function label() {
    var b = document.getElementById('theme-toggle');
    if (!b) return;
    var dark = current() === 'dark';
    b.textContent = dark ? '☀️' : '🌙';
    b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    b.setAttribute('aria-pressed', String(dark));
  }
  function toggle() {
    var next = current() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (e) { /* ignore */ }
    label();
    document.dispatchEvent(new CustomEvent('themechange', { detail: next }));
  }
  window.gurpsTheme = current;
  window.toggleTheme = toggle;
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (!root.getAttribute('data-theme')) { label(); document.dispatchEvent(new CustomEvent('themechange', { detail: current() })); }
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    label();
    var b = document.getElementById('theme-toggle');
    if (b) b.addEventListener('click', toggle);
  });
})();
