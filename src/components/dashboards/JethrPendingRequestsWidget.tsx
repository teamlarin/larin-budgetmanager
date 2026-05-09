import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface JethrPendingRequestsWidgetProps {
  filterUserIds?: string[];
}

export const JethrPendingRequestsWidget = ({
  filterUserIds,
}: JethrPendingRequestsWidgetProps = {}) => {
  const { data, isLoading } = useQuery({
    queryKey: ["jethr-pending", filterUserIds?.join(",") ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("jethr_pending_requests")
        .select(
          "id, type, start_date, end_date, hours, submitted_at, user_id, profiles:user_id(first_name, last_name)",
        )
        .order("start_date", { ascending: true });
      if (filterUserIds && filterUserIds.length > 0) {
        q = q.in("user_id", filterUserIds);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    refetchOnWindowFocus: false,
  });

  if (isLoading) return null;
  if (!data || data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-600" />
          Richieste Jethr in attesa
          <Badge variant="secondary">{data.length}</Badge>
        </CardTitle>
        <CardDescription>
          Ferie e permessi non ancora approvati su Jethr che impatteranno il calendario.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((r: any) => {
            const name =
              `${r.profiles?.first_name ?? ""} ${r.profiles?.last_name ?? ""}`.trim() ||
              "—";
            const sameDay = r.start_date === r.end_date;
            return (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 p-2 rounded-md border"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.type} •{" "}
                    {sameDay
                      ? format(new Date(r.start_date), "d MMM yyyy", { locale: it })
                      : `${format(new Date(r.start_date), "d MMM", { locale: it })} – ${format(
                          new Date(r.end_date),
                          "d MMM yyyy",
                          { locale: it },
                        )}`}
                    {r.hours ? ` • ${r.hours}h` : ""}
                  </div>
                </div>
                <a
                  href="https://app.jethr.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Apri Jethr
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
