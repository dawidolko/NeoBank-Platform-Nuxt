const SITE_URL = 'https://neobank.dawidolko.pl'
const OG_IMAGE = `${SITE_URL}/og-image.png`

interface PublicSeo {
  path: string
  title: string
  description: string
}

/**
 * Head tags for the pages search engines may index. Everything behind sign-in is
 * disallowed in robots.txt, so only these need a canonical and social tags.
 */
export function usePublicSeo({ path, title, description }: PublicSeo) {
  const url = `${SITE_URL}${path}`

  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogUrl: url,
    ogType: 'website',
    ogSiteName: 'NeoBank',
    ogImage: OG_IMAGE,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: 'NeoBank, a digital banking platform',
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: OG_IMAGE,
  })

  useHead({
    link: [{ rel: 'canonical', href: url }],
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebSite',
              '@id': `${SITE_URL}/#website`,
              name: 'NeoBank',
              url: `${SITE_URL}/`,
              inLanguage: 'en',
              author: { '@type': 'Person', name: 'Dawid Olko', url: 'https://dawidolko.pl' },
            },
            {
              '@type': 'WebPage',
              name: title,
              description,
              url,
              inLanguage: 'en',
              isPartOf: { '@id': `${SITE_URL}/#website` },
            },
          ],
        }),
      },
    ],
  })
}
