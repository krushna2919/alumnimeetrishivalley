import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Calendar } from 'lucide-react';
import { format, addDays } from 'date-fns';
import GeofenceSettings from '@/components/admin/GeofenceSettings';

interface BatchConfig {
  id: string;
  year_from: number;
  year_to: number;
  is_registration_open: boolean;
  registration_start_date: string | null;
  registration_end_date: string | null;
}

const AdminSettings = () => {
  const [config, setConfig] = useState<BatchConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    year_from: 1950,
    year_to: 2020,
    is_registration_open: false,
    registration_start_date: '',
    registration_end_date: '',
  });
  
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('batch_configuration')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setConfig(data);
        setFormData({
          year_from: data.year_from,
          year_to: data.year_to,
          is_registration_open: data.is_registration_open,
          registration_start_date: data.registration_start_date 
            ? format(new Date(data.registration_start_date), 'yyyy-MM-dd')
            : '',
          registration_end_date: data.registration_end_date 
            ? format(new Date(data.registration_end_date), 'yyyy-MM-dd')
            : '',
        });
      }
    } catch (error) {
      console.error('Error fetching config:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch batch configuration',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updateData = {
        year_from: formData.year_from,
        year_to: formData.year_to,
        is_registration_open: formData.is_registration_open,
        registration_start_date: formData.registration_start_date 
          ? new Date(formData.registration_start_date).toISOString()
          : null,
        registration_end_date: formData.registration_end_date 
          ? new Date(formData.registration_end_date).toISOString()
          : null,
      };

      if (config?.id) {
        const { error } = await supabase
          .from('batch_configuration')
          .update(updateData)
          .eq('id', config.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('batch_configuration')
          .insert(updateData);

        if (error) throw error;
      }

      toast({
        title: 'Settings Saved',
        description: 'Batch configuration has been updated successfully.',
      });

      fetchConfig();
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: 'Error',
        description: 'Failed to save batch configuration',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage batch configuration and registration settings
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-6 max-w-2xl">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-serif flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Registration Period
                </CardTitle>
                <CardDescription>
                  Configure when alumni can register for the event
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="registration-open" className="font-medium">
                      Registration Open
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Allow alumni to register for the event
                    </p>
                  </div>
                  <Switch
                    id="registration-open"
                    checked={formData.is_registration_open}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_registration_open: checked })
                    }
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={formData.registration_start_date}
                      onChange={(e) => {
                        const startDate = e.target.value;
                        // Auto-calculate end date as start date + 20 days (21 days inclusive)
                        const endDate = startDate 
                          ? format(addDays(new Date(startDate), 20), 'yyyy-MM-dd')
                          : '';
                        setFormData({ 
                          ...formData, 
                          registration_start_date: startDate,
                          registration_end_date: endDate
                        });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Registration period is 3 weeks (21 days) from start date (IST)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={formData.registration_end_date}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Auto-calculated (start date + 3 weeks)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-serif">Eligible Batches</CardTitle>
                <CardDescription>
                  Set the range of graduation years eligible to register
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="year-from">From Year</Label>
                    <Input
                      id="year-from"
                      type="number"
                      min="1900"
                      max="2100"
                      value={formData.year_from}
                      onChange={(e) =>
                        setFormData({ ...formData, year_from: parseInt(e.target.value) || 1950 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year-to">To Year</Label>
                    <Input
                      id="year-to"
                      type="number"
                      min="1900"
                      max="2100"
                      value={formData.year_to}
                      onChange={(e) =>
                        setFormData({ ...formData, year_to: parseInt(e.target.value) || 2020 })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>

            {/* Geofence Settings - Superadmin Only */}
            <GeofenceSettings />
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
