/**
 * Domain-Agnostic Risk Classifier
 * 
 * This module replaces domain-specific keyword matching (foundation/roof/HVAC)
 * with universal risk dimensions that work across ANY domain.
 * 
 * This is the unlock that makes Scout future-proof.
 */

export interface RiskDimensions {
  financial: number;        // 0-10: Money at stake
  legal: number;            // 0-10: Legal/regulatory exposure
  safety: number;           // 0-10: Physical safety risk
  irreversibility: number;  // 0-10: Cannot be undone
  trust: number;            // 0-10: Relationship/reputation damage
  timeCritical: number;     // 0-10: Must act now or lose opportunity
  personalData: number;     // 0-10: Privacy/identity exposure
}

export interface RiskAssessment {
  dimensions: RiskDimensions;
  overallRisk: number;      // 0-10: Composite score
  severity: "low" | "medium" | "high" | "critical";
  reversibility: "fully_reversible" | "partially_reversible" | "irreversible";
  criticalMissingInfo: string[];
}

/**
 * Classify risk dimensions from user message and context
 */
export function classifyRisk(args: {
  message: string;
  goal: string;
  constraints: string[];
  unknowns: string[];
}): RiskAssessment {
  const lower = args.message.toLowerCase();
  const goalLower = args.goal.toLowerCase();
  
  // Initialize all dimensions at 0
  const dimensions: RiskDimensions = {
    financial: 0,
    legal: 0,
    safety: 0,
    irreversibility: 0,
    trust: 0,
    timeCritical: 0,
    personalData: 0,
  };

  // ==========================================================================
  // FINANCIAL RISK
  // ==========================================================================
  
  // Large amounts mentioned
  if (/\$?\d{4,}|\d+k/.test(lower)) {
    const amounts = lower.match(/\$?(\d+)(?:,\d{3})*(?:k)?/g) || [];
    const maxAmount = amounts.reduce((max, amt) => {
      const num = parseInt(amt.replace(/[$,k]/g, '')) * (amt.includes('k') ? 1000 : 1);
      return Math.max(max, num);
    }, 0);
    
    if (maxAmount > 50000) dimensions.financial = 10;
    else if (maxAmount > 20000) dimensions.financial = 8;
    else if (maxAmount > 10000) dimensions.financial = 6;
    else if (maxAmount > 5000) dimensions.financial = 4;
    else if (maxAmount > 1000) dimensions.financial = 2;
  }
  
  // Price anchoring (asking "is $X too much?")
  if (/is \$?\d+.*(too much|fair|reasonable|overpriced)/i.test(lower)) {
    dimensions.financial = Math.max(dimensions.financial, 7);
  }
  
  // Investment/commitment language
  if (/invest|commit|deposit|down payment|financing/i.test(lower)) {
    dimensions.financial = Math.max(dimensions.financial, 5);
  }
  
  // Budget concerns
  if (/budget|afford|expensive|cheap|save money/i.test(lower)) {
    dimensions.financial = Math.max(dimensions.financial, 3);
  }

  // ==========================================================================
  // SAFETY RISK
  // ==========================================================================
  
  // Life-safety systems
  if (/electrical|wiring|gas|structural|foundation|load.?bearing/i.test(lower)) {
    dimensions.safety = 8;
  }
  
  // Fire/flood/emergency
  if (/fire|flood|emergency|evacuation|carbon monoxide|leak/i.test(lower)) {
    dimensions.safety = 10;
  }
  
  // Children/elderly mentioned
  if (/child|kid|baby|elderly|senior|disabled/i.test(lower)) {
    dimensions.safety = Math.max(dimensions.safety, 6);
  }
  
  // Health concerns
  if (/health|mold|asbestos|lead|toxic|poison/i.test(lower)) {
    dimensions.safety = 9;
  }

  // ==========================================================================
  // IRREVERSIBILITY
  // ==========================================================================
  
  // Permanent changes
  if (/permanent|demolish|tear down|remove|gut|can't undo/i.test(lower)) {
    dimensions.irreversibility = 9;
  }
  
  // Structural modifications
  if (/structural|foundation|wall removal|beam|support/i.test(lower)) {
    dimensions.irreversibility = 8;
  }
  
  // Legal contracts/commitments
  if (/contract|agreement|sign|binding|commit/i.test(lower)) {
    dimensions.irreversibility = 7;
  }
  
  // Major systems replacement
  if (/replace|new (roof|hvac|furnace|ac|foundation)/i.test(lower)) {
    dimensions.irreversibility = 6;
  }

  // ==========================================================================
  // LEGAL RISK
  // ==========================================================================
  
  // Permit/code requirements
  if (/permit|code|regulation|zoning|hoa|compliance/i.test(lower)) {
    dimensions.legal = 6;
  }
  
  // Liability concerns
  if (/liability|lawsuit|sue|legal|attorney|lawyer/i.test(lower)) {
    dimensions.legal = 8;
  }
  
  // Insurance implications
  if (/insurance|claim|coverage|policy/i.test(lower)) {
    dimensions.legal = 5;
  }
  
  // Boundary/property line issues
  if (/property line|boundary|easement|right of way|fence line/i.test(lower)) {
    dimensions.legal = 7;
  }

  // ==========================================================================
  // TRUST RISK
  // ==========================================================================
  
  // Explicit trust concerns
  if (/trust|reliable|scam|ripped off|fraud|honest/i.test(lower)) {
    dimensions.trust = 7;
  }
  
  // Bad past experience
  if (/bad experience|previous (contractor|realtor)|last time|got burned/i.test(lower)) {
    dimensions.trust = 6;
  }
  
  // Verification needed
  if (/verify|check|background|license|insured|bonded/i.test(lower)) {
    dimensions.trust = 5;
  }
  
  // Reputation queries
  if (/reviews|rating|reputation|recommend/i.test(lower)) {
    dimensions.trust = 4;
  }

  // ==========================================================================
  // TIME-CRITICAL
  // ==========================================================================
  
  // Emergency language
  if (/asap|urgent|emergency|immediate|right now|today/i.test(lower)) {
    dimensions.timeCritical = 9;
  }
  
  // Deadline pressure
  if (/deadline|closing|move.?in|lease (starts|ends)/i.test(lower)) {
    dimensions.timeCritical = 7;
  }
  
  // Seasonal concerns
  if (/before (winter|summer|rain|freeze)/i.test(lower)) {
    dimensions.timeCritical = 5;
  }

  // ==========================================================================
  // PERSONAL DATA RISK
  // ==========================================================================
  
  // Sharing sensitive info
  if (/social security|ssn|tax|financial records|bank account/i.test(lower)) {
    dimensions.personalData = 10;
  }
  
  // Identity verification
  if (/driver license|passport|birth certificate|identity/i.test(lower)) {
    dimensions.personalData = 8;
  }
  
  // Credit/financial data
  if (/credit (score|report)|income|salary|tax returns/i.test(lower)) {
    dimensions.personalData = 7;
  }
  
  // Contact info sharing
  if (/phone number|email|address|contact/i.test(lower)) {
    dimensions.personalData = 3;
  }

  // ==========================================================================
  // CALCULATE COMPOSITE SCORES
  // ==========================================================================
  
  // Overall risk is weighted average (safety and financial weighted heavier)
  const overallRisk = Math.round(
    (dimensions.financial * 1.5 +
     dimensions.safety * 2.0 +
     dimensions.irreversibility * 1.2 +
     dimensions.legal * 1.3 +
     dimensions.trust * 1.0 +
     dimensions.timeCritical * 0.8 +
     dimensions.personalData * 1.5) / 9.3
  );
  
  // Determine severity
  let severity: RiskAssessment["severity"];
  if (overallRisk >= 8 || dimensions.safety >= 8 || dimensions.personalData >= 9) {
    severity = "critical";
  } else if (overallRisk >= 6) {
    severity = "high";
  } else if (overallRisk >= 3) {
    severity = "medium";
  } else {
    severity = "low";
  }
  
  // Determine reversibility
  let reversibility: RiskAssessment["reversibility"];
  if (dimensions.irreversibility >= 7 || dimensions.legal >= 7) {
    reversibility = "irreversible";
  } else if (dimensions.irreversibility >= 4 || dimensions.financial >= 6) {
    reversibility = "partially_reversible";
  } else {
    reversibility = "fully_reversible";
  }
  
  // Identify critical missing info based on risk dimensions
  const criticalMissingInfo: string[] = [];
  
  if (dimensions.financial >= 5 && !lower.includes('cost') && !lower.includes('price') && !lower.includes('budget')) {
    criticalMissingInfo.push("Cost estimate or budget context");
  }
  
  if (dimensions.safety >= 6 && !lower.includes('licensed') && !lower.includes('qualified')) {
    criticalMissingInfo.push("Provider qualifications and licensing");
  }
  
  if (dimensions.legal >= 6 && !lower.includes('permit')) {
    criticalMissingInfo.push("Permit and compliance requirements");
  }
  
  if (dimensions.irreversibility >= 6 && args.unknowns.length > 0) {
    criticalMissingInfo.push("Full scope and irreversible implications");
  }
  
  if (dimensions.trust >= 5) {
    criticalMissingInfo.push("Provider verification and reputation data");
  }

  return {
    dimensions,
    overallRisk,
    severity,
    reversibility,
    criticalMissingInfo,
  };
}

/**
 * Get human-readable risk explanation
 */
export function explainRisk(assessment: RiskAssessment): string {
  const topRisks = Object.entries(assessment.dimensions)
    .filter(([_, score]) => score >= 5)
    .sort(([_, a], [__, b]) => b - a)
    .map(([type]) => type);
  
  if (topRisks.length === 0) {
    return "Low risk situation with minimal concerns.";
  }
  
  const riskTypes = topRisks.map(r => {
    switch (r) {
      case 'financial': return 'significant financial exposure';
      case 'safety': return 'safety concerns';
      case 'irreversibility': return 'irreversible consequences';
      case 'legal': return 'legal/regulatory implications';
      case 'trust': return 'trust verification needed';
      case 'timeCritical': return 'time-sensitive decision';
      case 'personalData': return 'sensitive personal information';
      default: return r;
    }
  }).join(', ');
  
  return `${assessment.severity.charAt(0).toUpperCase() + assessment.severity.slice(1)} risk due to ${riskTypes}.`;
}
