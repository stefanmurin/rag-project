# Engineering Team Guidelines and Operational Policies

This document outlines the standard operating procedures, security protocols, and operational limits for all engineering staff.

## Working Hours and Core Availability

Engineers are expected to be available for synchronous communication during core hours: 10:00 AM to 3:00 PM Central European Time (CET). Outside of core hours, work is asynchronous. Standup meetings take place daily at 10:15 AM CET on Google Meet.

## Production Access and Database Migrations

Direct access to production databases is strictly restricted:
- All schema changes must be executed through version-controlled migration scripts.
- Schema migrations requiring exclusive locks must be scheduled during the maintenance window (Sundays between 02:00 AM and 04:00 AM UTC).
- Any manual troubleshooting query must be executed via the read-only replica with statement timeouts capped at 15 seconds.

## Expense Limits and Hardware Refresh

The company provides the following annual allowances:
- Hardware Budget: 1,500 EUR every 24 months for laptops, monitors, or peripherals.
- Learning & Development: 800 EUR per calendar year for books, conference tickets, and online certifications.
- Ergonomic Equipment: One-time allowance of 350 EUR upon onboarding for desk chairs or standing desks.

## Incident Response Tiers

Incidents are classified into three severity levels:
1. Sev-1 (Critical): Core functionality broken for more than 10% of users. SLA: initial response within 15 minutes, updates every 30 minutes.
2. Sev-2 (Major): Impaired performance or secondary service outage. SLA: initial response within 1 hour.
3. Sev-3 (Minor): Bug with existing workaround. SLA: resolved within the next sprint cycle.
