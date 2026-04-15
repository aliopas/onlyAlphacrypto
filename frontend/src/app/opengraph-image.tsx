import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'OnlyAlpha — AI-Powered Crypto Intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
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
            width: '160px',
            height: '160px',
            backgroundColor: '#0A0A0A',
            borderRadius: '40px',
            marginBottom: '48px',
            fontSize: '80px',
            fontWeight: 'bold',
            color: 'white',
            fontFamily: 'monospace',
          }}
        >
          OA<span style={{ color: '#00e5ff', fontSize: '40px', alignSelf: 'flex-end' }}>c</span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '64px',
              fontWeight: 'bold',
              color: 'white',
              fontFamily: 'sans-serif',
              letterSpacing: '-2px',
            }}
          >
            OnlyAlpha
          </span>
          <span
            style={{
              fontSize: '28px',
              color: '#00e5ff',
              fontFamily: 'sans-serif',
              marginTop: '16px',
            }}
          >
            AI-Powered Crypto Intelligence
          </span>
          <span
            style={{
              fontSize: '20px',
              color: '#888888',
              fontFamily: 'sans-serif',
              marginTop: '24px',
            }}
          >
            Real-time AI market analysis · Airdrop tracking · On-chain intelligence
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
