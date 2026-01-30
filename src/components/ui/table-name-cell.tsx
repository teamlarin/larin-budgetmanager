import * as React from "react";
import { ExternalLink } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface TableNameCellProps {
  name: string;
  href: string;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export const TableNameCell = ({
  name,
  href,
  onClick,
  className = "",
  children,
}: TableNameCellProps) => {
  const handleOpenInNewTab = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(href, "_blank");
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <span
          className={`cursor-pointer hover:text-primary hover:underline ${className}`}
          onClick={onClick}
        >
          {children || name}
        </span>
      </ContextMenuTrigger>
      <ContextMenuContent className="z-50 bg-popover">
        <ContextMenuItem onClick={handleOpenInNewTab}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Apri in nuovo tab
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
