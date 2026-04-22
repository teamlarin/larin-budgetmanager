import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { auditDocSectionsInDom, logSectionsAudit } from '@/lib/docsExportValidation';

/**
 * Esporta la guida `/help` in un PDF multi-pagina.
 *
 * Strategia:
 * - per ogni `<section id="...">` dentro `<main>` scattiamo uno screenshot con
 *   html2canvas, dopo aver forzato l'apertura di tutti gli `<Accordion>`.
 * - **Scale adattiva**: riduciamo la risoluzione di rendering per sezioni molto
 *   alte (es. il manuale completo) per contenere il consumo di memoria.
 * - **Render incrementale**: ogni canvas viene impaginato e immediatamente
 *   liberato (riferimento azzerato + `yield` al main thread) prima di
 *   processare la sezione successiva.
 * - **Attesa tra screenshot**: piccola pausa (`requestIdleCallback` o setTimeout)
 *   tra una sezione e l'altra per non saturare il main thread e dare tempo al
 *   GC di liberare i canvas precedenti.
 */

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 12;
const CONTENT_W = A4_WIDTH_MM - MARGIN_MM * 2;

// Limite indicativo: oltre questo numero di pixel verticali la sezione è
// considerata "lunga" e renderizzata a scale ridotta.
const TALL_SECTION_HEIGHT_PX = 4000;
const VERY_TALL_SECTION_HEIGHT_PX = 9000;

interface SectionInfo {
  id: string;
  title: string;
  pageNumber: number;
}

export interface PdfExportResult {
  blob: Blob;
  exportedSectionIds: string[];
  missingSectionIds: string[];
}

function nextFrame(ms = 50): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback?.(
        () => resolve(),
      );
      // Fallback timer in caso requestIdleCallback non venga mai invocato
      setTimeout(resolve, ms + 100);
    } else {
      setTimeout(resolve, ms);
    }
  });
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

/** Calcola lo scale ottimale in funzione dell'altezza della sezione. */
function computeAdaptiveScale(sectionHeightPx: number): number {
  if (sectionHeightPx > VERY_TALL_SECTION_HEIGHT_PX) return 1.0;
  if (sectionHeightPx > TALL_SECTION_HEIGHT_PX) return 1.25;
  return 1.5;
}

async function renderSectionToPdf(
  pdf: jsPDF,
  section: HTMLElement,
  isFirstSection: boolean,
): Promise<{ pageNumber: number }> {
  if (!isFirstSection) pdf.addPage();
  const startPage = (pdf as jsPDF & { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();

  const sectionHeightPx = section.scrollHeight;
  const scale = computeAdaptiveScale(sectionHeightPx);

  let canvas: HTMLCanvasElement | null = await html2canvas(section, {
    scale,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: section.scrollWidth,
    // Riduce il consumo di memoria evitando il clone di iframe/video
    removeContainer: true,
  });
  const imgWidth = CONTENT_W;
  const pxPerMm = canvas.width / imgWidth;
  const pageContentHeightPx = (A4_HEIGHT_MM - MARGIN_MM * 2) * pxPerMm;

  let renderedPx = 0;
  let pageIdx = 0;
  // JPEG quality adattiva: leggermente più bassa per sezioni molto lunghe
  const jpegQuality = scale >= 1.5 ? 0.9 : 0.82;

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
    const imgData = sliceCanvas.toDataURL('image/jpeg', jpegQuality);
    if (pageIdx > 0) pdf.addPage();
    const sliceHeightMm = sliceHeight / pxPerMm;
    pdf.addImage(imgData, 'JPEG', MARGIN_MM, MARGIN_MM, imgWidth, sliceHeightMm);
    renderedPx += sliceHeight;
    pageIdx += 1;

    // Libera lo slice canvas e cedi il controllo al browser ogni pagina
    sliceCanvas.width = 0;
    sliceCanvas.height = 0;
    if (pageIdx % 2 === 0) await nextFrame(0);
  }

  // Rilascia esplicitamente il canvas grande prima della prossima sezione
  canvas.width = 0;
  canvas.height = 0;
  canvas = null;

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

export async function exportDocsToPdf(
  onProgress?: (current: number, total: number, label: string) => void,
): Promise<Blob> {
  const result = await exportDocsToPdfWithAudit(onProgress);
  return result.blob;
}

export async function exportDocsToPdfWithAudit(
  onProgress?: (current: number, total: number, label: string) => void,
): Promise<PdfExportResult> {
  const main = document.querySelector<HTMLElement>('main');
  if (!main) throw new Error('Contenuto guida non trovato');

  // Marca il body in modalità export per CSS dedicato (nasconde feedback inline ecc.)
  document.body.classList.add('doc-exporting');

  const restoreAccordions = await expandAllAccordions(main);

  try {
    // Audit: confronta sezioni dichiarate vs presenti nel DOM
    const audit = auditDocSectionsInDom(main);
    logSectionsAudit(audit, 'PDF export');

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    addCoverPage(pdf);

    const sections = Array.from(main.querySelectorAll<HTMLElement>('section[id]')).filter(
      (s) => !s.hasAttribute('data-doc-export-skip'),
    );

    // Render incrementale con yield al main thread tra una sezione e l'altra
    const sectionInfos: SectionInfo[] = [];
    let firstContentPage = 0;
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const heading = s.querySelector('h2,h3');
      const title = heading ? (heading.textContent || '').trim() : s.id;
      onProgress?.(i + 1, sections.length, title);
      const { pageNumber } = await renderSectionToPdf(pdf, s, i === 0);
      if (i === 0) firstContentPage = pageNumber;
      sectionInfos.push({ id: s.id, title, pageNumber });
      // Pausa tra sezioni: lascia respirare il main thread / GC
      await nextFrame(80);
    }

    // Inserisce la pagina TOC come pagina 2 e aggiorna i numeri
    insertTocAsPage2(pdf, sectionInfos, audit.missing);

    addPageNumbers(pdf, Math.max(2, firstContentPage));

    return {
      blob: pdf.output('blob'),
      exportedSectionIds: sections.map((s) => s.id),
      missingSectionIds: audit.missing,
    };
  } finally {
    restoreAccordions();
    document.body.classList.remove('doc-exporting');
  }
}

/**
 * Aggiunge una pagina TOC e la sposta in posizione 2 (dopo la cover).
 * Se ci sono sezioni mancanti, le elenca alla fine come avviso.
 */
function insertTocAsPage2(pdf: jsPDF, sectionInfos: SectionInfo[], missing: string[]) {
  pdf.addPage();
  const totalPages = (pdf as jsPDF & { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  const movePage = (pdf as unknown as { movePage?: (s: number, t: number) => void }).movePage;
  const deletePage = (pdf as unknown as { deletePage?: (n: number) => void }).deletePage;
  if (typeof movePage !== 'function' || typeof deletePage !== 'function') {
    // Fallback: TOC alla fine
    drawTocPage(pdf, sectionInfos, missing, 0);
    return;
  }
  movePage(totalPages, 2);
  // Cancella la pagina vuota e ricreala vuota in posizione 2 per disegnarla correttamente
  deletePage(2);
  pdf.addPage();
  movePage((pdf as jsPDF & { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages(), 2);
  pdf.setPage(2);
  drawTocPage(pdf, sectionInfos, missing, 1);
}

function drawTocPage(
  pdf: jsPDF,
  sectionInfos: SectionInfo[],
  missing: string[],
  pageOffset: number,
) {
  pdf.setTextColor(20, 20, 20);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text('Indice', MARGIN_MM, 25);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  let y = 40;
  sectionInfos.forEach((s) => {
    if (y > A4_HEIGHT_MM - MARGIN_MM - 20) return;
    const adjustedPage = s.pageNumber + pageOffset;
    const title = s.title.length > 70 ? `${s.title.slice(0, 67)}…` : s.title;
    pdf.text(title, MARGIN_MM, y);
    pdf.text(String(adjustedPage), A4_WIDTH_MM - MARGIN_MM, y, { align: 'right' });
    y += 8;
  });

  if (missing.length > 0) {
    y += 6;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(180, 90, 0);
    pdf.text('⚠ Sezioni non incluse:', MARGIN_MM, y);
    y += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(120, 80, 0);
    const wrapped = pdf.splitTextToSize(missing.join(', '), CONTENT_W);
    pdf.text(wrapped, MARGIN_MM, y);
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
