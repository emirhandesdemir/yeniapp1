
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-4">
          <ShieldCheck className="h-10 w-10 text-primary" />
          <div>
            <CardTitle className="text-3xl font-headline text-primary-foreground/90">Admin Paneli</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              Hoş geldiniz! Buradan uygulama ayarlarını yönetebilirsiniz.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Sol taraftaki menüden veya ileride eklenecek alt menülerden istediğiniz bölüme ulaşabilirsiniz.
          </p>
        </CardContent>
      </Card>

      {/* Gelecekte buraya admin paneli bileşenleri (özet kartları, hızlı eylemler vb.) eklenecek */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Kullanıcı Yönetimi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Kullanıcıları görüntüle, düzenle ve yönet.</p>
            {/* <Button className="mt-4">Kullanıcılara Git</Button> */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Özellik Ayarları</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Uygulama özelliklerini aç/kapat.</p>
            {/* <Button className="mt-4">Özelliklere Git</Button> */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>İçerik Yönetimi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Sohbet odalarını ve diğer içerikleri yönet.</p>
            {/* <Button className="mt-4">İçeriklere Git</Button> */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
