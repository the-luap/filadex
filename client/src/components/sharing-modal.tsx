import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useTranslation } from "@/i18n";
import { useErrorTranslation } from "@/lib/error-handler";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
  const { t } = useTranslation();
  const { getErrorMessage } = useErrorTranslation();
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
      console.log("Sending sharing update request:", data);
      return apiRequest("/api/user-sharing", {
        method: "POST",
        body: data, // Don't stringify here, apiRequest will do it
        headers: {
          'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: (data) => {
      console.log("Sharing update successful:", data);
      toast({
        title: t('common.success'),
        description: t('sharing.settingsUpdated')
      });
      queryClient.invalidateQueries({ queryKey: ["sharing-settings"] });
    },
    onError: (error) => {
      console.error("Sharing update error:", error);
      const errorMessage = getErrorMessage(error);
      toast({
        title: t('common.error'),
        description: errorMessage || t('sharing.updateError'),
        variant: "destructive"
      });
    },
  });

  const handleToggleGlobalSharing = (isPublic: boolean) => {
    console.log("Toggling global sharing to:", isPublic);

    // If enabling global sharing, disable all material-specific sharing
    if (isPublic) {
      // First update global sharing
      updateSharingMutation.mutate({ materialId: null, isPublic });

      // Then disable all material-specific sharing
      materials.forEach((material: Material) => {
        const setting = getSettingForMaterial(material.id);
        if (setting && setting.isPublic) {
          updateSharingMutation.mutate({ materialId: material.id, isPublic: false });
        }
      });
    } else {
      // Just disable global sharing
      updateSharingMutation.mutate({ materialId: null, isPublic });
    }
  };

  const handleToggleMaterialSharing = (materialId: number, isPublic: boolean) => {
    console.log("Toggling material sharing for material ID:", materialId, "to:", isPublic);

    // If enabling a material-specific sharing, disable global sharing
    if (isPublic) {
      const globalSetting = getSettingForMaterial(null);
      if (globalSetting && globalSetting.isPublic) {
        updateSharingMutation.mutate({ materialId: null, isPublic: false });
      }
    }

    // Update the material-specific sharing
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
    console.log("Attempting to copy URL:", shareUrl);

    // Simple approach - try Clipboard API first
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        console.log("Clipboard API copy succeeded");
        toast({
          title: t('common.success'),
          description: t('sharing.urlCopied'),
          variant: "default"
        });
      })
      .catch((err) => {
        console.error("Clipboard API copy failed, trying fallback:", err);

        // Fallback method
        try {
          // Create a temporary input element
          const tempInput = document.createElement("input");
          tempInput.style.position = "absolute";
          tempInput.style.left = "-1000px";
          tempInput.style.top = "-1000px";
          tempInput.value = shareUrl;
          document.body.appendChild(tempInput);

          // Select and copy
          tempInput.select();
          tempInput.setSelectionRange(0, 99999); // For mobile devices

          const successful = document.execCommand('copy');
          document.body.removeChild(tempInput);

          if (successful) {
            console.log("Fallback copy succeeded");
            toast({
              title: t('common.success'),
              description: t('sharing.urlCopied'),
              variant: "default"
            });
          } else {
            console.error("Fallback copy failed");
            toast({
              title: t('common.error'),
              description: t('sharing.copyError'),
              variant: "destructive"
            });
          }
        } catch (fallbackErr) {
          console.error("All copy methods failed:", fallbackErr);
          toast({
            title: t('common.error'),
            description: t('sharing.copyError'),
            variant: "destructive"
          });
        }
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('sharing.title')}</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="settings">{t('sharing.settingsTab')}</TabsTrigger>
            <TabsTrigger value="share">{t('sharing.shareTab')}</TabsTrigger>
          </TabsList>
          <TabsContent value="settings" className="mt-4 overflow-y-auto max-h-[60vh] pr-2">
            {isLoadingSettings ? (
              <div className="text-center py-4">{t('sharing.loadingSettings')}</div>
            ) : (
              <div className="space-y-4">
                <div
                  className="flex items-center justify-between p-4 border rounded-md cursor-pointer hover:bg-muted/50 relative"
                  onClick={() => handleToggleGlobalSharing(!isGlobalSharingEnabled())}
                >
                  <div className="flex items-center space-x-2">
                    <Globe className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{t('sharing.shareAllFilaments')}</p>
                      <p className="text-sm text-muted-foreground">{t('sharing.shareAllDescription')}</p>
                    </div>
                  </div>
                  <div className="z-20" onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={isGlobalSharingEnabled()}
                      onCheckedChange={handleToggleGlobalSharing}
                      className="cursor-pointer"
                      aria-label={t('sharing.shareAllFilaments')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-medium">{t('sharing.shareByMaterial')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('sharing.shareByMaterialDescription')}
                  </p>

                  <div className="space-y-2 mt-2">
                    {materials.map((material: Material) => {
                      const setting = getSettingForMaterial(material.id);
                      const isEnabled = setting ? setting.isPublic : false;

                      return (
                        <div
                          key={material.id}
                          className="flex items-center justify-between p-3 border rounded-md cursor-pointer hover:bg-muted/50 relative"
                          onClick={() => handleToggleMaterialSharing(material.id, !isEnabled)}
                        >
                          <div className="flex items-center space-x-2">
                            <Tag className="h-4 w-4 text-primary" />
                            <Label
                              htmlFor={`material-${material.id}`}
                              className="cursor-pointer"
                            >
                              {material.name}
                            </Label>
                          </div>
                          <div className="z-20" onClick={(e) => e.stopPropagation()}>
                            <Switch
                              id={`material-${material.id}`}
                              checked={isEnabled}
                              onCheckedChange={(checked) => handleToggleMaterialSharing(material.id, checked)}
                              className="cursor-pointer"
                              aria-label={`${t('sharing.shareByMaterial')}: ${material.name}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
          <TabsContent value="share" className="mt-4 overflow-y-auto max-h-[60vh] pr-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('sharing.shareCollection')}</CardTitle>
                <CardDescription>
                  {t('sharing.shareCollectionDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <input
                      className="w-full p-2 border rounded-md bg-muted pr-10"
                      value={shareUrl}
                      readOnly
                      onClick={(e) => e.currentTarget.select()}
                    />
                  </div>
                  <Button
                    onClick={copyShareUrl}
                    className="transition-all duration-300 hover:bg-primary/80"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    {t('sharing.copyButton')}
                  </Button>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {t('sharing.visibilityNote')}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
