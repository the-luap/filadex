import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { useErrorTranslation } from "@/lib/error-handler";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/components/ui/use-toast";
import { Logo } from "@/components/logo";

// Create a function to generate the schema with translations
const createLoginSchema = (t: (key: string) => string) => z.object({
  username: z.string().min(1, t('auth.usernameRequired')),
  password: z.string().min(1, t('auth.passwordRequired')),
});

export default function LoginPage() {
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  const { login } = useAuth();
  const { t } = useTranslation();
  const { getErrorMessage } = useErrorTranslation();

  // Create the schema with translations
  const loginSchema = createLoginSchema(t);
  type LoginFormValues = z.infer<typeof loginSchema>;

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormValues) => {
      return apiRequest<{ user: any; forceChangePassword: boolean }>("/api/auth/login", {
        method: "POST",
        body: data, // Don't stringify here, apiRequest will do it
      });
    },
    onSuccess: (data) => {
      console.log("Login successful:", data);
      login(data.user);

      // Add a small delay to ensure the auth state is updated
      setTimeout(() => {
        if (data.forceChangePassword) {
          toast({
            title: t('auth.passwordChangeRequired'),
            description: t('auth.forceChangePassword'),
          });
          navigate("/change-password");
        } else {
          navigate("/");
        }
      }, 100);
    },
    onError: (error) => {
      console.error("Login error:", error);
      const errorMessage = getErrorMessage(error);

      toast({
        title: t('auth.loginFailed'),
        description: errorMessage,
        variant: "destructive",
      });

      // Show error message in the form
      form.setError("password", {
        type: "manual",
        message: errorMessage
      });
    },
  });

  function onSubmit(data: LoginFormValues) {
    loginMutation.mutate(data);
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[350px]">
        <CardHeader className="text-center bg-primary dark:bg-primary text-white rounded-t-lg">
          <div className="flex flex-col items-center">
            <Logo size={60} color="white" />
            <CardTitle className="mt-2">Filadex</CardTitle>
            <CardDescription className="text-white/80">{t('auth.loginDescription')}</CardDescription>
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
                      <Input placeholder={t('auth.usernamePlaceholder')} {...field} />
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
                    <FormMessage className="text-red-500" />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-primary text-white hover:bg-primary/90" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? t('auth.loggingIn') : t('auth.login')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}