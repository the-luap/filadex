import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Logo } from "@/components/logo";

const createForgotPasswordSchema = (t: (key: string) => string) => z.object({
  email: z.string().email(t('auth.emailInvalid')),
});

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);

  const schema = createForgotPasswordSchema(t);
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) => apiRequest("/api/auth/forgot-password", { method: "POST", body: data }),
    onSuccess: () => setSubmitted(true),
    onError: () => setSubmitted(true), // same generic outcome either way - don't leak account existence
  });

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[350px]">
        <CardHeader className="text-center bg-primary dark:bg-primary text-white rounded-t-lg">
          <div className="flex flex-col items-center">
            <Logo size={60} color="white" />
            <CardTitle className="mt-2">Filadex</CardTitle>
            <CardDescription className="text-white/80">{t('auth.forgotPasswordDescription')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {submitted ? (
            <div className="text-center space-y-4">
              <p>{t('auth.forgotPasswordSuccess')}</p>
              <a href="/login" className="text-sm text-muted-foreground hover:underline">{t('auth.backToLogin')}</a>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
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
                <Button type="submit" className="w-full bg-primary text-white hover:bg-primary/90" disabled={mutation.isPending}>
                  {mutation.isPending ? t('auth.sending') : t('auth.sendResetLink')}
                </Button>
                <div className="text-center text-sm">
                  <a href="/login" className="text-muted-foreground hover:underline">{t('auth.backToLogin')}</a>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
