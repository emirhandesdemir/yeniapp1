"use client";

import React from 'react';
import AdminGameSettingsContent from "@/components/admin/sections/AdminGameSettingsContent";

export const dynamic = 'force-dynamic'; // Sayfanın dinamik olarak render edilmesini zorla

export default function AdminGameSettingsPage() {
  // Bu sayfa, AdminOverlayPanel içinde AdminGameSettingsContent komponentini kullanır.
  // Doğrudan /admin/game-settings adresine gidildiğinde de bu içerik gösterilir.
  // Ana yetkilendirme src/app/(admin)/layout.tsx tarafından yapılır.
  return <AdminGameSettingsContent />;
}
