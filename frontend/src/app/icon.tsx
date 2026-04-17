import { ImageResponse } from 'next/og';

export const size = { width: 144, height: 144 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: 34,
          color: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', fontFamily: 'monospace', fontWeight: 'bold' }}>
          <span style={{ fontSize: 60, lineHeight: 1, marginBottom: 6 }}>OA</span>
          <span style={{ fontSize: 32, color: '#00e5ff', lineHeight: 1, marginLeft: 2, fontWeight: 'normal' }}>c</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
