
"use client";

import AdminProjectAssistantContent from "@/components/admin/sections/AdminProjectAssistantContent";

export default function AdminProjectAssistantPage() {
  // Bu sayfa, AdminOverlayPanel içinde AdminProjectAssistantContent komponentini kullanır.
  // Doğrudan /admin/project-assistant adresine gidildiğinde de bu içerik gösterilir.
  // Ana yetkilendirme src/app/(admin)/layout.tsx tarafından yapılır.
  return <AdminProjectAssistantContent />;
}
