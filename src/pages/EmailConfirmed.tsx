import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import larinLogo from "@/assets/logo_larin.png";

const EmailConfirmed = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <img src={larinLogo} alt="Larin" className="h-16 w-auto" />
        </div>
        <Card className="w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>
            <CardTitle>Email Confermata!</CardTitle>
            <CardDescription>
              La tua email è stata confermata con successo. Un amministratore dovrà approvare il tuo accesso prima che tu possa accedere all'applicazione.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Riceverai una notifica via email quando il tuo account sarà stato approvato.
            </p>
            <Button 
              onClick={() => navigate("/auth")} 
              className="w-full"
            >
              Vai al Login
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmailConfirmed;
