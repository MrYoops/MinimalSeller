# Plan: Categories & Characteristics System for Marketplaces and Own Site

## 1) Objectives (North Star)
- Internal categories with mapping to marketplaces (Ozon, Wildberries, Yandex) and our own site
- Combined characteristics: internal (own site) + marketplace attributes
- Auto-suggest category from product title (RU/EN keywords)
- Dynamic attributes rendering per selected marketplace with required fields marked (from MP APIs)
- Admin panel to manage internal categories, mappings, and internal characteristics
- Ready to publish/send product to selected marketplace(s) with validation of required fields

## 2) Phases and Implementation Steps

### Phase 1: Core POC (Required)
Goal: Prove end-to-end core flow works in isolation: title → category suggestion → fetch MP attributes (required marked) → dictionary values load → merge across channels.

Scope:
1. Backend
   - Unify/get endpoints:
     - GET /api/categories/mappings/search?query=… (exists)
     - GET /api/categories/marketplace/{mp}/search?query=… (exists)
     - GET /api/categories/marketplace/{mp}/{category_id}/attributes?type_id=…&is_required=… (exists in v2)
     - ADD: GET /api/categories/marketplace/{mp}/{category_id}/attribute-values?attribute_id=…&type_id=… (unify in v2)
   - Caching already present (category_system). Ensure attribute-values cache parity.
   - Title analyzer (simple heuristic): tokenize, lowercase, synonyms map (e.g., "мышка" ↔ "мышь" ↔ "mouse").
     - Endpoint: GET /api/categories/suggest?title=… returns ranked mappings (internal first when present, else MP categories).
2. Frontend (POC surface only)
   - Use existing UnifiedCategorySelector with fixed endpoints (ensure URL parity to v2), showing:
     - Category search results from mappings
     - After select: fetch attributes for chosen MP(s) and show required star
     - Load dictionary values when present
3. Data/Access
   - Seller must add Ozon/WB keys in Integrations (existing pages). If missing, return actionable errors.

POC User Stories (min 6):
1. As a seller, when I type “Мышка игровая Angry Miao…”, I get "Мышь/Мышка" category suggestions.
2. As a seller, after selecting a category for Ozon, I see attributes with required ones marked by a star.
3. As a seller, for dictionary attributes (e.g., Color), the dropdown options are loaded and cached.
4. As a seller, when attributes are cached, the next open is instant (uses cache < 7 days).
5. As a seller, if Ozon type_id is missing, I see a clear prompt to choose a type or mapping that includes it.
6. As an admin, I can preload all categories for a marketplace to speed up future searches.

POC Exit Criteria:
- The above user stories pass using testing agent; endpoints respond with real data (or cached) and required flags are correct per MP API.

### Phase 2: App Development (Full Feature)
Goal: Build complete admin + product flows around the proven core.

Backend:
- Internal Categories (new collection: internal_categories):
  - Fields: internal_name (unique), slug, site_visibility, default_channels {ozon, wb, yandex, site}, mappings {ozon: {category_id, type_id}, wb: {category_id}, yandex: {category_id}}, internal_attributes: [{code, name, type, unit, is_required, dictionary_values?, help?}], created_at/updated_at
  - CRUD endpoints: list, create, update, delete, get
  - Attribute management endpoints within internal category: add/update/delete/reorder
- Category Suggestion:
  - GET /api/categories/suggest?title=… → combines internal_categories + marketplace preloaded categories + mappings; returns ranked suggestions with channel coverage
- Merged Attributes API:
  - POST /api/categories/merged-attributes → input: {internal_category_id?, mapping, selected_channels[]} → output: merged list: [{name, source: site|ozon|wb|yandex, is_required_per_channel:[], input_type, dictionary_values?}]
- Product Integration:
  - Ensure save of category mappings per product (existing route) and save of filled attributes per channel
  - Validation endpoint before publish: POST /api/catalog/products/{id}/validate/{channel}
  - Publish endpoints per channel reusing connectors; return per-attribute error list if missing/invalid

Frontend:
- Admin: Categories Management (new pages or enhance existing AdminCategoriesPage)
  - List with filters, search, pagination, buttons: Add, Map, Show duplicates
  - Create/Edit form: internal fields, mapping pickers (search in MP categories), internal attributes editor (required star, type, dictionary)
- Product Form UX (upgrade CatalogProductFormV3/...):
  - Title → auto-suggest dropdown (based on suggest endpoint)
  - Channel toggles (Ozon/WB/Yandex/Site) show per-channel attributes dynamically
  - Required fields visually highlighted; show per-channel badges
  - Dictionary dropdowns populated from attribute-values API
  - Save mapping + Save attributes
  - Validate and Publish buttons per channel with clear errors
- Own Site Channel:
  - Site attributes rendered alongside MP attributes; saved and used for site frontend

Design/UX:
- Call design_agent for consistent UI (shadcn/ui + tailwind already present), badges, star legend, loading states, empty/error states.

Testing (end-to-end):
- Use testing_agent_v3 to cover all user stories and edge cases (missing keys, missing type_id, empty dictionary, cache hit/miss). Skip camera/drag-drop.

Phase 2 User Stories (min 6):
1. As an admin, I can create an internal category, add internal attributes and map it to Ozon/WB categories.
2. As a seller, entering a product title suggests the correct internal category; selecting it auto-loads attributes.
3. As a seller, enabling Ozon shows Ozon attributes with required ones marked; dictionary values appear.
4. As a seller, I can save all attributes and mappings for a product and see a success status.
5. As a seller, clicking “Send to Ozon” validates required fields; if any missing, I see exact attribute errors; if complete, publish succeeds.
6. As a site manager, I can see and edit site-specific attributes and ensure they display in the site channel.

## 3) Next Actions
- Unify and add attribute-values endpoint in category_routes_v2 to match frontend
- Implement GET /api/categories/suggest (title analyzer + ranking)
- Implement internal_categories schema + CRUD + attribute management
- Update UnifiedCategorySelector to new endpoints where needed
- Prepare POC test script (single file) to hit: suggest → attributes → attribute-values
- Ask seller to add Ozon/WB API keys in Integrations for live tests

## 4) Success Criteria
- Category suggestion returns relevant internal/MP categories for real titles (e.g., “мышка”) within 500ms from cache
- Attributes API returns correct required flags from MP APIs (Ozon needs type_id) and dictionary values are loaded and cached
- Admin can CRUD internal categories and attributes; mappings persist and are used in product forms
- Product can be published to Ozon/WB after validation; clear errors otherwise
- End-to-end tests (testing_agent_v3) pass for all user stories in both phases
