import type { User } from "@shared/schema";

interface StoryTemplate {
  id: string;
  name: string;
  category: string;
  prompts: string[];
  tone: 'professional' | 'friendly' | 'inspiring' | 'authoritative';
  length: 'short' | 'medium' | 'long';
}

interface StoryGenerationRequest {
  templateId: string;
  userInputs: Record<string, string>;
  userId?: string;
}

interface GeneratedStory {
  id: string;
  title: string;
  content: string;
  templateId: string;
  userId?: string;
  createdAt: string;
}

const narrativeTemplates: Record<string, StoryTemplate> = {
  'origin-story': {
    id: 'origin-story',
    name: 'Origin Story',
    category: 'Background',
    prompts: [
      'What inspired you to enter this field?',
      'What was your first project or job?',
      'What challenges did you overcome early on?'
    ],
    tone: 'inspiring',
    length: 'medium'
  },
  'expertise-showcase': {
    id: 'expertise-showcase',
    name: 'Expertise Showcase',
    category: 'Skills',
    prompts: [
      'What makes your approach unique?',
      'What are your core specializations?',
      'What results have you achieved?'
    ],
    tone: 'professional',
    length: 'short'
  },
  'customer-focused': {
    id: 'customer-focused',
    name: 'Customer-First Story',
    category: 'Values',
    prompts: [
      'How do you prioritize customer needs?',
      'Share a memorable customer success story',
      'What does quality service mean to you?'
    ],
    tone: 'friendly',
    length: 'medium'
  },
  'problem-solver': {
    id: 'problem-solver',
    name: 'Problem Solver',
    category: 'Approach',
    prompts: [
      'Describe a complex challenge you solved',
      'What\'s your problem-solving process?',
      'How do you handle unexpected issues?'
    ],
    tone: 'authoritative',
    length: 'long'
  },
  'innovation-leader': {
    id: 'innovation-leader',
    name: 'Innovation Leader',
    category: 'Innovation',
    prompts: [
      'What new methods or technologies do you use?',
      'How do you stay current in your field?',
      'What innovations have you implemented?'
    ],
    tone: 'inspiring',
    length: 'medium'
  },
  'community-builder': {
    id: 'community-builder',
    name: 'Community Builder',
    category: 'Impact',
    prompts: [
      'How do you contribute to your local community?',
      'What local partnerships have you built?',
      'How do you give back through your work?'
    ],
    tone: 'friendly',
    length: 'medium'
  }
};

// Sample story content for different templates and roles
const storyContent: Record<string, Record<string, string[]>> = {
  'origin-story': {
    contractor: [
      "My journey into construction began fifteen years ago when I helped my neighbor fix his leaky roof. What started as a weekend favor turned into a passion that would shape my entire career.",
      "I discovered my calling in home improvement during a summer job in college. Working alongside experienced craftsmen, I learned that every project tells a story, and I wanted to be part of writing those stories.",
      "After years in corporate America, I realized my true satisfaction came from building things with my hands. I traded my desk job for a tool belt and haven't looked back since."
    ],
    realtor: [
      "My real estate career started when I helped my sister find her first home. Seeing her joy when she got the keys made me realize I wanted to help families find their perfect place every day.",
      "Growing up in this community, I watched neighborhoods transform and families grow. Real estate became my way of being part of that growth and helping others plant roots here.",
      "After moving five times in ten years, I understood the stress and excitement of finding the right home. I became a realtor to make that process smoother for others."
    ],
    helper: [
      "I started as a helper because I believe in the power of teamwork. Every big project needs dedicated people who aren't afraid to get their hands dirty and learn something new.",
      "My journey began with odd jobs around the neighborhood. I discovered that helping others complete their projects gave me incredible satisfaction and valuable skills.",
      "As someone who loves learning new trades, being a helper lets me work with different professionals and expand my skillset while contributing to meaningful projects."
    ]
  },
  'expertise-showcase': {
    contractor: [
      "With over a decade of experience, I specialize in custom woodworking and precision craftsmanship. My attention to detail and commitment to quality has earned me recognition as a trusted local expert.",
      "I bring expertise in sustainable building practices and energy-efficient solutions. My clients save money on utilities while reducing their environmental impact.",
      "My specialization in historic home restoration combines traditional techniques with modern safety standards. I've successfully preserved the character of over 200 heritage properties."
    ],
    realtor: [
      "I leverage cutting-edge market analysis tools and neighborhood expertise to price homes competitively. My listings sell 30% faster than the market average.",
      "With certification in luxury properties and investment analysis, I help clients make informed decisions that build long-term wealth through real estate.",
      "My background in construction gives me unique insight into property conditions and renovation potential, helping buyers see the true value in every home."
    ],
    helper: [
      "I'm certified in multiple trades including plumbing, electrical basics, and carpentry. This versatility makes me a valuable team member on any project.",
      "My organizational skills and tool knowledge help job sites run efficiently. I anticipate needs and keep projects moving smoothly from start to finish.",
      "With experience in both residential and commercial projects, I adapt quickly to different work environments and safety requirements."
    ]
  },
  'customer-focused': {
    contractor: [
      "Every project starts with listening. I spend time understanding not just what my clients want, but why they want it. This approach ensures the final result exceeds their expectations.",
      "I believe in transparent communication and fair pricing. My clients always know what to expect, when to expect it, and why it matters for their home.",
      "Customer satisfaction isn't just about the finished project—it's about the entire experience. I keep job sites clean, respect schedules, and treat every home like my own."
    ],
    realtor: [
      "I understand that buying or selling a home is one of life's biggest decisions. I provide constant communication, honest market insights, and unwavering support throughout the process.",
      "My clients' needs come first, whether that means showing homes at unconventional hours or negotiating creatively to close deals. Your success is my success.",
      "I build relationships, not just transactions. Many of my clients become lifelong friends, and they trust me with their family's real estate needs for years."
    ],
    helper: [
      "I understand that homeowners are trusting us with their most valuable asset. I treat every property with respect and ensure my work contributes to their vision.",
      "Customer service means being reliable, professional, and communicative. I show up on time, work efficiently, and leave job sites better than I found them.",
      "I take pride in the small details that make customers happy—protecting their furniture, cleaning up thoroughly, and answering their questions with patience."
    ]
  }
};

export class StoryGenerationService {
  static async generateStory(request: StoryGenerationRequest): Promise<GeneratedStory> {
    const template = narrativeTemplates[request.templateId];
    if (!template) {
      throw new Error(`Template not found: ${request.templateId}`);
    }

    const userRole = request.userInputs.role || 'contractor';
    const storyOptions = storyContent[request.templateId]?.[userRole] || storyContent[request.templateId]?.['contractor'] || [];
    
    // Select a random story variation or create a basic one
    let content = '';
    if (storyOptions.length > 0) {
      content = storyOptions[Math.floor(Math.random() * storyOptions.length)];
    } else {
      content = this.generateBasicStory(template, request.userInputs);
    }

    // Personalize the content with user inputs
    content = this.personalizeContent(content, request.userInputs);

    const story: GeneratedStory = {
      id: `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: template.name,
      content,
      templateId: request.templateId,
      userId: request.userId,
      createdAt: new Date().toISOString()
    };

    return story;
  }

  private static generateBasicStory(template: StoryTemplate, userInputs: Record<string, string>): string {
    const role = userInputs.role || 'professional';
    const experience = userInputs.experience || 'several years';
    const specialty = userInputs.specialty || 'quality work';
    const location = userInputs.location || 'the local area';

    switch (template.id) {
      case 'origin-story':
        return `My journey as a ${role} began ${experience} ago when I discovered my passion for ${specialty}. Working in ${location}, I've learned that every project is an opportunity to make a positive impact in someone's life.`;
      
      case 'expertise-showcase':
        return `With ${experience} of experience as a ${role}, I specialize in ${specialty}. My commitment to excellence and attention to detail has made me a trusted professional in ${location}.`;
      
      case 'customer-focused':
        return `As a ${role}, I believe that exceptional customer service starts with listening. My clients in ${location} know they can count on me for ${specialty} and honest, reliable service.`;
      
      case 'problem-solver':
        return `In my ${experience} as a ${role}, I've learned that every challenge is an opportunity. I approach ${specialty} with analytical thinking and creative solutions that work for ${location} clients.`;
      
      case 'innovation-leader':
        return `Staying current with industry innovations is essential for any ${role}. I continuously invest in learning new techniques for ${specialty} to serve ${location} better.`;
      
      case 'community-builder':
        return `Being a ${role} in ${location} means being part of the community. I'm committed to giving back through ${specialty} and building lasting relationships with my neighbors.`;
      
      default:
        return `As a dedicated ${role} with ${experience} of experience, I'm passionate about ${specialty} and proud to serve ${location} with integrity and excellence.`;
    }
  }

  private static personalizeContent(content: string, userInputs: Record<string, string>): string {
    let personalizedContent = content;

    // Replace common placeholders with user inputs
    const replacements: Record<string, string> = {
      '[ROLE]': userInputs.role || 'professional',
      '[EXPERIENCE]': userInputs.experience || 'several years',
      '[SPECIALTY]': userInputs.specialty || 'quality work',
      '[LOCATION]': userInputs.location || 'the local area',
      '[COMPANY]': userInputs.company || 'my business',
      '[NAME]': userInputs.name || ''
    };

    Object.entries(replacements).forEach(([placeholder, replacement]) => {
      personalizedContent = personalizedContent.replace(new RegExp(placeholder, 'g'), replacement);
    });

    return personalizedContent;
  }

  static getTemplates(): StoryTemplate[] {
    return Object.values(narrativeTemplates);
  }

  static getTemplate(templateId: string): StoryTemplate | null {
    return narrativeTemplates[templateId] || null;
  }
}