
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
        <div className="fixed inset-0 bg-overlay/90 z-[100] flex justify-center items-center p-4">
            <div className="bg-popover rounded-2xl shadow-2xl w-full max-w-md p-6 relative border border-border animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>

                <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/40 bg-primary/20">
                        <MapPinIcon className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Set Your Location</h2>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Community Scout works best when we know your local area. This helps us find relevant codes, costs, and pros.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-muted-foreground mb-1">State</label>
                        <select
                            value={selectedState}
                            onChange={(e) => setSelectedState(e.target.value)}
                            required
                            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-foreground outline-none ts-input"
                        >
                            <option value="">Select State</option>
                            {US_STATES.map((s) => (
                                <option key={s.code} value={s.code}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-muted-foreground mb-1">County Name</label>
                        <input
                            type="text"
                            value={county}
                            onChange={(e) => setCounty(e.target.value)}
                            placeholder="e.g. Travis"
                            required
                            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-foreground focus:ring-2 focus:ring-accent outline-none placeholder-muted-foreground"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-accent/40 mt-2"
                    >
                        Confirm Location
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LocationModal;
