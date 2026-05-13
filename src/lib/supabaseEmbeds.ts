/**
 * PostgREST exige el fk cuando hay más de una relación entre dos tablas.
 * @see https://postgrest.org/en/stable/references/api/resource_embedding.html
 */
export const documentListSelect =
  '*, author:profiles!author_id(id,full_name,avatar_url,role), category:categories!category_id(id,name,color,icon)';

export const documentDetailSelect =
  '*, author:profiles!author_id(id,full_name,avatar_url,role,department), category:categories!category_id(id,name,color,icon,slug)';
