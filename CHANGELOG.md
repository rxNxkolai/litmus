# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-25

### Added

- Initial release.
- Suite runner with prompt templating, suite defaults, and per-case variables.
- 11 assertions: `contains`, `not-contains`, `equals`, `regex`, `is-json`,
  `json-path`, `one-of`, `min-length`, `max-length`, `max-latency-ms`,
  `max-cost-usd`.
- Providers: deterministic offline `mock` (`mock:sentiment`, `mock:json`,
  `mock:echo`) plus thin OpenAI and Anthropic adapters over `fetch`.
- Approximate token and USD cost accounting.
- CLI commands `run`, `report`, `list`, `init` with pretty/JSON output and exit
  codes suitable for CI gating.
- Run history persisted to `.litmus/runs/` with run-over-run regression and
  fix detection.
- Interactive, self-contained HTML report.
- Programmatic API: `runSuite`, `loadSuite`, `renderHtml`, and more.
- Zero runtime dependencies.

[0.1.0]: https://github.com/rxNxkolai/litmus/releases/tag/v0.1.0
