
"use client"
// Bu Sidebar komponenti ve ilgili tüm alt komponentler (SidebarProvider, SidebarTrigger vb.)
// mevcut alt navigasyon ve minimal üst bar tasarımına geçildiği için artık kullanılmamaktadır.
// Proje yapısını temiz tutmak ve olası karışıklıkları önlemek amacıyla içeriği boşaltılmıştır.
// Firebase Studio'da dosya silemediğimiz için bu şekilde bir not bırakıyoruz.
// İleride farklı bir sidebar ihtiyacı doğarsa, bu dosya yeniden düzenlenebilir veya silinebilir.

import * as React from "react";

const PlaceholderSidebarComponent = () => {
  return (
    <div>
      {/* Bu Sidebar komponenti artık kullanılmıyor. */}
    </div>
  );
};

export const Sidebar = PlaceholderSidebarComponent;
export const SidebarProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const SidebarTrigger = () => null;
export const SidebarRail = () => null;
export const SidebarInset = ({ children }: { children: React.ReactNode }) => <main>{children}</main>;
export const SidebarInput = () => null;
export const SidebarHeader = () => null;
export const SidebarFooter = () => null;
export const SidebarSeparator = () => null;
export const SidebarContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
export const SidebarGroup = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
export const SidebarGroupLabel = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
export const SidebarGroupAction = () => null;
export const SidebarGroupContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
export const SidebarMenu = ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>;
export const SidebarMenuItem = ({ children }: { children: React.ReactNode }) => <li>{children}</li>;
export const SidebarMenuButton = ({ children }: { children: React.ReactNode }) => <button>{children}</button>;
export const SidebarMenuAction = () => null;
export const SidebarMenuBadge = () => null;
export const SidebarMenuSkeleton = () => null;
export const SidebarMenuSub = ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>;
export const SidebarMenuSubItem = ({ children }: { children: React.ReactNode }) => <li>{children}</li>;
export const SidebarMenuSubButton = ({ children }: { children: React.ReactNode }) => <button>{children}</button>;

export function useSidebar() {
  return {
    state: "collapsed" as "expanded" | "collapsed",
    open: false,
    setOpen: () => {},
    openMobile: false,
    setOpenMobile: () => {},
    isMobile: false,
    toggleSidebar: () => {},
  };
}
