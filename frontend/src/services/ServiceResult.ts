export type ServiceResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      errors: string[];
      // Safe HTTP metadata lets consumers handle stale records without parsing display messages.
      statusCode?: number;
    };
