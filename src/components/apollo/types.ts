export type ApolloData = {
  success: boolean;
  found?: boolean;
  // Person basics
  id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  headline?: string;
  photoUrl?: string;
  // Contact info
  email?: string;
  emailStatus?: string;
  emailSource?: string;
  emailTrueStatus?: string;
  extrapolatedEmailConfidence?: number | null;
  emailDomainCatchall?: boolean | null;
  freeDomain?: boolean | null;
  personalEmails?: string[];
  phone?: string;
  phoneNumbers?: { sanitized_number: string; type: string }[];
  // Location
  streetAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  formattedAddress?: string;
  timeZone?: string;
  // Social profiles
  linkedinUrl?: string;
  twitterUrl?: string;
  facebookUrl?: string;
  githubUrl?: string;
  // Seniority & department
  seniority?: string;
  departments?: string[];
  subdepartments?: string[];
  functions?: string[];
  // Engagement signals
  isLikelyToEngage?: boolean | null;
  intentStrength?: string | null;
  showIntent?: boolean;
  revealedForCurrentTeam?: boolean | null;
  // Organization
  organizationId?: string;
  organizationName?: string;
  organizationDomain?: string;
  organizationWebsite?: string;
  organizationLogo?: string;
  organizationIndustry?: string;
  organizationIndustries?: string[];
  organizationSecondaryIndustries?: string[];
  organizationSize?: number;
  organizationFounded?: number;
  organizationRevenue?: string;
  organizationRevenueRaw?: number;
  organizationDescription?: string;
  organizationKeywords?: string[];
  organizationPhone?: string;
  // Org location
  organizationStreetAddress?: string;
  organizationCity?: string;
  organizationState?: string;
  organizationCountry?: string;
  organizationPostalCode?: string;
  organizationRawAddress?: string;
  // Org social
  organizationLinkedin?: string;
  organizationTwitter?: string;
  organizationFacebook?: string;
  organizationBlogUrl?: string;
  organizationAngellistUrl?: string;
  organizationCrunchbaseUrl?: string;
  // Org classification
  organizationSicCodes?: string[];
  organizationNaicsCodes?: string[];
  organizationAlexaRanking?: number;
  organizationLanguages?: string[];
  organizationRetailLocationCount?: number;
  // Org public trading
  organizationPubliclyTradedSymbol?: string;
  organizationPubliclyTradedExchange?: string;
  // Org growth
  organizationHeadcountGrowth6mo?: number | null;
  organizationHeadcountGrowth12mo?: number | null;
  organizationHeadcountGrowth24mo?: number | null;
  // Org technologies
  organizationTechnologies?: string[];
  // Employment history
  employmentHistory?: {
    title: string;
    organizationName: string;
    startDate?: string;
    endDate?: string;
    current?: boolean;
    description?: string;
    degree?: string;
    kind?: string;
  }[];
  error?: string;
};
