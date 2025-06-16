
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
  - `diamonds`: (Number) Kullanıcının uygulama içi para birimi bakiyesi
  - `createdAt`: (Timestamp) Kullanıcı belgesinin oluşturulduğu zaman
  - `role`: (String) Kullanıcının rolü (örneğin, "user", "admin")
- **Alt Koleksiyonlar:**
  - `confirmedFriends`: Onaylanmış arkadaş bağlantılarını saklar.
    - **Yol:** `/users/{userId}/confirmedFriends/{friendId}`
    - **Alanlar:** `displayName` (String), `photoURL` (String, nullable), `addedAt` (Timestamp)

## `chatRooms`
Oluşturulan sohbet odaları hakkında bilgi saklar.
- **Yol:** `/chatRooms/{roomId}`
- **Alanlar:**
  - `name`: (String) Sohbet odasının adı
  - `description`: (String, isteğe bağlı) Odanın açıklaması
  - `creatorId`: (String) Odayı oluşturan kullanıcının UID'si
  - `creatorName`: (String) Oluşturanın görünen adı
  - `createdAt`: (Timestamp) Odanın oluşturulduğu zaman
  - `expiresAt`: (Timestamp) Odanın süresinin dolacağı zaman
  - `image`: (String) Odanın resminin URL'si
  - `imageAiHint`: (String) Odanın resmi için yapay zeka ipucu
  - `participantCount`: (Number) Mevcut katılımcı sayısı
  - `maxParticipants`: (Number) İzin verilen maksimum katılımcı sayısı
- **Alt Koleksiyonlar:**
  - `messages`: Odada gönderilen mesajları saklar.
    - **Yol:** `/chatRooms/{roomId}/messages/{messageId}`
    - **Alanlar:** `text` (String), `senderId` (String), `senderName` (String), `senderAvatar` (String, nullable), `timestamp` (Timestamp), `isGameMessage` (Boolean, isteğe bağlı, oyun sistemi mesajları için true)
  - `participants`: Odadaki aktif katılımcıları saklar.
    - **Yol:** `/chatRooms/{roomId}/participants/{userId}`
    - **Alanlar:** `joinedAt` (Timestamp), `displayName` (String), `photoURL` (String, nullable), `uid` (String), `isTyping` (Boolean)

## `directMessages`
İki kullanıcı arasındaki özel mesajlaşmaları saklar.
- **Yol:** `/directMessages/{dmChatId}`
  - `dmChatId`, iki kullanıcının UID'sinin alfabetik olarak sıralanıp `_` ile birleştirilmesiyle oluşturulur (örn: `uid1_uid2`).
- **Alanlar:**
  - `participantUids`: (Array<String>) İki katılımcının UID'lerini içerir.
  - `participantInfo`: (Map) Katılımcıların temel bilgilerini saklar (UID anahtarıyla).
    - Örn: `{ "uid1": { "displayName": "User1", "photoURL": "url1" }, "uid2": { "displayName": "User2", "photoURL": "url2" } }`
  - `createdAt`: (Timestamp) DM sohbetinin ilk mesajla oluşturulduğu zaman.
  - `lastMessageTimestamp`: (Timestamp) Bu sohbetteki son mesajın zaman damgası (sıralama ve bildirimler için).
  - `lastMessageText`: (String, isteğe bağlı) Son mesajın kısa bir özeti (DM listesinde göstermek için).
  - `lastMessageSenderId`: (String, isteğe bağlı) Son mesajı gönderenin UID'si.
- **Alt Koleksiyonlar:**
  - `messages`: DM'deki mesajları saklar.
    - **Yol:** `/directMessages/{dmChatId}/messages/{messageId}`
    - **Alanlar:** `text` (String), `senderId` (String), `senderName` (String), `senderAvatar` (String, nullable), `timestamp` (Timestamp)
- **Gerekli İndeksler:**
  - `directMessages` koleksiyonunda, `participantUids` (ARRAY_CONTAINS) ve `lastMessageTimestamp` (DESCENDING) alanlarını içeren bir birleşik indeks gereklidir. Bu, DM listesi sayfasının düzgün çalışması için önemlidir. Firebase konsolundan oluşturabilirsiniz. Hata mesajındaki bağlantı genellikle doğrudur.

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

## `appSettings`
Genel uygulama ayarlarını saklar.
- **Yol:** `/appSettings/gameConfig` (Örnek belge, Oyun Sistemi v1 için)
- **Alanlar (`gameConfig` için):**
  - `isGameEnabled`: (Boolean) Sohbet içi oyunun etkin olup olmadığı (varsayılan: false)
  - `questionIntervalSeconds`: (Number) Yeni oyun soruları için saniye cinsinden aralık (varsayılan: 180 saniye)

**Koleksiyonlar Nasıl Oluşturulur:**
Uygulama kodu, kullanıcılar özelliklerle etkileşimde bulundukça bu koleksiyonları ve belgeleri dinamik olarak oluşturacak şekilde tasarlanmıştır:
- `users` koleksiyonundaki belgeler, bir kullanıcı kaydolduğunda veya profili güncellendiğinde oluşturulur/güncellenir.
- `chatRooms` koleksiyonundaki belgeler (ve alt koleksiyonları), bir kullanıcı yeni bir sohbet odası oluşturduğunda veya bir oda içinde etkileşimde bulunduğunda oluşturulur.
- `directMessages` koleksiyonundaki belgeler (ve `messages` alt koleksiyonu), iki kullanıcı arasında ilk DM gönderildiğinde oluşturulur. `directMessages` ana belgesi, son mesaj bilgileriyle güncellenir.
- `friendRequests` koleksiyonundaki belgeler, bir kullanıcı arkadaşlık isteği gönderdiğinde oluşturulur.
- `appSettings/gameConfig` gibi başlangıç için gerekli olabilecek belirli yapılandırma belgeleri, genellikle Firebase Konsolu üzerinden manuel olarak eklenir. Uygulama bu belgeden okuma yapar, ancak eksikse kod içinde tanımlanmış varsayılan değerleri kullanır.

Bu dokümanın, uygulamanın Firebase Firestore veritabanını nasıl yapılandırdığı konusunda sana fikir vermesini umuyorum!
