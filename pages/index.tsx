import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

interface Product {
  id: string;
  productTitle: string;
  variantTitle: string | null;
  sku: string;
  image: string | null;
  inventoryItemId: string;
  currentStock: number;
}

const LOCATIONS = {
  bristol: { id: '62584946887', name: 'Bristol' },
  rotherham: { id: '62584914119', name: 'Rotherham' },
  london: { id: '71658701033', name: 'London' },
  gateshead: { id: '105047294330', name: 'Gateshead' },
};

type LocationKey = keyof typeof LOCATIONS;

declare global {
  interface Window {
    shopify?: any;
  }
}

export default function Home() {
  const [selectedLocation, setSelectedLocation] = useState<LocationKey>('bristol');
  const [products, setProducts] = useState<Product[]>([]);
  const [stockValues, setStockValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [appReady, setAppReady] = useState(false);

  // Initialize Shopify App Bridge
  useEffect(() => {
    const checkShopify = () => {
      if (window.shopify) {
        setAppReady(true);
      } else {
        setTimeout(checkShopify, 100);
      }
    };
    checkShopify();
  }, []);

  // Fetch products using Shopify Admin API via App Bridge
  const fetchProducts = useCallback(async (locationId: string) => {
    if (!window.shopify) {
      console.error('Shopify App Bridge not ready');
      return;
    }

    setLoading(true);
    try {
      const query = `
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
                          quantities(names: ["available"]) {
                            quantity
                          }
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

      const response = await window.shopify.graphql(query);
      
      const productList: Product[] = [];
      
      for (const productEdge of response.products.edges) {
        const product = productEdge.node;
        
        for (const variantEdge of product.variants.edges) {
          const variant = variantEdge.node;
          const inventoryLevel = variant.inventoryItem?.inventoryLevel;
          
          if (inventoryLevel) {
            const available = inventoryLevel.quantities?.find((q: any) => q.name === 'available');
            productList.push({
              id: variant.id,
              productTitle: product.title,
              variantTitle: variant.title !== 'Default Title' ? variant.title : null,
              sku: variant.sku || 'No SKU',
              image: product.featuredImage?.url || null,
              inventoryItemId: variant.inventoryItem.id,
              currentStock: available?.quantity || 0,
            });
          }
        }
      }

      productList.sort((a, b) => a.sku.localeCompare(b.sku));
      setProducts(productList);
      
      const initialValues: Record<string, string> = {};
      productList.forEach((product) => {
        initialValues[product.id] = product.currentStock.toString();
      });
      setStockValues(initialValues);
      
    } catch (error) {
      console.error('Error fetching products:', error);
      showToast('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (appReady) {
      fetchProducts(LOCATIONS[selectedLocation].id);
    }
  }, [selectedLocation, appReady, fetchProducts]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleStockChange = (productId: string, value: string) => {
    if (value !== '' && !/^\d*$/.test(value)) return;
    setStockValues((prev) => ({ ...prev, [productId]: value }));
  };

  const changes = products.filter((product) => {
    const currentValue = stockValues[product.id];
    return currentValue !== undefined && 
           currentValue !== product.currentStock.toString() && 
           currentValue !== '';
  }).map((product) => ({
    inventoryItemId: product.inventoryItemId,
    sku: product.sku,
    oldValue: product.currentStock,
    newValue: parseInt(stockValues[product.id], 10),
  }));

  const handleSave = async () => {
    if (!window.shopify || changes.length === 0) return;
    
    setSaving(true);
    
    try {
      let success = 0;
      let failed = 0;

      for (const change of changes) {
        const mutation = `
          mutation {
            inventorySetQuantities(input: {
              name: "available",
              reason: "correction",
              quantities: [{
                inventoryItemId: "${change.inventoryItemId}",
                locationId: "gid://shopify/Location/${LOCATIONS[selectedLocation].id}",
                quantity: ${change.newValue}
              }]
            }) {
              userErrors {
                field
                message
              }
            }
          }
        `;

        try {
          const response = await window.shopify.graphql(mutation);
          if (response.inventorySetQuantities?.userErrors?.length > 0) {
            failed++;
          } else {
            success++;
          }
        } catch {
          failed++;
        }
      }

      if (failed > 0) {
        showToast(`Updated ${success}, failed ${failed}`, 'error');
      } else {
        showToast(`Successfully updated ${success} items`, 'success');
      }

      await fetchProducts(LOCATIONS[selectedLocation].id);
    } catch (error) {
      console.error('Save error:', error);
      showToast('Failed to save changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    const initialValues: Record<string, string> = {};
    products.forEach((product) => {
      initialValues[product.id] = product.currentStock.toString();
    });
    setStockValues(initialValues);
  };

  const filteredProducts = searchQuery.trim()
    ? products.filter((product) => {
        const query = searchQuery.toLowerCase();
        return product.sku.toLowerCase().includes(query) ||
               product.productTitle.toLowerCase().includes(query);
      })
    : products;

  return (
    <>
      <Head>
        <title>Stock Counter</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="app-container">
        <header className="header">
          <h1>Stock Counter</h1>
          <div className="location-selector">
            <label htmlFor="location">Location:</label>
            <select
              id="location"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value as LocationKey)}
              disabled={loading || saving}
            >
              {Object.entries(LOCATIONS).map(([key, loc]) => (
                <option key={key} value={key}>{loc.name}</option>
              ))}
            </select>
          </div>
        </header>

        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by SKU or product name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="loading">
            <div className="spinner" />
            Loading products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <h3>No products found</h3>
            <p>{searchQuery ? 'Try adjusting your search' : 'No products at this location'}</p>
          </div>
        ) : (
          <div className="products-grid">
            {filteredProducts.map((product) => {
              const currentInputValue = stockValues[product.id] || '';
              const hasChanged = currentInputValue !== product.currentStock.toString();
              
              return (
                <div key={product.id} className="product-card">
                  <img
                    src={product.image || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f0f0f0" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23999" font-size="12">No image</text></svg>'}
                    alt={product.productTitle}
                    className="product-image"
                  />
                  <div className="product-info">
                    <div className="product-title">
                      {product.productTitle}
                      {product.variantTitle && ` - ${product.variantTitle}`}
                    </div>
                    <div className="product-sku">{product.sku}</div>
                  </div>
                  <div className="stock-current">
                    <div className="label">Current</div>
                    <div className="value">{product.currentStock}</div>
                  </div>
                  <div className="stock-input-wrapper">
                    <label>New Count</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className={`stock-input ${hasChanged ? 'changed' : ''}`}
                      value={currentInputValue}
                      onChange={(e) => handleStockChange(product.id, e.target.value)}
                      placeholder="—"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className={`save-bar ${changes.length > 0 ? 'visible' : ''}`}>
          <div className="changes-count">
            <strong>{changes.length}</strong> {changes.length === 1 ? 'item' : 'items'} to update
          </div>
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={handleDiscard} disabled={saving}>
              Discard
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className={`toast ${toast ? 'visible' : ''} ${toast?.type || ''}`}>
          {toast?.message}
        </div>
      </div>
    </>
  );
}
