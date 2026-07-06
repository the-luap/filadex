import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useTranslation } from "@/i18n";
import { useErrorTranslation } from "@/lib/error-handler";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/components/ui/use-toast";
import { Logo } from "@/components/logo";
import { Check, X } from "lucide-react";

const createRegisterSchema = (t: (key: string) => string) => z.object({
  username: z.string()
    .min(3, t('auth.usernameTooShort'))
    .max(30, t('auth.usernameTooLong'))
    .regex(/^[a-zA-Z0-9_-]+$/, t('auth.usernameInvalidChars')),
  email: z.string().email(t('auth.emailInvalid')),
  password: z.string().min(8, t('auth.passwordTooShort')),
});

// Debounce a changing value; used to avoid firing the availability check on every keystroke.
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function RegisterPage() {
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  const { t } = useTranslation();
  const { getErrorMessage } = useErrorTranslation();
  const [submitted, setSubmitted] = useState(false);

  const registerSchema = createRegisterSchema(t);
  type RegisterFormValues = z.infer<typeof registerSchema>;

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "" },
  });

  const usernameValue = form.watch("username");
  const debouncedUsername = useDebouncedValue(usernameValue, 400);

  const { data: usernameCheck } = useQuery({
    queryKey: ["/api/auth/check-username", debouncedUsername],
    queryFn: () => apiRequest<{ available: boolean }>(`/api/auth/check-username?username=${encodeURIComponent(debouncedUsername)}`),
    enabled: debouncedUsername.length >= 3,
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormValues) => {
      return apiRequest<{ message: string }>("/api/auth/register", {
        method: "POST",
        body: data,
      });
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error) => {
      const errorMessage = getErrorMessage(error);
      toast({ title: t('auth.registerFailed'), description: errorMessage, variant: "destructive" });
    },
  });

  function onSubmit(data: RegisterFormValues) {
    registerMutation.mutate(data);
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-[380px]">
          <CardHeader className="text-center bg-primary dark:bg-primary text-white rounded-t-lg">
            <div className="flex flex-col items-center">
              <Logo size={60} color="white" />
              <CardTitle className="mt-2">Filadex</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 text-center space-y-4">
            <p>{t('auth.registerSuccessCheckEmail')}</p>
            <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
              {t('auth.backToLogin')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[380px]">
        <CardHeader className="text-center bg-primary dark:bg-primary text-white rounded-t-lg">
          <div className="flex flex-col items-center">
            <Logo size={60} color="white" />
            <CardTitle className="mt-2">Filadex</CardTitle>
            <CardDescription className="text-white/80">{t('auth.registerDescription')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.username')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input placeholder={t('auth.usernamePlaceholder')} {...field} />
                        {debouncedUsername.length >= 3 && usernameCheck && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2">
                            {usernameCheck.available ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <X className="h-4 w-4 text-destructive" />
                            )}
                          </span>
                        )}
                      </div>
                    </FormControl>
                    {debouncedUsername.length >= 3 && usernameCheck && !usernameCheck.available && (
                      <p className="text-sm text-destructive">{t('auth.usernameTaken')}</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.email')}</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder={t('auth.emailPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.password')}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={t('auth.passwordPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full bg-primary text-white hover:bg-primary/90"
                disabled={registerMutation.isPending || (!!usernameCheck && !usernameCheck.available)}
              >
                {registerMutation.isPending ? t('auth.registering') : t('auth.createAccount')}
              </Button>
            </form>
          </Form>
          <div className="text-center text-sm mt-4">
            <a href="/login" className="text-muted-foreground hover:underline">{t('auth.backToLogin')}</a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
