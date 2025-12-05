
import React, { useState, useEffect } from 'react';
import { User, ForumPost, ForumComment, Category } from '../types';
import * as db from '../services/db';
import { ChatBubbleLeftRightIcon, HandThumbUpIcon, UserCircleIcon, PlusCircleIcon, SparklesIcon, CheckBadgeIcon, TrashIcon } from './Icons';
import { GoogleGenAI } from '@google/genai';

interface CommunityForumProps {
    currentUser: User | null;
    onLoginClick: () => void;
}

const CommunityForum: React.FC<CommunityForumProps> = ({ currentUser, onLoginClick }) => {
    const [posts, setPosts] = useState<ForumPost[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [filterCategory, setFilterCategory] = useState<string>('All');
    
    // New Post State
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newCategory, setNewCategory] = useState<string>(Category.GENERAL);

    useEffect(() => {
        setPosts(db.getForumPosts());
    }, []);

    const handleCreatePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        const newPost: ForumPost = {
            id: `post-${Date.now()}`,
            userId: currentUser.id,
            username: currentUser.username,
            userRole: currentUser.role || 'homeowner',
            title: newTitle,
            content: newContent,
            category: newCategory,
            date: new Date().toISOString().split('T')[0],
            upvotes: 0,
            views: 0,
            comments: []
        };

        db.addForumPost(newPost);
        setPosts(db.getForumPosts());
        setIsCreating(false);
        setNewTitle('');
        setNewContent('');

        // TRIGGER AI AUTO-RESPONSE
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            
            // Fetch local context (simplified for demo, assuming generic location or extraction)
            const localContext = db.getLocalTradeData('national'); 
            
            const prompt = `
                You are Community Scout's smart guide, a helpful community assistant.
                A user just posted:
                Title: "${newPost.title}"
                Content: "${newPost.content}"
                Category: "${newPost.category}"

                Context: National Trade Data: ${JSON.stringify(localContext)}

                Generate a helpful, neighborly "First Response" comment.
                If it's about permits/codes, use the context.
                If it's opinion based, suggest asking a pro.
                Keep it under 200 characters.
            `;

            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            
            const aiComment: ForumComment = {
                id: `c-ai-${Date.now()}`,
                postId: newPost.id,
                userId: 'ai',
                username: 'Scout Guide',
                userRole: 'ai',
                content: response.text.trim(),
                date: new Date().toISOString().split('T')[0],
                upvotes: 0
            };

            db.addForumComment(newPost.id, aiComment);
            setPosts(db.getForumPosts()); // Refresh

        } catch (e) {
            console.error("Auto-reply failed", e);
        }
    };

    const handleUpvote = (postId: string) => {
        db.togglePostUpvote(postId);
        setPosts(db.getForumPosts());
    };

    const handleDeletePost = (postId: string) => {
        if(confirm("Are you sure you want to delete this post?")) {
            db.deleteForumPost(postId);
            setPosts(db.getForumPosts());
        }
    };

    const filteredPosts = filterCategory === 'All' 
        ? posts 
        : posts.filter(p => p.category === filterCategory);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-700">
                <div>
                    <h1 className="text-3xl font-extrabold text-white">Neighborhood Talk</h1>
                    <p className="text-slate-400 mt-1">Ask neighbors, share advice, and get answers from local pros.</p>
                </div>
                <button 
                    onClick={() => currentUser ? setIsCreating(!isCreating) : onLoginClick()}
                    className="bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-md hover:bg-orange-700 hover:-translate-y-0.5 transition-all flex items-center"
                >
                    <PlusCircleIcon className="w-5 h-5 mr-2" />
                    {isCreating ? 'Cancel' : 'Start Discussion'}
                </button>
            </div>

            {isCreating && (
                <div className="bg-slate-800 p-6 rounded-2xl shadow-md border border-slate-700 animate-fade-in-up">
                    <h3 className="font-bold text-lg text-white mb-4">Create a New Post</h3>
                    <form onSubmit={handleCreatePost} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
                            <input 
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                                className="w-full border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 bg-slate-900 text-white"
                                placeholder="e.g. Has anyone used ABC Plumbing?"
                                required
                            />
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                             <select 
                                value={newCategory}
                                onChange={e => setNewCategory(e.target.value)}
                                className="w-full border border-slate-600 rounded-lg p-3 bg-slate-900 text-white"
                             >
                                 {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                             </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Details</label>
                            <textarea 
                                value={newContent}
                                onChange={e => setNewContent(e.target.value)}
                                className="w-full border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 h-32 bg-slate-900 text-white"
                                placeholder="Share more details about your question..."
                                required
                            />
                        </div>
                        <button type="submit" className="w-full bg-orange-600 text-white font-bold py-3 rounded-xl hover:bg-orange-700">
                            Post to Neighborhood
                        </button>
                    </form>
                </div>
            )}

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                <button 
                    onClick={() => setFilterCategory('All')}
                    className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filterCategory === 'All' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'}`}
                >
                    All Posts
                </button>
                {Object.values(Category).map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setFilterCategory(cat)}
                        className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filterCategory === cat ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Feed */}
            <div className="space-y-4">
                {filteredPosts.map(post => (
                    <div key={post.id} className="bg-slate-800 rounded-xl border border-slate-700 shadow-sm p-6 hover:border-slate-600 transition-colors relative group">
                        
                        {/* ADMIN DELETE BUTTON */}
                        {currentUser?.isAdmin && (
                            <button 
                                onClick={() => handleDeletePost(post.id)}
                                className="absolute top-4 right-4 text-red-400/50 hover:text-red-400 hover:bg-red-900/30 p-2 rounded-lg transition-all"
                                title="Admin: Delete Post"
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        )}

                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center space-x-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${post.userRole === 'contractor' ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-800' : 'bg-slate-700 text-slate-400'}`}>
                                    <UserCircleIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-white text-sm">{post.username}</p>
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${post.userRole === 'contractor' ? 'bg-cyan-900/30 text-cyan-400' : 'bg-slate-700 text-slate-400'}`}>
                                            {post.userRole}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500">{post.date} • {post.location || 'Local'}</p>
                                </div>
                            </div>
                            <span className="text-xs font-bold text-orange-400 bg-slate-900 px-2 py-1 rounded-lg border border-slate-700 mr-8">
                                {post.category}
                            </span>
                        </div>
                        
                        <h3 className="text-xl font-bold text-white mb-2">{post.title}</h3>
                        <p className="text-slate-400 leading-relaxed mb-4">{post.content}</p>

                        <div className="flex items-center gap-6 border-t border-slate-700 pt-4">
                            <button onClick={() => handleUpvote(post.id)} className="flex items-center text-slate-500 hover:text-orange-400 transition-colors">
                                <HandThumbUpIcon className="w-5 h-5 mr-1.5" />
                                <span className="font-bold text-sm">{post.upvotes}</span>
                            </button>
                            <div className="flex items-center text-slate-500">
                                <ChatBubbleLeftRightIcon className="w-5 h-5 mr-1.5" />
                                <span className="font-bold text-sm">{post.comments.length} Comments</span>
                            </div>
                        </div>

                        {/* Comments Preview */}
                        {post.comments.length > 0 && (
                            <div className="mt-4 bg-slate-900/50 rounded-xl p-4 space-y-3 border border-slate-700">
                                {post.comments.map(comment => (
                                    <div key={comment.id} className={`flex gap-3 text-sm ${comment.userRole === 'ai' ? 'bg-slate-800 p-3 rounded-lg border border-slate-600 shadow-sm' : ''}`}>
                                        <div className="flex-shrink-0 mt-1">
                                            {comment.userRole === 'ai' ? (
                                                <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-full p-1 text-white">
                                                    <SparklesIcon className="w-4 h-4" />
                                                </div>
                                            ) : (
                                                <UserCircleIcon className="w-6 h-6 text-slate-500" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold ${comment.userRole === 'ai' ? 'text-orange-400' : 'text-slate-300'}`}>
                                                    {comment.username}
                                                </span>
                                                {comment.userRole === 'ai' && <span className="text-[10px] bg-orange-900/40 text-orange-300 px-1.5 rounded border border-orange-500/30">Scout Guide</span>}
                                            </div>
                                            <p className="text-slate-400 mt-1">{comment.content}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CommunityForum;
