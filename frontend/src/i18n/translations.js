// Переводы для интерфейса MinimalMod

export const translations = {
  ru: {
    // Common
    loading: '// ЗАГРУЗКА...',
    save: 'СОХРАНИТЬ',
    cancel: 'ОТМЕНА',
    delete: 'УДАЛИТЬ',
    edit: 'РЕДАКТИРОВАТЬ',
    create: 'СОЗДАТЬ',
    view: 'ПОСМОТРЕТЬ',
    search: 'Поиск',
    filter: 'Фильтр',
    actions: 'Действия',
    status: 'Статус',
    
    // Auth
    login: 'ВХОД',
    register: 'РЕГИСТРАЦИЯ',
    logout: 'ВЫЙТИ',
    email: 'Email',
    password: 'Пароль',
    fullName: 'Полное имя',
    companyName: 'Название компании',
    inn: 'ИНН',
    
    // Header
    adminPanel: 'АДМИН',
    sellerPanel: 'ПРОДАВЕЦ',
    
    // Tabs
    overview: 'Обзор',
    users: 'Пользователи',
    analytics: 'Аналитика',
    products: 'Товары',
    orders: 'Заказы',
    inventory: 'Склад',
    apiKeys: 'API Ключи',
    finance: 'Финансы',
    balance: 'Баланс',
    promocodes: 'Промокоды',
    questions: 'Вопросы',
    reviews: 'Отзывы',
    dashboard: 'Дашборд',
    sellers: 'Продавцы',
    payouts: 'Выплаты',
    categories: 'Категории',
    
    // Products
    addProduct: '+ ДОБАВИТЬ ТОВАР',
    editProduct: 'РЕДАКТИРОВАТЬ ТОВАР',
    createProduct: 'СОЗДАТЬ ТОВАР',
    productList: 'ТОВАРЫ',
    sku: 'Артикул',
    name: 'Название',
    price: 'Цена',
    description: 'Описание',
    tags: 'Теги',
    images: 'Изображения',
    quality: 'Качество',
    variant: 'Вариант',
    
    // Orders
    orderList: 'ЗАКАЗЫ',
    orderNumber: 'Номер заказа',
    customer: 'Покупатель',
    source: 'Источник',
    total: 'Сумма',
    date: 'Дата',
    
    // Inventory
    inventoryManagement: 'УПРАВЛЕНИЕ СКЛАДОМ',
    fbs: 'FBS (Свой склад)',
    fbo: 'FBO (Склады МП)',
    history: 'История движений',
    quantity: 'Количество',
    reserved: 'Резерв',
    available: 'Доступно',
    adjust: 'КОРРЕКТИРОВКА',
    
    // Settings
    settings: 'НАСТРОЙКИ',
    theme: 'ТЕМА',
    language: 'ЯЗЫК',
    currency: 'ВАЛЮТА',
    dark: 'Темная',
    light: 'Светлая',
    
    // Comments
    noDistractionsJustResults: '// Никаких отвлечений, только результаты',
    enterCredentials: '// Введите ваши данные',
    manageProducts: '// Управление каталогом товаров',
    trackOrders: '// Отслеживание продаж',
    warehouseManagement: '// Управление товарными запасами',
  },
  
  en: {
    // Common
    loading: '// LOADING...',
    save: 'SAVE',
    cancel: 'CANCEL',
    delete: 'DELETE',
    edit: 'EDIT',
    create: 'CREATE',
    view: 'VIEW',
    search: 'Search',
    filter: 'Filter',
    actions: 'Actions',
    status: 'Status',
    
    // Auth
    login: 'LOGIN',
    register: 'REGISTER',
    logout: 'LOGOUT',
    email: 'Email',
    password: 'Password',
    fullName: 'Full Name',
    companyName: 'Company Name',
    inn: 'Tax ID',
    
    // Header
    adminPanel: 'ADMIN PANEL',
    sellerPanel: 'SELLER PANEL',
    
    // Tabs
    overview: 'Overview',
    users: 'Users',
    analytics: 'Analytics',
    products: 'Products',
    orders: 'Orders',
    inventory: 'Inventory',
    apiKeys: 'API Keys',
    
    // Products
    addProduct: '+ ADD PRODUCT',
    editProduct: 'EDIT PRODUCT',
    createProduct: 'CREATE PRODUCT',
    productList: 'PRODUCTS',
    sku: 'SKU',
    name: 'Name',
    price: 'Price',
    description: 'Description',
    tags: 'Tags',
    images: 'Images',
    quality: 'Quality',
    variant: 'Variant',
    
    // Orders
    orderList: 'ORDERS',
    orderNumber: 'Order #',
    customer: 'Customer',
    source: 'Source',
    total: 'Total',
    date: 'Date',
    
    // Inventory
    inventoryManagement: 'INVENTORY MANAGEMENT',
    fbs: 'FBS (Own Warehouse)',
    fbo: 'FBO (Marketplace Warehouses)',
    history: 'Movement History',
    quantity: 'Quantity',
    reserved: 'Reserved',
    available: 'Available',
    adjust: 'ADJUST',
    
    // Settings
    settings: 'SETTINGS',
    theme: 'THEME',
    language: 'LANGUAGE',
    currency: 'CURRENCY',
    dark: 'Dark',
    light: 'Light',
    
    // Comments
    noDistractionsJustResults: '// No distractions, Just results',
    enterCredentials: '// Enter your credentials',
    manageProducts: '// Manage your product catalog',
    trackOrders: '// Track your sales',
    warehouseManagement: '// Manage warehouse and stock levels',
  }
}

export const useTranslation = (language) => {
  const t = (key) => {
    return translations[language]?.[key] || translations['en'][key] || key
  }
  
  return { t }
}
