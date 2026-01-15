import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

const API_KEY = process.env.SHOPIFY_API_KEY;
const API_SECRET = process.env.SHOPIFY_API_SECRET;
const APP_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : process.env.SHOPIFY_APP_URL || 'https://stock-counter-rho.vercel.app';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { code, shop, state, hmac } = req.query;

  if (!code || !shop || !state) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  if (!API_KEY || !API_SECRET) {
    return res.status(500).json({ error: 'API credentials not configured' });
  }

  // Verify the nonce
  const cookies = req.headers.cookie || '';
  const nonceCookie = cookies.split(';').find(c => c.trim().startsWith('shopify_nonce='));
  const storedNonce = nonceCookie?.split('=')[1];

  if (state !== storedNonce) {
    return res.status(403).json({ error: 'Invalid state parameter' });
  }

  // Verify HMAC if provided
  if (hmac) {
    const queryParams = { ...req.query };
    delete queryParams.hmac;
    
    const message = Object.keys(queryParams)
      .sort()
      .map(key => `${key}=${queryParams[key]}`)
      .join('&');
    
    const generatedHmac = crypto
      .createHmac('sha256', API_SECRET)
      .update(message)
      .digest('hex');
    
    if (hmac !== generatedHmac) {
      return res.status(403).json({ error: 'Invalid HMAC' });
    }
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: API_KEY,
        client_secret: API_SECRET,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      return res.status(500).json({ error: 'Failed to get access token' });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Store the access token in a secure HTTP-only cookie
    res.setHeader('Set-Cookie', [
      `shopify_access_token=${accessToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`,
      `shopify_shop=${shop}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`,
      'shopify_nonce=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    ]);

    // Redirect to the app
    res.redirect('/');
  } catch (error) {
    console.error('OAuth error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}
