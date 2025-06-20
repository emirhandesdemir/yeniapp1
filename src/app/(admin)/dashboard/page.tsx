"use client";

import React from 'react';
import AdminDashboardContent from "@/components/admin/sections/AdminDashboardContent";

export const dynamic = 'force-dynamic'; // Sayfanın dinamik olarak render edilmesini zorla

export default function AdminDashboardPage() {
  // Bu sayfa, AdminOverlayPanel içinde AdminDashboardContent komponentini kullanır.
  // Doğrudan /admin/dashboard adresine gidildiğinde de bu içerik gösterilir.
  // Ana yetkilendirme src/app/(admin)/layout.tsx tarafından yapılır.
  return <AdminDashboardContent />;
}
