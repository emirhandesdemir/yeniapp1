
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Mail, Lock, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
// import { useState } from "react"; // Artık AuthContext'teki isUserLoading kullanılıyor

// Google ikonu için basit bir SVG
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
    <path d="M17.6402 9.18199C17.6402 8.54562 17.5834 7.93617 17.4779 7.35364H9V10.8002H13.8438C13.6365 11.9702 13.0002 12.9275 12.0479 13.5638V15.8184H14.9565C16.6584 14.2529 17.6402 11.9456 17.6402 9.18199Z" fill="#4285F4"/>
    <path d="M9.00001 18C11.4302 18 13.4675 17.1947 14.9565 15.8183L12.0479 13.5638C11.2584 14.1247 10.2256 14.4547 9.00001 14.4547C6.65565 14.4547 4.67196 12.8365 3.96424 10.682H1.00012V13.001C2.47651 15.9356 5.48924 18 9.00001 18Z" fill="#34A853"/>
    <path d="M3.96423 10.6819C3.78289 10.121 3.67652 9.53015 3.67652 8.91806C3.67652 8.306 3.78289 7.71515 3.96423 7.15423V4.83523H1.00012C0.372891 6.04148 0 7.43015 0 8.91806C0 10.406 0.372891 11.7947 1.00012 13.0009L3.96423 10.6819Z" fill="#FBBC05"/>
    <path d="M9.00001 3.38159C10.3211 3.38159 11.5079 3.84977 12.4406 4.74562L15.0219 2.19477C13.4601 0.823302 11.4229 0 9.00001 0C5.48924 0 2.47651 2.06436 1.00012 4.99891L3.96424 7.31791C4.67196 5.00055 6.65565 3.38159 9.00001 3.38159Z" fill="#EA4335"/>
  </svg>
);


const formSchema = z.object({
  email: z.string().email({ message: "Geçerli bir e-posta adresi girin." }),
  password: z.string().min(6, { message: "Şifre en az 6 karakter olmalıdır." }),
});

export default function LoginForm() {
  const { logIn, signInWithGoogle, isUserLoading } = useAuth(); // signInWithGoogle eklendi
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    await logIn(values.email, values.password);
    // Toast ve yönlendirme AuthContext içinde hallediliyor
  }

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
    // Toast ve yönlendirme AuthContext içinde hallediliyor
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                  <Input type="password" placeholder="••••••" {...field} className="pl-10" disabled={isUserLoading} />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isUserLoading}>
          {isUserLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Giriş Yap
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
          onClick={handleGoogleSignIn} 
          disabled={isUserLoading}
        >
          {isUserLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          Google ile Giriş Yap
        </Button>
      </form>
    </Form>
  );
}
