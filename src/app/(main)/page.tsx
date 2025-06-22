
// Bu, 404 hatasının kaynağını bulmak için oluşturulmuş geçici bir test sayfasıdır.
export default function HomePage() {
  return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif', color: '#111' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Ana Sayfa Başarıyla Yüklendi!</h1>
      <p style={{ marginTop: '1rem', fontSize: '1.1rem' }}>Sunucu çalışıyor ve yönlendirme doğru.</p>
      <p style={{ marginTop: '0.5rem', color: '#555' }}>
        Sorunun kaynağı, bu sayfada veya layout'ta daha önce bulunan karmaşık bileşenlerden birindeydi. Şimdi sorunu bulmak için adımları takip edebiliriz.
      </p>
    </div>
  );
}
