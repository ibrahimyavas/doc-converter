// The small 4-spoke radial asterisk that anchors the wordmark, per DESIGN.md.
export default function SpikeMark({ size = 20, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="spike-mark"
    >
      <path
        d="M12 1 L14 10 L23 12 L14 14 L12 23 L10 14 L1 12 L10 10 Z"
        fill={color}
      />
    </svg>
  );
}
