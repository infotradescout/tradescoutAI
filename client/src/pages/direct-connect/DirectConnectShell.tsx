                    ? `${r.attachmentCount} photos`
                    : null,
                ].filter(Boolean);
                const contactGateState = normalizeDirectConnectContactState(r.contactGateState);
                const canApproveContact = contactGateState === "contractor_requested";
                const canDenyContact = contactGateState === "contractor_requested";
                const canReleaseContact = contactGateState === "user_approved";
