# Recipe Formulation

This folder packages the **reference screenshot extraction module** used for Scout UI implementation.

Purpose:
- Convert a reference screenshot into real, production-safe page anatomy.
- Map visual regions to existing components and data contracts.
- Prevent fake UI, freestyle redesigns, and backend drift.

## Included Files
- `README.md`: usage, workflow, guardrails.
- `Reference-Screenshot-Mode.md`: strict operational procedure.
- `Target-to-Real-Page-Mapping-Template.md`: fill-in template before coding.
- `Implementation-Checklist.md`: implementation and QA gate checklist.

## Core Rule
When a user says "reference screenshot" or equivalent, treat the screenshot as the source of truth and complete mapping **before writing code**.