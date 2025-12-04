
import React from 'react';
import { StarIcon, UserIcon, BookmarkIcon, PlusCircleIcon, HomeIcon, Cog6ToothIcon } from './Icons';
import { User } from '../types';

interface HeaderProps {
    currentUser: User | null;
    onLoginClick: () => void;
    onSignupClick: () => void;
    onLogout: () => void;
    onNavigateToDashboard: () => void;
    onAddBusinessClick: () => void;
    onAdminClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
    currentUser, 
    onLoginClick, 
    onSignupClick, 
    onLogout, 
    onNavigateToDashboard, 
    onAddBusinessClick,
    onAdminClick
}) => {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 border-b border-slate-200/60 shadow-sm transition-all duration-300">
      <div className="container mx-auto px-4 py-3 sm:py-4">
        <div className="flex justify-between items-center gap-3">
            <div className="flex items-center space-x-2 sm:space-x-3 group cursor-pointer" onClick={() => window.location.reload()}>
                <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2 sm:p-2.5 rounded-lg sm:rounded-xl shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform duration-200">
                    <HomeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Trade<span className="text-indigo-600">Scout</span>
                    </h1>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:block">
                    Trusted Pros. Verified Results.
                    </p>
                </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
                 <button
                    onClick={onAddBusinessClick}
                    className="hidden md:flex items-center px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all duration-200"
                >
                    <PlusCircleIcon className="w-5 h-5 mr-2" />
                    Add Business
                </button>

                {currentUser ? (
                    <div className="flex items-center space-x-2 sm:space-x-3">
                        {currentUser.isAdmin && (
                             <button
                                onClick={onAdminClick}
                                className="hidden sm:flex items-center px-4 py-2 text-sm font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-700 shadow-sm transition-all"
                            >
                                <Cog6ToothIcon className="w-4 h-4 mr-2" />
                                Admin Panel
                            </button>
                        )}

                        <img 
                            src={currentUser.avatarUrl} 
                            alt={currentUser.username} 
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full ring-2 ring-offset-2 ring-indigo-500 shadow-md cursor-pointer hover:scale-105 transition-transform"
                            onClick={onNavigateToDashboard}
                        />
                         <button
                            onClick={onNavigateToDashboard}
                            className="hidden sm:flex items-center px-4 py-2 text-sm font-bold rounded-full bg-white text-slate-700 hover:bg-slate-50 ring-1 ring-slate-200 shadow-sm transition-all"
                        >
                            <BookmarkIcon className="w-4 h-4 mr-2 text-indigo-500" solid />
                            Saved
                        </button>
                         <button
                            onClick={onLogout}
                            className="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={onLoginClick}
                            className="px-4 py-1.5 sm:px-5 sm:py-2 text-sm font-bold rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all duration-200"
                        >
                            Login
                        </button>
                         <button
                            onClick={onSignupClick}
                            className="hidden sm:block px-5 py-2 text-sm font-bold rounded-full bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 transition-all duration-200"
                        >
                            Sign Up
                        </button>
                    </div>
                )}
            </div>
        </div>
        
         <div className="mt-3 bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-100 p-2 sm:p-3 rounded-lg flex items-center justify-between sm:justify-start gap-3 shadow-sm">
            <div className="bg-white p-1 sm:p-1.5 rounded-full shadow-sm text-sky-500 flex-shrink-0">
              <StarIcon className="h-3 w-3 sm:h-4 sm:w-4" />
            </div>
            <p className="text-xs sm:text-sm text-slate-700 font-medium truncate sm:overflow-visible">
                <span className="text-indigo-700 font-bold">Find & Claim:</span> Business owners, find your profile and click "Own this business?" to claim it!
            </p>
        </div>
      </div>
    </header>
  );
};

export default Header;
