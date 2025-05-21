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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Edit, UserPlus } from "lucide-react";

// Create a function to generate the schema with translations
const createUserFormSchema = (t: (key: string) => string) => z.object({
  username: z.string().min(3, t('users.usernameMinLength')),
  password: z.string().min(6, t('auth.passwordRequirements')).optional(),
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
  const userFormSchema = createUserFormSchema(t);
  type UserFormValues = z.infer<typeof userFormSchema>;

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiRequest("/api/users"),
    enabled: open,
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
        className="sm:max-w-[600px]"
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
          <TabsContent value="users" className="mt-4">
            {isLoading ? (
              <div className="text-center py-4">{t('users.loading')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('users.username')}</TableHead>
                    <TableHead>{t('users.admin')}</TableHead>
                    <TableHead>{t('users.lastLogin')}</TableHead>
                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">{t('users.noUsers')}</TableCell>
                    </TableRow>
                  ) : (
                    users.map((user: any) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.isAdmin ? t('common.yes') : t('common.no')}</TableCell>
                        <TableCell>{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : t('users.never')}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)} title={t('users.edit')}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id)} title={t('users.delete')}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
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