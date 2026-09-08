# System Settings and Registration Policy

Self-registration was previously unconditional: anyone who could reach the web interface could create an account, which is unsuitable for private or homelab deployments (such as Synology NAS). We introduced a singleton `system_settings` table holding instance-wide operational toggles, starting with `registration_enabled` (defaulting to `true`).

Administrators can toggle this policy at runtime via the User Management interface. When Self-Registration is disabled, `POST /api/auth/register` returns `403 Forbidden`, the login page omits the account creation link, and direct visits to `/register` redirect to `/login` with an informational notice. Admin Provisioning remains available so administrators can still create accounts manually. An optional `DISABLE_REGISTRATION` environment variable sets the initial database default during first startup without preventing subsequent runtime changes through the administrative interface.
