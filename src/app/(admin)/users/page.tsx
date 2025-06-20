"use client";

import React from 'react';
import AdminUsersContent from "@/components/admin/sections/AdminUsersContent";

export const dynamic = 'force-dynamic'; // Sayfanın dinamik olarak render edilmesini zorla

export default function AdminUsersPage() {
  // Bu sayfa, AdminOverlayPanel içinde AdminUsersContent komponentini kullanır.
  // Doğrudan /admin/users adresine gidildiğinde de bu içerik gösterilir.
  // Ana yetkilendirme src/app/(admin)/layout.tsx tarafından yapılır.
  return <AdminUsersContent />;
}
