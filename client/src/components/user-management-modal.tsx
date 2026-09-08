import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useTranslation } from "@/i18n";
import { useErrorTranslation } from "@/lib/error-handler";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Edit, UserPlus, User as UserIcon } from "lucide-react";

// Create a function to generate the schema with translations.
// The username rules mirror usernameSchema in shared/schema.ts, which both
// /api/users endpoints apply - a form that accepts more than the server does
// turns a field-level message into an untranslated toast.
//
// `heldUsername` is the name the edited user already has, and is exempt from
// those rules, because PUT /api/users/:id exempts it: an upgraded install may
// hold a name the rules now refuse, from before either endpoint validated
// anything, and this form prefills the username. Without the exemption, editing
// such a user at all would fail on a field nobody touched. Typing any other
// name, recasing included, is checked - matching what the endpoint will do.
const createUserFormSchema = (t: (key: string) => string, heldUsername?: string) => z.object({
  username: z.string().superRefine((value, ctx) => {
    if (value === heldUsername) return;
    const rules = z.string()
      .min(3, t('users.usernameMinLength'))
      .max(30, t('auth.usernameTooLong'))
      .regex(/^[a-zA-Z0-9_-]+$/, t('auth.usernameInvalidChars'));
    const result = rules.safeParse(value);
    if (!result.success) {
      for (const issue of result.error.errors) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue.message });
      }
    }
  }),
  password: z.string().min(8, t('auth.passwordTooShort')).optional(),
  isAdmin: z.boolean().default(false),
  forceChangePassword: z.boolean().default(true),
});

export function UserManagementModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { getErrorMessage } = useErrorTranslation();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("users");

  // Create the schema with translations
  const userFormSchema = createUserFormSchema(t, editingUser?.username);
  type UserFormValues = z.infer<typeof userFormSchema>;

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiRequest("/api/users"),
    enabled: open,
  });

  const { data: systemSettings, isLoading: isLoadingSettings } = useQuery<{ registrationEnabled: boolean }>({
    queryKey: ["/api/settings/system"],
    queryFn: () => apiRequest<{ registrationEnabled: boolean }>("/api/settings/system"),
    enabled: open,
  });

  const toggleRegistrationMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest("/api/settings/system", {
        method: "PUT",
        body: { registrationEnabled: enabled },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/system"] });
      queryClient.invalidateQueries({ queryKey: ["/api/system/public-settings"] });
      toast({
        title: t('common.success'),
        description: t('users.updateSuccess'),
        variant: "success",
      });
    },
    onError: (error: any) => {
      const errorMessage = getErrorMessage(error);
      toast({
        title: t('common.error'),
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      password: "",
      isAdmin: false,
      forceChangePassword: true,
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (data: UserFormValues) => {
      return apiRequest("/api/users", {
        method: "POST",
        body: data, // Let apiRequest handle the JSON serialization
      });
    },
    onSuccess: () => {
      toast({
        title: t('common.success'),
        description: t('users.createSuccess'),
        variant: "success",
        duration: 5000
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      resetForm();
      setActiveTab("users");
    },
    onError: (error: any) => {
      console.error("Create user error:", error);
      const errorMessage = getErrorMessage(error);

      toast({
        title: t('common.error'),
        description: errorMessage,
        variant: "destructive",
        duration: 5000
      });

      // If username already exists, set form error
      if (errorMessage.includes(t('errors.api.usernameExists'))) {
        form.setError("username", {
          type: "manual",
          message: t('errors.api.usernameExists')
        });
      }
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<UserFormValues> }) => {
      return apiRequest(`/api/users/${id}`, {
        method: "PUT",
        body: data, // Let apiRequest handle the JSON serialization
      });
    },
    onSuccess: () => {
      toast({
        title: t('common.success'),
        description: t('users.updateSuccess'),
        variant: "success",
        duration: 5000
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      resetForm();
      setActiveTab("users");
    },
    onError: (error: any) => {
      console.error("Update user error:", error);
      const errorMessage = getErrorMessage(error);

      toast({
        title: t('common.error'),
        description: errorMessage,
        variant: "destructive",
        duration: 5000
      });

      // If username already exists, set form error
      if (errorMessage.includes(t('errors.api.usernameExists'))) {
        form.setError("username", {
          type: "manual",
          message: t('errors.api.usernameExists')
        });
      }
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => {
      return apiRequest(`/api/users/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: t('common.success'),
        description: t('users.deleteSuccess'),
        variant: "success",
        duration: 5000
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: any) => {
      console.error("Delete user error:", error);
      const errorMessage = getErrorMessage(error);

      toast({
        title: t('common.error'),
        description: errorMessage,
        variant: "destructive",
        duration: 5000
      });
    },
  });

  function onSubmit(data: UserFormValues) {
    if (editingUser) {
      const updateData = { ...data };
      if (!updateData.password) {
        delete updateData.password;
      }
      updateUserMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      createUserMutation.mutate(data);
    }
  }

  function resetForm() {
    form.reset({
      username: "",
      password: "",
      isAdmin: false,
      forceChangePassword: true,
    });
    setEditingUser(null);
  }

  function handleEditUser(user: any) {
    setEditingUser(user);
    form.reset({
      username: user.username,
      password: "",
      isAdmin: user.isAdmin,
      forceChangePassword: user.forceChangePassword,
    });
    setActiveTab("add");
  }

  function handleDeleteUser(id: number) {
    if (window.confirm(t('users.confirmDelete'))) {
      deleteUserMutation.mutate(id);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] sm:max-w-[650px] max-h-[90vh] overflow-y-auto p-4 sm:p-6"
        aria-describedby="user-management-description"
      >
        <DialogHeader>
          <DialogTitle>{t('users.management')}</DialogTitle>
          <DialogDescription id="user-management-description">
            {t('users.managementDescription')}
          </DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">{t('users.list')}</TabsTrigger>
            <TabsTrigger value="add">{editingUser ? t('users.edit') : t('users.add')}</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="mt-4 space-y-4">
            {/* Registration Policy Switch Card */}
            <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-lg border bg-muted/40 gap-3">
              <div className="space-y-0.5 min-w-0 flex-1">
                <Label htmlFor="registration-toggle" className="text-sm font-medium cursor-pointer">
                  {t('users.registrationEnabled')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('users.registrationEnabledDescription')}
                </p>
              </div>
              <Switch
                id="registration-toggle"
                checked={systemSettings?.registrationEnabled ?? true}
                onCheckedChange={(checked) => toggleRegistrationMutation.mutate(checked)}
                disabled={toggleRegistrationMutation.isPending || isLoadingSettings}
                aria-label={t('users.registrationEnabled')}
              />
            </div>

            {isLoading ? (
              <div className="text-center py-4">{t('users.loading')}</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg p-4">
                {t('users.noUsers')}
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((user: any) => (
                  <div
                    key={user.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border bg-card hover:bg-muted/20 transition-colors gap-3"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5 sm:mt-0">
                        <UserIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm sm:text-base truncate">{user.username}</span>
                          {user.isAdmin ? (
                            <Badge variant="default" className="text-xs px-2 py-0.5">
                              {t('users.roleAdmin')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs px-2 py-0.5">
                              {t('users.roleUser')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t('users.lastLogin')}: {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : t('users.never')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 sm:px-3 text-xs"
                        onClick={() => handleEditUser(user)}
                        title={t('users.edit')}
                        aria-label={t('users.edit')}
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        <span>{t('users.edit')}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 sm:px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                        onClick={() => handleDeleteUser(user.id)}
                        title={t('users.delete')}
                        aria-label={t('users.delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        <span>{t('users.delete')}</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button onClick={() => { resetForm(); setActiveTab("add"); }}>
                <UserPlus className="mr-2 h-4 w-4" />
                {t('users.add')}
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="add" className="mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('users.username')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('users.usernamePlaceholder')} {...field} />
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
                      <FormLabel>{editingUser ? t('users.newPasswordOptional') : t('auth.password')}</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder={t('users.passwordPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex space-x-4">
                  <FormField
                    control={form.control}
                    name="isAdmin"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="m-0">{t('users.adminUser')}</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="forceChangePassword"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="m-0">{t('users.forcePasswordChange')}</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => { resetForm(); setActiveTab("users"); }}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit">
                    {editingUser ? t('users.updateUser') : t('users.createUser')}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}