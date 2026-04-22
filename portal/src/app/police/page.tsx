import { API_URL } from '@/lib/admin-api';

export default async function PolicePage() {
  const res = await fetch(`${API_URL}/api/bluelight-portal`, { cache: 'no-store' });
  const html = await res.text();

  return (
    <iframe
      srcDoc={html}
      style={{
        width: '100%',
        height: '100vh',
        border: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
      }}
      title="Blue Light Support"
    />
  );
}
