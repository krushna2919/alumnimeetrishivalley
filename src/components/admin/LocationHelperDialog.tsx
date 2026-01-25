import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Monitor, Smartphone, ExternalLink, RefreshCw } from 'lucide-react';

interface LocationHelperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
}

type OSType = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'unknown';

const detectOS = (): OSType => {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();

  if (/android/.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
  if (/mac/.test(platform) || /macintosh/.test(userAgent)) return 'macos';
  if (/win/.test(platform) || /windows/.test(userAgent)) return 'windows';
  if (/linux/.test(platform) || /ubuntu/.test(userAgent)) return 'linux';
  
  return 'unknown';
};

const OS_INSTRUCTIONS: Record<OSType, { name: string; icon: typeof Monitor; steps: string[]; settingsUrl?: string }> = {
  windows: {
    name: 'Windows',
    icon: Monitor,
    steps: [
      'Open Settings (Win + I)',
      'Go to Privacy & Security → Location',
      'Turn on "Location services"',
      'Scroll down and enable location for your browser',
      'Return here and click "Retry"',
    ],
    settingsUrl: 'ms-settings:privacy-location',
  },
  macos: {
    name: 'macOS',
    icon: Monitor,
    steps: [
      'Open System Settings (Apple menu → System Settings)',
      'Go to Privacy & Security → Location Services',
      'Enable Location Services',
      'Find your browser and set to "While Using"',
      'Return here and click "Retry"',
    ],
  },
  linux: {
    name: 'Linux / Ubuntu',
    icon: Monitor,
    steps: [
      'Open Settings → Privacy → Location Services',
      'Turn on Location Services',
      'For browsers, also check browser-specific permissions',
      'In Chrome: Settings → Privacy → Site Settings → Location',
      'In Firefox: Preferences → Privacy & Security → Permissions → Location',
      'Return here and click "Retry"',
    ],
  },
  android: {
    name: 'Android',
    icon: Smartphone,
    steps: [
      'Open Settings → Location',
      'Turn on "Use location"',
      'Tap "App permissions" or "App location permissions"',
      'Find your browser and set to "Allow"',
      'Return here and click "Retry"',
    ],
  },
  ios: {
    name: 'iPhone / iPad',
    icon: Smartphone,
    steps: [
      'Open Settings → Privacy & Security → Location Services',
      'Turn on Location Services',
      'Scroll down and find your browser (Safari/Chrome)',
      'Set to "While Using the App"',
      'Return here and click "Retry"',
    ],
  },
  unknown: {
    name: 'Your Device',
    icon: Monitor,
    steps: [
      'Open your device settings',
      'Find Privacy or Location settings',
      'Enable location services',
      'Grant location permission to your browser',
      'Return here and click "Retry"',
    ],
  },
};

const BROWSER_INSTRUCTIONS = [
  {
    name: 'Chrome',
    steps: [
      'Click the lock icon (🔒) in the address bar',
      'Click "Site settings"',
      'Set Location to "Allow"',
      'Refresh the page',
    ],
  },
  {
    name: 'Firefox',
    steps: [
      'Click the lock icon (🔒) in the address bar',
      'Click "Connection secure" → "More Information"',
      'Go to Permissions tab',
      'Uncheck "Use Default" for Location and select "Allow"',
    ],
  },
  {
    name: 'Safari',
    steps: [
      'Click Safari menu → Settings for This Website',
      'Set Location to "Allow"',
      'Or go to Safari → Settings → Websites → Location',
    ],
  },
  {
    name: 'Edge',
    steps: [
      'Click the lock icon (🔒) in the address bar',
      'Click "Site permissions"',
      'Set Location to "Allow"',
    ],
  },
];

const LocationHelperDialog = ({ open, onOpenChange, onRetry }: LocationHelperDialogProps) => {
  const [detectedOS, setDetectedOS] = useState<OSType>('unknown');

  useEffect(() => {
    setDetectedOS(detectOS());
  }, []);

  const osInfo = OS_INSTRUCTIONS[detectedOS];
  const OSIcon = osInfo.icon;

  const handleOpenSettings = () => {
    if (detectedOS === 'windows' && osInfo.settingsUrl) {
      // Try to open Windows settings
      window.location.href = osInfo.settingsUrl;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Enable Location Access
          </DialogTitle>
          <DialogDescription>
            Location access is required for secure login. Follow the steps below to enable it.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="os" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="os" className="flex items-center gap-2">
              <OSIcon className="h-4 w-4" />
              {osInfo.name}
            </TabsTrigger>
            <TabsTrigger value="browser">Browser</TabsTrigger>
          </TabsList>

          <TabsContent value="os" className="mt-4 space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <OSIcon className="h-4 w-4" />
                Steps for {osInfo.name}
              </h4>
              <ol className="space-y-2 text-sm">
                {osInfo.steps.map((step, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                      {index + 1}
                    </span>
                    <span className="text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {detectedOS === 'windows' && osInfo.settingsUrl && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleOpenSettings}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Windows Location Settings
              </Button>
            )}

            <div className="text-xs text-muted-foreground">
              <strong>Detected OS:</strong> {osInfo.name}
              {detectedOS === 'unknown' && (
                <span className="block mt-1">
                  We couldn't detect your OS. Please follow the general steps above.
                </span>
              )}
            </div>
          </TabsContent>

          <TabsContent value="browser" className="mt-4 space-y-4">
            {BROWSER_INSTRUCTIONS.map((browser) => (
              <div key={browser.name} className="rounded-lg border p-3">
                <h4 className="font-medium mb-2">{browser.name}</h4>
                <ol className="space-y-1 text-sm">
                  {browser.steps.map((step, index) => (
                    <li key={index} className="flex gap-2 text-muted-foreground">
                      <span className="flex-shrink-0">{index + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Login
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationHelperDialog;
