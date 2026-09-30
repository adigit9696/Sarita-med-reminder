'use client';

import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  FileText, 
  Clock, 
  Users, 
  Pill, 
  Trash2, 
  Sparkles, 
  Download, 
  Folder, 
  FolderUp, 
  Calendar, 
  Layers,
  ArrowRight
} from 'lucide-react';
import type { Customer, UploadBatch } from '@/types';
import { parseMargExcel, type ParsedMargBatch } from '@/lib/marg-parser';
import { 
  matchAndMergeChronologicalBatches, 
  type ChronologicalBatchMergeResult 
} from '@/lib/customer-matcher';
import { scanFilesFromDropEvent, scanFilesFromInputEvent } from '@/lib/folder-scanner';
import { audioAlerts } from '@/lib/audio-alerts';
import { PinVerifyModal } from '@/components/lock/PinVerifyModal';

interface BillsAndUploadsViewProps {
  existingCustomers: Customer[];
  batches: UploadBatch[];
  onCommitBatch: (updatedCustomers: Customer[], batch: UploadBatch) => void;
  onRollbackBatch: (batchId: string) => void;
  onDeleteBatch: (batchId: string) => void;
  staffPin: string;
  defaultRefillCycleDays: number;
  alertDaysBefore: number;
  onToggleMonthly?: (customerId: string, isMonthly: boolean) => void;
  onSelectCustomer?: (customer: Customer) => void;
}

export const BillsAndUploadsView: React.FC<BillsAndUploadsViewProps> = ({
  existingCustomers,
  batches,
  onCommitBatch,
  onRollbackBatch,
  onDeleteBatch,
  staffPin,
  defaultRefillCycleDays,
  alertDaysBefore,
  onToggleMonthly,
  onSelectCustomer,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsingProgress, setParsingProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<UploadBatch | null>(null);
  const [previewData, setPreviewData] = useState<ChronologicalBatchMergeResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: File[], folderName?: string) => {
    if (!files || files.length === 0) return;
    setParsing(true);
    setPreviewData(null);
    setParsingProgress({ current: 0, total: files.length, fileName: files[0].name });

    try {
      const parsedBatches: ParsedMargBatch[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setParsingProgress({ current: i + 1, total: files.length, fileName: file.name });
        try {
          const buffer = await file.arrayBuffer();
          const parsed = parseMargExcel(buffer, file.name, defaultRefillCycleDays, alertDaysBefore);
          if (parsed && parsed.customers && parsed.customers.length > 0) {
            parsedBatches.push(parsed);
          }
        } catch (fileErr) {
          console.warn(`[BillsAndUploads] Skipping invalid or corrupt file ${file.name}:`, fileErr);
        }
      }

      if (parsedBatches.length === 0) {
        alert('No valid Marg customer sales records found in the selected file(s). Please verify they are valid Marg ERP exports.');
        return;
      }

      // Merge sequentially in chronological order
      const mergeResult = matchAndMergeChronologicalBatches(
        existingCustomers,
        parsedBatches,
        defaultRefillCycleDays,
        alertDaysBefore,
        folderName
      );

      setPreviewData(mergeResult);
    } catch (err) {
      console.error('Error processing Excel files:', err);
      alert('Failed to process spreadsheet files. Please verify they are valid Marg ERP Excel or CSV files.');
    } finally {
      setParsing(false);
      setParsingProgress(null);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    try {
      const scanned = await scanFilesFromDropEvent(e);
      if (scanned.files && scanned.files.length > 0) {
        processFiles(scanned.files, scanned.folderName);
      }
    } catch (err) {
      console.error('Error scanning dropped files/folder:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const scanned = scanFilesFromInputEvent(e);
      if (scanned.files && scanned.files.length > 0) {
        processFiles(scanned.files, scanned.folderName);
      }
    } catch (err) {
      console.error('Error selecting files:', err);
    }
    e.target.value = '';
  };

  const downloadNewCustomersFile = (batch: UploadBatch, format: 'csv' | 'json' = 'csv') => {
    let newCusts = batch.newCustomers;
    if (!newCusts || newCusts.length === 0) {
      const batchCustIds = new Set(batch.customerIds || []);
      newCusts = existingCustomers.filter(c => batchCustIds.has(c.id));
    }

    const cleanBaseName = batch.fileName.replace(/\.[^/.]+$/, '').replace(/[\s\(\)]+/g, '_');

    if (format === 'json') {
      const exportData = {
        batchId: batch.id,
        fileName: batch.fileName,
        salesPeriod: `${batch.periodStart} to ${batch.periodEnd}`,
        uploadDate: batch.uploadDate,
        totalNewCustomers: newCusts.length,
        newCustomers: newCusts,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `new_customers_${cleanBaseName}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['Patient Name', 'Contact Phone', 'Marg Party Code', 'Total Spend (Rs)', 'Medicines Count', 'Purchase Date'];
      const rows = newCusts.map(c => [
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${c.phone || ''}"`,
        `"${c.code || ''}"`,
        (c.totalSpend || 0).toFixed(2),
        c.medicines.length,
        c.lastPurchaseDate || '',
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `new_customers_${cleanBaseName}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleCommit = () => {
    if (!previewData) return;
    audioAlerts.playSuccessChime();
    onCommitBatch(previewData.updatedMasterCustomers, previewData.consolidatedBatch);
    setPreviewData(null);
  };

  const isMultiFileBatch = Boolean(previewData && previewData.batchesProcessedCount > 1);

  return (
    <div className="space-y-6">
      {/* Hidden File and Folder inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".xls,.xlsx,.csv"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-expect-error webkitdirectory is standard for folder picker in chromium/firefox/safari
        webkitdirectory=""
        directory=""
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Upload Drop Zone Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-teal-600" />
            <span>Upload Marg ERP Sales Files or Folder (.XLS / .XLSX / .CSV)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Drop an entire folder of daily Marg sheets (e.g. "September"), or select multiple files. The app sorts them chronologically and sets each customer's actual latest purchase date.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
            isDragging
              ? 'border-teal-500 bg-teal-50/60'
              : 'border-slate-200 hover:border-teal-400 bg-slate-50/60 hover:bg-slate-50'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3">
            <FolderUp className="w-6 h-6" />
          </div>

          {parsing && parsingProgress ? (
            <div className="space-y-2 max-w-sm mx-auto">
              <p className="text-xs font-bold text-teal-900">
                Parsing file {parsingProgress.current} of {parsingProgress.total}...
              </p>
              <p className="text-[11px] text-slate-500 truncate font-mono">
                {parsingProgress.fileName}
              </p>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-teal-600 h-full transition-all duration-150"
                  style={{ width: `${Math.round((parsingProgress.current / parsingProgress.total) * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-bold text-slate-800">
                Drop an entire Folder (e.g. "September") or daily Marg Excel files here
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Supports single monthly summary sheets, multi-file daily sheets, and full monthly folders
              </p>

              <div className="flex items-center justify-center gap-3 mt-4 flex-wrap" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Folder className="w-4 h-4" />
                  <span>Select Folder (Daily Sheets)</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-300 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                  <span>Select Files (Multi-Select)</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Preview & Customer Matching Card */}
      {previewData && (
        <div className="bg-white border border-teal-200 rounded-2xl p-6 shadow-sm animate-fadeIn space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 uppercase tracking-wide flex items-center gap-1">
                  {isMultiFileBatch ? <Folder className="w-3 h-3" /> : <FileSpreadsheet className="w-3 h-3" />}
                  <span>{isMultiFileBatch ? 'Multi-File Folder Batch' : 'Single Sales Summary'}</span>
                </span>
                <span className="text-sm font-bold text-slate-800">
                  {previewData.consolidatedBatch.fileName}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                <span>
                  Date Range: <strong className="font-mono text-slate-700">{previewData.earliestDate}</strong> to <strong className="font-mono text-slate-700">{previewData.latestDate}</strong>
                </span>
                {isMultiFileBatch && (
                  <span className="text-teal-700 font-medium">
                    &bull; Chronologically sorted across {previewData.batchesProcessedCount} files
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewData(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-medium cursor-pointer"
              >
                Discard
              </button>
              <button
                onClick={handleCommit}
                className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Commit & Add to Database</span>
              </button>
            </div>
          </div>

          {/* Analysis Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[11px] font-medium block">
                {isMultiFileBatch ? 'Files Processed' : 'Total Customers in File'}
              </span>
              <p className="text-lg font-bold text-slate-900 mt-0.5">
                {isMultiFileBatch ? `${previewData.batchesProcessedCount} Daily Sheets` : `${previewData.totalUniquePatients} Patients`}
              </p>
              <p className="text-[10px] text-slate-500">
                {isMultiFileBatch ? `${previewData.totalVisitsProcessed} total transactions` : 'Single report'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200">
              <span className="text-teal-800 text-[11px] font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-teal-600" />
                <span>Repeat Patients Matched</span>
              </span>
              <p className="text-lg font-bold text-teal-900 mt-0.5">
                {previewData.matchedMonthlyCount} Customers
              </p>
              <p className="text-[10px] text-teal-700 font-medium">Updated with exact latest bill dates</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[11px] font-medium block">New Patients</span>
              <p className="text-lg font-bold text-emerald-700 mt-0.5">
                +{previewData.newCustomersCount} Patients
              </p>
              <p className="text-[10px] text-slate-500">Stored in All Customers tab</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[11px] font-medium block">Master Directory</span>
              <p className="text-lg font-bold text-slate-900 mt-0.5">
                {previewData.updatedMasterCustomers.length} Total Patients
              </p>
              <p className="text-[10px] text-slate-500">Zero duplicates created</p>
            </div>
          </div>

          {/* Date Timeline Distribution (for multi-file / folder) */}
          {isMultiFileBatch && previewData.allDetectedDates.length > 0 && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                  <span>Daily Date Distribution ({previewData.allDetectedDates.length} distinct dates):</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  Patients categorized by their exact purchase date
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {previewData.allDetectedDates.map((date) => (
                  <span
                    key={date}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-mono shadow-2xs"
                  >
                    <span className="font-semibold text-slate-700">{date}:</span>
                    <span className="text-teal-700 font-bold">{previewData.dateDistribution[date]} visits</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sample of Patients with their Exact Detected Latest Bill Date */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
              <span>Sample Patients & Their Detected Latest Bill Date:</span>
              <span className="text-[11px] font-normal text-slate-500">
                Next refill dates calculated from these exact bill dates
              </span>
            </h4>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {previewData.updatedMasterCustomers.slice(0, 10).map((cust) => {
                const source = previewData.patientLatestBillSource.get(cust.id);
                return (
                  <div
                    key={cust.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{cust.name}</span>
                        {cust.code && (
                          <span className="text-[10px] text-slate-400 font-mono">Code: {cust.code}</span>
                        )}
                        {cust.isMonthlyRegular && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                            Monthly
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {cust.medicines.length} medicine(s) &bull; Spend: ₹{cust.totalSpend.toFixed(2)}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200 font-mono text-[11px]">
                        <span className="text-slate-500">Latest Bill:</span>
                        <strong className="text-teal-800">{cust.lastPurchaseDate || '—'}</strong>
                      </div>
                      {source && (
                        <span className="block text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[200px]">
                          from {source.fileName}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Upload Batch History */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-600" />
              <span>Upload Batch History</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Audit history of uploaded files and daily folders. Each batch maintains an exportable file of only newly added customers.
            </p>
          </div>
        </div>

        {batches.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No files or folders have been uploaded yet. Upload a Marg file or folder above to start.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-5">Batch / Folder Name</th>
                    <th className="py-3 px-4">Sales Period</th>
                    <th className="py-3 px-4">Upload Timestamp</th>
                    <th className="py-3 px-4">Total Patients</th>
                    <th className="py-3 px-4">New Patients (Separate File)</th>
                    <th className="py-3 px-4">Repeat Matched</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batches.map((b) => {
                    const newCount = b.newCustomersCount ?? (b.newCustomers ? b.newCustomers.length : 0);
                    return (
                      <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-5 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            {b.isFolderBatch ? (
                              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                            ) : (
                              <FileSpreadsheet className="w-4 h-4 text-teal-600 shrink-0" />
                            )}
                            <div>
                              <span className="block text-slate-900 font-bold">{b.fileName}</span>
                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                {b.monthName && (
                                  <span className="text-[10px] text-teal-800 font-semibold bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200 inline-block">
                                    {b.monthName}
                                  </span>
                                )}
                                {b.filesCount && b.filesCount > 1 && (
                                  <span className="text-[10px] text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 inline-block">
                                    {b.filesCount} Files
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {b.periodStart} to {b.periodEnd}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {new Date(b.uploadDate).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          {b.totalCustomers} patients
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-700">
                              +{newCount} new
                            </span>
                            {newCount > 0 && (
                              <button
                                type="button"
                                onClick={() => downloadNewCustomersFile(b, 'csv')}
                                title="Download separate CSV containing only new customers from this upload"
                                className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Download className="w-2.5 h-2.5" />
                                <span>CSV</span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-bold text-teal-700">
                          +{b.repeatCustomersCount} regular
                        </td>
                        <td className="py-3 px-4">
                          {b.status === 'committed' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Committed
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                              Rolled Back
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-5 text-right space-x-1.5 whitespace-nowrap">
                          {b.status === 'committed' && (
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to rollback batch "${b.fileName}"?`)) {
                                  onRollbackBatch(b.id);
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium border border-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Rollback</span>
                            </button>
                          )}
                          <button
                            onClick={() => setBatchToDelete(b)}
                            title="Delete this uploaded bill permanently"
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3 text-rose-600" />
                            <span>Delete Bill</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards View */}
            <div className="md:hidden divide-y divide-slate-100">
              {batches.map((b) => {
                const newCount = b.newCustomersCount ?? (b.newCustomers ? b.newCustomers.length : 0);
                return (
                  <div key={b.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                          {b.isFolderBatch ? (
                            <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                          ) : (
                            <FileSpreadsheet className="w-4 h-4 text-teal-600 shrink-0" />
                          )}
                          <span>{b.fileName}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {b.monthName && (
                            <span className="text-[10px] text-teal-800 font-semibold bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200 inline-block">
                              {b.monthName}
                            </span>
                          )}
                          {b.filesCount && b.filesCount > 1 && (
                            <span className="text-[10px] text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 inline-block">
                              {b.filesCount} Files
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {b.periodStart} to {b.periodEnd}
                        </p>
                      </div>
                      {b.status === 'committed' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Committed
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                          Rolled Back
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 text-center">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Total</span>
                        <span className="text-xs font-bold text-slate-800">{b.totalCustomers}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">New</span>
                        <span className="text-xs font-bold text-emerald-600">+{newCount}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Repeat</span>
                        <span className="text-xs font-bold text-teal-600">+{b.repeatCustomersCount}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      {newCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => downloadNewCustomersFile(b, 'csv')}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>New Customers (.csv)</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No new customers</span>
                      )}

                      <div className="flex items-center gap-1.5">
                        {b.status === 'committed' && (
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to rollback batch "${b.fileName}"?`)) {
                                onRollbackBatch(b.id);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium border border-slate-200 transition-colors inline-flex items-center cursor-pointer"
                            title="Rollback"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setBatchToDelete(b)}
                          title="Delete this uploaded bill permanently"
                          className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* PIN Verification Modal for Deleting Bill */}
      <PinVerifyModal
        isOpen={!!batchToDelete}
        title="Delete Uploaded Bill File"
        subtitle={`Permanently remove "${batchToDelete?.fileName}" and its customer sales records`}
        correctPin={staffPin}
        requiresSureText={false}
        onSuccess={() => {
          if (batchToDelete) {
            onDeleteBatch(batchToDelete.id);
            setBatchToDelete(null);
          }
        }}
        onCancel={() => setBatchToDelete(null)}
      />
    </div>
  );
};
