import { ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// Kept in sync by hand with legal/PRIVACY_POLICY.md - that file is the
// source of review copy (has the "needs a lawyer" banner and reviewer
// notes); this is the clean, end-user-facing rendering of the same
// content, plus a live URL for App Store Connect's privacy policy field
// once web.output: "server" is deployed (this screen is also a web route).
export default function PrivacyPolicyScreen() {
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>Privacy Policy</ThemedText>
        <ThemedText style={styles.meta}>Last updated: [date]</ThemedText>

        <ThemedText style={styles.paragraph}>
          Lightbulb doesn&apos;t require you to create an account, sign in, or provide your name,
          email address, or any other identifying information to use the app.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.heading}>Information you provide</ThemedText>
        <ThemedText style={styles.paragraph}>
          In the app&apos;s Preferences screen, you may optionally set an age range (a broad
          bracket, not your exact age), a political leaning (a broad category, not a detailed
          political profile), a gender (Woman, Man, or Non-binary, with an explicit &quot;Prefer
          not to say&quot; choice), and a location (a broad region, not your exact city or
          device location). All of these are stored only on your device, never on a server or
          account we control. You can change or clear any of them anytime in Preferences.
        </ThemedText>
        <ThemedText style={styles.paragraph}>
          We do not currently collect your name, email address, exact age, or precise location.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.heading}>The &quot;Illuminate&quot; AI feature</ThemedText>
        <ThemedText style={styles.paragraph}>
          When you tap Illuminate on an article, we send the headline, source name, and domain —
          plus your bucketed age range, political leaning, gender, and region if you&apos;ve set
          them — to our AI provider, Anthropic, to generate an explanation. We never send the
          full article text, your exact age, name, or precise location. Anthropic acts as a data
          processor for this feature.
        </ThemedText>
        <ThemedText style={styles.paragraph}>
          To keep the app fast and affordable, we cache generated explanations on our own server
          infrastructure (currently Upstash). The cache is keyed by the article and, for the
          personalized portion, by your bucketed age range, political leaning, gender, and region
          — never by anything tied to you or your device. If our AI provider is unavailable, the
          app falls back to a generic, on-device canned explanation.
        </ThemedText>
        <ThemedText style={styles.paragraph}>
          Political opinion is treated as sensitive data in some jurisdictions (GDPR
          &quot;special category data,&quot; CCPA/CPRA &quot;sensitive personal
          information&quot;) — setting it is entirely optional. Gender is not on either of
          those lists, but we still treat it with the same care: optional, device-local, and
          bucketed.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.heading}>News sources</ThemedText>
        <ThemedText style={styles.paragraph}>
          Lightbulb aggregates headlines from public RSS feeds and links to the original publisher
          for every article — we don&apos;t republish full article text. On web, RSS and
          article-image fetches are routed through our own server, not a third party — no outside
          service sees which feeds or articles you&apos;re loading.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.heading}>What we don&apos;t do</ThemedText>
        <ThemedText style={styles.paragraph}>
          As of this writing, Lightbulb shows no ads, has no in-app purchases, uses no analytics or
          crash-reporting tools, doesn&apos;t collect device or advertising identifiers or precise
          location, and doesn&apos;t sell or share your data for advertising. If any of this
          changes, we&apos;ll update this policy first.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.heading}>Children&apos;s privacy</ThemedText>
        <ThemedText style={styles.paragraph}>
          Lightbulb is not directed at children, and the age-range preference starts at 18-24. We
          do not knowingly collect data from children.
        </ThemedText>

        <ThemedText type="subtitle" style={styles.heading}>Contact us</ThemedText>
        <ThemedText style={styles.paragraph}>
          Questions about this policy or your data: [contact email]
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  title: {
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 20,
  },
  heading: {
    marginTop: 20,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.9,
    marginBottom: 8,
  },
});
