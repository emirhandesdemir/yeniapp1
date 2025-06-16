
"use client";

import AdminChatRoomsContent from "@/components/admin/sections/AdminChatRoomsContent";

export default function AdminChatRoomsPage() {
  // Bu sayfa, AdminOverlayPanel içinde AdminChatRoomsContent komponentini kullanır.
  // Doğrudan /admin/chat-rooms adresine gidildiğinde de bu içerik gösterilir.
  // Ana yetkilendirme src/app/(admin)/layout.tsx tarafından yapılır.
  return <AdminChatRoomsContent />;
}
