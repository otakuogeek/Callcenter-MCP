import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stethoscope, Eye, EyeOff, Shield, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDoctorAuth } from "@/hooks/useDoctorAuth";
import { EnhancedAnimatedContainer } from "@/components/ui/enhanced-animated-container";
import { AnimatedForm } from "@/components/ui/animated-form";

const DoctorLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { login } = useDoctorAuth();

  // Verificar si ya está autenticado
  useEffect(() => {
    const token = localStorage.getItem('doctorToken');
    if (token) {
      navigate('/doctor-dashboard', { replace: true });
    }
  }, [navigate]);

  // Validación en tiempo real
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return "El email es requerido";
    if (!emailRegex.test(email)) return "Formato de email inválido";
    return "";
  };

  const validatePassword = (password: string) => {
    if (!password) return "La contraseña es requerida";
    if (password.length < 6) return "La contraseña debe tener al menos 6 caracteres";
    return "";
  };

  // Efectos de partículas flotantes
  const FloatingParticles = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-blue-300/30 rounded-full"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
          }}
          animate={{
            y: [null, -20, 20],
            x: [null, Math.random() * 50 - 25],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    
    if (emailError || passwordError) {
      setErrors({ email: emailError, password: passwordError });
      return;
    }

    setErrors({});
    setIsLoading(true);
    
    try {
      await login(email, password);
      setLoginSuccess(true);
      
      // Animación de éxito antes de navegar
      setTimeout(() => {
        toast({ 
          title: "Inicio de sesión exitoso", 
          description: "Bienvenido al Portal de Doctores" 
        });
        navigate("/doctor-dashboard");
      }, 1500);
      
    } catch (error: any) {
      const errorMessage = error?.message || "Credenciales incorrectas";
      
      toast({
        title: "Error de autenticación",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      if (!loginSuccess) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center p-4 relative overflow-hidden">
      <FloatingParticles />
      
      {/* Patrón de fondo médico */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230ea5e9' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}/>
      </div>

      <EnhancedAnimatedContainer delay={0.1}>
        <Card className="w-full max-w-md shadow-2xl border-2 border-blue-100/50 backdrop-blur-sm bg-white/95 relative overflow-hidden">
          {/* Gradiente decorativo superior */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600" />
          
          <CardHeader className="space-y-3 text-center pb-8 pt-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="mx-auto"
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Stethoscope className="h-10 w-10 text-white" />
              </div>
            </motion.div>
            
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              Portal de Doctores
            </CardTitle>
            
            <CardDescription className="text-base text-gray-600">
              Acceso exclusivo para profesionales médicos
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pb-8">
            <AnimatePresence mode="wait">
              {loginSuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-8 space-y-4"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                  >
                    <CheckCircle className="h-20 w-20 text-green-500" />
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-xl font-semibold text-green-600"
                  >
                    ¡Inicio de sesión exitoso!
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="text-gray-500"
                  >
                    Redirigiendo al dashboard...
                  </motion.p>
                </motion.div>
              ) : (
                <AnimatedForm onSubmit={handleLogin} key="form">
                  <div className="space-y-5">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.3 }}
                    >
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                        Correo Electrónico
                      </Label>
                      <div className="relative mt-2">
                        <Input
                          id="email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (errors.email) {
                              setErrors({ ...errors, email: validateEmail(e.target.value) });
                            }
                          }}
                          onFocus={() => setFocusedField("email")}
                          onBlur={() => {
                            setFocusedField(null);
                            setErrors({ ...errors, email: validateEmail(email) });
                          }}
                          placeholder="doctor@biosanarcall.site"
                          className={`h-12 pl-4 pr-4 text-base transition-all duration-300 ${
                            focusedField === "email" 
                              ? "ring-2 ring-blue-500 border-blue-500" 
                              : errors.email
                              ? "border-red-500 focus:ring-red-500"
                              : "border-gray-300"
                          }`}
                          disabled={isLoading}
                        />
                      </div>
                      {errors.email && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-red-500 flex items-center gap-1 mt-1"
                        >
                          <AlertCircle className="h-4 w-4" />
                          {errors.email}
                        </motion.p>
                      )}
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4, duration: 0.3 }}
                    >
                      <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                        Contraseña
                      </Label>
                      <div className="relative mt-2">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (errors.password) {
                              setErrors({ ...errors, password: validatePassword(e.target.value) });
                            }
                          }}
                          onFocus={() => setFocusedField("password")}
                          onBlur={() => {
                            setFocusedField(null);
                            setErrors({ ...errors, password: validatePassword(password) });
                          }}
                          placeholder="••••••••"
                          className={`h-12 pl-4 pr-12 text-base transition-all duration-300 ${
                            focusedField === "password" 
                              ? "ring-2 ring-blue-500 border-blue-500" 
                              : errors.password
                              ? "border-red-500 focus:ring-red-500"
                              : "border-gray-300"
                          }`}
                          disabled={isLoading}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 hover:bg-gray-100"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5 text-gray-500" />
                          ) : (
                            <Eye className="h-5 w-5 text-gray-500" />
                          )}
                        </Button>
                      </div>
                      {errors.password && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-red-500 flex items-center gap-1 mt-1"
                        >
                          <AlertCircle className="h-4 w-4" />
                          {errors.password}
                        </motion.p>
                      )}
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.3 }}
                  >
                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                          Validando credenciales...
                        </>
                      ) : (
                        <>
                          <Shield className="mr-2 h-5 w-5" />
                          Iniciar Sesión
                        </>
                      )}
                    </Button>
                  </motion.div>
                </AnimatedForm>
              )}
            </AnimatePresence>

            {!loginSuccess && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-6 text-center"
              >
                <p className="text-sm text-gray-500">
                  ¿Problemas para acceder?{" "}
                  <span className="text-blue-600 hover:text-blue-700 font-medium cursor-pointer">
                    Contactar administrador
                  </span>
                </p>
              </motion.div>
            )}

            {/* Indicador de seguridad */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="flex items-center justify-center gap-2 text-xs text-gray-500 pt-4 border-t border-gray-200"
            >
              <Shield className="h-4 w-4 text-blue-500" />
              <span>Conexión segura - Sistema certificado</span>
            </motion.div>
          </CardContent>
        </Card>
      </EnhancedAnimatedContainer>
    </div>
  );
};

export default DoctorLogin;
