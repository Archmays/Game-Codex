# Representative hit-test CI timing follow-up

Run 35508381227 at 0d0567368c488b735697b8ae8e260d8da740ab1d exhausted the unchanged 600-second mobile aggregate deadline on the seventeenth and final surface. Desktop passed in 9.7 minutes. The previous run passed this same test source. The failure screenshot shows an unobscured World Box return button; the trace records it visible, enabled and stable before the aggregate deadline interrupted its trial click.

Before changing the test, the downloaded mobile trace recorded 827 queryCount calls (98.05 seconds), 757 isVisible calls (90.05 seconds), 529 isEnabled calls (63.56 seconds), and 299 getAttribute calls (36.26 seconds). These are protocol method totals, not an independent wall-clock breakdown. Oddity and World Box routes account for most aggregate time while software WebGL is active.

The bounded repair caches each enumeration's cardinality and reads return-control metadata together. Return selection retains link-first priority, DOM order, the same label matching, and Playwright visibility/enabled checks. Hit geometry, trial clicks, real activation, route assertions, all 17 surfaces, both profiles, and the 600-second deadline remain unchanged. No product runtime, package, workflow, retry, or timeout changes are included.

Validation and source identity are recorded in ci-timing-followup.json after the production-preview representative suite completes.
