# v27 Deploy Runbook

## Prerequisites
- Cam has created a Stripe account
- Cam has created 2 products/prices in Stripe Dashboard:
  - Monthly: $1.99/mo recurring
  - Yearly: $14.99/yr recurring
- Cam has the API keys ready

## Step 1: Get the Stripe IDs

- [ ] Stripe Dashboard → Products → click Monthly → copy `price_xxx`
- [ ] Same for Yearly → copy `price_xxx`
- [ ] Stripe Dashboard → Developers → API keys → copy `pk_live_xxx` and `sk_live_xxx`
- [ ] Stripe Dashboard → Developers → Webhooks → Add endpoint:
  - URL: `https://animals.ashbi.ca/api/stripe-webhook`
  - Events: `checkout.session.completed`, `customer.subscription.deleted`
  - Copy the signing secret (`whsec_xxx`)

## Step 2: Inject env vars via Coolify API

> Container name: `il6ddxzeoe4az11sbv5xqtz9-033816392146`
> Coolify URL: `http://coolify.ashbi.ca:8000` (or the actual Coolify URL from GitHub secrets `COOLIFY_URL`)

For each env var, run:
```bash
# STRIPE_PUBLIC_KEY
curl -s -X POST \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"STRIPE_PUBLIC_KEY","value":"pk_live_xxx"}' \
  "$COOLIFY_URL/api/v1/applications/il6ddxzeoe4az11sbv5xqtz9-033816392146/envs"

# STRIPE_SECRET_KEY
curl -s -X POST \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"STRIPE_SECRET_KEY","value":"sk_live_xxx"}' \
  "$COOLIFY_URL/api/v1/applications/il6ddxzeoe4az11sbv5xqtz9-033816392146/envs"

# STRIPE_WEBHOOK_SECRET
curl -s -X POST \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"STRIPE_WEBHOOK_SECRET","value":"whsec_xxx"}' \
  "$COOLIFY_URL/api/v1/applications/il6ddxzeoe4az11sbv5xqtz9-033816392146/envs"

# STRIPE_PRICE_MONTHLY
curl -s -X POST \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"STRIPE_PRICE_MONTHLY","value":"price_xxx"}' \
  "$COOLIFY_URL/api/v1/applications/il6ddxzeoe4az11sbv5xqtz9-033816392146/envs"

# STRIPE_PRICE_YEARLY
curl -s -X POST \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"STRIPE_PRICE_YEARLY","value":"price_xxx"}' \
  "$COOLIFY_URL/api/v1/applications/il6ddxzeoe4az11sbv5xqtz9-033816392146/envs"

# APP_URL
curl -s -X POST \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"APP_URL","value":"https://animals.ashbi.ca"}' \
  "$COOLIFY_URL/api/v1/applications/il6ddxzeoe4az11sbv5xqtz9-033816392146/envs"
```

## Step 3: SSH and edit on-host .env

```bash
ssh coolify

# Edit the .env file directly
sudo nano /data/coolify/applications/il6ddxzeoe4az11sbv5xqtz9-033816392146/.env

# Add these lines (replace placeholder values with real ones from Step 1):
# STRIPE_PUBLIC_KEY=pk_live_xxx
# STRIPE_SECRET_KEY=sk_live_xxx
# STRIPE_WEBHOOK_SECRET=whsec_xxx
# STRIPE_PRICE_MONTHLY=price_xxx
# STRIPE_PRICE_YEARLY=price_xxx
# APP_URL=https://animals.ashbi.ca
```

## Step 4: Force container restart

```bash
ssh coolify 'docker rm -f il6ddxzeoe4az11sbv5xqtz9-033816392146'
```

Then trigger a fresh deploy via Coolify:
```bash
curl -s -X POST \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "$COOLIFY_URL/api/v1/applications/il6ddxzeoe4az11sbv5xqtz9-033816392146/start"
```

## Step 5: Verify

Wait ~90 seconds for the container to start, then:
```bash
# Health check
curl -s https://animals.ashbi.ca/api/health | jq .

# Test Stripe webhook endpoint responds (should return 400 or 500, not 404 — endpoint exists)
curl -s -o /dev/null -w "%{http_code}" https://animals.ashbi.ca/api/stripe-webhook

# Verify env vars are live in container
ssh coolify 'docker exec il6ddxzeoe4az11sbv5xqtz9-033816392146 printenv | grep STRIPE'
```

Expected: health returns `{"ok":true,...}`, stripe-webhook returns non-404, `printenv | grep STRIPE` shows all 6 vars.

## Rollback

If the deploy breaks the container:

```bash
# Option A: Stop the broken container
ssh coolify 'docker rm -f il6ddxzeoe4az11sbv5xqtz9-033816392146'

# Option B: Revert to previous git commit and redeploy
# From the fart-animal-sounds repo:
git revert HEAD~1 && git push origin main
# Then trigger deploy again:
curl -s -X POST \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "$COOLIFY_URL/api/v1/applications/il6ddxzeoe4az11sbv5xqtz9-033816392146/start"
```