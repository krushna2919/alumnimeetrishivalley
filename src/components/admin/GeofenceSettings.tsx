import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Save, LocateFixed } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface GeofenceConfig {
  id: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  is_enabled: boolean;
}

const GeofenceSettings = () => {
  const [config, setConfig] = useState<GeofenceConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [formData, setFormData] = useState({
    latitude: '',
    longitude: '',
    radius_km: '2.5',
    is_enabled: true,
  });

  const { toast } = useToast();
  const { userRole } = useAuth();

  const isSuperadmin = userRole === 'superadmin';

  useEffect(() => {
    if (isSuperadmin) {
      fetchConfig();
    }
  }, [isSuperadmin]);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('geofence_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setConfig(data);
        setFormData({
          latitude: data.latitude.toString(),
          longitude: data.longitude.toString(),
          radius_km: data.radius_km.toString(),
          is_enabled: data.is_enabled,
        });
      }
    } catch (error) {
      console.error('Error fetching geofence config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Error',
        description: 'Geolocation is not supported by your browser',
        variant: 'destructive',
      });
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData({
          ...formData,
          latitude: position.coords.latitude.toFixed(8),
          longitude: position.coords.longitude.toFixed(8),
        });
        setIsGettingLocation(false);
        toast({
          title: 'Location Captured',
          description: 'Your current location has been set as the base location.',
        });
      },
      (error) => {
        setIsGettingLocation(false);
        toast({
          title: 'Location Error',
          description: 'Unable to get your location. Please enter coordinates manually.',
          variant: 'destructive',
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async () => {
    if (!formData.latitude || !formData.longitude) {
      toast({
        title: 'Validation Error',
        description: 'Please enter valid latitude and longitude coordinates.',
        variant: 'destructive',
      });
      return;
    }

    const lat = parseFloat(formData.latitude);
    const lon = parseFloat(formData.longitude);
    const radius = parseFloat(formData.radius_km);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      toast({
        title: 'Validation Error',
        description: 'Latitude must be between -90 and 90.',
        variant: 'destructive',
      });
      return;
    }

    if (isNaN(lon) || lon < -180 || lon > 180) {
      toast({
        title: 'Validation Error',
        description: 'Longitude must be between -180 and 180.',
        variant: 'destructive',
      });
      return;
    }

    if (isNaN(radius) || radius <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Radius must be a positive number.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const updateData = {
        latitude: lat,
        longitude: lon,
        radius_km: radius,
        is_enabled: formData.is_enabled,
      };

      if (config?.id) {
        const { error } = await supabase
          .from('geofence_settings')
          .update(updateData)
          .eq('id', config.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('geofence_settings')
          .insert(updateData);

        if (error) throw error;
      }

      toast({
        title: 'Settings Saved',
        description: 'Geofence configuration has been updated successfully.',
      });

      fetchConfig();
    } catch (error) {
      console.error('Error saving geofence config:', error);
      toast({
        title: 'Error',
        description: 'Failed to save geofence configuration',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isSuperadmin) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="font-serif flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Geofence Security
        </CardTitle>
        <CardDescription>
          Configure location-based access restrictions for non-superadmin users. 
          Users outside the specified radius will be blocked from logging in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="geofence-enabled" className="font-medium">
              Enable Geofencing
            </Label>
            <p className="text-sm text-muted-foreground">
              Restrict login to users within the specified radius
            </p>
          </div>
          <Switch
            id="geofence-enabled"
            checked={formData.is_enabled}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, is_enabled: checked })
            }
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="font-medium">Base Location</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGetCurrentLocation}
              disabled={isGettingLocation}
            >
              {isGettingLocation ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Getting Location...
                </>
              ) : (
                <>
                  <LocateFixed className="mr-2 h-4 w-4" />
                  Use Current Location
                </>
              )}
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="text"
                placeholder="e.g., 17.4485"
                value={formData.latitude}
                onChange={(e) =>
                  setFormData({ ...formData, latitude: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="text"
                placeholder="e.g., 78.3915"
                value={formData.longitude}
                onChange={(e) =>
                  setFormData({ ...formData, longitude: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="radius">Allowed Radius (km)</Label>
            <Input
              id="radius"
              type="number"
              step="0.1"
              min="0.1"
              placeholder="2.5"
              value={formData.radius_km}
              onChange={(e) =>
                setFormData({ ...formData, radius_km: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Users must be within this radius of the base location to log in. 
              Superadmins are exempt from this restriction.
            </p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Geofence Settings
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default GeofenceSettings;
