
import React, { useState } from 'react';
import { User, Review } from '../types';
import { StarIcon } from './Icons';

interface ReviewFormProps {
    contractorId: string;
    currentUser: User;
    onAddReview: (contractorId: string, review: Omit<Review, 'id' | 'date' >) => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ contractorId, currentUser, onAddReview }) => {
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (rating > 0 && comment.trim() !== '' && currentUser) {
            onAddReview(contractorId, {
                userId: currentUser.id,
                rating,
                comment,
            });
            setRating(0);
            setComment('');
        }
    };

    return (
        <div>
            <h5 className="text-md font-semibold text-slate-700 mb-2">Leave a Review</h5>
            <form onSubmit={handleSubmit} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                <div className="flex items-center mb-3">
                    <span className="text-sm font-medium mr-3">Your Rating:</span>
                    <div className="flex">
                        {[...Array(5)].map((_, index) => {
                            const starValue = index + 1;
                            return (
                                <StarIcon
                                    key={starValue}
                                    onClick={() => setRating(starValue)}
                                    onMouseEnter={() => setHoverRating(starValue)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    className={`w-6 h-6 cursor-pointer transition-colors ${starValue <= (hoverRating || rating) ? 'text-yellow-400' : 'text-slate-300'}`}
                                />
                            );
                        })}
                    </div>
                </div>
                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your experience..."
                    rows={3}
                    className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800"
                    required
                />
                <button type="submit" className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 disabled:bg-indigo-300"
                disabled={!rating || !comment.trim()}>
                    Submit Review
                </button>
            </form>
        </div>
    )
};

export default ReviewForm;
