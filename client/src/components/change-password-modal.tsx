import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useTranslation } from "@/i18n";
import { useErrorTranslation } from "@/lib/error-handler";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/components/ui/use-toast";

// Create a function to generate the schema with translations
const createPasswordFormSchema = (t: (key: string) => string) => z.object({
  currentPassword: z.string().min(1, t('auth.currentPasswordRequired')),
  newPassword: z.string().min(6, t('auth.passwordRequirements')),
  confirmPassword: z.string().min(6, t('auth.confirmPasswordRequired')),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: t('auth.passwordsDontMatch'),
  path: ["confirmPassword"],
});

export function ChangePasswordModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { getErrorMessage } = useErrorTranslation();

  // Create the schema with translations
  const passwordFormSchema = createPasswordFormSchema(t);
  type PasswordFormValues = z.infer<typeof passwordFormSchema>;

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormValues) => {
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
      form.reset();
      onOpenChange(false);
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

  function onSubmit(data: PasswordFormValues) {
    changePasswordMutation.mutate(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{t('auth.changePassword')}</DialogTitle>
        </DialogHeader>
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
                  <FormMessage className="text-red-500" />
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
                  <FormMessage className="text-red-500" />
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
                  <FormMessage className="text-red-500" />
                </FormItem>
              )}
            />
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? t('auth.updating') : t('auth.updatePassword')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
