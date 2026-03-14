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
  is_product?: boolean;
  payment_terms?: string;
  vat_rate?: number;
}

interface ClientData {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

interface ServiceData {
  id: string;
  name: string;
  description?: string;
  category: string;
  gross_price: number;
  net_price: number;
  payment_terms?: string;
  vat_rate?: number;
}

interface QuoteData {
  project: Project & {
    clients?: ClientData;
    account_profile?: { first_name: string; last_name: string };
  };
  budgetItems: BudgetItem[];
  services?: ServiceData[];
  quoteNumber?: string;
  quoteDate?: string;
}

const formatCurrency = (value: number): string => {
  return value.toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

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
  const { project, budgetItems, services = [], quoteNumber, quoteDate } = data;

  const doc = new jsPDF();

  // === HEADER LEFT: Logo + Larin info ===
  let yPos = 20;

  try {
    doc.addImage(logoLarin, 'PNG', 20, yPos - 5, 30, 10);
    yPos += 8;
  } catch (e) {
    console.error('Error loading logo:', e);
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Larin Srl', 20, yPos);
  yPos += 3.5;
  doc.text('P. iva 01144900253', 20, yPos);
  yPos += 3.5;
  doc.text('Foro Buonaparte 59', 20, yPos);
  yPos += 3.5;
  doc.text('20121 - Milano (MI)', 20, yPos);
  yPos += 3.5;
  doc.text('Tel. 0437 1901011', 20, yPos);
  yPos += 3.5;
  doc.text('www.larin.it', 20, yPos);
  yPos += 3.5;
  doc.text('amministrazione@larin.it', 20, yPos);

  // === HEADER RIGHT: SPETTABILE + Client info ===
  let rightY = 20;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('SPETTABILE', 190, rightY, { align: 'right' });
  rightY += 5;

  doc.setFont('helvetica', 'normal');
  if (project.clients?.name) {
    doc.text(project.clients.name, 190, rightY, { align: 'right' });
    rightY += 4;

    if (project.clients.address) {
      doc.text(project.clients.address, 190, rightY, { align: 'right' });
      rightY += 4;
    }

    const notes = project.clients.notes || '';
    const piMatch = notes.match(/P\.?I\.?:?\s*([A-Z0-9]+)/i);
    if (piMatch) {
      doc.text(`PI ${piMatch[1]}`, 190, rightY, { align: 'right' });
      rightY += 4;
    }
    const cfMatch = notes.match(/C\.?F\.?:?\s*([A-Z0-9]+)/i);
    if (cfMatch) {
      doc.text(`CF ${cfMatch[1]}`, 190, rightY, { align: 'right' });
    }
  }

  // === TITLE SECTION (left-aligned) ===
  yPos = 60;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);

  const displayQuoteNumber = quoteNumber || project.id?.substring(0, 8).toUpperCase() || '---';
  const displayDate = quoteDate
    ? new Date(quoteDate).toLocaleDateString('it-IT')
    : new Date().toLocaleDateString('it-IT');

  doc.text(`Preventivo n. ${displayQuoteNumber} del ${displayDate}`, 20, yPos);

  yPos += 8;
  doc.setFontSize(12);
  doc.text(project.name, 20, yPos);

  if (project.description) {
    yPos += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(project.description, 20, yPos, { maxWidth: 170 });
    yPos += 6;
  }

  // === TABLE ===
  yPos += 12;

  const tableData: any[] = [];

  // Add products (net prices)
  budgetItems.forEach((item) => {
    const vatRate = item.vat_rate || 22;
    const netUnitPrice = item.hourly_rate / (1 + vatRate / 100);
    const netTotalCost = item.total_cost / (1 + vatRate / 100);
    tableData.push({
      name: item.activity_name,
      description: item.payment_terms || '',
      unitPrice: netUnitPrice,
      quantity: item.hours_worked,
      total: netTotalCost,
      vatRate: vatRate,
    });
  });

  // Add services
  services.forEach((service) => {
    const vatRate = service.vat_rate || 22;
    tableData.push({
      name: service.name,
      description: service.description || '',
      unitPrice: Number(service.gross_price),
      quantity: 1,
      total: Number(service.gross_price),
      vatRate: vatRate,
    });
  });

  const body = tableData.map((row) => [
    { content: row.name + (row.description ? `\n${row.description}` : ''), styles: {} },
    formatCurrency(row.unitPrice),
    row.quantity.toFixed(0),
    formatCurrency(row.total),
    `${row.vatRate}%`,
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Prodotto / Servizio', 'Prezzo Unit.', 'Qtà', 'Totale', 'IVA']],
    body: body,
    theme: 'plain',
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [40, 40, 40],
      fontStyle: 'bold',
      fontSize: 9,
      lineColor: [180, 180, 180],
      lineWidth: { bottom: 0.3 },
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [210, 210, 210],
      lineWidth: { bottom: 0.15 },
      textColor: [30, 30, 30],
    },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold' },
      1: { cellWidth: 28, halign: 'right' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 18, halign: 'center' },
    },
    didDrawPage: () => {
      addFooter(doc, doc.getNumberOfPages(), doc.getNumberOfPages());
    },
  });

  // === SUMMARY BOX ===
  let finalY = (doc as any).lastAutoTable.finalY + 10;

  if (finalY > 235) {
    doc.addPage();
    finalY = 20;
  }

  // Calculate totals
  const productsNetTotal = budgetItems.reduce((sum, item) => {
    const vatRate = (item.vat_rate || 22) / 100;
    return sum + item.total_cost / (1 + vatRate);
  }, 0);
  const servicesTotal = services.reduce((sum, s) => sum + Number(s.gross_price || 0), 0);
  const subtotal = productsNetTotal + servicesTotal;

  const discountPercentage = project.discount_percentage || 0;
  const discountAmount = subtotal * (discountPercentage / 100);
  const totalAfterDiscount = subtotal - discountAmount;

  const productsVat = budgetItems.reduce((sum, item) => {
    const vatRate = (item.vat_rate || 22) / 100;
    const netAmount = item.total_cost / (1 + vatRate);
    return sum + netAmount * vatRate;
  }, 0);
  const servicesVat = services.reduce((sum, s) => {
    const vatRate = (s.vat_rate || 22) / 100;
    return sum + Number(s.gross_price || 0) * vatRate;
  }, 0);
  const totalVat = (productsVat + servicesVat) * (1 - discountPercentage / 100);
  const totalWithVat = totalAfterDiscount + totalVat;

  // Draw summary box aligned right
  const boxX = 110;
  const boxW = 80;
  let boxY = finalY;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);

  // Row: IMPONIBILE
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.rect(boxX, boxY, boxW, 8);
  doc.text('IMPONIBILE', boxX + 3, boxY + 5.5);
  doc.text(formatCurrency(subtotal), boxX + boxW - 3, boxY + 5.5, { align: 'right' });
  boxY += 8;

  // Discount row (if applicable)
  if (discountPercentage > 0) {
    doc.rect(boxX, boxY, boxW, 8);
    doc.text(`SCONTO ${discountPercentage}%`, boxX + 3, boxY + 5.5);
    doc.text(`-${formatCurrency(discountAmount)}`, boxX + boxW - 3, boxY + 5.5, { align: 'right' });
    boxY += 8;
  }

  // Row: IVA
  doc.rect(boxX, boxY, boxW, 8);
  doc.text('IVA', boxX + 3, boxY + 5.5);
  doc.text(formatCurrency(totalVat), boxX + boxW - 3, boxY + 5.5, { align: 'right' });
  boxY += 8;

  // Row: TOTALE (highlighted)
  doc.setFillColor(240, 240, 240);
  doc.rect(boxX, boxY, boxW, 9, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTALE', boxX + 3, boxY + 6);
  doc.text(formatCurrency(totalWithVat), boxX + boxW - 3, boxY + 6, { align: 'right' });
  boxY += 9;

  // === NOTES SECTION ===
  let notesY = boxY + 10;
  if (notesY < 255) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('NOTE', 20, notesY);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    let currentY = notesY + 6;

    if (project.payment_terms) {
      doc.text(`Condizioni di pagamento: ${project.payment_terms}`, 20, currentY);
      currentY += 5;
    }

    if (project.total_hours) {
      doc.text(`Ore Totali: ${project.total_hours.toFixed(1)}h`, 20, currentY);
      currentY += 5;
    }

    // === BONIFICO BANCARIO ===
    currentY += 5;
    if (currentY < 270) {
      doc.setFont('helvetica', 'bold');
      doc.text('BONIFICO BANCARIO', 20, currentY);
      currentY += 5;
      doc.setFont('helvetica', 'normal');
      doc.text('IBAN: IT44B0585661160115571260916', 20, currentY);
    }
  }

  // Update footer on all pages with correct total
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  // Save the PDF
  const fileName = `Preventivo_${displayQuoteNumber}_${project.name.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
};
