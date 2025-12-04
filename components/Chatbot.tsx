
import React, { useState, useRef, useEffect } from 'react';
import { ChatBubbleOvalLeftEllipsisIcon, XIcon } from './Icons';
import { GoogleGenAI } from '@google/genai';

interface Message {
    role: 'user' | 'model';
    content: string;
}

const Chatbot: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', content: 'Hi there! I\'m your Home Improvement Helper. Ask me anything about renovation or repair projects!' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if (input.trim() === '' || isLoading) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const prompt = `You are a helpful and friendly "Home Improvement Helper" chatbot. Provide general advice, tips, and explanations about home renovation and repair projects. Do not recommend specific contractors or products. Keep your answers concise and easy to understand for a homeowner. User question: ${input}`;
            
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            
            const modelMessage: Message = { role: 'model', content: response.text };
            setMessages(prev => [...prev, modelMessage]);

        } catch (error) {
            console.error("Chatbot error:", error);
            const errorMessage: Message = { role: 'model', content: "Sorry, I'm having trouble connecting right now. Please try again later." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className={`fixed bottom-5 right-5 z-40 transition-transform duration-300 ${isOpen ? 'transform scale-0' : 'transform scale-100'}`}>
                <button 
                    onClick={() => setIsOpen(true)} 
                    className="bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    aria-label="Open Home Improvement Helper Chatbot"
                >
                    <ChatBubbleOvalLeftEllipsisIcon className="w-8 h-8" />
                </button>
            </div>

            <div className={`fixed bottom-5 right-5 z-50 w-[calc(100%-2.5rem)] max-w-sm h-[70vh] bg-white rounded-xl shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'transform translate-y-0 opacity-100' : 'transform translate-y-10 opacity-0 pointer-events-none'}`}>
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-200 flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Home Improvement Helper</h3>
                        <p className="text-sm text-slate-500">Powered by AI</p>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-800">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
                
                {/* Messages */}
                <div className="flex-grow p-4 overflow-y-auto bg-slate-50">
                    <div className="space-y-4">
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-800'}`}>
                                    <p className="text-sm" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br />') }}></p>
                                </div>
                            </div>
                        ))}
                         {isLoading && (
                            <div className="flex justify-start">
                                <div className="max-w-[80%] p-3 rounded-2xl bg-slate-200 text-slate-800">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input */}
                <div className="p-4 border-t border-slate-200 flex-shrink-0">
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Ask a question..."
                            className="flex-grow border border-slate-300 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800"
                            disabled={isLoading}
                        />
                        <button onClick={handleSend} disabled={isLoading || !input.trim()} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-full disabled:bg-indigo-300">
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Chatbot;
