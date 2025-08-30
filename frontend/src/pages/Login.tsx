
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HeadphonesIcon, Eye, EyeOff, Shield, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { EnhancedAnimatedContainer } from "@/components/ui/enhanced-animated-container";
import { AnimatedForm, AnimatedInputField } from "@/components/ui/animated-form";
import { AnimatedButton } from "@/components/ui/animated-button";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { login } = useAuth();

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
          className="absolute w-1 h-1 bg-medical-300/30 rounded-full"
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
        toast({ title: "Inicio de sesión exitoso", description: "Bienvenido al sistema Valeria" });
  navigate("/appointments");
      }, 1500);
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Credenciales incorrectas",
        variant: "destructive",
      });
    } finally {
      if (!loginSuccess) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-br from-medical-50 via-blue-50 to-medical-100 p-4 overflow-hidden">
      <FloatingParticles />
      
      {/* Elementos de fondo animados */}
      <motion.div
        className="absolute top-20 left-20 w-32 h-32 bg-medical-200/20 rounded-full blur-xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-20 right-20 w-40 h-40 bg-blue-200/20 rounded-full blur-xl"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      <EnhancedAnimatedContainer
        animation="fadeIn"
        className="w-full max-w-md relative z-10"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Card className="backdrop-blur-sm bg-white/90 shadow-2xl border-0 overflow-hidden">
            {/* Header animado */}
            <CardHeader className="text-center space-y-6 pb-8 relative">
              <motion.div
                className="flex justify-center"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.6, delay: 0.2, type: "spring", bounce: 0.3 }}
              >
                <div className="relative">
                  <motion.div 
                    className="w-20 h-20 bg-gradient-to-br from-medical-500 to-medical-600 rounded-2xl flex items-center justify-center shadow-lg"
                    whileHover={{ scale: 1.05, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <HeadphonesIcon className="w-10 h-10 text-white" />
                  </motion.div>
                  
                  {/* Efecto de brillo */}
                  <motion.div
                    className="absolute inset-0 bg-white/20 rounded-2xl"
                    animate={{ opacity: [0, 0.5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
              </motion.div>
              
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <CardTitle className="text-3xl font-bold bg-gradient-to-r from-medical-800 to-medical-600 bg-clip-text text-transparent">
                  Valeria
                </CardTitle>
                <CardDescription className="text-medical-600 text-lg">
                  Sistema de Gestión Médica
                </CardDescription>
              </motion.div>

              {/* Indicador de seguridad */}
              <motion.div
                className="flex items-center justify-center gap-2 text-xs text-medical-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <Shield className="w-3 h-3" />
                <span>Conexión segura SSL</span>
              </motion.div>
            </CardHeader>

            <CardContent className="px-8 pb-8">
              <AnimatePresence mode="wait">
                {loginSuccess ? (
                  <motion.div
                    key="success"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center py-8"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.6, repeat: 2 }}
                    >
                      <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    </motion.div>
                    <h3 className="text-lg font-semibold text-green-700 mb-2">
                      ¡Bienvenido!
                    </h3>
                    <p className="text-gray-600">Redirigiendo al sistema...</p>
                  </motion.div>
                ) : (
                  <motion.div key="form">
                    <AnimatedForm onSubmit={handleLogin} className="space-y-6">
                      <AnimatedInputField
                        label="Correo Electrónico"
                        type="email"
                        placeholder="usuario@ejemplo.com"
                        value={email}
                        onChange={(value) => {
                          setEmail(value);
                          if (errors.email) {
                            setErrors(prev => ({ ...prev, email: "" }));
                          }
                        }}
                        error={errors.email}
                        required
                      />

                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                          Contraseña
                        </Label>
                        <motion.div
                          className="relative"
                          whileFocus={{ scale: 1.02 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Ingrese su contraseña"
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              if (errors.password) {
                                setErrors(prev => ({ ...prev, password: "" }));
                              }
                            }}
                            onFocus={() => setFocusedField("password")}
                            onBlur={() => setFocusedField(null)}
                            className={`pr-12 transition-all duration-200 ${
                              focusedField === "password" ? "ring-2 ring-medical-300 border-medical-300" : ""
                            } ${errors.password ? "border-red-500 ring-red-200" : ""}`}
                            required
                          />
                          
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-2 hover:bg-gray-100"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            <AnimatePresence mode="wait">
                              {showPassword ? (
                                <motion.div
                                  key="hide"
                                  initial={{ rotate: -90, opacity: 0 }}
                                  animate={{ rotate: 0, opacity: 1 }}
                                  exit={{ rotate: 90, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <EyeOff className="w-4 h-4" />
                                </motion.div>
                              ) : (
                                <motion.div
                                  key="show"
                                  initial={{ rotate: 90, opacity: 0 }}
                                  animate={{ rotate: 0, opacity: 1 }}
                                  exit={{ rotate: -90, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <Eye className="w-4 h-4" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </Button>
                        </motion.div>
                        
                        <AnimatePresence>
                          {errors.password && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="flex items-center gap-2 text-sm text-red-600"
                            >
                              <AlertCircle className="w-3 h-3" />
                              {errors.password}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                      >
                        <AnimatedButton
                          type="submit"
                          className="w-full bg-gradient-to-r from-medical-500 to-medical-600 hover:from-medical-600 hover:to-medical-700 text-white font-medium py-3 text-base shadow-lg"
                          disabled={isLoading}
                          loading={isLoading}
                        >
                          <motion.div className="flex items-center justify-center gap-2">
                            <span>{isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}</span>
                            <motion.div
                              animate={isLoading ? { rotate: 360 } : {}}
                              transition={{ duration: 1, repeat: isLoading ? Infinity : 0 }}
                            >
                              <Shield className="w-4 h-4" />
                            </motion.div>
                          </motion.div>
                        </AnimatedButton>
                      </motion.div>
                    </AnimatedForm>

                    {/* Enlaces adicionales */}
                    <motion.div
                      className="mt-6 text-center space-y-3"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      <motion.a
                        href="#"
                        className="text-sm text-medical-600 hover:text-medical-700 transition-colors"
                        whileHover={{ scale: 1.05 }}
                      >
                        ¿Olvidaste tu contraseña?
                      </motion.a>
                      
                      <div className="text-xs text-gray-500">
                        Versión 2.1.0 - © 2025 Sistema Valeria
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </EnhancedAnimatedContainer>
    </div>
  );
};

export default Login;
