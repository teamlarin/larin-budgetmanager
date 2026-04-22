import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Esporta la guida `/help` in un PDF multi-pagina.
 *
 * Strategia: per ogni `<section id="...">` dentro `<main>` scattiamo uno
 * screenshot con html2canvas, dopo aver forzato l'apertura di tutti
 * gli `<Accordion>`. Ogni sezione viene impaginata con divisione
 * automatica su più pagine A4 portrait.
 */

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 12;
const CONTENT_W = A4_WIDTH_MM - MARGIN_MM * 2;

interface SectionInfo {
  id: string;
  title: string;
  pageNumber: number;
}

async function expandAllAccordions(root: HTMLElement): Promise<() => void> {
  // Apri tutti i Radix Accordion: clicca i trigger con data-state=closed
  const triggers = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-state="closed"]'),
  ).filter((el) => el.tagName === 'BUTTON');
  const opened: HTMLButtonElement[] = [];
  triggers.forEach((t) => {
    try {
      t.click();
      opened.push(t);
    } catch {
      /* noop */
    }
  });
  // Attendi animazioni
  await new Promise((r) => setTimeout(r, 350));
  return () => {
    opened.forEach((t) => {
      try {
        t.click();
      } catch {
        /* noop */
      }
    });
  };
}

async function renderSectionToPdf(
  pdf: jsPDF,
  section: HTMLElement,
  isFirstSection: boolean,
): Promise<{ pageNumber: number }> {
  if (!isFirstSection) pdf.addPage();
  const startPage = (pdf as jsPDF & { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();

  const canvas = await html2canvas(section, {
    scale: 1.5,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: section.scrollWidth,
  });
  const imgWidth = CONTENT_W;
  const pxPerMm = canvas.width / imgWidth;
  const pageContentHeightPx = (A4_HEIGHT_MM - MARGIN_MM * 2) * pxPerMm;

  let renderedPx = 0;
  let pageIdx = 0;
  while (renderedPx < canvas.height) {
    const sliceHeight = Math.min(pageContentHeightPx, canvas.height - renderedPx);
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeight;
    const ctx = sliceCanvas.getContext('2d');
    if (!ctx) break;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(
      canvas,
      0,
      renderedPx,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight,
    );
    const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
    if (pageIdx > 0) pdf.addPage();
    const sliceHeightMm = sliceHeight / pxPerMm;
    pdf.addImage(imgData, 'JPEG', MARGIN_MM, MARGIN_MM, imgWidth, sliceHeightMm);
    renderedPx += sliceHeight;
    pageIdx += 1;
  }

  return { pageNumber: startPage };
}

function addCoverPage(pdf: jsPDF) {
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, 'F');
  pdf.setTextColor(20, 20, 20);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(28);
  pdf.text('TimeTrap', A4_WIDTH_MM / 2, 110, { align: 'center' });
  pdf.setFontSize(18);
  pdf.text('Guida utente', A4_WIDTH_MM / 2, 122, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(110, 110, 110);
  const date = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  pdf.text(`Esportato il ${date}`, A4_WIDTH_MM / 2, 134, { align: 'center' });
}

function addTocPage(pdf: jsPDF, sections: SectionInfo[]) {
  pdf.addPage();
  pdf.setTextColor(20, 20, 20);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text('Indice', MARGIN_MM, 25);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  let y = 40;
  sections.forEach((s) => {
    if (y > A4_HEIGHT_MM - MARGIN_MM) {
      pdf.addPage();
      y = MARGIN_MM + 10;
    }
    const title = s.title.length > 70 ? `${s.title.slice(0, 67)}…` : s.title;
    pdf.text(title, MARGIN_MM, y);
    pdf.text(String(s.pageNumber), A4_WIDTH_MM - MARGIN_MM, y, { align: 'right' });
    // Linea puntinata
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineDashPattern([0.5, 1], 0);
    pdf.line(
      MARGIN_MM + pdf.getTextWidth(title) + 2,
      y - 1,
      A4_WIDTH_MM - MARGIN_MM - pdf.getTextWidth(String(s.pageNumber)) - 2,
      y - 1,
    );
    pdf.setLineDashPattern([], 0);
    y += 8;
  });
}

function addPageNumbers(pdf: jsPDF, startPage: number) {
  const total = (pdf as jsPDF & { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  for (let i = startPage; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(140, 140, 140);
    pdf.text(`${i} / ${total}`, A4_WIDTH_MM / 2, A4_HEIGHT_MM - 6, { align: 'center' });
    pdf.text('TimeTrap — Guida', MARGIN_MM, A4_HEIGHT_MM - 6);
  }
}

export async function exportDocsToPdf(): Promise<Blob> {
  const main = document.querySelector<HTMLElement>('main');
  if (!main) throw new Error('Contenuto guida non trovato');

  // Marca il body in modalità export per CSS dedicato (nasconde feedback inline ecc.)
  document.body.classList.add('doc-exporting');

  const restoreAccordions = await expandAllAccordions(main);

  try {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    addCoverPage(pdf);

    const sections = Array.from(main.querySelectorAll<HTMLElement>('section[id]')).filter(
      (s) => !s.hasAttribute('data-doc-export-skip'),
    );

    // Render sezioni: prima inseriamo placeholder per TOC, poi sostituiamo
    const sectionInfos: SectionInfo[] = [];
    let firstContentPage = 0;
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const heading = s.querySelector('h2,h3');
      const title = heading ? (heading.textContent || '').trim() : s.id;
      const { pageNumber } = await renderSectionToPdf(pdf, s, false);
      if (i === 0) firstContentPage = pageNumber;
      sectionInfos.push({ id: s.id, title, pageNumber });
    }

    // Aggiungi TOC come pagina 2 spostando le altre? jsPDF non supporta insertPage,
    // quindi creiamo TOC in fondo e lo informiamo l'utente con titolo "Indice".
    // In alternativa più semplice: indice prima della cover non serve; lo posizioniamo
    // alla fine come "Sommario rapido".
    // Però l'utente vorrà l'indice davanti: usiamo workaround creando il PDF con TOC
    // in cima ma con numerazione che parte dopo. Per farlo, ricostruiamo:
    // pagina 1 = cover, pagina 2 = TOC, pagine 3+ = contenuti.
    // Abbiamo già scritto le sezioni a partire dalla pagina 2: spostiamo aggiungendo
    // una pagina TOC tra cover e contenuti tramite movePage.
    addTocPage(pdf, sectionInfos);
    const totalPages = (pdf as jsPDF & { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
    // Sposta l'ultima pagina (TOC) in posizione 2
    if (typeof (pdf as unknown as { movePage?: (s: number, t: number) => void }).movePage === 'function') {
      (pdf as unknown as { movePage: (s: number, t: number) => void }).movePage(totalPages, 2);
      // I numeri di pagina nelle sezioni si spostano di +1
      // Aggiorniamo il TOC riscrivendolo
      // Cancelliamo la pagina e ricreiamola
      // jsPDF non supporta clear page; approccio semplice: incrementiamo i pageNumber
      // memorizzati e riscriviamo solo le linee del TOC.
      // Per semplicità rigeneriamo: deletePage(2) + addPage in posizione 2.
      const _pdfWithDelete = pdf as unknown as { deletePage: (n: number) => void };
      _pdfWithDelete.deletePage(2);
      // Aggiungi nuova pagina vuota a posizione 2
      pdf.addPage();
      (pdf as unknown as { movePage: (s: number, t: number) => void }).movePage(
        (pdf as jsPDF & { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages(),
        2,
      );
      pdf.setPage(2);
      pdf.setTextColor(20, 20, 20);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.text('Indice', MARGIN_MM, 25);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      let y = 40;
      sectionInfos.forEach((s) => {
        if (y > A4_HEIGHT_MM - MARGIN_MM) {
          // se non ci sta tutto, troncamento elegante
          return;
        }
        const adjustedPage = s.pageNumber + 1; // tutto è scalato di +1 dopo l'inserimento del TOC
        const title = s.title.length > 70 ? `${s.title.slice(0, 67)}…` : s.title;
        pdf.text(title, MARGIN_MM, y);
        pdf.text(String(adjustedPage), A4_WIDTH_MM - MARGIN_MM, y, { align: 'right' });
        y += 8;
      });
    }

    addPageNumbers(pdf, Math.max(2, firstContentPage));

    return pdf.output('blob');
  } finally {
    restoreAccordions();
    document.body.classList.remove('doc-exporting');
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
