import { useMemo, useState } from "react";
import ScoreBadge from "../ScoreBadge/ScoreBadge.jsx";
import "./RunHistory.css";

function snippet(values, max = 70) {
  const text = Object.values(values || {}).filter(Boolean).join(" · ");
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RunHistory({ entries, onClear }) {
  const [modelFilter, setModelFilter] = useState("all");

  const models = useMemo(
    () => Array.from(new Set(entries.map((e) => e.model).filter(Boolean))),
    [entries]
  );

  const filtered = useMemo(
    () => (modelFilter === "all" ? entries : entries.filter((e) => e.model === modelFilter)),
    [entries, modelFilter]
  );

  const avgByModel = useMemo(() => {
    const groups = {};
    for (const e of entries) {
      if (typeof e.score !== "number") continue;
      if (!groups[e.model]) groups[e.model] = [];
      groups[e.model].push(e.score);
    }
    return Object.fromEntries(
      Object.entries(groups).map(([m, scores]) => [
        m,
        (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1),
      ])
    );
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="panel run-history">
        <div className="panel__label">Run history</div>
        <p className="run-history__empty">
          Runs you grade will show up here so you can compare scores across models over time.
        </p>
      </div>
    );
  }

  return (
    <div className="panel run-history">
      <div className="run-history__header">
        <div className="panel__label">Run history ({entries.length})</div>
        <div className="run-history__actions">
          <select
            className="field run-history__filter"
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
          >
            <option value="all">All models</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn--secondary" onClick={onClear}>
            Clear
          </button>
        </div>
      </div>

      {Object.keys(avgByModel).length > 1 && (
        <div className="run-history__averages">
          {Object.entries(avgByModel).map(([m, avg]) => (
            <span key={m} className="run-history__avg-chip">
              {m}: avg {avg}
            </span>
          ))}
        </div>
      )}

      <div className="run-history__table-wrap">
        <table className="run-history__table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Model</th>
              <th>Score</th>
              <th>Input</th>
              <th>Reasoning</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.id}>
                <td className="run-history__time">{formatTime(entry.timestamp)}</td>
                <td className="run-history__model">{entry.model}</td>
                <td>
                  <ScoreBadge score={entry.score} />
                </td>
                <td className="run-history__snippet" title={snippet(entry.values, 500)}>
                  {snippet(entry.values)}
                </td>
                <td className="run-history__snippet" title={entry.reasoning}>
                  {entry.reasoning}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
