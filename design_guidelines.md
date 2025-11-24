{
  "meta": {
    "app_type": "Admin dashboard for product category and attribute management with product form and marketplace-aware characteristics (Ozon, Wildberries, Yandex Market) + own site",
    "audience": "Catalog managers, content operators, e-commerce teams",
    "key_tasks": [
      "Manage internal categories (list, create, edit, delete)",
      "Define mappings to marketplaces + characteristic schema per category",
      "Add products: auto-suggest category by name, pick marketplaces, fill required/dynamic characteristics",
      "Color-coded characteristics per marketplace, visible required indicators"
    ],
    "success_actions": [
      "Category created/updated with characteristics and marketplace mappings",
      "Product saved with validated required fields for selected marketplaces",
      "Fast category autocomplete with high match accuracy",
      "Clear visual code for required fields and marketplace-specific attributes"
    ],
    "design_style_fusion": "Dark Minimalism + Swiss grid discipline, with subtle glass overlays for drawers and popovers. Inspiration: SelsUp structure but sleeker, shadcn/ui primitives, Tailwind spacing, lucide-react icons. No heavy gradients."
  },

  "brand_attributes": ["precise", "operational", "trustworthy", "fast", "modern"],

  "color_system": {
    "note": "Dark-first UI. Solid backgrounds for reading areas. Gradients allowed only as decorative large-section backgrounds (<=20% viewport).",
    "semantic_tokens": {
      "--bg": "#0F172A",
      "--bg-elevated": "#111827",
      "--surface": "#1F2937",
      "--card": "#111827",
      "--muted": "#374151",
      "--border": "#334155",
      "--ring": "#22D3EE",
      "--text": "#E5E7EB",
      "--text-secondary": "#A7AFB8",
      "--text-tertiary": "#8A93A0",
      "--primary": "#06B6D4",
      "--primary-foreground": "#0B1220",
      "--secondary": "#84CC16",
      "--secondary-foreground": "#0B1220",
      "--destructive": "#EF4444",
      "--warning": "#F59E0B",
      "--success": "#22C55E"
    },
    "marketplace_brand_colors": {
      "ozon": { "label": "Ozon", "hex": "#005BFF", "on": "#FFFFFF" },
      "wildberries": { "label": "Wildberries", "hex": "#A100FF", "on": "#FFFFFF" },
      "yandex_market": { "label": "Yandex Market", "hex": "#FFCC00", "on": "#0B1220" }
    },
    "usage": {
      "backgrounds": "Use --bg / --bg-elevated; cards and forms on --card; borders as --border",
      "accents": "Use --primary for primary actions, --secondary for focus highlights and toggles",
      "marketplace_badges": "Solid fills using marketplace hex with appropriate readable text color",
      "states": "success/warning/destructive for validation hints and banners"
    },
    "gradients": {
      "allowed_examples": [
        "linear-gradient(135deg, rgba(14,165,233,0.14), rgba(34,197,94,0.10))",
        "linear-gradient(180deg, rgba(6,182,212,0.18), rgba(15,23,42,0))"
      ],
      "restrictions": "Follow Gradient Restriction Rule. No saturated purple/pink mixes; never on dense text; area <=20% viewport; enforce solid fallback if readability impacted"
    }
  },

  "typography": {
    "font_pairs": {
      "headings": "Space Grotesk",
      "body": "Inter"
    },
    "import_instructions": "Use Google Fonts link tags in index.html or @import in CSS for Space Grotesk and Inter",
    "scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl",
      "h2": "text-base md:text-lg",
      "body": "text-sm md:text-base",
      "small": "text-xs md:text-sm"
    },
    "weights": { "h": 600, "body": 400 },
    "tracking": { "h1": "tracking-tight", "h2": "tracking-tight" }
  },

  "icons": {
    "library": "lucide-react",
    "examples": [
      { "name": "LayoutDashboard", "use_for": "Sidebar Dashboard" },
      { "name": "FolderTree", "use_for": "Categories" },
      { "name": "Tags", "use_for": "Characteristics" },
      { "name": "Store", "use_for": "Marketplaces" },
      { "name": "PackagePlus", "use_for": "Add Product" },
      { "name": "Settings", "use_for": "Settings" },
      { "name": "Search", "use_for": "Search" }
    ]
  },

  "layout": {
    "app_shell": {
      "sidebar_width": "w-64 md:w-72",
      "topbar_height": "h-14",
      "content_max_width": "max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8",
      "pattern": "Sidebar + Topbar sticky; content uses 12-col grid on desktop, single column on mobile"
    },
    "pages": {
      "categories_list": "Table with toolbar: Search, Add, Filters; sticky table head; batch actions",
      "category_form": "Two-column on lg: left form, right sticky panel for mappings + characteristics; single column on mobile",
      "product_form": "Name input with autocomplete, marketplace checkboxes, dynamic characteristic fields grouped by type; right summary drawer"
    },
    "nav": {
      "sidebar": "Collapsible; icons + labels; active item has left border in --primary",
      "breadcrumbs": "Show on pages deeper than 1 level"
    }
  },

  "grid_system": {
    "container": "max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8",
    "columns": {
      "default": 12,
      "gaps": "gap-4 md:gap-6 lg:gap-8"
    },
    "cards": "rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm"
  },

  "component_path": {
    "base": "/app/frontend/src/components/ui/",
    "shadcn_components": [
      "button.js", "input.js", "label.js", "textarea.js", "select.js", "checkbox.js", "switch.js", "form.js", "dialog.js", "sheet.js", "tooltip.js", "tabs.js", "badge.js", "separator.js", "scroll-area.js", "table.js", "dropdown-menu.js", "command.js", "combobox.js", "popover.js", "accordion.js", "calendar.js", "sonner.js"
    ],
    "custom_components": [
      "marketplace-badge.js", "required-asterisk.js", "category-autocomplete.js", "characteristics-editor.js", "marketplace-legend.js", "data-table.js"
    ]
  },

  "components": {
    "buttons": {
      "style": "Professional / Corporate",
      "tokens": {
        "--btn-radius": "10px",
        "--btn-shadow": "0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 12px rgba(0,0,0,0.25)",
        "--btn-motion": "transition: background-color .18s ease, color .18s ease, box-shadow .2s ease"
      },
      "variants": [
        {"name": "primary", "classes": "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-cyan-400 focus-visible:ring-2 focus-visible:ring-[var(--ring)]"},
        {"name": "secondary", "classes": "bg-[var(--muted)] text-[var(--text)] hover:bg-slate-600"},
        {"name": "ghost", "classes": "bg-transparent text-[var(--text)] hover:bg-slate-700/40 border border-transparent"}
      ],
      "sizes": {"sm": "h-8 px-3", "md": "h-10 px-4", "lg": "h-12 px-6"}
    },

    "forms": {
      "rules": [
        "All required fields show red asterisk and aria-required=true",
        "Marketplace-specific fields show colored left border per marketplace",
        "Inputs use readable contrasts; focus ring in --primary"
      ],
      "field_spacing": "space-y-3 md:space-y-4",
      "label": "text-sm text-[var(--text-secondary)]"
    },

    "tables": {
      "base": "w-full text-sm",
      "row": "hover:bg-slate-800/60 transition-colors",
      "header": "sticky top-0 bg-[var(--bg)]/80 backdrop-blur border-b border-[var(--border)]",
      "cell": "py-3 px-3 align-middle"
    },

    "badges": {
      "marketplaces": {
        "ozon": "bg-[#005BFF] text-white",
        "wildberries": "bg-[#A100FF] text-white",
        "yandex_market": "bg-[#FFCC00] text-[#0B1220]"
      },
      "required": "text-red-500"
    },

    "chips": {
      "filter": "rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:border-[var(--text)] transition-colors"
    },

    "drawers_modals": {
      "elevation": "backdrop:bg-black/50 bg-[var(--card)] border border-[var(--border)] shadow-xl",
      "use_cases": ["Right sheet for characteristic editor", "Confirm delete dialog"]
    }
  },

  "motion_interactions": {
    "principles": [
      "No transition: all; only property-specific transitions",
      "Gentle durations 120–220ms for hover/focus; 240–320ms for sheets/dialogs",
      "micro-entrances: fade+slide 8–12px; no large bounces"
    ],
    "examples": {
      "button_hover": "transition-colors duration-200",
      "table_row": "hover:bg-slate-800/60 transition-colors",
      "sheet": "animate-in slide-in-from-right-4 duration-300"
    }
  },

  "accessibility": {
    "contrast": "Maintain WCAG AA for text over backgrounds",
    "focus": "Visible focus ring using focus-visible:ring-2 ring-[var(--ring)]",
    "aria": ["aria-required for mandatory", "aria-invalid on error", "aria-describedby to tie help text"],
    "keyboard": "All popovers/combobox navigable with arrows and Enter; Esc closes"
  },

  "data_testid_convention": {
    "rule": "Every interactive or key informational element MUST include data-testid. Use kebab-case describing role.",
    "examples": [
      "data-testid=\"category-create-button\"",
      "data-testid=\"category-form-name-input\"",
      "data-testid=\"product-form-save-button\"",
      "data-testid=\"marketplace-filter-ozon-checkbox\"",
      "data-testid=\"characteristic-row-0-code-input\"",
      "data-testid=\"toast-success-message\""
    ]
  },

  "tailwind_tokens": {
    "css_variables": "\n:root {\n  --bg: #0F172A;\n  --bg-elevated: #111827;\n  --surface: #1F2937;\n  --card: #111827;\n  --muted: #374151;\n  --border: #334155;\n  --ring: #22D3EE;\n  --text: #E5E7EB;\n  --text-secondary: #A7AFB8;\n  --text-tertiary: #8A93A0;\n  --primary: #06B6D4;\n  --primary-foreground: #0B1220;\n  --secondary: #84CC16;\n  --secondary-foreground: #0B1220;\n  --destructive: #EF4444;\n  --warning: #F59E0B;\n  --success: #22C55E;\n}\nbody { background: var(--bg); color: var(--text); }\n",
    "tailwind_config_extension": "\n// tailwind.config.js\nmodule.exports = {\n  darkMode: ['class'],\n  content: ['./index.html','./src/**/*.{js,jsx}'],\n  theme: {\n    extend: {\n      colors: {\n        bg: 'var(--bg)',\n        surface: 'var(--surface)',\n        card: 'var(--card)',\n        muted: 'var(--muted)',\n        border: 'var(--border)',\n        primary: 'var(--primary)'\n      },\n      boxShadow: {\n        card: '0 8px 24px rgba(0,0,0,0.24)',\n      },\n      borderRadius: {\n        xl: '1rem'\n      }\n    }\n  },\n  plugins: []\n}\n"
  },

  "code_examples": [
    {
      "title": "MarketplaceBadge.js",
      "description": "Badge with brand color mapping",
      "code": "export const MarketplaceBadge = ({ mp, className = '' }) => {\n  const map = {\n    ozon: 'bg-[#005BFF] text-white',\n    wildberries: 'bg-[#A100FF] text-white',\n    yandex_market: 'bg-[#FFCC00] text-[#0B1220]'\n  };\n  const label = { ozon: 'Ozon', wildberries: 'Wildberries', yandex_market: 'Yandex Market' }[mp] || mp;\n  return (\n    <span data-testid={\`marketplace-badge-\${mp}\`} className={\`inline-flex items-center h-6 px-2 rounded-md text-xs font-medium ${map[mp] || 'bg-slate-600 text-white'} \${className}\`}>{label}</span>\n  );\n};\n"
    },

    {
      "title": "RequiredAsterisk.js",
      "description": "Red star used next to labels",
      "code": "export const RequiredAsterisk = () => (\n  <span data-testid=\"required-asterisk\" className=\"ml-1 text-red-500\" aria-hidden=\"true\">*</span>\n);\n"
    },

    {
      "title": "CategoryAutocomplete.js (shadcn Command)",
      "description": "Autocomplete to pick internal category by name",
      "code": "import { useState, useEffect } from 'react';\nimport { Command, CommandInput, CommandList, CommandItem, CommandGroup, CommandEmpty } from './components/ui/command';\nexport const CategoryAutocomplete = ({ value, onSelect, fetchCategories }) => {\n  const [query, setQuery] = useState('');\n  const [items, setItems] = useState([]);\n  useEffect(() => {\n    let active = true;\n    (async () => {\n      const res = await fetchCategories(query);\n      if (active) setItems(res || []);\n    })();\n    return () => { active = false; };\n  }, [query, fetchCategories]);\n  return (\n    <div className=\"border border-[var(--border)] rounded-lg bg-[var(--card)]\">\n      <Command>\n        <CommandInput data-testid=\"category-autocomplete-input\" value={query} onValueChange={setQuery} placeholder=\"Начните вводить название категории...\" />\n        <CommandList>\n          <CommandEmpty>Ничего не найдено</CommandEmpty>\n          <CommandGroup heading=\"Категории\">\n            {items.map((c) => (\n              <CommandItem data-testid=\{`category-option-\${c.slug}`\} key={c.slug} onSelect={() => onSelect(c)}>\n                {c.name}\n              </CommandItem>\n            ))}\n          </CommandGroup>\n        </CommandList>\n      </Command>\n    </div>\n  );\n};\n"
    },

    {
      "title": "CharacteristicsEditor.js",
      "description": "Add/edit characteristic rows with type, required, and dictionary",
      "code": "import { useState } from 'react';\nimport { Input } from './components/ui/input';\nimport { Label } from './components/ui/label';\nimport { Checkbox } from './components/ui/checkbox';\nimport { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './components/ui/select';\nimport { Button } from './components/ui/button';\nexport const CharacteristicsEditor = ({ value = [], onChange }) => {\n  const [rows, setRows] = useState(value);\n  const set = (i, patch) => {\n    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));\n    setRows(next);\n    onChange?.(next);\n  };\n  const add = () => set([\n    ...rows, { code: '', name: '', type: 'text', required: false, dict: [] }\n  ]);\n  const remove = (i) => { const next = rows.filter((_, idx) => idx !== i); setRows(next); onChange?.(next); };\n  return (\n    <div className=\"space-y-4\">\n      {rows.map((r, i) => (\n        <div key={i} data-testid={\`characteristic-row-\${i}\`} className=\"grid grid-cols-1 md:grid-cols-6 gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]\">\n          <div className=\"md:col-span-2\">\n            <Label>Код<sup className=\"text-red-500\">*</sup></Label>\n            <Input data-testid={\`characteristic-row-\${i}-code-input\`} value={r.code} onChange={(e)=>set(i,{code:e.target.value})} />\n          </div>\n          <div className=\"md:col-span-2\">\n            <Label>Название</Label>\n            <Input data-testid={\`characteristic-row-\${i}-name-input\`} value={r.name} onChange={(e)=>set(i,{name:e.target.value})} />\n          </div>\n          <div>\n            <Label>Тип</Label>\n            <Select value={r.type} onValueChange={(v)=>set(i,{type:v})}>\n              <SelectTrigger data-testid={\`characteristic-row-\${i}-type-select\`}><SelectValue /></SelectTrigger>\n              <SelectContent>\n                <SelectItem value=\"text\">Текст</SelectItem>\n                <SelectItem value=\"number\">Число</SelectItem>\n                <SelectItem value=\"select\">Справочник</SelectItem>\n                <SelectItem value=\"boolean\">Да/Нет</SelectItem>\n              </SelectContent>\n            </Select>\n          </div>\n          <div className=\"flex items-end\">\n            <label className=\"inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]\">\n              <Checkbox data-testid={\`characteristic-row-\${i}-required-checkbox\`} checked={!!r.required} onCheckedChange={(v)=>set(i,{required: !!v})} />\n              Обязательное\n            </label>\n          </div>\n          <div className=\"md:col-span-6\">\n            <Label>Справочник значений (через запятую)</Label>\n            <Input data-testid={\`characteristic-row-\${i}-dict-input\`} value={(r.dict||[]).join(', ')} onChange={(e)=>set(i,{dict:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} placeholder=\"S, M, L\" />\n          </div>\n          <div className=\"md:col-span-6 flex justify-end gap-2\">\n            <Button data-testid={\`characteristic-row-\${i}-delete-button\"} variant=\"ghost\" onClick={()=>remove(i)}>Удалить</Button>\n          </div>\n        </div>\n      ))}\n      <Button data-testid=\"characteristics-add-row-button\" onClick={add}>Добавить характеристику</Button>\n    </div>\n  );\n};\n"
    },

    {
      "title": "ProductForm.js (autocomplete + marketplaces + dynamic characteristics)",
      "description": "Product form logic skeleton using shadcn + RHF. Add data-testid to each control.",
      "code": "import { useEffect, useMemo, useState } from 'react';\nimport { useForm, Controller } from 'react-hook-form';\nimport { zodResolver } from '@hookform/resolvers/zod';\nimport * as z from 'zod';\nimport { Input } from './components/ui/input';\nimport { Label } from './components/ui/label';\nimport { Checkbox } from './components/ui/checkbox';\nimport { Button } from './components/ui/button';\nimport { Separator } from './components/ui/separator';\nimport { CategoryAutocomplete } from './components/ui/category-autocomplete';\nimport { MarketplaceBadge } from './components/ui/marketplace-badge';\n\nconst schema = z.object({\n  name: z.string().min(2),\n  marketplaces: z.object({ ozon: z.boolean(), wildberries: z.boolean(), yandex_market: z.boolean() }),\n  category: z.object({ name: z.string(), slug: z.string() }).nullable(),\n  characteristics: z.record(z.any())\n});\n\nexport const ProductForm = ({ onSubmit, fetchCategories, getCharacteristicsByCategory }) => {\n  const { register, control, handleSubmit, watch, setValue } = useForm({\n    resolver: zodResolver(schema),\n    defaultValues: { name: '', marketplaces: { ozon: false, wildberries: false, yandex_market: false }, category: null, characteristics: {} }\n  });\n  const [specs, setSpecs] = useState([]);\n  const selectedMP = watch('marketplaces');\n  const cat = watch('category');\n\n  useEffect(() => {\n    let active = true;\n    (async () => {\n      if (!cat) { setSpecs([]); return; }\n      const result = await getCharacteristicsByCategory(cat.slug);\n      if (active) setSpecs(result || []);\n    })();\n    return () => { active = false; };\n  }, [cat, setSpecs, getCharacteristicsByCategory]);\n\n  const activeMPs = useMemo(() => Object.entries(selectedMP).filter(([,v]) => v).map(([k]) => k), [selectedMP]);\n\n  return (\n    <form onSubmit={handleSubmit(onSubmit)} className=\"space-y-6\">\n      <div>\n        <Label htmlFor=\"name\">Название товара<sup className=\"text-red-500\">*</sup></Label>\n        <Input id=\"name\" data-testid=\"product-form-name-input\" {...register('name')} placeholder=\"Например: Футболка мужская\" />\n      </div>\n\n      <div className=\"space-y-2\">\n        <Label>Категория</Label>\n        <CategoryAutocomplete\n          value={cat}\n          fetchCategories={fetchCategories}\n          onSelect={(c)=> setValue('category', c, { shouldDirty: true, shouldValidate: true })}\n        />\n        {cat && <div className=\"text-xs text-[var(--text-secondary)]\">Выбрано: {cat.name}</div>}\n      </div>\n\n      <Separator />\n\n      <fieldset className=\"space-y-3\">\n        <legend className=\"text-sm text-[var(--text-secondary)]\">Маркетплейсы</legend>\n        {['ozon','wildberries','yandex_market'].map((mp)=> (\n          <label key={mp} className=\"inline-flex items-center gap-2 mr-4\">\n            <Controller control={control} name={\`marketplaces.\${mp}\`} render={({ field }) => (\n              <Checkbox data-testid={\`marketplace-checkbox-\${mp}\`} checked={!!field.value} onCheckedChange={field.onChange} />\n            )} />\n            <MarketplaceBadge mp={mp} />\n          </label>\n        ))}\n      </fieldset>\n\n      <div className=\"space-y-4\">\n        {specs.filter(s => !s.marketplaces || s.marketplaces.some(m => activeMPs.includes(m))).map((s) => {\n          const req = s.required && (!s.marketplaces || s.marketplaces.some(m => activeMPs.includes(m)));\n          const mpColor = s.marketplaces?.[0] || 'ozon';\n          const colorMap = { ozon: '#005BFF', wildberries: '#A100FF', yandex_market: '#FFCC00' };\n          return (\n            <div key={s.code} className=\"p-3 rounded-lg border\" style={{ borderLeftWidth: 3, borderColor: colorMap[mpColor] }}>\n              <Label htmlFor={s.code}>{s.name}{req && <sup className=\"text-red-500\">*</sup>}</Label>\n              {s.type === 'text' && (\n                <Input id={s.code} data-testid={\`characteristic-input-\${s.code}\`} onChange={(e)=> setValue(\`characteristics.\${s.code}\`, e.target.value)} />\n              )}\n              {s.type === 'number' && (\n                <Input id={s.code} type=\"number\" data-testid={\`characteristic-input-\${s.code}\`} onChange={(e)=> setValue(\`characteristics.\${s.code}\`, Number(e.target.value))} />\n              )}\n              {s.type === 'boolean' && (\n                <label className=\"inline-flex items-center gap-2 mt-2\">\n                  <Checkbox data-testid={\`characteristic-input-\${s.code}\`} onCheckedChange={(v)=> setValue(\`characteristics.\${s.code}\`, !!v)} /> Да\n                </label>\n              )}\n              {s.type === 'select' && (\n                <select data-testid={\`characteristic-input-\${s.code}\`} className=\"mt-2 h-10 w-full rounded-md bg-[var(--surface)] border border-[var(--border)] px-3\" onChange={(e)=> setValue(\`characteristics.\${s.code}\`, e.target.value)}>\n                  <option value=\"\">Выберите...</option>\n                  {(s.dict||[]).map((opt)=> <option key={opt} value={opt}>{opt}</option>)}\n                </select>\n              )}\n              {s.marketplaces?.length ? (\n                <div className=\"mt-2 flex gap-2\">{s.marketplaces.map(m => <MarketplaceBadge key={m} mp={m} />)}</div>\n              ) : null}\n            </div>\n          );\n        })}\n      </div>\n\n      <div className=\"pt-2 flex justify-end\">\n        <Button data-testid=\"product-form-save-button\" type=\"submit\">Сохранить</Button>\n      </div>\n    </form>\n  );\n};\n"
    },

    {
      "title": "CategoriesTable.js",
      "description": "Table listing categories with actions",
      "code": "import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';\nimport { Button } from './components/ui/button';\nimport { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './components/ui/dropdown-menu';\nexport const CategoriesTable = ({ items, onEdit, onDelete }) => {\n  return (\n    <div className=\"rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden\">\n      <div className=\"p-3 flex items-center gap-2\">\n        <Button data-testid=\"category-create-button\">Добавить категорию</Button>\n      </div>\n      <Table className=\"w-full text-sm\">\n        <TableHeader className=\"sticky top-0 bg-[var(--bg)]/80 backdrop-blur border-b border-[var(--border)]\">\n          <TableRow>\n            <TableHead>Название</TableHead>\n            <TableHead>Slug</TableHead>\n            <TableHead>Сопоставления</TableHead>\n            <TableHead>Характеристики</TableHead>\n            <TableHead className=\"text-right\">Действия</TableHead>\n          </TableRow>\n        </TableHeader>\n        <TableBody>\n          {items.map((it)=> (\n            <TableRow key={it.slug} className=\"hover:bg-slate-800/60 transition-colors\">\n              <TableCell>{it.name}</TableCell>\n              <TableCell className=\"text-[var(--text-secondary)]\">{it.slug}</TableCell>\n              <TableCell>{Object.keys(it.mappings||{}).join(', ')}</TableCell>\n              <TableCell>{(it.characteristics||[]).length}</TableCell>\n              <TableCell className=\"text-right\">\n                <DropdownMenu>\n                  <DropdownMenuTrigger asChild>\n                    <Button data-testid=\"category-row-actions-button\" variant=\"ghost\">Действия</Button>\n                  </DropdownMenuTrigger>\n                  <DropdownMenuContent align=\"end\">\n                    <DropdownMenuItem onClick={()=>onEdit(it)} data-testid=\"category-row-edit\">Редактировать</DropdownMenuItem>\n                    <DropdownMenuItem onClick={()=>onDelete(it)} data-testid=\"category-row-delete\">Удалить</DropdownMenuItem>\n                  </DropdownMenuContent>\n                </DropdownMenu>\n              </TableCell>\n            </TableRow>\n          ))}\n        </TableBody>\n      </Table>\n    </div>\n  );\n};\n"
    }
  ],

  "image_urls": [
    {
      "url": "https://images.unsplash.com/photo-1578598444322-6533486d4cdf?crop=entropy&cs=srgb&fm=jpg&q=85",
      "category": "background",
      "placement": "Login/landing header background as large-section decorative cover (apply overlay to keep <=20% viewport)",
      "description": "Blue-black abstract grain texture; fits cyan accent scheme"
    },
    {
      "url": "https://images.unsplash.com/photo-1704159366958-516a54b0cc5d?crop=entropy&cs=srgb&fm=jpg&q=85",
      "category": "decorative",
      "placement": "Dashboard top strip or empty-states subtle background",
      "description": "Soft curved cyan highlight on black"
    },
    {
      "url": "https://images.pexels.com/photos/3784143/pexels-photo-3784143.jpeg",
      "category": "texture",
      "placement": "Overlay noise mask (mix-blend-overlay at 6–8%) across hero only",
      "description": "Subtle fabric-like grain for depth"
    }
  ],

  "additional_libraries": {
    "install": [
      "npm i lucide-react",
      "npm i framer-motion",
      "npm i react-hook-form zod @hookform/resolvers",
      "npm i sonner",
      "npm i @tanstack/react-table"
    ],
    "usage_notes": [
      "Use framer-motion for sheet/dialog entrance animations",
      "Use sonner for success/error toasts; mount <Toaster /> once at root",
      "Use TanStack Table optional for advanced tables (sorting, pagination)"
    ]
  },

  "instructions_to_main_agent": [
    "Create UI primitives in /app/frontend/src/components/ui/ (JS named exports)",
    "Implement AppShell with Sidebar + Topbar in dark theme using tokens",
    "Build Categories: list (table + toolbar), form (with shadcn Form), delete dialog",
    "Build CharacteristicsEditor and plug into Category form",
    "Implement ProductForm with autocomplete, marketplace toggles, dynamic characteristic rendering",
    "Ensure all interactive/critical elements include data-testid following the convention",
    "Use only shadcn/ui primitives for dropdown, calendar, toast, command. No native HTML replacements",
    "Respect Gradient Restriction Rule; never cover reading areas with gradients",
    "Apply property-specific transitions only (no transition: all)",
    "Mobile-first: verify layouts on 360px width; then scale up"
  ],

  "general_ui_ux_design_guidelines": "- You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n- You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n- NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals."
}
