export interface ArticleInterface {
  readonly category: string;
  readonly paragraphs: readonly string[];
  readonly publishedDate: string;
  readonly slug: string;
  readonly summary: string;
  readonly title: string;
}
