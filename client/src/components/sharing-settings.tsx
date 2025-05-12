import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Copy, Share2 } from "lucide-react";

export function SharingSettingsModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("settings");
  
  const { data: materials = [] } = useQuery({
    queryKey: ["materials"],
    queryFn: () => apiRequest("/api/materials"),
    enabled: open,
  });
  
  const { data: sharingSettings = [] } = useQuery({
    queryKey: ["sharing"],
    queryFn: () => apiRequest("/api/sharing"),
    enabled: open,
  });
  
  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => apiRequest("/api/auth/me"),
  });
  
  const updateSharingMutation = useMutation({
    mutationFn: (data: { materialId?: number; isPublic: boolean }) => {
      return apiRequest("/api/sharing", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sharing"] });
      toast({ title: "Success", description: "Sharing settings updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update sharing settings", variant: "destructive" });
    },
  });
  
  const isGlobalSharingEnabled = sharingSettings.some((s: any) => s.materialId === null && s.isPublic);
  
  const isMaterialShared = (materialId: number) => {
    return sharingSettings.some((s: any) => s.materialId === materialId && s.isPublic);
  };
  
  const handleGlobalSharingToggle = () => {
    updateSharingMutation.mutate({ isPublic: !isGlobalSharingEnabled });
  };
  
  const handleMaterialSharingToggle = (materialId: number) => {
    updateSharingMutation.mutate({ 
      materialId, 
      isPublic: !isMaterialShared(materialId) 
    });
  };
  
  const shareUrl = user ? `${window.location.origin}/shared/${user.id}` : "";
  
  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Copied", description: "Share URL copied to clipboard" });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Filament Sharing Settings</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="share">Share Link</TabsTrigger>
          </TabsList>
          <TabsContent value="settings" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Global Sharing</CardTitle>
                <CardDescription>Share all your filaments publicly</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="global-sharing">Share all filaments</Label>
                  <Switch
                    id="global-sharing"
                    checked={isGlobalSharingEnabled}
                    onCheckedChange={handleGlobalSharingToggle}
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Material-Specific Sharing</CardTitle>
                <CardDescription>Share only specific material types</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {materials.map((material: any) => (
                  <div key={material.id} className="flex items-center justify-between">
                    <Label htmlFor={`material-${material.id}`}>{material.name}</Label>
                    <Switch
                      id={`material-${material.id}`}
                      checked={isMaterialShared(material.id)}
                      onCheckedChange={() => handleMaterialSharingToggle(material.id)}
                      disabled={isGlobalSharingEnabled}
                    />
                  </div>
                ))}
                {materials.length === 0 && (
                  <p className="text-center text-muted-foreground">No materials found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="share" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Share Link</CardTitle>
                <CardDescription>Share this link to let others view your filaments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-2">
                  <Input value={shareUrl} readOnly />
                  <Button variant="outline" size="icon" onClick={copyShareUrl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Only filaments you've chosen to share will be visible to others.
                </p>
              </CardContent>
           