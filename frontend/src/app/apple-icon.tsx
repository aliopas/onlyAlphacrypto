import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0A0A0A',
          borderRadius: 40,
          color: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', fontFamily: 'monospace', fontWeight: 'bold' }}>
          <span style={{ fontSize: 72, lineHeight: 1, marginBottom: 6 }}>OA</span>
          <span style={{ fontSize: 36, color: '#00e5ff', lineHeight: 1, marginLeft: 2, fontWeight: 'normal' }}>c</span>
        </div>
      </div>
    ),
    { ...size }
  );
}