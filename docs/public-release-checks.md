# Public release verification

11 September 2026. This report supplements the [original London data verification](completion-report.md) with the public repository and bilingual interface checks.

| Check                                        | Result                                                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript, ESLint and Next production build | Passed after the language integration and final wording adjustment.                                                                              |
| Frontend unit tests                          | 14 passed: 7 existing product cases and 7 language/presentation cases.                                                                           |
| Browser smoke                                | 2 passed, including Chinese/English switching, mobile navigation and preference persistence across reload.                                       |
| Real-London browser journeys                 | 5 passed against the actual warehouse, including a Chinese investigation with unchanged canonical scores.                                        |
| Docker website build                         | Passed with frozen pnpm dependencies.                                                                                                            |
| Container data commands                      | Data status and active-version validation passed.                                                                                                |
| Local launcher                               | Start, stop/restart and invocation from another working directory exercised; data retained.                                                      |
| Documentation                                | Local Markdown links and heading anchors checked; public guides formatted consistently.                                                          |
| Visual review                                | Chinese landing, area details and methodology inspected in-browser at desktop and 390px mobile widths; English and Chinese screenshots retained. |

Language tests also cover blocked local storage, unknown preferences, all business/component labels, structured server explanations, unchanged geographic identifiers, UTC dates and missing evidence. Locale changes do not alter API score inputs or reset investigation state. The browser's language attribute and page title track the selected language.

The active warehouse remains `ldn-20260911T130817-f16e80`. These publication checks reused the already verified warehouse. They do **not** claim a second download of every publisher's dataset into an empty database or a cross-machine restoration of the recorded historical edition.

The [public CI workflow](https://github.com/kyky2347/project-oa90ug6m/actions/workflows/ci.yml) independently checks the repository from a clean checkout, including offline source/scoring tests, PostGIS schema checks, frontend checks, browser smoke and Linux API native-library imports. Open the run for the revision you intend to download to inspect its outcome.

The original performance report retains its original observations. A subsequent browser scheduling sample from this release check is recorded separately in [frontend-performance-public-release.json](frontend-performance-public-release.json); neither sample establishes a production SLA or physical-GPU frame rate. Future browser measurements write an ignored `frontend-performance-latest.json` so a test run does not overwrite the recorded release evidence.

[Chinese interface and screenshots](../README.zh-CN.md) · [Reproduction boundaries](reproducibility.md) · [Product tour](product-tour.md)
