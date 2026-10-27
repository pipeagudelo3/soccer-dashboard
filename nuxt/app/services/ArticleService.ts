import type { ArticleInterface } from '#shared/interfaces/ArticleInterface';
import { articles } from '~/data/articles';

export class ArticleService {
  public static getArticleBySlug(slug: string): ArticleInterface | undefined {
    return articles.find((article) => article.slug === slug);
  }

  public static getArticles(): readonly ArticleInterface[] {
    return articles;
  }
}
