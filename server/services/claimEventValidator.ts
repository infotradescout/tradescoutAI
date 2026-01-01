/**
 * Claim Event Validator – Phase 3 Claim-First Intake
 *
 * RESPONSIBILITIES:
 * - Validate all claim event fields before write
 * - Check enum constraints (claim_type, source)
 * - Validate county_fips format and existence
 * - Validate user existence and creation timestamp
 * - Enforce timestamp bounds (not future, not before user creation)
 * - Return detailed validation errors for logging/debugging
 *
 * GOVERNANCE:
 * - This validator is STATELESS; no side effects
 * - All checks are reversible; designed for dry-run testing
 * - Database queries are passed in (dependency injection)
 * - Validator never modifies state
 */

import {
  ClaimType,
  ClaimSource,
  isValidClaimType,
  isValidClaimSource,
  isValidCountyFips,
  WriteClaimEventRequest,
  CLAIM_TYPE_DESCRIPTIONS,
  CLAIM_SOURCE_DESCRIPTIONS,
} from './claimEventSchema.js';

export interface ValidationContext {
  userExists: boolean;
  userCreatedAt: Date | null;
  countyExists: boolean;
  countyName: string | null;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate claim type
 * Allowed values: wantsToHire, providesServices, representsBusiness, postsDeals, communityBuilder, exploring
 */
export function validateClaimType(claimType: unknown): ValidationError | null {
  if (typeof claimType !== 'string') {
    return {
      field: 'claimType',
      message: `Claim type must be a string, got ${typeof claimType}`,
      severity: 'error',
    };
  }

  if (!isValidClaimType(claimType)) {
    const validTypes = Object.values(ClaimType).join(', ');
    return {
      field: 'claimType',
      message: `Invalid claim type: ${claimType}. Valid types: ${validTypes}`,
      severity: 'error',
    };
  }

  return null;
}

/**
 * Validate claim source
 * Allowed values: signup, direct_claim, import, admin
 */
export function validateClaimSource(source: unknown): ValidationError | null {
  if (typeof source !== 'string') {
    return {
      field: 'source',
      message: `Source must be a string, got ${typeof source}`,
      severity: 'error',
    };
  }

  if (!isValidClaimSource(source)) {
    const validSources = Object.values(ClaimSource).join(', ');
    return {
      field: 'source',
      message: `Invalid source: ${source}. Valid sources: ${validSources}`,
      severity: 'error',
    };
  }

  return null;
}

/**
 * Validate county FIPS code
 * Format: exactly 5 digits
 */
export function validateCountyFips(fips: unknown): ValidationError | null {
  if (typeof fips !== 'string') {
    return {
      field: 'countyFips',
      message: `County FIPS must be a string, got ${typeof fips}`,
      severity: 'error',
    };
  }

  if (!isValidCountyFips(fips)) {
    return {
      field: 'countyFips',
      message: `Invalid county FIPS format: ${fips}. Must be exactly 5 digits (e.g., 48113 for Dallas).`,
      severity: 'error',
    };
  }

  return null;
}

/**
 * Validate user ID format and existence
 */
export function validateUserId(userId: unknown, context: ValidationContext): ValidationError | null {
  if (typeof userId !== 'string') {
    return {
      field: 'userId',
      message: `User ID must be a string, got ${typeof userId}`,
      severity: 'error',
    };
  }

  if (!userId || userId.trim().length === 0) {
    return {
      field: 'userId',
      message: 'User ID cannot be empty',
      severity: 'error',
    };
  }

  if (!context.userExists) {
    return {
      field: 'userId',
      message: `User ${userId} does not exist`,
      severity: 'error',
    };
  }

  return null;
}

/**
 * Validate county name consistency
 */
export function validateCountyName(countyName: unknown, countyFips: string, context: ValidationContext): ValidationError | null {
  if (typeof countyName !== 'string') {
    return {
      field: 'countyName',
      message: `County name must be a string, got ${typeof countyName}`,
      severity: 'error',
    };
  }

  if (!countyName || countyName.trim().length === 0) {
    return {
      field: 'countyName',
      message: 'County name cannot be empty',
      severity: 'error',
    };
  }

  if (!context.countyExists) {
    return {
      field: 'countyFips',
      message: `County FIPS ${countyFips} does not exist in database`,
      severity: 'error',
    };
  }

  // Warn if provided county name doesn't match DB record
  if (context.countyName && context.countyName.toLowerCase() !== countyName.toLowerCase()) {
    return {
      field: 'countyName',
      message: `County name mismatch: provided "${countyName}", expected "${context.countyName}"`,
      severity: 'warning',
    };
  }

  return null;
}

/**
 * Validate claim timestamp
 * - Cannot be in the future
 * - Cannot be before user creation
 */
export function validateClaimTimestamp(claimTimestamp: unknown, context: ValidationContext): ValidationError | null {
  if (!(claimTimestamp instanceof Date)) {
    // Try parsing if string
    let parsed: Date;
    if (typeof claimTimestamp === 'string') {
      parsed = new Date(claimTimestamp);
      if (isNaN(parsed.getTime())) {
        return {
          field: 'claimTimestamp',
          message: `Invalid timestamp format: ${claimTimestamp}`,
          severity: 'error',
        };
      }
    } else {
      return {
        field: 'claimTimestamp',
        message: `Claim timestamp must be a Date or ISO string, got ${typeof claimTimestamp}`,
        severity: 'error',
      };
    }
    claimTimestamp = parsed;
  }

  const now = new Date();
  if (claimTimestamp > now) {
    return {
      field: 'claimTimestamp',
      message: `Claim timestamp cannot be in the future`,
      severity: 'error',
    };
  }

  if (context.userCreatedAt && claimTimestamp < context.userCreatedAt) {
    return {
      field: 'claimTimestamp',
      message: `Claim timestamp cannot be before user creation (user created at ${context.userCreatedAt.toISOString()})`,
      severity: 'error',
    };
  }

  return null;
}

/**
 * Validate metadata object
 * - Must be plain object or null
 * - No reserved keys
 */
export function validateMetadata(metadata: unknown): ValidationError | null {
  if (metadata === null || metadata === undefined) {
    return null; // Optional
  }

  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {
      field: 'metadata',
      message: `Metadata must be a plain object, got ${Array.isArray(metadata) ? 'array' : typeof metadata}`,
      severity: 'error',
    };
  }

  const reserved = ['id', 'userId', 'claimType', 'countyFips', 'source', 'claimTimestamp', 'createdAt', 'invalidatedAt'];
  const metadataKeys = Object.keys(metadata);
  const conflicting = metadataKeys.filter((k) => reserved.includes(k));

  if (conflicting.length > 0) {
    return {
      field: 'metadata',
      message: `Metadata contains reserved keys: ${conflicting.join(', ')}`,
      severity: 'error',
    };
  }

  return null;
}

/**
 * Full claim event validation
 * Runs all field validators and returns aggregated result
 */
export function validateClaimEventWrite(req: WriteClaimEventRequest, context: ValidationContext): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate claim type
  const claimTypeError = validateClaimType(req.claimType);
  if (claimTypeError) errors.push(claimTypeError);

  // Validate source
  const sourceError = validateClaimSource(req.source);
  if (sourceError) errors.push(sourceError);

  // Validate county FIPS
  const fipsError = validateCountyFips(req.countyFips);
  if (fipsError) errors.push(fipsError);

  // Validate user ID
  const userError = validateUserId(req.userId, context);
  if (userError) errors.push(userError);

  // Validate county name
  const countyNameError = validateCountyName(req.countyName, req.countyFips, context);
  if (countyNameError) errors.push(countyNameError);

  // Validate claim timestamp
  const timestampError = validateClaimTimestamp(req.claimTimestamp, context);
  if (timestampError) errors.push(timestampError);

  // Validate metadata
  const metadataError = validateMetadata(req.metadata);
  if (metadataError) errors.push(metadataError);

  // Separate errors from warnings
  const isValid = errors.filter((e) => e.severity === 'error').length === 0;

  return {
    valid: isValid,
    errors,
  };
}

/**
 * Format validation errors for logging/response
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return 'No validation errors';

  return errors.map((e) => `[${e.severity.toUpperCase()}] ${e.field}: ${e.message}`).join('; ');
}

/**
 * ClaimEventValidator class wrapper for Phase 3a integration
 * Provides method-based interface while reusing validation functions
 */
export class ClaimEventValidator {
  /**
   * Field-only validation (no DB reads, no existence checks)
   * Used by ClaimIntakeGate for precheck before full write validation
   */
  public validateFieldsOnly(input: {
    userId: string;
    countyFips: string;
    claimType: unknown;
    source: unknown;
    claimTimestamp: Date;
    metadata?: unknown;
  }): { ok: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic presence checks
    if (!input.userId || typeof input.userId !== 'string') {
      errors.push('userId is required and must be a string');
    }
    if (!input.countyFips || typeof input.countyFips !== 'string') {
      errors.push('countyFips is required and must be a string');
    }

    // Enum checks (reuse existing validators)
    const claimTypeError = validateClaimType(input.claimType);
    if (claimTypeError) {
      errors.push(claimTypeError.message);
    }

    const sourceError = validateClaimSource(input.source);
    if (sourceError) {
      errors.push(sourceError.message);
    }

    // FIPS format check (existence check remains in service write flow)
    const fipsError = validateCountyFips(input.countyFips);
    if (fipsError) {
      errors.push(fipsError.message);
    }

    // Timestamp bounds check (partial — future check only; user creation bound is in write flow)
    if (!(input.claimTimestamp instanceof Date) || isNaN(input.claimTimestamp.getTime())) {
      errors.push('claimTimestamp must be a valid Date');
    } else {
      const now = Date.now();
      if (input.claimTimestamp.getTime() > now + 1_000) {
        errors.push('claimTimestamp cannot be in the future');
      }
    }

    // Metadata shape check (reserved keys validation)
    const metadataError = validateMetadata(input.metadata);
    if (metadataError) {
      errors.push(metadataError.message);
    }

    return { ok: errors.length === 0, errors, warnings };
  }
}
