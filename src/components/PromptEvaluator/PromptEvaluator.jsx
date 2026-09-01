import { useMemo, useState } from "react";
import ScoreBadge from "../ScoreBadge/ScoreBadge.jsx";
import RunHistory from "../RunHistory/RunHistory.jsx";
import {
  ANTHROPIC_MODELS,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  PROVIDERS,
  gradeOutput,
  runPrompt,
} from "../../lib/llm.js";
import { extractVariables, fillTemplate } from "../../lib/template.js";
import { appendHistoryEntry, clearHistory, loadHistory } from "../../lib/history.js";
import "./PromptEvaluator.css";

const DEFAULT_TEMPLATE =
  "Summarize the following support ticket in one sentence, in a neutral tone:\n\n{{ticket}}";

const DEFAULT_RUBRIC =
  "1 sentence only. Neutral, factual tone (no sympathy language). Captures the core issue accurately.";

const DEFAULT_TEST_CASE = {
  id: 1,
  values: {
    ticket:
      "My package arrived crushed and the item inside is broken. I've been a customer for 5 years and this is unacceptable, I want a refund immediately.",
  },
  output: "",
  score: null,
  reasoning: "",
  status: "idle",
};

export default function PromptEvaluator() {
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [rubric, setRubric] = useState(DEFAULT_RUBRIC);
  const [testCases, setTestCases] = useState([DEFAULT_TEST_CASE]);
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [lastUsedModel, setLastUsedModel] = useState(null);
  const [history, setHistory] = useState(() => loadHistory());

  const providerMeta = PROVIDERS.find((p) => p.id === provider);
  const llmConfig = { provider, model, baseUrl: customBaseUrl, apiKey: customApiKey };

  function handleProviderChange(nextProvider) {
    setProvider(nextProvider);
    const meta = PROVIDERS.find((p) => p.id === nextProvider);
    setModel(nextProvider === "anthropic" ? DEFAULT_MODEL : "");
    if (meta && !meta.needsBaseUrl) setCustomBaseUrl("");
    if (meta && !meta.needsApiKey) setCustomApiKey("");
  }

  const variables = useMemo(() => extractVariables(template), [template]);

  function updateCaseValue(caseId, varName, value) {
    setTestCases((cases) =>
      cases.map((c) =>
        c.id === caseId ? { ...c, values: { ...c.values, [varName]: value } } : c
      )
    );
  }

  function addCase() {
    const blank = {};
    variables.forEach((v) => {
      blank[v] = "";
    });
    setTestCases((cases) => [
      ...cases,
      { id: Date.now(), values: blank, output: "", score: null, reasoning: "", status: "idle" },
    ]);
  }

  function removeCase(id) {
    setTestCases((cases) => cases.filter((c) => c.id !== id));
  }

  async function runCase(testCase) {
    const { id, values } = testCase;

    setTestCases((cases) =>
      cases.map((c) =>
        c.id === id ? { ...c, status: "running", output: "", score: null, reasoning: "" } : c
      )
    );

    const filled = fillTemplate(template, values);

    try {
      const { text: output, model: usedModel } = await runPrompt(filled, llmConfig);
      setLastUsedModel(usedModel);
      setTestCases((cases) =>
        cases.map((c) => (c.id === id ? { ...c, output, status: "grading" } : c))
      );

      const { score, reasoning } = await gradeOutput(rubric, filled, output, llmConfig);
      setTestCases((cases) =>
        cases.map((c) => (c.id === id ? { ...c, score, reasoning, status: "done" } : c))
      );

      setHistory((prev) =>
        appendHistoryEntry(prev, {
          id: `${id}-${provider}-${usedModel}-${Date.now()}`,
          timestamp: new Date().toISOString(),
          model: `${provider}/${usedModel}`,
          values,
          score,
          reasoning,
        })
      );
    } catch (err) {
      setTestCases((cases) =>
        cases.map((c) =>
          c.id === id
            ? { ...c, status: "error", output: err.message || "Request failed." }
            : c
        )
      );
    }
  }

  async function runAll() {
    const snapshot = testCases;
    for (const testCase of snapshot) {
      await runCase(testCase);
    }
  }

  function handleClearHistory() {
    setHistory(clearHistory());
  }

  function runLabel(status) {
    if (status === "running") return "Running…";
    if (status === "grading") return "Grading…";
    return "Run & grade";
  }

  return (
    <div className="evaluator">
      <div className="evaluator__container">
        <header className="evaluator__header">
          <div className="evaluator__header-row">
            <div>
              <h1 className="evaluator__title">Prompt Evaluator</h1>
              <p className="evaluator__subtitle">
                Write a prompt with <code>{"{{variables}}"}</code>, define test cases, and grade
                every run against a rubric.
              </p>
            </div>

            <div className="model-select">
              <label className="model-select__label" htmlFor="provider-select">
                Provider
              </label>
              <select
                id="provider-select"
                className="field model-select__field"
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>

              <label className="model-select__label model-select__label--spaced" htmlFor="model-input">
                Model
              </label>
              {providerMeta.modelInput === "select" ? (
                <select
                  id="model-input"
                  className="field model-select__field"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {ANTHROPIC_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="model-input"
                  type="text"
                  className="field model-select__field"
                  placeholder={providerMeta.placeholder}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              )}

              {providerMeta.needsBaseUrl && (
                <>
                  <label className="model-select__label model-select__label--spaced" htmlFor="custom-base-url">
                    Base URL
                  </label>
                  <input
                    id="custom-base-url"
                    type="text"
                    className="field model-select__field"
                    placeholder="http://localhost:11434/v1"
                    value={customBaseUrl}
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                  />
                </>
              )}

              {providerMeta.needsApiKey && (
                <>
                  <label className="model-select__label model-select__label--spaced" htmlFor="custom-api-key">
                    API key (optional)
                  </label>
                  <input
                    id="custom-api-key"
                    type="password"
                    className="field model-select__field"
                    placeholder="leave blank if unauthenticated"
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                  />
                </>
              )}

              {lastUsedModel && (
                <div className="model-select__hint">Last response served by: {lastUsedModel}</div>
              )}
            </div>
          </div>
        </header>

        <div className="evaluator__grid">
          <section>
            <div className="panel">
              <div className="panel__label">Prompt template</div>
              <textarea
                className="field field--mono"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={7}
              />
              {variables.length > 0 && (
                <div className="panel__hint">
                  Variables detected: {variables.map((v) => `{{${v}}}`).join(", ")}
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panel__label">Grading rubric (what makes a good response)</div>
              <textarea
                className="field"
                value={rubric}
                onChange={(e) => setRubric(e.target.value)}
                rows={4}
              />
            </div>
          </section>

          <section>
            <div className="cases__header">
              <span className="cases__label">Test cases</span>
              <div className="cases__actions">
                <button type="button" className="btn btn--secondary" onClick={addCase}>
                  + Add case
                </button>
                <button type="button" className="btn btn--primary" onClick={runAll}>
                  Run all
                </button>
              </div>
            </div>

            <div className="cases__list">
              {testCases.map((c) => (
                <div key={c.id} className="panel">
                  <div className="case-card__header">
                    <ScoreBadge score={c.score} />
                    <button
                      type="button"
                      className="case-card__remove"
                      onClick={() => removeCase(c.id)}
                    >
                      remove
                    </button>
                  </div>

                  {variables.map((v) => (
                    <div key={v} className="case-card__field">
                      <div className="case-card__field-label">{v}</div>
                      <textarea
                        className="field"
                        value={c.values[v] || ""}
                        onChange={(e) => updateCaseValue(c.id, v, e.target.value)}
                        rows={2}
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    className="btn btn--primary case-card__run"
                    onClick={() => runCase(c)}
                  >
                    {runLabel(c.status)}
                  </button>

                  {c.output && (
                    <div
                      className={`case-card__output${c.status === "error" ? " case-card__output--error" : ""}`}
                    >
                      {c.output}
                    </div>
                  )}
                  {c.reasoning && <div className="case-card__reasoning">{c.reasoning}</div>}
                </div>
              ))}
            </div>
          </section>
        </div>

        <RunHistory entries={history} onClear={handleClearHistory} />
      </div>
    </div>
  );
}
