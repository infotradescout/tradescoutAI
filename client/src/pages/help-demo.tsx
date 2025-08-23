import { memo } from 'react';

const HelpDemo = memo(function HelpDemo() {
  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-orange-400">
          Help & Support
        </h1>
        
        {/* FAQ Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              {
                question: "How do I find contractors in my area?",
                answer: "Use our Find Contractors page to search by location and trade type. All contractors are verified and rated by previous customers."
              },
              {
                question: "How accurate are the quote estimates?",
                answer: "Our quote calculator uses regional pricing data and is typically accurate within 15-20%. For exact pricing, request quotes from multiple contractors."
              },
              {
                question: "What makes TradeScout contractors different?",
                answer: "All contractors undergo verification including license checks, insurance verification, and background reviews. We also provide customer ratings and reviews."
              },
              {
                question: "How do I become a verified contractor?",
                answer: "Apply through our contractor portal. The verification process includes license validation, insurance verification, and background checks."
              }
            ].map((faq, i) => (
              <div key={i} className="bg-navy-800 p-6 rounded-lg">
                <h3 className="text-lg font-semibold mb-3 text-orange-400">{faq.question}</h3>
                <p className="text-gray-300">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact Support */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Contact Support</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-navy-800 p-6 rounded-lg text-center">
              <div className="text-3xl mb-4">📧</div>
              <h3 className="text-lg font-semibold mb-2">Email Support</h3>
              <p className="text-gray-300 mb-4">Get help via email</p>
              <a href="mailto:support@tradescout.com" className="text-orange-400 hover:text-orange-300">
                support@tradescout.com
              </a>
            </div>
            <div className="bg-navy-800 p-6 rounded-lg text-center">
              <div className="text-3xl mb-4">💬</div>
              <h3 className="text-lg font-semibold mb-2">Live Chat</h3>
              <p className="text-gray-300 mb-4">Chat with our support team</p>
              <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded transition-colors">
                Start Chat
              </button>
            </div>
            <div className="bg-navy-800 p-6 rounded-lg text-center">
              <div className="text-3xl mb-4">📚</div>
              <h3 className="text-lg font-semibold mb-2">Knowledge Base</h3>
              <p className="text-gray-300 mb-4">Browse help articles</p>
              <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded transition-colors">
                Browse Articles
              </button>
            </div>
          </div>
        </section>

        {/* Video Tutorials */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Video Tutorials</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-navy-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-orange-400">Getting Started Guide</h3>
              <div className="bg-navy-700 h-32 rounded mb-4 flex items-center justify-center">
                <span className="text-gray-400">▶ Play Video</span>
              </div>
              <p className="text-gray-300">Learn how to navigate TradeScout and find the right contractors for your project.</p>
            </div>
            <div className="bg-navy-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-orange-400">Using the Quote Calculator</h3>
              <div className="bg-navy-700 h-32 rounded mb-4 flex items-center justify-center">
                <span className="text-gray-400">▶ Play Video</span>
              </div>
              <p className="text-gray-300">Step-by-step guide to getting accurate project estimates using our calculator.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});

export default HelpDemo;