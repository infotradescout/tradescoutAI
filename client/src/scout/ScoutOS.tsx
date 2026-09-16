                      ? 20
                      : 45,
                updatedAt: activeObjective.updatedAt,
                route: "/scout",
              },
            ]
          : [],
        events: state.messages.slice(-8).map((message) => ({
          type: message.role === "user" ? "message_sent" : "action_executed",
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
