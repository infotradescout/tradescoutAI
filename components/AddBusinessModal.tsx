
import React, { useState } from 'react';
import { Contractor, Category } from '../types';
import { XIcon, BuildingStorefrontIcon, PlusCircleIcon } from './Icons';

interface AddBusinessModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (contractor: Contractor) => void;
}

const AddBusinessModal: React.FC<AddBusinessModalProps> = ({ isOpen, onClose, onImport }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [foundBusiness, setFoundBusiness] = useState<Partial<Contractor> & { sourceUrl?: string } | null>(null);
    const [error, setError] = useState('');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsLoading(true);
        setError('');
        setFoundBusiness(null);

        try {
            setError('Auto-discovery via web search is disabled in this archived component. Add businesses via the live admin tools instead.');

        } catch (err) {
            console.error("Error searching business:", err);
            setError('An error occurred while searching. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = () => {
        if (foundBusiness) {
            const newContractor: Contractor = {
                id: `c${Date.now()}`,
                name: foundBusiness.name || 'Unknown Business',
                category: (foundBusiness.category as Category) || Category.GENERAL,
                location: foundBusiness.location || 'Toronto, ON',
                monthlyScore: 50, // Default starting score
                lifetimeScore: 0,
                avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(foundBusiness.name || 'B')}&background=random`,
                description: foundBusiness.description || 'No description available.',
                specialties: foundBusiness.specialties || [],
                reviews: [],
                verified: false,
                lat: foundBusiness.lat || 43.6532,
                lng: foundBusiness.lng || -79.3832,
                claimed: false, // Imported profiles are unclaimed by default
                phone: foundBusiness.phone,
                email: undefined,
                website: foundBusiness.website,
                sourceUrl: foundBusiness.sourceUrl
            };
            onImport(newContractor);
            onClose();
            setFoundBusiness(null);
            setSearchQuery('');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-overlay/80 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
            <div className="bg-surface rounded-lg shadow-xl w-full max-w-md p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                    <XIcon className="w-6 h-6" />
                </button>
                
                <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center">
                    <BuildingStorefrontIcon className="w-6 h-6 mr-2 text-primary"/>
                    Add Business
                </h2>
                
                <p className="text-sm text-muted-foreground mb-4">
                    Search for a real business on Google to create a profile.
                </p>

                <form onSubmit={handleSearch} className="space-y-4">
                    <div>
                        <label htmlFor="business-search" className="block text-sm font-medium text-muted-foreground">Business Name & City</label>
                        <div className="flex mt-1">
                            <input
                                id="business-search"
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="e.g. Joe's Plumbing Mississauga"
                                className="block w-full border border-border rounded-l-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary bg-surface text-foreground"
                            />
                            <button 
                                type="submit" 
                                disabled={isLoading || !searchQuery.trim()}
                                className="bg-primary text-primary-foreground px-4 py-2 rounded-r-md font-semibold hover:bg-primary/90 disabled:bg-primary/50 transition-colors"
                            >
                                {isLoading ? '...' : 'Search'}
                            </button>
                        </div>
                    </div>
                </form>

                {error && (
                    <div className="mt-4 p-3 bg-error/10 text-error text-sm rounded-md border border-error/20">
                        {error}
                    </div>
                )}

                {foundBusiness && (
                    <div className="mt-6 bg-muted p-4 rounded-lg border border-border">
                        <h3 className="font-bold text-lg text-foreground">{foundBusiness.name}</h3>
                        <p className="text-xs text-primary font-semibold uppercase tracking-wide mt-1">{foundBusiness.category}</p>
                        <p className="text-sm text-muted-foreground mt-2">{foundBusiness.location}</p>
                        {foundBusiness.phone && <p className="text-sm text-muted-foreground mt-1">{foundBusiness.phone}</p>}
                        
                        <div className="mt-3 flex flex-wrap gap-1">
                            {foundBusiness.specialties?.map((s, i) => (
                                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface border border-border text-muted-foreground">
                                    {s}
                                </span>
                            ))}
                        </div>

                        {foundBusiness.sourceUrl && (
                             <p className="text-xs text-slate-400 mt-3 truncate flex items-center">
                                Source: <a href={foundBusiness.sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-indigo-600 ml-1 truncate">
                                    {foundBusiness.sourceUrl.includes('google.com/maps') ? 'Google Maps' : 'Web Source'}
                                </a>
                             </p>
                        )}

                        <button 
                            onClick={handleImport}
                            className="mt-4 w-full flex items-center justify-center bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
                        >
                            <PlusCircleIcon className="w-5 h-5 mr-2" />
                            Import & Create Profile
                        </button>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default AddBusinessModal;
