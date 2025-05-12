import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Share2, Globe, Tag } from "lucide-react";

type SharingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Material = {
  id: number;
  name: string;
};

type SharingSetting = {
  id: number;
  userId: number;
  materialId: number | null;
  isPublic: boolean;
};

export function SharingModal({ open, onOpenChange }: SharingModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("settings");
  const [shareUrl, setShareUrl] = useState("");

  const { data: materials = [] } = useQuery({
    queryKey: ["materials"],
    queryFn: () => apiRequest("/api/materials"),
    enabled: open,
  });

  const { data: sharingSettings = [], isLoading: isLoadingSettings } = useQuery({
    queryKey: ["sharing-settings"],
    queryFn: () => apiRequest("/api/user-sharing"),
    enabled: open,
  });

  const { data: userData } = useQuery({
    queryKey: ["user"],
    queryFn: () => apiRequest("/api/auth/me"),
  });

  useEffect(() => {
    if (userData) {
      const baseUrl = window.location.origin;
      setShareUrl(`${baseUrl}/public/filaments/${userData.id}`);
    }
  }, [userData]);

  const updateSharingMutation = useMutation({
    mutationFn: (data: { materialId: number | null; isPublic: boolean }) => {
      return apiRequest("/api/user-sharing", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Sharing settings updated" });
      queryClient.invalidateQueries({ queryKey: ["sharing-settings"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update sharing settings", variant: "destructive" });
    },
  });

  const handleToggleGlobalSharing = (isPublic: boolean) => {
    updateSharingMutation.mutate({ materialId: null, isPublic });
  };

  const handleToggleMaterialSharing = (materialId: number, isPublic: boolean) => {
    updateSharingMutation.mutate({ materialId, isPublic });
  };

  const getSettingForMaterial = (materialId: number | null) => {
    return sharingSettings.find((setting: SharingSetting) => 
      setting.materialId === materialId
    );
  };

  const isGlobalSharingEnabled = () => {
    const globalSetting = getSettingForMaterial(null);
    return globalSetting ? globalSetting.isPublic : false;
  };

  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Success", description: "Share URL copied to clipboard" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Filament Sharing Settings</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="settings">Sharing Settings</TabsTrigger>
            <TabsTrigger value="share">Share Your Collection</TabsTrigger>
          </TabsList>
          <TabsContent value="settings" className="mt-4">
            {isLoadingSettings ? (
              <div className="text-center py-4">Loading settings...</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-md">
                  <div className="flex items-center space-x-2">
                    <Globe className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Share All Filaments</p>
                      <p className="text-sm text-muted-foreground">Make your entire filament collection public</p>
                    </div>
                  </div>
                  <Switch 
                    checked={isGlobalSharingEnabled()}
                    onCheckedChange={handleToggleGlobalSharing}
                  />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Share by Material Type</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose specific material types to share
                  </p>
                  
                  <div className="space-y-2 mt-2">
                    {materials.map((material: Material) => {
                      const setting = getSettingForMaterial(material.id);
                      const isEnabled = setting ? setting.isPublic : false;
                      
                      return (
                        <div key={material.id} className="flex items-center justify-between p-3 border rounded-md">
                          <div className="flex items-center space-x-2">
                            <Tag className="h-4 w-4 text-primary" />
                            <Label htmlFor={`material-${material.id}`}>{material.name}</Label>
                          </div>
                          <Switch 
                            id={`material-${material.id}`}
                            checked={isEnabled}
                            onCheckedChange={(checked) => handleToggleMaterialSharing(material.id, checked)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
          <TabsContent value="share" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Share Your Filament Collection</CardTitle>
                <CardDescription>
                  Share this link with others to let them view your filament collection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <input
                    className="flex-1 p-2 border rounded-md bg-muted"
                    value={shareUrl}
                    readOnly
                  />
                  <Button onClick={copyShareUrl}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Note: Only filaments from materials you've enabled sharing for will be visible to others.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
