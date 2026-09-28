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
  FileDown
} from 'lucide-react';
import type { Customer, UploadBatch, CustomerMatchReport } from '@/types';
import { parseMargExcel, type ParsedMargBatch } from '@/lib/marg-parser';
import { matchAndMergeCustomers } from '@/lib/customer-matcher';
import { audioAlerts } from '@/lib/audio-alerts';
import { PinVerifyModal } from '@/components/lock/PinVerifyModal';
import { MonthlyAuditDrawer } from './MonthlyAuditDrawer';

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
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<UploadBatch | null>(null);
  const [previewData, setPreviewData] = useState<{
    parsed: ParsedMargBatch;
    matchReport: CustomerMatchReport;
    mergedCustomers: Customer[];
    matchedCount: number;
    newCount: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setParsing(true);
    setPreviewData(null);

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseMargExcel(buffer, file.name, defaultRefillCycleDays, alertDaysBefore);

      // Perform matching against existing customers
      const matchResult = matchAndMergeCustomers(
        existingCustomers,
        parsed.customers,
        defaultRefillCycleDays,
        alertDaysBefore
      );

      setPreviewData({
        parsed,
        matchReport: matchResult.report,
        mergedCustomers: matchResult.updatedMasterCustomers,
        matchedCount: matchResult.matchedMonthlyCount,
        newCount: matchResult.newCustomersCount,
      });
    } catch (err) {
      console.error('Error processing Excel file:', err);
      alert('Failed to parse file. Please verify it is a valid Marg ERP Excel or CSV file.');
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const downloadNewCustomersFile = (batch: UploadBatch, format: 'csv' | 'json' = 'csv') => {
    let newCusts = batch.newCustomers;
    if (!newCusts || newCusts.length === 0) {
      const batchCustIds = new Set(batch.customerIds || []);
      newCusts = existingCustomers.filter(c => batchCustIds.has(c.id));
    }

    const cleanBaseName = batch.fileName.replace(/\.[^/.]+$/, '');

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

    // Accurately capture all master customer IDs included in this upload batch
    const masterIds = [
      ...previewData.matchReport.matchedMonthlyCustomers.map(m => m.existing.id),
      ...previewData.matchReport.newCustomers.map(n => n.id)
    ];

    const newBatch: UploadBatch = {
      id: 'batch_' + Date.now(),
      fileName: previewData.parsed.fileName,
      originalFileName: previewData.parsed.originalFileName,
      monthName: previewData.parsed.monthName,
      monthKey: previewData.parsed.monthKey,
      fileSize: previewData.parsed.fileSize,
      uploadDate: new Date().toISOString(),
      periodStart: previewData.parsed.periodStart,
      periodEnd: previewData.parsed.periodEnd,
      formatType: previewData.parsed.formatType,
      totalRows: previewData.parsed.totalRowsProcessed,
      totalCustomers: previewData.parsed.customers.length,
      newCustomersCount: previewData.newCount,
      repeatCustomersCount: previewData.matchedCount,
      status: 'committed',
      customerIds: masterIds.length > 0 ? masterIds : previewData.parsed.customers.map((c) => c.id),
      newCustomers: previewData.matchReport.newCustomers,
    };

    audioAlerts.playSuccessChime();
    onCommitBatch(previewData.mergedCustomers, newBatch);
    setPreviewData(null);
  };

  return (
    <div className="space-y-6">
      {/* Upload Drop Zone Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-teal-600" />
              <span>Upload Marg ERP Sales Files (.XLS / .XLSX / .CSV)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All incoming customers are extracted into 'All Customers' master directory. Month is automatically tagged for accurate cross-referencing.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAuditDrawerOpen(true)}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-2xs flex items-center gap-2 transition-all self-start sm:self-auto shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Monthly Audit & Missing Patients Drawer</span>
          </button>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-teal-500 bg-teal-50/60'
              : 'border-slate-200 hover:border-teal-400 bg-slate-50/60 hover:bg-slate-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xls,.xlsx,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <p className="text-xs font-bold text-slate-800">
            {parsing ? 'Parsing Excel File...' : 'Click to select or drag & drop Marg ERP Excel File'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Supports both Marg Grouped Summary Reports (e.g. jully26.XLS, aug26.XLS) and Tabular Sales Registers
          </p>
        </div>
      </div>

      {/* Preview & Customer Matching Card */}
      {previewData && (
        <div className="bg-white border border-teal-200 rounded-2xl p-6 shadow-sm animate-fadeIn space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 uppercase tracking-wide">
                  {previewData.parsed.formatType === 'MARG_GROUPED_SUMMARY'
                    ? 'Marg Grouped Patient Summary'
                    : 'Tabular Sales Register'}
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {previewData.parsed.fileName}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Sales Period: <span className="font-mono font-medium text-slate-700">{previewData.parsed.periodStart}</span> to <span className="font-mono font-medium text-slate-700">{previewData.parsed.periodEnd}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewData(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-medium"
              >
                Discard
              </button>
              <button
                onClick={handleCommit}
                className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Commit & Add to Database</span>
              </button>
            </div>
          </div>

          {/* Analysis Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[11px] font-medium">Total In File</span>
              <p className="text-lg font-bold text-slate-900 mt-0.5">
                {previewData.parsed.customers.length} Patients
              </p>
              <p className="text-[10px] text-slate-500">{previewData.parsed.totalMedicinesCount} items parsed</p>
            </div>

            <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200">
              <span className="text-teal-800 text-[11px] font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-teal-600" />
                <span>Repeat Customers Matched</span>
              </span>
              <p className="text-lg font-bold text-teal-900 mt-0.5">
                {previewData.matchedCount} Customers
              </p>
              <p className="text-[10px] text-teal-700 font-medium">Stored in All Customers (Manual Selection)</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[11px] font-medium">New Customers</span>
              <p className="text-lg font-bold text-slate-900 mt-0.5">
                {previewData.newCount} Patients
              </p>
              <p className="text-[10px] text-slate-500">Stored in All Customers Tab</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[11px] font-medium">Post-Merge Master</span>
              <p className="text-lg font-bold text-slate-900 mt-0.5">
                {previewData.mergedCustomers.length} Total Patients
              </p>
              <p className="text-[10px] text-slate-500">Zero duplicates created</p>
            </div>
          </div>

          {/* Sample of matched repeat customers */}
          {previewData.matchReport.matchedMonthlyCustomers.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-2">
                Sample Repeat Monthly Customers Detected ({previewData.matchReport.matchedMonthlyCustomers.length}):
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {previewData.matchReport.matchedMonthlyCustomers.slice(0, 10).map((m, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">{m.existing.name}</span>
                      <span className="text-slate-500 ml-2 font-mono text-[11px]">
                        {m.existing.phone || m.existing.code || 'Matched by ' + m.matchType}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-100 text-teal-800">
                      Matched via {m.matchType.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
              Audit history of uploaded files. Each upload maintains a separate file of only newly added customers.
            </p>
          </div>
        </div>

        {batches.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No files have been uploaded yet. Upload a Marg file above to start.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-5">File Name</th>
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
                            <FileSpreadsheet className="w-4 h-4 text-teal-600 shrink-0" />
                            <div>
                              <span className="block text-slate-900 font-bold">{b.fileName}</span>
                              {b.monthName && (
                                <span className="text-[10px] text-teal-800 font-semibold bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200 inline-block mt-0.5">
                                  {b.monthName}
                                </span>
                              )}
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
                                className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-semibold inline-flex items-center gap-1 transition-colors"
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
                          <button
                            type="button"
                            onClick={() => setIsAuditDrawerOpen(true)}
                            title="Open monthly comparison drawer to cross-reference this sheet"
                            className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-semibold border border-teal-200 transition-colors inline-flex items-center gap-1"
                          >
                            <FileSpreadsheet className="w-3 h-3 text-teal-600" />
                            <span>Audit Drawer</span>
                          </button>
                          {b.status === 'committed' && (
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to rollback batch "${b.fileName}"?`)) {
                                  onRollbackBatch(b.id);
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium border border-slate-200 transition-colors inline-flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Rollback</span>
                            </button>
                          )}
                          <button
                            onClick={() => setBatchToDelete(b)}
                            title="Delete this uploaded bill permanently"
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-colors inline-flex items-center gap-1"
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
                          <FileSpreadsheet className="w-4 h-4 text-teal-600 shrink-0" />
                          <span>{b.fileName}</span>
                        </div>
                        {b.monthName && (
                          <span className="text-[10px] text-teal-800 font-semibold bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200 inline-block mt-0.5">
                            {b.monthName}
                          </span>
                        )}
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
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>New Customers (.csv)</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No new customers</span>
                      )}

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setIsAuditDrawerOpen(true)}
                          title="Open Monthly Audit Drawer"
                          className="px-2 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-medium border border-teal-200 transition-colors inline-flex items-center gap-1"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Audit</span>
                        </button>
                        {b.status === 'committed' && (
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to rollback batch "${b.fileName}"?`)) {
                                onRollbackBatch(b.id);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium border border-slate-200 transition-colors inline-flex items-center"
                            title="Rollback"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setBatchToDelete(b)}
                          title="Delete this uploaded bill permanently"
                          className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-colors inline-flex items-center gap-1"
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

      {/* PIN-Only Verification Modal for Deleting Bill (Sure text step removed) */}
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

      {/* Monthly Sheet Cross-Reference & Missing Patients Audit Drawer */}
      <MonthlyAuditDrawer
        isOpen={isAuditDrawerOpen}
        onClose={() => setIsAuditDrawerOpen(false)}
        batches={batches}
        allCustomers={existingCustomers}
        onToggleMonthly={onToggleMonthly || (() => {})}
        onSelectCustomer={onSelectCustomer}
      />
    </div>
  );
};
