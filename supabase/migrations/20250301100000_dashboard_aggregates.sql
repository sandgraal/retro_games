-- Migration: dashboard aggregate RPC helpers
-- Generated: 2025-03-01T10:00:00Z

begin;

create or replace function public.rpc_genre_counts(
  _search text default null,
  _platform text default null,
  _genre text default null,
  _rating_min numeric default null,
  _year_start int default null,
  _year_end int default null
)
returns table(genre text, count bigint)
language sql
as $$
  with filtered_games as (
    select g.id
    from public.games g
    left join public.platforms p on p.id = g.platform_id
    where
      (_search is null or g.name ilike '%' || _search || '%')
      and (
        _platform is null
        or p.name = _platform
        or p.slug = _platform
      )
      and (_rating_min is null or g.rating >= _rating_min)
      and (_year_start is null or g.release_year >= _year_start)
      and (_year_end is null or g.release_year <= _year_end)
  )
  select gn.name as genre, count(*)::bigint as count
  from filtered_games fg
  join public.game_genres gg on gg.game_id = fg.id
  join public.genres gn on gn.id = gg.genre_id
  where (_genre is null or gn.name = _genre)
  group by gn.name
  order by count desc, gn.name asc;
$$;

grant execute on function public.rpc_genre_counts to anon;
grant execute on function public.rpc_genre_counts to authenticated;

create or replace function public.rpc_timeline_counts(
  _search text default null,
  _platform text default null,
  _genre text default null,
  _rating_min numeric default null,
  _year_start int default null,
  _year_end int default null
)
returns table(year int, count bigint)
language sql
as $$
  with filtered_games as (
    select g.*
    from public.games g
    left join public.platforms p on p.id = g.platform_id
    where
      (_search is null or g.name ilike '%' || _search || '%')
      and (
        _platform is null
        or p.name = _platform
        or p.slug = _platform
      )
      and (_rating_min is null or g.rating >= _rating_min)
      and (_year_start is null or g.release_year >= _year_start)
      and (_year_end is null or g.release_year <= _year_end)
      and (
        _genre is null
        or exists (
          select 1
          from public.game_genres gg
          join public.genres gn on gn.id = gg.genre_id
          where gg.game_id = g.id
            and gn.name = _genre
        )
      )
  )
  select fg.release_year as year, count(*)::bigint as count
  from filtered_games fg
  where fg.release_year is not null
  group by fg.release_year
  order by fg.release_year asc;
$$;

grant execute on function public.rpc_timeline_counts to anon;
grant execute on function public.rpc_timeline_counts to authenticated;

commit;
