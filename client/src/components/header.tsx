import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Paintbrush, Plus, Settings, Users, LogOut, Share2, KeyRound } from "lucide-react";
import { ThemeSelector } from "./theme-selector";
import { ThemeToggle } from "./theme-toggle";
import { SettingsDialog } from "./settings-dialog";
import { UserManagementModal } from "./user-management-modal";
import { SharingModal } from "./sharing-modal";
import { ChangePasswordModal } from "./change-password-modal";
import { Link, useLocation } from "wouter";
import { Logo } from "./logo";
import { useAuth } from "@/lib/auth";

interface HeaderProps {
  onAddFilament: () => void;
}

export function Header({ onAddFilament }: HeaderProps) {
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  const [sharingModalOpen, setSharingModalOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const { isAdmin, logout } = useAuth();
  const [_, navigate] = useLocation();

  return (
    <header className="theme-primary-bg text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Link href="/">
            <div className="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 375 375">
                <path fill="white" d="M201.36 53.03c-9.8-4.9-22.55-7.59-35.95-7.59-13.4 0-26.16 2.7-35.95 7.59-12.2 6.1-18.93 15.11-18.93 25.36 0 10.24 6.72 19.25 18.93 25.36 9.78 4.89 22.55 7.6 35.95 7.6 13.4 0 26.16-2.7 35.95-7.6 12.2-6.1 18.93-15.1 18.93-25.36 0-10.25-6.72-19.26-18.93-25.36zm-9.82 31.06c-6.7 3.36-16.22 5.28-26.13 5.28-9.9 0-19.43-1.92-26.13-5.28-5.61-2.8-6.8-5.33-6.8-5.7 0-.38 1.19-2.91 6.8-5.72 6.7-3.35 16.23-5.27 26.13-5.27 9.9 0 19.44 1.92 26.14 5.27 5.6 2.8 6.8 5.33 6.8 5.72 0 .37-1.2 2.9-6.8 5.7zm0 0"></path>
                <path fill="white" d="M266.36 309.06c2.94-1.57 5.79-3.2 8.48-4.92C296.3 290.5 308.1 272.76 308.1 254.14c0-15.6-8-30.3-23.22-42.78-1.07-4.15-2.82-8.2-5.2-12.1 3.46-5.62 5.56-11.56 6.23-17.7l.02-.13c.92-8.68-1.02-17.17-5.63-25.1h-.02c-.2-.33-.4-.67-.6-1.01 4.26-6.9 6.48-14.3 6.48-22 0-3.97-.6-7.88-1.8-11.7 15.46-12.47 23.74-27.34 23.74-43.22 0-22.02-15.81-42.3-44.52-57.1C237-7.58 202.13-15.13 165.4-15.13c-36.72 0-71.58 7.55-98.15 21.26-28.7 14.8-44.52 35.08-44.52 57.1 0 15.88 8.28 30.75 23.74 43.21-1.2 3.83-1.79 7.74-1.79 11.7 0 7.7 2.22 15.1 6.48 22-.2.34-.4.68-.6 1.02h-.02c-5 8.6-6.72 17.67-5.46 26.52.02.14.05.27.07.41.85 5.55 2.87 10.9 6.01 16 2.4-4.1-4.14-1.86 8.1 0-1.22 4.15-2.96 8.22-4.05 12.36-15.2 12.47-23.22 27.2-23.22 42.78 0 19.74 13.12 38.3 36.95 52.26 20.56 12.05 48.4 20.26 78.75 23.3 12.55 27.2 39.02 45.27 69.45 45.27h144.1V309.06zm15.15-69.3c2.77 4.28 4.63 9.1 4.63 14.37 0 10.82-8.2 22-23.06 31.45-15.73 10-37.84 17.4-62.55 20.98-2-1.66-3.42-4.04-3.9-6.82-.92-5.48-2-9.84-3.43-14.35 43.46-5.33 76.58-22.78 88.31-45.64zm-214.19-67.34c4.56 3.43 9.75 6.62 15.57 9.53 22.22 11.12 51.53 17.25 82.52 17.25 30.98 0 60.3-6.13 82.51-17.25 5.82-2.9 11.02-6.1 15.57-9.53.55 1.93.77 3.91.66 5.78v.04c-1.3 20.52-41.48 42.93-98.74 42.93-17.44 0-33.29-2.08-46.95-5.55-.57-.16-1.14-.33-1.72-.49-16.55-4.4-40.65-14.37-48.1-29.75-2.07-4.26-2.58-8.53-1.32-12.96zm-.64-37.98.7.36c26.36 13.2 61.18 20.47 98.03 20.47 36.85 0 71.67-7.27 98.03-20.47.24-.11.47-.24.7-.36-1.45 20.48-41.58 42.8-98.73 42.8-57.14 0-97.27-22.32-98.73-42.8zm181.24 91.45c5.82-2.9 11.02-6.1 15.57-9.53.46 1.6.7 3.2.7 4.8 0 17.85-30.64 38.81-80.58 43.15-4.53-7.5-10.08-14.49-16.56-20.8-.14-.14-.28-.26-.42-.4 30.54-.15 59.37-6.25 81.3-17.22zM44.68 78.4c0-13.18 11.9-26.88 32.62-37.57 23.53-12.14 54.82-18.82 88.1-18.82 33.3 0 64.58 6.68 88.1 18.82 20.74 10.7 32.63 24.4 32.63 37.57 0 13.03-11.85 26.44-32.5 36.77-23.38 11.7-54.71 18.15-88.22 18.15-33.5 0-64.84-6.44-88.22-18.15-20.66-10.33-32.5-23.73-32.5-36.77zm0 175.75c0-5.25 1.84-10.06 4.6-14.32 8.63 16.94 29.08 31.07 58.26 39.5 17.45 5.05 22.15 14.23 24.1 27.4 0 .02 0 .03 0 .05-49.67-6.96-86.96-29-86.96-52.63zm285.35 98.86h-122.15c-27.38 0-50.32-20.89-54.54-49.56-3.54-24.1-16.16-38.49-39.7-45.3-28.56-8.25-47-22.79-47-37.03 0-1.6.22-3.2.68-4.82 12.6 9.48 28.57 15.96 43.8 20.01 31.25 8.33 58.1 32.87 63.87 67.04 2.7 16 16.3 27.61 32.33 27.61h122.71v.05z"></path>
                <g fill="white" transform="translate(179.1 192)">
                  <path d="M3.8 0H2.8v-7.69H.1v-.87h6.37v.87H3.8V0zM3.5-6.55c.54 0 1 .13 1.39.38.4.24.7.58.9 1.02.21.44.32.94.32 1.51v.61H1.67c0 .75.2 1.33.56 1.72.37.4.88.6 1.55.6.4 0 .76-.04 1.08-.11l.97-.33v.85c-.33.15-.65.26-.97.32-.31.07-.69.1-1.12.1-.62 0-1.16-.12-1.61-.37a2.49 2.49 0 01-1.08-1.13c-.25-.5-.37-1.09-.37-1.8 0-.68.11-1.28.34-1.78.23-.5.56-.9.99-1.17.42-.28.93-.42 1.5-.42zm-.02.8c-.52 0-.93.17-1.25.51-.3.35-.48.83-.54 1.43h3.4c0-.38-.06-.72-.18-1 a1.5 1.5 0 00-.54-.69 1.48 1.48 0 00-.9-.25zM2.56-3.28L.33-6.42h1.12l1.7 2.47 1.68-2.47h1.1L3.71-3.28 6.05 0H4.94L3.14-2.62 1.33 0H.23l2.33-3.28zM3.09-.69c.16 0 .34 0 .5-.03.16-.03.3-.06.4-.1v.76a1.76 1.76 0 01-.86.14 1.54 1.54 0 01-.92-.17 1.15 1.15 0 01-.67-.61c-.16-.3-.23-.7-.23-1.2v-3.8h-.93v-.48l.93-.38.39-1.39h.58v1.48h1.9v.77h-1.9v3.78c0 .4.09.7.28.89.19.2.43.3.73.3z"/>
                </g>
              </svg>
              <h1 className="text-2xl font-medium">Filadex</h1>
            </div>
          </Link>
        </div>
        <div className="flex items-center space-x-2">
          <ThemeToggle />

          <Button
            onClick={() => setThemeDialogOpen(true)}
            variant="outline"
            size="icon"
            className="bg-primary/20 hover:bg-primary/30 text-white border-white/20"
            title="Theme Settings"
          >
            <Paintbrush className="h-4 w-4" />
          </Button>

          <Button
            onClick={() => setSettingsDialogOpen(true)}
            variant="outline"
            size="icon"
            className="bg-primary/20 hover:bg-primary/30 text-white border-white/20"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          {isAdmin && (
            <Button
              onClick={() => setUserManagementOpen(true)}
              variant="outline"
              size="icon"
              className="bg-primary/20 hover:bg-primary/30 text-white border-white/20"
              title="User Management"
            >
              <Users className="h-4 w-4" />
            </Button>
          )}

          <Button
            onClick={() => setSharingModalOpen(true)}
            variant="outline"
            size="icon"
            className="bg-primary/20 hover:bg-primary/30 text-white border-white/20"
            title="Share Filaments"
          >
            <Share2 className="h-4 w-4" />
          </Button>

          <Button
            onClick={() => setChangePasswordOpen(true)}
            variant="outline"
            size="icon"
            className="bg-primary/20 hover:bg-primary/30 text-white border-white/20"
            title="Change Password"
          >
            <KeyRound className="h-4 w-4" />
          </Button>

          <Button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            variant="outline"
            size="icon"
            className="bg-primary/20 hover:bg-primary/30 text-white border-white/20"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>

          <Button
            onClick={onAddFilament}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-md flex items-center transition-colors duration-200"
          >
            <Plus className="mr-1 h-5 w-5" />
            Add Filament
          </Button>
        </div>
      </div>

      <ThemeSelector
        open={themeDialogOpen}
        onOpenChange={setThemeDialogOpen}
      />

      <SettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
      />

      <UserManagementModal
        open={userManagementOpen}
        onOpenChange={setUserManagementOpen}
      />

      <SharingModal
        open={sharingModalOpen}
        onOpenChange={setSharingModalOpen}
      />

      <ChangePasswordModal
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </header>
  );
}
