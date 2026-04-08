import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertCircle, RefreshCw, Filter, Layers, Eye } from "lucide-react";
import { format } from "date-fns";

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

interface GroupedError {
  key: string;
  error_type: string;
  message: string;
  count: number;
  latest: ErrorLog;
  oldest_at: string;
  latest_at: string;
  sessions: Set<string>;
  pages: Set<string>;
  entries: ErrorLog[];
}

const NOISE_TYPES = new Set(["console_error"]);
const NOISE_PATTERNS = [
  /Function components cannot be given refs/i,
  /Warning:/,
  /React does not recognize/i,
  /Each child in a list should have a unique/i,
  /validateDOMNesting/i,
  /findDOMNode is deprecated/i,
  /ResizeObserver loop/i,
  /\[vite\]/i,
];

const isNoise = (log: ErrorLog): boolean => {
  if (NOISE_TYPES.has(log.error_type)) return true;
  const msg = log.message ?? "";
  return NOISE_PATTERNS.some((p) => p.test(msg));
};

const errorTypeConfig: Record<string, { label: string; color: string; priority: number }> = {
  fetch_failure: { label: "Fetch Failed", color: "bg-destructive text-destructive-foreground", priority: 1 },
  network_error: { label: "Server Error", color: "bg-amber-600 text-white", priority: 2 },
  js_error: { label: "JS Crash", color: "bg-red-600 text-white", priority: 3 },
  unhandled_rejection: { label: "Unhandled Promise", color: "bg-orange-500 text-white", priority: 4 },
  console_error: { label: "Console", color: "bg-muted text-muted-foreground", priority: 5 },
};

const groupKey = (log: ErrorLog) => {
  const msg = (log.message ?? "").slice(0, 120);
  return `${log.error_type}::${msg}`;
};

const extractPageName = (url: string | null): string => {
  if (!url) return "Unknown";
  try {
    const path = new URL(url).pathname;
    if (path === "/" || path === "") return "Home / Registration";
    if (path.startsWith("/invite")) return "Invite Registration";
    if (path.startsWith("/admin/registrations")) return "Admin → Registrations";
    if (path.startsWith("/admin/settings")) return "Admin → Settings";
    if (path.startsWith("/admin/hostel")) return "Admin → Hostel";
    if (path.startsWith("/admin/accounts")) return "Admin → Accounts";
    if (path.startsWith("/admin/activity")) return "Admin → Activity";
    if (path.startsWith("/admin/error")) return "Admin → Error Logs";
    if (path.startsWith("/admin/users")) return "Admin → Users";
    if (path.startsWith("/admin")) return "Admin Dashboard";
    return path;
  } catch {
    return url.slice(0, 40);
  }
};

const extractAction = (log: ErrorLog): string => {
  if (log.request_url) {
    const fn = log.request_url.match(/functions\/v1\/([^?/]+)/)?.[1];
    if (fn === "verify-captcha-register") return "Submitting registration";
    if (fn === "send-registration-email") return "Sending email";
    if (fn === "send-invite-link") return "Sending invite";
    if (fn === "send-otp") return "Sending OTP";
    if (fn === "verify-otp") return "Verifying OTP";
    if (fn === "list-payment-proofs") return "Loading payment proofs";
    if (fn === "list-payment-receipts") return "Loading receipts";
    if (fn) return `Calling ${fn}`;

    if (log.request_url.includes("/rest/v1/registrations")) return "Loading/saving registrations";
    if (log.request_url.includes("/rest/v1/batch_configuration")) return "Loading batch config";
    if (log.request_url.includes("/storage/")) return "Uploading/downloading file";
    if (log.request_url.includes("/rest/v1/")) return "Database operation";
  }

  const msg = log.message ?? "";
  if (msg.includes("payment")) return "Payment flow";
  if (msg.includes("registration")) return "Registration flow";

  return extractPageName(log.page_url);
};

type ViewMode = "grouped" | "flat";
type FilterType = "all" | "actionable";

const AdminErrorLogs = () => {
  const [selectedLog, setSelectedLog] = useState<ErrorLog | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupedError | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");
  const [filterType, setFilterType] = useState<FilterType>("actionable");

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["client-error-logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_error_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as ErrorLog[];
    },
    refetchInterval: 30_000,
  });

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return filterType === "actionable" ? logs.filter((l) => !isNoise(l)) : logs;
  }, [logs, filterType]);

  const grouped = useMemo(() => {
    const map = new Map<string, GroupedError>();
    for (const log of filteredLogs) {
      const k = groupKey(log);
      const existing = map.get(k);
      if (existing) {
        existing.count++;
        existing.entries.push(log);
        if (log.session_id) existing.sessions.add(log.session_id);
        if (log.page_url) existing.pages.add(extractPageName(log.page_url));
        if (log.created_at < existing.oldest_at) existing.oldest_at = log.created_at;
        if (log.created_at > existing.latest_at) {
          existing.latest_at = log.created_at;
          existing.latest = log;
        }
      } else {
        map.set(k, {
          key: k,
          error_type: log.error_type,
          message: log.message ?? "(no message)",
          count: 1,
          latest: log,
          oldest_at: log.created_at,
          latest_at: log.created_at,
          sessions: new Set(log.session_id ? [log.session_id] : []),
          pages: new Set([extractPageName(log.page_url)]),
          entries: [log],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const pa = errorTypeConfig[a.error_type]?.priority ?? 99;
      const pb = errorTypeConfig[b.error_type]?.priority ?? 99;
      if (pa !== pb) return pa - pb;
      return new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime();
    });
  }, [filteredLogs]);

  const noiseCount = useMemo(() => {
    if (!logs) return 0;
    return logs.filter(isNoise).length;
  }, [logs]);

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Error Logs</h1>
            <p className="text-sm text-muted-foreground">
              {filteredLogs.length} errors
              {noiseCount > 0 && filterType === "actionable" && (
                <span className="ml-1">({noiseCount} noise filtered)</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="actionable">Actionable only</SelectItem>
                <SelectItem value="all">Show all</SelectItem>
              </SelectContent>
            </Select>
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <Layers className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grouped">Grouped</SelectItem>
                <SelectItem value="flat">Flat list</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1 h-8">
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading…</p>
            ) : filteredLogs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No errors captured yet.</p>
            ) : viewMode === "grouped" ? (
              <ScrollArea className="h-[550px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Count</TableHead>
                      <TableHead className="w-[100px]">Type</TableHead>
                      <TableHead>What happened</TableHead>
                      <TableHead className="w-[130px]">Where / Action</TableHead>
                      <TableHead className="w-[80px]">Users</TableHead>
                      <TableHead className="w-[100px]">Last seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grouped.map((g) => (
                      <TableRow
                        key={g.key}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedGroup(g)}
                      >
                        <TableCell>
                          <Badge variant="secondary" className="font-mono">
                            {g.count}×
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={errorTypeConfig[g.error_type]?.color ?? "bg-muted"}>
                            {errorTypeConfig[g.error_type]?.label ?? g.error_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[250px] text-sm">
                          <p className="truncate font-medium">{g.message}</p>
                          {g.latest.request_url && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {g.latest.request_method} {g.latest.request_url.replace(/https?:\/\/[^/]+/, "")}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {extractAction(g.latest)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {g.sessions.size} session{g.sessions.size !== 1 ? "s" : ""}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(g.latest_at), "MMM d HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <ScrollArea className="h-[550px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>What happened</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow
                        key={log.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedLog(log)}
                      >
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(log.created_at), "MMM d HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <Badge className={errorTypeConfig[log.error_type]?.color ?? "bg-muted"}>
                            {errorTypeConfig[log.error_type]?.label ?? log.error_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate text-sm">
                          {log.message}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {extractAction(log)}
                        </TableCell>
                        <TableCell>
                          {log.response_status ? (
                            <Badge variant="outline">{log.response_status}</Badge>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Group detail dialog */}
        <Dialog open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Badge className={errorTypeConfig[selectedGroup?.error_type ?? ""]?.color ?? ""}>
                  {errorTypeConfig[selectedGroup?.error_type ?? ""]?.label ?? selectedGroup?.error_type}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {selectedGroup?.count} occurrence{selectedGroup?.count !== 1 ? "s" : ""}
                </span>
              </DialogTitle>
            </DialogHeader>
            {selectedGroup && (
              <div className="space-y-4 text-sm">
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <p className="font-medium">Summary</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div><span className="text-muted-foreground">First seen:</span> {format(new Date(selectedGroup.oldest_at), "MMM d, HH:mm:ss")}</div>
                    <div><span className="text-muted-foreground">Last seen:</span> {format(new Date(selectedGroup.latest_at), "MMM d, HH:mm:ss")}</div>
                    <div><span className="text-muted-foreground">Affected sessions:</span> {selectedGroup.sessions.size}</div>
                    <div><span className="text-muted-foreground">Pages:</span> {Array.from(selectedGroup.pages).join(", ")}</div>
                    <div className="col-span-2"><span className="text-muted-foreground">User action:</span> {extractAction(selectedGroup.latest)}</div>
                  </div>
                </div>

                <div>
                  <p className="font-medium mb-1">Error Message</p>
                  <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap break-all">
                    {selectedGroup.message}
                  </pre>
                </div>

                {selectedGroup.latest.stack && (
                  <div>
                    <p className="font-medium mb-1">Stack Trace (latest)</p>
                    <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                      {selectedGroup.latest.stack}
                    </pre>
                  </div>
                )}

                {selectedGroup.entries.length > 1 && (
                  <div>
                    <p className="font-medium mb-1">All Occurrences ({selectedGroup.entries.length})</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {selectedGroup.entries.slice(0, 20).map((e) => (
                        <div
                          key={e.id}
                          className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1 cursor-pointer hover:bg-muted"
                          onClick={() => { setSelectedGroup(null); setSelectedLog(e); }}
                        >
                          <span>{format(new Date(e.created_at), "MMM d HH:mm:ss")}</span>
                          <span className="text-muted-foreground">{extractPageName(e.page_url)}</span>
                          <Eye className="w-3 h-3 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Single log detail dialog */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Error Details</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <Badge className={`ml-2 ${errorTypeConfig[selectedLog.error_type]?.color ?? ""}`}>
                      {errorTypeConfig[selectedLog.error_type]?.label ?? selectedLog.error_type}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Time:</span>{" "}
                    {format(new Date(selectedLog.created_at), "yyyy-MM-dd HH:mm:ss")}
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">User was:</span>{" "}
                    <strong>{extractAction(selectedLog)}</strong> on <em>{extractPageName(selectedLog.page_url)}</em>
                  </div>
                  {selectedLog.request_url && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Request:</span>{" "}
                      {selectedLog.request_method} {selectedLog.request_url}
                      {selectedLog.response_status && (
                        <Badge variant="outline" className="ml-2">{selectedLog.response_status}</Badge>
                      )}
                    </div>
                  )}
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Session:</span>{" "}
                    <code className="text-xs">{selectedLog.session_id}</code>
                  </div>
                </div>

                <div>
                  <p className="font-medium mb-1">Message</p>
                  <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap break-all">
                    {selectedLog.message}
                  </pre>
                </div>

                {selectedLog.stack && (
                  <div>
                    <p className="font-medium mb-1">Stack Trace</p>
                    <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                      {selectedLog.stack}
                    </pre>
                  </div>
                )}

                {selectedLog.console_logs && (selectedLog.console_logs as unknown[]).length > 0 && (
                  <div>
                    <p className="font-medium mb-1">Console Context</p>
                    <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                      {JSON.stringify(selectedLog.console_logs, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.metadata && (
                  <div>
                    <p className="font-medium mb-1">Metadata</p>
                    <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                <div>
                  <p className="font-medium mb-1">User Agent</p>
                  <p className="text-xs text-muted-foreground break-all">{selectedLog.user_agent}</p>
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
