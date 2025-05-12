import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Edit, UserPlus } from "lucide-react";

const userFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  isAdmin: z.boolean().default(false),
  forceChangePassword: z.boolean().default(true),
});

type UserFormValues = z.infer<typeof userFormSchema>;

export function UserManagementModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("users");

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
        title: "Success",
        description: "User created successfully",
        variant: "success",
        duration: 5000
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      resetForm();
      setActiveTab("users");
    },
    onError: (error: any) => {
      console.error("Create user error:", error);
      let errorMessage = "Failed to create user";

      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
        duration: 5000
      });

      // If username already exists, set form error
      if (errorMessage.includes("Username already exists")) {
        form.setError("username", {
          type: "manual",
          message: "Username already exists"
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
        title: "Success",
        description: "User updated successfully",
        variant: "success",
        duration: 5000
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      resetForm();
      setActiveTab("users");
    },
    onError: (error: any) => {
      console.error("Update user error:", error);
      let errorMessage = "Failed to update user";

      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
        duration: 5000
      });

      // If username already exists, set form error
      if (errorMessage.includes("Username already exists")) {
        form.setError("username", {
          type: "manual",
          message: "Username already exists"
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
        title: "Success",
        description: "User deleted successfully",
        variant: "success",
        duration: 5000
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: any) => {
      console.error("Delete user error:", error);
      let errorMessage = "Failed to delete user";

      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      toast({
        title: "Error",
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
    if (window.confirm("Are you sure you want to delete this user?")) {
      deleteUserMutation.mutate(id);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>User Management</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="add">{editingUser ? "Edit User" : "Add User"}</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="mt-4">
            {isLoading ? (
              <div className="text-center py-4">Loading users...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">No users found</TableCell>
                    </TableRow>
                  ) : (
                    users.map((user: any) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.isAdmin ? "Yes" : "No"}</TableCell>
                        <TableCell>{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id)}>
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
                Add User
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
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter username" {...field} />
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
                      <FormLabel>{editingUser ? "New Password (leave blank to keep current)" : "Password"}</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter password" {...field} />
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
                        <FormLabel className="m-0">Admin User</FormLabel>
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
                        <FormLabel className="m-0">Force Password Change</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => { resetForm(); setActiveTab("users"); }}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingUser ? "Update User" : "Create User"}
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