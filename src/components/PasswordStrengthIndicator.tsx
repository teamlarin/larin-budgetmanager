import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface Requirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: Requirement[] = [
  {
    label: "Almeno 8 caratteri",
    test: (pwd) => pwd.length >= 8,
  },
  {
    label: "Una lettera maiuscola",
    test: (pwd) => /[A-Z]/.test(pwd),
  },
  {
    label: "Una lettera minuscola",
    test: (pwd) => /[a-z]/.test(pwd),
  },
  {
    label: "Un numero",
    test: (pwd) => /[0-9]/.test(pwd),
  },
];

export const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  const { strength, label, color } = useMemo(() => {
    if (!password) {
      return { strength: 0, label: "", color: "bg-muted" };
    }

    const passedRequirements = requirements.filter((req) => req.test(password)).length;
    const strengthPercentage = (passedRequirements / requirements.length) * 100;

    let strengthLabel = "";
    let strengthColor = "";

    if (strengthPercentage <= 25) {
      strengthLabel = "Molto debole";
      strengthColor = "bg-[hsl(var(--password-weak))]";
    } else if (strengthPercentage <= 50) {
      strengthLabel = "Debole";
      strengthColor = "bg-[hsl(var(--password-medium))]";
    } else if (strengthPercentage <= 75) {
      strengthLabel = "Buona";
      strengthColor = "bg-[hsl(var(--password-good))]";
    } else {
      strengthLabel = "Forte";
      strengthColor = "bg-[hsl(var(--password-strong))]";
    }

    return { strength: strengthPercentage, label: strengthLabel, color: strengthColor };
  }, [password]);

  if (!password) return null;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Sicurezza password:</span>
          <span className="font-medium">{label}</span>
        </div>
        <Progress value={strength} className="h-2" indicatorClassName={color} />
      </div>
      
      <div className="space-y-1">
        {requirements.map((req, index) => {
          const passed = req.test(password);
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              {passed ? (
                <Check className="h-4 w-4 text-[hsl(var(--password-strong))] shrink-0" />
              ) : (
                <X className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className={passed ? "text-foreground" : "text-muted-foreground"}>
                {req.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
