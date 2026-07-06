import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useTranslation } from "@/i18n";
import { useErrorTranslation } from "@/lib/error-handler";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/components/ui/use-toast";
import { Logo } from "@/components/logo";

const createResetPasswordSchema = (t: (key: string) => string) => z.object({
  newPassword: z.string().min(8, t('auth.passwordTooShort')),
});

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { getErrorMessage } = useErrorTranslation();
  const [_, navigate] = useLocation();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") || "";
  const [done, setDone] = useState(false);

  const schema = createResetPasswordSchema(t);
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) => apiRequest("/api/auth/reset-password", { method: "POST", body: { token, newPassword: data.newPassword } }),
    onSuccess: () => setDone(true),
    onError: (error) => {
      toast({ title: t('auth.resetPasswordFailed'), description: getErrorMessage(error), variant: "destructive" });
    },
  });

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[350px]">
        <CardHeader className="text-center bg-primary dark:bg-primary text-white rounded-t-lg">
          <div className="flex flex-col items-center">
            <Logo size={60} color="white" />
            <CardTitle className="mt-2">Filadex</CardTitle>
            <CardDescription className="text-white/80">{t('auth.resetPasswordDescription')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {!token ? (
            <p className="text-center text-destructive">{t('auth.resetPasswordInvalidLink')}</p>
          ) : done ? (
            <div className="text-center space-y-4">
              <p>{t('auth.resetPasswordSuccess')}</p>
              <Button className="w-full" onClick={() => navigate("/login")}>{t('auth.backToLogin')}</Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.newPassword')}</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder={t('auth.passwordPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full bg-primary text-white hover:bg-primary/90" disabled={mutation.isPending}>
                  {mutation.isPending ? t('auth.resettingPassword') : t('auth.resetPassword')}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
