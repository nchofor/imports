/* SwiftShip — frontend (connects to Node API when server is running) */

(function () {
  'use strict';

  const API = '/api';

  async function api(method, path, body, adminToken) {
    const headers = { 'Content-Type': 'application/json' };
    if (adminToken) headers['X-Admin-Token'] = adminToken;

    const res = await fetch(API + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function needsServerMessage() {
    return 'Start the server first: open a terminal in this folder and run "npm install" then "npm start". Then open http://localhost:3000';
  }

  /* Mobile navigation */
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open);
    });
    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  const revealEls = document.querySelectorAll('[data-reveal]');
  if (revealEls.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach((el) => observer.observe(el));
  }

  const heroTrackForm = document.getElementById('heroTrackForm');
  if (heroTrackForm) {
    heroTrackForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = heroTrackForm.querySelector('[name="trackingId"]').value.trim();
      if (id) window.location.href = `track.html?id=${encodeURIComponent(id)}`;
    });
  }

  const estimator = document.getElementById('quoteEstimator');
  if (estimator) {
    estimator.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(estimator);
      const result = document.getElementById('estimateResult');
      try {
        const data = await api('POST', '/estimate', {
          origin: fd.get('origin'),
          destination: fd.get('destination'),
          weight: fd.get('weight'),
          service: fd.get('service'),
        });
        result.hidden = false;
        result.innerHTML = `
          <p class="estimate-route">${escapeHtml(data.origin)} → ${escapeHtml(data.destination)}</p>
          <p class="estimate-price">From <strong>$${data.amount}</strong> ${escapeHtml(data.currency)}</p>
          <p class="estimate-note">Indicative rate · ${data.weight} kg · ${escapeHtml(data.service)}. <a href="booking.html">Request exact quote →</a></p>
        `;
      } catch (err) {
        showEstimateFallback(fd, result, err);
      }
    });
  }

  function showEstimateFallback(fd, result, err) {
    const weight = parseFloat(fd.get('weight')) || 0;
    const service = fd.get('service');
    const base = { standard: 45, express: 85, freight: 120 }[service] || 45;
    const perKg = { standard: 2.5, express: 5.2, freight: 3.8 }[service] || 2.5;
    const amount = Math.round(base + weight * perKg);
    result.hidden = false;
    result.innerHTML = `
      <p class="estimate-route">${escapeHtml(fd.get('origin') || '')} → ${escapeHtml(fd.get('destination') || '')}</p>
      <p class="estimate-price">From <strong>$${amount}</strong> USD (offline estimate)</p>
      <p class="estimate-note">${err.message === 'Failed to fetch' ? needsServerMessage() : escapeHtml(err.message)}</p>
    `;
  }

  const subscribeForm = document.getElementById('subscribeForm');
  if (subscribeForm) {
    subscribeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('subscribeMsg');
      const email = new FormData(subscribeForm).get('email') || subscribeForm.querySelector('input[type=email]').value;
      try {
        const data = await api('POST', '/subscribe', { email });
        msg.textContent = data.message;
        subscribeForm.reset();
      } catch (err) {
        msg.textContent = err.message === 'Failed to fetch' ? needsServerMessage() : err.message;
      }
    });
  }

  initQuoteForm();
  initContactForm();
  initTrackPage();

  function initQuoteForm() {
    const form = document.getElementById('quoteForm');
    const result = document.getElementById('quoteResult');
    if (!form || !result) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      result.className = 'form-result';
      result.textContent = 'Sending…';
      const fd = new FormData(form);
      try {
        const data = await api('POST', '/quotes', {
          name: fd.get('name'),
          email: fd.get('email'),
          phone: fd.get('phone'),
          company: fd.get('company'),
          pickup: fd.get('pickup'),
          delivery: fd.get('delivery'),
          service: fd.get('service'),
          weight: fd.get('weight'),
          package: fd.get('package'),
          date: fd.get('date'),
        });
        result.className = 'form-success';
        result.textContent = data.message + ` (Reference #${data.quoteId})`;
        form.reset();
      } catch (err) {
        result.className = 'form-error';
        result.textContent = err.message === 'Failed to fetch' ? needsServerMessage() : err.message;
      }
    });
  }

  function initContactForm() {
    const form = document.getElementById('contactForm');
    const result = document.getElementById('contactResult');
    if (!form || !result) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      result.className = 'form-result';
      result.textContent = 'Sending…';
      const fd = new FormData(form);
      try {
        const data = await api('POST', '/contact', {
          name: fd.get('name'),
          email: fd.get('email'),
          subject: fd.get('subject'),
          message: fd.get('message'),
        });
        result.className = 'form-success';
        result.textContent = data.message;
        form.reset();
      } catch (err) {
        result.className = 'form-error';
        result.textContent = err.message === 'Failed to fetch' ? needsServerMessage() : err.message;
      }
    });
  }

  function initTrackPage() {
    const form = document.getElementById('trackPageForm');
    const timeline = document.getElementById('trackingTimeline');
    if (!form || !timeline) return;

    const params = new URLSearchParams(window.location.search);
    const preset = params.get('id');
    if (preset) {
      form.querySelector('[name="trackingId"]').value = preset;
      loadTrack(preset, timeline);
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = form.querySelector('[name="trackingId"]').value.trim();
      if (!id) return;
      loadTrack(id, timeline);
      history.replaceState(null, '', `?id=${encodeURIComponent(id)}`);
    });
  }

  async function loadTrack(id, container) {
    container.hidden = false;
    container.innerHTML = '<p class="form-hint">Loading tracking data…</p>';

    try {
      const data = await api('GET', `/track/${encodeURIComponent(id)}`);
      renderTrack(data, container);
    } catch (err) {
      container.innerHTML = `<p class="form-error">${escapeHtml(
        err.message === 'Failed to fetch' ? needsServerMessage() : err.message
      )}</p>`;
    }
  }

  function renderTrack(data, container) {
    const activeIdx = data.events.findIndex((e) => e.isCurrent);
    container.innerHTML = `
      <div class="tracking-header">
        <span class="tracking-id-label">Tracking ID</span>
        <strong class="tracking-id">${escapeHtml(data.trackingId)}</strong>
        <span class="tracking-badge">${escapeHtml(data.statusLabel)}</span>
      </div>
      <p class="tracking-route">${escapeHtml(data.origin)} → ${escapeHtml(data.destination)}</p>
      <ol class="tracking-steps">
        ${data.events
          .map((s, i) => {
            const done = s.done;
            const active = i === activeIdx || (s.isCurrent && activeIdx === -1);
            return `
          <li class="tracking-step ${done ? 'is-done' : ''} ${active ? 'is-active' : ''}">
            <div class="step-marker"></div>
            <div class="step-body">
              <strong>${escapeHtml(s.status)}</strong>
              <span>${escapeHtml(s.location)}</span>
              <time>${escapeHtml(s.eventTime)}</time>
            </div>
          </li>`;
          })
          .join('')}
      </ol>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  window.SwiftShipAPI = { api };
})();
