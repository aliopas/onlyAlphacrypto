import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'OnlyAlpha Privacy Policy — how we collect, use, and protect your data.',
  openGraph: {
    title: 'Privacy Policy',
    description: 'OnlyAlpha Privacy Policy — how we collect, use, and protect your data.',
    url: `${SITE_URL}/privacy`,
    siteName: 'OnlyAlpha',
    type: 'website',
    images: [{ url: `${SITE_URL}/opengraph-image.png`, width: 1200, height: 630, alt: 'Privacy Policy — OnlyAlpha' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy Policy',
    description: 'OnlyAlpha Privacy Policy — how we collect, use, and protect your data.',
  },
  alternates: {
    canonical: `${SITE_URL}/privacy`,
  },
};

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Link href="/" className="text-[#555] hover:text-[var(--color-primary)] text-sm font-mono block mb-6">
        ← Back to Home
      </Link>

      <h1 className="text-2xl font-bold text-white mb-2">Privacy Policy</h1>
      <p className="text-sm text-[#555] mb-8">Last Updated: April 2026</p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-3">Introduction</h2>
        <p className="text-sm text-[#888] leading-relaxed">
          OnlyAlpha (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered cryptocurrency intelligence platform. Please read this policy carefully. If you do not agree with the terms of this privacy policy, please do not access the platform.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-3">Information We Collect</h2>
        <p className="text-sm text-[#888] leading-relaxed mb-3">
          We collect several types of information for various purposes to provide and improve our service to you.
        </p>
        <h3 className="text-base font-medium text-[#AAA] mb-2">Automatically Collected Information</h3>
        <p className="text-sm text-[#888] leading-relaxed mb-3">
          When you visit our platform, we automatically collect certain information about your device, including information about your web browser, IP address, time zone, and some of the cookies that are installed on your device. Additionally, as you navigate through the platform, we collect information about the individual web pages or products that you view, what websites or search terms referred you to the platform, and information about how you interact with the platform.
        </p>
        <h3 className="text-base font-medium text-[#AAA] mb-2">Analytics Data</h3>
        <p className="text-sm text-[#888] leading-relaxed mb-3">
          We use Google Analytics to analyze how visitors use our platform. Google Analytics collects information such as how often users visit the platform, what pages they visit, and what other sites they use before coming to the platform. We use the information we obtain from Google Analytics only to improve our platform. Google Analytics does not collect personally identifiable information.
        </p>
        <h3 className="text-base font-medium text-[#AAA] mb-2">Information We Do Not Collect</h3>
        <p className="text-sm text-[#888] leading-relaxed">
          Currently, we do NOT collect personal identifiers such as names, email addresses, phone numbers, or payment information. OnlyAlpha does not require user account registration to access its features. If we introduce account-based features in the future, we will update this policy accordingly.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-3">How We Use Information</h2>
        <p className="text-sm text-[#888] leading-relaxed mb-3">
          We use the information we collect in various ways, including to:
        </p>
        <ul className="list-disc list-inside text-sm text-[#888] space-y-1">
          <li>Provide, operate, and maintain our platform</li>
          <li>Improve, personalize, and expand our platform</li>
          <li>Understand and analyze how you use our platform</li>
          <li>Develop new products, features, and services</li>
          <li>Optimize our AI models for better accuracy and relevance</li>
          <li>Communicate with you regarding service updates and maintenance</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-3">Cookies & Tracking</h2>
        <p className="text-sm text-[#888] leading-relaxed mb-3">
          We use cookies and similar tracking technologies to track the activity on our platform and hold certain information. Cookies are files with small amount of data which may include an anonymous unique identifier.
        </p>
        <h3 className="text-base font-medium text-[#AAA] mb-2">Google Analytics Cookies</h3>
        <p className="text-sm text-[#888] leading-relaxed mb-3">
          Our platform uses Google Analytics, which uses cookies. Google Analytics cookies are typically stored for 2 years. These cookies help us understand user behavior and improve our platform. The data collected is anonymized where possible.
        </p>
        <h3 className="text-base font-medium text-[#AAA] mb-2">Advertising Cookies</h3>
        <p className="text-sm text-[#888] leading-relaxed mb-3">
          Currently, we do not use advertising cookies. If we decide to include advertising on our platform in the future, we will update this policy and provide you with the ability to opt-out.
        </p>
        <h3 className="text-base font-medium text-[#AAA] mb-2">How to Disable Cookies</h3>
        <p className="text-sm text-[#888] leading-relaxed">
          You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our platform. Most web browsers allow you to control cookies through their settings preferences.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-3">Third-Party Services</h2>
        <p className="text-sm text-[#888] leading-relaxed mb-3">
          Our platform may employ third-party companies and services due to the following reasons:
        </p>
        <ul className="list-disc list-inside text-sm text-[#888] space-y-1 mb-3">
          <li>To facilitate our service</li>
          <li>To provide the service on our behalf</li>
          <li>To perform service-related services</li>
          <li>To assist us in analyzing how our service is used</li>
        </ul>
        <h3 className="text-base font-medium text-[#AAA] mb-2">Google Analytics</h3>
        <p className="text-sm text-[#888] leading-relaxed mb-3">
          We use Google Analytics to analyze the use of our platform. Google Analytics gathers data on website traffic and behavior. This data is processed according to Google&apos;s privacy policy. We do not have control over Google&apos;s use of data. You can review Google&apos;s privacy policy at https://policies.google.com/privacy.
        </p>
        <h3 className="text-base font-medium text-[#AAA] mb-2">Binance API</h3>
        <p className="text-sm text-[#888] leading-relaxed mb-3">
          We use the Binance API to retrieve public cryptocurrency market data, including prices, trading volumes, and market statistics. This data is publicly available and does not include personal information. We are not responsible for Binance&apos; data handling practices.
        </p>
        <h3 className="text-base font-medium text-[#AAA] mb-2">Moralis</h3>
        <p className="text-sm text-[#888] leading-relaxed mb-3">
          We use Moralis to access blockchain data and on-chain analytics. This data is publicly available on the blockchain and does not contain personal information. We are not responsible for Moralis&apos; data handling practices.
        </p>
        <h3 className="text-base font-medium text-[#AAA] mb-2">OpenRouter / AI Providers</h3>
        <p className="text-sm text-[#888] leading-relaxed">
          We use OpenRouter to route requests to various AI model providers (such as DeepSeek, Gemini, and GPT) for content generation. We do not send any personally identifiable information to these providers. The queries sent contain only public market data, blockchain data, and non-personal prompts.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-3">AI-Generated Content</h2>
        <p className="text-sm text-[#888] leading-relaxed">
          All content on OnlyAlpha, including market analysis, market scenarios, airdrop recommendations, and research articles, is generated by artificial intelligence models. The AI models do not use any personal information in the content generation process. The inputs to our AI systems consist solely of public market data, blockchain data, and non-personal prompts. No personal data is used to train or fine-tune our AI models.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-3">Data Security</h2>
        <p className="text-sm text-[#888] leading-relaxed">
          We value your trust in providing us your Personal Information, thus we are striving to use commercially acceptable means of protecting it. But remember that no method of transmission over the internet, or method of electronic storage is 100% secure and reliable, and we cannot guarantee its absolute security. Our platform uses SSL/HTTPS encryption to protect data in transit. We do not store personal information on our servers, as we currently do not collect it. We regularly review our security practices and update them as necessary.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-3">Your Rights</h2>
        <p className="text-sm text-[#888] leading-relaxed mb-3">
          Depending on your location, you may have certain rights regarding your personal information. These rights may include:
        </p>
        <ul className="list-disc list-inside text-sm text-[#888] space-y-1">
          <li>The right to access and receive a copy of your personal information</li>
          <li>The right to rectification or correction of your personal information</li>
          <li>The right to erasure or deletion of your personal information</li>
          <li>The right to restrict or object to processing of your personal information</li>
          <li>The right to data portability</li>
          <li>The right to withdraw consent</li>
        </ul>
        <p className="text-sm text-[#888] leading-relaxed mt-3">
          Please note that since we currently collect minimal information and no personal identifiers, many of these rights may not be applicable. If you would like to exercise any of these rights, please contact us at contact@onlyalphacrypto.com.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-3">Children&apos;s Privacy</h2>
        <p className="text-sm text-[#888] leading-relaxed">
          Our service is not intended for individuals under the age of 18. We do not knowingly collect personally identifiable information from children under 18. If you are a parent or guardian and you are aware that your child has provided us with personal information, please contact us. If we become aware that we have collected personal information from children without verification of parental consent, we take steps to remove that information from our servers.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-3">Changes to This Policy</h2>
        <p className="text-sm text-[#888] leading-relaxed">
          We may update our Privacy Policy from time to time. Thus, you are advised to review this page periodically for any changes. We will notify you of any changes by posting the new Privacy Policy on this page. These changes are effective immediately after they are posted on this page. The date at the top of this policy indicates when it was last revised.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-3">Contact Us</h2>
        <p className="text-sm text-[#888] leading-relaxed">
          If you have any questions about this Privacy Policy, please contact us at contact@onlyalphacrypto.com. We will respond to your inquiry within a reasonable timeframe.
        </p>
      </section>
    </div>
  );
}
