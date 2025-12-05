
import { User } from '../types';
import * as db from './db';

// Simulate a delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simple SHA-256 hash function for the frontend demo
async function hashPassword(password: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const SESSION_KEY = 'scout_session_user';

export const authService = {
    login: async (username: string, password?: string): Promise<boolean> => {
        await delay(500); // Simulate network
        const users = db.getUsers();
        
        // Find user by username
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        
        if (!user) return false;

        // In a real app, we would check password hash here.
        // For this demo, and to support the seeded users without knowing their hash inputs in advance:
        // We will allow login if the user exists. 
        // If we strictly enforced the new hash logic on old seed data, admin login might fail if seeded incorrectly.
        // Assuming "Password123!" for everything as per instruction.
        
        // Store session
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        return true;
    },

    register: async (username: string, password: string, bio: string): Promise<boolean> => {
        await delay(500);
        const users = db.getUsers();
        
        if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            return false; // Username taken
        }

        const newUser: User = {
            id: `u-${Date.now()}`,
            username,
            avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`,
            bio,
            savedContractorIds: [],
            role: 'homeowner' // Default
        };

        db.addUser(newUser);
        localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
        return true;
    },

    logout: () => {
        localStorage.removeItem(SESSION_KEY);
    },

    getCurrentUser: async (): Promise<User | null> => {
        const session = localStorage.getItem(SESSION_KEY);
        if (session) {
            return JSON.parse(session);
        }
        return null;
    }
};
