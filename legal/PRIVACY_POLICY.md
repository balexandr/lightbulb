# Lightbulb Privacy Policy

**DRAFT — not reviewed by a lawyer.** This is an engineering-written first
pass, accurate to the app's actual code as of the date below. Have an
actual attorney review it — especially the political-preference handling
below — before publishing or submitting to an app store. Fill in the
bracketed placeholders before publishing.

Last updated: [date] · Effective date: [date]

## Who we are

Lightbulb is developed by [your name / entity]. If you have questions
about this policy or your data, contact us at [contact email].

## No account required

Lightbulb doesn't require you to create an account, sign in, or provide
your name, email address, or any other identifying information to use
the app.

## Information you provide

In the app's Preferences screen, you may optionally set:

- **Age range** (a broad bracket, e.g. "25-34" — not your exact age)
- **Political leaning** (a broad category, e.g. "progressive," "moderate,"
  "conservative" — not a detailed political profile)

Both are stored **only on your device** (local app storage), not on any
server or account we control. You can change or clear them at any time in
Preferences, and clearing them deletes them from your device.

We do not currently collect your name, email address, exact age, gender,
or precise location, and nothing in the app's Preferences screen asks for
them.

**Political opinion is treated as sensitive data in some jurisdictions**
(e.g. "special category data" under GDPR Article 9, "sensitive personal
information" under CCPA/CPRA). Setting a political-leaning preference is
entirely optional, and the app functions fully without it.

## The "Illuminate" AI feature

When you tap "Illuminate" on an article, the app sends the following to
our AI provider, **Anthropic** (maker of Claude), to generate an
explanation:

- The article's headline, source name, and domain (e.g. "bbc.com")
- If you've set them: your bucketed age range and political leaning
  (e.g. "25-34," "progressive") — never your exact age, name, or location

We never send the full article text, only the headline and source
metadata above.

Anthropic acts as a data processor for this feature. See
[Anthropic's privacy policy](https://www.anthropic.com/legal/privacy) for
how they handle data submitted to their API.

### Caching (why this matters for your privacy)

To avoid generating the same explanation repeatedly and to keep the app
fast and affordable to run, we cache AI-generated explanations on our own
server infrastructure, currently hosted via **Upstash** (a Redis
database provider). This cache is keyed by the article and, for the
personalized portion of the explanation, by your *bucketed* age range and
political leaning (e.g. a cache key might look like
`article-x::25-34::progressive`) — never by any identifier tied to you or
your device. Upstash cannot connect a cached entry back to any individual
user.

This means a bucketed category value (like "progressive") can
transiently exist in our cache infrastructure, associated only with an
article and not with you personally. **This is a nuance worth specific
legal review** given political opinion's sensitive-data status in some
jurisdictions — the data is anonymized/aggregated at the point it's
cached, but a cautious reading of some regulations may still warrant
explicit disclosure, which this section is intended to provide.

If our AI provider is unavailable, the app falls back to a generic,
non-personalized canned explanation generated entirely on your device.

## News sources

Lightbulb aggregates headlines from public RSS feeds, currently: BBC,
NPR, Ars Technica, TechCrunch, The Guardian, Al Jazeera, CBC, The New
York Times, Wired, Engadget, and Hacker News. [Reddit support exists in
the app's code but is disabled by default as of this writing — update
this section if it's ever turned back on.] We link to the original
publisher for every article; we don't republish full article text.

On the web version of the app, RSS and article-image fetches are routed
through a third-party CORS proxy, **api.allorigins.win**, to work around
browser cross-origin restrictions. This proxy sees the URLs being
fetched (RSS feed URLs and article URLs) but not any of your personal
information.

## What we don't do

As of this writing, Lightbulb:

- Does not show ads or use any advertising SDK
- Does not have in-app purchases or any paid tier
- Does not use analytics or tracking SDKs
- Does not use crash-reporting tools
- Does not collect device identifiers, advertising IDs, or precise
  location
- Does not sell or share your data with third parties for advertising

If any of this changes (e.g. ads, analytics, or accounts are added
later), this policy will be updated first.

## Children's privacy

Lightbulb is not directed at children, and the age-range preference
starts at 18-24. We do not knowingly collect data from children.

## Changes to this policy

We'll update the "Last updated" date above when this policy changes. If
we start collecting new categories of data, we'll update this policy
before that change ships.

## Contact us

Questions about this policy or your data: [contact email]
