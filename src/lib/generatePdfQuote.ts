import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Project } from '@/types/project';

interface BudgetItem {
  category: string;
  activity_name: string;
  assignee_name: string;
  hourly_rate: number;
  hours_worked: number;
  total_cost: number;
}

interface QuoteData {
  project: Project & {
    clients?: { name: string };
    account_profile?: { first_name: string; last_name: string };
  };
  budgetItems: BudgetItem[];
}

export const generatePdfQuote = async (data: QuoteData) => {
  const { project, budgetItems } = data;
  
  const doc = new jsPDF();
  
  // Add logo or header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('PREVENTIVO', 105, 20, { align: 'center' });
  
  // Project information
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  let yPos = 40;
  
  doc.text(`Progetto: ${project.name}`, 20, yPos);
  yPos += 8;
  
  if (project.clients?.name) {
    doc.text(`Cliente: ${project.clients.name}`, 20, yPos);
    yPos += 8;
  }
  
  if (project.account_profile) {
    doc.text(`Account: ${project.account_profile.first_name} ${project.account_profile.last_name}`, 20, yPos);
    yPos += 8;
  }
  
  doc.text(`Data: ${new Date().toLocaleDateString('it-IT')}`, 20, yPos);
  yPos += 8;
  
  if (project.description) {
    doc.setFontSize(10);
    doc.text(`Descrizione: ${project.description}`, 20, yPos, { maxWidth: 170 });
    yPos += 15;
  }
  
  // Budget items table
  yPos += 10;
  
  const tableData = budgetItems.map(item => [
    item.category,
    item.activity_name,
    item.assignee_name,
    `${item.hours_worked.toFixed(1)}h`,
    `€${item.hourly_rate.toFixed(2)}`,
    `€${item.total_cost.toFixed(2)}`
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [['Categoria', 'Attività', 'Assegnatario', 'Ore', 'Tariffa/h', 'Totale']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 45 },
      2: { cellWidth: 35 },
      3: { cellWidth: 20 },
      4: { cellWidth: 25 },
      5: { cellWidth: 25 },
    },
  });
  
  // Summary
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Ore Totali: ${project.total_hours.toFixed(1)}h`, 120, finalY);
  doc.text(`Importo Totale: €${project.total_budget.toFixed(2)}`, 120, finalY + 8);
  
  // Footer
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('Preventivo generato automaticamente', 105, 280, { align: 'center' });
  
  // Save the PDF
  const fileName = `Preventivo_${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
