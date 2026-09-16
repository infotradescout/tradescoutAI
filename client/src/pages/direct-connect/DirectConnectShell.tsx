                    ? `${r.attachmentCount} photos`
                    : null,
                ].filter(Boolean);
                const contactGateState = String(r.contactGateState || "locked");
                const canApproveContact = contactGateState === "contractor_requested";
                const canDenyContact = contactGateState === "contractor_requested";
                const canReleaseContact = contactGateState === "user_approved";
