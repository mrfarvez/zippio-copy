export default function Dial({ score, label }) {
  const radius = 82;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.75;
  const maxLen = circumference * arcFraction;
  const target = maxLen - maxLen * (score / 100);

  return (
    <div>
      {label && <div className="dial-label">{label}</div>}
      <svg className="dial" viewBox="0 0 200 200">
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF6B57" />
            <stop offset="35%" stopColor="#F2924A" />
            <stop offset="60%" stopColor="#F4B740" />
            <stop offset="100%" stopColor="#35D0A0" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={radius} fill="none" stroke="#1C2833" strokeWidth="14" />
        <circle
          cx="100" cy="100" r={radius} fill="none"
          stroke="url(#gaugeGrad)" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={circumference}
          transform={`rotate(135 100 100)`}
          strokeDashoffset={target}
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
    </div>
  );
}
