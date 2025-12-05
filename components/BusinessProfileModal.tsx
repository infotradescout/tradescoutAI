
import React, { useState, useEffect } from 'react';
import { Contractor } from '../types';
import { XIcon, CheckBadgeIcon, EnvelopeIcon } from './Icons';

interface BusinessProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    contractor: Contractor | null;
    onSave: (updatedContractor: Contractor) => void;
    mode: 'claim' | 'edit';
}

const BusinessProfileModal: React.FC<BusinessProfileModalProps> = ({ isOpen, onClose, contractor, onSave, mode }) => {
    const [formData, setFormData] = useState<Partial<Contractor>>({});
    const [verificationEmail, setVerificationEmail] = useState('');
    const [step, setStep] = useState(1); // 1: Email, 2: Code, 3: Success
    const [isLoading, setIsLoading] = useState(false);
    
    // State for code verification
    const [generatedCode, setGeneratedCode] = useState('');
    const [inputCode, setInputCode] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (contractor) {
            setFormData({
                name: contractor.name,
                description: contractor.description,
                specialties: contractor.specialties,
                phone: contractor.phone,
                email: contractor.email,
                website: contractor.website
            });
            setVerificationEmail('');
            setInputCode('');
            setGeneratedCode('');
            setError('');
            setStep(1);
        }
    }, [contractor, isOpen]);

    if (!isOpen || !contractor) return null;

    // Step 1: Send Verification Code
    const handleSendCode = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        // Simulate network request to send email
        setTimeout(() => {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            setGeneratedCode(code);
            setIsLoading(false);
            setStep(2);
        }, 1500);
    };

    // Step 2: Verify Code
    const handleVerifyCode = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        setTimeout(() => {
            if (inputCode === generatedCode) {
                setStep(3);
            } else {
                setError('Invalid code. Please check the "email" and try again.');
            }
            setIsLoading(false);
        }, 1000);
    };

    // Step 3: Finalize Claim
    const handleClaimFinalize = () => {
        onSave({ ...contractor, claimed: true });
        onClose();
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setTimeout(() => {
            onSave({
                ...contractor,
                ...formData as Contractor
            });
            setIsLoading(false);
            onClose();
        }, 1000);
    };

    const handleSpecialtiesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setFormData(prev => ({
            ...prev,
            specialties: val.split(',').map(s => s.trim()).filter(Boolean)
        }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-slate-800">
                    <XIcon className="w-6 h-6" />
                </button>

                {mode === 'claim' ? (
                    <>
                        {step === 1 && (
                            <form onSubmit={handleSendCode}>
                                <h2 className="text-2xl font-bold text-slate-800 mb-2">Claim This Business</h2>
                                <p className="text-slate-600 mb-4">
                                    To verify your ownership of <strong>{contractor.name}</strong>, we need to send a verification code to your business email.
                                </p>
                                
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Business Email Address</label>
                                    <input 
                                        type="email" 
                                        required 
                                        placeholder="you@business.com"
                                        value={verificationEmail}
                                        onChange={e => setVerificationEmail(e.target.value)}
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800"
                                    />
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={isLoading}
                                    className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center justify-center"
                                >
                                    {isLoading ? 'Sending...' : 'Send Verification Code'}
                                </button>
                            </form>
                        )}

                        {step === 2 && (
                            <form onSubmit={handleVerifyCode}>
                                <h2 className="text-2xl font-bold text-slate-800 mb-2">Check Your Email</h2>
                                <div className="bg-blue-50 p-4 rounded-md mb-4 border border-blue-100">
                                    <div className="flex items-start">
                                        <EnvelopeIcon className="w-5 h-5 text-blue-600 mt-0.5 mr-2" />
                                        <div>
                                            <p className="text-sm text-blue-800">
                                                We've sent a verification code to <strong>{verificationEmail}</strong>.
                                            </p>
                                            <p className="text-xs text-blue-600 mt-2 font-mono bg-white inline-block px-2 py-1 rounded border border-blue-200">
                                                Demo Code: {generatedCode}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Enter 6-Digit Code</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="123456"
                                        maxLength={6}
                                        value={inputCode}
                                        onChange={e => setInputCode(e.target.value)}
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 tracking-widest text-lg text-center bg-white text-slate-800"
                                    />
                                    {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
                                </div>

                                <div className="flex space-x-3">
                                    <button 
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="flex-1 bg-white text-slate-700 font-semibold py-2 px-4 rounded-md ring-1 ring-slate-300 hover:bg-slate-50"
                                    >
                                        Back
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={isLoading}
                                        className="flex-1 bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center justify-center"
                                    >
                                        {isLoading ? 'Verifying...' : 'Verify'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {step === 3 && (
                            <div className="text-center py-6">
                                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                                    <CheckBadgeIcon className="h-8 w-8 text-green-600" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-900">Ownership Verified!</h3>
                                <p className="mt-2 text-sm text-slate-500">
                                    You have successfully claimed <strong>{contractor.name}</strong>.
                                </p>
                                <div className="mt-6">
                                    <button
                                        onClick={handleClaimFinalize}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                                    >
                                        Continue to Profile
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <form onSubmit={handleEditSubmit} className="space-y-4">
                         <h2 className="text-2xl font-bold text-slate-800 mb-2">Edit Business Profile</h2>
                         <div>
                            <label className="block text-sm font-medium text-slate-700">Business Name</label>
                            <input
                                type="text"
                                value={formData.name || ''}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800"
                            />
                         </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700">Description</label>
                            <textarea
                                value={formData.description || ''}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                                rows={3}
                                className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800"
                            />
                         </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700">Specialties (comma separated)</label>
                            <input
                                type="text"
                                value={formData.specialties?.join(', ') || ''}
                                onChange={handleSpecialtiesChange}
                                className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800"
                            />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-slate-700">Phone</label>
                                <input
                                    type="text"
                                    value={formData.phone || ''}
                                    onChange={e => setFormData({...formData, phone: e.target.value})}
                                    className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800"
                                />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-700">Website</label>
                                <input
                                    type="text"
                                    value={formData.website || ''}
                                    onChange={e => setFormData({...formData, website: e.target.value})}
                                    className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800"
                                />
                             </div>
                         </div>
                         
                         <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 mt-4"
                        >
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
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

export default BusinessProfileModal;
