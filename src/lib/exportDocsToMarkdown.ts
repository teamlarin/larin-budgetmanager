/**
 * Esporta il contenuto della guida `/help` in Markdown,
 * leggendo direttamente il DOM renderizzato.
 *
 * Vantaggio: resta sempre allineato ai contenuti reali,
 * senza dover mantenere una copia parallela.
 */

function escapeMd(text: string): string {
  return text.replace(/([\\`*_{}\[\]()#+\-.!])/g, '\\$1');
}

function nodeToMarkdown(node: Node, depth = 0): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || '').replace(/\s+/g, ' ');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  // Skip elementi UI non rilevanti
  if (
    el.hasAttribute('data-doc-export-skip') ||
    tag === 'script' ||
    tag === 'style' ||
    tag === 'button' ||
    tag === 'svg'
  ) {
    return '';
  }

  const childMd = Array.from(el.childNodes).map((c) => nodeToMarkdown(c, depth + 1)).join('');

  switch (tag) {
    case 'h1':
      return `\n\n# ${childMd.trim()}\n\n`;
    case 'h2':
      return `\n\n## ${childMd.trim()}\n\n`;
    case 'h3':
      return `\n\n### ${childMd.trim()}\n\n`;
    case 'h4':
      return `\n\n#### ${childMd.trim()}\n\n`;
    case 'p':
      return `\n${childMd.trim()}\n`;
    case 'strong':
    case 'b':
      return `**${childMd.trim()}**`;
    case 'em':
    case 'i':
      return `_${childMd.trim()}_`;
    case 'code':
      return `\`${childMd.trim()}\``;
    case 'br':
      return '\n';
    case 'li':
      return `- ${childMd.trim()}\n`;
    case 'ul':
    case 'ol':
      return `\n${childMd}\n`;
    case 'a': {
      const href = el.getAttribute('href') || '';
      return `[${childMd.trim()}](${href})`;
    }
    case 'table': {
      const rows = Array.from(el.querySelectorAll('tr'));
      if (!rows.length) return '';
      const lines: string[] = [];
      rows.forEach((row, idx) => {
        const cells = Array.from(row.querySelectorAll('th,td')).map((c) =>
          (c.textContent || '').trim().replace(/\|/g, '\\|'),
        );
        lines.push(`| ${cells.join(' | ')} |`);
        if (idx === 0) {
          lines.push(`| ${cells.map(() => '---').join(' | ')} |`);
        }
      });
      return `\n${lines.join('\n')}\n`;
    }
    default:
      return childMd;
  }
}

export interface MarkdownExportResult {
  markdown: string;
  exportedSectionIds: string[];
  missingSectionIds: string[];
}

export function exportDocsToMarkdown(): string {
  return exportDocsToMarkdownWithAudit().markdown;
}

export function exportDocsToMarkdownWithAudit(): MarkdownExportResult {
  const main = document.querySelector('main');
  if (!main) throw new Error('Contenuto guida non trovato');

  // Audit: confronta sezioni dichiarate vs presenti nel DOM
  const audit = auditDocSectionsInDom(main);
  logSectionsAudit(audit, 'Markdown export');

  // Espandi tutti gli accordion temporaneamente leggendo il loro contenuto
  // (non modifichiamo lo stato React: scriviamo direttamente dal markup)
  const sections = Array.from(main.querySelectorAll<HTMLElement>('section[id]'))
    .filter((s) => !s.hasAttribute('data-doc-export-skip'));
  const date = new Date().toLocaleDateString('it-IT');

  let md = `# TimeTrap — Guida\n\n_Esportato il ${date}_\n\n---\n`;

  // Indice
  md += `\n## Indice\n\n`;
  sections.forEach((s) => {
    const heading = s.querySelector('h2,h3');
    if (heading) {
      const title = (heading.textContent || '').trim();
      md += `- [${title}](#${s.id})\n`;
    }
  });
  md += `\n---\n`;

  // Sezioni
  sections.forEach((section) => {
    md += `\n<a id="${section.id}"></a>\n`;
    // Per ogni AccordionItem leggiamo trigger + content come heading + body
    const accordionItems = section.querySelectorAll('[data-radix-collection-item], [data-state]');
    if (accordionItems.length > 0) {
      // Render generico via nodeToMarkdown (gestisce strutture varie)
      md += nodeToMarkdown(section);
      // Aggiungiamo esplicitamente i contenuti collassati che potrebbero essere `display:none`
      const hidden = section.querySelectorAll<HTMLElement>('[data-state="closed"]');
      hidden.forEach((h) => {
        // Cerca contenuto correlato all'accordion trigger
        const trigger = h.querySelector('[data-radix-accordion-trigger], button');
        const content = h.parentElement?.querySelector('[data-radix-accordion-content], [role="region"]');
        if (trigger && content) {
          md += `\n#### ${(trigger.textContent || '').trim()}\n\n`;
          md += nodeToMarkdown(content);
        }
      });
    } else {
      md += nodeToMarkdown(section);
    }
  });

  // Pulizia: collassa multipli newline
  md = md.replace(/\n{3,}/g, '\n\n').trim() + '\n';

  // Banner finale se ci sono sezioni mancanti
  if (audit.missing.length > 0) {
    md += `\n---\n\n> ⚠️ Sezioni dichiarate ma non trovate nel DOM al momento dell'esportazione: ${audit.missing.join(', ')}\n`;
  }

  return {
    markdown: md,
    exportedSectionIds: sections.map((s) => s.id),
    missingSectionIds: audit.missing,
  };
}

export function downloadMarkdownFile(markdown: string, filename: string) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
