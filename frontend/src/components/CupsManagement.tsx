import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Edit, Trash2, DollarSign, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import api from "@/lib/api";

interface Cups {
  id: number;
  code: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  status: 'Activo' | 'Inactivo' | 'Descontinuado';
  requires_authorization?: number;
  created_at?: string;
  updated_at?: string;
}

const CupsManagement = () => {
  const [cupsList, setCupsList] = useState<Cups[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCups, setEditingCups] = useState<Cups | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    category: "",
    price: 0,
    requires_authorization: false
  });
  const { toast } = useToast();

  // Función auxiliar para recargar la lista
  const reloadCupsList = async () => {
    try {
      const result = await api.getCups({
        page,
        limit: pageSize,
        search: search || undefined,
        category: categoryFilter && categoryFilter !== "all" ? categoryFilter : undefined,
        status: statusFilter && statusFilter !== "all" ? statusFilter : undefined
      });
      console.log('CUPS response completa:', result);
      
      // El backend devuelve: { success: true, data: { cups: [], pagination: {...} } }
      if (result?.data?.cups && Array.isArray(result.data.cups)) {
        setCupsList(result.data.cups as Cups[]);
        setTotal(result.data.pagination.total);
        setTotalPages(result.data.pagination.total_pages);
      } else {
        console.error('Estructura de respuesta inesperada:', result);
        setCupsList([]);
        setTotal(0);
        setTotalPages(1);
      }
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No se pudieron cargar los códigos CUPS",
        variant: "destructive"
      });
      setCupsList([]);
      setTotal(0);
      setTotalPages(1);
    }
  };

  // Cargar categorías disponibles
  useEffect(() => {
    let mounted = true;
    
    // Categorías hardcodeadas como fallback
    const FALLBACK_CATEGORIES = ['Ecografía', 'Ecografía Doppler', 'Odontología'];
    
    (async () => {
      try {
        const cats = await api.getCupsCategories();
        console.log('Categorías recibidas:', cats, 'Tipo:', typeof cats, 'Es array:', Array.isArray(cats));
        
        if (!mounted) return;
        
        // Asegurarse de que cats es un array - validación muy estricta
        let validCategories: string[] = [];
        
        if (Array.isArray(cats)) {
          validCategories = cats.filter(c => typeof c === 'string' && c.length > 0);
        } else if (cats && typeof cats === 'object' && 'data' in cats && Array.isArray(cats.data)) {
          console.log('Extrayendo cats.data:', cats.data);
          validCategories = cats.data.filter(c => typeof c === 'string' && c.length > 0);
        } else {
          console.warn('Formato de categorías inesperado:', cats);
        }
        
        // Si no se obtuvieron categorías válidas, usar fallback
        if (validCategories.length === 0) {
          console.warn('Usando categorías hardcodeadas como fallback');
          validCategories = FALLBACK_CATEGORIES;
        }
        
        setCategories(validCategories);
      } catch (e: any) {
        console.error('Error al cargar categorías:', e);
        if (mounted) {
          // Usar categorías hardcodeadas en caso de error
          console.warn('Error en API, usando categorías hardcodeadas');
          setCategories(FALLBACK_CATEGORIES);
        }
      }
    })();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Cargar CUPS con filtros y paginación
  useEffect(() => {
    reloadCupsList();
  }, [page, search, categoryFilter, statusFilter]);

  const handleSubmit = async () => {
    const code = formData.code.trim();
    const name = formData.name.trim();
    const price = Number(formData.price);

    if (!code) {
      toast({
        title: "Código requerido",
        description: "Ingresa el código CUPS",
        variant: "destructive"
      });
      return;
    }

    if (!name) {
      toast({
        title: "Nombre requerido",
        description: "Ingresa el nombre del procedimiento",
        variant: "destructive"
      });
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      toast({
        title: "Precio inválido",
        description: "Ingresa un precio válido",
        variant: "destructive"
      });
      return;
    }

    try {
      const dataToSend = {
        code,
        name,
        description: formData.description || null,
        category: formData.category || null,
        price,
        requires_authorization: formData.requires_authorization ? 1 : 0
      };

      if (editingCups) {
        await api.updateCups(editingCups.id, dataToSend);
        toast({
          title: "CUPS actualizado",
          description: `Se guardaron los cambios de "${code}"`
        });
      } else {
        await api.createCups(dataToSend);
        toast({
          title: "CUPS creado",
          description: `Se agregó el código "${code}"`
        });
      }

      // Recargar la lista
      await reloadCupsList();

      // Resetear formulario
      setFormData({
        code: "",
        name: "",
        description: "",
        category: "",
        price: 0,
        requires_authorization: false
      });
      setEditingCups(null);
      setIsDialogOpen(false);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || (editingCups ? 'No se pudo actualizar' : 'No se pudo crear'),
        variant: "destructive"
      });
    }
  };

  const handleEdit = (cups: Cups) => {
    setEditingCups(cups);
    setFormData({
      code: cups.code,
      name: cups.name,
      description: cups.description || "",
      category: cups.category || "",
      price: Number(cups.price) || 0,
      requires_authorization: Boolean(cups.requires_authorization)
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number, code: string) => {
    const ok = window.confirm(`¿Eliminar el código CUPS "${code}"?`);
    if (!ok) return;

    try {
      await api.deleteCups(id);
      toast({
        title: "CUPS eliminado",
        description: `Se eliminó el código "${code}"`
      });
      
      // Recargar la lista
      await reloadCupsList();
    } catch (e: any) {
      toast({
        title: "No se pudo eliminar",
        description: e?.message || 'Error eliminando el código CUPS',
        variant: 'destructive'
      });
    }
  };

  const handleStatusToggle = async (cups: Cups) => {
    try {
      const newStatus = cups.status === 'Activo' ? 'Inactivo' : 'Activo';
      await api.updateCups(cups.id, { status: newStatus });
      
      // Actualizar la lista localmente
      setCupsList(prev => prev.map(c => 
        c.id === cups.id ? { ...c, status: newStatus } : c
      ));
      
      toast({
        title: "Estado actualizado",
        description: `${cups.code}: ${newStatus}`
      });
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || 'No se pudo cambiar el estado',
        variant: 'destructive'
      });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Gestión de Códigos CUPS
            </CardTitle>
            <CardDescription>
              Administra los códigos de procedimientos y servicios del sistema
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setFormData({
                    code: "",
                    name: "",
                    description: "",
                    category: "",
                    price: 0,
                    requires_authorization: false
                  });
                  setEditingCups(null);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo CUPS
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingCups ? "Editar Código CUPS" : "Nuevo Código CUPS"}
                </DialogTitle>
                <DialogDescription>
                  {editingCups
                    ? "Modifica los datos del código CUPS"
                    : "Agrega un nuevo código de procedimiento al sistema"
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="code">Código CUPS *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="Ej: 890201"
                      disabled={!!editingCups}
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Categoría</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="Ej: Consulta, Procedimiento"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="name">Nombre del Procedimiento *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Consulta de primera vez por medicina general"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción detallada del procedimiento..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="price">Precio (COP) *</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="requires_auth"
                    checked={formData.requires_authorization}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, requires_authorization: checked })
                    }
                  />
                  <Label htmlFor="requires_auth" className="cursor-pointer">
                    Requiere autorización previa
                  </Label>
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmit}>
                    {editingCups ? "Actualizar" : "Crear"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="md:col-span-2">
            <Label htmlFor="search">Buscar</Label>
            <Input
              id="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por código o nombre..."
            />
          </div>
          <div>
            <Label htmlFor="category-filter">Categoría</Label>
            <Select value={categoryFilter} onValueChange={(value) => {
              setCategoryFilter(value);
              setPage(1);
            }}>
              <SelectTrigger id="category-filter">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Array.isArray(categories) && categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="status-filter">Estado</Label>
            <Select value={statusFilter} onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}>
              <SelectTrigger id="status-filter">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Activo">Activos</SelectItem>
                <SelectItem value="Inactivo">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Lista de CUPS */}
        <div className="space-y-3">
          {cupsList.map((cups) => (
            <div key={cups.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="font-mono">
                      {cups.code}
                    </Badge>
                    <Badge variant={cups.status === 'Activo' ? "default" : "secondary"}>
                      {cups.status}
                    </Badge>
                    {cups.category && (
                      <Badge variant="outline">
                        {cups.category}
                      </Badge>
                    )}
                    {cups.requires_authorization === 1 && (
                      <Badge variant="destructive" className="text-xs">
                        Requiere Autorización
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold mb-1">{cups.name}</h3>
                  {cups.description && (
                    <p className="text-sm text-gray-600 mb-2">{cups.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1 font-semibold text-green-700">
                      <DollarSign className="w-4 h-4" />
                      <span>{formatPrice(cups.price)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 items-start">
                  <div className="flex items-center gap-2 mr-2">
                    <Switch
                      checked={cups.status === 'Activo'}
                      onCheckedChange={() => handleStatusToggle(cups)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(cups)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(cups.id, cups.code)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          
          {cupsList.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No se encontraron códigos CUPS
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-gray-600">
                {total} resultado(s) — Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CupsManagement;
