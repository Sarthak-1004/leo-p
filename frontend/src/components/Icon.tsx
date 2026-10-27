const paths: Record<string, string> = {
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  "eye-off": "M3 3l18 18 M10 5.2a12 12 0 0 1 2-.2c6.5 0 10 7 10 7a17 17 0 0 1-3.3 4 M6.2 6.2A21 21 0 0 0 2 12s3.5 7 10 7a13 13 0 0 0 5-1 M10 10a3 3 0 0 0 4 4",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  book: "M12 5v16 M12 5C8 2 4 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-2-10 1",
  test: "M8 4H5v17h14V4h-3 M9 2h6v4H9z M8 11h8 M8 16h5",
  history: "M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v6l4 2",
  trophy:
    "M8 3h8v7a4 4 0 0 1-8 0z M8 5H3v3a5 5 0 0 0 5 5 M16 5h5v3a5 5 0 0 1-5 5 M12 14v6 M8 21h8",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2",
  users:
    "M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M2 21v-2a8 8 0 0 1 16 0v2 M17 3a4 4 0 0 1 0 8 M22 21v-2a7 7 0 0 0-4-6",
  headphones: "M3 14v-3a9 9 0 0 1 18 0v3 M3 13h4v8H3z M17 13h4v8h-4z",
  writing: "M15 4l5 5 M4 15l12-12 5 5L9 20l-6 1z",
  mic: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0z M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3 M8 22h8",
  chart: "M4 21V11h3v10 M11 21V3h3v18 M18 21v-7h3v7",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 2h6l1 4 4 1 2 5-3 3 1 4-5 3-3-2-4 1-3-5 1-4-2-3 3-4 4 1z",
  arrow: "M4 12h16 M14 6l6 6-6 6",
  chevron: "M9 5l7 7-7 7",
  close: "M5 5l14 14 M19 5L5 19",
  menu: "M3 6h18 M3 12h18 M3 18h18",
  collapse: "M4 3v18 M20 12H9 M14 7l-5 5 5 5",
  lock: "M5 11h14v11H5z M8 11V6a4 4 0 0 1 8 0v5 M12 15v3",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 6v6l4 2",
  check: "M4 12l5 5L20 6",
  plus: "M12 4v16 M4 12h16",
  search: "M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M15 15l6 6",
  logout: "M10 3H3v18h7 M9 12h12 M16 7l5 5-5 5",
  calendar: "M3 5h18v16H3z M3 10h18 M7 2v6 M17 2v6",
  play: "M7 3l14 9-14 9z",
  pause: "M7 4v16 M17 4v16",
  info: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 11v6 M12 7v1",
  shield: "M12 2l9 4v6c0 5-9 10-9 10S3 17 3 12V6z M8 12l3 3 5-6",
};
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="icon"
    >
      <path d={paths[name] || paths.test} />
    </svg>
  );
}
