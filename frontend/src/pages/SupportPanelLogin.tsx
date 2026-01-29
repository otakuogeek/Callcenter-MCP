import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LifeBuoy, Lock, ArrowLeft } from 'lucide-react';
import { api } from "@/lib/api";

export default function SupportPanelLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.token && data.user) {
        // Verificar que sea superadmin ÚNICAMENTE
        if (data.user.role !== 'superadmin') {
          setError('Acceso denegado. Solo Super Administradores pueden acceder a este panel.');
          return;
        }

        localStorage.setItem('token', data.token);
        navigate('/support-panel');
      } else {
        setError(data.error || data.message || 'Credenciales inválidas');
      }
    } catch (error) {
      console.error('Error en login:', error);
      setError('Error de conexión. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="w-full max-w-md p-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/login')}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al login principal
        </Button>

        <Card className="shadow-2xl border-t-4 border-blue-600">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center">
              <LifeBuoy className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Panel de Soporte</CardTitle>
              <CardDescription className="text-base mt-2">
                Acceso exclusivo para Super Administradores
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@biosanarcall.site"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Lock className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Acceder al Panel
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>Solo usuarios con permisos de Super Administrador</p>
              <p className="mt-1">pueden acceder a este sistema</p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          <p>© 2026 Fundación Biosanar IPS</p>
          <p>Sistema de Gestión de Soporte Técnico</p>
        </div>
      </div>
    </div>
  );
}
