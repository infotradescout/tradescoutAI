/**
 * Extract FAQ and help content for caching
 */
export async function extractFAQ() {
  // Static FAQ content - can be expanded
  const faqData = [
    {
      id: "faq-1",
      category: "Getting Started",
      question: "How do I find contractors?",
      answer:
        "Use the Find Contractors page to search by trade, location, and verification status. Filter results to see verified professionals in your area.",
    },
    {
      id: "faq-2",
      category: "Getting Started",
      question: "How do I post a job?",
      answer:
        "Navigate to the Contractor Board and click 'Post a Job'. Provide details about your project, location, and budget. Contractors will bid on your job.",
    },
    {
      id: "faq-3",
      category: "Marketplace",
      question: "How do I list an item for sale?",
      answer:
        "Go to the Marketplace section and click 'List Item'. Upload photos, add a description, set your price, and choose your listing type (fixed, negotiable, auction, or best offer).",
    },
    {
      id: "faq-4",
      category: "Marketplace",
      question: "Can I ship items?",
      answer:
        "Yes! When listing an item, you can indicate if you'll ship. You can set a fixed shipping cost or use carrier rates.",
    },
    {
      id: "faq-5",
      category: "Verification",
      question: "How do I verify my contractor business?",
      answer:
        "Go to your Business Listing and click 'Get Verified'. Upload required documents (license, insurance, etc.). Our team will review and verify within 2-3 business days.",
    },
    {
      id: "faq-6",
      category: "Account",
      question: "How do I update my profile?",
      answer: "Visit your Profile page and click 'Edit Profile'. You can update your personal info, add a photo, and manage your account settings.",
    },
    {
      id: "faq-7",
      category: "Community",
      question: "What are community groups?",
      answer:
        "Community groups let you connect with neighbors, join local discussions, and participate in county-specific conversations. Each county has its own auto-generated group.",
    },
    {
      id: "faq-8",
      category: "Support",
      question: "How do I contact support?",
      answer:
        "Use the Help page to contact our support team, or click the bug report tool at the bottom of any page to report issues directly.",
    },
  ];

  return faqData;
}
