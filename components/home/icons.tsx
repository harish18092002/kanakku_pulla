// Hand-drawn 24px stroke icons. Used inside SVG diagrams (with x/y) and in plain HTML.

const PATHS = {
  agent: "M12 3v3M7 8h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2ZM9.5 13h.01M14.5 13h.01M9.5 16h5M2.5 12v3M21.5 12v3",
  shield: "M12 3l7.5 3v5.5c0 4.6-3.1 8-7.5 9.5-4.4-1.5-7.5-4.9-7.5-9.5V6L12 3ZM9 12l2.2 2.2L15.5 10",
  bank: "M3 9.5 12 4l9 5.5M4.5 9.5h15M6 12.5v5M10 12.5v5M14 12.5v5M18 12.5v5M3.5 20.5h17",
  store: "M4 9l1.2-5h13.6L20 9M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9M5.5 12.5V20h13v-7.5M10 20v-4h4v4",
  pen: "M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.8 4 20ZM14.5 6l3 3",
  spark: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c.6-3.7 3.7-6 7.5-6s6.9 2.3 7.5 6",
  phone: "M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5ZM11 18.5h2",
  chat: "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-4.5 3.5V17H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM8 10h8M8 13h5",
  approve: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12.2l2.8 2.8L16 9.5",
  ask: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.5a2.5 2.5 0 1 1 3.8 2.1c-.8.5-1.3 1.1-1.3 2M12 16.8h.01",
  block: "M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3L8.3 3ZM9 9l6 6M15 9l-6 6",
  replay: "M4 4v5h5M4.6 9a8 8 0 1 1-.4 5",
  pause: "M9 5v14M15 5v14",
  play: "M7 4.5v15l12-7.5-12-7.5Z",
} as const;

export type IconName = keyof typeof PATHS;

type Props = { name: IconName; size?: number; color?: string; x?: number; y?: number; className?: string };

export function Icon({ name, size = 20, color = "currentColor", x, y, className }: Props) {
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
