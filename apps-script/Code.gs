/**
 * K-Culture Elite — Apps Script v3
 *
 * Routes
 *   POST /exec                  → handleApplicationSubmit (form wizard rows)
 *   POST /exec?action=update    → handlePaymentUpdate (Stripe webhook proxy from kc-checkout Worker)
 *
 * Properties (Project Settings → Script properties)
 *   ADMIN_EMAIL          — admin notification recipient (default: global@badaglobal-bli.com)
 *   APPS_SCRIPT_TOKEN    — shared secret with kc-checkout Worker (must match)
 *
 * Sheet
 *   Form base columns A..P are unchanged from v2.
 *   Payment columns Q..V are auto-added on first run; do not move them.
 */

const SHEET_NAME = 'Sheet1';
const ADMIN_EMAIL_FALLBACK = 'global@badaglobal-bli.com';

const FORM_HEADERS = [
  'Submitted At', 'Full Name', 'Date of Birth', 'Gender', 'Nationality',
  'Contact Number', 'Email', 'Educational Background', 'Korean Proficiency',
  'Interest Tracks', 'Audition Video Link', 'Self-Introduction',
  'Fee Acknowledged', 'Refund Policy', 'Tuition & Scholarship', 'Source',
];

const PAYMENT_HEADERS = [
  'Application ID', 'Payment Status', 'Stripe Session ID',
  'Amount Paid', 'Currency', 'Paid At',
];

const COL = {
  SUBMITTED_AT: 1, FULL_NAME: 2, DOB: 3, GENDER: 4, NATIONALITY: 5,
  CONTACT: 6, EMAIL: 7, EDUCATION: 8, KOREAN: 9, INTERESTS: 10,
  AUDITION: 11, SELF_INTRO: 12, FEE_ACK: 13, REFUND: 14, TUITION: 15, SOURCE: 16,
  APPLICATION_ID: 17, PAYMENT_STATUS: 18, SESSION_ID: 19,
  AMOUNT: 20, CURRENCY: 21, PAID_AT: 22,
};

// ---------- Entry point ----------

function doPost(e) {
  try {
    const action = e && e.parameter && e.parameter.action;
    if (action === 'update') return handlePaymentUpdate(e);
    return handleApplicationSubmit(e);
  } catch (err) {
    return jsonResponse(500, { error: 'internal error', details: String(err) });
  }
}

function doGet() {
  return jsonResponse(200, { service: 'kc-form-handler', version: 'v3' });
}

// ---------- Application submission (v2 behavior, preserved) ----------

function handleApplicationSubmit(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse(400, { error: 'invalid json' });
  }

  const sheet = getSheet();
  ensureHeaders(sheet);

  const applicationId = payload.applicationId || generateUuid();
  const paymentStatus = payload.paymentStatus || 'pending';

  const row = [
    new Date().toISOString(),
    s(payload.fullName), s(payload.dateOfBirth), s(payload.gender), s(payload.nationality),
    s(payload.contactNumber), s(payload.email), s(payload.education), s(payload.koreanProficiency),
    Array.isArray(payload.interestTracks) ? payload.interestTracks.join(', ') : s(payload.interestTracks),
    s(payload.auditionVideoUrl), s(payload.selfIntroduction),
    payload.feeAcknowledged ? 'Yes' : 'No',
    payload.refundPolicyAgreed ? 'Yes' : 'No',
    payload.tuitionScholarshipAgreed ? 'Yes' : 'No',
    s(payload.source) || 'kcultureelite.com',
    applicationId, paymentStatus, '', '', '', '',
  ].map(escapeFormula);

  sheet.appendRow(row);

  try {
    sendApplicantEmail(payload, applicationId);
    sendAdminEmail(payload, applicationId);
  } catch (err) {
    Logger.log('email send failed: ' + err);
  }

  return jsonResponse(200, { success: true, applicationId, paymentStatus });
}

// ---------- Payment webhook proxy (new in v3) ----------

function handlePaymentUpdate(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse(400, { error: 'invalid json' });
  }

  const expected = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_TOKEN');
  if (!expected) {
    return jsonResponse(500, { error: 'server misconfigured', details: 'APPS_SCRIPT_TOKEN not set' });
  }
  if (payload.token !== expected) {
    return jsonResponse(401, { error: 'unauthorized' });
  }

  if (!payload.applicationId) {
    return jsonResponse(400, { error: 'missing applicationId' });
  }

  const sheet = getSheet();
  ensureHeaders(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse(404, { error: 'no rows in sheet' });
  }

  const idColumn = sheet.getRange(2, COL.APPLICATION_ID, lastRow - 1, 1).getValues();
  let targetRow = -1;
  for (let i = 0; i < idColumn.length; i++) {
    if (String(idColumn[i][0]) === String(payload.applicationId)) {
      targetRow = i + 2;
      break;
    }
  }
  if (targetRow === -1) {
    return jsonResponse(404, { error: 'applicationId not found', applicationId: payload.applicationId });
  }

  const updates = [
    [COL.PAYMENT_STATUS, payload.paymentStatus || 'paid'],
    [COL.SESSION_ID, payload.sessionId || ''],
    [COL.AMOUNT, typeof payload.amountTotal === 'number' ? payload.amountTotal : ''],
    [COL.CURRENCY, payload.currency || ''],
    [COL.PAID_AT, payload.paidAt || new Date().toISOString()],
  ];
  for (const [col, value] of updates) {
    sheet.getRange(targetRow, col).setValue(escapeFormula(value));
  }

  return jsonResponse(200, { success: true, applicationId: payload.applicationId, row: targetRow });
}

// ---------- Helpers ----------

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  if (!sheet) throw new Error('no sheet found');
  return sheet;
}

function ensureHeaders(sheet) {
  const expected = FORM_HEADERS.concat(PAYMENT_HEADERS);
  const lastCol = sheet.getLastColumn();
  let needWrite = lastCol < expected.length;
  if (!needWrite) {
    const current = sheet.getRange(1, 1, 1, expected.length).getValues()[0];
    for (let i = 0; i < expected.length; i++) {
      if (String(current[i] || '').trim() !== expected[i]) {
        needWrite = true;
        break;
      }
    }
  }
  if (needWrite) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
  }
  // Style is applied unconditionally (idempotent) so headers stay consistent
  // even if text was added manually before v3 deploy.
  sheet.getRange(1, 1, 1, expected.length)
    .setFontWeight('bold')
    .setBackground('#A855F7')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center')
    .setWrap(true);
}

function escapeFormula(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (text.length === 0) return text;
  const first = text.charAt(0);
  if (first === '=' || first === '+' || first === '-' || first === '@') {
    return "'" + text;
  }
  return text;
}

function s(value) {
  return value === undefined || value === null ? '' : String(value);
}

function generateUuid() {
  // RFC4122 v4 (sufficient for application IDs; not cryptographic)
  return Utilities.getUuid();
}

function jsonResponse(status, body) {
  return ContentService
    .createTextOutput(JSON.stringify(Object.assign({ status }, body)))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAdminEmail() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL') || ADMIN_EMAIL_FALLBACK;
}

// ---------- Emails (preserved from v2) ----------

function sendApplicantEmail(p, applicationId) {
  if (!p.email) return;
  const subject = 'K-Culture Elite Program — Application Received';
  const body = [
    'Dear ' + (p.fullName || 'Applicant') + ',',
    '',
    'Thank you for applying to the K-Culture Elite Program.',
    'We have received your application (ID: ' + applicationId + ').',
    '',
    'Next step: complete the application fee payment of KRW 30,000 to finalize your submission.',
    'You will receive a separate email with payment instructions, or you can complete payment from the application page.',
    '',
    'For questions, contact us at ' + getAdminEmail() + '.',
    '',
    '— K-Culture Elite Admissions',
    'https://kcultureelite.com',
  ].join('\n');
  MailApp.sendEmail({ to: p.email, subject: subject, body: body });
}

function sendAdminEmail(p, applicationId) {
  const admin = getAdminEmail();
  const subject = '[K-Culture Elite] New Application — ' + (p.fullName || '(no name)');
  const lines = [
    'New application received.',
    '',
    'Application ID: ' + applicationId,
    'Name: ' + s(p.fullName),
    'Email: ' + s(p.email),
    'Contact: ' + s(p.contactNumber),
    'Nationality: ' + s(p.nationality),
    'Education: ' + s(p.education),
    'Korean Proficiency: ' + s(p.koreanProficiency),
    'Interest Tracks: ' + (Array.isArray(p.interestTracks) ? p.interestTracks.join(', ') : s(p.interestTracks)),
    'Audition Video: ' + s(p.auditionVideoUrl),
    'Self-Intro: ' + s(p.selfIntroduction),
    '',
    'Open the sheet to review: https://docs.google.com/spreadsheets/d/13gRfL_MNDnxLJBh_zIs2h9POQmNv5Jz7WyNOumLAGi4/edit',
  ];
  MailApp.sendEmail({ to: admin, subject: subject, body: lines.join('\n') });
}
