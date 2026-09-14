// Icons carried over verbatim from the original mockup's ICONS map.

export type IconKey =
  | "dashboard"
  | "projects"
  | "units"
  | "leads"
  | "realtors"
  | "visits"
  | "bookings"
  | "commissions"
  | "admin";

export function Icon({ name }: { name: IconKey }) {
  switch (name) {
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case "projects":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 21V8l9-5 9 5v13" />
          <path d="M9 21v-7h6v7" />
        </svg>
      );
    case "units":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      );
    case "leads":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      );
    case "realtors":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="8" cy="8" r="3.2" />
          <circle cx="17" cy="9" r="2.6" />
          <path d="M2.5 20c0-3.3 2.7-5.5 5.5-5.5s5.5 2.2 5.5 5.5M14.8 20c0-2.4 1.8-4.3 4.7-4.3s4.5 1.9 4.5 4.3" />
        </svg>
      );
    case "visits":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "bookings":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16v16H4z" />
          <path d="M9 9h6M9 13h6M9 17h3" />
        </svg>
      );
    case "commissions":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10M9 9.5c0-1.4 1.3-2.5 3-2.5s3 1 3 2.3c0 3-6 1.7-6 4.7 0 1.4 1.3 2.5 3 2.5s3-1.1 3-2.5" />
        </svg>
      );
    case "admin":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l7 3.5v5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5v-5L12 3z" />
          <path d="M9.5 12l1.8 1.8L14.8 10" />
        </svg>
      );
  }
}
