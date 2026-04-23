import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  calcEmployee,
  CalculatedEmployee,
  HrEmployee,
  fmt,
  fmtEuro,
  dateShort,
  isCessato,
  isFuturo,
  MONTHS_IT,
  DIPENDENTI_TYPES,
  PIVA_TYPES,
} from '@/lib/hrCalculations';
import { HrEmployeeDialog } from './HrEmployeeDialog';
import { Plus, Download, Pencil, Copy, ArrowUpDown, Eye, EyeOff } from 'lucide-react';

const YEARS = [2024, 2025, 2026, 2027, 2028];

type SortKey = keyof CalculatedEmployee | string;

export function HrBudgetDashboard() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterContratto, setFilterContratto] = useState<string>('all');
  const [showPianificati, setShowPianificati] = useState(false);
  const [showCessati, setShowCessati] = useState(false);
  const [showMonths, setShowMonths] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('cognome');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<HrEmployee | null>(null);
  const [duplicateMode, setDuplicateMode] = useState(false);

  const { data: employees = [], refetch } = useQuery({
    queryKey: ['hr-employees'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hr_employees').select('*').order('cognome');
      if (error) throw error;
      return (data || []) as HrEmployee[];
    },
  });

  const teams = useMemo(() => [...new Set(employees.map(e => e.team).filter(Boolean) as string[])].sort(), [employees]);
  const contratti = useMemo(() => [...new Set(employees.map(e => e.contratto).filter(Boolean))].sort(), [employees]);

  const calcData = useMemo(() => {
    const q = search.toLowerCase();
    return employees
      .map(e => calcEmployee(e, year))
      .filter(e => {
        if (!showCessati && isCessato(e)) return false;
        if (!showPianificati && e.stato === 'pianificato') return false;
        if (q && !`${e.cognome || ''} ${e.nome || ''} ${e.job_title || ''}`.toLowerCase().includes(q)) return false;
        if (filterTeam !== 'all' && e.team !== filterTeam) return false;
        if (filterContratto !== 'all' && e.contratto !== filterContratto) return false;
        return true;
      });
  }, [employees, year, search, filterTeam, filterContratto, showCessati, showPianificati]);

  const sortedData = useMemo(() => {
    const arr = [...calcData];
    arr.sort((a: any, b: any) => {
      let va = a[sortKey], vb = b[sortKey];
      if (va === null || va === undefined) va = sortDir === 'asc' ? Infinity : -Infinity;
      if (vb === null || vb === undefined) vb = sortDir === 'asc' ? Infinity : -Infinity;
      let cmp;
      if (typeof va === 'string' && typeof vb === 'string') {
        cmp = va.localeCompare(vb, 'it');
      } else {
        cmp = va > vb ? 1 : va < vb ? -1 : 0;
      }
      if (cmp === 0) cmp = (a.cognome || '').localeCompare(b.cognome || '', 'it');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [calcData, sortKey, sortDir]);

  const setSort = (k: string) => {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  };

  // KPIs
  const kpis = useMemo(() => {
    const active = calcData.filter(e => e.isActiveInYear);
    const totalActual = calcData.reduce((s, e) => s + e.totalActual, 0);
    const inCarica = active.filter(e => e.stato !== 'pianificato' && !isCessato(e) && !isFuturo(e));
    const uniqueInCarica = [...new Map(inCarica.map(e => [`${e.cognome}_${e.nome}`, e])).values()];
    const dipInCarica = inCarica.filter(e => DIPENDENTI_TYPES.includes(e.contratto));
    const pivaInCarica = inCarica.filter(e => PIVA_TYPES.includes(e.contratto));
    const uniqueDip = [...new Map(dipInCarica.map(e => [`${e.cognome}_${e.nome}`, e])).values()];
    const uniquePiva = [...new Map(pivaInCarica.map(e => [`${e.cognome}_${e.nome}`, e])).values()];
    const avgRalDip = uniqueDip.length ? uniqueDip.reduce((s, e) => s + e.ral, 0) / uniqueDip.length : 0;
    const avgMensDip = uniqueDip.length ? uniqueDip.reduce((s, e) => s + e.costoTotaleMensile, 0) / uniqueDip.length : 0;
    const avgMensPiva = uniquePiva.length ? uniquePiva.reduce((s, e) => s + e.costoTotaleMensile, 0) / uniquePiva.length : 0;
    const dipWithAnz = uniqueDip.filter(e => e.anzianita !== null);
    const pivaWithAnz = uniquePiva.filter(e => e.anzianita !== null);
    const avgAnzDip = dipWithAnz.length ? Math.round(dipWithAnz.reduce((s, e) => s + (e.anzianita || 0), 0) / dipWithAnz.length * 10) / 10 : null;
    const avgAnzPiva = pivaWithAnz.length ? Math.round(pivaWithAnz.reduce((s, e) => s + (e.anzianita || 0), 0) / pivaWithAnz.length * 10) / 10 : null;
    const withAge = uniqueInCarica.filter(e => e.eta !== null);
    const avgAge = withAge.length ? Math.round(withAge.reduce((s, e) => s + (e.eta || 0), 0) / withAge.length * 10) / 10 : null;
    const genderCount = { M: 0, F: 0 };
    uniqueInCarica.forEach(e => { if (e.sesso === 'M' || e.sesso === 'F') genderCount[e.sesso as 'M' | 'F']++; });
    const genderTotal = genderCount.M + genderCount.F;
    return {
      totalActual, uniqueDip, uniquePiva, uniqueInCarica,
      avgRalDip, avgMensDip, avgMensPiva, avgAnzDip, avgAnzPiva, avgAge,
      genderCount, genderTotal, dipWithAnz, pivaWithAnz, withAge,
    };
  }, [calcData]);

  // Team summary
  const teamBars = useMemo(() => {
    const active = calcData.filter(e => e.isActiveInYear);
    const byTeam: Record<string, number> = {};
    active.forEach(e => { byTeam[e.team || '–'] = (byTeam[e.team || '–'] || 0) + e.totalActual; });
    const sorted = Object.entries(byTeam).sort((a, b) => b[1] - a[1]);
    const max = sorted[0]?.[1] || 1;
    return { sorted, max };
  }, [calcData]);

  // Pivot mensile per team
  const pivotData = useMemo(() => {
    const active = calcData.filter(e => e.isActiveInYear);
    const teamSet = [...new Set(active.map(e => e.team || '–'))].sort();
    const rows = teamSet.map(t => {
      const months = Array(12).fill(0);
      active.filter(e => (e.team || '–') === t).forEach(e => {
        e.months.forEach((v, i) => months[i] += v);
      });
      return { team: t, months, total: months.reduce((a, b) => a + b, 0) };
    });
    return rows;
  }, [calcData]);

  const exportCSV = () => {
    const cols = ['Cognome', 'Nome', 'Job Title', 'Team', 'Contratto', 'Stato', 'Età', 'Anzianità', 'Data Inizio', 'Data Fine',
      'RAL', 'Costo Az. Annuale', 'Costo Az. Mensile', 'Ore FL', '€/ora', 'BP Unit.', 'Fringe',
      'Tot. Mensile', 'Tot. Annuale', ...MONTHS_IT.map(m => `${m} ${year}`), `Tot. Effettivo ${year}`];
    const lines = [cols.join(';')];
    sortedData.forEach(e => {
      lines.push([
        e.cognome, e.nome, e.job_title, e.team, e.contratto, e.stato,
        e.eta ?? '', e.anzianita ?? '', e.data_inizio, e.data_fine,
        e.ral, e.costoAziendaAnnuale.toFixed(2), e.costoAziendaMensile.toFixed(2),
        e.ore_freelance ?? '', e.costoOrario?.toFixed(2) ?? '', e.bp_unitario ?? '', e.fringe ?? '',
        e.costoTotaleMensile.toFixed(2), e.costoTotaleAnnuale.toFixed(2),
        ...e.months.map(v => v.toFixed(2)), e.totalActual.toFixed(2),
      ].map(v => v ?? '').join(';'));
    });
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `hr-budget-${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPivotCSV = () => {
    const cols = ['Team', ...MONTHS_IT.map(m => `${m} ${year}`), `Totale ${year}`];
    const lines = [cols.join(';')];
    pivotData.forEach(r => {
      lines.push([r.team, ...r.months.map(v => v.toFixed(2)), r.total.toFixed(2)].join(';'));
    });
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `hr-pivot-team-${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const openAdd = () => { setEditingEmp(null); setDuplicateMode(false); setDialogOpen(true); };
  const openEdit = (e: HrEmployee) => { setEditingEmp(e); setDuplicateMode(false); setDialogOpen(true); };
  const openDuplicate = (e: HrEmployee) => { setEditingEmp(e); setDuplicateMode(true); setDialogOpen(true); };

  const totalActual = sortedData.reduce((s, e) => s + e.totalActual, 0);
  const monthTotals = Array(12).fill(0);
  sortedData.forEach(e => e.months.forEach((v, i) => monthTotals[i] += v));

  const cols = [
    { key: 'cognome', label: 'Cognome / Nome' },
    { key: 'job_title', label: 'Job Title' },
    { key: 'team', label: 'Team' },
    { key: 'contratto', label: 'Contratto' },
    { key: 'eta', label: 'Età', num: true },
    { key: 'anzianita', label: 'Anzianità', num: true },
    { key: 'data_inizio', label: 'Inizio' },
    { key: 'data_fine', label: 'Fine' },
    { key: 'ral', label: 'RAL', num: true },
    { key: 'costoAziendaAnnuale', label: 'Costo Az. Ann.', num: true },
    { key: 'costoAziendaMensile', label: 'Costo Az. Mens.', num: true },
    { key: 'ore_freelance', label: 'Ore FL', num: true },
    { key: 'costoOrario', label: '€/ora', num: true },
    { key: 'bp_unitario', label: 'BP', num: true },
    { key: 'fringe', label: 'Fringe', num: true },
    { key: 'costoTotaleMensile', label: 'Tot. Mens.', num: true },
    { key: 'costoTotaleAnnuale', label: 'Tot. Ann.', num: true },
  ];

  return (
    <div className="space-y-4">
      {/* Header & year */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">📊 HR Budget – Costo del Personale</h2>
          <p className="text-sm text-muted-foreground">Calcolo costi del personale per anno e per persona</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={v => setYear(+v)}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Aggiungi persona</Button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label={`Costo effettivo ${year}`} value={fmtEuro(kpis.totalActual)} sub="somma mesi attivi" color="border-l-blue-500" />
        <KpiCard label="Persone attive" value={String(kpis.uniqueInCarica.length)} sub={`${kpis.uniqueDip.length} dip., ${kpis.uniquePiva.length} P.IVA`} color="border-l-green-500" />
        <KpiCard label="RAL media dipendenti" value={fmtEuro(kpis.avgRalDip)} sub={`${kpis.uniqueDip.length} dipendenti`} color="border-l-orange-500" />
        <KpiCard label="Costo mens. medio dip." value={fmtEuro(kpis.avgMensDip)} sub={`${kpis.uniqueDip.length} in carica`} color="border-l-purple-500" />
        <KpiCard label="Costo mens. medio P.IVA" value={fmtEuro(kpis.avgMensPiva)} sub={`${kpis.uniquePiva.length} in carica`} color="border-l-blue-500" />
        <KpiCard label="Anzianità media dip." value={kpis.avgAnzDip !== null ? `${kpis.avgAnzDip} anni` : '–'} sub={`${kpis.dipWithAnz.length} con data`} color="border-l-teal-500" />
        <KpiCard label="Anzianità media P.IVA" value={kpis.avgAnzPiva !== null ? `${kpis.avgAnzPiva} anni` : '–'} sub={`${kpis.pivaWithAnz.length} con data`} color="border-l-teal-500" />
        <KpiCard label="Età media" value={kpis.avgAge !== null ? `${kpis.avgAge} anni` : '–'} sub={`${kpis.withAge.length} con data nascita`} color="border-l-cyan-500" />
        <KpiCard
          label="Distribuzione sesso"
          value={kpis.genderTotal > 0 ? `${Math.round(kpis.genderCount.M / kpis.genderTotal * 100)}%M / ${Math.round(kpis.genderCount.F / kpis.genderTotal * 100)}%F` : '–'}
          sub={kpis.genderTotal > 0 ? `${kpis.genderCount.M}M, ${kpis.genderCount.F}F` : 'dati non inseriti'}
          color="border-l-pink-500"
        />
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <Input placeholder="🔍 Cerca nome, job title…" value={search} onChange={e => setSearch(e.target.value)} className="w-56" />
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Team" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i team</SelectItem>
              {teams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterContratto} onValueChange={setFilterContratto}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Contratto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i contratti</SelectItem>
              {contratti.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Checkbox id="pian" checked={showPianificati} onCheckedChange={v => setShowPianificati(!!v)} />
            <Label htmlFor="pian" className="text-xs cursor-pointer">Includi pianificati</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="cess" checked={showCessati} onCheckedChange={v => setShowCessati(!!v)} />
            <Label htmlFor="cess" className="text-xs cursor-pointer">Mostra cessati</Label>
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => setShowMonths(!showMonths)}>
            {showMonths ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {showMonths ? 'Nascondi mesi' : 'Mostra mesi'}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />Esporta CSV</Button>
        </CardContent>
      </Card>

      {/* Main table */}
      <Card>
        <CardContent className="p-0 overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <table className="w-full text-xs whitespace-nowrap">
            <thead className="sticky top-0 z-10 bg-slate-800 text-slate-200">
              <tr>
                {cols.map(c => (
                  <th
                    key={c.key}
                    onClick={() => setSort(c.key)}
                    className={`px-2 py-2 ${c.num ? 'text-right' : 'text-left'} cursor-pointer select-none font-semibold uppercase text-[10px] tracking-wider hover:bg-slate-700`}
                  >
                    {c.label}
                    {sortKey === c.key && <ArrowUpDown className="inline h-3 w-3 ml-1" />}
                  </th>
                ))}
                {showMonths && MONTHS_IT.map(m => (
                  <th key={m} className="px-2 py-2 text-right font-semibold uppercase text-[10px] bg-green-900 text-green-200">{m} {year}</th>
                ))}
                <th className="px-2 py-2 text-right font-semibold uppercase text-[10px] bg-indigo-950 text-indigo-200">Tot. {year}</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sortedData.length === 0 ? (
                <tr><td colSpan={cols.length + (showMonths ? 13 : 1) + 1} className="text-center py-10 text-muted-foreground">
                  Nessuna persona trovata. {employees.length === 0 && 'Aggiungi il primo dipendente con il pulsante in alto.'}
                </td></tr>
              ) : sortedData.map(e => {
                const cess = isCessato(e);
                const fut = isFuturo(e);
                const pian = e.stato === 'pianificato';
                const rowClass = pian ? 'bg-yellow-50 border-l-4 border-yellow-400'
                  : cess ? 'bg-red-50 border-l-4 border-red-400 opacity-75'
                  : fut ? 'bg-green-50 border-l-4 border-green-400'
                  : !e.isActiveInYear ? 'opacity-50' : '';
                return (
                  <tr key={e.id} className={`border-b hover:bg-muted/50 ${rowClass}`}>
                    <td className="px-2 py-2 font-semibold">
                      <button onClick={() => openEdit(e)} className="hover:text-primary hover:underline text-left">
                        {e.cognome || '?'} {e.nome || '?'}
                      </button>
                      {pian && <Badge variant="outline" className="ml-1 text-[9px] border-yellow-400 text-yellow-700">PLAN</Badge>}
                      {cess && <Badge variant="outline" className="ml-1 text-[9px] border-red-400 text-red-700">CESSATO</Badge>}
                      {fut && <Badge variant="outline" className="ml-1 text-[9px] border-green-400 text-green-700">FUTURO</Badge>}
                    </td>
                    <td className="px-2 py-2">{e.job_title || '–'}</td>
                    <td className="px-2 py-2"><Badge variant="secondary" className="text-[10px]">{e.team || '–'}</Badge></td>
                    <td className="px-2 py-2">
                      <Badge variant="outline" className="text-[10px]">{e.contratto}</Badge>
                      {e.orario === 'PT' && <Badge variant="outline" className="ml-1 text-[10px]">PT{e.pt_perc ? ` ${e.pt_perc}%` : ''}</Badge>}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{e.eta ?? '–'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{e.anzianita !== null ? `${e.anzianita}a` : '–'}</td>
                    <td className="px-2 py-2">{dateShort(e.data_inizio)}</td>
                    <td className="px-2 py-2">{dateShort(e.data_fine)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtEuro(e.ral)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtEuro(e.costoAziendaAnnuale)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtEuro(e.costoAziendaMensile)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{e.ore_freelance ?? '–'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{e.costoOrario ? fmtEuro(e.costoOrario) : '–'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{e.bp_unitario ? fmtEuro(e.bp_unitario) : '–'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{e.fringe ? fmtEuro(e.fringe) : '–'}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-bold">{fmtEuro(e.costoTotaleMensile)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtEuro(e.costoTotaleAnnuale)}</td>
                    {showMonths && e.months.map((v, i) => (
                      <td key={i} className={`px-2 py-2 text-right tabular-nums ${v === 0 ? 'text-muted-foreground' : ''}`}>{v === 0 ? '–' : fmtEuro(v)}</td>
                    ))}
                    <td className="px-2 py-2 text-right tabular-nums font-bold text-indigo-700">{fmtEuro(e.totalActual)}</td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openDuplicate(e)} title="Duplica"><Copy className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(e)} title="Modifica"><Pencil className="h-3 w-3" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {sortedData.length > 0 && (
              <tfoot className="sticky bottom-0 bg-slate-800 text-slate-300">
                <tr>
                  <td colSpan={cols.length} className="px-2 py-2 font-bold uppercase text-[10px]">TOTALI</td>
                  {showMonths && monthTotals.map((v, i) => (
                    <td key={i} className="px-2 py-2 text-right tabular-nums font-bold text-indigo-300">{fmtEuro(v)}</td>
                  ))}
                  <td className="px-2 py-2 text-right tabular-nums font-bold text-indigo-300">{fmtEuro(totalActual)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>

      {/* Team summary bars */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm uppercase text-muted-foreground">Costo effettivo per team – {year}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {teamBars.sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun dato disponibile</p>
          ) : teamBars.sorted.map(([team, amt], i) => {
            const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-cyan-500', 'bg-red-500', 'bg-amber-500', 'bg-indigo-500'];
            return (
              <div key={team} className="grid grid-cols-[100px_1fr_120px] items-center gap-3 text-xs">
                <div className="font-semibold">{team}</div>
                <div className="bg-muted rounded-full h-2 overflow-hidden">
                  <div className={`h-full rounded-full ${colors[i % colors.length]}`} style={{ width: `${(amt / teamBars.max * 100).toFixed(1)}%` }} />
                </div>
                <div className="text-right tabular-nums font-bold">{fmtEuro(amt)}</div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Pivot mensile per team */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm uppercase text-muted-foreground">Costo mensile del lavoro per team – {year}</CardTitle>
          <Button variant="outline" size="sm" onClick={exportPivotCSV}><Download className="h-4 w-4 mr-1" />Esporta pivot CSV</Button>
        </CardHeader>
        <CardContent className="overflow-auto p-0">
          <table className="w-full text-xs">
            <thead className="bg-slate-800 text-slate-200">
              <tr>
                <th className="px-3 py-2 text-left uppercase text-[10px] font-semibold">Team</th>
                {MONTHS_IT.map(m => <th key={m} className="px-3 py-2 text-right uppercase text-[10px] font-semibold">{m}</th>)}
                <th className="px-3 py-2 text-right uppercase text-[10px] font-semibold bg-indigo-950 text-indigo-200">Totale</th>
              </tr>
            </thead>
            <tbody>
              {pivotData.map(r => (
                <tr key={r.team} className="border-b hover:bg-muted/50">
                  <td className="px-3 py-2 font-bold">{r.team}</td>
                  {r.months.map((v, i) => (
                    <td key={i} className={`px-3 py-2 text-right tabular-nums ${v === 0 ? 'text-muted-foreground' : ''}`}>{v === 0 ? '–' : fmtEuro(v)}</td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-indigo-700 bg-indigo-50">{fmtEuro(r.total)}</td>
                </tr>
              ))}
              {pivotData.length === 0 && (
                <tr><td colSpan={14} className="text-center py-6 text-muted-foreground">Nessun dato</td></tr>
              )}
            </tbody>
            {pivotData.length > 0 && (
              <tfoot className="bg-slate-800 text-slate-300">
                <tr>
                  <td className="px-3 py-2 font-bold uppercase text-[10px]">TOTALI</td>
                  {Array(12).fill(0).map((_, i) => {
                    const sum = pivotData.reduce((s, r) => s + r.months[i], 0);
                    return <td key={i} className="px-3 py-2 text-right tabular-nums font-bold text-indigo-300">{fmtEuro(sum)}</td>;
                  })}
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-indigo-300 bg-indigo-950">
                    {fmtEuro(pivotData.reduce((s, r) => s + r.total, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>

      <HrEmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={editingEmp}
        duplicate={duplicateMode}
        onSaved={() => refetch()}
        teamSuggestions={teams}
      />
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <Card className={`border-l-4 ${color}`}>
      <CardContent className="p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-lg font-bold mt-1">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
