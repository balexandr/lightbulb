# App Store Privacy Nutrition Label — worksheet

**DRAFT — this is a starting point for filling out the actual App Store
Connect privacy questionnaire, not a substitute for it.** Apple's
categories and their exact rules change; verify each row against the
current App Store Connect UI when you actually submit, not just this
file. Best-effort mapping based on the app's code as of this writing —
rows marked ⚠️ need a second look before you submit, since they hinge on
Apple-specific judgment calls, not just "do we collect X."

Per docs/TECHNICAL_GUIDE.md §12.4: mis-declaring the political-belief
data type is a more common rejection/removal reason in practice than
content-moderation issues. Don't skip the ⚠️ rows.

## How to read this

For each Apple category: do we collect it, and if so, is it "Linked to
You" (tied to identity), "Used to Track You" (linked across apps/sites
for advertising), or "Not Linked to You" (collected but not tied to an
identifiable person). Lightbulb has no accounts, no device/advertising
IDs sent anywhere, and no analytics SDK — so anything we do collect
should land in "Not Linked to You," but confirm that reasoning holds up
under Apple's actual definitions before you rely on it.

| Apple category | Collected? | Suggested declaration | Notes |
|---|---|---|---|
| Contact Info (name, email, phone, address) | No | — | No account, no forms collecting this |
| Health & Fitness | No | — | |
| Financial Info | No | — | No payments, no IAP |
| Location (precise or coarse) | No | — | Not requested or collected |
| **Sensitive Info — Political opinion** | ⚠️ Yes | Likely "Not Linked to You" | User-set, device-local by default; bucketed value is sent to Anthropic per-request and transiently appears in our Redis cache key (see PRIVACY_POLICY.md "Caching") — but never tied to a user/device identifier anywhere in that path. This is the highest-scrutiny row; get real legal/App-Review-experienced eyes on it before submitting. |
| Contacts (address book) | No | — | Not accessed |
| User Content (photos, videos, messages, etc.) | No | — | No user-generated content in the app |
| Browsing History | No | — | We don't track which articles you open across sessions |
| Search History | No | — | No in-app search feature currently |
| Identifiers (user ID, device ID) | No | — | No accounts, no device/advertising ID collected |
| Purchases | No | — | No IAP |
| Usage Data (product interaction, ad data) | No | — | No analytics SDK integrated as of this writing |
| Diagnostics (crash/performance data) | No | — | No crash reporting SDK integrated as of this writing |
| **Other Data — Age range** | ⚠️ Yes | Likely "Not Linked to You" | Same path as political opinion: bucketed (e.g. "25-34"), device-local by default, sent per-request to Anthropic and transiently in our cache key. Not Apple's typical "Sensitive Info" bucket, but still real data leaving the device — probably belongs under "Other Data," confirm the exact sub-type when filling out App Store Connect. |

## If/when this changes

Update this worksheet (and the actual App Store Connect declaration)
*before* shipping any of the following, not after:

- Ads or an ad SDK (adds Identifiers/Usage Data, likely "Used to Track
  You" depending on the SDK)
- Analytics or crash reporting (adds Usage Data / Diagnostics)
- Accounts or sign-in (adds Contact Info, and likely upgrades the
  political-opinion/age rows from "Not Linked to You" to "Linked to
  You," since they'd now be tied to an identity)
- Location collection (adds Location)
