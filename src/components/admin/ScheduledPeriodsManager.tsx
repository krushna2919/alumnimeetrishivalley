import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Calendar, Clock, Save } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface BatchPeriod {
  id: string;
  year_from: number;
  year_to: number;
  is_registration_open: boolean;
  registration_start_date: string | null;
  registration_end_date: string | null;
  /** Stores combined hour (0-23) — minutes stored separately in start_minute */
  start_hour: number;
  /** Minutes component of the start time (0-59) */
  start_minute: number;
  label: string | null;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const formatHourIST = (hour: number) => {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}:00 ${suffix} IST`;
};

const ScheduledPeriodsManager = () => {
  const [periods, setPeriods] = useState<BatchPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPeriods();
  }, []);

  const fetchPeriods = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('batch_configuration')
        .select('*')
        .order('registration_start_date', { ascending: true, nullsFirst: false });

      if (error) throw error;

      setPeriods(
        (data || []).map((d: any) => ({
          id: d.id,
          year_from: d.year_from,
          year_to: d.year_to,
          is_registration_open: d.is_registration_open,
          registration_start_date: d.registration_start_date
            ? format(new Date(d.registration_start_date), 'yyyy-MM-dd')
            : null,
          registration_end_date: d.registration_end_date
            ? format(new Date(d.registration_end_date), 'yyyy-MM-dd')
            : null,
          start_hour: d.start_hour ?? 0,
          start_minute: d.start_minute ?? 0,
          label: d.label ?? null,
        }))
      );
    } catch (error) {
      console.error('Error fetching periods:', error);
      toast({ title: 'Error', description: 'Failed to fetch registration periods', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const updatePeriod = (id: string, field: string, value: any) => {
    setPeriods((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, [field]: value };
        // Auto-calculate end date when start date changes
        if (field === 'registration_start_date' && value) {
          updated.registration_end_date = format(addDays(new Date(value), 20), 'yyyy-MM-dd');
        }
        return updated;
      })
    );
  };

  const savePeriod = async (period: BatchPeriod) => {
    setSavingId(period.id);
    try {
      // Compute the actual start timestamp incorporating start_hour in IST
      let startTimestamp: string | null = null;
      let endTimestamp: string | null = null;

      if (period.registration_start_date) {
        // Create date in IST: date + hour, then convert to UTC by subtracting 5:30
        const startDate = new Date(period.registration_start_date);
        startDate.setUTCHours(period.start_hour - 5, -30, 0, 0); // IST to UTC
        startTimestamp = startDate.toISOString();
      }
      if (period.registration_end_date) {
        endTimestamp = new Date(period.registration_end_date).toISOString();
      }

      const updateData: any = {
        year_from: period.year_from,
        year_to: period.year_to,
        is_registration_open: period.is_registration_open,
        registration_start_date: startTimestamp,
        registration_end_date: endTimestamp,
        start_hour: period.start_hour,
        label: period.label || null,
      };

      const { error } = await supabase
        .from('batch_configuration')
        .update(updateData)
        .eq('id', period.id);

      if (error) throw error;

      toast({ title: 'Saved', description: `Period "${period.label || 'Untitled'}" updated successfully.` });
      fetchPeriods();
    } catch (error) {
      console.error('Error saving period:', error);
      toast({ title: 'Error', description: 'Failed to save period', variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const addPeriod = async () => {
    setIsAdding(true);
    try {
      const { error } = await supabase.from('batch_configuration').insert({
        year_from: 1950,
        year_to: 2020,
        is_registration_open: false,
        start_hour: 0,
        label: `Period ${periods.length + 1}`,
      } as any);

      if (error) throw error;

      toast({ title: 'Added', description: 'New registration period created. Configure and save it.' });
      fetchPeriods();
    } catch (error) {
      console.error('Error adding period:', error);
      toast({ title: 'Error', description: 'Failed to add period', variant: 'destructive' });
    } finally {
      setIsAdding(false);
    }
  };

  const deletePeriod = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from('batch_configuration').delete().eq('id', id);
      if (error) throw error;

      toast({ title: 'Deleted', description: 'Registration period removed.' });
      fetchPeriods();
    } catch (error) {
      console.error('Error deleting period:', error);
      toast({ title: 'Error', description: 'Failed to delete period', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const isCurrentlyActive = (period: BatchPeriod): boolean => {
    if (!period.is_registration_open) return false;
    if (!period.registration_start_date || !period.registration_end_date) return period.is_registration_open;
    const now = new Date();
    const start = new Date(period.registration_start_date);
    const end = new Date(period.registration_end_date);
    // Include full end day in IST
    const endIST = new Date(end);
    endIST.setUTCDate(endIST.getUTCDate() + 1);
    endIST.setUTCHours(18, 30, 0, 0);
    return now >= start && now <= endIST;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Scheduled Registration Periods
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Queue multiple 3-week registration windows. They activate automatically in order.
          </p>
        </div>
        <Button onClick={addPeriod} disabled={isAdding} size="sm">
          {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Add Period
        </Button>
      </div>

      {periods.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="py-8 text-center text-muted-foreground">
            No registration periods configured. Click "Add Period" to create one.
          </CardContent>
        </Card>
      )}

      {periods.map((period, index) => (
        <Card key={period.id} className="shadow-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="font-serif text-lg">
                  {period.label || `Period ${index + 1}`}
                </CardTitle>
                {isCurrentlyActive(period) && (
                  <Badge variant="default">Active Now</Badge>
                )}
                {!period.is_registration_open && (
                  <Badge variant="secondary">Off</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={period.is_registration_open}
                  onCheckedChange={(checked) => updatePeriod(period.id, 'is_registration_open', checked)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deletePeriod(period.id)}
                  disabled={deletingId === period.id}
                  className="text-destructive hover:text-destructive"
                >
                  {deletingId === period.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <CardDescription>
              Batches {period.year_from}–{period.year_to}
              {period.registration_start_date && period.registration_end_date && (
                <> · {period.registration_start_date} to {period.registration_end_date}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Label */}
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={period.label || ''}
                onChange={(e) => updatePeriod(period.id, 'label', e.target.value)}
                placeholder="e.g. Batch 1950-1980"
              />
            </div>

            {/* Year range */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>From Year</Label>
                <Input
                  type="number"
                  min="1900"
                  max="2100"
                  value={period.year_from}
                  onChange={(e) => updatePeriod(period.id, 'year_from', parseInt(e.target.value) || 1950)}
                />
              </div>
              <div className="space-y-2">
                <Label>To Year</Label>
                <Input
                  type="number"
                  min="1900"
                  max="2100"
                  value={period.year_to}
                  onChange={(e) => updatePeriod(period.id, 'year_to', parseInt(e.target.value) || 2020)}
                />
              </div>
            </div>

            {/* Start date, hour, end date */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={period.registration_start_date || ''}
                  onChange={(e) => updatePeriod(period.id, 'registration_start_date', e.target.value || null)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Start Hour (IST)
                </Label>
                <Select
                  value={String(period.start_hour)}
                  onValueChange={(val) => updatePeriod(period.id, 'start_hour', parseInt(val))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {formatHourIST(h)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={period.registration_end_date || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Auto: start + 3 weeks</p>
              </div>
            </div>

            <Button
              onClick={() => savePeriod(period)}
              disabled={savingId === period.id}
              size="sm"
              className="w-full sm:w-auto"
            >
              {savingId === period.id ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> Save Period</>
              )}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ScheduledPeriodsManager;
