import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Project } from '@/types/project';
import logoLarin from '@/assets/logo_larin_pdf.png';

interface BudgetItem {
  category: string;
  activity_name: string;
  assignee_name: string;
  hourly_rate: number;
  hours_worked: number;
  total_cost: number;
}

interface ClientData {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

interface QuoteData {
  project: Project & {
    clients?: ClientData;
    account_profile?: { first_name: string; last_name: string };
  };
  budgetItems: BudgetItem[];
}

const addFooter = (doc: jsPDF, pageNumber: number, totalPages: number) => {
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Larin Srl - C.F. e P.I. 01144900253 - PAG ${pageNumber} di ${totalPages}`,
    105,
    287,
    { align: 'center' }
  );
};

export const generatePdfQuote = async (data: QuoteData) => {
  const { project, budgetItems } = data;
  
  const doc = new jsPDF();
  
  // Header - Client information (left side)
  let yPos = 20;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('SPETTABILE', 20, yPos);
  yPos += 5;
  
  doc.setFont('helvetica', 'normal');
  if (project.clients?.name) {
    doc.text(project.clients.name, 20, yPos);
    yPos += 4;
    
    if (project.clients.address) {
      doc.text(project.clients.address, 20, yPos);
      yPos += 4;
    }
    
    // Parse notes for PI and CF if available
    const notes = project.clients.notes || '';
    if (notes.includes('PI:') || notes.includes('P.I.')) {
      const piMatch = notes.match(/P\.?I\.?:?\s*([A-Z0-9]+)/i);
      if (piMatch) {
        doc.text(`PI ${piMatch[1]}`, 20, yPos);
        yPos += 4;
      }
    }
    if (notes.includes('CF:') || notes.includes('C.F.')) {
      const cfMatch = notes.match(/C\.?F\.?:?\s*([A-Z0-9]+)/i);
      if (cfMatch) {
        doc.text(`CF ${cfMatch[1]}`, 20, yPos);
      }
    }
  }
  
  // Header - Larin information (right side)
  yPos = 20;
  
  // Add logo
  try {
    doc.addImage(logoLarin, 'PNG', 160, yPos - 5, 30, 10);
    yPos += 8;
  } catch (e) {
    console.error('Error loading logo:', e);
  }
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Larin Srl', 160, yPos);
  yPos += 3.5;
  doc.text('P. iva 01144900253', 160, yPos);
  yPos += 3.5;
  doc.text('Foro Buonaparte 59', 160, yPos);
  yPos += 3.5;
  doc.text('20121 - Milano (MI)', 160, yPos);
  yPos += 3.5;
  doc.text('Tel. 0437 1901011', 160, yPos);
  yPos += 3.5;
  doc.text('www.larin.it', 160, yPos);
  yPos += 3.5;
  doc.text('amministrazione@larin.it', 160, yPos);
  
  // Title section
  yPos = 60;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const preventiveDate = new Date().toLocaleDateString('it-IT');
  const preventiveNumber = project.id?.substring(0, 8).toUpperCase() || '---';
  doc.text(`Preventivo n. ${preventiveNumber} del ${preventiveDate}`, 105, yPos, { align: 'center' });
  
  yPos += 8;
  doc.setFontSize(12);
  doc.text(project.name, 105, yPos, { align: 'center' });
  
  yPos += 2;
  if (project.description) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(project.description, 105, yPos + 5, { align: 'center', maxWidth: 170 });
    yPos += 10;
  }
  
  // Budget items table
  yPos += 15;
  
  // Group items by category
  const groupedItems: { [key: string]: BudgetItem[] } = {};
  budgetItems.forEach(item => {
    if (!groupedItems[item.category]) {
      groupedItems[item.category] = [];
    }
    groupedItems[item.category].push(item);
  });
  
  const tableData: any[] = [];
  Object.entries(groupedItems).forEach(([category, items]) => {
    items.forEach((item, index) => {
      tableData.push([
        index === 0 ? category : '',
        item.activity_name,
        item.assignee_name,
        `${item.hours_worked.toFixed(1)}h`,
        `€${item.hourly_rate.toFixed(2)}`,
        `€${item.total_cost.toFixed(2)}`
      ]);
    });
  });
  
  autoTable(doc, {
    startY: yPos,
    head: [['Categoria', 'Attività', 'Figura', 'Ore', 'Tariffa/h', 'Totale']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 30, fontStyle: 'bold' },
      1: { cellWidth: 50 },
      2: { cellWidth: 30 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
    },
    didDrawPage: (data) => {
      // Add footer to each page
      addFooter(doc, doc.getNumberOfPages(), doc.getNumberOfPages());
    },
  });
  
  // Summary section
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  // Check if we need a new page for summary
  if (finalY > 240) {
    doc.addPage();
    addFooter(doc, doc.getNumberOfPages(), doc.getNumberOfPages());
  }
  
  const summaryY = finalY > 240 ? 20 : finalY;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  
  // Summary table
  autoTable(doc, {
    startY: summaryY,
    body: [
      ['IMPONIBILE', `€${project.total_budget.toFixed(2)}`],
      ['IVA 22%', `€${(project.total_budget * 0.22).toFixed(2)}`],
      ['TOTALE', `€${(project.total_budget * 1.22).toFixed(2)}`],
    ],
    theme: 'plain',
    styles: {
      fontSize: 11,
      cellPadding: 3,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 140, halign: 'right' },
      1: { cellWidth: 40, halign: 'right' },
    },
  });
  
  // Notes section
  const notesY = (doc as any).lastAutoTable.finalY + 10;
  if (notesY < 260) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTE', 20, notesY);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ore Totali: ${project.total_hours.toFixed(1)}h`, 20, notesY + 6);
  }
  
  // Update footer on all pages with correct total
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }
  
  // Save the PDF
  const fileName = `Preventivo_${preventiveNumber}_${project.name.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
};
