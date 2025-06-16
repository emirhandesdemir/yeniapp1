
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
  - `participants`: Odadaki aktif katılımcıları saklar.
    - **Yol:** `/chatRooms/{roomId}/participants/{userId}`
    - **Alanlar:** `joinedAt` (Timestamp), `displayName` (String), `photoURL` (String, nullable), `uid` (String), `isTyping` (Boolean, isteğe bağlı)

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
  - Bildirim popover'ında ve arkadaşlık isteği listelemelerinde kullanılan sorgu için:
    - Koleksiyon: `friendRequests`
    - Alanlar: `toUserId` (Artan), `status` (Artan), `createdAt` (Azalan)

## `appSettings`
Genel uygulama ayarlarını saklar.
- **Yol:** `/appSettings/gameConfig`
- **Alanlar (`gameConfig` için):**
  - `isGameEnabled`: (Boolean) Sohbet içi oyunun etkin olup olmadığı.
  - `questionIntervalSeconds`: (Number) Yeni oyun soruları için saniye cinsinden aralık.

Bu dokümanın, uygulamanın Firebase Firestore veritabanını nasıl yapılandırdığı konusunda sana fikir vermesini umuyorum!
