-- Joy's Food — seed menu.
-- Mirrors src/lib/seed-menu.ts. Safe to re-run: upserts on slug / (category, name).

insert into public.categories (name, slug, description, display_order) values
  ('Starters',       'starters',     'Something to begin with',            1),
  ('Biryani & Rice', 'biryani-rice', 'Slow-cooked, sealed and steamed',    2),
  ('Main Course',    'main-course',  'Gravies made fresh each morning',    3),
  ('Breads',         'breads',       'Straight off the tandoor',           4),
  ('Desserts',       'desserts',     'House-made, not too sweet',          5),
  ('Beverages',      'beverages',    'To cool things down',                6)
on conflict (slug) do update
  set name          = excluded.name,
      description   = excluded.description,
      display_order = excluded.display_order;

-- Deduplicate on (category_id, name) so re-running the seed updates in place.
create unique index if not exists menu_items_category_name_key
  on public.menu_items (category_id, name);

insert into public.menu_items
  (category_id, name, description, price_paise, is_veg, is_available, prep_lead_time_hours, display_order)
select c.id, v.name, v.description, v.price_paise, v.is_veg, v.is_available, v.prep_lead_time_hours, v.display_order
from (values
  -- Starters
  ('starters',     'Paneer Tikka',                    'Hung-curd marinade, charred in the tandoor, finished with chaat masala and lime.',                            28000, true,  true,   4, 1),
  ('starters',     'Chicken 65',                      'Chettinad-style, curry leaf and red chilli, fried to order so it stays crisp.',                               32000, false, true,   4, 2),
  ('starters',     'Gobi Manchurian',                 'Cauliflower tossed in a garlic-soy glaze. Dry, not gravy.',                                                   22000, true,  true,   4, 3),

  -- Biryani & Rice
  ('biryani-rice', 'Hyderabadi Chicken Dum Biryani',  'Kacchi style, layered raw and sealed with dough. Served with mirchi ka salan and raita. Needs a day''s notice.', 42000, false, true,  24, 1),
  ('biryani-rice', 'Veg Dum Biryani',                 'Seasonal vegetables, saffron milk, fried onion. Served with raita.',                                          32000, true,  true,  12, 2),
  ('biryani-rice', 'Jeera Rice',                      'Long-grain basmati tempered with cumin and ghee.',                                                            16000, true,  true,   4, 3),

  -- Main Course
  ('main-course',  'Butter Chicken',                  'Tandoori chicken in a tomato and cashew gravy, finished with cream and kasuri methi.',                        38000, false, true,   6, 1),
  ('main-course',  'Paneer Butter Masala',            'Fresh paneer, slow-simmered makhani gravy. Mild enough for everyone.',                                        32000, true,  true,   6, 2),
  ('main-course',  'Dal Makhani',                     'Black urad simmered overnight on low heat. Order it a day ahead.',                                            24000, true,  true,  24, 3),
  ('main-course',  'Kadai Mushroom',                  'Button mushrooms, hand-pounded kadai masala, bell pepper.',                                                   28000, true,  false,  6, 4),

  -- Breads
  ('breads',       'Butter Naan',                     'Leavened, tandoor-baked, brushed with white butter.',                                                          6000, true,  true,   2, 1),
  ('breads',       'Tandoori Roti',                   'Whole wheat, no maida, straight off the clay oven wall.',                                                      4000, true,  true,   2, 2),
  ('breads',       'Laccha Paratha',                  'Layered and flaky. Worth the extra twenty rupees.',                                                            7000, true,  true,   2, 3),

  -- Desserts
  ('desserts',     'Gulab Jamun',                     'Two pieces, khoya-based, soaked warm in cardamom syrup.',                                                      9000, true,  true,   6, 1),
  ('desserts',     'Double Ka Meetha',                'Hyderabadi bread pudding with saffron, milk and dry fruit.',                                                  12000, true,  true,  12, 2),

  -- Beverages
  ('beverages',    'Masala Chaas',                    'Spiced buttermilk with curry leaf, ginger and roasted cumin.',                                                 6000, true,  true,   2, 1),
  ('beverages',    'Sweet Lassi',                     'Thick set curd, blended with sugar and a little rose water.',                                                  9000, true,  true,   2, 2)
) as v(category_slug, name, description, price_paise, is_veg, is_available, prep_lead_time_hours, display_order)
join public.categories c on c.slug = v.category_slug
on conflict (category_id, name) do update
  set description          = excluded.description,
      price_paise          = excluded.price_paise,
      is_veg               = excluded.is_veg,
      is_available         = excluded.is_available,
      prep_lead_time_hours = excluded.prep_lead_time_hours,
      display_order        = excluded.display_order;
