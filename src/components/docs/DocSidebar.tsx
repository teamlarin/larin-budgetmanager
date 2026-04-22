import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { docSections, isRecentlyUpdated, type DocSection } from './docSections';
import { ChevronRight, Sparkles } from 'lucide-react';

function flatIds(sections: DocSection[]): string[] {
  const ids: string[] = [];
  for (const s of sections) {
    ids.push(s.id);
    if (s.children) s.children.forEach((c) => ids.push(c.id));
  }
  return ids;
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

export function DocSidebar() {
  const isMobile = useIsMobile();
  const [activeId, setActiveId] = useState<string>('quick-start');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ 'quick-start': true, manuale: true });

  useEffect(() => {
    const ids = flatIds(docSections);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (isMobile) {
    const allItems = docSections.flatMap((s) => [
      { id: s.id, label: s.label, isParent: true },
      ...(s.children?.map((c) => ({ id: c.id, label: `  ${c.label}`, isParent: false })) ?? []),
    ]);
    return (
      <div className="sticky top-0 z-20 bg-background border-b pb-2 pt-2 px-4 mb-4">
        <Select value={activeId} onValueChange={(v) => scrollTo(v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Vai a sezione…" />
          </SelectTrigger>
          <SelectContent>
            {allItems.map((item) => (
              <SelectItem key={item.id} value={item.id} className={item.isParent ? 'font-semibold' : 'pl-6'}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <nav className="sticky top-20 w-56 shrink-0 max-h-[calc(100vh-6rem)] overflow-y-auto pr-4 hidden lg:block">
      <ul className="space-y-1 text-sm">
        {docSections.map((section) => {
          const hasChildren = section.children && section.children.length > 0;
          const isExpanded = expandedGroups[section.id];
          const isActive = activeId === section.id || section.children?.some((c) => c.id === activeId);

          return (
            <li key={section.id}>
              <button
                onClick={() => {
                  scrollTo(section.id);
                  if (hasChildren) toggleGroup(section.id);
                }}
                className={cn(
                  'flex items-center gap-1 w-full text-left px-2 py-1.5 rounded-md transition-colors hover:bg-muted',
                  isActive && 'text-primary font-medium'
                )}
              >
                {hasChildren && (
                  <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform', isExpanded && 'rotate-90')} />
                )}
                <span className="flex-1 truncate">{section.label}</span>
                {isRecentlyUpdated(section.updatedAt) && (
                  <Sparkles
                    className="h-3 w-3 text-primary shrink-0"
                    aria-label="Aggiornato di recente"
                  />
                )}
              </button>
              {hasChildren && isExpanded && (
                <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
                  {section.children!.map((child) => (
                    <li key={child.id}>
                      <button
                        onClick={() => scrollTo(child.id)}
                        className={cn(
                          'w-full text-left px-2 py-1 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground flex items-center gap-1.5',
                          activeId === child.id && 'text-primary font-medium bg-primary/5'
                        )}
                      >
                        <span className="flex-1 truncate">{child.label}</span>
                        {isRecentlyUpdated(child.updatedAt) && (
                          <Sparkles className="h-3 w-3 text-primary shrink-0" aria-label="Aggiornato di recente" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
