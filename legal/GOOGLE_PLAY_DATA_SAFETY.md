# Google Play Data Safety form — worksheet

**DRAFT — a starting point for filling out the actual Play Console "Data
safety" form, not a substitute for it.** Google's categories and exact
wording change; verify each row against the live Play Console form when
you actually submit. Mirrors [APP_STORE_PRIVACY_LABELS.md](./APP_STORE_PRIVACY_LABELS.md)'s
mapping for the same underlying data - rows marked ⚠️ need a second look,
since they hinge on Google-specific judgment calls, not just "do we
collect X."

## How to read this

For each Play Console data type: do we collect it, do we share it with
anyone, and is collection required for the app to function or optional.
Lightbulb has no accounts and no analytics/ad SDK, so anything collected
below is optional (the app works fully without setting any of it) and is
collected only to personalize the Illuminate feature.

| Play category | Collected? | Shared? | Required? | Notes |
|---|---|---|---|---|
| Personal info — Name | No | No | — | No account, no forms collecting this |
| Personal info — Email address | No | No | — | |
| Personal info — User IDs | No | No | — | No accounts, no device/advertising ID collected |
| Personal info — Address | No | No | — | |
| Personal info — Phone number | No | No | — | |
| Personal info — Race and ethnicity | No | No | — | |
| **Personal info — Political or religious beliefs** | ⚠️ Yes | ⚠️ Yes (Anthropic) | No, optional | User-set political-leaning preference, device-local by default. Sent to Anthropic per-Illuminate-request and transiently appears in our Redis cache key (see PRIVACY_POLICY.md "Caching") - never tied to a user/device identifier. Highest-scrutiny row here too; get real legal/Play-review-experienced eyes on it before submitting. |
| Personal info — Sexual orientation | No | No | — | |
| **Personal info — Other info (age range, gender)** | ⚠️ Yes | ⚠️ Yes (Anthropic) | No, optional | Bucketed age range (e.g. "25-34") and gender (Woman/Man/Non-binary/unset), same path as political leaning above. Google's taxonomy has no dedicated age/gender row as of this writing - confirm "Other info" is still the right bucket in the live form. |
| **Location — Approximate location** | ⚠️ Yes | ⚠️ Yes (Anthropic) | No, optional | §17.4: user-set broad region (e.g. "northeast," "philadelphia"), never device GPS. Confirm whether Google's "Approximate location" is meant for this self-reported case or only device-sensor location before relying on this row. |
| Location — Precise location | No | No | — | Never requested, never collected |
| Financial info | No | No | — | No payments, no IAP |
| Health and fitness | No | No | — | |
| Messages | No | No | — | |
| Photos and videos | No | No | — | |
| Audio files | No | No | — | expo-speech reads text aloud on-device (Illuminate's briefing); nothing is recorded or uploaded |
| Files and docs | No | No | — | |
| Calendar | No | No | — | |
| Contacts | No | No | — | Not accessed |
| App activity — App interactions | No | No | — | No analytics SDK integrated as of this writing |
| App activity — In-app search history | No | No | — | No in-app search feature currently |
| App activity — Installed apps | No | No | — | |
| App activity — Other user-generated content | No | No | — | No user-generated content in the app |
| App activity — Other actions | No | No | — | |
| Web browsing history | No | No | — | We don't track which articles you open across sessions |
| App info and performance — Crash logs | No | No | — | No crash-reporting tool integrated as of this writing |
| App info and performance — Diagnostics | No | No | — | |
| App info and performance — Other performance data | No | No | — | |
| Device or other IDs | No | No | — | No device/advertising ID collected |

## Data security practices section (separate from the table above)

- **Encrypted in transit:** Yes - all network calls (to our own backend
  and to Anthropic) are HTTPS/TLS. Matches the `ITSAppUsesNonExemptEncryption:
  false` declaration already set in `app.json` for Apple (standard/exempt
  encryption only, no custom crypto).
- **Users can request data deletion:** No account exists to delete. All
  optional preferences (age range, political leaning, gender, region) are
  stored device-local only and can be cleared anytime in the app's
  Preferences screen - state that path explicitly in the form's free-text
  field rather than leaving it blank, since there's no "delete my account"
  flow to point to instead.
- **Independent security review:** No (small app, no such review has been
  done - answer honestly rather than leaving default-unset).

## If/when this changes

Update this worksheet (and the actual Play Console declaration) *before*
shipping any of the following, not after:

- Ads or an ad SDK (adds Device/other IDs, App activity, likely changes
  several rows from "not shared" to "shared for advertising")
- Analytics or crash reporting (adds App activity / App info and
  performance rows)
- Accounts or sign-in (adds Personal info - Name/Email/User IDs)
- Precise (device-sensor) location collection - approximate, self-reported
  region is already covered above; this is about adding GPS/precise
  location on top of that, a materially different privacy posture
