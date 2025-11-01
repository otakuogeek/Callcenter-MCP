import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { 
  BookOpen, 
  ChevronRight, 
  Home, 
  Search, 
  Loader2,
  FileText,
  ChevronLeft,
} from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { wikiApi, WikiDoc, WikiDocContent, WIKI_CATEGORIES, getCategoryIcon } from "@/lib/wikiApi";

export default function Wiki() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  
  const [docs, setDocs] = useState<WikiDoc[]>([]);
  const [currentDoc, setCurrentDoc] = useState<WikiDocContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Cargar lista de documentos al montar
  useEffect(() => {
    loadDocs();
  }, []);

  // Cargar documento cuando cambia el slug
  useEffect(() => {
    if (slug) {
      loadDoc(slug);
    } else {
      setCurrentDoc(null);
      setLoading(false);
    }
  }, [slug]);

  const loadDocs = async () => {
    try {
      const data = await wikiApi.listDocs();
      setDocs(data);
    } catch (error) {
      console.error("Error loading docs:", error);
    }
  };

  const loadDoc = async (docSlug: string) => {
    setLoading(true);
    try {
      const data = await wikiApi.getDoc(docSlug);
      setCurrentDoc(data);
    } catch (error) {
      console.error("Error loading doc:", error);
      setCurrentDoc(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const results = await wikiApi.search(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleDocClick = (docSlug: string) => {
    navigate(`/wiki/${docSlug}`);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleBackToIndex = () => {
    navigate("/wiki");
    setSearchQuery("");
    setSearchResults([]);
  };

  // Organizar documentos por categorías
  const docsByCategory: Record<string, WikiDoc[]> = {};
  Object.entries(WIKI_CATEGORIES).forEach(([category, slugs]) => {
    docsByCategory[category] = slugs
      .map(slug => docs.find(doc => doc.slug === slug))
      .filter(Boolean) as WikiDoc[];
  });

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full min-h-screen bg-background">
        <div className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
          <div className="flex items-center gap-2 p-2">
            <SidebarTrigger />
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="font-semibold text-lg">Wiki del Sistema</h1>
          </div>
        </div>

        <div className="flex h-[calc(100vh-60px)]">
          {/* Sidebar de navegación de documentos */}
          <div className="w-80 border-r bg-muted/30">
            <div className="p-4 space-y-4">
              {/* Búsqueda */}
              <form onSubmit={handleSearch}>
                <div className="flex gap-2">
                  <Input
                    placeholder="Buscar en la documentación..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={searching}>
                    {searching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </form>

              {/* Resultados de búsqueda */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-muted-foreground">
                    Resultados ({searchResults.length})
                  </h3>
                  <ScrollArea className="h-64">
                    {searchResults.map((result) => (
                      <button
                        key={result.slug}
                        onClick={() => handleDocClick(result.slug)}
                        className="w-full text-left p-2 rounded hover:bg-accent transition-colors"
                      >
                        <div className="font-medium text-sm">{result.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {result.matches[0]?.content.substring(0, 60)}...
                        </div>
                      </button>
                    ))}
                  </ScrollArea>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchResults([])}
                    className="w-full"
                  >
                    Limpiar búsqueda
                  </Button>
                </div>
              )}

              <Separator />

              {/* Navegación por categorías */}
              <ScrollArea className="h-[calc(100vh-300px)]">
                <Accordion type="multiple" defaultValue={Object.keys(WIKI_CATEGORIES)}>
                  {Object.entries(docsByCategory).map(([category, categoryDocs]) => {
                    if (categoryDocs.length === 0) return null;
                    
                    const Icon = getCategoryIcon(category);
                    
                    return (
                      <AccordionItem key={category} value={category}>
                        <AccordionTrigger className="text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {category}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-1 ml-6">
                            {categoryDocs.map((doc) => (
                              <button
                                key={doc.slug}
                                onClick={() => handleDocClick(doc.slug)}
                                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
                                  slug === doc.slug
                                    ? "bg-primary text-primary-foreground font-medium"
                                    : "hover:bg-accent"
                                }`}
                              >
                                <FileText className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{doc.title}</span>
                              </button>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </ScrollArea>
            </div>
          </div>

          {/* Contenido del documento */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-4xl mx-auto p-8">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : currentDoc ? (
                <div>
                  {/* Breadcrumb */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                    <button
                      onClick={handleBackToIndex}
                      className="hover:text-primary transition-colors flex items-center gap-1"
                    >
                      <Home className="h-4 w-4" />
                      Inicio
                    </button>
                    <ChevronRight className="h-4 w-4" />
                    <span className="text-foreground font-medium">{currentDoc.title}</span>
                  </div>

                  {/* Contenido markdown */}
                  <article className="prose prose-slate dark:prose-invert max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw, rehypeSanitize]}
                      components={{
                        // Estilos personalizados para elementos markdown
                        h1: ({ children }) => (
                          <h1 className="text-4xl font-bold mt-8 mb-4 text-primary border-b pb-2">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-3xl font-semibold mt-6 mb-3">{children}</h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-2xl font-semibold mt-5 mb-2">{children}</h3>
                        ),
                        code: ({ inline, children, ...props }: any) =>
                          inline ? (
                            <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                              {children}
                            </code>
                          ) : (
                            <code
                              className="block bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono"
                              {...props}
                            >
                              {children}
                            </code>
                          ),
                        pre: ({ children }) => (
                          <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-4">
                            {children}
                          </pre>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-6">
                            <table className="min-w-full divide-y divide-border">
                              {children}
                            </table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th className="px-4 py-2 bg-muted font-semibold text-left">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="px-4 py-2 border-t">{children}</td>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-primary pl-4 italic my-4">
                            {children}
                          </blockquote>
                        ),
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            className="text-primary hover:underline"
                            target={href?.startsWith('http') ? '_blank' : undefined}
                            rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {currentDoc.content}
                    </ReactMarkdown>
                  </article>

                  {/* Botón para volver */}
                  <div className="mt-12 pt-6 border-t">
                    <Button
                      variant="outline"
                      onClick={handleBackToIndex}
                      className="gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Volver al índice
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16">
                  <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-2xl font-semibold mb-2">
                    Bienvenido a la Wiki del Sistema
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    Selecciona un documento de la barra lateral para comenzar
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mt-8">
                    <button
                      onClick={() => handleDocClick('manual-uso')}
                      className="p-6 border rounded-lg hover:border-primary hover:bg-accent transition-all text-left"
                    >
                      <BookOpen className="h-8 w-8 text-primary mb-3" />
                      <h3 className="font-semibold mb-1">Manual de Uso</h3>
                      <p className="text-sm text-muted-foreground">
                        Guía completa con capturas de todas las funcionalidades
                      </p>
                    </button>
                    <button
                      onClick={() => handleDocClick('resumen-proyecto')}
                      className="p-6 border rounded-lg hover:border-primary hover:bg-accent transition-all text-left"
                    >
                      <FileText className="h-8 w-8 text-primary mb-3" />
                      <h3 className="font-semibold mb-1">Arquitectura</h3>
                      <p className="text-sm text-muted-foreground">
                        Estructura técnica, features y optimizaciones
                      </p>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
}
