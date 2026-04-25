import { useState, useMemo } from 'react';
import { User, Clock, ChevronRight, Check, AlertCircle, Search, Archive } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ActiveFlow } from '@/types/workflow';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { AREA_LABELS, AREA_COLORS } from '@/lib/areaColors';

interface ActiveFlowsListProps {
  flows: ActiveFlow[];
  onSelectFlow: (flow: ActiveFlow) => void;
  archived?: boolean;
}

export const ActiveFlowsList = ({ flows, onSelectFlow, archived = false }: ActiveFlowsListProps) => {
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    flows.forEach(f => map.set(f.ownerId, f.ownerName));
    return Array.from(map.entries());
  }, [flows]);

  const availableAreas = useMemo(() => {
    const set = new Set<string>();
    let hasNone = false;
    flows.forEach(f => {
      if (f.templateArea) set.add(f.templateArea);
      else hasNone = true;
    });
    return { areas: Array.from(set), hasNone };
  }, [flows]);

  const filteredFlows = useMemo(() => {
    return flows.filter(flow => {
      if (search && !flow.customName.toLowerCase().includes(search.toLowerCase())) return false;
      if (ownerFilter !== 'all' && flow.ownerId !== ownerFilter) return false;
      if (areaFilter !== 'all') {
        if (areaFilter === 'none' && flow.templateArea) return false;
        if (areaFilter !== 'none' && flow.templateArea !== areaFilter) return false;
      }
      return true;
    });
  }, [flows, search, ownerFilter, areaFilter]);

  const showFilters = flows.length > 0;

  if (flows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        {archived ? (
          <Archive className="h-12 w-12 text-muted-foreground/40 mb-4" />
        ) : (
          <AlertCircle className="h-12 w-12 text-muted-foreground/40 mb-4" />
        )}
        <h3 className="text-lg font-medium text-foreground">
          {archived ? 'Archivio vuoto' : 'Nessun flusso attivo'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {archived
            ? 'I flussi completati appariranno qui.'
            : 'Non sei coinvolto in nessun flusso al momento.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca flusso..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le aree</SelectItem>
              {availableAreas.areas.map(a => (
                <SelectItem key={a} value={a}>
                  {AREA_LABELS[a as keyof typeof AREA_LABELS] || a}
                </SelectItem>
              ))}
              {availableAreas.hasNone && <SelectItem value="none">Senza area</SelectItem>}
            </SelectContent>
          </Select>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli owner</SelectItem>
              {owners.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {filteredFlows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Nessun flusso corrisponde ai filtri.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredFlows.map((flow) => {
            const completedCount = flow.tasks.filter(t => t.isCompleted).length;
            const totalCount = flow.tasks.length;
            const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            const isComplete = completedCount === totalCount;
            const areaKey = flow.templateArea as keyof typeof AREA_LABELS | null;
            const areaLabel = areaKey ? AREA_LABELS[areaKey] : null;
            const areaColor = areaKey ? AREA_COLORS[areaKey] : null;

            return (
              <Card
                key={flow.id}
                className={`cursor-pointer group ${archived ? 'opacity-80 hover:opacity-100 transition-opacity' : ''}`}
                onClick={() => onSelectFlow(flow)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {flow.customName}
                      </h3>
                      <p className="text-xs text-muted-foreground/60 truncate">{flow.templateName}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                  </div>

                  {areaLabel && areaColor && (
                    <Badge variant="outline" className={`text-xs mt-1 ${areaColor}`}>{areaLabel}</Badge>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 mb-3">
                    <User className="h-3 w-3" />
                    Owner: {flow.ownerName}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{completedCount}/{totalCount} task</span>
                      {isComplete ? (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                          <Check className="h-2.5 w-2.5 mr-1" /> Completato
                        </Badge>
                      ) : (
                        <span className="font-medium text-foreground">{progressPercent}%</span>
                      )}
                    </div>
                    <Progress value={progressPercent} className="h-1.5" />
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
                    <Clock className="h-3 w-3" />
                    {archived && flow.completedAt
                      ? `Completato il ${format(new Date(flow.completedAt), 'd MMM yyyy', { locale: it })}`
                      : format(new Date(flow.createdAt), 'd MMM yyyy', { locale: it })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
