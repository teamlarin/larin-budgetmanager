import { Rocket, BookOpen, Shield, Sparkles, HelpCircle, Wrench } from 'lucide-react';

const ITEMS = [
  { id: 'quick-start', label: 'Quick Start', Icon: Rocket },
  { id: 'manuale', label: 'Manuale', Icon: BookOpen },
  { id: 'ruoli-permessi', label: 'Ruoli', Icon: Shield },
  { id: 'ai-automazioni', label: 'AI', Icon: Sparkles },
  { id: 'faq', label: 'FAQ', Icon: HelpCircle },
  { id: 'troubleshooting', label: 'Troubleshooting', Icon: Wrench },
];

/**
 * TOC orizzontale compatto a chips. Utile principalmente su mobile,
 * dove la sidebar laterale non è visibile.
 */
export function CompactToc() {
  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', `#${id}`);
    }
  };

  return (
    <nav
      aria-label="Indice rapido"
      data-doc-export-skip
      className="flex flex-wrap gap-2 mb-8"
    >
      {ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => handleClick(id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-card hover:bg-accent hover:text-accent-foreground transition-colors text-xs font-medium"
        >
          <Icon className="h-3.5 w-3.5 text-primary" />
          {label}
        </button>
      ))}
    </nav>
  );
}
