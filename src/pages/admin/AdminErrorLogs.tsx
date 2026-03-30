import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, RefreshCw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface ErrorLog {
  id: string;
  session_id: string | null;
  user_agent: string | null;
  page_url: string | null;
  error_type: string;
  message: string | null;
  stack: string | null;
  request_url: string | null;
  request_method: string | null;
  response_status: number | null;
  console_logs: unknown[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const errorTypeColors: Record<string, string> = {
  fetch_failure: "bg-destructive text-destructive-foreground",
  network_error: "bg-amber-500 text-white",
  js_error: "bg-red-600 text-white",
  unhandled_rejection: "bg-orange-500 text-white",
  console_error: "bg-muted text-muted-foreground",
};

const AdminErrorLogs = () => {
  const [selectedLog, setSelectedLog] = useState<ErrorLog | null>(null);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["client-error-logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_error_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      return data as ErrorLog[];
    },
    refetchInterval: 30_000,
  });

  const handleClearLogs = async () => {
    // We don't have delete access via client, just inform
    toast.info("To clear logs, use the backend SQL editor");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Client Error Logs</h1>
            <p className="text-muted-foreground">
              Browser errors, failed requests, and console output from users
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Recent Errors ({logs?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading logs…</p>
            ) : !logs?.length ? (
              <p className="text-muted-foreground text-center py-8">No error logs captured yet.</p>
            ) : (
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow
                        key={log.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedLog(log)}
                      >
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(log.created_at), "MMM d HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <Badge className={errorTypeColors[log.error_type] ?? "bg-muted"}>
                            {log.error_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-sm">
                          {log.message}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                          {log.request_url ?? "—"}
                        </TableCell>
                        <TableCell>
                          {log.response_status ? (
                            <Badge variant="outline">{log.response_status}</Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Error Details</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-medium text-muted-foreground">Type:</span>
                    <Badge className={`ml-2 ${errorTypeColors[selectedLog.error_type] ?? ""}`}>
                      {selectedLog.error_type}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Time:</span>{" "}
                    {format(new Date(selectedLog.created_at), "yyyy-MM-dd HH:mm:ss")}
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium text-muted-foreground">Page:</span>{" "}
                    <span className="break-all">{selectedLog.page_url}</span>
                  </div>
                  {selectedLog.request_url && (
                    <>
                      <div className="col-span-2">
                        <span className="font-medium text-muted-foreground">Request:</span>{" "}
                        {selectedLog.request_method} {selectedLog.request_url}
                      </div>
                      {selectedLog.response_status && (
                        <div>
                          <span className="font-medium text-muted-foreground">Status:</span>{" "}
                          {selectedLog.response_status}
                        </div>
                      )}
                    </>
                  )}
                  <div className="col-span-2">
                    <span className="font-medium text-muted-foreground">Session:</span>{" "}
                    <code className="text-xs">{selectedLog.session_id}</code>
                  </div>
                </div>

                <div>
                  <p className="font-medium text-muted-foreground mb-1">Message:</p>
                  <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap break-all">
                    {selectedLog.message}
                  </pre>
                </div>

                {selectedLog.stack && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Stack Trace:</p>
                    <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                      {selectedLog.stack}
                    </pre>
                  </div>
                )}

                {selectedLog.console_logs && (selectedLog.console_logs as unknown[]).length > 0 && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">
                      Console Logs (recent):
                    </p>
                    <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                      {JSON.stringify(selectedLog.console_logs, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.metadata && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Metadata:</p>
                    <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                <div>
                  <p className="font-medium text-muted-foreground mb-1">User Agent:</p>
                  <p className="text-xs text-muted-foreground break-all">
                    {selectedLog.user_agent}
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminErrorLogs;
