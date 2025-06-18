
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
    - dashboard/page.tsx: Admin ana paneli.
    - users/page.tsx: Kullanıcı yönetimi sayfası.
    - chat-rooms/page.tsx: Sohbet odası yönetimi sayfası.
    - game-settings/page.tsx: Oyun ayarları ve soruları yönetimi sayfası.
    - project-assistant/page.tsx: Proje hakkında AI asistanı sayfası.
    - layout.tsx: Admin sayfaları için ortak layout ve yetkilendirme.
  - (main): Ana uygulama sayfaları (anasayfa, sohbet odaları, DM, profil, mağaza, arkadaşlar) ve bu sayfaların ortak layout'u buradadır.
    - page.tsx: Uygulamanın ana giriş sayfası (genellikle /feed veya kullanıcı girişi sonrası yönlendirilen sayfa).
    - chat/[roomId]/page.tsx: Belirli bir sohbet odasının sayfası. Mesajlaşma, katılımcı listesi, oyun sistemi ve WebRTC sesli sohbet mantığını içerir.
    - dm/[chatId]/page.tsx: İki kullanıcı arasındaki direkt mesajlaşma sayfası.
    - friends/page.tsx: Arkadaş listesi, arkadaş arama ve istek yönetimi.
    - profile/page.tsx: Kullanıcının kendi profilini düzenleyebileceği sayfa.
    - profile/[userId]/page.tsx: Başka bir kullanıcının profilini görüntüleme sayfası.
    - store/page.tsx: Uygulama içi satın alımlar (elmas, premium) için mağaza sayfası.
    - call/[callId]/page.tsx: Birebir WebRTC sesli arama arayüzü.
    - layout.tsx: Ana uygulama sayfaları için ortak layout (AppLayout). Alt navigasyon, üst bar, bildirimler ve gelen çağrı pop-up'ını yönetir.
    - loading.tsx: Sayfa yüklenirken gösterilen genel yükleme bileşeni.
  - api: Backend API endpoint'leri burada tanımlanır (örn: dosya yükleme - şu an pasif).
  - login, signup: Giriş ve kayıt sayfaları.
  - layout.tsx: Kök layout, genel HTML yapısını ve temel context provider'ları (Auth, Theme, Notification) içerir.
  - globals.css: ShadCN tema değişkenleri ve genel CSS stilleri.
  - error.tsx: Global hata yakalama sayfası.
  - not-found.tsx: 404 sayfası.
  - offline/page.tsx: Çevrimdışı olduğunda gösterilen PWA yedek sayfası.
- src/components: Tekrar kullanılabilir React bileşenleri.
  - admin: Admin paneline özel UI bileşenleri ve bölümleri.
    - AdminOverlayPanel.tsx: Admin paneli sekmelerini ve içeriklerini yöneten ana overlay.
    - sections/*: Her bir admin sekmesinin içeriğini barındıran bileşenler (örn: AdminUsersContent, AdminGameSettingsContent).
  - auth: Giriş (LoginForm) ve kayıt (SignupForm) formları.
  - chat: Sohbet odası sayfası ve ilgili bileşenler (ChatMessageItem, VoiceParticipantGrid).
  - dm: Direkt mesajlaşma için (DirectMessageItem).
  - feed: Ana sayfa akışı için gönderi kartları (PostCard), yorumlar (CommentCard, CommentForm), gönderi oluşturma formu (CreatePostForm), aktif oda kartı (RoomInFeedCard).
  - game: Sohbet odası oyunu ile ilgili bileşenler (GameQuestionCard).
  - layout: Ana uygulama (AppLayout) ve kimlik doğrulama (AuthLayout) için layout bileşenleri.
  - onboarding: Yeni kullanıcılar için hoş geldin/tanıtım bileşeni (WelcomeOnboarding).
  - notifications: Uygulama içi bildirim banner'ı (InAppNotificationBanner).
  - ui: ShadCN tarafından sağlanan temel UI bileşenleri (Button, Card, Input vb.).
- src/contexts: React Context API kullanılarak oluşturulmuş global state yöneticileri.
  - AuthContext: Kullanıcı kimlik doğrulama, kullanıcı verileri (UserData: displayName, email, photoURL, diamonds, role, bio, gender, privacySettings, premiumStatus, premiumExpiryDate) ve admin paneli görünürlüğünü yönetir.
  - ThemeContext: Açık/koyu tema yönetimini sağlar.
  - InAppNotificationContext: Uygulama içi bildirimleri yönetir.
- src/lib: Yardımcı fonksiyonlar ve Firebase yapılandırması.
  - firebase.ts: Firebase SDK'nın başlatılması ve servislerin (auth, db, storage) export edilmesi.
  - utils.ts: Genel yardımcı fonksiyonlar (örn: cn, generateDmChatId).
  - firestoreUtils.ts: Firestore ile ilgili karmaşık işlemleri (örn: sohbet odası ve alt koleksiyonlarını silme) içeren fonksiyonlar.
  - notificationUtils.ts: Push bildirimleriyle (OneSignal) ilgili fonksiyonlar (izin isteme, abone olma).
- src/ai: Genkit AI akışları ve yapılandırması.
  - genkit.ts: Temel Genkit AI instance'ının oluşturulması (Google AI Studio - Gemini 2.0 Flash modeli).
  - dev.ts: Geliştirme ortamında Genkit akışlarını kaydetmek için kullanılır.
  - flows: Uygulamaya özel AI akışlarının (generateEchoFlow, projectAssistantFlow) tanımlandığı dosyalar.
- src/hooks: Özel React hook'ları (örn: useToast, useMobile).
- src/worker: PWA (Progressive Web App) için Service Worker dosyası (OneSignal entegrasyonu içerir).
- public: Statik dosyalar, ikonlar, PWA manifest dosyası (manifest.json).
- components.json: ShadCN UI yapılandırması.
- next.config.ts: Next.js yapılandırması (PWA, resim optimizasyonu, güvenlik başlıkları, özel service worker vb. içerir).
- package.json: Proje bağımlılıkları ve script'leri.
- tailwind.config.ts: Tailwind CSS yapılandırması.
- tsconfig.json: TypeScript yapılandırması.
- src/docs/database-schema.md: Firestore veritabanı şemasının detaylı dokümantasyonu (users, chatRooms, directMessages, directCalls, friendRequests, posts, appSettings, gameQuestions koleksiyonları ve alt koleksiyonları).

Temel Teknolojiler:
- Frontend: Next.js (App Router), React, TypeScript
- UI: ShadCN, Tailwind CSS
- State Management: React Context API
- AI: Genkit (Google AI Studio - Gemini 2.0 Flash)
- Backend: Firebase (Authentication, Firestore, Storage - Storage aktif kullanılmıyor)
- PWA & Notifications: next-pwa, OneSignal
- Sesli Sohbet: WebRTC

Önemli İşlevler:
- Kullanıcı kimlik doğrulama (E-posta/şifre, Google).
- Sohbet odaları (oluşturma, katılma, mesajlaşma, süreli odalar, admin tarafından yönetilen quiz oyunu, WebRTC ile çoklu katılımcılı sesli sohbet).
- Direkt mesajlaşma (birebir).
- Birebir WebRTC sesli arama.
- Kullanıcı profilleri ve arkadaşlık sistemi (istek gönderme/kabul etme).
- Admin paneli (kullanıcı, oda, oyun ayarları yönetimi, proje asistanı).
- Gönderi akışı (post paylaşma, beğenme, yorum yapma, oda linki paylaşma).
- Tema (açık/koyu) ve PWA desteği.
- Elmas sistemi (oda oluşturma, oyun ödülleri vb. için).
- Uygulama içi ve push bildirimleri.

Admin Panelindeki Proje Asistanı olarak, sana sorulan soruları bu bilgilere dayanarak cevapla. Eğer bilgi bu bağlamda yoksa, "Bu konuda bilgim yok." şeklinde cevap verebilirsin. Kod blokları veya çok teknik detaylar yerine genel açıklamalar yapmaya çalış. Sorulara proje yapısı, bileşenlerin yerleri, kullanılan teknolojiler veya belirli bir özelliğin hangi dosyalarda ele alındığı gibi konuları kapsayabilir.
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
