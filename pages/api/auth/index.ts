import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

const SHOP = process.env.SHOP || 'panel-company.myshopify.com';
const API_KEY = process.env.SHOPIFY_API_KEY;
const SCOPES = 'read_products,read_inventory,write_inventory,read_locations';
const APP_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : process.env.SHOPIFY_APP_URL || 'https://stock-counter-rho.vercel.app';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const shop = (req.query.shop as string) || SHOP;
  
  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Generate a random nonce for security
  const nonce = crypto.randomBytes(16).toString('hex');
  
  // Store nonce in cookie for verification
  res.setHeader('Set-Cookie', `shopify_nonce=${nonce}; Path=/; HttpOnly; Secure; SameSite=Lax`);

  const redirectUri = `${APP_URL}/api/auth/callback`;
  
  const authUrl = `https://${shop}/admin/oauth/authorize?` +
    `client_id=${API_KEY}` +
    `&scope=${SCOPES}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${nonce}`;

  res.redirect(authUrl);
}
