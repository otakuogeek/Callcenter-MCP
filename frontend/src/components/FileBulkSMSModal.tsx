import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Send,
  Loader2,
  Upload,
  FileText,
  Users,
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  AlertCircle,
  Phone,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileBulkSMSModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface RecipientEntry {
  name: string;
  phone: string;
  identification?: string;
  age?: string;
  hour?: string;
  originalPhone: string;
}

interface SendResult {
  name: string;
  phone: string;
  status: "enviado" | "fallido" | "error";
  error?: string;
  message_id?: string;
}

/**
 * Normaliza un número telefónico al formato colombiano +57XXXXXXXXXX
 */
function normalizePhone(raw: string): string {
  let cleaned = raw.replace(/\D/g, "");
  // Remove leading 0
  if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);
  // 10-digit Colombian mobile (starts with 3)
  if (cleaned.length === 10 && cleaned.startsWith("3")) {
    return "+57" + cleaned;
  }
  // Already has 57 prefix
  if (cleaned.startsWith("57") && cleaned.length === 12) {
    return "+" + cleaned;
  }
  // If it has no country code but is 10 digits
  if (cleaned.length === 10) {
    return "+57" + cleaned;
  }
  // Return as-is with +
  if (cleaned.length >= 10) {
    return "+" + cleaned;
  }
  return raw; // Can't normalize
}

/**
 * Parse CSV content into recipient entries.
 * Expects columns: HORA, PACIENTE, EDAD, IDENTIFICACION, TELEFONO
 * Also supports: NOMBRE, PHONE, CELULAR, etc.
 */
function parseCSV(text: string): RecipientEntry[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  // Detect separator
  const headerLine = lines[0];
  const sep = headerLine.includes("\t")
    ? "\t"
    : headerLine.includes(";")
    ? ";"
    : ",";

  const headers = headerLine.split(sep).map((h) => h.trim().toUpperCase().replace(/['"]/g, ""));

  // Map columns
  const colMap = {
    name: headers.findIndex(
      (h) =>
        h.includes("PACIENTE") ||
        h.includes("NOMBRE") ||
        h.includes("NAME") ||
        h.includes("PATIENT")
    ),
    phone: headers.findIndex(
      (h) =>
        h.includes("TELEFONO") ||
        h.includes("TELÉFONO") ||
        h.includes("CELULAR") ||
        h.includes("PHONE") ||
        h.includes("MOVIL") ||
        h.includes("MÓVIL")
    ),
    identification: headers.findIndex(
      (h) =>
        h.includes("IDENTIFICACION") ||
        h.includes("IDENTIFICACIÓN") ||
        h.includes("CEDULA") ||
        h.includes("CÉDULA") ||
        h.includes("DOCUMENTO") ||
        h.includes("ID")
    ),
    age: headers.findIndex((h) => h.includes("EDAD") || h.includes("AGE")),
    hour: headers.findIndex((h) => h.includes("HORA") || h.includes("HOUR") || h.includes("TIME")),
  };

  if (colMap.name === -1 || colMap.phone === -1) {
    return [];
  }

  const results: RecipientEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim().replace(/^["']|["']$/g, ""));
    const rawName = cols[colMap.name] || "";
    const rawPhone = cols[colMap.phone] || "";

    if (!rawName || !rawPhone) continue;

    const phone = normalizePhone(rawPhone);

    results.push({
      name: rawName,
      phone,
      originalPhone: rawPhone,
      identification: colMap.identification >= 0 ? cols[colMap.identification] : undefined,
      age: colMap.age >= 0 ? cols[colMap.age] : undefined,
      hour: colMap.hour >= 0 ? cols[colMap.hour] : undefined,
    });
  }

  return results;
}

const DEFAULT_DOCTOR = "RUTH YANIRA AGUILERA";
const DEFAULT_MESSAGE_TEMPLATE = `Hola [NOMBRE_PACIENTE], lamentamos informarte que tu cita de hoy con la Dra. [NOMBRE_DOCTOR] ha sido cancelada por el corte de luz general en Barbosa. Ofrecemos disculpas por el inconveniente. Por favor, atento a nuestros canales para la reprogramación.\n\n- Fundación Biosanar IPS`;

const FileBulkSMSModal = ({ isOpen, onClose, onSuccess }: FileBulkSMSModalProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recipients, setRecipients] = useState<RecipientEntry[]>([]);
  const [doctorName, setDoctorName] = useState(DEFAULT_DOCTOR);
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_MESSAGE_TEMPLATE);
  const [fileName, setFileName] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<SendResult[] | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const resetState = () => {
    setRecipients([]);
    setDoctorName(DEFAULT_DOCTOR);
    setMessageTemplate(DEFAULT_MESSAGE_TEMPLATE);
    setFileName("");
    setSending(false);
    setSendResults(null);
    setPreviewMessage(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  /**
   * Build personalized message for a recipient
   */
  const buildMessage = useCallback(
    (name: string): string => {
      return messageTemplate
        .replace(/\[NOMBRE_PACIENTE\]/gi, name)
        .replace(/\[Nombre Paciente\]/gi, name)
        .replace(/\[NOMBRE_DOCTOR\]/gi, doctorName)
        .replace(/\[Nombre Doctor\]/gi, doctorName);
    },
    [messageTemplate, doctorName]
  );

  /**
   * Handle file selection (CSV)
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setSendResults(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) {
        setParseError("No se pudo leer el contenido del archivo.");
        return;
      }
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        setParseError(
          'No se encontraron datos válidos. Asegúrese de que el archivo CSV contenga columnas "PACIENTE" (o NOMBRE) y "TELEFONO" (o CELULAR).'
        );
        return;
      }
      setRecipients(parsed);
    };
    reader.onerror = () => {
      setParseError("Error al leer el archivo.");
    };
    reader.readAsText(file);
  };

  /**
   * Remove a recipient from the list
   */
  const removeRecipient = (idx: number) => {
    setRecipients((prev) => prev.filter((_, i) => i !== idx));
  };

  /**
   * Preview the message for the first recipient
   */
  const showPreview = () => {
    if (recipients.length > 0) {
      setPreviewMessage(buildMessage(recipients[0].name));
    }
  };

  /**
   * Send SMS to all recipients
   */
  const handleSend = async () => {
    if (recipients.length === 0) {
      toast({
        title: "Error",
        description: "No hay destinatarios cargados.",
        variant: "destructive",
      });
      return;
    }

    if (!messageTemplate.trim()) {
      toast({
        title: "Error",
        description: "Debe escribir un mensaje.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    setSendResults(null);

    try {
      const token = localStorage.getItem("token");
      const baseUrl = import.meta.env.VITE_API_URL || "https://biosanarcall.site/api";

      const payload = recipients.map((r) => ({
        name: r.name,
        phone: r.phone,
        message: buildMessage(r.name),
      }));

      const response = await fetch(`${baseUrl}/sms/send-file-bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipients: payload }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }

      const result = await response.json();
      const data = result.data;

      setSendResults(data.resultados || []);

      toast({
        title: "Envío completado",
        description: `${data.sms_enviados} enviados, ${data.sms_fallidos} fallidos de ${data.total_destinatarios} destinatarios`,
      });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast({
        title: "Error al enviar",
        description: err.message || "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const totalChars = messageTemplate.length;
  const smsPartsEstimate = totalChars <= 160 ? 1 : Math.ceil(totalChars / 153);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            SMS Masivo desde Archivo
          </DialogTitle>
          <DialogDescription>
            Cargue un archivo CSV con la lista de pacientes para enviar SMS personalizados de forma masiva.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* File Upload */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">1. Cargar archivo CSV</Label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0"
                disabled={sending}
              >
                <Upload className="w-4 h-4 mr-2" />
                Seleccionar archivo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv"
                className="hidden"
                onChange={handleFileUpload}
              />
              {fileName && (
                <span className="text-sm text-gray-600 truncate">
                  📄 {fileName}
                </span>
              )}
              {recipients.length > 0 && (
                <Badge variant="secondary" className="flex-shrink-0">
                  <Users className="w-3 h-3 mr-1" />
                  {recipients.length} destinatarios
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Formato CSV con columnas: HORA, PACIENTE, EDAD, IDENTIFICACION, TELEFONO.
              Separadores válidos: coma, punto y coma, tabulación.
            </p>
            {parseError && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {parseError}
              </div>
            )}
          </div>

          {/* Recipient Preview Table */}
          {recipients.length > 0 && !sendResults && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                2. Destinatarios cargados ({recipients.length})
              </Label>
              <ScrollArea className="h-[200px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      {recipients[0]?.hour && <TableHead>Hora</TableHead>}
                      <TableHead>Paciente</TableHead>
                      <TableHead>Teléfono</TableHead>
                      {recipients[0]?.identification && <TableHead>Identificación</TableHead>}
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.map((r, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                        {r.hour && <TableCell className="text-xs">{r.hour}</TableCell>}
                        <TableCell className="font-medium text-sm">{r.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-gray-400" />
                            <span className="text-sm font-mono">{r.phone}</span>
                          </div>
                        </TableCell>
                        {r.identification && (
                          <TableCell className="text-xs font-mono">{r.identification}</TableCell>
                        )}
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRecipient(idx)}
                            className="h-6 w-6 p-0"
                            disabled={sending}
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* Doctor Name */}
          {recipients.length > 0 && !sendResults && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">3. Nombre del especialista</Label>
              <Input
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="Ej: DIANA PAOLA YAÑEZ DIAZ"
                disabled={sending}
              />
            </div>
          )}

          {/* Message Template */}
          {recipients.length > 0 && !sendResults && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                4. Plantilla del mensaje
              </Label>
              <Textarea
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                rows={5}
                disabled={sending}
                className="font-mono text-sm"
              />
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  Variables disponibles: <code className="bg-gray-100 px-1 rounded">[NOMBRE_PACIENTE]</code>{" "}
                  <code className="bg-gray-100 px-1 rounded">[NOMBRE_DOCTOR]</code>
                </span>
                <span>
                  {totalChars} caracteres ≈ {smsPartsEstimate} parte(s) SMS
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={showPreview}
                  disabled={recipients.length === 0}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Vista previa
                </Button>
              </div>
              {previewMessage && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-3">
                    <p className="text-xs font-medium text-blue-700 mb-1">
                      Vista previa (para: {recipients[0]?.name})
                    </p>
                    <p className="text-sm text-blue-900 whitespace-pre-wrap">{previewMessage}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Send Results */}
          {sendResults && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Resultados del envío</Label>
              <div className="grid grid-cols-3 gap-3">
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-3 text-center">
                    <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                    <p className="text-lg font-bold text-green-700">
                      {sendResults.filter((r) => r.status === "enviado").length}
                    </p>
                    <p className="text-xs text-green-600">Enviados</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="p-3 text-center">
                    <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                    <p className="text-lg font-bold text-red-700">
                      {sendResults.filter((r) => r.status !== "enviado").length}
                    </p>
                    <p className="text-xs text-red-600">Fallidos</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-3 text-center">
                    <Users className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                    <p className="text-lg font-bold text-blue-700">{sendResults.length}</p>
                    <p className="text-xs text-blue-600">Total</p>
                  </CardContent>
                </Card>
              </div>
              <ScrollArea className="h-[200px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sendResults.map((r, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm">{r.name}</TableCell>
                        <TableCell className="text-sm font-mono">{r.phone}</TableCell>
                        <TableCell>
                          {r.status === "enviado" ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Enviado
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="w-3 h-3 mr-1" />
                              Fallido
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {sendResults ? (
            <Button onClick={handleClose}>Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={sending}>
                Cancelar
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending || recipients.length === 0 || !messageTemplate.trim()}
                className="bg-medical-600 hover:bg-medical-700"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando ({recipients.length})...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar SMS ({recipients.length})
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FileBulkSMSModal;
