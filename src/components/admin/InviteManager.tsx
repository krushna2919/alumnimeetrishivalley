import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Mail, Send, RefreshCw, Clock, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Invite {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  used: boolean;
  used_at: string | null;
  created_at: string;
  extended_count: number;
}

const InviteManager = () => {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchInvites();
  }, []);

  const fetchInvites = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("registration_invites" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvites((data as any as Invite[]) || []);
    } catch (err) {
      console.error("Error fetching invites:", err);
      toast({ title: "Error", description: "Failed to load invites", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const sendInvite = async () => {
    if (!email.trim() || !user) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      // Create the invite record
      const { data: invite, error: insertError } = await supabase
        .from("registration_invites" as any)
        .insert({ email: email.trim(), created_by: user.id } as any)
        .select()
        .single();

      if (insertError) throw insertError;

      const inviteData = invite as any as Invite;

      // Send email via edge function
      const { error: sendError } = await supabase.functions.invoke("send-invite-link", {
        body: { email: email.trim(), inviteId: inviteData.id },
      });

      if (sendError) {
        toast({ title: "Warning", description: "Invite created but email failed to send. You can resend it.", variant: "destructive" });
      } else {
        toast({ title: "Invite Sent", description: `Registration invite sent to ${email.trim()}` });
      }

      setEmail("");
      fetchInvites();
    } catch (err) {
      console.error("Error sending invite:", err);
      toast({ title: "Error", description: "Failed to create invite", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const extendInvite = async (invite: Invite) => {
    setExtendingId(invite.id);
    try {
      const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from("registration_invites" as any)
        .update({
          expires_at: newExpiry,
          extended_count: invite.extended_count + 1,
        } as any)
        .eq("id", invite.id);

      if (error) throw error;

      // Resend the email with new expiry
      await supabase.functions.invoke("send-invite-link", {
        body: { email: invite.email, inviteId: invite.id },
      });

      toast({ title: "Extended", description: `Invite extended by 24 hours and email resent to ${invite.email}` });
      fetchInvites();
    } catch (err) {
      console.error("Error extending invite:", err);
      toast({ title: "Error", description: "Failed to extend invite", variant: "destructive" });
    } finally {
      setExtendingId(null);
    }
  };

  const resendInvite = async (invite: Invite) => {
    setResendingId(invite.id);
    try {
      const { error } = await supabase.functions.invoke("send-invite-link", {
        body: { email: invite.email, inviteId: invite.id },
      });

      if (error) throw error;
      toast({ title: "Resent", description: `Invite email resent to ${invite.email}` });
    } catch (err) {
      console.error("Error resending invite:", err);
      toast({ title: "Error", description: "Failed to resend invite", variant: "destructive" });
    } finally {
      setResendingId(null);
    }
  };

  const deleteInvite = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from("registration_invites" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Deleted", description: "Invite removed." });
      fetchInvites();
    } catch (err) {
      console.error("Error deleting invite:", err);
      toast({ title: "Error", description: "Failed to delete invite", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const getInviteStatus = (invite: Invite): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } => {
    if (invite.used) return { label: "Used", variant: "default" };
    if (new Date(invite.expires_at) < new Date()) return { label: "Expired", variant: "destructive" };
    return { label: "Active", variant: "secondary" };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Send Registration Invite
          </CardTitle>
          <CardDescription>
            Send a private registration link to an email address. The link expires in 24 hours and is for a single registrant only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="invite-email" className="sr-only">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="alumnus@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendInvite()}
              />
            </div>
            <Button onClick={sendInvite} disabled={isSending || !email.trim()}>
              {isSending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" /> Send Invite</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {invites.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Sent Invites ({invites.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invites.map((invite) => {
                const status = getInviteStatus(invite);
                const isExpired = new Date(invite.expires_at) < new Date() && !invite.used;

                return (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-lg border border-border"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground truncate">{invite.email}</span>
                        <Badge variant={status.variant}>{status.label}</Badge>
                        {invite.extended_count > 0 && (
                          <Badge variant="outline">Extended ×{invite.extended_count}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Created {format(new Date(invite.created_at), "MMM d, yyyy h:mm a")}
                        {" · "}
                        {invite.used
                          ? `Used ${invite.used_at ? format(new Date(invite.used_at), "MMM d, h:mm a") : ""}`
                          : `Expires ${format(new Date(invite.expires_at), "MMM d, yyyy h:mm a")}`
                        }
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!invite.used && isExpired && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => extendInvite(invite)}
                          disabled={extendingId === invite.id}
                        >
                          {extendingId === invite.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <><Clock className="mr-1 h-3 w-3" /> Extend 24h</>
                          )}
                        </Button>
                      )}
                      {!invite.used && !isExpired && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resendInvite(invite)}
                          disabled={resendingId === invite.id}
                        >
                          {resendingId === invite.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <><RefreshCw className="mr-1 h-3 w-3" /> Resend</>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteInvite(invite.id)}
                        disabled={deletingId === invite.id}
                        className="text-destructive hover:text-destructive"
                      >
                        {deletingId === invite.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InviteManager;
