import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { apiRequest } from "@/lib/api";
import { useTranslation } from "@/i18n";
import { useErrorTranslation } from "@/lib/error-handler";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const { getErrorMessage } = useErrorTranslation();
  const [_, navigate] = useLocation();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") || "";
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage(t('auth.verifyEmailInvalidLink'));
      return;
    }

    apiRequest(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => setStatus("success"))
      .catch((error) => {
        setStatus("error");
        setErrorMessage(getErrorMessage(error));
      });
    // Only run once on mount for the token present at load time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[350px]">
        <CardHeader className="text-center bg-primary dark:bg-primary text-white rounded-t-lg">
          <div className="flex flex-col items-center">
            <Logo size={60} color="white" />
            <CardTitle className="mt-2">Filadex</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6 text-center space-y-4">
          {status === "pending" && <p>{t('auth.verifyingEmail')}</p>}
          {status === "success" && <p>{t('auth.verifyEmailSuccess')}</p>}
          {status === "error" && <p className="text-destructive">{errorMessage}</p>}
          <Button className="w-full" onClick={() => navigate("/login")}>{t('auth.backToLogin')}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
