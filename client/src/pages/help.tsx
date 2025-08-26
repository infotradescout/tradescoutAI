import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  HelpCircle, 
  MessageCircle, 
  Phone, 
  Mail, 
  FileText, 
  Video,
  Search,
  Clock,
  Users,
  BookOpen,
  Home,
  Briefcase,
  Wrench,
  Star,
  Building,
  Car,
  Shield,
  DollarSign,
  Settings,
  Award,
  Globe,
  UserCheck,
  TrendingUp,
  Hammer,
  Calculator,
  Calendar,
  MapPin,
  HeartHandshake,
  Clipboard,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  Target,
  Crown
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { userRoleEnum } from "@shared/schema";

type UserRole = typeof userRoleEnum.enumValues[number];

interface HelpArticle {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: React.ElementType;
  priority: 'high' | 'medium' | 'low';
  readTime: string;
}

interface RoleConfig {
  name: string;
  color: string;
  icon: React.ElementType;
  description: string;
  quickActions: Array<{
    title: string;
    description: string;
    icon: React.ElementType;
    action: string;
  }>;
  categories: Array<{
    title: string;
    icon: React.ElementType;
    articles: HelpArticle[];
  }>;
}

export default function Help() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Role-specific help configurations
  const roleConfigs: Record<UserRole, RoleConfig> = {
    homeowner: {
      name: "Homeowner",
      color: "bg-blue-600",
      icon: Home,
      description: "Get help with finding contractors, managing projects, and home improvement guidance",
      quickActions: [
        {
          title: "Find Contractors",
          description: "Search for verified contractors near you",
          icon: Search,
          action: "/contractors/board"
        },
        {
          title: "Get Quote",
          description: "Calculate project costs instantly",
          icon: Calculator,
          action: "/quote"
        },
        {
          title: "Project Help",
          description: "Chat with our support team",
          icon: MessageCircle,
          action: "chat"
        },
        {
          title: "Safety Tips",
          description: "Learn about contractor vetting",
          icon: Shield,
          action: "safety"
        }
      ],
      categories: [
        {
          title: "Getting Started",
          icon: BookOpen,
          articles: [
            {
              id: "setup-profile",
              title: "Setting Up Your Homeowner Profile",
              description: "Complete your profile to attract quality contractors",
              category: "Getting Started",
              icon: UserCheck,
              priority: "high",
              readTime: "3 min"
            },
            {
              id: "find-contractors",
              title: "How to Find Reliable Contractors",
              description: "Search, filter, and vet contractors in your area",
              category: "Getting Started",
              icon: Search,
              priority: "high",
              readTime: "5 min"
            },
            {
              id: "request-quotes",
              title: "Requesting and Comparing Quotes",
              description: "Get accurate quotes and compare contractor proposals",
              category: "Getting Started",
              icon: Calculator,
              priority: "high",
              readTime: "4 min"
            }
          ]
        },
        {
          title: "Project Management",
          icon: Clipboard,
          articles: [
            {
              id: "project-timeline",
              title: "Understanding Project Timelines",
              description: "Set realistic expectations for your home projects",
              category: "Project Management",
              icon: Clock,
              priority: "medium",
              readTime: "6 min"
            },
            {
              id: "material-lists",
              title: "Managing Material Lists",
              description: "Collaborate with contractors on materials and costs",
              category: "Project Management",
              icon: Clipboard,
              priority: "medium",
              readTime: "4 min"
            }
          ]
        },
        {
          title: "Safety & Quality",
          icon: Shield,
          articles: [
            {
              id: "contractor-verification",
              title: "Contractor Verification Process",
              description: "How we verify contractor credentials and insurance",
              category: "Safety & Quality",
              icon: CheckCircle,
              priority: "high",
              readTime: "3 min"
            },
            {
              id: "red-flags",
              title: "Red Flags to Watch For",
              description: "Warning signs of unreliable contractors",
              category: "Safety & Quality",
              icon: AlertCircle,
              priority: "high",
              readTime: "5 min"
            }
          ]
        }
      ]
    },

    contractor_user: {
      name: "Contractor",
      color: "bg-orange-600",
      icon: Hammer,
      description: "Grow your business with connection generation, reputation management, and business tools",
      quickActions: [
        {
          title: "Get More Connections",
          description: "Optimize your profile for more projects",
          icon: TrendingUp,
          action: "leads"
        },
        {
          title: "Growth Pack",
          description: "Access premium connection generation tools",
          icon: Star,
          action: "/growth-pack"
        },
        {
          title: "Accelerator Program",
          description: "Join our premium contractor network",
          icon: Award,
          action: "/accelerator"
        },
        {
          title: "Business Support",
          description: "Get help with proposals and pricing",
          icon: MessageCircle,
          action: "chat"
        }
      ],
      categories: [
        {
          title: "Business Growth",
          icon: TrendingUp,
          articles: [
            {
              id: "profile-optimization",
              title: "Optimizing Your Contractor Profile",
              description: "Increase visibility and attract more quality connections",
              category: "Business Growth",
              icon: Star,
              priority: "high",
              readTime: "7 min"
            },
            {
              id: "winning-proposals",
              title: "Creating Winning Proposals",
              description: "Write proposals that convert leads to projects",
              category: "Business Growth",
              icon: Target,
              priority: "high",
              readTime: "10 min"
            },
            {
              id: "pricing-strategies",
              title: "Competitive Pricing Strategies",
              description: "Price your services to win more jobs profitably",
              category: "Business Growth",
              icon: DollarSign,
              priority: "high",
              readTime: "8 min"
            }
          ]
        },
        {
          title: "Lead Management",
          icon: Users,
          articles: [
            {
              id: "lead-generation",
              title: "Maximizing Lead Generation",
              description: "Use TradeScout tools to get more quality leads",
              category: "Lead Management",
              icon: TrendingUp,
              priority: "high",
              readTime: "6 min"
            },
            {
              id: "response-time",
              title: "Optimizing Response Times",
              description: "Respond quickly to win more projects",
              category: "Lead Management",
              icon: Clock,
              priority: "medium",
              readTime: "4 min"
            }
          ]
        },
        {
          title: "Reputation & Reviews",
          icon: Star,
          articles: [
            {
              id: "reputation-management",
              title: "Building Your Online Reputation",
              description: "Get positive reviews and handle feedback professionally",
              category: "Reputation & Reviews",
              icon: Star,
              priority: "high",
              readTime: "8 min"
            },
            {
              id: "customer-communication",
              title: "Effective Customer Communication",
              description: "Build trust and exceed customer expectations",
              category: "Reputation & Reviews",
              icon: MessageCircle,
              priority: "medium",
              readTime: "6 min"
            }
          ]
        }
      ]
    },

    helper: {
      name: "Helper",
      color: "bg-green-600",
      icon: HeartHandshake,
      description: "Find work opportunities, build your reputation, and grow your helper business",
      quickActions: [
        {
          title: "Find Tasks",
          description: "Browse available tasks and jobs",
          icon: Search,
          action: "/helpers"
        },
        {
          title: "Helper Dashboard",
          description: "Manage your applications and earnings",
          icon: Briefcase,
          action: "/helper-dashboard"
        },
        {
          title: "Verification",
          description: "Complete your ID and background verification",
          icon: Shield,
          action: "verification"
        },
        {
          title: "Skill Development",
          description: "Learn new skills to increase earnings",
          icon: Lightbulb,
          action: "skills"
        }
      ],
      categories: [
        {
          title: "Getting Started",
          icon: BookOpen,
          articles: [
            {
              id: "helper-signup",
              title: "Becoming a Verified Helper",
              description: "Complete your profile and verification process",
              category: "Getting Started",
              icon: UserCheck,
              priority: "high",
              readTime: "5 min"
            },
            {
              id: "first-task",
              title: "Landing Your First Task",
              description: "Tips for finding and securing your first job",
              category: "Getting Started",
              icon: Target,
              priority: "high",
              readTime: "6 min"
            },
            {
              id: "helper-safety",
              title: "Helper Safety Guidelines",
              description: "Stay safe while working with clients",
              category: "Getting Started",
              icon: Shield,
              priority: "high",
              readTime: "4 min"
            }
          ]
        },
        {
          title: "Finding Work",
          icon: Search,
          articles: [
            {
              id: "task-application",
              title: "How to Apply for Tasks",
              description: "Write compelling applications that get you hired",
              category: "Finding Work",
              icon: FileText,
              priority: "high",
              readTime: "7 min"
            },
            {
              id: "rate-setting",
              title: "Setting Your Hourly Rates",
              description: "Price your services competitively",
              category: "Finding Work",
              icon: DollarSign,
              priority: "medium",
              readTime: "5 min"
            }
          ]
        },
        {
          title: "Building Reputation",
          icon: Star,
          articles: [
            {
              id: "quality-work",
              title: "Delivering Quality Work",
              description: "Exceed client expectations and earn great reviews",
              category: "Building Reputation",
              icon: Star,
              priority: "high",
              readTime: "6 min"
            },
            {
              id: "professional-communication",
              title: "Professional Communication",
              description: "Communicate effectively with clients and contractors",
              category: "Building Reputation",
              icon: MessageCircle,
              priority: "medium",
              readTime: "4 min"
            }
          ]
        }
      ]
    },

    accelerator_member: {
      name: "Accelerator Member",
      color: "bg-purple-600",
      icon: Crown,
      description: "Premium features, priority leads, and advanced business growth tools",
      quickActions: [
        {
          title: "Priority Leads",
          description: "Access exclusive high-value leads",
          icon: Crown,
          action: "priority-leads"
        },
        {
          title: "Business Analytics",
          description: "View detailed performance metrics",
          icon: TrendingUp,
          action: "/dashboard"
        },
        {
          title: "Elite Network",
          description: "Connect with other accelerator members",
          icon: Users,
          action: "network"
        },
        {
          title: "Dedicated Support",
          description: "Get priority customer support",
          icon: MessageCircle,
          action: "chat"
        }
      ],
      categories: [
        {
          title: "Premium Features",
          icon: Crown,
          articles: [
            {
              id: "accelerator-benefits",
              title: "Maximizing Accelerator Benefits",
              description: "Get the most value from your premium membership",
              category: "Premium Features",
              icon: Star,
              priority: "high",
              readTime: "8 min"
            },
            {
              id: "priority-leads",
              title: "Understanding Priority Leads",
              description: "How priority lead distribution works",
              category: "Premium Features",
              icon: Crown,
              priority: "high",
              readTime: "5 min"
            }
          ]
        },
        {
          title: "Advanced Analytics",
          icon: TrendingUp,
          articles: [
            {
              id: "business-metrics",
              title: "Business Performance Metrics",
              description: "Track your ROI and business growth",
              category: "Advanced Analytics",
              icon: TrendingUp,
              priority: "medium",
              readTime: "6 min"
            },
            {
              id: "market-insights",
              title: "Market Insights Dashboard",
              description: "Use data to make better business decisions",
              category: "Advanced Analytics",
              icon: Globe,
              priority: "medium",
              readTime: "7 min"
            }
          ]
        }
      ]
    },

    // Default configurations for other roles - simplified for brevity
    property_manager: {
      name: "Property Manager",
      color: "bg-teal-600",
      icon: Building,
      description: "Manage multiple properties and coordinate maintenance projects",
      quickActions: [
        { title: "Property Dashboard", description: "Manage your properties", icon: Building, action: "/dashboard" },
        { title: "Contractor Network", description: "Find trusted contractors", icon: Users, action: "/contractors" },
        { title: "Bulk Projects", description: "Manage multiple projects", icon: Clipboard, action: "bulk" },
        { title: "Vendor Management", description: "Manage preferred vendors", icon: Star, action: "vendors" }
      ],
      categories: [
        {
          title: "Property Management",
          icon: Building,
          articles: [
            {
              id: "property-setup",
              title: "Setting Up Property Profiles",
              description: "Organize and manage multiple properties efficiently",
              category: "Property Management",
              icon: Building,
              priority: "high",
              readTime: "6 min"
            }
          ]
        }
      ]
    },

    business_owner: {
      name: "Business Owner",
      color: "bg-indigo-600",
      icon: Briefcase,
      description: "Commercial contractor services and business facility management",
      quickActions: [
        { title: "Commercial Projects", description: "Find commercial contractors", icon: Building, action: "/contractors" },
        { title: "Business Dashboard", description: "Manage your business projects", icon: Briefcase, action: "/dashboard" },
        { title: "Facility Management", description: "Coordinate facility maintenance", icon: Settings, action: "facility" },
        { title: "Vendor Contracts", description: "Manage service contracts", icon: FileText, action: "contracts" }
      ],
      categories: [
        {
          title: "Commercial Services",
          icon: Building,
          articles: [
            {
              id: "commercial-contractors",
              title: "Finding Commercial Contractors",
              description: "Locate contractors for business and commercial projects",
              category: "Commercial Services",
              icon: Building,
              priority: "high",
              readTime: "7 min"
            }
          ]
        }
      ]
    },

    realtor: {
      name: "Realtor",
      color: "bg-emerald-600",
      icon: Home,
      description: "Property preparation, client referrals, and real estate contractor network",
      quickActions: [
        { title: "Client Referrals", description: "Refer clients to contractors", icon: Users, action: "referrals" },
        { title: "Property Prep", description: "Prepare properties for sale", icon: Home, action: "prep" },
        { title: "Contractor Network", description: "Access trusted contractor network", icon: Star, action: "/contractors" },
        { title: "Commission Tracking", description: "Track referral commissions", icon: DollarSign, action: "commissions" }
      ],
      categories: [
        {
          title: "Real Estate Services",
          icon: Home,
          articles: [
            {
              id: "client-referrals",
              title: "Referring Clients to Contractors",
              description: "Help clients find reliable contractors for their projects",
              category: "Real Estate Services",
              icon: Users,
              priority: "high",
              readTime: "5 min"
            }
          ]
        }
      ]
    },

    car_salesman: {
      name: "Car Salesman",
      color: "bg-blue-600",
      icon: Car,
      description: "Client relationship management and automotive industry networking",
      quickActions: [
        { title: "Client CRM", description: "Manage your client relationships", icon: Users, action: "/crm" },
        { title: "Referral Network", description: "Connect with other professionals", icon: Users, action: "network" },
        { title: "Lead Generation", description: "Generate automotive leads", icon: TrendingUp, action: "leads" },
        { title: "Industry News", description: "Stay updated on automotive trends", icon: Globe, action: "news" }
      ],
      categories: [
        {
          title: "Sales & Marketing",
          icon: TrendingUp,
          articles: [
            {
              id: "client-management",
              title: "Managing Client Relationships",
              description: "Build lasting relationships with automotive clients",
              category: "Sales & Marketing",
              icon: Users,
              priority: "high",
              readTime: "6 min"
            }
          ]
        }
      ]
    },

    insurance_agent: {
      name: "Insurance Agent",
      color: "bg-cyan-600",
      icon: Shield,
      description: "Insurance products, client protection, and professional networking",
      quickActions: [
        { title: "Client Portal", description: "Manage insurance clients", icon: Users, action: "/dashboard" },
        { title: "Policy Management", description: "Manage client policies", icon: Shield, action: "policies" },
        { title: "Claims Support", description: "Help clients with claims", icon: MessageCircle, action: "claims" },
        { title: "Lead Generation", description: "Generate insurance leads", icon: TrendingUp, action: "leads" }
      ],
      categories: [
        {
          title: "Insurance Services",
          icon: Shield,
          articles: [
            {
              id: "client-onboarding",
              title: "Client Onboarding Process",
              description: "Efficiently onboard new insurance clients",
              category: "Insurance Services",
              icon: UserCheck,
              priority: "high",
              readTime: "7 min"
            }
          ]
        }
      ]
    },

    mortgage_broker: {
      name: "Mortgage Broker",
      color: "bg-amber-600",
      icon: Home,
      description: "Mortgage services, loan processing, and real estate professional network",
      quickActions: [
        { title: "Loan Pipeline", description: "Manage your loan pipeline", icon: Clipboard, action: "/dashboard" },
        { title: "Client Applications", description: "Process loan applications", icon: FileText, action: "applications" },
        { title: "Rate Calculator", description: "Calculate mortgage rates", icon: Calculator, action: "calculator" },
        { title: "Realtor Network", description: "Connect with realtors", icon: Users, action: "network" }
      ],
      categories: [
        {
          title: "Mortgage Services",
          icon: Home,
          articles: [
            {
              id: "loan-processing",
              title: "Efficient Loan Processing",
              description: "Streamline your mortgage application process",
              category: "Mortgage Services",
              icon: FileText,
              priority: "high",
              readTime: "8 min"
            }
          ]
        }
      ]
    },

    // Community roles
    community_member: {
      name: "Community Member",
      color: "bg-pink-600",
      icon: Users,
      description: "Community participation, networking, and knowledge sharing",
      quickActions: [
        { title: "Community Feed", description: "Join community discussions", icon: MessageCircle, action: "/community" },
        { title: "Local Groups", description: "Find local community groups", icon: MapPin, action: "groups" },
        { title: "Events", description: "Attend community events", icon: Calendar, action: "events" },
        { title: "Knowledge Base", description: "Access community resources", icon: BookOpen, action: "knowledge" }
      ],
      categories: [
        {
          title: "Community Engagement",
          icon: Users,
          articles: [
            {
              id: "community-guidelines",
              title: "Community Guidelines",
              description: "Learn how to participate effectively in our community",
              category: "Community Engagement",
              icon: BookOpen,
              priority: "high",
              readTime: "4 min"
            }
          ]
        }
      ]
    },

    community_moderator: {
      name: "Community Moderator",
      color: "bg-purple-600",
      icon: Shield,
      description: "Community moderation, event coordination, and member support",
      quickActions: [
        { title: "Moderation Panel", description: "Moderate community content", icon: Shield, action: "moderation" },
        { title: "Event Management", description: "Organize community events", icon: Calendar, action: "events" },
        { title: "Member Support", description: "Help community members", icon: MessageCircle, action: "support" },
        { title: "Analytics", description: "View community metrics", icon: TrendingUp, action: "analytics" }
      ],
      categories: [
        {
          title: "Community Management",
          icon: Shield,
          articles: [
            {
              id: "moderation-guidelines",
              title: "Community Moderation Guidelines",
              description: "Best practices for moderating community content",
              category: "Community Management",
              icon: Shield,
              priority: "high",
              readTime: "10 min"
            }
          ]
        }
      ]
    },

    community_leader: {
      name: "Community Leader",
      color: "bg-rose-600",
      icon: Crown,
      description: "Community strategy, growth initiatives, and leadership development",
      quickActions: [
        { title: "Leadership Dashboard", description: "Monitor community health", icon: TrendingUp, action: "/dashboard" },
        { title: "Strategy Planning", description: "Plan community initiatives", icon: Target, action: "strategy" },
        { title: "Member Recognition", description: "Recognize outstanding members", icon: Award, action: "recognition" },
        { title: "Growth Analytics", description: "Track community growth", icon: TrendingUp, action: "analytics" }
      ],
      categories: [
        {
          title: "Community Leadership",
          icon: Crown,
          articles: [
            {
              id: "leadership-principles",
              title: "Community Leadership Principles",
              description: "Guide your community with effective leadership strategies",
              category: "Community Leadership",
              icon: Crown,
              priority: "high",
              readTime: "12 min"
            }
          ]
        }
      ]
    },

    // Platform staff roles
    support_agent: {
      name: "Support Agent",
      color: "bg-blue-600",
      icon: MessageCircle,
      description: "Customer support, ticket management, and user assistance",
      quickActions: [
        { title: "Support Dashboard", description: "Manage support tickets", icon: MessageCircle, action: "/support" },
        { title: "Knowledge Base", description: "Access support resources", icon: BookOpen, action: "knowledge" },
        { title: "Escalation Queue", description: "Handle escalated issues", icon: AlertCircle, action: "escalation" },
        { title: "User Tools", description: "Help users with platform issues", icon: Settings, action: "tools" }
      ],
      categories: [
        {
          title: "Support Operations",
          icon: MessageCircle,
          articles: [
            {
              id: "support-best-practices",
              title: "Support Best Practices",
              description: "Provide excellent customer support",
              category: "Support Operations",
              icon: Star,
              priority: "high",
              readTime: "8 min"
            }
          ]
        }
      ]
    },

    content_moderator: {
      name: "Content Moderator",
      color: "bg-red-600",
      icon: Shield,
      description: "Content review, policy enforcement, and platform safety",
      quickActions: [
        { title: "Content Queue", description: "Review flagged content", icon: Shield, action: "content" },
        { title: "Policy Enforcement", description: "Enforce platform policies", icon: FileText, action: "policies" },
        { title: "User Reports", description: "Handle user reports", icon: AlertCircle, action: "reports" },
        { title: "Safety Tools", description: "Use platform safety tools", icon: Settings, action: "tools" }
      ],
      categories: [
        {
          title: "Content Moderation",
          icon: Shield,
          articles: [
            {
              id: "moderation-policies",
              title: "Content Moderation Policies",
              description: "Understand and enforce platform content policies",
              category: "Content Moderation",
              icon: FileText,
              priority: "high",
              readTime: "15 min"
            }
          ]
        }
      ]
    },

    territory_manager: {
      name: "Territory Manager",
      color: "bg-green-600",
      icon: MapPin,
      description: "Regional operations, local partnerships, and market development",
      quickActions: [
        { title: "Territory Dashboard", description: "Monitor regional metrics", icon: MapPin, action: "/dashboard" },
        { title: "Local Partnerships", description: "Manage local partnerships", icon: Users, action: "partnerships" },
        { title: "Market Analysis", description: "Analyze regional markets", icon: TrendingUp, action: "analysis" },
        { title: "Contractor Relations", description: "Manage contractor relationships", icon: Hammer, action: "contractors" }
      ],
      categories: [
        {
          title: "Territory Management",
          icon: MapPin,
          articles: [
            {
              id: "regional-strategy",
              title: "Regional Growth Strategy",
              description: "Develop and execute regional growth plans",
              category: "Territory Management",
              icon: Target,
              priority: "high",
              readTime: "10 min"
            }
          ]
        }
      ]
    },

    contractor_success: {
      name: "Contractor Success",
      color: "bg-orange-600",
      icon: Award,
      description: "Contractor onboarding, success metrics, and relationship management",
      quickActions: [
        { title: "Success Dashboard", description: "Monitor contractor success", icon: TrendingUp, action: "/dashboard" },
        { title: "Onboarding", description: "Onboard new contractors", icon: UserCheck, action: "onboarding" },
        { title: "Training Programs", description: "Manage training programs", icon: BookOpen, action: "training" },
        { title: "Performance Review", description: "Review contractor performance", icon: Star, action: "performance" }
      ],
      categories: [
        {
          title: "Contractor Success",
          icon: Award,
          articles: [
            {
              id: "success-metrics",
              title: "Contractor Success Metrics",
              description: "Track and improve contractor performance",
              category: "Contractor Success",
              icon: TrendingUp,
              priority: "high",
              readTime: "8 min"
            }
          ]
        }
      ]
    },

    content_seo: {
      name: "Content SEO",
      color: "bg-purple-600",
      icon: Globe,
      description: "SEO optimization, content strategy, and search performance",
      quickActions: [
        { title: "SEO Dashboard", description: "Monitor SEO performance", icon: TrendingUp, action: "/dashboard" },
        { title: "Content Calendar", description: "Manage content calendar", icon: Calendar, action: "calendar" },
        { title: "Keyword Research", description: "Research target keywords", icon: Search, action: "keywords" },
        { title: "Performance Analytics", description: "Analyze search performance", icon: Globe, action: "analytics" }
      ],
      categories: [
        {
          title: "SEO & Content",
          icon: Globe,
          articles: [
            {
              id: "seo-strategy",
              title: "SEO Content Strategy",
              description: "Develop effective SEO content strategies",
              category: "SEO & Content",
              icon: Target,
              priority: "high",
              readTime: "12 min"
            }
          ]
        }
      ]
    },

    analytics_specialist: {
      name: "Analytics Specialist",
      color: "bg-cyan-600",
      icon: TrendingUp,
      description: "Data analysis, reporting, and business intelligence",
      quickActions: [
        { title: "Analytics Dashboard", description: "View platform analytics", icon: TrendingUp, action: "/dashboard" },
        { title: "Custom Reports", description: "Create custom reports", icon: FileText, action: "reports" },
        { title: "Data Visualization", description: "Create data visualizations", icon: TrendingUp, action: "visualizations" },
        { title: "Performance Metrics", description: "Track key performance metrics", icon: Target, action: "metrics" }
      ],
      categories: [
        {
          title: "Data Analytics",
          icon: TrendingUp,
          articles: [
            {
              id: "analytics-best-practices",
              title: "Analytics Best Practices",
              description: "Effective data analysis and reporting techniques",
              category: "Data Analytics",
              icon: TrendingUp,
              priority: "high",
              readTime: "10 min"
            }
          ]
        }
      ]
    },

    marketing_specialist: {
      name: "Marketing Specialist",
      color: "bg-pink-600",
      icon: TrendingUp,
      description: "Marketing campaigns, user acquisition, and growth strategies",
      quickActions: [
        { title: "Campaign Dashboard", description: "Manage marketing campaigns", icon: TrendingUp, action: "/dashboard" },
        { title: "User Acquisition", description: "Drive user acquisition", icon: Users, action: "acquisition" },
        { title: "A/B Testing", description: "Run marketing experiments", icon: Target, action: "testing" },
        { title: "Growth Analytics", description: "Track growth metrics", icon: TrendingUp, action: "analytics" }
      ],
      categories: [
        {
          title: "Marketing & Growth",
          icon: TrendingUp,
          articles: [
            {
              id: "growth-strategies",
              title: "User Growth Strategies",
              description: "Effective strategies for user acquisition and retention",
              category: "Marketing & Growth",
              icon: TrendingUp,
              priority: "high",
              readTime: "10 min"
            }
          ]
        }
      ]
    },

    // Admin roles
    moderator: {
      name: "Moderator",
      color: "bg-red-600",
      icon: Shield,
      description: "Content moderation, user management, and platform oversight tools",
      quickActions: [
        { title: "Admin Panel", description: "Access moderation and admin tools", icon: Settings, action: "/admin/panel" },
        { title: "User Management", description: "Manage user accounts and permissions", icon: Users, action: "/admin/users" },
        { title: "Content Moderation", description: "Review and moderate platform content", icon: Shield, action: "moderation" },
        { title: "Support Tickets", description: "Handle user support requests", icon: MessageCircle, action: "support" }
      ],
      categories: [
        {
          title: "Platform Management",
          icon: Settings,
          articles: [
            {
              id: "admin-overview",
              title: "Admin Panel Overview",
              description: "Navigate the administrative interface",
              category: "Platform Management",
              icon: Settings,
              priority: "high",
              readTime: "10 min"
            },
            {
              id: "user-moderation",
              title: "User Account Moderation",
              description: "Manage user accounts and resolve issues",
              category: "Platform Management",
              icon: Users,
              priority: "high",
              readTime: "8 min"
            }
          ]
        }
      ]
    },

    ops_admin: {
      name: "Operations Admin",
      color: "bg-red-700",
      icon: Settings,
      description: "Platform operations, system management, and administrative oversight",
      quickActions: [
        { title: "Operations Dashboard", description: "Monitor platform operations", icon: Settings, action: "/admin/panel" },
        { title: "System Health", description: "Check system status", icon: CheckCircle, action: "health" },
        { title: "User Management", description: "Manage platform users", icon: Users, action: "/admin/users" },
        { title: "Configuration", description: "Configure platform settings", icon: Settings, action: "config" }
      ],
      categories: [
        {
          title: "Platform Operations",
          icon: Settings,
          articles: [
            {
              id: "ops-overview",
              title: "Operations Overview",
              description: "Comprehensive platform operations management",
              category: "Platform Operations",
              icon: Settings,
              priority: "high",
              readTime: "15 min"
            }
          ]
        }
      ]
    },

    super_admin: {
      name: "Super Admin",
      color: "bg-red-800",
      icon: Crown,
      description: "Full platform control, advanced configuration, and system administration",
      quickActions: [
        { title: "Super Admin Panel", description: "Access all admin features", icon: Crown, action: "/admin/panel" },
        { title: "System Configuration", description: "Configure platform systems", icon: Settings, action: "config" },
        { title: "Database Management", description: "Manage platform database", icon: Settings, action: "database" },
        { title: "Security Center", description: "Monitor platform security", icon: Shield, action: "security" }
      ],
      categories: [
        {
          title: "System Administration",
          icon: Crown,
          articles: [
            {
              id: "super-admin-guide",
              title: "Super Admin Guide",
              description: "Complete guide to platform administration",
              category: "System Administration",
              icon: Crown,
              priority: "high",
              readTime: "20 min"
            }
          ]
        }
      ]
    },

    head_admin: {
      name: "Head Admin",
      color: "bg-gray-900",
      icon: Crown,
      description: "Ultimate platform authority, user management, and strategic oversight",
      quickActions: [
        { title: "Master Control Panel", description: "Ultimate platform control", icon: Crown, action: "/admin/panel" },
        { title: "Admin Management", description: "Manage all administrators", icon: Users, action: "/admin/users" },
        { title: "Strategic Analytics", description: "View strategic platform metrics", icon: TrendingUp, action: "analytics" },
        { title: "Platform Security", description: "Ultimate security oversight", icon: Shield, action: "security" }
      ],
      categories: [
        {
          title: "Ultimate Administration",
          icon: Crown,
          articles: [
            {
              id: "head-admin-guide",
              title: "Head Admin Guide",
              description: "Ultimate platform authority and responsibility guide",
              category: "Ultimate Administration",
              icon: Crown,
              priority: "high",
              readTime: "25 min"
            }
          ]
        }
      ]
    }
  };

  // Get current user's role configuration
  const currentRole = user?.role || 'homeowner';
  const roleConfig = roleConfigs[currentRole];

  // Filter articles based on search and category
  const filteredArticles = useMemo(() => {
    let allArticles: HelpArticle[] = [];
    
    roleConfig.categories.forEach(category => {
      allArticles = [...allArticles, ...category.articles];
    });

    return allArticles.filter(article => {
      const matchesSearch = !searchQuery || 
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === "all" || 
        article.category.toLowerCase() === selectedCategory.toLowerCase();
      
      return matchesSearch && matchesCategory;
    });
  }, [roleConfig.categories, searchQuery, selectedCategory]);

  return (
    <div className="min-h-screen gradient-bg">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Help Center</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Get answers to your questions and learn how to make the most of TradeScout
          </p>
        </div>

        {/* Role-Specific Header */}
        <div className="mb-8">
          <Card className={`${roleConfig.color} border-navy-600`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-white/20 rounded-lg p-3">
                    <roleConfig.icon className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{roleConfig.name} Help Center</h2>
                    <p className="text-white/80">{roleConfig.description}</p>
                  </div>
                </div>
                <Badge className="bg-white/20 text-white border-white/30">
                  {filteredArticles.length} articles
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {roleConfig.quickActions.map((action, index) => (
            <Card key={index} className="bg-navy-800/50 border-navy-600 hover:bg-navy-700/50 transition-colors cursor-pointer">
              <CardContent className="p-4 text-center">
                <action.icon className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <h3 className="text-white font-medium">{action.title}</h3>
                <p className="text-gray-400 text-sm">{action.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search and Filter */}
        <Card className="bg-navy-800/50 border-navy-600 mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search help articles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-navy-700 border-navy-600 text-white"
                  />
                </div>
              </div>
              <div className="md:w-48">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-2 bg-navy-700 border border-navy-600 rounded-md text-white"
                >
                  <option value="all">All Categories</option>
                  {roleConfig.categories.map((category, index) => (
                    <option key={index} value={category.title}>{category.title}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="articles" className="space-y-6">
          <TabsList className="bg-navy-800/50 border-navy-600">
            <TabsTrigger value="articles">Help Articles</TabsTrigger>
            <TabsTrigger value="categories">Browse by Category</TabsTrigger>
            <TabsTrigger value="contact">Contact Support</TabsTrigger>
          </TabsList>

          <TabsContent value="articles">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArticles.map((article, index) => (
                <Card key={index} className="bg-navy-800/50 border-navy-600 hover:bg-navy-700/50 transition-colors cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-3 mb-4">
                      <article.icon className="h-6 w-6 text-orange-500 mt-1" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-white mb-2">{article.title}</h3>
                        <p className="text-gray-300 text-sm">{article.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant={article.priority === 'high' ? 'default' : 'outline'}
                          className={
                            article.priority === 'high' 
                              ? 'bg-orange-500 text-white' 
                              : 'border-navy-500 text-gray-400'
                          }
                        >
                          {article.priority}
                        </Badge>
                        <Badge variant="outline" className="border-navy-500 text-gray-400">
                          {article.category}
                        </Badge>
                      </div>
                      <div className="flex items-center text-gray-400 text-sm">
                        <Clock className="h-4 w-4 mr-1" />
                        {article.readTime}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {filteredArticles.length === 0 && (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No articles found</h3>
                <p className="text-gray-400">Try adjusting your search or browse by category</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {roleConfig.categories.map((category, index) => (
                <Card key={index} className="bg-navy-800/50 border-navy-600">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-3 text-white">
                      <category.icon className="h-6 w-6 text-orange-500" />
                      <span>{category.title}</span>
                      <Badge className="bg-navy-700 text-gray-300">
                        {category.articles.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {category.articles.map((article, articleIndex) => (
                      <div 
                        key={articleIndex}
                        className="flex items-center justify-between p-3 bg-navy-700/50 rounded-lg hover:bg-navy-700 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          <article.icon className="h-4 w-4 text-orange-500" />
                          <span className="text-white text-sm">{article.title}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge 
                            variant={article.priority === 'high' ? 'default' : 'outline'}
                            className={
                              article.priority === 'high' 
                                ? 'bg-orange-500 text-white text-xs' 
                                : 'border-navy-500 text-gray-400 text-xs'
                            }
                          >
                            {article.priority}
                          </Badge>
                          <span className="text-gray-400 text-xs">{article.readTime}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="contact">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-3">
                    <MessageCircle className="h-6 w-6 text-orange-500" />
                    <span>Live Chat Support</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-300">Get instant help from our support team</p>
                  <div className="space-y-2 text-sm text-gray-400">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4" />
                      <span>Available 24/7</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MessageCircle className="h-4 w-4" />
                      <span>Average response: 2 minutes</span>
                    </div>
                  </div>
                  <Button className="w-full bg-orange-500 hover:bg-orange-600">
                    Start Live Chat
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-3">
                    <Mail className="h-6 w-6 text-orange-500" />
                    <span>Email Support</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-300">Send us a detailed message for complex issues</p>
                  <div className="space-y-2 text-sm text-gray-400">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4" />
                      <span>support@tradescout.app</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4" />
                      <span>Response within 24 hours</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full border-navy-600 text-gray-300 hover:bg-navy-700">
                    Send Email
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-3">
                    <Phone className="h-6 w-6 text-orange-500" />
                    <span>Phone Support</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-300">Speak directly with our support team</p>
                  <div className="space-y-2 text-sm text-gray-400">
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4" />
                      <span>1-800-TRADESCOUT</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4" />
                      <span>Mon-Fri 9AM-6PM EST</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full border-navy-600 text-gray-300 hover:bg-navy-700">
                    Call Now
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-3">
                    <Video className="h-6 w-6 text-orange-500" />
                    <span>Video Tutorials</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-300">Watch step-by-step video guides</p>
                  <div className="space-y-2 text-sm text-gray-400">
                    <div className="flex items-center space-x-2">
                      <Video className="h-4 w-4" />
                      <span>50+ tutorial videos</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <BookOpen className="h-4 w-4" />
                      <span>Role-specific content</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full border-navy-600 text-gray-300 hover:bg-navy-700">
                    Browse Videos
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}