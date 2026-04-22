import { useState } from 'react';
import { Link2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface SectionAnchorProps {
  id: string;
  className?: string;
}

/**
 * Bottoncino "copia link" da posizionare accanto a un heading di sezione.
 * Copia `window.location.origin + /help#id` negli appunti.
 */
export function SectionAnchor({ id, className = '' }: SectionAnchorProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = `${window.location.origin}/help#${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copiato negli appunti');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Impossibile copiare il link');
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      aria-label="Copia link sezione"
      title="Copia link sezione"
      data-doc-export-skip
      className={`h-7 w-7 p-0 opacity-60 hover:opacity-100 ${className}`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
    </Button>
  );
}
