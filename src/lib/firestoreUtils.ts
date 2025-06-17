
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, query, writeBatch } from "firebase/firestore";

/**
 * Bir sohbet odasını ve içindeki tüm mesajlar ile katılımcıları Firestore'dan siler.
 * @param roomId Silinecek sohbet odasının ID'si.
 * @returns Silme işlemi başarılı olursa Promise<void>, hata olursa Promise<reject>.
 */
export const deleteChatRoomAndSubcollections = async (roomId: string): Promise<void> => {
  const batch = writeBatch(db);

  try {
    // Mesajları sil (text chat)
    const messagesRef = collection(db, `chatRooms/${roomId}/messages`);
    const messagesSnap = await getDocs(messagesRef);
    messagesSnap.forEach(msgDoc => batch.delete(msgDoc.ref));

    // Katılımcıları sil (text chat)
    const participantsRef = collection(db, `chatRooms/${roomId}/participants`);
    const participantsSnap = await getDocs(participantsRef);
    participantsSnap.forEach(partDoc => batch.delete(partDoc.ref));

    // Sesli sohbet katılımcılarını sil
    const voiceParticipantsRef = collection(db, `chatRooms/${roomId}/voiceParticipants`);
    const voiceParticipantsSnap = await getDocs(voiceParticipantsRef);
    voiceParticipantsSnap.forEach(voicePartDoc => batch.delete(voicePartDoc.ref));
    
    // Ana odayı sil
    const roomDocRef = doc(db, "chatRooms", roomId);
    batch.delete(roomDocRef);

    await batch.commit();
  } catch (error) {
    console.error("Error deleting chat room and its subcollections:", error);
    // Hatanın çağrıldığı yere iletilmesi için rethrow yapıyoruz.
    // Böylece çağıran fonksiyon (örn: toast mesajı göstermek için) hatayı yakalayabilir.
    throw error;
  }
};
