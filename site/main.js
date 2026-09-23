// OficiosOsIA landing: FAQ, formulario de demo y aviso de cookies.
(function () {
  'use strict';

  // FAQ: una sola respuesta abierta a la vez. Las respuestas cerradas siguen en el HTML para SEO.
  var faq = document.querySelector('[data-faq]');
  if (faq) {
    var buttons = faq.querySelectorAll('.faq__btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var wasOpen = btn.getAttribute('aria-expanded') === 'true';
        buttons.forEach(function (b) { setFaq(b, false); });
        if (!wasOpen) setFaq(btn, true);
      });
    });
  }
  function setFaq(btn, open) {
    btn.setAttribute('aria-expanded', String(open));
    btn.querySelector('.faq__sign').textContent = open ? '−' : '+';
    document.getElementById(btn.getAttribute('aria-controls')).hidden = !open;
  }

  // Formulario de demo
  var form = document.querySelector('[data-demo-form]');
  var sent = document.querySelector('[data-sent]');
  if (form && sent) {
    var error = form.querySelector('[data-form-error]');
    var submit = form.querySelector('[type="submit"]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      error.hidden = true;
      var name = (form.elements.nombre.value || '').trim().split(/\s+/)[0];
      var endpoint = form.getAttribute('data-endpoint');
      var done = function () {
        sent.querySelector('[data-sent-name]').textContent = name || 'gracias';
        form.hidden = true;
        sent.hidden = false;
        sent.focus();
      };
      if (!endpoint) { done(); return; }
      submit.disabled = true;
      fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error(r.status); done(); })
        .catch(function () { error.hidden = false; })
        .then(function () { submit.disabled = false; });
    });
    sent.querySelector('[data-reset]').addEventListener('click', function () {
      form.reset();
      sent.hidden = true;
      form.hidden = false;
      form.elements.nombre.focus();
    });
  }

  // Aviso de cookies (AEPD: rechazar tan visible como aceptar; elección revocable desde el pie).
  var KEY = 'oficiososia-cookies';
  var banner = document.querySelector('[data-cookie-banner]');
  if (!banner) return;
  var prefs = banner.querySelector('[data-cookie-prefs]');
  var prefsBtn = banner.querySelector('[data-cookie-prefs-btn]');
  var analytics = prefs.querySelector('[name="analytics"]');
  var marketing = prefs.querySelector('[name="marketing"]');

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function setPrefsOpen(open) {
    prefs.hidden = !open;
    prefsBtn.textContent = open ? 'Guardar selección' : 'Configurar';
  }
  function save(a, m) {
    var choice = { analytics: a, marketing: m, date: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(choice)); } catch (e) {}
    banner.hidden = true;
    setPrefsOpen(false);
    apply(choice);
  }
  // Punto de enganche para cargar analítica/marketing solo con consentimiento.
  function apply(choice) {
    document.dispatchEvent(new CustomEvent('oficiososia:consent', { detail: choice }));
  }

  var stored = read();
  if (stored) {
    analytics.checked = !!stored.analytics;
    marketing.checked = !!stored.marketing;
    apply(stored);
  } else {
    banner.hidden = false;
  }

  banner.querySelector('[data-cookie-reject]').addEventListener('click', function () { save(false, false); });
  banner.querySelector('[data-cookie-accept]').addEventListener('click', function () { save(true, true); });
  prefsBtn.addEventListener('click', function () {
    if (prefs.hidden) setPrefsOpen(true);
    else save(analytics.checked, marketing.checked);
  });
  document.querySelectorAll('[data-open-cookie-prefs]').forEach(function (el) {
    el.addEventListener('click', function () {
      banner.hidden = false;
      setPrefsOpen(true);
    });
  });
})();
