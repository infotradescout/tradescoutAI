
import React, { useState, useEffect } from 'react';
import { User, ForumPost, ForumComment, Category } from '../types';
import * as db from '../services/db';
import { ChatBubbleLeftRightIcon, HandThumbUpIcon, UserCircleIcon, PlusCircleIcon, SparklesIcon, CheckBadgeIcon, TrashIcon, Heart, MapPin } from './Icons';

async function callGemini(prompt: string): Promise<string> {
    const res = await fetch("/api/ai/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt }),
    });

    if (!res.ok) throw new Error(`Gemini request failed: ${res.status}`);
    const data = (await res.json()) as { text?: string };
    return typeof data.text === "string" ? data.text : "";
}

interface CommunityForumProps {
    currentUser: User | null;
    onLoginClick: () => void;
}

interface FeedPost extends ForumPost {
    isFromFollowing?: boolean;
    isRelatedContent?: boolean;
}

const CommunityForum: React.FC<CommunityForumProps> = ({ currentUser, onLoginClick }) => {
    const [posts, setPosts] = useState<FeedPost[]>([]);
    const [feedType, setFeedType] = useState<'for-you' | 'following'>('for-you');
    const [isCreating, setIsCreating] = useState(false);
    
    // New Post State
    const [newContent, setNewContent] = useState('');

    useEffect(() => {
        loadFeed();
    }, [feedType]);

    const loadFeed = () => {
        const allPosts = db.getForumPosts() as FeedPost[];
        
        let filtered = allPosts;
        if (feedType === 'for-you') {
            // Mix of following + related content from US
            filtered = allPosts.map(post => ({
                ...post,
                isFromFollowing: Math.random() > 0.5,
                isRelatedContent: Math.random() > 0.6
            }));
        } else {
            // Only from users being followed
            filtered = allPosts.map(post => ({
                ...post,
                isFromFollowing: true
            }));
        }
        
        setPosts(filtered);
    };

    const handleCreatePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        const newPost: FeedPost = {
            id: `post-${Date.now()}`,
            userId: currentUser.id,
            username: currentUser.username,
            userRole: currentUser.role || 'homeowner',
            title: '',
            content: newContent,
            category: Category.GENERAL,
            date: new Date().toISOString().split('T')[0],
            upvotes: 0,
            views: 0,
            comments: [],
            isFromFollowing: true
        };

        db.addForumPost(newPost);
        loadFeed();
        setIsCreating(false);
        setNewContent('');

        // TRIGGER AI AUTO-RESPONSE
        try {
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

            const aiComment: ForumComment = {
                id: `c-ai-${Date.now()}`,
                postId: newPost.id,
                userId: 'ai',
                username: 'Scout Guide',
                userRole: 'ai',
                content: (await callGemini(prompt)).trim(),
                date: new Date().toISOString().split('T')[0],
                upvotes: 0
            };

            db.addForumComment(newPost.id, aiComment);
            loadFeed(); // Refresh

        } catch (e) {
            console.error("Auto-reply failed", e);
        }
    };

    const handleLike = (postId: string) => {
        db.togglePostUpvote(postId);
        loadFeed();
    };

    const handleDeletePost = (postId: string) => {
        if(confirm("Are you sure you want to delete this post?")) {
            db.deleteForumPost(postId);
            loadFeed();
        }
    };

    const filteredPosts = feedType === 'following'
        ? posts.filter(p => p.isFromFollowing)
        : posts;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-charcoal-800 p-6 rounded-lg">
                <div>
                    <h1 className="text-3xl font-extrabold text-white">Social Feed</h1>
                    <p className="text-charcoal-400 mt-1">See what's happening in your community and across the country.</p>
                </div>
            </div>

            {/* Feed Type Toggle */}
            <div className="flex gap-2 bg-charcoal-800 p-2 rounded-lg">
                <button 
                    onClick={() => setFeedType('for-you')}
                    className={`flex-1 py-2 px-4 rounded-md font-semibold transition-colors ${feedType === 'for-you' ? 'bg-orange-600 text-white' : 'text-charcoal-300 hover:text-white'}`}
                >
                    For You
                </button>
                <button 
                    onClick={() => setFeedType('following')}
                    className={`flex-1 py-2 px-4 rounded-md font-semibold transition-colors ${feedType === 'following' ? 'bg-orange-600 text-white' : 'text-charcoal-300 hover:text-white'}`}
                >
                    Following
                </button>
            </div>

            {/* Create Post */}
            <div className="bg-charcoal-800 p-4 rounded-lg">
                <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-charcoal-700 flex items-center justify-center flex-shrink-0">
                        <UserCircleIcon className="w-6 h-6 text-charcoal-400" />
                    </div>
                    <div className="flex-1">
                        {!isCreating && (
                            <button 
                                onClick={() => currentUser ? setIsCreating(true) : onLoginClick()}
                                className="w-full text-left bg-charcoal-700 text-charcoal-400 p-3 rounded-lg hover:bg-charcoal-600 transition-colors"
                            >
                                What's happening in your area?
                            </button>
                        )}
                        {isCreating && (
                            <form onSubmit={handleCreatePost} className="space-y-3">
                                <textarea 
                                    value={newContent}
                                    onChange={e => setNewContent(e.target.value)}
                                    className="w-full rounded-lg p-3 focus:ring-2 focus:ring-orange-500 h-24 bg-charcoal-700 text-white border-none resize-none"
                                    placeholder="Share what's happening in your community..."
                                    required
                                    autoFocus
                                />
                                <div className="flex gap-2 justify-end">
                                    <button 
                                        type="button"
                                        onClick={() => { setIsCreating(false); setNewContent(''); }}
                                        className="px-4 py-2 text-charcoal-300 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="px-6 py-2 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors"
                                    >
                                        Post
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>

            {/* Feed */}
            <div className="space-y-4">
                {filteredPosts.length === 0 ? (
                    <div className="text-center py-12 text-charcoal-400">
                        <p>No posts yet. {feedType === 'following' && 'Follow people to see their posts.'}</p>
                    </div>
                ) : (
                    filteredPosts.map(post => (
                        <div key={post.id} className="bg-charcoal-800 rounded-lg p-5 hover:bg-charcoal-750 transition-colors relative group">
                            
                            {/* ADMIN DELETE BUTTON */}
                            {currentUser?.isAdmin && (
                                <button 
                                    onClick={() => handleDeletePost(post.id)}
                                    className="absolute top-4 right-4 text-charcoal-400 hover:text-red-400 p-1.5 rounded transition-all opacity-0 group-hover:opacity-100"
                                    title="Admin: Delete Post"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            )}

                            {/* Header */}
                            <div className="flex items-start gap-3 mb-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${post.userRole === 'contractor' ? 'bg-orange-500/20 text-orange-400' : 'bg-charcoal-700 text-charcoal-400'}`}>
                                    <UserCircleIcon className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-white text-sm">{post.username}</p>
                                        {post.userRole === 'contractor' && (
                                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
                                                Pro
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-charcoal-500 mt-0.5">
                                        <span>{post.date}</span>
                                        {post.isRelatedContent && <span className="text-orange-400">• Trending</span>}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Content */}
                            <p className="text-charcoal-200 leading-relaxed mb-4">{post.content}</p>

                            {/* Actions */}
                            <div className="flex items-center gap-6 border-t border-charcoal-700 pt-3 text-charcoal-400 text-sm">
                                <button onClick={() => handleLike(post.id)} className="flex items-center gap-1.5 hover:text-orange-400 transition-colors group/btn">
                                    <Heart className="w-5 h-5 group-hover/btn:fill-orange-400" />
                                    <span className="font-semibold text-xs">{post.upvotes}</span>
                                </button>
                                <button className="flex items-center gap-1.5 hover:text-orange-400 transition-colors">
                                    <ChatBubbleLeftRightIcon className="w-5 h-5" />
                                    <span className="font-semibold text-xs">{post.comments.length}</span>
                                </button>
                            </div>

                            {/* Comments Preview */}
                            {post.comments.length > 0 && (
                                <div className="mt-4 pt-4 space-y-3 border-t border-charcoal-700">
                                    {post.comments.slice(0, 2).map(comment => (
                                        <div key={comment.id} className="flex gap-3 text-sm">
                                            <div className="flex-shrink-0 mt-0.5">
                                                {comment.userRole === 'ai' ? (
                                                    <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-full p-1 text-white">
                                                        <SparklesIcon className="w-4 h-4" />
                                                    </div>
                                                ) : (
                                                    <UserCircleIcon className="w-5 h-5 text-charcoal-500" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-bold text-xs ${comment.userRole === 'ai' ? 'text-orange-400' : 'text-charcoal-300'}`}>
                                                        {comment.username}
                                                    </span>
                                                    {comment.userRole === 'ai' && <span className="text-[9px] bg-orange-900/40 text-orange-300 px-1.5 rounded">Scout</span>}
                                                </div>
                                                <p className="text-charcoal-400 mt-1">{comment.content}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {post.comments.length > 2 && (
                                        <button className="text-xs text-orange-400 hover:text-orange-300 font-semibold mt-2">
                                            View all {post.comments.length} comments
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default CommunityForum;
