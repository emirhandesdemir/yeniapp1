
export default function DiagnosisPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontFamily: 'sans-serif',
      backgroundColor: '#111',
      color: '#fff',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h1 style={{ fontSize: '3rem', color: '#0f0' }}>SUNUCU BAŞLATILDI</h1>
      <p style={{ fontSize: '1.2rem', marginTop: '1rem', color: '#ccc' }}>
        Temel yapılandırma sorunu çözüldü. Uygulama artık çalışıyor.
      </p>
      <p style={{ fontSize: '1rem', marginTop: '0.5rem', color: '#888' }}>
        Şimdi diğer bileşenleri ve sayfaları güvenle geri ekleyebiliriz.
      </p>
    </div>
  );
}
