
import React from 'react';
import { StarIcon, UserIcon, BookmarkIcon, PlusCircleIcon, HomeIcon, Cog6ToothIcon, ClipboardDocumentCheckIcon, ChatBubbleLeftRightIcon, GlobeAltIcon } from './Icons';
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
    onNavigateToForum
}) => {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-900/80 border-b border-slate-700 shadow-lg transition-all duration-300">
      <div className="container mx-auto px-4 py-3 sm:py-4">
        <div className="flex justify-between items-center gap-3">
            <div className="flex items-center space-x-2 sm:space-x-3 group cursor-pointer" onClick={() => window.location.reload()}>
                <div className="bg-gradient-to-br from-orange-600 to-red-600 p-2 sm:p-2.5 rounded-lg sm:rounded-xl shadow-lg shadow-orange-900/50 group-hover:scale-105 transition-transform duration-200">
                    <HomeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight uppercase">
                    Community<span className="text-orange-500">Scout</span>
                    </h1>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide hidden sm:block">
                    Nationwide Tools, Local Connection
                    </p>
                </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
                 {/* Link to Production Site */}
                 <a 
                    href="#" 
                    className="hidden lg:flex items-center px-3 py-2 text-xs font-bold text-slate-400 hover:text-orange-500 transition-colors border-r border-slate-700 pr-4 mr-2"
                    title="Go to main website"
                 >
                    <GlobeAltIcon className="w-4 h-4 mr-1.5" />
                    Full Platform
                 </a>

                 <button
                    onClick={onAddBusinessClick}
                    className="hidden md:flex items-center px-4 py-2 text-sm font-semibold text-orange-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-all duration-200 border border-slate-700"
                >
                    <PlusCircleIcon className="w-5 h-5 mr-2" />
                    Add Business
                </button>

                {/* Community Forum Link - Visible to all */}
                <button
                    onClick={onNavigateToForum}
                    className="flex items-center px-3 py-2 text-sm font-bold text-slate-300 hover:text-orange-500 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Community Forum"
                >
                    <ChatBubbleLeftRightIcon className="w-5 h-5 sm:mr-2" />
                    <span className="hidden sm:inline">Neighbors</span>
                </button>

                {currentUser ? (
                    <div className="flex items-center space-x-2 sm:space-x-3">
                        {currentUser.isAdmin && (
                             <button
                                onClick={onAdminClick}
                                className="hidden sm:flex items-center px-4 py-2 text-sm font-bold rounded-lg bg-red-900/20 text-red-400 border border-red-900/50 hover:bg-red-900/40 shadow-sm transition-all"
                            >
                                <Cog6ToothIcon className="w-4 h-4 mr-2" />
                                Admin
                            </button>
                        )}
                        
                        <button
                            onClick={onNavigateToProjects}
                            className="hidden sm:flex items-center px-4 py-2 text-sm font-bold rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700 ring-1 ring-slate-600 shadow-sm transition-all"
                            title="My Projects"
                        >
                            <ClipboardDocumentCheckIcon className="w-4 h-4 mr-2 text-emerald-500" />
                            Projects
                        </button>

                        <button
                            onClick={onNavigateToDashboard}
                            className="hidden sm:flex items-center px-4 py-2 text-sm font-bold rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700 ring-1 ring-slate-600 shadow-sm transition-all"
                        >
                            <BookmarkIcon className="w-4 h-4 mr-2 text-orange-500" solid />
                            Saved
                        </button>

                        <img 
                            src={currentUser.avatarUrl} 
                            alt={currentUser.username} 
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full ring-2 ring-offset-2 ring-slate-800 shadow-md cursor-pointer hover:scale-105 transition-transform"
                            onClick={onNavigateToDashboard}
                        />
                         <button
                            onClick={onLogout}
                            className="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-slate-400 hover:text-white transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={onLoginClick}
                            className="px-4 py-1.5 sm:px-5 sm:py-2 text-sm font-bold rounded-full bg-orange-600 text-white shadow-lg shadow-orange-900/50 hover:bg-orange-700 hover:-translate-y-0.5 transition-all duration-200 uppercase tracking-wide"
                        >
                            Login
                        </button>
                         <button
                            onClick={onSignupClick}
                            className="hidden sm:block px-5 py-2 text-sm font-bold rounded-full bg-slate-800 text-slate-200 ring-1 ring-slate-600 hover:bg-slate-700 transition-all duration-200 uppercase tracking-wide"
                        >
                            Sign Up
                        </button>
                    </div>
                )}
            </div>
        </div>
        
         <div className="mt-3 bg-slate-800/50 border border-slate-700 p-2 sm:p-3 rounded-lg flex items-center justify-between sm:justify-start gap-3 shadow-inner">
            <div className="bg-slate-700 p-1 sm:p-1.5 rounded-full shadow-sm text-cyan-400 flex-shrink-0">
              <StarIcon className="h-3 w-3 sm:h-4 sm:w-4" />
            </div>
            <p className="text-xs sm:text-sm text-slate-300 font-medium truncate sm:overflow-visible">
                <span className="text-orange-500 font-bold uppercase tracking-wider mr-1">Briefing:</span> Use the Community Scout Guide to plan projects before deploying.
            </p>
        </div>
      </div>
    </header>
  );
};

export default Header;
