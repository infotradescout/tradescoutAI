import React, { useState, useRef, useEffect } from 'react';
import { ChatBubbleOvalLeftEllipsisIcon, XIcon, SparklesIcon, Cog6ToothIcon } from './Icons';
import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import { User, Lead, Category } from '../types';
import * as db from '../services/db';

// SYSTEM PROMPT - Same as App.tsx to ensure consistency
const SYSTEM_PROMPT = `
You are Community Scout — a strictly local-first home project assistant.

LOCAL-DATA PRIORITY (critical):
1. COUNTY data (highest priority)
2. STATE data
3. REGION data
4. NATIONAL data (lowest)

Rules:
- Never guess or fabricate missing county or state values.
- Always cite which level you are using: "county", "state", "region", or "national".
- If county-level data is incomplete, fall back in order without inventing anything.
- Recommend only contractors passed in the request.
- Never reference external directories or non-existent businesses.
- If the app lacks contractor matches, admit it and suggest next steps.
- Use structured JSON when asked, matching the schema exactly.
- For cost ranges: use county.typicalCosts first → then state → region → national.
- Admit when the database has gaps; never hallucinate.
- Safety: emphasize licensed pros for electrical, structural, gas, and roof work.

Tone:
- Direct, actionable, local, community-first.
- Avoid corporate language.
`;

interface ChatbotProps {
    currentUser: User | null;
    onLogin: (username: string) => boolean;
    onSignup: (username: string, bio: string) => boolean;
    onSearch?: (term: string, category: string) => void;
    onSave?: (contractorId: string) => void;
    onReview?: (contractorId: string, rating: number, comment: string) => boolean;
    onClaim?: (contractorId: string) => void;
    onAddBusiness?: () => void;
}

interface Message {
    role: 'user' | 'model';
    content: string;
    thought?: string; // Internal monologue
}

const Chatbot: React.FC<ChatbotProps> = ({ currentUser, onLogin, onSignup, onSearch, onSave, onReview, onClaim, onAddBusiness }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', content: 'Scout Guide Online. I am here to manage your community interactions and guide you through the ecosystem. How can I assist?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    // --- HELPER FOR CONTRACTOR LOOKUP ---
    const findContractorIdByName = (name: string): string | null => {
        const contractors = db.getContractors();
        const lowerName = name.toLowerCase();
        // Exact match
        let found = contractors.find(c => c.name.toLowerCase() === lowerName);
        if (found) return found.id;
        // Fuzzy match (includes)
        found = contractors.find(c => c.name.toLowerCase().includes(lowerName));
        return found ? found.id : null;
    }

    // --- TOOL DEFINITIONS ---

    const createAccountTool: FunctionDeclaration = {
        name: 'createAccount',
        description: 'Create a new user account. Ask for username and a short bio first. If they are a pro (contractor/realtor), ask for their business category.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                username: { type: Type.STRING },
                bio: { type: Type.STRING },
                role: { type: Type.STRING, enum: ['homeowner', 'contractor', 'realtor'], description: 'The type of user' },
            },
            required: ['username', 'role']
        }
    };

    const loginTool: FunctionDeclaration = {
        name: 'login',
        description: 'Log in an existing user. Ask for their username.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                username: { type: Type.STRING }
            },
            required: ['username']
        }
    };

    const submitQuoteTool: FunctionDeclaration = {
        name: 'submitQuoteRequest',
        description: 'Submit a request for a quote (Lead) for contractors to see. Requires the user to be logged in.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                category: { type: Type.STRING, enum: Object.values(Category) },
                description: { type: Type.STRING, description: 'Details about the job' },
                location: { type: Type.STRING, description: 'City/Area of the job' }
            },
            required: ['category', 'description', 'location']
        }
    };

    const checkLeadsTool: FunctionDeclaration = {
        name: 'checkLeads',
        description: 'Check for available job leads/quote requests. Only for Pros (Contractors/Realtors).',
        parameters: {
            type: Type.OBJECT,
            properties: {
                category: { type: Type.STRING },
                location: { type: Type.STRING }
            },
            required: ['category', 'location']
        }
    };

    const searchContractorsTool: FunctionDeclaration = {
        name: 'searchContractors',
        description: 'Search for professionals and update the main app view.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                term: { type: Type.STRING, description: 'Keywords like "plumber" or "roofing"' },
                category: { type: Type.STRING, enum: ['All', ...Object.values(Category)], description: 'Optional category filter' }
            },
            required: ['term']
        }
    };

    const saveContractorTool: FunctionDeclaration = {
        name: 'saveContractor',
        description: 'Save (bookmark) a contractor by name. Requires user to be logged in.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                contractorName: { type: Type.STRING, description: 'The name of the contractor to save' }
            },
            required: ['contractorName']
        }
    };

    const addReviewTool: FunctionDeclaration = {
        name: 'addReview',
        description: 'Add a review for a contractor. Requires user to be logged in.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                contractorName: { type: Type.STRING, description: 'Name of the contractor' },
                rating: { type: Type.NUMBER, description: 'Rating from 1 to 5' },
                comment: { type: Type.STRING, description: 'Review text' }
            },
            required: ['contractorName', 'rating', 'comment']
        }
    };

    const claimBusinessTool: FunctionDeclaration = {
        name: 'claimBusiness',
        description: 'Open the claim verification modal for a specific business.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                contractorName: { type: Type.STRING, description: 'Name of the business to claim' }
            },
            required: ['contractorName']
        }
    };

    const calculateEstimateTool: FunctionDeclaration = {
        name: 'calculateEstimate',
        description: 'Calculate a rough project cost estimate based on category and size/metric.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                category: { type: Type.STRING, enum: Object.values(Category) },
                metricValue: { type: Type.NUMBER, description: 'The numerical size (sq ft, count, etc.)' },
                regionMultiplier: { type: Type.NUMBER, description: 'Optional multiplier (default 1.0)' }
            },
            required: ['category', 'metricValue']
        }
    };

    const openAddBusinessTool: FunctionDeclaration = {
        name: 'openAddBusiness',
        description: 'Open the form to add a new business to the directory.',
        parameters: {
            type: Type.OBJECT,
            properties: {},
        }
    };

    const tools = [
        createAccountTool, loginTool, submitQuoteTool, checkLeadsTool, 
        searchContractorsTool, saveContractorTool, addReviewTool, claimBusinessTool, calculateEstimateTool,
        openAddBusinessTool
    ];

    // --- CLIENT-SIDE TOOL HANDLERS ---

    const handleToolCall = async (fnName: string, args: any): Promise<any> => {
        console.log(`Executing tool: ${fnName}`, args);

        if (fnName === 'createAccount') {
            const success = onSignup(args.username, args.bio || 'New user');
            if (success) {
                const users = db.getUsers();
                const newUser = users.find(u => u.username === args.username);
                if (newUser && args.role) {
                    newUser.role = args.role;
                    db.addUser(newUser); 
                }
                return { result: `Account created successfully for ${args.username} as a ${args.role}. You are now logged in.` };
            }
            return { result: `Username '${args.username}' is already taken. Please try another.` };
        }

        if (fnName === 'login') {
            const success = onLogin(args.username);
            if (success) return { result: `Successfully logged in as ${args.username}.` };
            return { result: `User '${args.username}' not found.` };
        }

        if (fnName === 'submitQuoteRequest') {
            if (!currentUser) return { result: "Error: You must be logged in to request a quote." };
            
            const newLead: Lead = {
                id: `lead-${Date.now()}`,
                userId: currentUser.id,
                userName: currentUser.username,
                category: args.category,
                description: args.description,
                location: args.location,
                date: new Date().toISOString().split('T')[0],
                status: 'open'
            };
            db.addLead(newLead);
            return { result: "Quote request submitted successfully! Contractors in your area will be notified." };
        }

        if (fnName === 'checkLeads') {
            const leads = db.getLeadsForPro(args.category, args.location);
            if (leads.length === 0) return { result: "No new leads found in that area right now." };
            return { result: `Found ${leads.length} leads: ${leads.map(l => `[${l.date}] ${l.userName}: ${l.description}`).join(' | ')}` };
        }

        if (fnName === 'searchContractors') {
            if (onSearch) {
                onSearch(args.term, args.category || 'All');
                return { result: `Search executed for "${args.term}". The results are now updated on the screen.` };
            }
            return { result: "Search functionality not available." };
        }

        if (fnName === 'saveContractor') {
            if (!currentUser) return { result: "Error: You must be logged in to save contractors." };
            const id = findContractorIdByName(args.contractorName);
            if (!id) return { result: `Could not find a contractor named "${args.contractorName}".` };
            if (onSave) {
                onSave(id);
                return { result: `Saved ${args.contractorName} to your dashboard.` };
            }
        }

        if (fnName === 'addReview') {
            if (!currentUser) return { result: "Error: You must be logged in to leave reviews." };
            const id = findContractorIdByName(args.contractorName);
            if (!id) return { result: `Could not find a contractor named "${args.contractorName}".` };
            if (onReview) {
                onReview(id, args.rating, args.comment);
                return { result: `Review added for ${args.contractorName}.` };
            }
        }

        if (fnName === 'claimBusiness') {
             const id = findContractorIdByName(args.contractorName);
             if (!id) return { result: `Could not find a contractor named "${args.contractorName}".` };
             if (onClaim) {
                 onClaim(id);
                 return { result: `I've opened the claim verification window for ${args.contractorName}. Please proceed there.` };
             }
        }

        if (fnName === 'calculateEstimate') {
            const rates: Record<string, number> = {
                'Plumbing': 150, 'Electrical': 100, 'Painting': 2.5, 'Roofing': 8, 'Landscaping': 1.5, 'General Contractor': 1.25
            };
            const rate = rates[args.category] || 1;
            let cost = 0;
            if (args.category === 'General Contractor') {
                cost = args.metricValue * 1.25; // markup
            } else {
                cost = args.metricValue * rate * (args.regionMultiplier || 1.0);
            }
            return { result: `Estimated cost: $${cost.toFixed(2)}.` };
        }

        if (fnName === 'openAddBusiness') {
            if (onAddBusiness) {
                onAddBusiness();
                return { result: "I've opened the 'Add Business' form for you." };
            }
            return { result: "Feature not available." };
        }

        return { result: "Unknown function called." };
    };


    const handleSend = async () => {
        if (input.trim() === '' || isLoading) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const historyText = messages.slice(-8).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

            const systemInstruction = `${SYSTEM_PROMPT}
            
            ADDITIONAL AGENT CONTEXT:
            You are the Scout Guide for TradeScout.
            You are a smart system interface designed to facilitate community actions.
            
            YOUR ROLE:
            - Manage community interactions.
            - Onboard users (Accounts, Login).
            - Facilitate business transactions (Quotes, Leads, Claims).
            - Maintain the integrity of the platform.
            
            TONE:
            - Professional, Efficient, Helpful, Neighborly.
            - "I can help you with that" rather than "I am a bot".
            - Avoid explicitly calling yourself "AI" unless asked. Refer to yourself as the "Scout Guide".
            
            CAPABILITIES:
            1. User Mgmt: Create accounts, Login.
            2. Actions: Search, Save, Review, Claim.
            3. Leads: Submit quotes, Check leads.
            4. Admin: Add businesses.
            
            Current User: ${currentUser ? `Logged in as ${currentUser.username}` : "Guest"}.
            
            Conversation History:
            ${historyText}`;

            const chat = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: { 
                    tools: [{ functionDeclarations: tools }],
                    systemInstruction: systemInstruction
                },
                history: messages.slice(0, -1).map(m => ({
                    role: m.role,
                    parts: [{ text: m.content }]
                }))
            });

            const result = await chat.sendMessage({
                parts: [{ text: input }]
            });

            const response = result.response;
            
            // Check for tool calls
            const call = response.functionCalls?.[0];
            
            if (call) {
                // Execute tool
                const toolResult = await handleToolCall(call.name, call.args);
                
                // Send tool result back to model to get final response
                const finalResult = await chat.sendMessage({
                    parts: [{
                        functionResponse: {
                            name: call.name,
                            response: toolResult
                        }
                    }]
                });
                
                setMessages(prev => [...prev, { role: 'model', content: finalResult.response.text() }]);
            } else {
                // Text response
                setMessages(prev => [...prev, { role: 'model', content: response.text() }]);
            }

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'model', content: "System Alert: Operations temporarily unavailable. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 z-50 bg-slate-800 text-white p-4 rounded-xl shadow-2xl hover:bg-slate-700 transition-all hover:scale-105 active:scale-95 group border border-slate-600 flex items-center space-x-2"
            >
                {isOpen ? <XIcon className="w-6 h-6" /> : <Cog6ToothIcon className="w-6 h-6 text-orange-500" />}
                {!isOpen && <span className="font-bold text-sm hidden md:inline">Scout Guide</span>}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-50 w-full max-w-sm md:max-w-md bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col h-[500px] animate-fade-in-up">
                    <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 flex items-center justify-between border-b border-slate-700">
                        <div className="flex items-center text-white">
                            <div className="bg-slate-700 p-1.5 rounded-lg mr-2 border border-slate-600">
                                <SparklesIcon className="w-5 h-5 text-orange-500" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">Scout Guide</h3>
                                <p className="text-xs text-slate-400 opacity-90">Community Support</p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-grow p-4 overflow-y-auto bg-slate-950 space-y-4">
                        {messages.map((m, idx) => (
                            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div 
                                    className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm border ${
                                        m.role === 'user' 
                                        ? 'bg-orange-600 text-white rounded-br-none border-orange-500' 
                                        : 'bg-slate-800 text-slate-300 border-slate-700 rounded-bl-none'
                                    }`}
                                >
                                    {m.thought && (
                                        <div className="mb-2 pb-2 border-b border-slate-700/50 text-xs font-mono opacity-80 italic text-cyan-400">
                                            {m.thought}
                                        </div>
                                    )}
                                    <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-800 rounded-2xl p-3 rounded-bl-none border border-slate-700 shadow-sm flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-75"></div>
                                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-150"></div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-3 bg-slate-900 border-t border-slate-700">
                        <div className="relative">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder="Type a command or question..."
                                rows={1}
                                className="w-full pl-4 pr-12 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:bg-slate-900 focus:border-slate-500 focus:ring-0 focus:outline-none text-white text-sm resize-none placeholder-slate-500"
                            />
                            <button 
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.89 28.89 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Chatbot;