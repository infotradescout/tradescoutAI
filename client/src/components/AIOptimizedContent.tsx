/**
 * AIOptimizedContent - Component for LLM-friendly content structures
 * 
 * This component creates content that is specifically optimized for AI model understanding
 * while maintaining excellent user experience. It uses semantic HTML, clear data attributes,
 * and structured content patterns that help LLMs understand context and relationships.
 */

interface AIOptimizedContentProps {
  children: React.ReactNode;
  contentType: 'contractor-profile' | 'service-listing' | 'quote-request' | 'review' | 'project-details';
  metadata?: Record<string, any>;
  className?: string;
}

export function AIOptimizedContent({ children, contentType, metadata = {}, className = '' }: AIOptimizedContentProps) {
  const getSemanticAttributes = () => {
    const baseAttributes: Record<string, any> = {
      'data-ai-content': contentType,
      'data-ai-extractable': 'true',
      'role': getAriaRole(contentType),
      'itemScope': true,
      'itemType': getSchemaType(contentType)
    };

    // Add metadata as data attributes for AI parsing
    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        baseAttributes[`data-ai-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`] = String(value);
      }
    });

    return baseAttributes;
  };

  return (
    <div 
      {...getSemanticAttributes()}
      className={`ai-optimized-content ${className}`}
    >
      {children}
    </div>
  );
}

function getAriaRole(contentType: string): string {
  const roleMap: Record<string, string> = {
    'contractor-profile': 'article',
    'service-listing': 'listitem',
    'quote-request': 'form',
    'review': 'article',
    'project-details': 'main'
  };
  return roleMap[contentType] || 'article';
}

function getSchemaType(contentType: string): string {
  const schemaMap: Record<string, string> = {
    'contractor-profile': 'https://schema.org/LocalBusiness',
    'service-listing': 'https://schema.org/Service',
    'quote-request': 'https://schema.org/Quote',
    'review': 'https://schema.org/Review',
    'project-details': 'https://schema.org/CreativeWork'
  };
  return schemaMap[contentType] || 'https://schema.org/Thing';
}

/**
 * Semantic data wrapper for key business information
 * Helps AI models understand important business context
 */
interface BusinessContextProps {
  businessName?: string;
  serviceType?: string;
  location?: string;
  verified?: boolean;
  yearsInBusiness?: number;
  contactInfo?: {
    phone?: string;
    email?: string;
    website?: string;
  };
  children: React.ReactNode;
}

export function BusinessContext({ 
  businessName, 
  serviceType, 
  location, 
  verified, 
  yearsInBusiness, 
  contactInfo,
  children 
}: BusinessContextProps) {
  return (
    <AIOptimizedContent 
      contentType="contractor-profile"
      metadata={{
        businessName,
        serviceType,
        location,
        verified,
        yearsInBusiness,
        phone: contactInfo?.phone,
        email: contactInfo?.email,
        website: contactInfo?.website
      }}
      className="business-context"
    >
      {/* Hidden structured data for AI parsing */}
      <div className="sr-only ai-context-data">
        <span data-field="business-name">{businessName}</span>
        <span data-field="service-type">{serviceType}</span>
        <span data-field="location">{location}</span>
        <span data-field="verification-status">{verified ? 'verified' : 'pending'}</span>
        <span data-field="experience-years">{yearsInBusiness}</span>
        {contactInfo?.phone && <span data-field="phone">{contactInfo.phone}</span>}
        {contactInfo?.email && <span data-field="email">{contactInfo.email}</span>}
        {contactInfo?.website && <span data-field="website">{contactInfo.website}</span>}
      </div>
      
      {children}
    </AIOptimizedContent>
  );
}

/**
 * Service capability markers for AI understanding
 */
interface ServiceCapabilityProps {
  services: string[];
  specializations?: string[];
  certifications?: string[];
  children: React.ReactNode;
}

export function ServiceCapability({ services, specializations = [], certifications = [], children }: ServiceCapabilityProps) {
  return (
    <AIOptimizedContent 
      contentType="service-listing"
      metadata={{
        serviceCount: services.length,
        hasSpecializations: specializations.length > 0,
        hasCertifications: certifications.length > 0
      }}
    >
      {/* AI-readable service data */}
      <div className="sr-only service-capability-data">
        <ul data-field="primary-services">
          {services.map((service, index) => (
            <li key={index} data-service={service}>{service}</li>
          ))}
        </ul>
        {specializations.length > 0 && (
          <ul data-field="specializations">
            {specializations.map((spec, index) => (
              <li key={index} data-specialization={spec}>{spec}</li>
            ))}
          </ul>
        )}
        {certifications.length > 0 && (
          <ul data-field="certifications">
            {certifications.map((cert, index) => (
              <li key={index} data-certification={cert}>{cert}</li>
            ))}
          </ul>
        )}
      </div>
      
      {children}
    </AIOptimizedContent>
  );
}

/**
 * Project context wrapper for quote requests
 */
interface ProjectContextProps {
  projectType: string;
  squareFootage?: number;
  urgency?: string;
  budget?: { min?: number; max?: number };
  location?: { state?: string; county?: string };
  requirements?: string[];
  children: React.ReactNode;
}

export function ProjectContext({ 
  projectType, 
  squareFootage, 
  urgency, 
  budget, 
  location, 
  requirements = [],
  children 
}: ProjectContextProps) {
  return (
    <AIOptimizedContent 
      contentType="project-details"
      metadata={{
        projectType,
        squareFootage,
        urgency,
        budgetMin: budget?.min,
        budgetMax: budget?.max,
        state: location?.state,
        county: location?.county,
        requirementCount: requirements.length
      }}
    >
      {/* AI-parseable project data */}
      <div className="sr-only project-context-data">
        <span data-field="project-type">{projectType}</span>
        {squareFootage && <span data-field="square-footage">{squareFootage}</span>}
        {urgency && <span data-field="urgency">{urgency}</span>}
        {budget && (
          <>
            {budget.min && <span data-field="budget-min">{budget.min}</span>}
            {budget.max && <span data-field="budget-max">{budget.max}</span>}
          </>
        )}
        {location && (
          <>
            {location.state && <span data-field="project-state">{location.state}</span>}
            {location.county && <span data-field="project-county">{location.county}</span>}
          </>
        )}
        {requirements.length > 0 && (
          <ul data-field="project-requirements">
            {requirements.map((req, index) => (
              <li key={index} data-requirement={req}>{req}</li>
            ))}
          </ul>
        )}
      </div>
      
      {children}
    </AIOptimizedContent>
  );
}

/**
 * Performance metrics wrapper for contractor profiles
 */
interface PerformanceMetricsProps {
  rating?: number;
  reviewCount?: number;
  projectsCompleted?: number;
  responseTime?: string;
  completionRate?: number;
  repeatCustomers?: number;
  children: React.ReactNode;
}

export function PerformanceMetrics({ 
  rating, 
  reviewCount, 
  projectsCompleted, 
  responseTime, 
  completionRate, 
  repeatCustomers,
  children 
}: PerformanceMetricsProps) {
  return (
    <AIOptimizedContent 
      contentType="contractor-profile"
      metadata={{
        rating,
        reviewCount,
        projectsCompleted,
        responseTime,
        completionRate,
        repeatCustomers
      }}
    >
      {/* AI-readable performance data */}
      <div className="sr-only performance-metrics-data">
        {rating && <span data-field="average-rating">{rating}</span>}
        {reviewCount && <span data-field="review-count">{reviewCount}</span>}
        {projectsCompleted && <span data-field="projects-completed">{projectsCompleted}</span>}
        {responseTime && <span data-field="response-time">{responseTime}</span>}
        {completionRate && <span data-field="completion-rate">{completionRate}</span>}
        {repeatCustomers && <span data-field="repeat-customers">{repeatCustomers}</span>}
      </div>
      
      {children}
    </AIOptimizedContent>
  );
}