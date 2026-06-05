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
  /** Already-filtered registrations matching the user's current page filters. */
  registrations: Registration[];
  /** Full unfiltered set; if omitted, falls back to `registrations`. */
  allRegistrations?: Registration[];
  /** Whether the user has any active filter on the registrations page. */
  hasActiveFilters?: boolean;
  /** Human-readable list of active filters to embed in the export. */
  activeFilters?: string[];
}

const ExportRegistrationsDialog = ({
  open,
  onOpenChange,
  registrations,
  allRegistrations,
  hasActiveFilters = false,
  activeFilters = [],
}: ExportRegistrationsDialogProps) => {
  const [selectedFields, setSelectedFields] = useState<Set<keyof Registration>>(new Set(DEFAULT_SELECTED));
  const [isExporting, setIsExporting] = useState(false);
  // When true (default if filters are active), export only the rows matching
  // the page filters. When false, export the full unfiltered set.
  const [matchPageFilters, setMatchPageFilters] = useState(true);

  const fullSet = allRegistrations ?? registrations;
  const effectiveRows = matchPageFilters ? registrations : fullSet;

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
      const [{ default: jsPDF }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const { fields, headers, rows } = getExportData();

      // Always use landscape for many columns; use A3 for 20+ fields
      const useA3 = headers.length >= 20;
      const doc = new jsPDF({
        orientation: 'landscape',
        format: useA3 ? 'a3' : 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // --- Header band ---
      doc.setFillColor(30, 58, 95); // dark navy
      doc.rect(0, 0, pageWidth, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Registrations Export', 14, 16);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}  |  Records: ${rows.length}  |  Fields: ${headers.length}`,
        14, 24
      );

      // Reset text color for table
      doc.setTextColor(0, 0, 0);

      // --- Dynamically compute font size based on column count ---
      // More columns → smaller font to prevent overflow
      let fontSize = 7;
      if (headers.length > 20) fontSize = 5;
      else if (headers.length > 14) fontSize = 6;

      // --- Compute optimal column widths proportionally ---
      // Give each column a weight based on its max content length
      const colMaxLens = headers.map((h, i) => {
        const contentMax = rows.slice(0, 80).reduce((max, r) => Math.max(max, (r[i] || '').length), 0);
        return Math.max(h.length, contentMax);
      });
      const totalLen = colMaxLens.reduce((s, l) => s + l, 0);
      const usableWidth = pageWidth - 20; // 10mm margin each side
      const colWidths = colMaxLens.map(l => Math.max((l / totalLen) * usableWidth, 12));

      // --- Table config ---
      const tableOptions = {
        head: [headers],
        body: rows,
        startY: 32,
        theme: 'grid' as const,
        styles: {
          fontSize,
          cellPadding: 1.5,
          overflow: 'linebreak' as const,
          lineColor: [200, 200, 200] as [number, number, number],
          lineWidth: 0.2,
          valign: 'middle' as const,
        },
        headStyles: {
          fillColor: [30, 58, 95] as [number, number, number],
          textColor: [255, 255, 255] as [number, number, number],
          fontSize: fontSize + 0.5,
          fontStyle: 'bold' as const,
          halign: 'center' as const,
          cellPadding: 2,
          minCellHeight: 8,
        },
        alternateRowStyles: {
          fillColor: [240, 244, 248] as [number, number, number],
        },
        columnStyles: Object.fromEntries(
          colWidths.map((w, i) => [i, { cellWidth: w }])
        ),
        margin: { top: 32, left: 10, right: 10, bottom: 18 },
        tableWidth: 'wrap' as const,
        // Footer on each page
        didDrawPage: (data: any) => {
          const pageNum = doc.internal.pages.length - 1;
          doc.setFontSize(7);
          doc.setTextColor(130, 130, 130);
          doc.text(
            `Page ${data.pageNumber}`,
            pageWidth / 2,
            pageHeight - 8,
            { align: 'center' }
          );
          doc.text('Confidential', pageWidth - 14, pageHeight - 8, { align: 'right' });
          // Re-draw header band on subsequent pages
          if (data.pageNumber > 1) {
            doc.setFillColor(30, 58, 95);
            doc.rect(0, 0, pageWidth, 12, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Registrations Export (cont.)', 14, 8);
          }
          // Reset for table rendering
          doc.setTextColor(0, 0, 0);
        },
      };

      const autoTable = (await import('jspdf-autotable')).default;
      if (typeof autoTable === 'function') {
        autoTable(doc, tableOptions);
      } else {
        (doc as any).autoTable(tableOptions);
      }

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

      // Reserve top rows for a live summary panel that uses SUBTOTAL so values
      // automatically recompute as the user applies AutoFilter dropdowns.
      const SUMMARY_ROWS = 4; // rows 1-4 reserved
      const HEADER_ROW = SUMMARY_ROWS + 1; // row 5 = column headers
      const DATA_START_ROW = HEADER_ROW + 1; // row 6 = first data row
      const DATA_END_ROW = DATA_START_ROW + Math.max(rows.length, 1) - 1;
      const lastCol = XLSX.utils.encode_col(headers.length - 1);
      const dataRange = `A${DATA_START_ROW}:${lastCol}${DATA_END_ROW}`;

      // Locate columns by label so summary formulas reference the right ones.
      const colLetter = (label: string) => {
        const idx = headers.indexOf(label);
        return idx >= 0 ? XLSX.utils.encode_col(idx) : null;
      };
      const feeCol = colLetter('Registration Fee');
      const statusCol = colLetter('Registration Status');
      const paymentCol = colLetter('Payment Status');
      const appIdCol = colLetter('Application ID') ?? 'A';

      // Build summary rows. SUBTOTAL ignores rows hidden by AutoFilter:
      // 103 = COUNTA, 109 = SUM. COUNTIFS gives unconditional category counts.
      const summary: (string | number)[][] = [
        [
          'Visible Records:',
          `=SUBTOTAL(103,${appIdCol}${DATA_START_ROW}:${appIdCol}${DATA_END_ROW})`,
          '', 'Total Records:', rows.length,
        ],
        feeCol
          ? ['Visible Fee Total:', `=SUBTOTAL(109,${feeCol}${DATA_START_ROW}:${feeCol}${DATA_END_ROW})`, '', '', '']
          : ['', '', '', '', ''],
        statusCol && paymentCol
          ? [
              'Approved (all):',
              `=COUNTIF(${statusCol}${DATA_START_ROW}:${statusCol}${DATA_END_ROW},"approved")`,
              '',
              'Paid (all):',
              `=COUNTIF(${paymentCol}${DATA_START_ROW}:${paymentCol}${DATA_END_ROW},"paid")`,
            ]
          : ['', '', '', '', ''],
        [],
      ];

      const padded = summary.map(r => {
        const out = [...r];
        while (out.length < headers.length) out.push('');
        return out;
      });

      const wsData = [...padded, headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Convert strings beginning with "=" into actual formula cells so the
      // spreadsheet evaluates them instead of displaying literal text.
      Object.keys(ws).forEach(addr => {
        if (addr.startsWith('!')) return;
        const cell = ws[addr];
        if (cell && typeof cell.v === 'string' && cell.v.startsWith('=')) {
          cell.f = cell.v.slice(1);
          delete cell.v;
          cell.t = 'n';
        }
      });

      ws['!cols'] = headers.map((h, i) => ({
        wch: Math.max(h.length, ...rows.map(r => (r[i] || '').length).slice(0, 100)) + 2,
      }));

      // AutoFilter dropdowns on the header row let users filter natively.
      ws['!autofilter'] = { ref: `A${HEADER_ROW}:${lastCol}${DATA_END_ROW}` };

      // Freeze summary + header rows so they stay pinned while scrolling.
      ws['!freeze'] = {
        xSplit: 0,
        ySplit: HEADER_ROW,
        topLeftCell: `A${DATA_START_ROW}`,
        activePane: 'bottomLeft',
      };

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Registrations');

      // Companion sheet with copy-paste filter formulas users can reuse.
      const helpRows: (string | number)[][] = [
        ['Filter & Formula Guide'],
        [],
        [`Filter dropdowns are enabled on row ${HEADER_ROW} of the Registrations sheet.`],
        ['Click any column header arrow to filter. The summary cells above update automatically via SUBTOTAL.'],
        [],
        ['Purpose', 'Formula (paste into any empty cell)'],
        ['Count visible rows', `=SUBTOTAL(103,${appIdCol}${DATA_START_ROW}:${appIdCol}${DATA_END_ROW})`],
        ...(feeCol ? [['Sum visible fees', `=SUBTOTAL(109,${feeCol}${DATA_START_ROW}:${feeCol}${DATA_END_ROW})`]] : []),
        ...(feeCol ? [['Average visible fee', `=SUBTOTAL(101,${feeCol}${DATA_START_ROW}:${feeCol}${DATA_END_ROW})`]] : []),
        ...(statusCol ? [['Count approved', `=COUNTIF(${statusCol}${DATA_START_ROW}:${statusCol}${DATA_END_ROW},"approved")`]] : []),
        ...(statusCol ? [['Count pending', `=COUNTIF(${statusCol}${DATA_START_ROW}:${statusCol}${DATA_END_ROW},"pending")`]] : []),
        ...(paymentCol ? [['Count paid', `=COUNTIF(${paymentCol}${DATA_START_ROW}:${paymentCol}${DATA_END_ROW},"paid")`]] : []),
        ...(paymentCol ? [['Count unpaid', `=COUNTIF(${paymentCol}${DATA_START_ROW}:${paymentCol}${DATA_END_ROW},"unpaid")`]] : []),
        [],
        ['SUBTOTAL codes 101-111 ignore rows hidden by AutoFilter.'],
        [`Excel 365 / Google Sheets: use =FILTER(${dataRange}, <condition>) for dynamic results.`],
      ];
      const helpWs = XLSX.utils.aoa_to_sheet(helpRows);
      Object.keys(helpWs).forEach(addr => {
        if (addr.startsWith('!')) return;
        const cell = helpWs[addr];
        if (cell && typeof cell.v === 'string' && cell.v.startsWith('=')) {
          // Keep these as visible text so users can read & copy them.
          cell.t = 's';
        }
      });
      helpWs['!cols'] = [{ wch: 30 }, { wch: 80 }];
      XLSX.utils.book_append_sheet(wb, helpWs, 'Filter Guide');

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
