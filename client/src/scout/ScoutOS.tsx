                      ? 20
                      : 45,
                updatedAt: activeObjective.updatedAt,
                route: "/scout",
              },
            ]
          : [],
        // Assistant prose is not execution evidence. Completed operations are
        // recorded by their authenticated server owner, never inferred from chat.
        events: state.messages.filter((message) => message.role === "user").slice(-8).map((message) => ({
          type: "message_sent",
          occurredAt: message.timestamp,
        })),
      };

      const response = await fetch("/api/scout/watchdog/evaluate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });

      if (!response.ok) {
