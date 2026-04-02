import { describe, it, expect } from 'vitest';
import { inferContextRoles } from './contextRoles';

describe('inferContextRoles', () => {
  it('infers homeowner from find/hire intent and contractors page', () => {
    const roles = inferContextRoles({
      message: 'Help me find a plumber',
      pagePath: '/contractors',
      recentActions: ['view_contractors'],
    });
    expect(roles).toContain('homeowner');
  });

  it('infers contractor/project_manager from invoice/estimate language', () => {
    const roles = inferContextRoles({
      message: 'Send an invoice for this job',
      recentActions: ['send_invoice'],
      inferredCapabilities: ['can_send_invoice'],
    });
    expect(roles).toContain('contractor');
    expect(roles).toContain('project_manager');
  });

  it('infers hoa_board from HOA signals', () => {
    const roles = inferContextRoles({
      message: 'Post HOA notice about dues',
      recentActions: ['post_hoa_notice'],
      inferredCapabilities: ['can_post_hoa_notice'],
    });
    expect(roles).toContain('hoa_board');
  });

  it('infers marketplace/vendor from listing intent and exchange page', () => {
    const roles = inferContextRoles({
      message: 'Post a listing for a used appliance',
      pagePath: '/exchange',
      recentActions: ['post_listing'],
      inferredCapabilities: ['can_post_listing'],
    });
    expect(roles).toContain('marketplace_vendor');
  });

  it('falls back to default when no signals are present', () => {
    const roles = inferContextRoles({});
    expect(roles).toContain('default');
  });
});
