import React from 'react';
import {
  Navigator,
  Screen,
  ScrollView,
  Stack,
  Text,
  Tile,
  useApi,
} from '@shopify/ui-extensions-react/point-of-sale';

const APP_URL = 'https://your-vercel-url.vercel.app';

const SmartGridTile = () => {
  return (
    <Tile
      title="Stock Counter"
      subtitle="Update inventory"
      onPress={() => {
        // Opens the web app in POS browser
        window.open(APP_URL, '_blank');
      }}
      enabled={true}
    />
  );
};

export default SmartGridTile;
