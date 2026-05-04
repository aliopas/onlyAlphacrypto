import { ImageResponse } from 'next/og';
import { terminalApi } from '@/features/terminal/api';

export const runtime = 'edge';
export const alt = 'OnlyAlpha — AI-Powered Crypto Intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 300;

export default async function Image({ params }: { params: Promise<{ coin: string }> }) {
  const { coin } = await params;
  const symbol = coin.toUpperCase();

  let headline = `${symbol} — AI-Powered Analysis`;
  let subtitle = 'Real-time market intelligence and scenario analysis';

  try {
    const { masterArticle } = await terminalApi.getMasterArticle(symbol);
    if (masterArticle?.headline) {
      headline = masterArticle.headline;
      subtitle = masterArticle.hook || subtitle;
    }
  } catch (error) {
    console.error('Failed to fetch master article for OG image:', error);
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0A0A0A',
          padding: '80px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '200px',
            height: '200px',
            backgroundColor: '#10B981',
            borderRadius: '50px',
            marginBottom: '48px',
            fontSize: '100px',
            fontWeight: 'bold',
            color: 'white',
            fontFamily: 'monospace',
          }}
        >
          {symbol}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: 'white',
              fontFamily: 'sans-serif',
              letterSpacing: '-1px',
              maxWidth: '800px',
              lineHeight: '1.2',
            }}
          >
            {headline}
          </span>
          <span
            style={{
              fontSize: '24px',
              color: '#10B981',
              fontFamily: 'sans-serif',
              marginTop: '16px',
              maxWidth: '600px',
              lineHeight: '1.3',
            }}
          >
            {subtitle}
          </span>
        </div>

        <div
          style={{
            marginTop: 'auto',
            fontSize: '18px',
            color: '#555555',
            fontFamily: 'monospace',
          }}
        >
          onlyalphacrypto.com
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}