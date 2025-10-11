// ============================================
// UTILIDADES PARA GENERACIÓN DE PDFs
// ============================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Patient, PatientFilters, PDFExportOptions } from '@/types/patient';
import { calculateAge } from '@/types/patient';

// Configuración de la marca
const BRAND_CONFIG = {
  name: 'FUNDACIÓN BIOSANAR IPS',
  address: 'Calle 123 #45-67, Bogotá D.C.',
  phone: '(+57) 601 234 5678',
  email: 'info@biosanarcall.site',
  website: 'www.biosanarcall.site',
  nit: 'NIT 900.123.456-7',
  primaryColor: [45, 123, 201] as [number, number, number], // Azul
  secondaryColor: [52, 152, 219] as [number, number, number], // Azul claro
};

// Función para agregar encabezado con logo
const addHeader = (doc: jsPDF, title: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Rectángulo de encabezado
  doc.setFillColor(...BRAND_CONFIG.primaryColor);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  // Logo (simulado con iniciales)
  doc.setFillColor(255, 255, 255);
  doc.circle(20, 17.5, 10, 'F');
  doc.setTextColor(...BRAND_CONFIG.primaryColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('FB', 15, 20);
  
  // Nombre de la institución
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(BRAND_CONFIG.name, 35, 15);
  
  // Subtítulo
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 35, 22);
  
  // Fecha de generación
  const currentDate = format(new Date(), "d 'de' MMMM 'de' yyyy - HH:mm", { locale: es });
  doc.setFontSize(8);
  doc.text(`Generado: ${currentDate}`, 35, 28);
};

// Función para agregar pie de página
const addFooter = (doc: jsPDF, pageNumber: number, totalPages: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(14, pageHeight - 20, pageWidth - 14, pageHeight - 20);
  
  // Información de contacto
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text(BRAND_CONFIG.address, 14, pageHeight - 15);
  doc.text(`${BRAND_CONFIG.phone} | ${BRAND_CONFIG.email}`, 14, pageHeight - 11);
  doc.text(`${BRAND_CONFIG.website} | ${BRAND_CONFIG.nit}`, 14, pageHeight - 7);
  
  // Número de página
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Página ${pageNumber} de ${totalPages}`,
    pageWidth - 14,
    pageHeight - 11,
    { align: 'right' }
  );
};

// ============================================
// GENERACIÓN DE PDF INDIVIDUAL
// ============================================

export const generatePatientPDF = (patient: Patient): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 45; // Posición inicial después del encabezado

  // Agregar encabezado
  addHeader(doc, 'Ficha Completa de Paciente');

  // Título de la sección
  doc.setFontSize(14);
  doc.setTextColor(...BRAND_CONFIG.primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMACIÓN DEL PACIENTE', 14, yPosition);
  yPosition += 10;

  // ========== SECCIÓN: INFORMACIÓN BÁSICA ==========
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_CONFIG.secondaryColor);
  doc.text('Información Básica', 14, yPosition);
  yPosition += 2;
  
  doc.setLineWidth(0.5);
  doc.setDrawColor(...BRAND_CONFIG.secondaryColor);
  doc.line(14, yPosition, pageWidth - 14, yPosition);
  yPosition += 8;

  const basicInfo = [
    ['Nombre Completo:', patient.name],
    ['Documento:', `${patient.document_type || 'CC'} ${patient.document}`],
    ['Fecha de Nacimiento:', patient.birth_date ? format(new Date(patient.birth_date), "d 'de' MMMM 'de' yyyy", { locale: es }) : 'N/A'],
    ['Edad:', patient.birth_date ? `${calculateAge(patient.birth_date)} años` : 'N/A'],
    ['Género:', patient.gender],
    ['Estado:', patient.status],
  ];

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  basicInfo.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 14, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(value || 'N/A', 60, yPosition);
    yPosition += 6;
  });

  yPosition += 5;

  // ========== SECCIÓN: INFORMACIÓN DE CONTACTO ==========
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_CONFIG.secondaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Información de Contacto', 14, yPosition);
  yPosition += 2;
  
  doc.setDrawColor(...BRAND_CONFIG.secondaryColor);
  doc.line(14, yPosition, pageWidth - 14, yPosition);
  yPosition += 8;

  const contactInfo = [
    ['Teléfono Principal:', patient.phone],
    ['Teléfono Alternativo:', patient.phone_alt],
    ['Correo Electrónico:', patient.email],
    ['Dirección:', patient.address],
    ['Municipio:', patient.municipality_name || patient.municipality],
    ['Zona:', patient.zone],
  ];

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  contactInfo.forEach(([label, value]) => {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(label, 14, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(value || 'N/A', 60, yPosition);
    yPosition += 6;
  });

  yPosition += 5;

  // ========== SECCIÓN: INFORMACIÓN MÉDICA Y DE SEGURO ==========
  if (yPosition > 240) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(11);
  doc.setTextColor(...BRAND_CONFIG.secondaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Información Médica y de Seguro', 14, yPosition);
  yPosition += 2;
  
  doc.setDrawColor(...BRAND_CONFIG.secondaryColor);
  doc.line(14, yPosition, pageWidth - 14, yPosition);
  yPosition += 8;

  const medicalInfo = [
    ['Grupo Sanguíneo:', patient.blood_group_name || patient.blood_group],
    ['EPS:', patient.eps_name],
    ['Tipo de Afiliación:', patient.insurance_affiliation_type],
    ['Tiene Discapacidad:', patient.has_disability ? 'Sí' : 'No'],
    ['Tipo de Discapacidad:', patient.disability_type],
  ];

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  medicalInfo.forEach(([label, value]) => {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(label, 14, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(value || 'N/A', 60, yPosition);
    yPosition += 6;
  });

  yPosition += 5;

  // ========== SECCIÓN: INFORMACIÓN DEMOGRÁFICA ==========
  if (yPosition > 220) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(11);
  doc.setTextColor(...BRAND_CONFIG.secondaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Información Demográfica', 14, yPosition);
  yPosition += 2;
  
  doc.setDrawColor(...BRAND_CONFIG.secondaryColor);
  doc.line(14, yPosition, pageWidth - 14, yPosition);
  yPosition += 8;

  const demographicInfo = [
    ['Nivel de Educación:', patient.education_level],
    ['Estado Civil:', patient.marital_status],
    ['Grupo Poblacional:', patient.population_group],
    ['Estrato:', patient.estrato?.toString()],
  ];

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  demographicInfo.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 14, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(value || 'N/A', 60, yPosition);
    yPosition += 6;
  });

  // Notas (si existen)
  if (patient.notes) {
    yPosition += 5;
    
    if (yPosition > 220) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(11);
    doc.setTextColor(...BRAND_CONFIG.secondaryColor);
    doc.setFont('helvetica', 'bold');
    doc.text('Notas y Observaciones', 14, yPosition);
    yPosition += 2;
    
    doc.setDrawColor(...BRAND_CONFIG.secondaryColor);
    doc.line(14, yPosition, pageWidth - 14, yPosition);
    yPosition += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    const splitNotes = doc.splitTextToSize(patient.notes, pageWidth - 28);
    doc.text(splitNotes, 14, yPosition);
  }

  // Agregar pie de página
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  // Guardar PDF
  const fileName = `Paciente_${patient.document}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
  doc.save(fileName);
};

// ============================================
// GENERACIÓN DE PDF DE LISTADO
// ============================================

export const generatePatientsListPDF = (
  patients: Patient[],
  filters?: PatientFilters,
  stats?: {
    total: number;
    active: number;
    inactive: number;
  }
): void => {
  const doc = new jsPDF('landscape'); // Modo horizontal para más columnas
  const pageWidth = doc.internal.pageSize.getWidth();

  // Agregar encabezado
  addHeader(doc, `Listado de Pacientes - Total: ${patients.length}`);

  let yPosition = 45;

  // Mostrar filtros aplicados (si existen)
  if (filters && (filters.search || filters.status || filters.eps_ids?.length)) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'italic');
    
    const filtersText: string[] = [];
    if (filters.search) filtersText.push(`Búsqueda: "${filters.search}"`);
    if (filters.status && filters.status !== 'Todos') filtersText.push(`Estado: ${filters.status}`);
    if (filters.gender && filters.gender !== 'Todos') filtersText.push(`Género: ${filters.gender}`);
    if (filters.eps_ids && filters.eps_ids.length > 0) filtersText.push(`EPS: ${filters.eps_ids.length} seleccionadas`);
    
    if (filtersText.length > 0) {
      doc.text(`Filtros aplicados: ${filtersText.join(' | ')}`, 14, yPosition);
      yPosition += 8;
    }
  }

  // Estadísticas (si se proporcionan)
  if (stats) {
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(`Estadísticas: Total: ${stats.total} | Activos: ${stats.active} | Inactivos: ${stats.inactive}`, 14, yPosition);
    yPosition += 8;
  }

  // Preparar datos para la tabla
  const tableData = patients.map((patient) => {
    const age = patient.birth_date ? calculateAge(patient.birth_date) : 'N/A';
    return [
      patient.document,
      patient.name,
      patient.phone || 'N/A',
      patient.email || 'N/A',
      patient.eps_name || 'Sin EPS',
      patient.insurance_affiliation_type || 'N/A',
      patient.gender,
      age.toString(),
      patient.status,
    ];
  });

  // Generar tabla con autoTable
  autoTable(doc, {
    startY: yPosition,
    head: [[
      'Documento',
      'Nombre Completo',
      'Teléfono',
      'Correo',
      'EPS',
      'Tipo Afiliación',
      'Género',
      'Edad',
      'Estado'
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: BRAND_CONFIG.primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [0, 0, 0],
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { cellWidth: 25 }, // Documento
      1: { cellWidth: 50 }, // Nombre
      2: { cellWidth: 25 }, // Teléfono
      3: { cellWidth: 40 }, // Correo
      4: { cellWidth: 35 }, // EPS
      5: { cellWidth: 25 }, // Tipo
      6: { cellWidth: 20 }, // Género
      7: { cellWidth: 15 }, // Edad
      8: { cellWidth: 20 }, // Estado
    },
    margin: { left: 14, right: 14 },
  });

  // Agregar pie de página
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  // Guardar PDF
  const fileName = `Listado_Pacientes_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
  doc.save(fileName);
};

// Función helper para generar PDF según opciones
export const generatePDF = (options: PDFExportOptions, patients?: Patient[], patient?: Patient): void => {
  if (options.type === 'individual' && patient) {
    generatePatientPDF(patient);
  } else if (options.type === 'list' && patients) {
    generatePatientsListPDF(patients, options.filters);
  } else {
    console.error('Opciones de PDF inválidas o datos faltantes');
  }
};
