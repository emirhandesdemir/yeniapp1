
export default function HomePage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'sans-serif',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#111' }}>ANA SAYFA ÇALIŞIYOR</h1>
      <p style={{ marginTop: '1rem', fontSize: '1.2rem', color: '#555' }}>
        Eğer bu yazıyı görüyorsanız, temel Next.js sunucusu ve yönlendirmesi doğru çalışıyor demektir.
      </p>
      <p style={{ marginTop: '0.5rem', color: '#888' }}>
        Hatanın kaynağı, layout veya provider bileşenlerindeydi.
      </p>
    </div>
  );
}
