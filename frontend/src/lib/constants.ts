export const SITE_URL = 'https://onlyalphacrypto.com';

export const COINS = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX',
  'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'NEAR', 'APT', 'ARB',
  'OP', 'SUI', 'SEI', 'TIA', 'JUP', 'WIF', 'PEPE', 'FLOKI',
  'INJ', 'FTM', 'RENDER', 'AAVE', 'MKR', 'SNX',
] as const;

export type CoinSymbol = typeof COINS[number];

export const GA_MEASUREMENT_ID = 'G-VWQNMXJ2JK';
