
import React, { useState } from 'react';
import { XIcon } from './Icons';

interface AuthModalProps {
  mode: 'login' | 'signup';
  onClose: () => void;
  onLogin: (username: string) => boolean;
  onSignup: (username: string, bio: string) => boolean;
  onSwitchMode: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ mode, onClose, onLogin, onSignup, onSwitchMode }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState(''); // Note: Password is not used for mock login
    const [bio, setBio] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        let success = false;
        if (mode === 'login') {
            success = onLogin(username);
            if (!success) setError('User not found. Try signing up!');
        } else {
            success = onSignup(username, bio);
            if (!success) setError('Username is already taken.');
        }
    };

    return (
        <div className="fixed inset-0 bg-overlay/80 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
            <div className="bg-surface rounded-lg shadow-xl w-full max-w-md p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                    <XIcon className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold text-foreground mb-4 text-center">
                    {mode === 'login' ? 'Welcome Back!' : 'Create Your Account'}
                </h2>
                {error && <p className="bg-error/10 border border-error text-error px-4 py-2 rounded-md text-sm mb-4">{error}</p>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-muted-foreground">Username</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="mt-1 block w-full border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary bg-surface text-foreground"
                        />
                    </div>
                    {mode === 'signup' && (
                         <div>
                            <label htmlFor="bio" className="block text-sm font-medium text-muted-foreground">Short Bio</label>
                            <textarea
                                id="bio"
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                rows={2}
                                required
                                placeholder="e.g. Home improvement enthusiast."
                                className="mt-1 block w-full border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary bg-surface text-foreground"
                            />
                        </div>
                    )}
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-muted-foreground">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="mt-1 block w-full border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary bg-surface text-foreground"
                        />
                         <p className="text-xs text-muted-foreground mt-1">Note: For this demo, any password will work.</p>
                    </div>
                    <button type="submit" className="w-full bg-primary text-primary-foreground font-bold py-2 px-4 rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors">
                        {mode === 'login' ? 'Login' : 'Sign Up'}
                    </button>
                </form>
                <p className="text-center text-sm text-muted-foreground mt-4">
                    {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
                    <button onClick={onSwitchMode} className="font-semibold text-primary hover:underline ml-1">
                       {mode === 'login' ? "Sign up" : "Login"}
                    </button>
                </p>
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

export default AuthModal;
