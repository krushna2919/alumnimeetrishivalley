import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileText, FileSpreadsheet, Printer, Download } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { format } from 'date-fns';

type Registration = Tables<'registrations'>;

/** All exportable fields with labels */
const EXPORTABLE_FIELDS: { key: keyof Registration; label: string; group: string }[] = [
  // Identity
  { key: 'application_id', label: 'Application ID', group: 'Identity' },
  { key: 'name', label: 'Name', group: 'Identity' },
  { key: 'email', label: 'Email', group: 'Identity' },
  { key: 'phone', label: 'Phone', group: 'Identity' },
  { key: 'gender', label: 'Gender', group: 'Identity' },
  { key: 'year_of_passing', label: 'Year of Passing', group: 'Identity' },
  { key: 'occupation', label: 'Occupation', group: 'Identity' },
  { key: 'board_type', label: 'Board Type', group: 'Identity' },
  { key: 'tshirt_size', label: 'T-Shirt Size', group: 'Identity' },
  // Address
  { key: 'address_line1', label: 'Address Line 1', group: 'Address' },
  { key: 'address_line2', label: 'Address Line 2', group: 'Address' },
  { key: 'city', label: 'City', group: 'Address' },
  { key: 'district', label: 'District', group: 'Address' },
  { key: 'state', label: 'State', group: 'Address' },
  { key: 'postal_code', label: 'Postal Code', group: 'Address' },
  { key: 'country', label: 'Country', group: 'Address' },
  // Registration
  { key: 'stay_type', label: 'Stay Type', group: 'Registration' },
  { key: 'registration_fee', label: 'Registration Fee', group: 'Registration' },
  { key: 'registration_status', label: 'Registration Status', group: 'Registration' },
  { key: 'hostel_name', label: 'Hostel Name', group: 'Registration' },
  { key: 'parent_application_id', label: 'Parent Application ID', group: 'Registration' },
  // Payment
  { key: 'payment_status', label: 'Payment Status', group: 'Payment' },
  { key: 'payment_reference', label: 'Payment Reference', group: 'Payment' },
  { key: 'payment_date', label: 'Payment Date', group: 'Payment' },
  { key: 'accounts_verified', label: 'Accounts Verified', group: 'Payment' },
  // Dates
  { key: 'created_at', label: 'Registered On', group: 'Dates' },
  { key: 'updated_at', label: 'Last Updated', group: 'Dates' },
  { key: 'approved_at', label: 'Approved At', group: 'Dates' },
];

const DEFAULT_SELECTED: (keyof Registration)[] = [
  'application_id', 'name', 'email', 'phone', 'gender', 'year_of_passing',
  'stay_type', 'registration_fee', 'registration_status', 'payment_status', 'created_at',
];

interface ExportRegistrationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrations: Registration[];
}

const ExportRegistrationsDialog = ({ open, onOpenChange, registrations }: ExportRegistrationsDialogProps) => {
  const [selectedFields, setSelectedFields] = useState<Set<keyof Registration>>(new Set(DEFAULT_SELECTED));
  const [isExporting, setIsExporting] = useState(false);

  const toggleField = (key: keyof Registration) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelectedFields(new Set(EXPORTABLE_FIELDS.map(f => f.key)));
  const deselectAll = () => setSelectedFields(new Set());

  const getFieldLabel = (key: keyof Registration) =>
    EXPORTABLE_FIELDS.find(f => f.key === key)?.label ?? key;

  const formatValue = (key: keyof Registration, value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (key === 'created_at' || key === 'updated_at' || key === 'approved_at' || key === 'accounts_verified_at') {
      try { return format(new Date(value as string), 'dd MMM yyyy, hh:mm a'); } catch { return String(value); }
    }
    if (key === 'payment_date' && value) {
      try { return format(new Date(value as string), 'dd MMM yyyy'); } catch { return String(value); }
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  const getExportData = () => {
    const fields = EXPORTABLE_FIELDS.filter(f => selectedFields.has(f.key));
    const headers = fields.map(f => f.label);
    const rows = registrations.map(reg =>
      fields.map(f => formatValue(f.key, reg[f.key]))
    );
    return { fields, headers, rows };
  };

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      await import('jspdf-autotable');
      const { headers, rows } = getExportData();

      const doc = new jsPDF({ orientation: headers.length > 8 ? 'landscape' : 'portrait' });
      doc.setFontSize(16);
      doc.text('Registrations Export', 14, 15);
      doc.setFontSize(9);
      doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')} | Records: ${rows.length}`, 14, 22);

      (doc as any).autoTable({
        head: [headers],
        body: rows,
        startY: 28,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], fontSize: 7 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { top: 28 },
      });

      doc.save(`registrations-export-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      const XLSX = await import('xlsx');
      const { headers, rows } = getExportData();

      const wsData = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      // Auto-size columns
      ws['!cols'] = headers.map((h, i) => ({
        wch: Math.max(h.length, ...rows.map(r => (r[i] || '').length).slice(0, 100)) + 2,
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Registrations');
      XLSX.writeFile(wb, `registrations-export-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    } catch (err) {
      console.error('Excel export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    const { headers, rows } = getExportData();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html><head><title>Registrations Export</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .meta { font-size: 11px; color: #666; margin-bottom: 16px; }
        table { border-collapse: collapse; width: 100%; font-size: 10px; }
        th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; }
        th { background: #3b82f6; color: white; font-weight: 600; }
        tr:nth-child(even) { background: #f5f7fa; }
        @media print { body { margin: 10px; } }
      </style></head><body>
      <h1>Registrations Export</h1>
      <div class="meta">Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')} | Records: ${rows.length}</div>
      <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row => `<tr>${row.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  // Group fields by group name
  const groups = EXPORTABLE_FIELDS.reduce<Record<string, typeof EXPORTABLE_FIELDS>>((acc, field) => {
    if (!acc[field.group]) acc[field.group] = [];
    acc[field.group].push(field);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Export Registrations</DialogTitle>
          <DialogDescription>
            Select fields to include and choose export format. Exporting {registrations.length} record(s).
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-2">
          <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>Deselect All</Button>
          <span className="text-sm text-muted-foreground ml-auto self-center">
            {selectedFields.size} field(s)
          </span>
        </div>

        <ScrollArea className="h-[320px] border rounded-md p-3">
          {Object.entries(groups).map(([group, fields]) => (
            <div key={group} className="mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{group}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {fields.map(field => (
                  <label key={field.key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                    <Checkbox
                      checked={selectedFields.has(field.key)}
                      onCheckedChange={() => toggleField(field.key)}
                    />
                    {field.label}
                  </label>
                ))}
              </div>
              <Separator className="mt-2" />
            </div>
          ))}
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button
            onClick={exportToPDF}
            disabled={isExporting || selectedFields.size === 0}
            className="flex-1"
            variant="default"
          >
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button
            onClick={exportToExcel}
            disabled={isExporting || selectedFields.size === 0}
            className="flex-1"
            variant="default"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button
            onClick={handlePrint}
            disabled={selectedFields.size === 0}
            className="flex-1"
            variant="outline"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportRegistrationsDialog;
