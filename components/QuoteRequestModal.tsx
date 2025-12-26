
import React, { useState, useEffect } from 'react';
import { XIcon } from './Icons';
import { Contractor, User } from '../types';

interface QuoteRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractor: Contractor | null;
  currentUser: User | null;
}

const QuoteRequestModal: React.FC<QuoteRequestModalProps> = ({ isOpen, onClose, contractor, currentUser }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [projectDetails, setProjectDetails] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Reset form when modal is opened
            setProjectDetails('');
            setEmail('');
            setIsSubmitted(false);
            // Pre-fill name if user is logged in
            setName(currentUser?.username || '');
        }
    }, [isOpen, currentUser]);

    if (!isOpen || !contractor) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // In a real application, this would send the data to a backend service
        console.log({
            contractorId: contractor.id,
            name,
            email,
            projectDetails,
        });
        setIsSubmitted(true);
        setTimeout(() => {
            onClose();
        }, 3000); // Close modal automatically after 3 seconds
    };

    return (
        <div className="fixed inset-0 bg-overlay/80 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
            <div className="bg-surface rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                    <XIcon className="w-6 h-6" />
                </button>
                
                <h2 className="text-2xl font-bold text-foreground mb-2">Request a Quote</h2>
                <p className="text-md text-muted-foreground mb-6">from <span className="font-semibold">{contractor.name}</span></p>
                
                {isSubmitted ? (
                    <div className="text-center py-8">
                        <h3 className="text-xl font-semibold text-success">Request Sent!</h3>
                        <p className="text-muted-foreground mt-2">{contractor.name} will contact you shortly regarding your project.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="quote-name" className="block text-sm font-medium text-muted-foreground">Your Name</label>
                            <input
                                id="quote-name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className="mt-1 block w-full border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary bg-surface text-foreground"
                            />
                        </div>
                        <div>
                            <label htmlFor="quote-email" className="block text-sm font-medium text-muted-foreground">Your Email</label>
                            <input
                                id="quote-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="mt-1 block w-full border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary bg-surface text-foreground"
                            />
                        </div>
                        <div>
                            <label htmlFor="quote-details" className="block text-sm font-medium text-muted-foreground">Project Details</label>
                            <textarea
                                id="quote-details"
                                value={projectDetails}
                                onChange={(e) => setProjectDetails(e.target.value)}
                                rows={4}
                                required
                                placeholder={`Briefly describe the work you need done...`}
                                className="mt-1 block w-full border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary bg-surface text-foreground"
                            />
                        </div>
                        <div className="flex justify-end space-x-3 pt-2">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md whitespace-nowrap transition-colors duration-200 bg-surface text-foreground hover:bg-muted ring-1 ring-border">
                                Cancel
                            </button>
                            <button type="submit" className="px-4 py-2 text-sm font-semibold rounded-md whitespace-nowrap transition-colors duration-200 bg-indigo-600 text-white shadow hover:bg-indigo-700">
                                Send Request
                            </button>
                        </div>
                    </form>
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

export default QuoteRequestModal;
