
import React, { useState } from 'react';
import { XIcon, MapPinIcon } from './Icons';
import { US_STATES } from '../services/locationService';

interface LocationModalProps {
    onClose: () => void;
    onSelect: (stateCode: string, county: string) => void;
}

const LocationModal: React.FC<LocationModalProps> = ({ onClose, onSelect }) => {
    const [selectedState, setSelectedState] = useState('');
    const [county, setCounty] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedState && county.trim()) {
            onSelect(selectedState, county.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex justify-center items-center p-4">
            <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 relative border border-slate-700 animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>

                <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border" style={{ backgroundColor: 'color-mix(in oklab, var(--theme-accent-primary) 20%, transparent)', borderColor: 'color-mix(in oklab, var(--theme-accent-primary) 40%, transparent)' }}>
                        <MapPinIcon className="w-8 h-8" style={{ color: 'var(--theme-accent-primary)' }} />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Set Your Location</h2>
                    <p className="text-slate-400 mt-2 text-sm">
                        Community Scout works best when we know your local area. This helps us find relevant codes, costs, and pros.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-300 mb-1">State</label>
                        <select
                            value={selectedState}
                            onChange={(e) => setSelectedState(e.target.value)}
                            required
                            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white outline-none ts-input"
                        >
                            <option value="">Select State</option>
                            {US_STATES.map((s) => (
                                <option key={s.code} value={s.code}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-300 mb-1">County Name</label>
                        <input
                            type="text"
                            value={county}
                            onChange={(e) => setCounty(e.target.value)}
                            placeholder="e.g. Travis"
                            required
                            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-orange-500 outline-none placeholder-slate-500"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-orange-900/40 mt-2"
                    >
                        Confirm Location
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LocationModal;
