export const JRS_AUTO_GLASS_GALLERY_BLOCKS = [
  {
    type: "gallery",
    data: {
      title: "Windshield replacement",
      description: "A recent mobile windshield replacement completed by JR's Auto Glass.",
      images: [
        {
          id: "windshield-before",
          imageUrl: "/images/businesses/jrs-auto-glass/before.webp",
          title: "Windshield before replacement",
          alt: "Damaged windshield before service",
          description: "The damaged windshield before JR's began the replacement.",
        },
        {
          id: "windshield-after",
          imageUrl: "/images/businesses/jrs-auto-glass/after.webp",
          title: "Windshield after replacement",
          alt: "Replaced windshield after service",
          description: "The finished windshield after JR's completed the replacement.",
        },
      ],
    },
  },
] as const;
