
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
  - `diamonds`: (Number) Kullanıcının uygulama içi para birimi bakiyesi (Varsayılan: 30)
  - `createdAt`: (Timestamp) Kullanıcı belgesinin oluşturulduğu zaman
  - `role`: (String) Kullanıcının rolü (örneğin, "user", "admin") (Varsayılan: 'user')
  - `bio`: (String, nullable) Kullanıcının hakkında yazdığı kısa metin.
  - `gender`: (String, nullable) Kullanıcının cinsiyeti (örneğin, "kadın", "erkek", "belirtilmemiş") (Varsayılan: 'belirtilmemiş')
  - `privacySettings`: (Map, nullable) Kullanıcının gizlilik ayarlarını saklar.
    - `postsVisibleToFriendsOnly`: (Boolean) `true` ise gönderiler sadece arkadaşlar tarafından görülebilir. (Varsayılan: `false`)
    - `activeRoomsVisibleToFriendsOnly`: (Boolean) `true` ise kullanıcının aktif odaları sadece arkadaşlar tarafından görülebilir. (Varsayılan: `false`)
    - `feedShowsEveryone`: (Boolean) `true` ise kullanıcının ana sayfa akışında herkesin gönderileri gösterilir, `false` ise sadece arkadaşlarının gönderileri gösterilir. (Varsayılan: `true`)
    - `showProfileViewCount`: (Boolean) `true` ise profil görüntülenme sayısı başkalarına gösterilir. (Varsayılan: `true`)
    - `showOnlineStatus`: (Boolean) `true` ise aktiflik durumu (çevrimiçi/son görülme) başkalarına gösterilir. (Varsayılan: `true`)
  - `premiumStatus`: (String, nullable) Kullanıcının premium abonelik durumu ('none', 'weekly', 'monthly'). (Varsayılan: 'none')
  - `premiumExpiryDate`: (Timestamp, nullable) Premium aboneliğin sona erme tarihi. (Varsayılan: `null`)
  - `isPremium`: (Boolean, isteğe bağlı) Kullanıcının premium olup olmadığını gösterir. `premiumStatus` ve `premiumExpiryDate` alanlarına göre dinamik olarak hesaplanabilir veya Firestore'a senkronize edilebilir.
  - `reportCount`: (Number) Kullanıcının aldığı şikayet sayısı. (Varsayılan: 0)
  - `isBanned`: (Boolean) Kullanıcının banlanıp banlanmadığı. (Varsayılan: `false`)
  - `profileViewCount`: (Number) Profilin kaç kez görüntülendiği. (Varsayılan: 0)
  - `lastSeen`: (Timestamp, nullable) Kullanıcının son aktif olduğu zaman.
- **Alt Koleksiyonlar:**
  - `confirmedFriends`: Onaylanmış arkadaş bağlantılarını saklar.
    - **Yol:** `/users/{userId}/confirmedFriends/{friendId}`
    - **Alanlar:** `displayName` (String), `photoURL` (String, nullable), `isPremium` (Boolean, isteğe bağlı), `addedAt` (Timestamp)
  - `blockedUsers`: Kullanıcının engellediği diğer kullanıcıları saklar.
    - **Yol:** `/users/{userId}/blockedUsers/{blockedUserId}`
    - **Alanlar:**
        - `blockedAt` (Timestamp) - Engelleme zamanı
        - `displayName` (String, nullable) - Engellenen kullanıcının görünen adı (listeleme için kolaylık)
        - `photoURL` (String, nullable) - Engellenen kullanıcının fotoğraf URL'si (listeleme için kolaylık)
- **Gerekli İndeksler:**
  - Admin panelinde kullanıcıları kayıt tarihine göre listelemek için (`src/components/admin/sections/AdminUsersContent.tsx`):
    - Koleksiyon: `users`
    - Alanlar: `createdAt` (Azalan)


## `chatRooms`
Oluşturulan sohbet odaları hakkında bilgi saklar.
- **Yol:** `/chatRooms/{roomId}`
- **Alanlar:**
  - `name`: (String) Sohbet odasının adı
  - `description`: (String) Odanın açıklaması (Zorunlu)
  - `creatorId`: (String) Odayı oluşturan kullanıcının UID'si
  - `creatorName`: (String) Oluşturanın görünen adı
  - `creatorIsPremium`: (Boolean, isteğe bağlı) Odayı oluşturan kullanıcının premium olup olmadığı. (Varsayılan: `false`)
  - `isPremiumRoom`: (Boolean, isteğe bağlı) Odanın bir premium kullanıcı tarafından oluşturulup oluşturulmadığı veya premium özelliklere sahip olup olmadığı. (Varsayılan: `false`)
  - `isActive`: (Boolean, isteğe bağlı) Odanın o an "canlı" olup olmadığını belirtir. Bu durum, genellikle kullanıcı sayısı ve mesajlaşma aktivitesine göre belirlenir. (Varsayılan: `false`)
  - `activeSince`: (Timestamp, nullable) `isActive` durumunun `true` olarak ayarlandığı zaman.
  - `lastMessageAt`: (Timestamp, nullable) Odadaki son mesajın gönderildiği zamanı gösteren ve odanın kendisinde tutulan bir zaman damgası. Bu, odaların aktiflik durumunu istemci tarafında kontrol etmek için kullanılır.
  - `createdAt`: (Timestamp) Odanın oluşturulduğu zaman
  - `expiresAt`: (Timestamp) Odanın süresinin dolacağı zaman (Varsayılan: Oluşturulma + 20 dakika)
  - `image`: (String, nullable) Oda için bir resim URL'si. Başlangıçta `placehold.co` URL'si ile ayarlanabilir. Daha sonra kullanıcı tarafından özel bir resimle (Firebase Storage'a yüklenmiş) güncellenebilir.
  - `imageAiHint`: (String, nullable) Eğer `image` alanı bir placeholder ise, bu alan placeholder için bir ipucu içerir. Kullanıcı tarafından yüklenmiş bir resim varsa bu alanın değeri `null` veya boş olabilir.
  - `participantCount`: (Number) Metin sohbetindeki mevcut katılımcı sayısı (Başlangıç: 0)
  - `voiceParticipantCount`: (Number) Sesli sohbetteki mevcut katılımcı sayısı (Başlangıç: 0)
  - `maxParticipants`: (Number) İzin verilen maksimum katılımcı sayısı. Premium kullanıcılar için bu değer daha yüksek (örn: 50) olabilirken, normal kullanıcılar için daha düşük bir varsayılan (örn: 7) ile başlar ve elmas karşılığında artırılabilir.
  - `isGameEnabledInRoom`: (Boolean, isteğe bağlı) Oda sahibi tarafından bu oda için oyun sisteminin etkinleştirilip etkinleştirilmediğini belirtir. (Varsayılan: `true` veya global ayara göre)
  - `gameInitialized`: (Boolean, isteğe bağlı) Oyun sisteminin bu oda için başlatılıp başlatılmadığını belirtir (genellikle `isGameEnabledInRoom` `true` ise bu da `true` olur).
  - `currentGameQuestionId`: (String, nullable) Odada o anda aktif olan oyun sorusunun ID'si.
  - `nextGameQuestionTimestamp`: (Timestamp, nullable) Bir sonraki oyun sorusunun sorulması planlanan zaman damgası.
  - `currentGameAnswerDeadline`: (Timestamp, nullable) Mevcut oyun sorusu için son cevap verme zamanı.
- **Not:** Normal kullanıcılar için oda oluşturma maliyeti varsayılan olarak **1 elmas**tır. Premium kullanıcılar ücretsiz oluşturabilir.
- **Alt Koleksiyonlar:**
  - `messages`: Odada gönderilen mesajları saklar.
    - **Yol:** `/chatRooms/{roomId}/messages/{messageId}`
    - **Alanlar:**
      - `text`: (String) Mesaj içeriği.
      - `senderId`: (String) Gönderen kullanıcının UID'si.
      - `senderName`: (String) Gönderenin görünen adı.
      - `senderAvatar`: (String, nullable) Gönderenin avatar URL'si.
      - `senderIsPremium`: (Boolean, isteğe bağlı) Gönderenin premium olup olmadığı.
      - `timestamp`: (Timestamp) Mesajın gönderildiği zaman.
      - `isGameMessage`: (Boolean, isteğe bağlı) Sistemsel bir oyun mesajı olup olmadığı.
      - `mentionedUserIds`: (Array<String>, isteğe bağlı) Mesajda etiketlenen kullanıcıların UID'leri.
      - `editedAt`: (Timestamp, nullable) Mesajın son düzenlenme zamanı.
      - `reactions`: (Map<String, Array<String>>, nullable) Mesaja verilen tepkiler. Anahtar emoji (örn: "👍"), değer tepkiyi veren kullanıcı UID'lerinin listesi. Örnek: `{ "👍": ["uid1", "uid2"], "❤️": ["uid3"] }`
    - **Kurallar:** Kendi mesajını silebilir veya düzenleyebilir. Diğer kullanıcılar tepki verebilir.
  - `participants`: Odadaki aktif metin sohbeti katılımcılarını saklar.
    - **Yol:** `/chatRooms/{roomId}/participants/{userId}`
    - **Alanlar:** `joinedAt` (Timestamp), `displayName` (String), `photoURL` (String, nullable), `uid` (String), `isTyping` (Boolean, isteğe bağlı), `isPremium` (Boolean, isteğe bağlı)
  - `voiceParticipants`: Odadaki aktif sesli sohbet katılımcılarını saklar.
    - **Yol:** `/chatRooms/{roomId}/voiceParticipants/{userId}`
    - **Alanlar:**
      - `uid`: (String) Kullanıcının UID'si
      - `displayName`: (String) Kullanıcının görünen adı
      - `photoURL`: (String, nullable) Kullanıcının avatar URL'si
      - `isPremium`: (Boolean, isteğe bağlı) Katılımcının premium olup olmadığı.
      - `joinedAt`: (Timestamp) Sesli sohbete katıldığı zaman
      - `isMuted`: (Boolean) Kullanıcının kendi mikrofonunu kapatıp kapatmadığı (Varsayılan: `false`)
      - `isMutedByAdmin`: (Boolean) Oda yöneticisi tarafından susturulup susturulmadığı (Varsayılan: `false`)
      - `isSpeaking`: (Boolean) Kullanıcının o anda konuşup konuşmadığı (Varsayılan: `false`)
  - `webrtcSignals`: Kullanıcılar arasında WebRTC sinyallerini (offer, answer, ICE candidate) iletmek için kullanılır. Her kullanıcı kendi UID'si altında bir belgeye sahip olur ve bu belge altında gelen sinyalleri saklayan bir `signals` alt koleksiyonu bulunur.
    - **Yol:** `/chatRooms/{roomId}/webrtcSignals/{userId}/signals/{signalId}`
    - **Alanlar:**
      - `type`: (String) 'offer', 'answer', veya 'candidate'
      - `from`: (String) Sinyali gönderen kullanıcının UID'si
      - `sdp`: (String, isteğe bağlı) Offer veya Answer için SDP.
      - `candidate`: (Object, isteğe bağlı) ICE adayı nesnesi.
      - `signalTimestamp`: (Timestamp) Sinyalin Firestore'a yazıldığı zaman.
- **Gerekli İndeksler (Firestore Console üzerinden manuel oluşturulmalı):**
  - **Aktif Odaları Listeleme ve Sıralama (Ana Sayfa ve Chat Sayfası):**
    - Koleksiyon: `chatRooms`
    - Alanlar: `expiresAt` (Artan), `participantCount` (Azalan), `createdAt` (Azalan)
    - *Sorgu:* `src/app/(main)/chat/page.tsx` ve `src/app/page.tsx`
  - **Kullanıcının Aktif Odalarını Listeleme (Gönderi Oluşturma Formu ve Profil Sayfası):**
    - Koleksiyon: `chatRooms`
    - Alanlar: `creatorId` (Artan), `expiresAt` (Artan)
    - *Sorgu:* `src/components/feed/CreatePostForm.tsx` ve `src/app/(main)/profile/[userId]/page.tsx`
  - **Süresi Dolmuş Odaları Toplu Silme (Admin Paneli):**
    - Koleksiyon: `chatRooms`
    - Alanlar: `expiresAt` (Artan)
    - *Sorgu:* `src/components/admin/sections/AdminChatRoomsContent.tsx`
  - **Tüm Odaları Oluşturulma Tarihine Göre Listeleme (Admin Paneli):**
    - Koleksiyon: `chatRooms`
    - Alanlar: `createdAt` (Azalan)
    - *Sorgu:* `src/components/admin/sections/AdminChatRoomsContent.tsx`

## `directMessages`
İki kullanıcı arasındaki özel mesajlaşmaları saklar.
- **Yol:** `/directMessages/{dmChatId}`
  - `dmChatId`, iki kullanıcının UID'sinin alfabetik olarak sıralanıp `_` ile birleştirilmesiyle oluşturulur.
- **Alanlar:**
  - `participantUids`: (Array<String>) İki katılımcının UID'lerini içerir.
  - `participantInfo`: (Map) Katılımcıların temel bilgilerini saklar. Her bir katılımcı UID'si için: `{ displayName: String, photoURL: String, isPremium: Boolean (isteğe bağlı) }`
  - `createdAt`: (Timestamp) DM sohbetinin ilk oluşturulduğu zaman (ilk mesajla veya arkadaşlık kabulüyle).
  - `lastMessageTimestamp`: (Timestamp, nullable) Bu sohbetteki son mesajın zaman damgası. Eğer hiç mesaj yoksa `null` olabilir.
  - `lastMessageText`: (String, isteğe bağlı) Son mesajın kısa bir özeti.
  - `lastMessageSenderId`: (String, isteğe bağlı) Son mesajı gönderenin UID'si.
  - `isMatchSession`: (Boolean, isteğe bağlı) `true` ise bu DM geçici bir 1v1 eşleşme seansıdır. (Varsayılan: `false`)
  - `matchSessionExpiresAt`: (Timestamp, nullable) `isMatchSession` `true` ise, seansın sona ereceği zaman.
  - `matchSessionUser1Id`: (String, nullable) `isMatchSession` `true` ise, eşleşen kullanıcılardan birinin UID'si.
  - `matchSessionUser2Id`: (String, nullable) `isMatchSession` `true` ise, eşleşen diğer kullanıcının UID'si.
  - `matchSessionUser1Decision`: (String, nullable) `isMatchSession` `true` ise, User1'in kararı ('pending', 'yes', 'no').
  - `matchSessionUser2Decision`: (String, nullable) `isMatchSession` `true` ise, User2'nin kararı ('pending', 'yes', 'no').
  - `matchSessionEnded`: (Boolean, isteğe bağlı) `isMatchSession` `true` ise ve seans kararlar sonucu veya süre aşımıyla bittiyse `true`. (Varsayılan: `false`)
  - `matchSessionEndedReason`: (String, nullable) Eşleşme seansının bitiş nedeni (örneğin, 'partner_left_USERID', 'user_left', 'user_left_page', 'timer_expired', 'both_yes', 'one_no', 'both_no').
  - `matchSessionEndedBy`: (String, nullable) Eşleşme seansını sonlandıran (örneğin ayrılan veya 'Hayır' diyen) kullanıcının UID'si.
- **Alt Koleksiyonlar:**
  - `messages`: DM'deki mesajları saklar.
    - **Yol:** `/directMessages/{dmChatId}/messages/{messageId}`
    - **Alanlar:**
        - `text`: (String) Mesaj içeriği.
        - `senderId`: (String) Gönderen kullanıcının UID'si.
        - `senderName`: (String) Gönderenin görünen adı.
        - `senderAvatar`: (String, nullable) Gönderenin avatar URL'si.
        - `senderIsPremium`: (Boolean, isteğe bağlı) Gönderenin premium olup olmadığı.
        - `timestamp`: (Timestamp) Mesajın gönderildiği zaman.
        - `editedAt`: (Timestamp, nullable) Mesajın son düzenlenme zamanı.
        - `reactions`: (Map<String, Array<String>>, nullable) Mesaja verilen tepkiler.
    - **Kurallar:** Kendi mesajını silebilir veya düzenleyebilir. Diğer kullanıcılar tepki verebilir.
- **Gerekli İndeksler (Firestore Console üzerinden manuel oluşturulmalı):**
  - `directMessages` koleksiyonunda, `participantUids` (ARRAY_CONTAINS) ve `lastMessageTimestamp` (DESCENDING) alanlarını içeren bir birleşik indeks gereklidir.
    - *Sorgu:* `src/app/(main)/direct-messages/page.tsx`

## `directCalls`
Birebir sesli/görüntülü çağrı oturumlarını yönetir.
- **Yol:** `/directCalls/{callId}`
- **Alanlar:**
  - `callId`: (String) Benzersiz çağrı ID'si. (Doküman ID'si de olabilir)
  - `callerId`: (String) Çağrıyı başlatan kullanıcının UID'si.
  - `callerName`: (String, nullable) Çağrıyı başlatanın adı.
  - `callerAvatar`: (String, nullable) Çağrıyı başlatanın avatarı.
  - `callerIsPremium`: (Boolean, isteğe bağlı) Arayanın premium olup olmadığı.
  - `calleeId`: (String) Çağrıyı alan kullanıcının UID'si.
  - `calleeName`: (String, nullable) Çağrıyı alanın adı.
  - `calleeAvatar`: (String, nullable) Çağrıyı alanın avatarı.
  - `calleeIsPremium`: (Boolean, isteğe bağlı) Arananın premium olup olmadığı.
  - `status`: (String) Çağrının durumu: `initiating`, `ringing`, `active`, `rejected`, `ended`, `missed`, `failed`.
  - `offerSdp`: (String, nullable) Arayanın SDP offer'ı.
  - `answerSdp`: (String, nullable) Arananın SDP answer'ı.
  - `createdAt`: (Timestamp) Çağrının oluşturulma zamanı.
  - `updatedAt`: (Timestamp) Çağrının son güncellenme zamanı.
  - `endedReason`: (String, nullable) Çağrı sonlandıysa nedeni.
- **Alt Koleksiyonlar:**
  - `callerIceCandidates`, `calleeIceCandidates`
- **Gerekli İndeksler (Firestore Console üzerinden manuel oluşturulmalı):**
  - `directCalls` koleksiyonu için: `calleeId` (Artan), `status` (Artan), `createdAt` (Azalan)
    - *Sorgu:* `src/components/layout/AppLayout.tsx` (Gelen çağrıları dinlemek için)

## `friendRequests`
Bekleyen, kabul edilen veya reddedilen arkadaşlık isteklerini saklar.
- **Yol:** `/friendRequests/{requestId}`
- **Alanlar:**
  - `fromUserId`, `fromUsername`, `fromAvatarUrl`, `fromUserIsPremium` (Boolean, isteğe bağlı), `toUserId`, `toUsername`, `toAvatarUrl`, `status`, `createdAt`
- **Gerekli İndeksler (Firestore Console üzerinden manuel oluşturulmalı):**
  - `toUserId` (Artan), `status` (Artan), `createdAt` (Azalan)
    - *Sorgu:* `src/components/layout/AppLayout.tsx` (Bildirim popover'ı için)
  - `fromUserId` (Artan), `toUserId` (Artan), `status` (Artan)
    - *Sorgu:* `src/app/(main)/profile/[userId]/page.tsx` ve `src/app/(main)/friends/page.tsx`
  - `status` (Artan), `fromUserId` (Artan), `toUserId` (Artan) (Arkadaşlık silindiğinde ilgili istekleri bulmak için)
    - *Sorgu:* `src/app/(main)/profile/[userId]/page.tsx` ve `src/app/(main)/friends/page.tsx`

## `posts`
Kullanıcıların paylaştığı gönderileri saklar.
- **Yol:** `/posts/{postId}`
- **Alanlar:**
  - `userId`, `username`, `userAvatar`, `authorIsPremium` (Boolean, isteğe bağlı), `content`, `createdAt`, `likeCount`, `commentCount`, `likedBy`, `sharedRoomId`, `sharedRoomName`, `isRepost`, `originalPostId`, `originalPostUserId`, `originalPostUsername`, `originalPostUserAvatar`, `originalPostAuthorIsPremium`, `originalPostContent`, `originalPostCreatedAt`, `originalPostSharedRoomId`, `originalPostSharedRoomName`
- **Alt Koleksiyonlar:**
  - `comments`: Yorumlar. Alanlar: `userId`, `username`, `userAvatar`, `commenterIsPremium` (Boolean, isteğe bağlı), `content`, `createdAt`
- **Gerekli İndeksler (Firestore Console üzerinden manuel oluşturulmalı):**
  - `posts` koleksiyonu için: `createdAt` (Azalan)
    - *Sorgu:* `src/app/page.tsx` (Ana akış için)
  - `posts` koleksiyonu için: `userId` (Artan), `createdAt` (Azalan)
    - *Sorgu:* `src/app/(main)/profile/[userId]/page.tsx` (Kullanıcı profili gönderileri için)

## `reports`
Kullanıcı şikayetlerini saklar.
- **Yol:** `/reports/{reportId}`
- **Alanlar:** `reporterId`, `reporterName`, `reportedUserId`, `reason`, `timestamp`, `status`
- **Gerekli İndeksler (Firestore Console üzerinden manuel oluşturulmalı):**
  - `reports` koleksiyonu için: `timestamp` (Azalan)
  - `reports` koleksiyonu için: `reportedUserId` (Artan), `status` (Artan)

## `appSettings`
Genel uygulama ayarlarını saklar.
- **Yol:** `/appSettings/gameConfig`
- **Alanlar (`gameConfig` için):** `isGameEnabled`, `questionIntervalSeconds`

## `gameQuestions`
Sohbet odası quiz oyunu için soruları saklar.
- **Yol:** `/gameQuestions/{questionId}`
- **Alanlar:** `text`, `answer`, `hint`, `createdAt`
- **Gerekli İndeksler (Firestore Console üzerinden manuel oluşturulmalı):**
  - `gameQuestions` koleksiyonu için: `createdAt` (Azalan)
    - *Sorgu:* `src/components/admin/sections/AdminGameSettingsContent.tsx`

## `matchmakingQueue`
Kullanıcıların 1v1 rastgele eşleşme için beklediği kuyruk.
- **Yol:** `/matchmakingQueue/{queueEntryId}`
- **Alanlar:**
  - `userId`: (String) Kuyruktaki kullanıcının UID'si.
  - `displayName`: (String, nullable) Kullanıcının görünen adı.
  - `photoURL`: (String, nullable) Kullanıcının avatar URL'si.
  - `gender`: (String, nullable) Kullanıcının cinsiyeti ('kadın', 'erkek', 'belirtilmemiş').
  - `joinedAt`: (Timestamp) Kullanıcının kuyruğa katıldığı zaman.
  - `status`: (String) Kullanıcının kuyruktaki durumu: 'waiting', 'matched', 'cancelled'.
  - `matchedWithUserId`: (String, nullable) Eğer eşleştiyse, eşleştiği kullanıcının UID'si.
  - `temporaryDmChatId`: (String, nullable) Eğer eşleştiyse, oluşturulan geçici DM sohbet odasının ID'si.
  - `matchSessionExpiresAt`: (Timestamp, nullable) Eğer eşleştiyse, geçici DM seansının sona erme zamanı.
- **Gerekli İndeksler (Firestore Console üzerinden manuel oluşturulmalı):**
  - `matchmakingQueue` koleksiyonu için: `status` (Artan), `joinedAt` (Artan), `userId` (Artan)
    - *Sorgu:* `src/app/(main)/match/page.tsx`

Bu dokümanın, uygulamanın Firebase Firestore veritabanını nasıl yapılandırdığı konusunda sana fikir vermesini umuyorum!
**Not:** İndeksler, sorgu performansını artırmak için gereklidir. Eğer Firestore konsolunda sorgu yaptığınızda "Bu sorgu için bir indeks gereklidir..." şeklinde bir uyarı alırsanız, genellikle bu uyarı üzerinden tek tıkla gerekli indeksi oluşturabilirsiniz.

**GÜVENLİK KURALLARI ÖRNEĞİ (Firestore Console -> Rules):**
\`\`\`javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isUserAdmin(userId) {
      return get(/databases/$(database)/documents/users/$(userId)).data.role == 'admin';
    }

    function isMessageOwner(messageId, pathPrefix) {
      let messageDoc = get(/databases/$(database)/documents/$(pathPrefix)/$(messageId));
      if (!messageDoc.exists()) { return false; }
      return request.auth.uid == messageDoc.data.senderId;
    }

    function canUpdateMessage(messageId, pathPrefix) {
      let messageDoc = get(/databases/$(database)/documents/$(pathPrefix)/$(messageId));
      if (!messageDoc.exists()) { return false; }
      let messageData = messageDoc.data;
      let requestData = request.resource.data; // Gelen yeni veri

      // Kural 1: Mesaj sahibi metin ve/veya tepkileri düzenleyebilir
      if (request.auth.uid == messageData.senderId) {
        let allowedKeysForOwner = ['text', 'editedAt', 'reactions'];
        let incomingKeys = requestData.keys();

        // Sadece izin verilen alanların güncellenip güncellenmediğini kontrol et
        let onlyAllowedKeysUpdated = true;
        for (let i=0; i < incomingKeys.size(); i=i+1) {
          if (!(incomingKeys[i] in allowedKeysForOwner)) {
            onlyAllowedKeysUpdated = false;
            break;
          }
        }
        if (!onlyAllowedKeysUpdated) {
          return false; // Sahibi olsa bile, izin verilmeyen bir alanı değiştirmeye çalışıyor
        }

        // 'text' güncelleniyorsa, 'editedAt' de güncellenmeli ve bir timestamp olmalı
        if (incomingKeys.has('text') &&
            (!(requestData.editedAt is timestamp) || (messageData.editedAt != null && requestData.editedAt <= messageData.editedAt))
           ) {
          return false;
        }
        // 'editedAt' güncelleniyorsa, bir timestamp olmalı ve eskisinden büyük olmalı (eğer eski varsa)
        if (incomingKeys.has('editedAt') &&
            (!(requestData.editedAt is timestamp) || (messageData.editedAt != null && requestData.editedAt <= messageData.editedAt))
           ) {
           return false;
        }

        // 'reactions' güncelleniyorsa, bir map olmalı
        if (incomingKeys.has('reactions') && !(requestData.reactions is map)) {
          return false;
        }

        // En az bir değişiklik olmalı (metin, tepki veya ilk kez editedAt ayarlanması)
        let textChanged = incomingKeys.has('text') && requestData.text != messageData.text;
        let reactionsChanged = incomingKeys.has('reactions') && requestData.reactions != messageData.reactions;
        // editedAt'in ilk kez ayarlanması veya ilerlemesi
        let editedAtIsNewerOrFirstTime = incomingKeys.has('editedAt') && (messageData.get('editedAt', null) == null || requestData.editedAt > messageData.get('editedAt', timestamp.min()));


        if (textChanged || reactionsChanged || editedAtIsNewerOrFirstTime) {
            // Eğer sadece editedAt güncelleniyorsa ve metin aynıysa, bu da geçerli bir düzenleme
            if (incomingKeys.hasOnly(['editedAt']) && editedAtIsNewerOrFirstTime) return true;
            if (incomingKeys.hasOnly(['text','editedAt']) && (textChanged || editedAtIsNewerOrFirstTime)) return true;
            if (incomingKeys.hasOnly(['reactions'])) return true; // Bu durum aşağıdaki genel reaction kuralına da girebilir
            if (incomingKeys.hasAll(['text','editedAt','reactions']) && (textChanged || reactionsChanged || editedAtIsNewerOrFirstTime)) return true;
            if (incomingKeys.hasAll(['text','editedAt']) && (textChanged || editedAtIsNewerOrFirstTime)) return true;
            if (incomingKeys.hasAll(['editedAt','reactions']) && (reactionsChanged || editedAtIsNewerOrFirstTime)) return true;
        }
        // Eğer sadece text değişmeden editedAt güncelleniyorsa (client engellemeli ama kural izin vermeli)
        if (incomingKeys.hasOnly(['editedAt']) && editedAtIsNewerOrFirstTime) return true;
      }

      // Kural 2: Giriş yapmış herhangi bir kullanıcı SADECE tepkileri güncelleyebilir
      if (request.auth.uid != null &&
          requestData.keys().hasOnly(['reactions']) &&
          requestData.reactions != messageData.reactions) { // Tepkilerin gerçekten değiştiğinden emin ol
        return true;
      }

      return false;
    }

    match /users/{userId} {
      allow read: if true;
      allow create: if request.auth.uid == userId;
      allow update: if request.auth.uid == userId || isUserAdmin(request.auth.uid);
      match /confirmedFriends/{friendId} {
        allow read, write: if request.auth.uid == userId;
      }
      match /blockedUsers/{blockedUserId} {
        allow read, write: if request.auth.uid == userId;
      }
    }

    match /chatRooms/{roomId} {
      allow read: if request.auth.uid != null;
      allow create: if request.auth.uid != null;
      allow update: if request.auth.uid != null && (
                      request.auth.uid == resource.data.creatorId ||
                      isUserAdmin(request.auth.uid) ||
                      request.resource.data.participantCount != resource.data.participantCount ||
                      request.resource.data.voiceParticipantCount != resource.data.voiceParticipantCount ||
                      request.resource.data.maxParticipants != resource.data.maxParticipants ||
                      request.resource.data.name != resource.data.name ||
                      request.resource.data.description != resource.data.description ||
                      request.resource.data.image != resource.data.image ||
                      request.resource.data.isGameEnabledInRoom != resource.data.isGameEnabledInRoom ||
                      request.resource.data.currentGameQuestionId != resource.data.currentGameQuestionId ||
                      request.resource.data.nextGameQuestionTimestamp != resource.data.nextGameQuestionTimestamp ||
                      request.resource.data.currentGameAnswerDeadline != resource.data.currentGameAnswerDeadline ||
                      request.resource.data.expiresAt != resource.data.expiresAt ||
                      request.resource.data.isActive != resource.data.isActive ||
                      request.resource.data.lastMessageAt != resource.data.lastMessageAt // eklendi
                    );
      allow delete: if request.auth.uid != null && (request.auth.uid == resource.data.creatorId || isUserAdmin(request.auth.uid));

      match /messages/{messageId} {
        allow read: if request.auth.uid != null;
        allow create: if request.auth.uid != null && request.resource.data.senderId == request.auth.uid;
        allow update(messageDoc): if request.auth.uid != null && canUpdateMessage(messageId, "chatRooms/" + roomId + "/messages");
        allow delete: if request.auth.uid != null && isMessageOwner(messageId, "chatRooms/" + roomId + "/messages");
      }
      match /participants/{participantId} {
        allow read: if request.auth.uid != null;
        allow create: if request.auth.uid == participantId;
        allow delete: if request.auth.uid == participantId || request.auth.uid == get(/databases/$(database)/documents/chatRooms/$(roomId)).data.creatorId;
      }
      match /voiceParticipants/{participantId} {
        allow read: if request.auth.uid != null;
        allow write: if request.auth.uid == participantId || request.auth.uid == get(/databases/$(database)/documents/chatRooms/$(roomId)).data.creatorId;
      }
      match /webrtcSignals/{userId}/{subcollection=**} {
        allow read, write: if request.auth.uid == userId;
      }
    }

    match /posts/{postId} {
      allow read: if request.auth.uid != null;
      allow create: if request.auth.uid == request.resource.data.userId;
      allow update: if request.auth.uid == resource.data.userId;
      allow delete: if request.auth.uid == resource.data.userId;

      match /comments/{commentId} {
        allow read: if request.auth.uid != null;
        allow create: if request.auth.uid == request.resource.data.userId;
        allow delete: if request.auth.uid == resource.data.userId;
      }
    }

    match /directMessages/{dmChatId} {
      allow read, write: if request.auth.uid in resource.data.participantUids || request.auth.uid in request.resource.data.participantUids;
      match /messages/{messageId} {
        allow read: if request.auth.uid in get(/databases/$(database)/documents/directMessages/$(dmChatId)).data.participantUids;
        allow create: if request.auth.uid == request.resource.data.senderId && request.auth.uid in get(/databases/$(database)/documents/directMessages/$(dmChatId)).data.participantUids;
        allow update(messageDoc): if request.auth.uid != null && canUpdateMessage(messageId, "directMessages/" + dmChatId + "/messages");
        allow delete: if request.auth.uid != null && isMessageOwner(messageId, "directMessages/" + dmChatId + "/messages");
      }
    }

    match /directCalls/{callId} {
      allow read, write: if request.auth.uid == resource.data.callerId || request.auth.uid == resource.data.calleeId;
       match /callerIceCandidates/{candidateId} {
         allow read, write: if request.auth.uid == get(/databases/$(database)/documents/directCalls/$(callId)).data.callerId;
       }
       match /calleeIceCandidates/{candidateId} {
         allow read, write: if request.auth.uid == get(/databases/$(database)/documents/directCalls/$(callId)).data.calleeId;
       }
    }

    match /friendRequests/{requestId} {
      allow read: if request.auth.uid == resource.data.fromUserId || request.auth.uid == resource.data.toUserId;
      allow create: if request.auth.uid == request.resource.data.fromUserId;
      allow update, delete: if request.auth.uid == resource.data.fromUserId || request.auth.uid == resource.data.toUserId;
    }

    match /appSettings/gameConfig {
      allow read: if request.auth.uid != null;
      allow write: if isUserAdmin(request.auth.uid);
    }

    match /gameQuestions/{questionId} {
      allow read: if request.auth.uid != null;
      allow write: if isUserAdmin(request.auth.uid);
    }

    match /reports/{reportId} {
      allow read, write: if isUserAdmin(request.auth.uid);
      allow create: if request.auth.uid == request.resource.data.reporterId;
    }

    match /matchmakingQueue/{queueEntryId} {
      allow read: if request.auth.uid != null;
      allow create: if request.auth.uid == request.resource.data.userId;
      allow update: if request.auth.uid == resource.data.userId || request.auth.uid == resource.data.matchedWithUserId; 
      allow delete: if request.auth.uid == resource.data.userId;
    }
  }
}
\`\`\`



