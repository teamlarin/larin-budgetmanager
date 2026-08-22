import { useCallback, useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import DOMPurify from 'dompurify';
import {
  Bold, Code, ImageIcon, Italic, Link2, List, ListOrdered, Loader2, Table as TableIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const BUCKET = 'task-attachments';
/** 10 anni: gli allegati restano leggibili nella descrizione salvata. */
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

/** Sanifica l'HTML prima di salvarlo o mostrarlo (protezione XSS). */
export function sanitizeTaskHtml(html: string): string {
  return DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 's', 'u', 'code', 'pre', 'blockquote',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'span',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'colspan', 'rowspan'],
    ALLOWED_URI_REGEXP: /^(https?:|mailto:|\/)/i,
  });
}

/** True se l'HTML non contiene contenuto visibile. */
export function isEmptyHtml(html: string | null | undefined): boolean {
  if (!html) return true;
  const stripped = html.replace(/<(br|img|hr)[^>]*>/gi, 'x').replace(/<[^>]*>/g, '').trim();
  return stripped.length === 0;
}

const extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  Image.configure({ inline: false }),
  Link.configure({ openOnClick: false, autolink: true }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
];

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export const RichTextEditor = ({ value, onChange, className }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);

  const editor = useEditor({
    extensions,
    content: value || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none min-h-[140px] focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => onChange(sanitizeTaskHtml(editor.getHTML())),
  });

  // Sincronizza quando il contenuto cambia dall'esterno (apertura form / reset)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || '') !== current && !editor.isFocused) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [editor, value]);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!editor || uploadingRef.current) return;
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Formato non supportato', description: 'Carica un file immagine.', variant: 'destructive' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'Immagine troppo grande', description: 'Massimo 5 MB.', variant: 'destructive' });
        return;
      }
      uploadingRef.current = true;
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) throw new Error('Utente non autenticato');
        const ext = file.name.split('.').pop() || 'png';
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        });
        if (uploadError) throw uploadError;
        const { data: signed, error: signError } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, SIGNED_URL_TTL);
        if (signError || !signed?.signedUrl) throw signError || new Error('URL non disponibile');
        editor.chain().focus().setImage({ src: signed.signedUrl, alt: file.name }).run();
      } catch (e) {
        toast({
          title: 'Upload non riuscito',
          description: e instanceof Error ? e.message : 'Errore sconosciuto',
          variant: 'destructive',
        });
      } finally {
        uploadingRef.current = false;
      }
    },
    [editor]
  );

  if (!editor) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-input p-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Caricamento editor...
      </div>
    );
  }

  return (
    <div className={cn('rounded-md border border-input bg-background', className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border p-1">
        <Toggle size="sm" pressed={editor.isActive('bold')} onPressedChange={() => editor.chain().focus().toggleBold().run()} aria-label="Grassetto">
          <Bold className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('italic')} onPressedChange={() => editor.chain().focus().toggleItalic().run()} aria-label="Corsivo">
          <Italic className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('bulletList')} onPressedChange={() => editor.chain().focus().toggleBulletList().run()} aria-label="Elenco">
          <List className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('orderedList')} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Elenco numerato">
          <ListOrdered className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive('codeBlock')} onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()} aria-label="Blocco di codice">
          <Code className="h-3.5 w-3.5" />
        </Toggle>
        <Button
          type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Inserisci tabella"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TableIcon className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Inserisci link"
          onClick={() => {
            const url = window.prompt('URL del link');
            if (!url) return;
            editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank' }).run();
          }}
        >
          <Link2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Carica immagine"
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = '';
          }}
        />
      </div>
      <EditorContent
        editor={editor}
        className="px-3 py-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-1 [&_img]:max-w-full [&_img]:rounded"
        onPaste={(e) => {
          const file = Array.from(e.clipboardData?.files || [])[0];
          if (file) {
            e.preventDefault();
            handleUpload(file);
          }
        }}
      />
    </div>
  );
};

/** Rende in sola lettura una descrizione rich-text (HTML sanificato). */
export const RichTextContent = ({ html, className }: { html: string; className?: string }) => (
  <div
    className={cn(
      'prose prose-sm dark:prose-invert max-w-none [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-1 [&_th]:border [&_th]:border-border [&_th]:p-1 [&_img]:max-w-full [&_img]:rounded',
      className
    )}
    dangerouslySetInnerHTML={{ __html: sanitizeTaskHtml(html) }}
  />
);
