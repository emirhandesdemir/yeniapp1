
"use client";

import React from "react"; // React importunun varlığı kontrol edildi
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { User, Mail, Lock, Loader2, VenetianMask, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
    <path d="M17.6402 9.18199C17.6402 8.54562 17.5834 7.93617 17.4779 7.35364H9V10.8002H13.8438C13.6365 11.9702 13.0002 12.9275 12.0479 13.5638V15.8184H14.9565C16.6584 14.2529 17.6402 11.9456 17.6402 9.18199Z" fill="#4285F4"/>
    <path d="M9.00001 18C11.4302 18 13.4675 17.1947 14.9565 15.8183L12.0479 13.5638C11.2584 14.1247 10.2256 14.4547 9.00001 14.4547C6.65565 14.4547 4.67196 12.8365 3.96424 10.682H1.00012V13.001C2.47651 15.9356 5.48924 18 9.00001 18Z" fill="#34A853"/>
    <path d="M3.96423 10.6819C3.78289 10.121 3.67652 9.53015 3.67652 8.91806C3.67652 8.306 3.78289 7.71515 3.96423 7.15423V4.83523H1.00012C0.372891 6.04148 0 7.43015 0 8.91806C0 10.406 0.372891 11.7947 1.00012 13.0009L3.96423 10.6819Z" fill="#FBBC05"/>
    <path d="M9.00001 3.38159C10.3211 3.38159 11.5079 3.84977 12.4406 4.74562L15.0219 2.19477C13.4601 0.823302 11.4229 0 9.00001 0C5.48924 0 2.47651 2.06436 1.00012 4.99891L3.96424 7.31791C4.67196 5.00055 6.65565 3.38159 9.00001 3.38159Z" fill="#EA4335"/>
  </svg>
);

const formSchema = z.object({
  username: z.string().min(3, { message: "Kullanıcı adı en az 3 karakter olmalıdır." }).max(30, { message: "Kullanıcı adı en fazla 30 karakter olabilir."}),
  email: z.string().email({ message: "Geçerli bir e-posta adresi girin." }),
  password: z.string().min(6, { message: "Şifre en az 6 karakter olmalıdır." }),
  gender: z.enum(["kadın", "erkek"], { required_error: "Lütfen cinsiyetinizi seçin." }),
});

export default function SignupForm() {
  const { signUp, signInWithGoogle, isUserLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      gender: undefined, 
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!recaptchaSiteKey) {
      toast({ title: "reCAPTCHA Hatası", description: "reCAPTCHA site anahtarı yapılandırılmamış.", variant: "destructive"});
      await signUp(values.email, values.password, values.username, values.gender);
      return;
    }

    if (typeof grecaptcha === 'undefined' || typeof grecaptcha.enterprise === 'undefined') {
      toast({ title: "reCAPTCHA Hatası", description: "reCAPTCHA yüklenemedi. Lütfen sayfayı yenileyin.", variant: "destructive" });
      await signUp(values.email, values.password, values.username, values.gender);
      return;
    }

    grecaptcha.enterprise.ready(async () => {
      try {
        const token = await grecaptcha.enterprise.execute(recaptchaSiteKey, { action: 'SIGNUP' });
        console.log("reCAPTCHA token (Signup):", token);
        // TODO: Bu 'token'ı ve 'values' bilgilerini
        // kendi backend'inize gönderip reCAPTCHA token'ını doğrulatın.
        // Sadece doğrulama başarılı olursa Firebase signUp çağrılmalıdır.
        // Bu prototipte backend doğrulama adımı atlanmıştır.
        await signUp(values.email, values.password, values.username, values.gender);
      } catch (error) {
        console.error("reCAPTCHA execute error (Signup):", error);
        toast({ title: "reCAPTCHA Doğrulama Hatası", description: "Güvenlik doğrulaması başarısız oldu.", variant: "destructive" });
        // İsteğe bağlı: reCAPTCHA başarısız olursa signup işlemini durdur
        // return;
      }
    });
  }

  const handleGoogleSignUp = async () => {
    if (!recaptchaSiteKey) {
      toast({ title: "reCAPTCHA Hatası", description: "reCAPTCHA site anahtarı yapılandırılmamış.", variant: "destructive"});
      await signInWithGoogle();
      return;
    }
    if (typeof grecaptcha === 'undefined' || typeof grecaptcha.enterprise === 'undefined') {
      toast({ title: "reCAPTCHA Hatası", description: "reCAPTCHA yüklenemedi. Lütfen sayfayı yenileyin.", variant: "destructive" });
      await signInWithGoogle();
      return;
    }
    grecaptcha.enterprise.ready(async () => {
      try {
        const token = await grecaptcha.enterprise.execute(recaptchaSiteKey, { action: 'SIGNUP_GOOGLE' });
        console.log("reCAPTCHA token (Google Sign Up):", token);
        // TODO: Bu token'ı backend'e gönderip doğrulatın.
        await signInWithGoogle();
      } catch (error) {
        console.error("reCAPTCHA execute error (Google Sign Up):", error);
        toast({ title: "reCAPTCHA Doğrulama Hatası", description: "Güvenlik doğrulaması başarısız oldu.", variant: "destructive" });
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kullanıcı Adı</FormLabel>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <FormControl>
                  <Input placeholder="kullanici_adi" {...field} className="pl-10" disabled={isUserLoading} />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-posta</FormLabel>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <FormControl>
                  <Input placeholder="ornek@mail.com" {...field} className="pl-10" disabled={isUserLoading} />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Şifre</FormLabel>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <FormControl>
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••" 
                    {...field} 
                    className="pl-10 pr-10" 
                    disabled={isUserLoading} 
                  />
                </FormControl>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  <span className="sr-only">{showPassword ? "Şifreyi gizle" : "Şifreyi göster"}</span>
                </Button>
              </div>
              <FormDescription className="text-xs pt-1">
                Güçlü bir şifre için: En az 6 karakter, büyük/küçük harf, sayı ve sembol (!@#% gibi) kullanın.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel className="flex items-center gap-2"><VenetianMask className="h-5 w-5 text-muted-foreground" /> Cinsiyet</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4"
                  disabled={isUserLoading}
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="kadın" />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Kadın
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="erkek" />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Erkek
                    </FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isUserLoading}>
          {isUserLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Kayıt Ol
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Veya
            </span>
          </div>
        </div>

        <Button 
          type="button" 
          variant="outline" 
          className="w-full" 
          onClick={handleGoogleSignUp} 
          disabled={isUserLoading}
        >
          {isUserLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          Google ile Kayıt Ol
        </Button>
      </form>
    </Form>
  );
}
