import React from "react";

interface ChatbotProps {
  currentUser: any;
  onLogin: (username: string) => boolean;
  onSignup: (username: string, bio: string) => boolean;
  onSearch?: (term: string, category: string) => void;
  onSave?: (contractorId: string) => void;
  onReview?: (contractorId: string, rating: number, comment: string) => boolean;
  onClaim?: (contractorId: string) => void;
  onAddBusiness?: () => void;
}

/**
 * Archived/legacy chatbot UI.
 *
 * Security note:
 * - This component intentionally does not call LLM providers directly.
 * - If reintroduced, route any AI calls through server endpoints so API keys are never shipped to clients.
 */
const Chatbot: React.FC<ChatbotProps> = () => {
  return null;
};

export default Chatbot;

