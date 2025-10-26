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

// ============================================
// GENERACIÓN DE PDF PARA COLA DE ESPERA
// ============================================

interface WaitingListPatient {
  id: number;
  queue_position?: number;
  patient_name?: string;
  patient_document?: string;
  patient_phone?: string;
  priority_level?: string;
  reason?: string;
  created_at?: string;
  waiting_days?: number;
  call_type?: string;
  cups_code?: string;
  cups_name?: string;
}

interface WaitingListSection {
  specialty_id: number;
  specialty_name: string;
  total_waiting: number;
  patients: WaitingListPatient[];
}

export const generateWaitingListPDF = (
  specialtySection: WaitingListSection,
  includeAllSpecialties?: boolean,
  allSections?: WaitingListSection[]
): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Agregar encabezado
  addHeader(doc, 'Lista de Espera por Especialidad');

  let yPosition = 45;

  // Si se solicitan todas las especialidades
  const sectionsToProcess = includeAllSpecialties && allSections ? allSections : [specialtySection];
  
  sectionsToProcess.forEach((section, sectionIndex) => {
    // Si no es la primera especialidad, agregar nueva página
    if (sectionIndex > 0) {
      doc.addPage();
      yPosition = 20;
    }

    // Título de la especialidad
    doc.setFontSize(14);
    doc.setTextColor(...BRAND_CONFIG.primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.text(section.specialty_name.toUpperCase(), 14, yPosition);
    
    yPosition += 7;

    // Información de resumen
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total de pacientes en espera: ${section.total_waiting}`, 14, yPosition);
    
    yPosition += 3;
    doc.text(`Fecha: ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}`, 14, yPosition);
    
    yPosition += 10;

    // Tabla de pacientes
    const tableData = section.patients.map((patient, index) => {
      // Calcular días en espera si hay fecha de creación
      let waitingDays = 'N/A';
      if (patient.created_at) {
        try {
          const createdDate = new Date(patient.created_at);
          const today = new Date();
          const diffTime = Math.abs(today.getTime() - createdDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          waitingDays = diffDays.toString();
        } catch (e) {
          waitingDays = 'N/A';
        }
      }

      return [
        (patient.queue_position || index + 1).toString(),
        patient.patient_name || 'Sin nombre',
        patient.patient_document || 'N/A',
        patient.patient_phone || 'N/A',
        patient.priority_level || 'Normal',
        waitingDays,
        patient.call_type === 'reagendar' ? '🔄 Reagendar' : 'Normal',
        (() => {
          const reason = patient.reason || 'Sin motivo especificado';
          return reason.length > 40 ? reason.substring(0, 37) + '...' : reason;
        })(),
      ];
    });

    autoTable(doc, {
      startY: yPosition,
      head: [[
        'Pos.',
        'Paciente',
        'Documento',
        'Teléfono',
        'Prioridad',
        'Días',
        'Tipo',
        'Motivo'
      ]],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: BRAND_CONFIG.primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' }, // Posición
        1: { cellWidth: 40 }, // Nombre
        2: { cellWidth: 25 }, // Documento
        3: { cellWidth: 25 }, // Teléfono
        4: { cellWidth: 22, halign: 'center' }, // Prioridad
        5: { cellWidth: 15, halign: 'center' }, // Días
        6: { cellWidth: 20 }, // Tipo
        7: { cellWidth: 'auto' }, // Motivo
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        // Colorear la columna de prioridad
        if (data.column.index === 4 && data.section === 'body') {
          const priorityText = data.cell.text[0];
          if (priorityText === 'Urgente') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else if (priorityText === 'Alta') {
            data.cell.styles.textColor = [234, 88, 12];
            data.cell.styles.fontStyle = 'bold';
          } else if (priorityText === 'Normal') {
            data.cell.styles.textColor = [34, 197, 94];
          }
        }
        // Marcar reagendamientos
        if (data.column.index === 6 && data.section === 'body') {
          const typeText = data.cell.text[0];
          if (typeText.includes('Reagendar')) {
            data.cell.styles.fillColor = [254, 243, 199];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    // Estadísticas de prioridad
    const priorityStats = section.patients.reduce((acc, patient) => {
      const priority = patient.priority_level || 'Normal';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const finalY = (doc as any).lastAutoTable.finalY || yPosition + 50;
    yPosition = finalY + 10;

    // Agregar estadísticas
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen por Prioridad:', 14, yPosition);
    
    yPosition += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    Object.entries(priorityStats).forEach(([priority, count]) => {
      const color: [number, number, number] = 
        priority === 'Urgente' ? [220, 38, 38] :
        priority === 'Alta' ? [234, 88, 12] :
        priority === 'Normal' ? [34, 197, 94] :
        [107, 114, 128];
      
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(`• ${priority}: ${count} paciente(s)`, 14, yPosition);
      yPosition += 5;
    });
  });

  // Agregar pie de página a todas las páginas
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  // Guardar PDF
  const specialtyName = includeAllSpecialties 
    ? 'Todas_Especialidades' 
    : specialtySection.specialty_name.replace(/\s+/g, '_');
  const fileName = `Cola_Espera_${specialtyName}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
  doc.save(fileName);
};

// ============================================
// GENERAR PDF DE AGENDA DIARIA
// ============================================

interface DailyAgendaAppointment {
  id: number;
  patient_name: string;
  patient_document?: string;
  patient_phone?: string;
  patient_email?: string;
  patient_eps?: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  reason?: string;
  age?: number;
}

interface DailyAgendaData {
  doctor_name: string;
  specialty_name: string;
  location_name: string;
  date: string;
  start_time: string;
  end_time: string;
  appointments: DailyAgendaAppointment[];
  room?: string;
}

export const generateDailyAgendaPDF = (agendaData: DailyAgendaData[]) => {
  // Crear documento en orientación horizontal (landscape)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter'
  });
  
  // Configurar primera página
  addHeader(doc, 'CITAS MÉDICAS AGENDA');
  
  let yPosition = 45;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  agendaData.forEach((agenda, agendaIndex) => {
    // Verificar si necesitamos una nueva página
    if (yPosition > pageHeight - 100) {
      doc.addPage();
      addHeader(doc, 'CITAS MÉDICAS AGENDA');
      yPosition = 45;
    }
    
    // Título principal de la agenda
    doc.setFillColor(45, 123, 201);
    doc.rect(14, yPosition, pageWidth - 28, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('CITAS MEDICAS AGENDA', pageWidth / 2, yPosition + 8, { align: 'center' });
    
    yPosition += 18;
    
    // Información del profesional en formato tabla limpio
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    
    // Fecha agenda
    doc.text('Fecha agenda:', 18, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(agenda.date + 'T00:00:00'), 'yyyy-MM-dd', { locale: es }), 60, yPosition);
    
    yPosition += 8;
    
    // Profesional
    doc.setFont('helvetica', 'bold');
    doc.text('Profesional:', 18, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(agenda.doctor_name.toUpperCase(), 60, yPosition);
    
    yPosition += 8;
    
    // Consultorio (si existe)
    if (agenda.room) {
      doc.setFont('helvetica', 'bold');
      doc.text('Consultorio:', 18, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(agenda.room, 60, yPosition);
      yPosition += 8;
    }
    
    // Especialidad
    doc.setFont('helvetica', 'bold');
    doc.text('Especialidad:', 18, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(agenda.specialty_name, 60, yPosition);
    
    yPosition += 8;
    
    // Línea separadora
    doc.setDrawColor(45, 123, 201);
    doc.setLineWidth(0.5);
    doc.line(14, yPosition, pageWidth - 14, yPosition);
    
    yPosition += 8;
    
    // Contar citas confirmadas
    const citasConfirmadas = agenda.appointments.filter((apt) => apt.status === 'Confirmada').length;
    const totalCitas = agenda.appointments.length;
    
    // Título de la sección de citas con contador
    doc.setFillColor(52, 152, 219);
    doc.rect(14, yPosition, pageWidth - 28, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`CITAS CONFIRMADAS (${citasConfirmadas} de ${totalCitas})`, pageWidth / 2, yPosition + 7, { align: 'center' });
    
    yPosition += 12;
    
    // Preparar datos para la tabla - SOLO CITAS CONFIRMADAS EN PDF
    const tableData = agenda.appointments
      .filter((apt) => apt.status === 'Confirmada') // FILTRAR SOLO CONFIRMADAS
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      .map((apt) => {
        // Extraer la hora directamente del string sin conversión de zona horaria
        // Format: "2025-10-21 09:00:00" o "2025-10-21T09:00:00"
        const scheduledStr = String(apt.scheduled_at);
        const timeMatch = scheduledStr.match(/(\d{2}):(\d{2}):(\d{2})/);
        const time = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}` : scheduledStr.slice(11, 19);
        
        const phone1 = apt.patient_phone || '';
        const phone2 = apt.patient_email?.includes('@') ? '' : apt.patient_email || '';
        
        return [
          time,
          apt.patient_name.toUpperCase(),
          apt.age?.toString() || '',
          apt.patient_document || '',
          apt.patient_eps || 'N/A',
          phone1,
          phone2 || '0', // Mostrar 0 si no hay segundo teléfono
        ];
      });
    
    // Generar tabla con estilo profesional
    autoTable(doc, {
      startY: yPosition,
      head: [['HORA', 'PACIENTE', 'EDAD', 'IDENTIFICACIÓN', 'EPS', 'TELÉFONO', 'TELÉFONO']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [45, 123, 201],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center',
        lineWidth: 0.5,
        lineColor: [0, 0, 0],
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 4,
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }, // Hora
        1: { cellWidth: 70, halign: 'left' }, // Paciente
        2: { cellWidth: 15, halign: 'center' }, // Edad
        3: { cellWidth: 30, halign: 'center' }, // Identificación
        4: { cellWidth: 40, halign: 'left' }, // EPS
        5: { cellWidth: 30, halign: 'center' }, // Teléfono 1
        6: { cellWidth: 30, halign: 'center' }, // Teléfono 2
      },
      margin: { left: 14, right: 14 },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      didDrawPage: (data) => {
        yPosition = data.cursor!.y;
      },
    });
    
    yPosition += 15;
    
    // Línea separadora entre agendas
    if (agendaIndex < agendaData.length - 1) {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(14, yPosition, pageWidth - 14, yPosition);
      yPosition += 10;
    }
  });
  
  // Agregar pie de página a todas las páginas
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }
  
  // Guardar PDF con nombre descriptivo
  const fechaAgenda = agendaData.length > 0 ? agendaData[0].date : format(new Date(), 'yyyy-MM-dd');
  const fileName = `Agenda_Diaria_${fechaAgenda.replace(/-/g, '')}.pdf`;
  doc.save(fileName);
};

// ============================================
// EXPORTACIÓN A EXCEL
// ============================================

import * as XLSX from 'xlsx';

interface ExcelAgendaData {
  doctor_name: string;
  specialty_name: string;
  location_name: string;
  date: string;
  start_time: string;
  end_time: string;
  appointments: ExcelAgendaAppointment[];
  room?: string;
}

interface ExcelAgendaAppointment {
  id: number;
  patient_name: string;
  patient_document?: string;
  patient_phone?: string;
  patient_email?: string;
  patient_eps?: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  reason?: string;
  age?: number;
}

export const exportDailyAgendaToExcel = (agendaData: ExcelAgendaData[]) => {
  // Crear un nuevo libro de Excel
  const workbook = XLSX.utils.book_new();
  
  // Para cada doctor, crear una hoja separada
  agendaData.forEach((agenda, index) => {
    // Preparar los datos para la hoja
    const sheetData: any[] = [];
    
    // Encabezado de información del doctor
    sheetData.push(['FUNDACIÓN BIOSANAR IPS']);
    sheetData.push(['AGENDA MÉDICA DIARIA']);
    sheetData.push([]);
    sheetData.push(['Doctor:', agenda.doctor_name]);
    sheetData.push(['Especialidad:', agenda.specialty_name]);
    sheetData.push(['Sede:', agenda.location_name]);
    sheetData.push(['Fecha:', format(new Date(agenda.date), 'dd/MM/yyyy', { locale: es })]);
    sheetData.push(['Horario:', `${agenda.start_time} - ${agenda.end_time}`]);
    if (agenda.room) {
      sheetData.push(['Consultorio:', agenda.room]);
    }
    sheetData.push([]);
    
    // Encabezado de la tabla de citas
    sheetData.push([
      'Hora',
      'Paciente',
      'Edad',
      'Identificación',
      'EPS',
      'Teléfono',
      'Correo',
      'Motivo',
      'Estado',
      'Duración (min)'
    ]);
    
    // Datos de las citas - ORDENAR POR ESTADO Y HORA
    if (agenda.appointments && agenda.appointments.length > 0) {
      // Ordenar: primero confirmadas, luego canceladas, luego pendientes
      const sortedAppointments = agenda.appointments.sort((a, b) => {
        // Prioridad de estados: Confirmada > Pendiente > Cancelada
        const statusOrder: { [key: string]: number } = {
          'Confirmada': 1,
          'Pendiente': 2,
          'Cancelada': 3
        };
        const statusA = statusOrder[a.status] || 4;
        const statusB = statusOrder[b.status] || 4;
        
        if (statusA !== statusB) {
          return statusA - statusB;
        }
        
        // Si el estado es igual, ordenar por hora
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      });
      
      sortedAppointments.forEach(apt => {
        // Extraer la hora directamente del string sin conversión de zona horaria
        let hora = 'N/A';
        if (apt.scheduled_at) {
          const scheduledStr = String(apt.scheduled_at);
          const timeMatch = scheduledStr.match(/(\d{2}):(\d{2})/);
          hora = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : scheduledStr.slice(11, 16);
        }
        
        sheetData.push([
          hora,
          apt.patient_name || 'N/A',
          apt.age || 'N/A',
          apt.patient_document || 'N/A',
          apt.patient_eps || 'N/A',
          apt.patient_phone || 'N/A',
          apt.patient_email || 'N/A',
          apt.reason || 'N/A',
          apt.status || 'N/A',
          apt.duration_minutes || 'N/A'
        ]);
      });
    } else {
      sheetData.push(['Sin citas programadas', '', '', '', '', '', '', '', '', '']);
    }
    
    // Agregar resumen detallado al final
    const confirmadas = agenda.appointments?.filter(apt => apt.status === 'Confirmada').length || 0;
    const canceladas = agenda.appointments?.filter(apt => apt.status === 'Cancelada').length || 0;
    const pendientes = agenda.appointments?.filter(apt => apt.status === 'Pendiente').length || 0;
    const totalCitas = agenda.appointments?.length || 0;
    
    sheetData.push([]);
    sheetData.push(['RESUMEN DE CITAS']);
    sheetData.push(['Total de citas:', totalCitas]);
    sheetData.push(['Confirmadas:', confirmadas]);
    sheetData.push(['Canceladas:', canceladas]);
    sheetData.push(['Pendientes:', pendientes]);
    sheetData.push([]);
    sheetData.push(['Generado:', format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })]);
    
    // Crear la hoja de cálculo
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    
    // Configurar anchos de columna
    worksheet['!cols'] = [
      { wch: 8 },   // Hora
      { wch: 25 },  // Paciente
      { wch: 6 },   // Edad
      { wch: 15 },  // Identificación
      { wch: 20 },  // EPS
      { wch: 15 },  // Teléfono
      { wch: 25 },  // Correo
      { wch: 30 },  // Motivo
      { wch: 12 },  // Estado
      { wch: 12 }   // Duración
    ];
    
    // Nombre de la hoja (máximo 31 caracteres para Excel)
    let sheetName = agenda.doctor_name.substring(0, 25);
    if (agendaData.length > 1) {
      sheetName = `${index + 1}. ${sheetName}`;
    }
    
    // Agregar la hoja al libro
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });
  
  // Generar nombre del archivo con especialidad y nombre del doctor
  const fechaAgenda = agendaData.length > 0 ? agendaData[0].date : format(new Date(), 'yyyy-MM-dd');
  const fechaFormateada = fechaAgenda.replace(/-/g, '');
  
  let fileName: string;
  if (agendaData.length === 1) {
    // Archivo individual: incluir especialidad y nombre del doctor
    const doctorName = agendaData[0].doctor_name
      .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g, '') // Eliminar caracteres especiales
      .replace(/\s+/g, '_') // Reemplazar espacios con guiones bajos
      .substring(0, 40); // Limitar longitud
    
    const specialty = agendaData[0].specialty_name
      .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 20);
    
    fileName = `Agenda_${specialty}_${doctorName}_${fechaFormateada}.xlsx`;
  } else {
    // Archivo múltiple: nombre genérico
    fileName = `Agenda_Diaria_${fechaFormateada}.xlsx`;
  }
  
  // Guardar el archivo
  XLSX.writeFile(workbook, fileName);
};

// Función específica para exportar una sola agenda
export const exportSingleAgendaToExcel = (agenda: ExcelAgendaData) => {
  exportDailyAgendaToExcel([agenda]);
};



