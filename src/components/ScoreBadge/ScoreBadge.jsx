import "./ScoreBadge.css";

export default function ScoreBadge({ score }) {
  if (score === null || score === undefined) return null;

  const tier = score >= 8 ? "high" : score >= 5 ? "mid" : "low";

  return (
    <div className={`score-badge score-badge--${tier}`}>
      <span className="score-badge__value">{score}</span>
      <span className="score-badge__max">/10</span>
    </div>
  );
}
