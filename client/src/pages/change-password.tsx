import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/api";
import { useTranslation } from "@/i18n";
import { useErrorTranslation } from "@/lib/error-handler";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

// Create a function to generate the schema with translations
const createChangePasswordSchema = (t: (key: string) => string) => z.object({
  currentPassword: z.string().min(1, t('auth.currentPasswordRequired')),
  newPassword: z.string().min(6, t('auth.passwordRequirements')),
  confirmPassword: z.string().min(1, t('auth.confirmPasswordRequired')),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: t('auth.passwordsDontMatch'),
  path: ["confirmPassword"],
});

export default function ChangePasswordPage() {
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  const { t } = useTranslation();
  const { getErrorMessage } = useErrorTranslation();

  // Create the schema with translations
  const changePasswordSchema = createChangePasswordSchema(t);
  type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordFormValues) => {
      console.log("Sending change password request:", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      });

      return apiRequest("/api/auth/change-password", {
        method: "POST",
        body: {
          currentPassword: data.currentPassword,
          newPassword: data.newPassword
        },
      });
    },
    onSuccess: () => {
      toast({
        title: t('auth.passwordChanged'),
        description: t('auth.passwordChangedDescription'),
        variant: "success",
        duration: 5000, // Show for 5 seconds
      });

      // Add a small delay before redirecting to ensure the toast is visible
      setTimeout(() => {
        navigate("/");
      }, 1000);
    },
    onError: (error) => {
      const errorMessage = getErrorMessage(error);
      toast({
        title: t('common.error'),
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: ChangePasswordFormValues) {
    changePasswordMutation.mutate(data);
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[400px]">
        <CardHeader className="bg-primary dark:bg-primary text-white rounded-t-lg">
          <CardTitle>{t('auth.changePassword')}</CardTitle>
          <CardDescription className="text-white/80">{t('auth.changePasswordDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.currentPassword')}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={t('auth.currentPasswordPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.newPassword')}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={t('auth.newPasswordPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.confirmPassword')}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={t('auth.confirmPasswordPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full bg-primary text-white hover:bg-primary/90"
                disabled={changePasswordMutation.isPending}
              >
                {changePasswordMutation.isPending ? t('auth.updating') : t('auth.updatePassword')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}