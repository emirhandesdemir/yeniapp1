
# Firestore Veri Yapısı

Bu belge, uygulamanın kullandığı temel Firestore koleksiyonlarını ve tipik belge yapılarını özetlemektedir. Firestore bir NoSQL veritabanı olduğu için şemalar esnektir, ancak bu, yaygın kullanım kalıplarını açıklar.

## `users`
Kullanıcı profil bilgilerini saklar.
- **Yol:** `/users/{userId}`
- **Alanlar:**
  - `uid`: (String) Kullanıcının benzersiz ID'si (Firebase Auth'dan gelir)
  - `email`: (String) Kullanıcının e-postası
  - `displayName`: (String) Kullanıcının seçtiği görünen ad
  - `photoURL`: (String, nullable) Kullanıcının profil fotoğrafının URL'si
  - `diamonds`: (Number) Kullanıcının uygulama içi para birimi bakiyesi (Varsayılan: 10)
  - `createdAt`: (Timestamp) Kullanıcı belgesinin oluşturulduğu zaman
  - `role`: (String) Kullanıcının rolü (örneğin, "user", "admin")
  - `bio`: (String, nullable) Kullanıcının hakkında yazdığı kısa metin.
  - `gender`: (String, nullable) Kullanıcının cinsiyeti (örneğin, "kadın", "erkek", "belirtilmemiş")
  - `privacySettings`: (Map, nullable) Kullanıcının gizlilik ayarlarını saklar.
    - `postsVisibleToFriendsOnly`: (Boolean) `true` ise gönderiler sadece arkadaşlar tarafından görülebilir. (Varsayılan: `false`)
    - `activeRoomsVisibleToFriendsOnly`: (Boolean) `true` ise kullanıcının aktif odaları sadece arkadaşlar tarafından görülebilir. (Varsayılan: `false`)
- **Alt Koleksiyonlar:**
  - `confirmedFriends`: Onaylanmış arkadaş bağlantılarını saklar.
    - **Yol:** `/users/{userId}/confirmedFriends/{friendId}`
    - **Alanlar:** `displayName` (String), `photoURL` (String, nullable), `addedAt` (Timestamp)

## `chatRooms`
Oluşturulan sohbet odaları hakkında bilgi saklar.
- **Yol:** `/chatRooms/{roomId}`
- **Alanlar:**
  - `name`: (String) Sohbet odasının adı
  - `description`: (String) Odanın açıklaması (Zorunlu)
  - `creatorId`: (String) Odayı oluşturan kullanıcının UID'si
  - `creatorName`: (String) Oluşturanın görünen adı
  - `createdAt`: (Timestamp) Odanın oluşturulduğu zaman
  - `expiresAt`: (Timestamp) Odanın süresinin dolacağı zaman (Varsayılan: Oluşturulma + 20 dakika)
  - `image`: (String) Odanın resminin URL'si (Placeholder olarak kullanılır)
  - `imageAiHint`: (String) Odanın resmi için yapay zeka ipucu (Placeholder ile kullanılır)
  - `participantCount`: (Number) Mevcut katılımcı sayısı (Başlangıç: 0)
  - `maxParticipants`: (Number) İzin verilen maksimum katılımcı sayısı (Varsayılan: 7)
  - `gameInitialized`: (Boolean, isteğe bağlı) Oyun sisteminin bu oda için başlatılıp başlatılmadığını belirtir.
  - `currentGameQuestionId`: (String, nullable) Odada o anda aktif olan oyun sorusunun ID'si.
  - `nextGameQuestionTimestamp`: (Timestamp, nullable) Bir sonraki oyun sorusunun sorulması planlanan zaman damgası.
- **Not:** Oda oluşturma maliyeti varsayılan olarak **10 elmas**tır.
- **Alt Koleksiyonlar:**
  - `messages`: Odada gönderilen mesajları saklar.
    - **Yol:** `/chatRooms/{roomId}/messages/{messageId}`
    - **Alanlar:** `text` (String), `senderId` (String), `senderName` (String), `senderAvatar` (String, nullable), `timestamp` (Timestamp), `isGameMessage` (Boolean, isteğe bağlı)
  - `participants`: Odadaki aktif katılımcıları (metin sohbeti) saklar.
    - **Yol:** `/chatRooms/{roomId}/participants/{userId}`
    - **Alanlar:** `joinedAt` (Timestamp), `displayName` (String), `photoURL` (String, nullable), `uid` (String), `isTyping` (Boolean, isteğe bağlı)
- **Gerekli İndeksler:**
  - **Aktif Odaları Listeleme ve Sıralama (Ana Sayfa ve Chat Sayfası):**
    - Koleksiyon: `chatRooms`
    - Alanlar: `expiresAt` (Artan), `participantCount` (Azalan), `createdAt` (Azalan)
  - **Kullanıcının Aktif Odalarını Listeleme (Gönderi Oluşturma Formu ve Profil Sayfası):**
    - Koleksiyon: `chatRooms`
    - Alanlar: `creatorId` (Artan), `expiresAt` (Artan)
  - **Süresi Dolmuş Odaları Toplu Silme (Admin Paneli):**
    - Koleksiyon: `chatRooms`
    - Alanlar: `expiresAt` (Artan)
  - **Tüm Odaları Oluşturulma Tarihine Göre Listeleme (Admin Paneli):**
    - Koleksiyon: `chatRooms`
    - Alanlar: `createdAt` (Azalan)

## `directMessages`
İki kullanıcı arasındaki özel mesajlaşmaları saklar.
- **Yol:** `/directMessages/{dmChatId}`
  - `dmChatId`, iki kullanıcının UID'sinin alfabetik olarak sıralanıp `_` ile birleştirilmesiyle oluşturulur.
- **Alanlar:**
  - `participantUids`: (Array<String>) İki katılımcının UID'lerini içerir.
  - `participantInfo`: (Map) Katılımcıların temel bilgilerini saklar.
  - `createdAt`: (Timestamp) DM sohbetinin ilk mesajla oluşturulduğu zaman.
  - `lastMessageTimestamp`: (Timestamp) Bu sohbetteki son mesajın zaman damgası.
  - `lastMessageText`: (String, isteğe bağlı) Son mesajın kısa bir özeti.
  - `lastMessageSenderId`: (String, isteğe bağlı) Son mesajı gönderenin UID'si.
- **Alt Koleksiyonlar:**
  - `messages`: DM'deki mesajları saklar.
    - **Yol:** `/directMessages/{dmChatId}/messages/{messageId}`
    - **Alanlar:** `text` (String), `senderId` (String), `senderName` (String), `senderAvatar` (String, nullable), `timestamp` (Timestamp)
- **Gerekli İndeksler:**
  - `directMessages` koleksiyonunda, `participantUids` (ARRAY_CONTAINS) ve `lastMessageTimestamp` (DESCENDING) alanlarını içeren bir birleşik indeks gereklidir.
    - *Sorgu:* `src/app/(main)/direct-messages/page.tsx`

## `friendRequests`
Bekleyen, kabul edilen veya reddedilen arkadaşlık isteklerini saklar.
- **Yol:** `/friendRequests/{requestId}`
- **Alanlar:**
  - `fromUserId`: (String) İsteği gönderen kullanıcının UID'si
  - `fromUsername`: (String) Gönderenin görünen adı
  - `fromAvatarUrl`: (String, nullable) Gönderenin avatar URL'si
  - `toUserId`: (String) İsteği alan kullanıcının UID'si
  - `toUsername`: (String) Alıcının görünen adı
  - `toAvatarUrl`: (String, nullable) Alıcının avatar URL'si
  - `status`: (String) "pending", "accepted", veya "declined"
  - `createdAt`: (Timestamp) İsteğin oluşturulduğu zaman
- **Gerekli İndeksler:**
  - Bildirim popover'ında ve arkadaşlık isteği listelemelerinde kullanılan sorgu için (`src/components/layout/AppLayout.tsx`):
    - Koleksiyon: `friendRequests`
    - Alanlar: `toUserId` (Artan), `status` (Artan), `createdAt` (Azalan)
  - Sohbet odası kullanıcı popover'ında arkadaşlık durumu kontrolü için (`src/app/(main)/chat/[roomId]/page.tsx`):
    - Koleksiyon: `friendRequests`
    - İndeks 1: `fromUserId` (Artan), `toUserId` (Artan), `status` (Artan)
    - İndeks 2: `toUserId` (Artan), `fromUserId` (Artan), `status` (Artan)
  - Arkadaş silme işlemi sırasında kabul edilmiş istekleri silmek için (`src/app/(main)/friends/page.tsx`):
    - Koleksiyon: `friendRequests`
    - İndeks 1: `status` (Artan), `fromUserId` (Artan), `toUserId` (Artan)
    - İndeks 2: `status` (Artan), `toUserId` (Artan), `fromUserId` (Artan)
  - Bir kullanıcının profil sayfasında arkadaşlık durumunu kontrol etmek için:
    - Koleksiyon: `friendRequests`
    - Alanlar: `fromUserId` (Artan), `toUserId` (Artan), `status` (Artan)
    - Alanlar: `toUserId` (Artan), `fromUserId` (Artan), `status` (Artan)


## `posts`
Kullanıcıların paylaştığı gönderileri saklar.
- **Yol:** `/posts/{postId}`
- **Alanlar:**
  - `userId`: (String) Gönderiyi oluşturan kullanıcının UID'si
  - `username`: (String) Gönderiyi oluşturan kullanıcının görünen adı
  - `userAvatar`: (String, nullable) Gönderiyi oluşturan kullanıcının avatar URL'si
  - `content`: (String) Gönderinin metin içeriği (Max 280 karakter)
  - `createdAt`: (Timestamp) Gönderinin oluşturulduğu zaman
  - `likeCount`: (Number) Beğeni sayısı (Varsayılan: 0)
  - `commentCount`: (Number) Yorum sayısı (Varsayılan: 0)
  - `likedBy`: (Array<String>) Gönderiyi beğenen kullanıcıların UID listesi
  - `sharedRoomId`: (String, nullable) Paylaşılan sohbet odasının ID'si.
  - `sharedRoomName`: (String, nullable) Paylaşılan sohbet odasının adı.
  - `isRepost`: (Boolean, isteğe bağlı) Bu gönderinin bir yeniden paylaşım olup olmadığını belirtir.
  - `originalPostId`: (String, isteğe bağlı) Yeniden paylaşılan orijinal gönderinin ID'si.
  - `originalPostUserId`: (String, isteğe bağlı) Orijinal gönderiyi oluşturan kullanıcının ID'si.
  - `originalPostUsername`: (String, isteğe bağlı, nullable) Orijinal gönderiyi oluşturan kullanıcının adı.
  - `originalPostUserAvatar`: (String, isteğe bağlı, nullable) Orijinal gönderiyi oluşturan kullanıcının avatarı.
  - `originalPostContent`: (String, isteğe bağlı) Orijinal gönderinin içeriği.
  - `originalPostCreatedAt`: (Timestamp, isteğe bağlı) Orijinal gönderinin oluşturulma zamanı.
  - `originalPostSharedRoomId`: (String, isteğe bağlı, nullable) Orijinal gönderi bir oda paylaştıysa.
  - `originalPostSharedRoomName`: (String, isteğe bağlı, nullable) Orijinal gönderinin paylaştığı odanın adı.
- **Alt Koleksiyonlar:**
  - `comments`: Gönderiye yapılan yorumları saklar.
    - **Yol:** `/posts/{postId}/comments/{commentId}`
    - **Alanlar:**
      - `userId`: (String) Yorumu yapan kullanıcının UID'si
      - `username`: (String) Yorumu yapan kullanıcının görünen adı
      - `userAvatar`: (String, nullable) Yorumu yapan kullanıcının avatar URL'si
      - `content`: (String) Yorumun metin içeriği
      - `createdAt`: (Timestamp) Yorumun oluşturulduğu zaman
- **Gerekli İndeksler:**
  - Akış sayfasında ve kullanıcı profil sayfasında gönderileri sıralamak için (`src/app/page.tsx`, `src/app/(main)/profile/[userId]/page.tsx`):
    - Koleksiyon: `posts`
    - Alanlar: `userId` (Artan), `createdAt` (Azalan) (Kullanıcıya özel gönderiler için)
    - Alanlar: `createdAt` (Azalan) (Genel akış için)
  - Bir gönderinin yorumlarını sıralamak için (`src/components/feed/PostCard.tsx`):
    - Koleksiyon Grubu: `comments` (Tüm `posts` koleksiyonlarındaki `comments` alt koleksiyonlarını hedefler)
    - Alanlar: `createdAt` (Artan)

## `appSettings`
Genel uygulama ayarlarını saklar.
- **Yol:** `/appSettings/gameConfig`
- **Alanlar (`gameConfig` için):**
  - `isGameEnabled`: (Boolean) Sohbet içi oyunun etkin olup olmadığı.
  - `questionIntervalSeconds`: (Number) Yeni oyun soruları için saniye cinsinden aralık.

## `gameQuestions`
Sohbet odası quiz oyunu için soruları saklar.
- **Yol:** `/gameQuestions/{questionId}`
- **Alanlar:**
  - `text`: (String) Sorunun metni.
  - `answer`: (String) Sorunun cevabı (küçük/büyük harf duyarsız karşılaştırılmalı).
  - `hint`: (String) Soru için ipucu.
  - `createdAt`: (Timestamp) Sorunun eklendiği zaman.
- **Gerekli İndeksler:**
  - Admin panelinde soruları listelemek ve en son ekleneni üste almak için (`src/components/admin/sections/AdminGameSettingsContent.tsx`):
    - Koleksiyon: `gameQuestions`
    - Alanlar: `createdAt` (Azalan)

Bu dokümanın, uygulamanın Firebase Firestore veritabanını nasıl yapılandırdığı konusunda sana fikir vermesini umuyorum!
