'use server';
/**
 * @fileOverview Proje yapısı ve dosyaları hakkında soruları yanıtlayan bir AI asistanı.
 *
 * - projectAssistantFlow - Soruları yanıtlayan ana fonksiyon.
 * - ProjectAssistantInput - Giriş tipi.
 * - ProjectAssistantOutput - Çıkış tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProjectAssistantInputSchema = z.object({
  question: z.string().describe('Proje yapısı, dosyalar veya genel işleyiş hakkında sorulan soru.'),
});
export type ProjectAssistantInput = z.infer<typeof ProjectAssistantInputSchema>;

const ProjectAssistantOutputSchema = z.object({
  answer: z.string().describe('Sorulan soruya verilen açıklayıcı cevap.'),
});
export type ProjectAssistantOutput = z.infer<typeof ProjectAssistantOutputSchema>;

export async function projectAssistantFlow(input: ProjectAssistantInput): Promise<ProjectAssistantOutput> {
  return projectAssistant(input);
}

const projectContext = `
Sohbet Küresi Projesi Genel Bakış:
Bu proje, Next.js, React, ShadCN UI bileşenleri, Tailwind CSS ve Genkit (AI için) kullanılarak geliştirilmiş bir sohbet uygulamasıdır. Firebase Firestore veritabanı olarak kullanılmaktadır.

Ana Klasör Yapısı ve Amaçları:
- src/app: Next.js App Router kullanılır. Sayfa tanımlamalarını ve layout'ları içerir.
  - (admin): Admin paneli sayfaları ve özel layout'u burada yer alır. '/admin/*' yolları buradan yönetilir.
  - (main): Ana uygulama sayfaları (anasayfa, sohbet odaları, DM, profil, mağaza, arkadaşlar) ve bu sayfaların ortak layout'u buradadır.
  - api: Backend API endpoint'leri burada tanımlanır (örn: dosya yükleme, şu an pasif).
  - login, signup: Giriş ve kayıt sayfaları.
  - layout.tsx: Kök layout, genel HTML yapısını ve temel context provider'ları (Auth, Theme, Notification) içerir.
  - page.tsx: Ana giriş sayfası (genellikle '/feed' veya kullanıcı girişi sonrası yönlendirilen sayfa).
  - globals.css: ShadCN tema değişkenleri ve genel CSS stilleri.
- src/components: Tekrar kullanılabilir React bileşenleri.
  - admin: Admin paneline özel UI bileşenleri ve bölümleri.
  - auth: Giriş ve kayıt formları.
  - chat: Sohbet odası sayfası ve ilgili bileşenler (mesajlar, katılımcı listesi vb.).
  - dm: Direkt mesajlaşma arayüzü bileşenleri.
  - feed: Ana sayfa akışı için gönderi kartları, yorumlar, gönderi oluşturma formu.
  - game: Sohbet odası oyunu ile ilgili bileşenler (örn: soru kartı).
  - layout: Ana uygulama (AppLayout) ve kimlik doğrulama (AuthLayout) için layout bileşenleri.
  - onboarding: Yeni kullanıcılar için hoş geldin/tanıtım bileşeni.
  - ui: ShadCN tarafından sağlanan temel UI bileşenleri (Button, Card, Input vb.).
- src/contexts: React Context API kullanılarak oluşturulmuş global state yöneticileri.
  - AuthContext: Kullanıcı kimlik doğrulama ve kullanıcı verilerini yönetir.
  - ThemeContext: Açık/koyu tema yönetimini sağlar.
  - InAppNotificationContext: Uygulama içi bildirimleri yönetir.
- src/lib: Yardımcı fonksiyonlar ve Firebase yapılandırması.
  - firebase.ts: Firebase SDK'nın başlatılması ve servislerin (auth, db, storage) export edilmesi.
  - utils.ts: Genel yardımcı fonksiyonlar (örn: cn, generateDmChatId).
  - firestoreUtils.ts: Firestore ile ilgili karmaşık işlemleri (örn: oda silme) içeren fonksiyonlar.
  - notificationUtils.ts: Push bildirimleriyle ilgili fonksiyonlar.
- src/ai: Genkit AI akışları ve yapılandırması.
  - genkit.ts: Temel Genkit AI instance'ının oluşturulması.
  - dev.ts: Geliştirme ortamında Genkit akışlarını kaydetmek için kullanılır.
  - flows: Uygulamaya özel AI akışlarının (örn: generateEchoFlow, projectAssistantFlow) tanımlandığı dosyalar.
- src/hooks: Özel React hook'ları (örn: useToast, useMobile).
- src/worker: PWA (Progressive Web App) için Service Worker dosyası (OneSignal entegrasyonu içerir).
- public: Statik dosyalar, ikonlar, PWA manifest dosyası (manifest.json).
- components.json: ShadCN UI yapılandırması.
- next.config.ts: Next.js yapılandırması (PWA, resim optimizasyonu, güvenlik başlıkları vb. içerir).
- package.json: Proje bağımlılıkları ve script'leri.
- tailwind.config.ts: Tailwind CSS yapılandırması.
- tsconfig.json: TypeScript yapılandırması.
- src/docs/database-schema.md: Firestore veritabanı şemasının dokümantasyonu.

Temel Teknolojiler:
- Frontend: Next.js (App Router), React, TypeScript
- UI: ShadCN, Tailwind CSS
- State Management: React Context API
- AI: Genkit (Google AI Studio)
- Backend: Firebase (Authentication, Firestore, Storage - Storage aktif kullanılmıyor olabilir)
- PWA & Notifications: next-pwa, OneSignal

Önemli İşlevler:
- Kullanıcı kimlik doğrulama (E-posta/şifre, Google).
- Sohbet odaları (oluşturma, katılma, mesajlaşma, süreli odalar, oyun sistemi).
- Direkt mesajlaşma.
- Birebir sesli arama.
- Kullanıcı profilleri ve arkadaşlık sistemi.
- Admin paneli (kullanıcı, oda, oyun ayarları yönetimi).
- Gönderi akışı (post paylaşma, beğenme, yorum yapma).
- Tema (açık/koyu) ve PWA desteği.
- Elmas sistemi (oda oluşturma vb. için).

Admin Panelindeki Proje Asistanı olarak, sana sorulan soruları bu bilgilere dayanarak cevapla. Eğer bilgi bu bağlamda yoksa, "Bu konuda bilgim yok." şeklinde cevap verebilirsin. Kod blokları veya çok teknik detaylar yerine genel açıklamalar yapmaya çalış.
`;

const projectAssistantPrompt = ai.definePrompt({
  name: 'projectAssistantPrompt',
  input: {schema: ProjectAssistantInputSchema},
  output: {schema: ProjectAssistantOutputSchema},
  prompt: `${projectContext}

Kullanıcının Sorusu: {{{question}}}

Cevabın:`,
});

const projectAssistant = ai.defineFlow(
  {
    name: 'projectAssistantFlow',
    inputSchema: ProjectAssistantInputSchema,
    outputSchema: ProjectAssistantOutputSchema,
  },
  async (input) => {
    const {output} = await projectAssistantPrompt(input);
    if (output) {
        return output;
    }
    return { answer: "Proje asistanından bir cevap alınamadı." };
  }
);
