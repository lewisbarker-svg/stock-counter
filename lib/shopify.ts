import '@shopify/shopify-api/adapters/node';
import { shopifyApi, LATEST_API_VERSION, Session } from '@shopify/shopify-api';

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: (process.env.SHOPIFY_SCOPES || '').split(','),
  hostName: (process.env.SHOPIFY_APP_URL || '').replace(/https?:\/\//, ''),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});

export default shopify;

export const LOCATIONS = {
  bristol: {
    id: process.env.LOCATION_BRISTOL || '62584946887',
    name: 'Bristol'
  },
  rotherham: {
    id: process.env.LOCATION_ROTHERHAM || '62584914119',
    name: 'Rotherham'
  },
  london: {
    id: process.env.LOCATION_LONDON || '71658701033',
    name: 'London'
  },
  gateshead: {
    id: process.env.LOCATION_GATESHEAD || '105047294330',
    name: 'Gateshead'
  }
};

export type LocationKey = keyof typeof LOCATIONS;

// Helper to create a session for API calls
export function createSession(shop: string, accessToken: string): Session {
  return new Session({
    id: `${shop}_session`,
    shop,
    state: '',
    isOnline: false,
    accessToken,
  });
}
