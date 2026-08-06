import type { Category, MenuItem } from "./types";

/**
 * Local mirror of the seed data in supabase/seed.sql.
 *
 * This exists so the app renders a real menu before Supabase is provisioned,
 * and so the UI has something to show if the database is unreachable. Once
 * Supabase env vars are set and the tables are populated, this is never read.
 *
 * Keep the dishes in sync with the SQL by hand. The ids here are local
 * placeholders — Supabase generates real uuids — and nothing joins across the
 * two sources, so they only need to be internally consistent.
 */

export const seedCategories: Category[] = [
  { id: "c1", name: "Starters", slug: "starters", description: "Something to begin with", display_order: 1, is_active: true },
  { id: "c2", name: "Biryani & Rice", slug: "biryani-rice", description: "Slow-cooked, sealed and steamed", display_order: 2, is_active: true },
  { id: "c3", name: "Main Course", slug: "main-course", description: "Gravies made fresh each morning", display_order: 3, is_active: true },
  { id: "c4", name: "Breads", slug: "breads", description: "Straight off the tandoor", display_order: 4, is_active: true },
  { id: "c5", name: "Desserts", slug: "desserts", description: "House-made, not too sweet", display_order: 5, is_active: true },
  { id: "c6", name: "Beverages", slug: "beverages", description: "To cool things down", display_order: 6, is_active: true },
];

export const seedMenuItems: MenuItem[] = [
  // Starters
  { id: "i1", category_id: "c1", name: "Paneer Tikka", description: "Hung-curd marinade, charred in the tandoor, finished with chaat masala and lime.", price_paise: 28000, image_url: null, is_veg: true, is_available: true, prep_lead_time_hours: 4, display_order: 1 },
  { id: "i2", category_id: "c1", name: "Chicken 65", description: "Chettinad-style, curry leaf and red chilli, fried to order so it stays crisp.", price_paise: 32000, image_url: null, is_veg: false, is_available: true, prep_lead_time_hours: 4, display_order: 2 },
  { id: "i3", category_id: "c1", name: "Gobi Manchurian", description: "Cauliflower tossed in a garlic-soy glaze. Dry, not gravy.", price_paise: 22000, image_url: null, is_veg: true, is_available: true, prep_lead_time_hours: 4, display_order: 3 },

  // Biryani & Rice
  { id: "i4", category_id: "c2", name: "Hyderabadi Chicken Dum Biryani", description: "Kacchi style, layered raw and sealed with dough. Served with mirchi ka salan and raita. Needs a day's notice.", price_paise: 42000, image_url: null, is_veg: false, is_available: true, prep_lead_time_hours: 24, display_order: 1 },
  { id: "i5", category_id: "c2", name: "Veg Dum Biryani", description: "Seasonal vegetables, saffron milk, fried onion. Served with raita.", price_paise: 32000, image_url: null, is_veg: true, is_available: true, prep_lead_time_hours: 12, display_order: 2 },
  { id: "i6", category_id: "c2", name: "Jeera Rice", description: "Long-grain basmati tempered with cumin and ghee.", price_paise: 16000, image_url: null, is_veg: true, is_available: true, prep_lead_time_hours: 4, display_order: 3 },

  // Main Course
  { id: "i7", category_id: "c3", name: "Butter Chicken", description: "Tandoori chicken in a tomato and cashew gravy, finished with cream and kasuri methi.", price_paise: 38000, image_url: null, is_veg: false, is_available: true, prep_lead_time_hours: 6, display_order: 1 },
  { id: "i8", category_id: "c3", name: "Paneer Butter Masala", description: "Fresh paneer, slow-simmered makhani gravy. Mild enough for everyone.", price_paise: 32000, image_url: null, is_veg: true, is_available: true, prep_lead_time_hours: 6, display_order: 2 },
  { id: "i9", category_id: "c3", name: "Dal Makhani", description: "Black urad simmered overnight on low heat. Order it a day ahead.", price_paise: 24000, image_url: null, is_veg: true, is_available: true, prep_lead_time_hours: 24, display_order: 3 },
  { id: "i10", category_id: "c3", name: "Kadai Mushroom", description: "Button mushrooms, hand-pounded kadai masala, bell pepper.", price_paise: 28000, image_url: null, is_veg: true, is_available: false, prep_lead_time_hours: 6, display_order: 4 },

  // Breads
  { id: "i11", category_id: "c4", name: "Butter Naan", description: "Leavened, tandoor-baked, brushed with white butter.", price_paise: 6000, image_url: null, is_veg: true, is_available: true, prep_lead_time_hours: 2, display_order: 1 },
  { id: "i12", category_id: "c4", name: "Tandoori Roti", description: "Whole wheat, no maida, straight off the clay oven wall.", price_paise: 4000, image_url: null, is_veg: true, is_available: true, prep_lead_time_hours: 2, display_order: 2 },
  { id: "i13", category_id: "c4", name: "Laccha Paratha", description: "Layered and flaky. Worth the extra twenty rupees.", price_paise: 7000, image_url: null, is_veg: true, is_available: true, prep_lead_time_hours: 2, display_order: 3 },

  // Desserts
  { id: "i14", category_id: "c5", name: "Gulab Jamun", description: "Two pieces, khoya-based, soaked warm in cardamom syrup.", price_paise: 9000, image_url: null, is_veg: true, is_available: true, prep_lead_time_hours: 6, display_order: 1 },
  { id: "i15", category_id: "c5", name: "Double Ka Meetha", description: "Hyderabadi bread pudding with saffron, milk and dry fruit.", price_paise: 12000, image_url: null, is_veg: true, is_available: true, prep_lead_time_hours: 12, display_order: 2 },

  // Beverages
  { id: "i16", category_id: "c6", name: "Masala Chaas", description: "Spiced buttermilk with curry leaf, ginger and roasted cumin.", price_paise: 6000, image_url: null, is_veg: true, is_available: true, prep_lead_time_hours: 2, display_order: 1 },
  { id: "i17", category_id: "c6", name: "Sweet Lassi", description: "Thick set curd, blended with sugar and a little rose water.", price_paise: 9000, image_url: null, is_veg: true, is_available: true, prep_lead_time_hours: 2, display_order: 2 },
];
