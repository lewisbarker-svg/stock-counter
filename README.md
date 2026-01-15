# Stock Counter - Panel Company

A Shopify inventory management app that allows staff to quickly update stock counts by location.

## Features

- **Location Selection** - Bristol, Rotherham, London, Gateshead
- **Product Images** - Visual product identification
- **Search** - Filter by SKU or product name
- **Bulk Updates** - Update multiple products and save all at once
- **Only Shows Stocked Items** - Each location only sees products stocked there
- **Mobile Friendly** - Works on tablets and phones

## Setup Guide

### Step 1: Get Your Shopify Access Token

1. Go to your Shopify Admin
2. Navigate to **Settings → Apps and sales channels → Develop apps**
3. Click **Create an app** (or use existing)
4. Name it "Stock Counter"
5. Under **Configuration → Admin API scopes**, enable:
   - `read_products`
   - `read_inventory`
   - `write_inventory`
   - `read_locations`
6. Click **Save**, then **Install app**
7. Copy the **Admin API access token** (you'll only see this once!)

### Step 2: Deploy to Vercel

#### Option A: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New → Project**
3. Import this repository (or upload the files)
4. Before deploying, add these **Environment Variables**:

| Variable | Value |
|----------|-------|
| `SHOPIFY_ACCESS_TOKEN` | Your access token from Step 1 |
| `SHOP` | `panel-company.myshopify.com` |
| `LOCATION_BRISTOL` | `62584946887` |
| `LOCATION_ROTHERHAM` | `62584914119` |
| `LOCATION_LONDON` | `71658701033` |
| `LOCATION_GATESHEAD` | `105047294330` |

5. Click **Deploy**

#### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to project folder
cd stock-counter

# Login to Vercel
vercel login

# Deploy
vercel

# Add environment variables when prompted, or add them later in dashboard
```

### Step 3: Set Up as Shopify App (Optional)

If you want to embed this inside Shopify admin:

1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Create or log into your Partners account
3. Go to **Apps → Create app**
4. Choose **Create app manually**
5. Fill in:
   - **App name:** Stock Counter
   - **App URL:** `https://your-vercel-url.vercel.app`
   - **Allowed redirection URLs:** `https://your-vercel-url.vercel.app/api/auth/callback`
6. Install the app on your store

### Step 4: Access the App

Once deployed, staff can access it at:
```
https://your-vercel-url.vercel.app
```

Bookmark this URL for easy access!

---

## Usage

1. **Select Location** - Choose your branch from the dropdown
2. **Search** (optional) - Type a SKU or product name to filter
3. **Enter New Counts** - Type the new stock value in the "New Count" field
4. **Save** - Click "Save Changes" to update Shopify

Changed items are highlighted in yellow. The save bar appears when you have pending changes.

---

## File Structure

```
stock-counter/
├── pages/
│   ├── api/
│   │   ├── products.ts      # Fetches products from Shopify
│   │   └── update-inventory.ts  # Updates inventory in Shopify
│   ├── _app.tsx
│   └── index.tsx            # Main UI
├── lib/
│   └── shopify.ts           # Shopify configuration
├── styles/
│   └── globals.css          # Styling
├── package.json
├── next.config.js
├── tsconfig.json
├── vercel.json
└── .env.example
```

---

## Adding POS Support

To use this from Shopify POS:

1. In your Shopify Partners dashboard, go to your app
2. Under **Extensions**, create a **POS UI extension**
3. The POS can auto-detect which location the device is assigned to
4. Staff tap the tile to open the stock counter

(Full POS extension code available on request)

---

## Troubleshooting

**Products not loading:**
- Check your access token is correct
- Verify API scopes are enabled
- Check Vercel environment variables

**Updates failing:**
- Ensure `write_inventory` scope is enabled
- Check Shopify's rate limits (2 requests/second)

**Wrong products showing:**
- Products only appear if they have inventory tracked at that location
- Check Shopify's inventory settings for those products

---

## Security Notes

- Never commit your `.env` file or access tokens to version control
- Regenerate your Shopify API secret if it was exposed
- Use Vercel's environment variables for all secrets

---

## Support

Built for Panel Company. For issues, contact your developer.
# Stock Counter
