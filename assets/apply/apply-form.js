/* ============================================================
   K-Culture Elite — Application Form Logic
   - 4-step wizard with client-side validation
   - Honeypot anti-spam
   - Submit: records application (status=pending) + redirects to Stripe Checkout
   ============================================================ */
(function () {
  'use strict';

  const TOTAL_STEPS = 4;
  const STEP_LABELS = [
    'Personal Information',
    'Background & Interest',
    'Audition Submission',
    'Payment & Refund Policy'
  ];

  // Google Apps Script Web App endpoint (deployed 2026-04-23, v1)
  // Handler project: Kcultureelite Form Handler (global@badaglobal-bli.com)
  // Linked Sheet: Kcultureelite Form (Sheet1) — appends a row + sends applicant+admin emails
  const SUBMIT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyADn1u0ctWqRhooiY4lUX8Q_R7mYl976CvTmavoknqOkrTnqzRvVDfV9bjw9QwYtgB/exec';

  // Cloudflare Worker endpoint that creates a Stripe Checkout Session and
  // returns { url } to redirect the applicant to Stripe-hosted checkout.
  // Empty string = not configured yet (Stripe account pending). In that state the
  // form falls back to the legacy "application submitted" success screen so the
  // site keeps working while Stripe is being set up.
  const CHECKOUT_ENDPOINT = '';

  let currentStep = 1;
  let isSubmitting = false;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function openForm() {
    const overlay = $('#kc-apply-overlay');
    if (!overlay) return;
    currentStep = 1;
    overlay.classList.add('kc-apply-open');
    document.body.classList.add('kc-apply-lock');
    renderStep();
    updateProgress();
    // Focus first input
    setTimeout(() => {
      const first = $('#kc-apply-step-1 input:not([type="hidden"]), #kc-apply-step-1 select');
      if (first) first.focus();
    }, 150);
  }

  function closeForm(force) {
    const overlay = $('#kc-apply-overlay');
    if (!overlay) return;

    // If success screen is showing, always allow close
    const successActive = $('#kc-apply-success')?.classList.contains('kc-apply-success-active');

    if (!force && !successActive && hasUserInput()) {
      const ok = confirm('Are you sure you want to close? Your application will not be saved.');
      if (!ok) return;
    }
    overlay.classList.remove('kc-apply-open');
    document.body.classList.remove('kc-apply-lock');
    // Reset state
    setTimeout(() => {
      resetForm();
    }, 200);
  }

  function hasUserInput() {
    const inputs = $$('#kc-apply-form input, #kc-apply-form textarea, #kc-apply-form select');
    return inputs.some((el) => {
      if (el.type === 'checkbox' || el.type === 'radio') return el.checked;
      return el.value && el.value.trim().length > 0;
    });
  }

  function resetForm() {
    const form = $('#kc-apply-form');
    if (form) form.reset();
    currentStep = 1;
    $$('.kc-apply-field').forEach((f) => f.classList.remove('kc-apply-field-error'));
    $$('.kc-apply-input, .kc-apply-textarea, .kc-apply-select').forEach((el) =>
      el.classList.remove('kc-apply-invalid')
    );
    $('#kc-apply-success')?.classList.remove('kc-apply-success-active');
    $$('.kc-apply-step').forEach((step) => step.classList.remove('kc-apply-step-active'));
    $('#kc-apply-step-1')?.classList.add('kc-apply-step-active');
    $('#kc-apply-form').style.display = '';
    $('#kc-apply-footer').style.display = '';
    updateProgress();
  }

  function renderStep() {
    $$('.kc-apply-step').forEach((step) => step.classList.remove('kc-apply-step-active'));
    const active = $(`#kc-apply-step-${currentStep}`);
    if (active) active.classList.add('kc-apply-step-active');

    // Toggle button visibility
    const prevBtn = $('#kc-apply-prev');
    const nextBtn = $('#kc-apply-next');
    const submitBtn = $('#kc-apply-submit');

    if (prevBtn) prevBtn.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
    if (currentStep === TOTAL_STEPS) {
      if (nextBtn) nextBtn.style.display = 'none';
      if (submitBtn) submitBtn.style.display = 'inline-flex';
    } else {
      if (nextBtn) nextBtn.style.display = 'inline-flex';
      if (submitBtn) submitBtn.style.display = 'none';
    }
  }

  function updateProgress() {
    const fill = $('#kc-apply-progress-fill');
    const label = $('#kc-apply-step-label');
    const pct = (currentStep / TOTAL_STEPS) * 100;
    if (fill) fill.style.width = pct + '%';
    if (label) label.textContent = `Step ${currentStep} of ${TOTAL_STEPS} — ${STEP_LABELS[currentStep - 1]}`;
  }

  function validateStep(step) {
    const stepEl = $(`#kc-apply-step-${step}`);
    if (!stepEl) return true;

    let valid = true;
    const fields = $$('[data-required="true"]', stepEl);

    fields.forEach((field) => {
      const wrapper = field.closest('.kc-apply-field');
      if (wrapper) wrapper.classList.remove('kc-apply-field-error');
      field.classList?.remove('kc-apply-invalid');

      // Checkbox groups (e.g., interestTracks)
      if (field.dataset.group === 'checkbox') {
        const name = field.dataset.name;
        const checked = $$(`input[name="${name}"]:checked`, stepEl).length > 0;
        if (!checked) {
          if (wrapper) wrapper.classList.add('kc-apply-field-error');
          valid = false;
        }
        return;
      }

      // Radio groups (e.g., gender)
      if (field.dataset.group === 'radio') {
        const name = field.dataset.name;
        const checked = $$(`input[name="${name}"]:checked`, stepEl).length === 1;
        if (!checked) {
          if (wrapper) wrapper.classList.add('kc-apply-field-error');
          valid = false;
        }
        return;
      }

      // Single checkbox (agreement)
      if (field.type === 'checkbox') {
        if (!field.checked) {
          if (wrapper) wrapper.classList.add('kc-apply-field-error');
          valid = false;
        }
        return;
      }

      // Text-type validation
      const val = (field.value || '').trim();
      if (!val) {
        field.classList.add('kc-apply-invalid');
        if (wrapper) wrapper.classList.add('kc-apply-field-error');
        valid = false;
        return;
      }

      // Email
      if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        field.classList.add('kc-apply-invalid');
        if (wrapper) wrapper.classList.add('kc-apply-field-error');
        valid = false;
        return;
      }

      // URL (audition video)
      if (field.type === 'url' && !/^https?:\/\/.+/i.test(val)) {
        field.classList.add('kc-apply-invalid');
        if (wrapper) wrapper.classList.add('kc-apply-field-error');
        valid = false;
        return;
      }

      // Textarea min length
      if (field.tagName === 'TEXTAREA' && field.dataset.min) {
        const min = parseInt(field.dataset.min, 10);
        if (val.length < min) {
          field.classList.add('kc-apply-invalid');
          if (wrapper) wrapper.classList.add('kc-apply-field-error');
          valid = false;
          return;
        }
      }
    });

    return valid;
  }

  function nextStep() {
    if (!validateStep(currentStep)) {
      // Scroll to first invalid
      const firstInvalid = $(`#kc-apply-step-${currentStep} .kc-apply-field-error`);
      if (firstInvalid) firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (currentStep < TOTAL_STEPS) {
      currentStep += 1;
      renderStep();
      updateProgress();
      $('.kc-apply-body')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      currentStep -= 1;
      renderStep();
      updateProgress();
      $('.kc-apply-body')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function collectFormData() {
    const form = $('#kc-apply-form');
    if (!form) return null;

    // Honeypot — if bot filled it, silently fail
    const honey = $('input[name="kc-apply-hp"]', form);
    if (honey && honey.value) return null;

    const fd = new FormData(form);
    const data = {};

    // Single-value fields
    const simple = [
      'fullName', 'dob', 'nationality', 'contactNumber',
      'email', 'educationalBackground', 'koreanProficiency',
      'auditionVideoLink', 'selfIntroduction'
    ];
    simple.forEach((k) => {
      data[k] = (fd.get(k) || '').toString().trim();
    });

    data.gender = (fd.get('gender') || '').toString();
    data.interestTracks = fd.getAll('interestTracks');
    data.feeAcknowledgement = fd.get('feeAcknowledgement') ? 'Yes' : 'No';
    data.refundPolicyConfirmation = fd.get('refundPolicyConfirmation') ? 'Yes' : 'No';
    data.tuitionScholarshipReview = fd.get('tuitionScholarshipReview') ? 'Yes' : 'No';

    data.submittedAt = new Date().toISOString();
    data.source = 'kcultureelite.com';
    data.applicationId = generateApplicationId();
    data.paymentStatus = 'pending';

    return data;
  }

  function generateApplicationId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    const rand = Math.random().toString(36).slice(2, 10);
    return `kc-${Date.now().toString(36)}-${rand}`;
  }

  async function submitForm() {
    if (isSubmitting) return;
    if (!validateStep(TOTAL_STEPS)) return;

    isSubmitting = true;
    const submitBtn = $('#kc-apply-submit');
    const originalLabel = submitBtn?.innerHTML;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = CHECKOUT_ENDPOINT ? 'Preparing payment...' : 'Submitting...';
    }

    const data = collectFormData();
    if (!data) {
      // Honeypot triggered — silently pretend success to not alert bot
      showSuccess();
      return;
    }

    try {
      if (SUBMIT_ENDPOINT) {
        await fetch(SUBMIT_ENDPOINT, {
          method: 'POST',
          mode: 'no-cors', // Apps Script Web App requires this pattern
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        console.info('[kc-apply] SUBMIT_ENDPOINT not configured. Preview:', data);
      }

      if (CHECKOUT_ENDPOINT) {
        const res = await fetch(CHECKOUT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applicationId: data.applicationId,
            email: data.email,
            fullName: data.fullName
          })
        });
        if (!res.ok) throw new Error('Checkout session failed: ' + res.status);
        const json = await res.json();
        if (!json.url) throw new Error('No checkout URL returned');
        window.location.href = json.url;
        return;
      }

      // Stripe endpoint not yet configured — show the legacy confirmation screen
      showSuccess();
    } catch (err) {
      console.error('[kc-apply] submit error:', err);
      alert('Something went wrong submitting your application. Please try again or email global@badaglobal-bli.com');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalLabel || 'Submit Application';
      }
      isSubmitting = false;
    }
  }

  function showSuccess() {
    $('#kc-apply-form').style.display = 'none';
    $('#kc-apply-footer').style.display = 'none';
    $('#kc-apply-success')?.classList.add('kc-apply-success-active');
    isSubmitting = false;
  }

  function bindEvents() {
    const overlay = $('#kc-apply-overlay');
    if (!overlay) return;

    // Backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeForm();
    });

    // Close button
    $('#kc-apply-close')?.addEventListener('click', () => closeForm());

    // ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('kc-apply-open')) {
        closeForm();
      }
    });

    // Nav buttons
    $('#kc-apply-next')?.addEventListener('click', nextStep);
    $('#kc-apply-prev')?.addEventListener('click', prevStep);
    $('#kc-apply-submit')?.addEventListener('click', submitForm);

    // Reset invalid flag on input
    $$('.kc-apply-input, .kc-apply-textarea, .kc-apply-select').forEach((el) => {
      el.addEventListener('input', () => {
        el.classList.remove('kc-apply-invalid');
        el.closest('.kc-apply-field')?.classList.remove('kc-apply-field-error');
      });
    });

    // Reset checkbox/radio group error on change
    $$('#kc-apply-form input[type="checkbox"], #kc-apply-form input[type="radio"]').forEach((el) => {
      el.addEventListener('change', () => {
        el.closest('.kc-apply-field')?.classList.remove('kc-apply-field-error');
      });
    });

    // Submit via Enter in text inputs → go to next step instead
    $('#kc-apply-form')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (currentStep < TOTAL_STEPS) {
          nextStep();
        } else {
          submitForm();
        }
      }
    });
  }

  // Expose opener globally
  window.openApplyForm = openForm;

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }
})();
