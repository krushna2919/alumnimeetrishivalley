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

/** Available Excel formulas the user can choose to embed at the top of the sheet. */
type FormulaKey =
  | 'countVisible'
  | 'sumFeeVisible'
  | 'avgFeeVisible'
  | 'countApproved'
  | 'countPending'
  | 'countRejected'
  | 'countPaid'
  | 'countUnpaid'
  | 'sumApprovedFee'
  | 'sumPaidFee';

const FORMULA_OPTIONS: { key: FormulaKey; label: string; needs: ('fee' | 'status' | 'payment')[] }[] = [
  { key: 'countVisible',    label: 'Count of visible (filtered) rows',           needs: [] },
  { key: 'sumFeeVisible',   label: 'Sum of Registration Fee (visible rows)',     needs: ['fee'] },
  { key: 'avgFeeVisible',   label: 'Average Registration Fee (visible rows)',    needs: ['fee'] },
  { key: 'countApproved',   label: 'Count where Registration Status = approved', needs: ['status'] },
  { key: 'countPending',    label: 'Count where Registration Status = pending',  needs: ['status'] },
  { key: 'countRejected',   label: 'Count where Registration Status = rejected', needs: ['status'] },
  { key: 'countPaid',       label: 'Count where Payment Status = paid',          needs: ['payment'] },
  { key: 'countUnpaid',     label: 'Count where Payment Status = unpaid',        needs: ['payment'] },
  { key: 'sumApprovedFee',  label: 'Sum of Fee for Approved rows',               needs: ['fee', 'status'] },
  { key: 'sumPaidFee',      label: 'Sum of Fee for Paid rows',                   needs: ['fee', 'payment'] },
];

const DEFAULT_FORMULAS: FormulaKey[] = ['countVisible', 'sumFeeVisible', 'countApproved', 'countPaid'];

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
  const [selectedFormulas, setSelectedFormulas] = useState<Set<FormulaKey>>(new Set(DEFAULT_FORMULAS));

  const toggleFormula = (key: FormulaKey) => {
    setSelectedFormulas(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

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
    const rows = effectiveRows.map(reg =>
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

      // Locate columns by label so formulas reference the right ones.
      const colLetter = (label: string) => {
        const idx = headers.indexOf(label);
        return idx >= 0 ? XLSX.utils.encode_col(idx) : null;
      };
      const feeCol = colLetter('Registration Fee');
      const statusCol = colLetter('Registration Status');
      const paymentCol = colLetter('Payment Status');
      const appIdCol = colLetter('Application ID') ?? 'A';

      // Filter formulas down to ones whose required columns are present.
      const haveCols = {
        fee: !!feeCol, status: !!statusCol, payment: !!paymentCol,
      };
      const activeFormulas = FORMULA_OPTIONS.filter(
        f => selectedFormulas.has(f.key) && f.needs.every(n => haveCols[n])
      );

      const filterLines = matchPageFilters && activeFilters.length > 0 ? activeFilters : [];
      // Layout:
      //   row 1: title
      //   row 2: meta (generated / record count)
      //   row 3..3+N-1: one formula per row (label | formula)
      //   blank row
      //   optional active-filter lines
      //   blank row
      //   header row, then data
      const titleRows = 2;
      const formulaRows = activeFormulas.length;
      const filterBlock = filterLines.length > 0 ? filterLines.length + 1 : 0;
      const blanksAfterFormulas = formulaRows > 0 ? 1 : 0;
      const blanksAfterFilters = filterBlock > 0 ? 1 : 0;
      const HEADER_ROW = titleRows + formulaRows + blanksAfterFormulas + filterBlock + blanksAfterFilters + 1;
      const DATA_START_ROW = HEADER_ROW + 1;
      const DATA_END_ROW = DATA_START_ROW + Math.max(rows.length, 1) - 1;
      const lastCol = XLSX.utils.encode_col(Math.max(headers.length - 1, 1));

      // Build the formula expression for a given key (without leading '=').
      const buildFormula = (key: FormulaKey): string => {
        const r1 = DATA_START_ROW, r2 = DATA_END_ROW;
        switch (key) {
          case 'countVisible':   return `SUBTOTAL(103,${appIdCol}${r1}:${appIdCol}${r2})`;
          case 'sumFeeVisible':  return `SUBTOTAL(109,${feeCol}${r1}:${feeCol}${r2})`;
          case 'avgFeeVisible':  return `SUBTOTAL(101,${feeCol}${r1}:${feeCol}${r2})`;
          case 'countApproved':  return `COUNTIF(${statusCol}${r1}:${statusCol}${r2},"approved")`;
          case 'countPending':   return `COUNTIF(${statusCol}${r1}:${statusCol}${r2},"pending")`;
          case 'countRejected':  return `COUNTIF(${statusCol}${r1}:${statusCol}${r2},"rejected")`;
          case 'countPaid':      return `COUNTIF(${paymentCol}${r1}:${paymentCol}${r2},"paid")`;
          case 'countUnpaid':    return `COUNTIF(${paymentCol}${r1}:${paymentCol}${r2},"unpaid")`;
          case 'sumApprovedFee': return `SUMIF(${statusCol}${r1}:${statusCol}${r2},"approved",${feeCol}${r1}:${feeCol}${r2})`;
          case 'sumPaidFee':     return `SUMIF(${paymentCol}${r1}:${paymentCol}${r2},"paid",${feeCol}${r1}:${feeCol}${r2})`;
        }
      };

      // Build the worksheet starting from values (data block) then patch in
      // title/meta/formula cells using cell objects so formulas are written
      // properly (cell.f), not as literal strings.
      const wsData: (string | number)[][] = [];
      // Pre-fill placeholder rows so the header/data start at the right offset.
      for (let i = 0; i < HEADER_ROW - 1; i++) wsData.push([]);
      wsData.push(headers);
      rows.forEach(r => wsData.push(r));
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Helper to write a cell at an address with proper type/formula.
      const setCell = (addr: string, opts: { v?: string | number; f?: string; bold?: boolean }) => {
        const cell: Record<string, unknown> = {};
        if (opts.f) {
          cell.t = 'n';
          cell.f = opts.f;
          // Excel will compute on open; provide 0 so the cell isn't blank in
          // viewers that don't evaluate formulas.
          cell.v = 0;
        } else if (typeof opts.v === 'number') {
          cell.t = 'n';
          cell.v = opts.v;
        } else {
          cell.t = 's';
          cell.v = opts.v ?? '';
        }
        ws[addr] = cell;
      };

      // Title + meta
      setCell('A1', { v: 'Registrations Export' });
      setCell('A2', {
        v: `Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}  |  Records: ${rows.length}  |  Fields: ${headers.length}${matchPageFilters && hasActiveFilters ? '  |  Filtered view' : ''}`,
      });

      // Formula rows: label in col A, computed value in col B
      activeFormulas.forEach((f, i) => {
        const r = titleRows + 1 + i;
        setCell(`A${r}`, { v: f.label });
        setCell(`B${r}`, { f: buildFormula(f.key) });
      });

      // Active filter listing
      if (filterBlock > 0) {
        const start = titleRows + formulaRows + blanksAfterFormulas + 1;
        setCell(`A${start}`, { v: 'Active page filters applied to this export:' });
        filterLines.forEach((line, i) => setCell(`A${start + 1 + i}`, { v: `  • ${line}` }));
      }

      // Update the worksheet range so the new cells in unfilled rows are picked
      // up when the file is written.
      ws['!ref'] = `A1:${lastCol}${DATA_END_ROW}`;

      // Column widths sized to header + sample data.
      ws['!cols'] = headers.map((h, i) => ({
        wch: Math.max(h.length, ...rows.map(r => (r[i] || '').length).slice(0, 100)) + 2,
      }));

      // AutoFilter dropdowns on the header row.
      ws['!autofilter'] = { ref: `A${HEADER_ROW}:${lastCol}${DATA_END_ROW}` };

      // Freeze panes through the header row.
      ws['!freeze'] = {
        xSplit: 0,
        ySplit: HEADER_ROW,
        topLeftCell: `A${DATA_START_ROW}`,
        activePane: 'bottomLeft',
      };

      const wb = XLSX.utils.book_new();
      // cellFormula must be true so formulas survive the write.
      (wb as { Workbook?: Record<string, unknown> }).Workbook = { CalcPr: { fullCalcOnLoad: true } };
      XLSX.utils.book_append_sheet(wb, ws, 'Registrations');

      XLSX.writeFile(wb, `registrations-export-${format(new Date(), 'yyyy-MM-dd')}.xlsx`, { cellFormula: true });
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
            Select fields to include and choose export format. Exporting {effectiveRows.length} record(s)
            {matchPageFilters && hasActiveFilters ? ' (filtered)' : ''}.
          </DialogDescription>
        </DialogHeader>

        {hasActiveFilters && (
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={matchPageFilters}
                onCheckedChange={(v) => setMatchPageFilters(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Match current page filters</span>
                <span className="block text-xs text-muted-foreground">
                  {matchPageFilters
                    ? `Exporting ${registrations.length} filtered of ${fullSet.length} total.`
                    : `Exporting all ${fullSet.length} records (ignoring page filters).`}
                </span>
              </span>
            </label>
            {matchPageFilters && activeFilters.length > 0 && (
              <ul className="text-xs text-muted-foreground list-disc pl-6 space-y-0.5">
                {activeFilters.map((f) => <li key={f}>{f}</li>)}
              </ul>
            )}
          </div>
        )}

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
