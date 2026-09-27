#!/usr/bin/env bash
set -euo pipefail

if ! command -v stripe >/dev/null 2>&1; then
  echo "Stripe CLI not found."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found."
  exit 1
fi

read_env_value() {
  local key="$1"
  local file=".env"

  if [ ! -f "$file" ]; then
    return 1
  fi

  local line
  line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
  [ -n "$line" ] || return 1

  local value="${line#*=}"

  # trim surrounding whitespace
  value="$(printf '%s' "$value" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"

  # remove matching surrounding single/double quotes
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi

  printf '%s' "$value"
}

STRIPE_PRICE_PRO="${STRIPE_PRICE_PRO:-$(read_env_value STRIPE_PRICE_PRO || true)}"
STRIPE_PRICE_SCHOOL="${STRIPE_PRICE_SCHOOL:-$(read_env_value STRIPE_PRICE_SCHOOL || true)}"

: "${STRIPE_PRICE_PRO:?STRIPE_PRICE_PRO is missing in .env or shell}"
: "${STRIPE_PRICE_SCHOOL:?STRIPE_PRICE_SCHOOL is missing in .env or shell}"

echo "Resolving Stripe product IDs from your price IDs..."

PRO_JSON="$(stripe prices retrieve "$STRIPE_PRICE_PRO")"
SCHOOL_JSON="$(stripe prices retrieve "$STRIPE_PRICE_SCHOOL")"

PRO_PRODUCT="$(printf '%s' "$PRO_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["product"])')"
SCHOOL_PRODUCT="$(printf '%s' "$SCHOOL_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["product"])')"

echo "Creating dedicated TeacherHelper Customer Portal configuration..."

CONFIG_JSON="$(
  stripe post /v1/billing_portal/configurations \
    -d "name=TeacherHelper Plans" \
    -d "features[payment_method_update][enabled]=true" \
    -d "features[invoice_history][enabled]=true" \
    -d "features[subscription_cancel][enabled]=true" \
    -d "features[subscription_cancel][mode]=at_period_end" \
    -d "features[subscription_update][enabled]=true" \
    -d "features[subscription_update][default_allowed_updates][0]=price" \
    -d "features[subscription_update][default_allowed_updates][1]=quantity" \
    -d "features[subscription_update][products][0][product]=$PRO_PRODUCT" \
    -d "features[subscription_update][products][0][prices][0]=$STRIPE_PRICE_PRO" \
    -d "features[subscription_update][products][0][adjustable_quantity][enabled]=false" \
    -d "features[subscription_update][products][1][product]=$SCHOOL_PRODUCT" \
    -d "features[subscription_update][products][1][prices][0]=$STRIPE_PRICE_SCHOOL" \
    -d "features[subscription_update][products][1][adjustable_quantity][enabled]=true" \
    -d "features[subscription_update][products][1][adjustable_quantity][minimum]=20"
)"

CONFIG_ID="$(printf '%s' "$CONFIG_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"

echo
echo "Done."
echo "Add this to your .env:"
echo
echo "STRIPE_PORTAL_CONFIGURATION_ID=$CONFIG_ID"
echo
echo
echo "And add this Quarkus property if it is not there yet:"
echo 'stripe.portal-configuration-id=${STRIPE_PORTAL_CONFIGURATION_ID}'
