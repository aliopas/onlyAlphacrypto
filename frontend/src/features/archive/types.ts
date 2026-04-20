export type ArchiveArticle = {
  id: number;
  coinSymbol: string;
  headline: string;
  hook: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  sentiment: string | null;
  verdict: string | null;
  convictionScore: number | null;
  posture: string | null;
  riskTags: string[] | null;
  majorUpdateCount: number;
  minorUpdateCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ArchiveGroup = {
  year: number;
  month: number;
  label: string;
  articles: ArchiveArticle[];
};
