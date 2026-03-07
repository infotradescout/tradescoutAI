/**
 * Consistent data-testid selectors across the application
 * Keep these in sync with UI components
 */

export const selectors = {
  // Login / Authentication
  auth: {
    loginGoogleButton: '[data-testid="login-google"]',
    loginFacebookButton: '[data-testid="login-facebook"]',
    loginEmailInput: '[data-testid="login-email"]',
    loginPasswordInput: '[data-testid="login-password"]',
    loginSubmitButton: '[data-testid="login-submit"]',
    
    createAccountGoogleButton: '[data-testid="auth-google"]',
    createAccountFacebookButton: '[data-testid="auth-facebook"]',
    createAccountEmailInput: '[data-testid="signup-email"]',
    createAccountPasswordInput: '[data-testid="signup-password"]',
    createAccountNameInput: '[data-testid="signup-name"]',
    createAccountSubmitButton: '[data-testid="signup-submit"]',
    
    forgotPasswordLink: '[data-testid="forgot-password"]',
    haveAccountLink: '[data-testid="have-account"]',
    authIndicator: '[data-testid="auth-indicator"]',
    logoutButton: '[data-testid="logout"]',
  },

  // Business Profile View
  businessProfileView: {
    title: '[data-testid="bp-title"]',
    mission: '[data-testid="bp-mission"]',
    headline: '[data-testid="bp-headline"]',
    description: '[data-testid="bp-description"]',
    services: '[data-testid="bp-services"]',
    contactCTA: '[data-testid="bp-contact-cta"]',
    editButton: '[data-testid="bp-edit"]',
    messageButton: '[data-testid="bp-message"]',
  },

  // Business Profile Editor
  businessProfileEditor: {
    headlineInput: '[data-testid="bpe-headline"]',
    headlineCharCount: '[data-testid="bpe-headline-charcount"]',
    description: '[data-testid="bpe-description"]',
    services: '[data-testid="bpe-services"]',
    servicesAddButton: '[data-testid="bpe-services-add"]',
    serviceInput: (index: number) => `[data-testid="bpe-service-${index}"]`,
    serviceRemoveButton: (index: number) => `[data-testid="bpe-service-remove-${index}"]`,
    saveButton: '[data-testid="bpe-save"]',
    dirtyIndicator: '[data-testid="bpe-dirty-indicator"]',
    discardButton: '[data-testid="bpe-discard"]',
    publishButton: '[data-testid="bpe-publish"]',
    cancelButton: '[data-testid="bpe-cancel"]',
  },

  // Copy Assist
  copyAssist: {
    openHeadline: '[data-testid="copyassist-open-headline"]',
    openServices: '[data-testid="copyassist-open-services"]',
    openDescription: '[data-testid="copyassist-open-description"]',
    modal: '[data-testid="copyassist-modal"]',
    variantSafe: '[data-testid="copyassist-variant-safe"]',
    variantGrowth: '[data-testid="copyassist-variant-growth"]',
    useSafe: '[data-testid="copyassist-use-safe"]',
    useGrowth: '[data-testid="copyassist-use-growth"]',
    closeButton: '[data-testid="copyassist-close"]',
    loadingSpinner: '[data-testid="copyassist-loading"]',
  },

  // Direct Connect / Contact
  directConnect: {
    openButton: '[data-testid="dc-open"]',
    form: '[data-testid="dc-form"]',
    nameInput: '[data-testid="dc-name"]',
    emailInput: '[data-testid="dc-email"]',
    phoneInput: '[data-testid="dc-phone"]',
    messageInput: '[data-testid="dc-message"]',
    submitButton: '[data-testid="dc-submit"]',
    closeButton: '[data-testid="dc-close"]',
    successMessage: '[data-testid="dc-success"]',
    errorMessage: '[data-testid="dc-error"]',
  },

  // Invoicing
  invoicing: {
    createInvoiceButton: '[data-testid="inv-create"]',
    invoiceForm: '[data-testid="inv-form"]',
    recipientInput: '[data-testid="inv-recipient"]',
    addLineItemButton: '[data-testid="inv-add-line"]',
    lineItemDescription: (index: number) => `[data-testid="inv-line-desc-${index}"]`,
    lineItemQuantity: (index: number) => `[data-testid="inv-line-qty-${index}"]`,
    lineItemRate: (index: number) => `[data-testid="inv-line-rate-${index}"]`,
    totalAmount: '[data-testid="inv-total"]',
    sendButton: '[data-testid="inv-send"]',
    successMessage: '[data-testid="inv-success"]',
  },

  // Community / Feed
  community: {
    feed: '[data-testid="community-feed"]',
    postCard: '[data-testid="post-card"]',
    postTitle: '[data-testid="post-title"]',
    postBody: '[data-testid="post-body"]',
    commentButton: '[data-testid="post-comment"]',
    likeButton: '[data-testid="post-like"]',
  },

  // Navigation
  navigation: {
    headerLogo: '[data-testid="nav-logo"]',
    headerProfileMenu: '[data-testid="nav-profile-menu"]',
    headerDashboardLink: '[data-testid="nav-dashboard"]',
    sidebarProfileLink: '[data-testid="sidebar-profile"]',
    sidebarCommunityLink: '[data-testid="sidebar-community"]',
    sidebarDirectConnectLink: '[data-testid="sidebar-direct-connect"]',
  },

  // General / Common
  common: {
    loadingSpinner: '[data-testid="loading"]',
    errorAlert: '[data-testid="error-alert"]',
    successAlert: '[data-testid="success-alert"]',
    warningAlert: '[data-testid="warning-alert"]',
    modal: '[data-testid="modal"]',
    modalClose: '[data-testid="modal-close"]',
    emptyState: '[data-testid="empty-state"]',
    errorPage: '[data-testid="error-page"]',
    notFoundMessage: '[data-testid="not-found"]',
    notFoundPage: '[data-testid="not-found"]',
    adminPanel: '[data-testid="admin-panel"]',
    scoutChat: '[data-testid="scout-chat"]',
  },
};

/**
 * Helper to check if element has placeholder/stub content
 * Indicates unfinished UI that should fail trust checks
 */
export function hasStubContent(text: string): boolean {
  const stubPatterns = [
    /TODO/i,
    /coming soon/i,
    /\bplaceholder\b/i,
    /\bstub\b/i,
    /unimplemented/i,
    /wip/i,
    /work in progress/i,
    /\bfixture data\b/i,
    /\bmock data\b/i,
    /\bsample data\b/i,
  ];
  return stubPatterns.some(pattern => pattern.test(text));
}
