-- Phase 1 tables (chatbot)
CREATE TABLE IF NOT EXISTS leads (
    id                TEXT PRIMARY KEY,
    email             TEXT UNIQUE NOT NULL,
    name              TEXT NOT NULL,
    interested_track  TEXT,
    language_pref     TEXT,
    consent_type      TEXT NOT NULL,
    first_seen_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    country_code      TEXT,
    source            TEXT DEFAULT 'chatbot',
    contacted_at      DATETIME,
    notes             TEXT
);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_not_contacted ON leads(contacted_at);

CREATE TABLE IF NOT EXISTS questions_log (
    id             TEXT PRIMARY KEY,
    session_hash   TEXT NOT NULL,
    question_text  TEXT NOT NULL,
    kb_matched     INTEGER DEFAULT 0,
    language       TEXT,
    timestamp      DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_questions_timestamp ON questions_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_questions_unmatched ON questions_log(kb_matched);

-- Phase 3 hooks (schema-only, populated later)
CREATE TABLE IF NOT EXISTS applications (
    id              TEXT PRIMARY KEY,
    email           TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    passport_name   TEXT NOT NULL,
    date_of_birth   DATE NOT NULL,
    gender          TEXT,
    nationality     TEXT NOT NULL,
    contact_number  TEXT NOT NULL,
    track_selected  TEXT NOT NULL,
    education       TEXT,
    korean_level    INTEGER CHECK (korean_level BETWEEN 1 AND 5),
    audition_url    TEXT,
    self_intro      TEXT,
    consent_payment INTEGER NOT NULL,
    consent_refund  INTEGER NOT NULL,
    consent_tuition INTEGER NOT NULL,
    submitted_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_applications_email ON applications(email);

CREATE TABLE IF NOT EXISTS payments (
    id              TEXT PRIMARY KEY,
    application_id  TEXT NOT NULL,
    stripe_session  TEXT UNIQUE,
    amount_krw      INTEGER NOT NULL,
    status          TEXT NOT NULL,
    paid_at         DATETIME,
    refund_at       DATETIME,
    refund_reason   TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_application ON payments(application_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe ON payments(stripe_session);
