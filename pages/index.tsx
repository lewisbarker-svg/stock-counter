import { useState, useEffect, useMemo, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

interface Product {
  id: string;
  productId: string;
  productTitle: string;
  variantTitle: string | null;
  sku: string;
  image: string | null;
  inventoryItemId: string;
  inventoryLevelId: string;
  currentStock: number;
}

interface StockChange {
  inventoryItemId: string;
  sku: string;
  oldValue: number;
  newValue: number;
}

const LOCATIONS = {
  bristol: { id: '62584946887', name: 'Bristol' },
  rotherham: { id: '62584914119', name: 'Rotherham' },
  london: { id: '71658701033', name: 'London' },
  gateshead: { id: '105047294330', name: 'Gateshead' },
};

type LocationKey = keyof typeof LOCATIONS;

export default function Home() {
  const router = useRouter();
  const [selectedLocation, setSelectedLocation] = useState<LocationKey>('bristol');
  const [products, setProducts] = useState<Product[]>([]);
  const [stockValues, setStockValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  // Fetch products for selected location
  const fetchProducts = useCallback(async (locationId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/products?locationId=${locationId}`);
      const data = await response.json();
      
      if (data.needsAuth) {
        setNeedsAuth(true);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch products');
      }

      setProducts(data.products);
      setNeedsAuth(false);
      
      // Initialize stock values
      const initialValues: Record<string, string> = {};
      data.products.forEach((product: Product) => {
        initialValues[product.id] = product.currentStock.toString();
      });
      setStockValues(initialValues);
    } catch (error) {
      console.error('Error:', error);
      showToast('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(LOCATIONS[selectedLocation].id);
  }, [selectedLocation, fetchProducts]);

  const handleLogin = () => {
    window.location.href = '/api/auth?shop=panel-company.myshopify.com';
  };

  // Track changes
  const changes = useMemo(() => {
    const changedItems: StockChange[] = [];
    
    products.forEach((product) => {
      const currentValue = stockValues[product.id];
      const originalValue = product.currentStock.toString();
      
      if (currentValue !== undefined && currentValue !== originalValue && currentValue !== '') {
        changedItems.push({
          inventoryItemId: product.inventoryItemId,
          sku: product.sku,
          oldValue: product.currentStock,
          newValue: parseInt(currentValue, 10),
        });
      }
    });
    
    return changedItems;
  }, [products, stockValues]);

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    
    const query = searchQuery.toLowerCase();
    return products.filter(
      (product) =>
        product.sku.toLowerCase().includes(query) ||
        product.productTitle.toLowerCase().includes(query) ||
        (product.variantTitle && product.variantTitle.toLowerCase().includes(query))
    );
  }, [products, searchQuery]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleStockChange = (productId: string, value: string) => {
    // Only allow numbers
    if (value !== '' && !/^\d*$/.test(value)) return;
    
    setStockValues((prev) => ({
      ...prev,
      [productId]: value,
    }));
  };

  const handleSave = async () => {
    if (changes.length === 0) return;
    
    setSaving(true);
    
    try {
      const updates = changes.map((change) => ({
        inventoryItemId: change.inventoryItemId,
        locationId: LOCATIONS[selectedLocation].id,
        quantity: change.newValue,
      }));

      const response = await fetch('/api/update-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update inventory');
      }

      if (result.failed > 0) {
        showToast(`Updated ${result.success}, failed ${result.failed}`, 'error');
      } else {
        showToast(`Successfully updated ${result.success} items`, 'success');
      }

      // Refresh data
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

  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (changes.length > 0) {
      if (!confirm('You have unsaved changes. Switch location anyway?')) {
        return;
      }
    }
    setSelectedLocation(e.target.value as LocationKey);
  };

  return (
    <>
      <Head>
        <title>Stock Counter | Panel Company</title>
        <meta name="description" content="Update inventory counts" />
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
              onChange={handleLocationChange}
              disabled={loading || saving}
            >
              {Object.entries(LOCATIONS).map(([key, loc]) => (
                <option key={key} value={key}>
                  {loc.name}
                </option>
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
        ) : needsAuth ? (
          <div className="empty-state">
            <h3>Connect to Shopify</h3>
            <p>Click below to authorize the app to access your inventory.</p>
            <button 
              className="btn btn-primary" 
              onClick={handleLogin}
              style={{ marginTop: '20px' }}
            >
              Connect to Shopify
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <h3>No products found</h3>
            <p>
              {searchQuery
                ? 'Try adjusting your search terms'
                : 'No products are stocked at this location'}
            </p>
          </div>
        ) : (
          <div className="products-grid">
            {filteredProducts.map((product) => {
              const currentInputValue = stockValues[product.id] || '';
              const hasChanged = currentInputValue !== product.currentStock.toString();
              
              return (
                <div key={product.id} className="product-card">
                  <img
                    src={product.image || '/placeholder.png'}
                    alt={product.productTitle}
                    className="product-image"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f0f0f0" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23999" font-size="12">No image</text></svg>';
                    }}
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
                    <label htmlFor={`stock-${product.id}`}>New Count</label>
                    <input
                      id={`stock-${product.id}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
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
            <button
              className="btn btn-secondary"
              onClick={handleDiscard}
              disabled={saving}
            >
              Discard
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
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
