import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingScreenProps {
  className?: string;
  label?: string;
}

const LoadingScreen = ({ className, label = "Cargando interfaz..." }: LoadingScreenProps) => {
  return (
    <div className={cn("flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-3 text-medical-600", className)}>
      <Loader2 className="h-10 w-10 animate-spin" />
      <p className="text-sm font-medium text-medical-700">{label}</p>
    </div>
  );
};

export default LoadingScreen;