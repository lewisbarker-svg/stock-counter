import type { NextApiRequest, NextApiResponse } from 'next';

const SHOP = process.env.SHOP || 'panel-company.myshopify.com';
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { locationId } = req.query;

  if (!locationId || typeof locationId !== 'string') {
    return res.status(400).json({ error: 'Location ID is required' });
  }

  if (!ACCESS_TOKEN) {
    return res.status(500).json({ error: 'Access token not configured' });
  }

  try {
    // Step 1: Get all products with variants
    const productsQuery = `
      {
        products(first: 250) {
          edges {
            node {
              id
              title
              featuredImage {
                url
              }
              variants(first: 100) {
                edges {
                  node {
                    id
                    sku
                    title
                    inventoryItem {
                      id
                      inventoryLevel(locationId: "gid://shopify/Location/${locationId}") {
                        id
                        available
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(`https://${SHOP}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': ACCESS_TOKEN,
      },
      body: JSON.stringify({ query: productsQuery }),
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      throw new Error(data.errors[0]?.message || 'GraphQL error');
    }

    // Step 2: Format the data - only include variants stocked at this location
    const products: any[] = [];

    for (const productEdge of data.data.products.edges) {
      const product = productEdge.node;
      
      for (const variantEdge of product.variants.edges) {
        const variant = variantEdge.node;
        const inventoryLevel = variant.inventoryItem?.inventoryLevel;
        
        // Only include if there's an inventory level at this location
        if (inventoryLevel) {
          products.push({
            id: variant.id,
            productId: product.id,
            productTitle: product.title,
            variantTitle: variant.title !== 'Default Title' ? variant.title : null,
            sku: variant.sku || 'No SKU',
            image: product.featuredImage?.url || null,
            inventoryItemId: variant.inventoryItem.id,
            inventoryLevelId: inventoryLevel.id,
            currentStock: inventoryLevel.available || 0,
          });
        }
      }
    }

    // Sort by SKU
    products.sort((a, b) => a.sku.localeCompare(b.sku));

    return res.status(200).json({ products });
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch products' 
    });
  }
}
