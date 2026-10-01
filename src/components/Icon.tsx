/** Stroke icons on a 24px grid. Add new ones to PATHS. */
const PATHS = {
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.5M4.5 12h.5M4.5 18h.5',
  budget: 'M12 3a9 9 0 1 0 9 9h-9zM15 3.5A8.5 8.5 0 0 1 20.5 9H15z',
  tag: 'M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9zM8 8h.5',
  upload: 'M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  more: 'M5 12h.5M12 12h.5M19 12h.5',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-4-4',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  wallet: 'M4 7h15a1 1 0 0 1 1 1v11H5a1 1 0 0 1-1-1zM4 7l11-3v3M16 13h.5',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  refresh: 'M4 11a7 7 0 0 1 12-4.9L18 8M18 4v4h-4M20 13a7 7 0 0 1-12 4.9L6 16M6 20v-4h4',
  target: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9zM12 11.5h.5',
  // Category icons
  cart: 'M3 4h2.2l2.3 10.4a1.2 1.2 0 0 0 1.2.9h8.6a1.2 1.2 0 0 0 1.2-.9L20.5 8H6.1M8 20a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0M16 20a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0',
  utensils: 'M6 3v7a2 2 0 0 0 4 0V3M8 12v9M17 21V3c-2 1-3 3.5-3 7h3',
  car: 'M5 16.5V12l2-5.5h10l2 5.5v4.5zM5 16.5V19M19 16.5V19M5 12h14',
  bag: 'M5.5 8h13l-1 12h-11zM9 8V6.5a3 3 0 0 1 6 0V8',
  ticket: 'M3 7.5h18V10a2 2 0 0 0 0 4v2.5H3V14a2 2 0 0 0 0-4zM14.5 7.5v9',
  bolt: 'M13 3 5 14h6l-1 7 8-11h-6z',
  heart: 'M12 20s-7.5-4.5-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.5 12 20 12 20z',
  home: 'M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5h4v5',
  globe: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9M12 3c-2.5 2.5-3.5 5.5-3.5 9s1 6.5 3.5 9',
  dollar: 'M12 3v18M16.5 7H10a2.5 2.5 0 0 0 0 5h4a2.5 2.5 0 0 1 0 5H7',
  gift: 'M4 11h16v9H4zM3 7.5h18V11H3zM12 7.5V20M12 7.5C10.5 4 7 4 7 6s3 1.5 5 1.5M12 7.5c1.5-3.5 5-3.5 5-1.5s-3 1.5-5 1.5',
  coffee: 'M5 9h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H15.5M8.5 3.5v2.5M12.5 3.5v2.5',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  briefcase: 'M4 8h16v11H4zM9 8V5.5h6V8M4 13h16',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  wrench: 'M3 10h18v9H3zM8 10V7a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3M3 14h18',
  gauge: 'M4 17a8 8 0 1 1 16 0M12 17l4-5M4 17h16',
  // UI
  pencil: 'M15 4l5 5M17.5 6.5 7 17l-3 1 1-3L15.5 4.5',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
  rules: 'M13 3 5 14h6l-1 7 8-11h-6z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  download: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  card: 'M3 6h18v12H3zM3 10h18M7 15h3',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  bank: 'M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
  piggy: 'M5 11a6 5 0 0 1 11-3h2l-1 3a5 5 0 0 1 1 3v2h-2l-1 2h-2l-.5-1.5h-4L8 18H6l-.5-2A5 5 0 0 1 5 11zM16 11h.5',
  alert: 'M12 4 2.5 20h19zM12 10v4.5M12 17.5h.5',
  trash: 'M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13',
  leaf: 'M12 20v-7M12 13c0-4 3-7 7-7 0 4-3 7-7 7zM12 15c0-3-2.5-5.5-6-5.5 0 3 2.5 5.5 6 5.5z',
  palette: 'M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-1.2-1-1.5-1-2.5 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.2-4-7.5-9-7.5zM7.5 11h.5M10 7.5h.5M15 7.5h.5',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function Icon({ name, size = 18, strokeWidth = 2, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
