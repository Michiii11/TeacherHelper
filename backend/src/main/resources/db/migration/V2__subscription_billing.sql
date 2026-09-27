-- TeacherHelper subscription/billing migration
-- Use as: src/main/resources/db/migration/V2__subscription_billing.sql
-- V2 is intentional because baseline-on-migrate=true is enabled.

-- Stripe references / scalable School plan
ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS subscription_seats INTEGER;

-- Add nullable first so this also works with existing users
ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(30);

ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS subscription_source VARCHAR(30);

ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS subscription_period_start TIMESTAMP;

ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMP;

ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN;

-- Backfill existing users
UPDATE app_user
SET subscription_status = 'ACTIVE'
WHERE subscription_status IS NULL;

UPDATE app_user
SET subscription_source = 'FREE'
WHERE subscription_source IS NULL;

UPDATE app_user
SET cancel_at_period_end = FALSE
WHERE cancel_at_period_end IS NULL;

-- Defaults for future rows
ALTER TABLE app_user
    ALTER COLUMN subscription_status SET DEFAULT 'ACTIVE';

ALTER TABLE app_user
    ALTER COLUMN subscription_source SET DEFAULT 'FREE';

ALTER TABLE app_user
    ALTER COLUMN cancel_at_period_end SET DEFAULT FALSE;

-- Now it is safe to make them NOT NULL
ALTER TABLE app_user
    ALTER COLUMN subscription_status SET NOT NULL;

ALTER TABLE app_user
    ALTER COLUMN subscription_source SET NOT NULL;

ALTER TABLE app_user
    ALTER COLUMN cancel_at_period_end SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user_stripe_customer_id
    ON app_user (stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user_stripe_subscription_id
    ON app_user (stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;

-- Payment history
CREATE TABLE IF NOT EXISTS payment_record (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    stripe_invoice_id VARCHAR(255) UNIQUE,
    stripe_payment_intent_id VARCHAR(255),
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
    status VARCHAR(30) NOT NULL,
    invoice_url VARCHAR(1000),
    invoice_pdf_url VARCHAR(1000),
    paid_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_record_user_id
    ON payment_record(user_id);

CREATE INDEX IF NOT EXISTS idx_payment_record_paid_at
    ON payment_record(paid_at);
