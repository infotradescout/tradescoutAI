/**
 * Scout Image Routing Tool
 * 
 * Enables Scout to route and attach images for users across different contexts:
 * - Profile pictures
 * - Community posts
 * - Marketplace listings
 * - Direct messages
 */

export interface ImageAttachmentContext {
  type: 'profile' | 'community' | 'marketplace' | 'message';
  entityId?: string;
  userId: string;
}

export interface ImageAttachmentResult {
  success: boolean;
  imageUrl?: string;
  uploadUrl?: string;
  message: string;
}

/**
 * Scout tool for generating upload URLs and providing image guidance
 */
export async function generateImageUploadGuidance(
  context: ImageAttachmentContext
): Promise<ImageAttachmentResult> {
  const contextMessages = {
    profile: "To update your profile picture, use the camera button on your profile or go to Settings > Profile.",
    community: "To add images to your community post, use the image button in the post composer.",
    marketplace: "To add photos to your marketplace listing, use the 'Add Photo' button in the listing form. You can upload up to 8 photos.",
    message: "To share images in messages, use the attachment button in the message composer.",
  };

  return {
    success: true,
    message: contextMessages[context.type],
    uploadUrl: `/api/objects/upload`, // Scout can reference this endpoint
  };
}

/**
 * Tool schema for Scout to understand image capabilities
 */
export const scoutImageToolSchema = {
  name: "route_image_upload",
  description: "Help users upload and attach images to their profiles, posts, listings, or messages. Provides guidance on where and how to upload images.",
  parameters: {
    type: "object" as const,
    properties: {
      context_type: {
        type: "string" as const,
        enum: ["profile", "community", "marketplace", "message"],
        description: "Where the user wants to add an image",
      },
      user_id: {
        type: "string" as const,
        description: "ID of the user requesting upload guidance",
      },
    },
    required: ["context_type", "user_id"],
  },
};

/**
 * Scout CTA builder for image upload actions
 */
export function buildImageUploadCTA(context: ImageAttachmentContext): {
  label: string;
  href: string;
  action?: string;
} {
  const ctaMap = {
    profile: {
      label: "Upload Profile Picture",
      href: "/settings?tab=profile",
      action: "scroll_to_profile_photo",
    },
    community: {
      label: "Create Post with Image",
      href: "/community",
      action: "open_composer",
    },
    marketplace: {
      label: "Create Listing with Photos",
      href: "/marketplace/create",
      action: "focus_image_upload",
    },
    message: {
      label: "Send Image in Message",
      href: "/messages",
      action: "open_composer",
    },
  };

  return ctaMap[context.type];
}
