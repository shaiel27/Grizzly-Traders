-- Autores: traducción al inglés del perfil y visibilidad en el listado /autor.
-- Aplicada en vivo el 2026-10-23 como 'autores_traduccion_y_listado'.
alter table public.perfiles_autores
  add column if not exists bio_en text,
  add column if not exists role_en text,
  add column if not exists listed boolean not null default true;

-- Solo el perfil de Moises Orraiz aparece en el listado /autor; el perfil de la marca sigue
-- existiendo porque firma los articulos del pipeline y su pagina es alcanzable desde la firma.
update public.perfiles_autores set listed = false where slug = 'grizzly-traders';

update public.perfiles_autores set
  role_en = 'Founder of Grizzly Traders',
  bio_en = E'Financial markets analyst specializing in U.S. equities, futures markets, and technical and fundamental analysis, with a particular interest in small-cap companies and investment opportunities.\n\nHis background includes stock market research, company valuation, capital structure analysis, and active trading of U.S. index futures.\n\nHe is the founder of Grizzly Traders, a platform dedicated to economic and financial analysis, stock market education, and market information from an independent perspective.'
where slug = 'moises-orraiz';

update public.perfiles_autores set
  role_en = 'Grizzly Traders Editorial Team',
  bio_en = E'Grizzly Traders is an independent portal for economic and financial analysis, stock market education, and market outreach.\n\nThis profile signs the portal''s editorial coverage: articles produced by monitoring financial information sources, published without attribution to an individual byline.'
where slug = 'grizzly-traders';
