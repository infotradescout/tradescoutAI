
import React, { useState, useEffect } from 'react';
import { User, Lead, Contractor } from '../types';
import * as db from '../services/db';
import { ArrowLeftIcon, BriefcaseIcon, MapPinIcon, StarIcon, CheckBadgeIcon, ChartBarIcon, PhoneIcon, EnvelopeIcon } from './Icons';

interface ProDashboardProps {
    currentUser: User;
    onBack: () => void;
}

const ProDashboard: React.FC<ProDashboardProps> = ({ currentUser, onBack }) => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [contractorProfile, setContractorProfile] = useState<Contractor | null>(null);

    useEffect(() => {
        // Find the linked contractor profile
        const contractors = db.getContractors();
        
        // Logic to link user to contractor. 
        // In a real app, User object would have contractorId. 
        // For this demo, we might match by name or use the seed data link.
        // The seed user 'baker' is linked to 'Baker Roofing Company' implicitly via logic or explicit field.
        
        let profile = contractors.find(c => c.id === currentUser.linkedContractorId);
        
        // Fallback for demo: if username matches part of contractor name
        if (!profile && currentUser.role === 'contractor') {
             profile = contractors.find(c => c.name.toLowerCase().includes(currentUser.username.toLowerCase()));
        }

        if (profile) {
            setContractorProfile(profile);
            // Fetch relevant leads
            const relevantLeads = db.getLeadsForPro(profile.category, profile.location);
            setLeads(relevantLeads);
        }
    }, [currentUser]);

    return (
        <div className="bg-slate-900 min-h-screen text-slate-100">
            <div className="max-w-6xl mx-auto">
                <button onClick={onBack} className="flex items-center text-sm font-bold text-slate-400 hover:text-white mb-6 transition-colors">
                    <ArrowLeftIcon className="w-4 h-4 mr-2" />
                    Back to Main Site
                </button>

                {contractorProfile ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Profile Overview */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-lg">
                                <div className="flex items-center space-x-4 mb-6">
                                    <img src={contractorProfile.avatarUrl} alt={contractorProfile.name} className="w-16 h-16 rounded-xl border border-slate-600" />
                                    <div>
                                        <h2 className="text-xl font-bold text-white">{contractorProfile.name}</h2>
                                        <div className="flex items-center text-sm text-slate-400 mt-1">
                                            <MapPinIcon className="w-4 h-4 mr-1" />
                                            {contractorProfile.location}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-3 bg-slate-900 rounded-xl border border-slate-700">
                                        <div className="flex items-center">
                                            <StarIcon className="w-5 h-5 mr-2" style={{ color: 'var(--theme-accent-primary)' }} />
                                            <span className="text-sm font-bold text-slate-300">Monthly Score</span>
                                        </div>
                                        <span className="text-lg font-bold text-white">{contractorProfile.monthlyScore}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-900 rounded-xl border border-slate-700">
                                        <div className="flex items-center">
                                            <ChartBarIcon className="w-5 h-5 text-cyan-500 mr-2" />
                                            <span className="text-sm font-bold text-slate-300">Lifetime Score</span>
                                        </div>
                                        <span className="text-lg font-bold text-white">{contractorProfile.lifetimeScore}</span>
                                    </div>
                                </div>

                                <div className="mt-6 pt-6 border-t border-slate-700">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h3>
                                    <button className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded-lg mb-2 transition-colors">
                                        Edit Profile
                                    </button>
                                    <button className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded-lg transition-colors">
                                        Manage Reviews
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Leads Feed */}
                        <div className="lg:col-span-2">
                            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-lg overflow-hidden">
                                <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                                    <div>
                                        <h2 className="text-xl font-bold text-white">Live Leads</h2>
                                        <p className="text-sm text-slate-400 mt-1">Homeowners looking for {contractorProfile.category} in your area.</p>
                                    </div>
                                    <span className="bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                                        {leads.length} New
                                    </span>
                                </div>
                                
                                <div className="divide-y divide-slate-700">
                                    {leads.length > 0 ? (
                                        leads.map(lead => (
                                            <div key={lead.id} className="p-6 hover:bg-slate-750 transition-colors">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center space-x-2">
                                                        <span className="px-2 py-1 rounded-md bg-slate-700 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                                                            {lead.category}
                                                        </span>
                                                        <span className="text-xs text-slate-500">• {lead.date}</span>
                                                    </div>
                                                    <div className="flex items-center text-slate-400 text-sm">
                                                        <MapPinIcon className="w-4 h-4 mr-1" />
                                                        {lead.location}
                                                    </div>
                                                </div>
                                                <h3 className="text-lg font-bold text-white mb-2">{lead.userName} needs help</h3>
                                                <p className="text-slate-300 text-sm leading-relaxed mb-4">{lead.description}</p>
                                                
                                                <div className="flex space-x-3">
                                                    <button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg text-sm font-bold shadow-md transition-colors flex items-center justify-center">
                                                        <PhoneIcon className="w-4 h-4 mr-2" />
                                                        Contact Now
                                                    </button>
                                                    <button className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center">
                                                        <EnvelopeIcon className="w-4 h-4 mr-2" />
                                                        Send Quote
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-12 text-center">
                                            <div className="bg-slate-900/50 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                                <BriefcaseIcon className="w-8 h-8 text-slate-600" />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-300">No leads right now</h3>
                                            <p className="text-slate-500 mt-2">Check back later or expand your service area.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-20 bg-slate-800 rounded-2xl border border-slate-700">
                        <BriefcaseIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-white">No Business Profile Linked</h2>
                        <p className="text-slate-400 mt-2 max-w-md mx-auto">
                            It looks like your account isn't linked to a business profile yet. 
                            Please claim your business listing to access the dashboard.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProDashboard;
