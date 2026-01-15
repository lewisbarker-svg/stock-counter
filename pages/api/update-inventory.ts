import type { NextApiRequest, NextApiResponse } from 'next';

const DEFAULT_SHOP = process.env.SHOP || 'panel-company.myshopify.com';

// Helper to get token from cookies
function getAuthFromCookies(req: NextApiRequest) {
  const cookies = req.headers.cookie || '';
  const tokenCookie = cookies.split(';').find(c => c.trim().startsWith('shopify_access_token='));
  const shopCookie = cookies.split(';').find(c => c.trim().startsWith('shopify_shop='));
  
  return {
    accessToken: tokenCookie?.split('=')[1] || process.env.SHOPIFY_ACCESS_TOKEN,
    shop: shopCookie?.split('=')[1] || DEFAULT_SHOP,
  };
}

interface InventoryUpdate {
  inventoryItemId: string;
  locationId: string;
  quantity: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accessToken, shop } = getAuthFromCookies(req);

  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated', needsAuth: true });
  }

  const SHOP = shop;
  const ACCESS_TOKEN = accessToken;

  const { updates } = req.body as { updates: InventoryUpdate[] };

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  try {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process updates one at a time to avoid rate limits
    for (const update of updates) {
      const mutation = `
        mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
          inventorySetQuantities(input: $input) {
            inventoryAdjustmentGroup {
              createdAt
              reason
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        input: {
          name: "available",
          reason: "correction",
          quantities: [
            {
              inventoryItemId: update.inventoryItemId,
              locationId: `gid://shopify/Location/${update.locationId}`,
              quantity: update.quantity,
            }
          ]
        }
      };

      const response = await fetch(`https://${SHOP}/admin/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': ACCESS_TOKEN,
        },
        body: JSON.stringify({ query: mutation, variables }),
      });

      if (!response.ok) {
        results.failed++;
        results.errors.push(`API error for ${update.inventoryItemId}: ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (data.errors || data.data?.inventorySetQuantities?.userErrors?.length > 0) {
        results.failed++;
        const errorMsg = data.errors?.[0]?.message || 
                         data.data?.inventorySetQuantities?.userErrors?.[0]?.message ||
                         'Unknown error';
        results.errors.push(`Failed ${update.inventoryItemId}: ${errorMsg}`);
      } else {
        results.success++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error('Error updating inventory:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to update inventory' 
    });
  }
}
