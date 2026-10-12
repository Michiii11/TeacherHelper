-- Fix the legacy subscriptionValidUntil mapping.
-- The entity now explicitly maps to subscription_valid_until.

ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS subscription_valid_until TIMESTAMP;
