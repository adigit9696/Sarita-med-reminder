'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2, Pill, Save, Check, Search } from 'lucide-react';
import type { Customer, CustomerMedicine } from '@/types';
import { searchMedicines, type MedicineSuggestion } from '@/lib/medicine-search';

interface EditCustomerModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (customerId: string, updates: Partial<Customer>) => void;
}

export const EditCustomerModal: React.FC<EditCustomerModalProps> = ({
  customer,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen || !customer) return null;

  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone || '');
  const [code, setCode] = useState(customer.code || '');
  const [address, setAddress] = useState(customer.address || '');
  const [notes, setNotes] = useState(customer.notes || '');
  const [medicines, setMedicines] = useState<CustomerMedicine[]>([...customer.medicines]);

  // New medicine row form
  const [newMedName, setNewMedName] = useState('');
  const [newMedPack, setNewMedPack] = useState('');
  const [newMedQty, setNewMedQty] = useState('1');
  const [newMedAmount, setNewMedAmount] = useState('');
  const [newMedCycle, setNewMedCycle] = useState('30');
  const [showAddMed, setShowAddMed] = useState(false);
  const [suggestions, setSuggestions] = useState<MedicineSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleMedNameChange = (val: string) => {
    setNewMedName(val);
    if (val.trim().length >= 2) {
      const matches = searchMedicines(val, 15);
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (s: MedicineSuggestion) => {
    setNewMedName(s.name);
    if (s.packaging) {
      setNewMedPack(s.packaging);
    }
    setShowSuggestions(false);
  };

  const handleAddMedicine = () => {
    if (!newMedName.trim()) {
      alert('Please enter medicine name');
      return;
    }

    const newMed: CustomerMedicine = {
      id: 'med_' + Date.now(),
      name: newMedName.trim(),
      nameNorm: newMedName.toLowerCase().trim(),
      packaging: newMedPack.trim() || undefined,
      qty: parseFloat(newMedQty) || 1,
      unit: newMedPack.trim() || 'Unit',
      amount: parseFloat(newMedAmount) || 0,
      refillCycleDays: parseInt(newMedCycle) || 30,
      lastPurchaseDate: customer.lastPurchaseDate,
      nextDueDate: customer.nextDueDate,
      status: 'new',
    };

    setMedicines([...medicines, newMed]);
    setNewMedName('');
    setNewMedPack('');
    setNewMedQty('1');
    setNewMedAmount('');
    setNewMedCycle('30');
    setShowAddMed(false);
  };

  const handleRemoveMedicine = (index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const handleUpdateMedicine = (index: number, field: keyof CustomerMedicine, val: unknown) => {
    const updated = [...medicines];
    updated[index] = { ...updated[index], [field]: val };
    setMedicines(updated);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Patient name is required');
      return;
    }

    onSave(customer.id, {
      name: name.trim(),
      phone: phone.trim() || undefined,
      code: code.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      medicines,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900">
              Edit Patient & Prescription Information
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Update contact number or add/remove prescribed chronic medications
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Patient Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-900 focus:bg-white focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">10-Digit Mobile Number</label>
              <input
                type="tel"
                maxLength={10}
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-900 font-mono focus:bg-white focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Marg ERP Patient Code</label>
              <input
                type="text"
                placeholder="0006"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-900 font-mono focus:bg-white focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Home Delivery Address</label>
              <input
                type="text"
                placeholder="House / Street / Area"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-900 focus:bg-white focus:border-teal-500"
              />
            </div>
          </div>

          {/* Medicines Section */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Pill className="w-3.5 h-3.5 text-teal-600" />
                <span>Prescription Medicines ({medicines.length})</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowAddMed(!showAddMed)}
                className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 text-xs font-semibold hover:bg-teal-100 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Medicine</span>
              </button>
            </div>

            {/* Add Medicine Mini-Form */}
            {showAddMed && (
              <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 mb-3 space-y-3 text-xs animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <label className="block font-medium text-slate-700 mb-1">
                      Medicine Name * <span className="text-[10px] text-teal-600 font-normal">(9,500+ database suggestions)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Type medicine name (e.g. DOLO, CYBLEX...)"
                        value={newMedName}
                        onChange={(e) => handleMedNameChange(e.target.value)}
                        onFocus={() => {
                          if (newMedName.trim().length >= 2) {
                            const matches = searchMedicines(newMedName, 15);
                            setSuggestions(matches);
                            setShowSuggestions(matches.length > 0);
                          }
                        }}
                        className="w-full bg-white border border-teal-300 p-1.5 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                      {newMedName && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewMedName('');
                            setSuggestions([]);
                            setShowSuggestions(false);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Suggestions Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-teal-200 z-30 max-h-56 overflow-y-auto divide-y divide-slate-100 animate-fadeIn">
                        <div className="px-2.5 py-1.5 bg-teal-50/80 text-[10px] font-bold text-teal-800 uppercase tracking-wider flex items-center justify-between sticky top-0">
                          <span>Suggested Medicines ({suggestions.length})</span>
                          <span className="text-teal-600 font-normal">Click to auto-fill</span>
                        </div>
                        {suggestions.map((s, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectSuggestion(s);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-teal-50/70 transition-colors flex items-center justify-between text-xs group"
                          >
                            <span className="font-semibold text-slate-800 group-hover:text-teal-900">
                              {s.name}
                            </span>
                            {s.packaging && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-600 group-hover:bg-teal-100 group-hover:text-teal-800 shrink-0 ml-2">
                                {s.packaging}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Packaging</label>
                    <input
                      type="text"
                      placeholder="e.g. 1*15TAB"
                      value={newMedPack}
                      onChange={(e) => setNewMedPack(e.target.value)}
                      className="w-full bg-white border border-teal-300 p-1.5 rounded-lg text-slate-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={newMedAmount}
                      onChange={(e) => setNewMedAmount(e.target.value)}
                      className="w-full bg-white border border-teal-300 p-1.5 rounded-lg text-slate-900 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Refill Cycle (Days)</label>
                    <input
                      type="number"
                      placeholder="30"
                      value={newMedCycle}
                      onChange={(e) => setNewMedCycle(e.target.value)}
                      className="w-full bg-white border border-teal-300 p-1.5 rounded-lg text-slate-900 text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddMed(false)}
                    className="px-3 py-1 rounded-lg border border-slate-200 text-slate-600 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddMedicine}
                    className="px-3 py-1 rounded-lg bg-teal-600 text-white font-semibold text-xs shadow-2xs hover:bg-teal-700"
                  >
                    Add to Prescription
                  </button>
                </div>
              </div>
            )}

            {/* Medicines List */}
            {medicines.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-400">
                No medicines listed. Click "Add Medicine" above to attach prescriptions.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {medicines.map((m, idx) => (
                  <div
                    key={m.id || idx}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">{m.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {m.packaging || m.unit} · Cycle: {m.refillCycleDays} Days · ₹{m.amount.toFixed(2)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMedicine(idx)}
                      title="Remove Medicine"
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Save Button */}
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
