
"use client";

import AdminUsersContent from "@/components/admin/sections/AdminUsersContent";

export default function AdminUsersPage() {
  // Bu sayfa, AdminOverlayPanel içinde AdminUsersContent komponentini kullanır.
  // Doğrudan /admin/users adresine gidildiğinde de bu içerik gösterilir.
  // Ana yetkilendirme src/app/(admin)/layout.tsx tarafından yapılır.
  return <AdminUsersContent />;
}
