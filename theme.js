// ═══════════════════════════════════════
//  TEMA — claro/escuro (carregar no <head>, antes do body)
// ═══════════════════════════════════════
(function () {
  var t = 'dark';
  try { t = localStorage.getItem('metrik_theme') || 'dark'; } catch (e) { }
  document.documentElement.dataset.theme = t;
})();

// lê uma variável CSS do tema ativo (usado pelos gráficos)
function themeC(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function currentTheme() {
  return document.documentElement.dataset.theme || 'dark';
}

function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('metrik_theme', t); } catch (e) { }
  _updateThemeBtn();
  window.dispatchEvent(new CustomEvent('themechange', { detail: t }));
}

function toggleTheme() {
  setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}

function _updateThemeBtn() {
  var btn = document.getElementById('themeToggleBtn');
  if (!btn) return;
  var dark = currentTheme() === 'dark';
  btn.textContent = dark ? '☀️' : '🌙';
  btn.title = dark ? 'Mudar para tema claro' : 'Mudar para tema escuro';
}

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('themeToggleBtn')) return;
  var btn = document.createElement('button');
  btn.id = 'themeToggleBtn';
  btn.type = 'button';
  btn.onclick = toggleTheme;
  document.body.appendChild(btn);
  _updateThemeBtn();
});
