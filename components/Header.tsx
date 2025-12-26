import React from 'react';
import { StarIcon, BookmarkIcon, PlusCircleIcon, HomeIcon, Cog6ToothIcon, ClipboardDocumentCheckIcon, ChatBubbleLeftRightIcon, GlobeAltIcon, UserIcon, CheckBadgeIcon } from './Icons';
import { User } from '../types';

interface HeaderProps {
    currentUser: User | null;
    onLoginClick: () => void;
    onSignupClick: () => void;
    onLogout: () => void;
    onNavigateToDashboard: () => void;
    onNavigateToProjects: () => void;
    onAddBusinessClick: () => void;
    onAdminClick: () => void;
    onNavigateToForum: () => void;
    currentView?: string; // Optional: to highlight active tab
}

const Header: React.FC<HeaderProps> = ({ 
    currentUser, 
    onLoginClick, 
    onSignupClick, 
    onLogout, 
    onNavigateToDashboard, 
    onNavigateToProjects,
    onAddBusinessClick,
    onAdminClick,
    onNavigateToForum,
    currentView
}) => {
  return (
    <>
        {/* TOP HEADER (Desktop: Full, Mobile: Minimal) */}
        <header className="sticky top-0 z-50 backdrop-blur-md bg-charcoal-900/90 border-b border-charcoal-700 shadow-lg transition-all duration-300">
        <div className="container mx-auto px-4 py-2 md:py-3">
            <div className="flex justify-between items-start gap-3 flex-wrap">
                {/* Logo Section */}
                <div className="flex items-center space-x-2 sm:space-x-3 group cursor-pointer flex-shrink" onClick={() => window.location.reload()}>
                    <div className="bg-gradient-to-br from-orange-600 to-red-600 p-2 rounded-lg shadow-lg shadow-orange-900/50 group-hover:scale-105 transition-transform duration-200">
                        <HomeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="leading-tight">
                        <h1 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight uppercase leading-none break-words">
                        Trade<span className="text-orange-500">Scout</span>
                        </h1>
                        <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wide hidden sm:block mt-0.5">
                        Nationwide Tools, Local Connection
                        </p>
                    </div>
                </div>
                
                {/* Desktop Navigation */}
                <div className="flex items-center space-x-4">
                    {/* Desktop Links */}
                    <div className="hidden lg:flex items-center space-x-1 mr-2 border-r border-slate-700 pr-4">
                        <button onClick={() => window.location.reload()} className="px-3 py-2 text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                            Search
                        </button>
                        <button onClick={onNavigateToForum} className="px-3 py-2 text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                            Neighbors
                        </button>
                        <button onClick={onNavigateToProjects} className="px-3 py-2 text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                            Projects
                        </button>
                    </div>

                    <div className="hidden sm:flex items-center gap-2">
                        <button
                            onClick={onAddBusinessClick}
                            className="flex items-center px-3 py-1.5 text-xs font-bold text-orange-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-all border border-slate-700/50"
                        >
                            <PlusCircleIcon className="w-4 h-4 mr-1.5" />
                            Add Business
                        </button>
                        
                        <a 
                            href="#" 
                            className="flex items-center px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-cyan-400 transition-colors"
                            title="Go to main website"
                        >
                            <GlobeAltIcon className="w-4 h-4 mr-1.5" />
                            Full Site
                        </a>
                    </div>

                    {/* Auth & Profile */}
                    {currentUser ? (
                        <div className="flex items-center space-x-3 pl-2">
                            {currentUser.isAdmin && (
                                <button
                                    onClick={onAdminClick}
                                    className="hidden sm:flex items-center px-3 py-1.5 text-xs font-bold rounded-lg bg-red-900/20 text-red-400 border border-red-900/50 hover:bg-red-900/40 shadow-sm transition-all"
                                >
                                    <Cog6ToothIcon className="w-3.5 h-3.5 mr-1.5" />
                                    Admin
                                </button>
                            )}
                            
                            <button
                                onClick={onNavigateToDashboard}
                                className="hidden sm:flex items-center justify-center p-2 rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700 ring-1 ring-slate-600 shadow-sm transition-all"
                                title="Saved Pros"
                            >
                                <BookmarkIcon className="w-4 h-4 text-orange-500" solid />
                            </button>

                            <div className="flex items-center gap-2 cursor-pointer" onClick={onNavigateToDashboard}>
                                <img 
                                    src={currentUser.avatarUrl} 
                                    alt={currentUser.username} 
                                    className="w-8 h-8 rounded-full ring-2 ring-slate-700 hover:ring-orange-500 transition-all"
                                />
                                {currentUser.role === 'contractor' && (
                                    <span className="hidden sm:block text-[10px] font-bold bg-cyan-900/50 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-800">PRO</span>
                                )}
                            </div>
                            
                            <button
                                onClick={onLogout}
                                className="hidden sm:block text-xs font-bold text-slate-500 hover:text-red-400 transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                                        ) : (
                                                <>
                                                    {/* Mobile: icon-only */}
                                                    <div className="flex items-center gap-2 sm:hidden">
                                                        <button
                                                            onClick={onSignupClick}
                                                            title="Create account"
                                                            aria-label="Create account"
                                                            className="flex items-center justify-center p-2 rounded-full bg-orange-600 text-white hover:bg-orange-700 shadow-sm border border-orange-700/60 transition-all"
                                                        >
                                                            <CheckBadgeIcon className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={onLoginClick}
                                                            title="Log in"
                                                            aria-label="Log in"
                                                            className="flex items-center justify-center p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 border border-slate-600 transition-all"
                                                        >
                                                            <UserIcon className="w-5 h-5" />
                                                        </button>
                                                    </div>

                                                    {/* Desktop/Tablet: text buttons */}
                                                    <div className="hidden sm:flex items-center space-x-2">
                                                        <button
                                                            onClick={onSignupClick}
                                                            className="px-4 py-1.5 text-xs sm:text-sm font-bold rounded-full bg-orange-600 text-white shadow-lg shadow-orange-900/50 hover:bg-orange-700 transition-all"
                                                        >
                                                            Create account
                                                        </button>
                                                        <button
                                                            onClick={onLoginClick}
                                                            className="px-4 py-1.5 text-xs sm:text-sm font-bold rounded-full bg-slate-800 text-white hover:bg-slate-700 border border-slate-600 transition-all"
                                                        >
                                                            Log in
                                                        </button>
                                                    </div>
                                                </>
                                        )}
                </div>
            </div>
            
            {/* Mobile-Only Sub-Header Info */}
            <div className="mt-2 sm:hidden flex justify-between items-center bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-700/50">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    {currentUser?.role === 'contractor' ? 'Pro Mode Active' : 'Community Mode'}
                 </p>
                 {currentUser?.isAdmin && (
                     <button onClick={onAdminClick} className="text-[10px] font-bold text-red-400 flex items-center bg-red-900/20 px-2 py-0.5 rounded border border-red-900/30">
                         <Cog6ToothIcon className="w-3 h-3 mr-1" /> Admin
                     </button>
                 )}
            </div>
        </div>
        </header>

        {/* BOTTOM MOBILE NAVIGATION BAR */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 pb-safe pt-1 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)]">
            <div className="grid grid-cols-5 h-16 items-center">
                <button onClick={() => window.location.reload()} className="flex flex-col items-center justify-center space-y-1 text-slate-400">
                    
                    <HomeIcon className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Home</span>
                </button>
                
                <button onClick={onNavigateToProjects} className="flex flex-col items-center justify-center space-y-1 text-slate-400 hover:text-emerald-400 active:text-emerald-400">
                    <ClipboardDocumentCheckIcon className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Projects</span>
                </button>

                {/* Center Action Button (Add) */}
                <div className="relative -top-5 flex justify-center">
                    <button 
                        onClick={onAddBusinessClick}
                        className="bg-orange-600 text-white p-3 rounded-full shadow-lg shadow-orange-900/50 border-4 border-slate-900 hover:bg-orange-500 transition-transform active:scale-95"
                    >
                        <PlusCircleIcon className="w-7 h-7" />
                    </button>
                </div>

                <button onClick={onNavigateToForum} className="flex flex-col items-center justify-center space-y-1 text-slate-400 hover:text-cyan-400 active:text-cyan-400">
                    <ChatBubbleLeftRightIcon className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Neighbors</span>
                </button>

                <button onClick={onNavigateToDashboard} className="flex flex-col items-center justify-center space-y-1 text-slate-400 hover:text-white active:text-white">
                    {currentUser ? (
                        <div className="relative">
                            <img src={currentUser.avatarUrl} className="w-6 h-6 rounded-full border border-slate-500" alt="Profile" />
                            {currentUser.role === 'contractor' && <div className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-500 rounded-full border border-slate-900"></div>}
                        </div>
                    ) : (
                        <UserIcon className="w-6 h-6" />
                    )}
                    <span className="text-[10px] font-medium">{currentUser ? 'Me' : 'Saved'}</span>
                </button>
            </div>
        </nav>
    </>
  );
};

export default Header;