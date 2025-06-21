
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, query, writeBatch, where } from "firebase/firestore";

/**
 * Bir sohbet odasını ve içindeki tüm mesajlar ile katılımcıları Firestore'dan siler.
 * @param roomId Silinecek sohbet odasının ID'si.
 * @returns Silme işlemi başarılı olursa Promise<void>, hata olursa Promise<reject>.
 */
export const deleteChatRoomAndSubcollections = async (roomId: string): Promise<void> => {
  const batch = writeBatch(db);
  const roomDocRef = doc(db, "chatRooms", roomId);

  try {
    const subcollectionsToDelete = ['messages', 'participants', 'voiceParticipants', 'activeChest'];

    for (const subcollectionName of subcollectionsToDelete) {
        const subcollectionRef = collection(db, `chatRooms/${roomId}/${subcollectionName}`);
        const snapshot = await getDocs(subcollectionRef);
        snapshot.forEach(doc => batch.delete(doc.ref));
    }
    
    // webrtcSignals'ın temizlenmesi, istemci tarafında tüm katılımcı ID'lerini almayı gerektireceği için
    // karmaşıktır. Bu geçici sinyallerin yetim kalması şimdilik kabul edilebilir. 
    // Tam bir temizlik için bir Cloud Function daha uygun olur.

    // Ana odayı sil
    batch.delete(roomDocRef);

    await batch.commit();
  } catch (error) {
    console.error("Error deleting chat room and its subcollections:", error);
    // Hatanın çağrıldığı yere iletilmesi için rethrow yapıyoruz.
    // Böylece çağıran fonksiyon (örn: toast mesajı göstermek için) hatayı yakalayabilir.
    throw error;
  }
};


/**
 * Bir kullanıcıyı, oluşturduğu tüm gönderileri ve sohbet odalarıyla birlikte Firestore'dan siler.
 * @param userId Silinecek kullanıcının ID'si.
 */
export const deleteUserAndTheirContent = async (userId: string): Promise<void> => {
  try {
    // 1. Delete user's posts and their comments
    const postsQuery = query(collection(db, "posts"), where("userId", "==", userId));
    const postsSnap = await getDocs(postsQuery);
    const postBatch = writeBatch(db);
    for (const postDoc of postsSnap.docs) {
      const commentsRef = collection(db, `posts/${postDoc.id}/comments`);
      const commentsSnap = await getDocs(commentsRef);
      commentsSnap.forEach(commentDoc => postBatch.delete(commentDoc.ref));
      postBatch.delete(postDoc.ref);
    }
    await postBatch.commit();

    // 2. Delete chat rooms created by the user (this must be done sequentially, not in a batch)
    const roomsQuery = query(collection(db, "chatRooms"), where("creatorId", "==", userId));
    const roomsSnap = await getDocs(roomsQuery);
    for (const roomDoc of roomsSnap.docs) {
      await deleteChatRoomAndSubcollections(roomDoc.id);
    }

    // 3. Delete user's subcollections and main document in a new batch
    const userBatch = writeBatch(db);
    const friendsRef = collection(db, `users/${userId}/confirmedFriends`);
    const friendsSnap = await getDocs(friendsRef);
    friendsSnap.forEach(friendDoc => userBatch.delete(friendDoc.ref));

    const blockedRef = collection(db, `users/${userId}/blockedUsers`);
    const blockedSnap = await getDocs(blockedRef);
    blockedSnap.forEach(blockedDoc => userBatch.delete(blockedDoc.ref));

    const userRef = doc(db, "users", userId);
    userBatch.delete(userRef);
    
    await userBatch.commit();
    
    // Note: This does not remove the user from other people's friend lists
    // or their messages/comments in rooms/posts they don't own. 
    // A more robust solution would require Cloud Functions.

  } catch (error) {
    console.error(`Error deleting user ${userId} and their content:`, error);
    throw error;
  }
};
