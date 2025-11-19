
/**
 * Класс HairShopCatalog управляет загрузкой данных, фильтрацией и отображением товаров.
 */
class HairShopCatalog {
    constructor() {
        // URL Google Таблицы для экспорта в CSV. 
        // Важно: Таблица должна быть опубликована в Интернете (Файл -> Поделиться -> Опубликовать).
        this.CSV_URL = "https://docs.google.com/spreadsheets/d/15KZ6DHJD4zin2nATxLG-xBGx-BClYWUDAY_mW0VIwoM/export?format=csv&gid=0";
        
        this.products = [];
        this.filterRanges = null;
        this.filters = {
            minLength: 0, 
            maxLength: 0,
            minPrice: 0,
            maxPrice: 0,
            colors: []
        };
        
        this.cart = [];
        this.favorites = [];
        this.purchases = [];
        this.telegramUser = null;
        this.userAddresses = [];
        this.selectedAddress = null;
        this.deliveryMethod = 'pickup';
        this.paymentMethod = 'cash';
        
        // Ключи для localStorage с привязкой к ID пользователя
        this.userId = null;
        this.cartKey = null;
        this.favoritesKey = null;
        this.purchasesKey = null;
        this.addressesKey = null;
        
        this.init();
    }

    /**
     * Инициализация приложения
     */
    async init() {
        console.log('🚀 Initializing HairShopCatalog...');
        try {
            await this.initTelegram();
            this.initUserStorage();
            this.initAddressSystem();
            this.renderLoading();
            await this.loadProductsFromCSV();
            this.setupEventListeners();
            this.updateCartCount();
            this.updateFavoritesCount();
            console.log('✅ Catalog ready for Telegram WebApp');
        } catch (error) {
            console.error('❌ Error during initialization:', error);
        }
    }

    /**
     * Инициализация Telegram WebApp
     */
    async initTelegram() {
        return new Promise((resolve) => {
            if (window.Telegram && Telegram.WebApp) {
                // Ждем инициализации Telegram WebApp
                if (Telegram.WebApp.initData) {
                    this.processTelegramUser();
                    resolve();
                } else {
                    // Если данные еще не загружены, ждем
                    Telegram.WebApp.ready();
                    setTimeout(() => {
                        this.processTelegramUser();
                        resolve();
                    }, 100);
                }
            } else {
                console.log('⚠️ Telegram WebApp not detected, running in browser mode');
                this.telegramUser = {
                    id: 'browser_user_' + Date.now(),
                    first_name: 'Тестовый',
                    last_name: 'Пользователь', 
                    username: 'test_user',
                    photo_url: ''
                };
                resolve();
            }
        });
    }

    /**
     * Обработка данных пользователя Telegram
     */
    processTelegramUser() {
        try {
            const initData = Telegram.WebApp.initDataUnsafe;
            console.log('📋 Telegram initData:', initData);
            
            if (initData && initData.user) {
                this.telegramUser = {
                    id: initData.user.id,
                    first_name: initData.user.first_name,
                    last_name: initData.user.last_name || '',
                    username: initData.user.username || '',
                    photo_url: initData.user.photo_url || ''
                };
                
                console.log('✅ Telegram user loaded:', this.telegramUser);
                
                // Всегда вызываем ready() и expand()
                Telegram.WebApp.ready();
                Telegram.WebApp.expand();
                
                // Безопасная установка параметров
                try {
                    if (typeof Telegram.WebApp.setHeaderColor === 'function') {
                        Telegram.WebApp.setHeaderColor('#000000');
                    }
                    if (typeof Telegram.WebApp.setBackgroundColor === 'function') {
                        Telegram.WebApp.setBackgroundColor('#121212');
                    }
                } catch (error) {
                    console.log('ℹ️ Some Telegram WebApp features not available');
                }
            } else {
                console.log('⚠️ No Telegram user data found');
                this.telegramUser = {
                    id: 'unknown_user_' + Date.now(),
                    first_name: 'Гость',
                    last_name: '',
                    username: '',
                    photo_url: ''
                };
            }
        } catch (error) {
            console.error('❌ Error processing Telegram user:', error);
            this.telegramUser = {
                id: 'error_user_' + Date.now(),
                first_name: 'Гость',
                last_name: '',
                username: '',
                photo_url: ''
            };
        }
    }

    /**
     * Инициализация системы хранения данных пользователя
     */
    initUserStorage() {
        this.userId = this.telegramUser?.id || 'anonymous';
        
        // Создаем уникальные ключи для каждого пользователя
        this.cartKey = `cart_${this.userId}`;
        this.favoritesKey = `favorites_${this.userId}`;
        this.purchasesKey = `purchases_${this.userId}`;
        this.addressesKey = `addresses_${this.userId}`;
        
        console.log('💾 User storage initialized for user:', this.userId);
    }

    /**
     * Инициализация системы адресов
     */
    initAddressSystem() {
        this.userAddresses = JSON.parse(localStorage.getItem(this.addressesKey) || '[]');
        this.selectedAddress = null;
        console.log('📍 Address system initialized with', this.userAddresses.length, 'addresses');
    }

    /**
     * Загрузка корзины из localStorage
     */
    loadCart() {
        const savedCart = localStorage.getItem(this.cartKey);
        if (savedCart) {
            this.cart = JSON.parse(savedCart);
            console.log('🛒 Cart loaded:', this.cart.length, 'items');
        }
    }

    /**
     * Сохранение корзины в localStorage
     */
    saveCart() {
        localStorage.setItem(this.cartKey, JSON.stringify(this.cart));
    }

    /**
     * Загрузка избранного из localStorage
     */
    loadFavorites() {
        const savedFavorites = localStorage.getItem(this.favoritesKey);
        if (savedFavorites) {
            this.favorites = JSON.parse(savedFavorites);
            console.log('❤️ Favorites loaded:', this.favorites.length, 'items');
        }
    }

    /**
     * Сохранение избранного в localStorage
     */
    saveFavorites() {
        localStorage.setItem(this.favoritesKey, JSON.stringify(this.favorites));
    }

    /**
     * Загрузка истории покупок из localStorage
     */
    loadPurchases() {
        const savedPurchases = localStorage.getItem(this.purchasesKey);
        if (savedPurchases) {
            this.purchases = JSON.parse(savedPurchases);
            console.log('📦 Purchases history loaded:', this.purchases.length, 'orders');
        }
    }

    /**
     * Сохранение истории покупок в localStorage
     */
    savePurchases() {
        localStorage.setItem(this.purchasesKey, JSON.stringify(this.purchases));
    }

    /**
     * Отображает индикатор загрузки.
     */
    renderLoading() {
        const container = document.getElementById('productsContainer');
        if (container) {
            container.innerHTML = '<div style="text-align: center; padding: 50px; color: #ffc400;">Загрузка данных...</div>';
        }
    }

    /**
     * Определяет минимальные и максимальные значения для фильтров.
     */
    initializeFilterRanges() {
        if (this.products.length === 0) return;

        const allLengths = this.products.map(p => p.length).filter(l => l > 0);
        const allPrices = this.products.map(p => p.price).filter(p => p > 0);
        const allColors = [...new Set(this.products.map(p => p.color).filter(c => c && c.trim() !== ''))];

        // Автоматическое определение диапазонов из данных
        const minLength = allLengths.length > 0 ? Math.floor(Math.min(...allLengths)) : 10;
        const maxLength = allLengths.length > 0 ? Math.ceil(Math.max(...allLengths)) : 50;
        const minPrice = allPrices.length > 0 ? Math.floor(Math.min(...allPrices) / 100) * 100 : 1000;
        const maxPrice = allPrices.length > 0 ? Math.ceil(Math.max(...allPrices) / 100) * 100 : 10000;

        this.filterRanges = {
            length: { min: minLength, max: maxLength },
            price: { min: minPrice, max: maxPrice }
        };

        // Обновляем фильтры и элементы управления с новыми диапазонами
        this.filters = {
            minLength: minLength,
            maxLength: maxLength,
            minPrice: minPrice,
            maxPrice: maxPrice,
            colors: []
        };
        
        this.updateFilterUI(allColors);
    }

    /**
     * Загрузка и парсинг данных из Google Таблицы в формате CSV.
     */
    async loadProductsFromCSV() {
        try {
            console.log('📥 Loading products from CSV...');
            const response = await fetch(this.CSV_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const csvText = await response.text();
            this.products = this.parseCSV(csvText);

            // Загружаем пользовательские данные после загрузки товаров
            this.loadCart();
            this.loadFavorites();
            this.loadPurchases();

            // Инициализация диапазонов фильтров на основе загруженных данных
            this.initializeFilterRanges();

            this.renderProducts(this.products);
            console.log(`✅ ${this.products.length} товаров загружено!`);
        } catch (error) {
            console.error("❌ Ошибка загрузки данных:", error);
            const container = document.getElementById('productsContainer');
            if (container) {
                container.innerHTML = `<div style="text-align: center; color: #ffc400; padding: 50px;">
                    Ошибка загрузки данных. Проверьте URL CSV и настройки доступа: ${error.message}
                </div>`;
            }
        }
    }

    /**
     * Парсит CSV-текст в массив объектов (товаров).
     */
    parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    console.log('Обнаруженные заголовки:', headers);
    const products = [];

    for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        if (!values) continue;

        const product = {};
        headers.forEach((header, index) => {
            let value = values[index] ? values[index].trim().replace(/"/g, '') : '';
            
            // Приведение типов для числовых полей
            if (header === 'id' || header === 'price' || header === 'oldprice' || header === 'length') {
                value = parseFloat(value) || 0;
            }
            
            product[header] = value;
        });

        // Правильно извлекаем URL изображения
        let imageUrl = product.imageurl || product.image || '';
        
        products.push({
            id: product.id || i,
            name: product.name || 'Без названия',
            price: product.price || 0,
            oldPrice: product.oldprice || 0,
            length: product.length || 0,
            color: product.color || 'Не указан',
            imageUrl: imageUrl
        });
    }
    return products;
}

    /**
     * Парсит строку CSV, учитывая кавычки
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }

    /**
     * Обновляет интерфейс фильтров (ползунки, метки, список цветов)
     */
    updateFilterUI(colors) {
        const lengthMinInput = document.getElementById('lengthMin');
        const lengthMaxInput = document.getElementById('lengthMax');
        const priceMinInput = document.getElementById('priceMin');
        const priceMaxInput = document.getElementById('priceMax');
        const colorSelect = document.getElementById('colorFilter');

        if (!this.filterRanges) return;

        // Длина
        if (lengthMinInput && lengthMaxInput) {
            lengthMinInput.min = this.filterRanges.length.min;
            lengthMinInput.max = this.filterRanges.length.max;
            lengthMaxInput.min = this.filterRanges.length.min;
            lengthMaxInput.max = this.filterRanges.length.max;
            
            lengthMinInput.value = this.filters.minLength;
            lengthMaxInput.value = this.filters.maxLength;
        }

        // Цена
        if (priceMinInput && priceMaxInput) {
            priceMinInput.min = this.filterRanges.price.min;
            priceMinInput.max = this.filterRanges.price.max;
            priceMaxInput.min = this.filterRanges.price.min;
            priceMaxInput.max = this.filterRanges.price.max;
            
            priceMinInput.value = this.filters.minPrice;
            priceMaxInput.value = this.filters.maxPrice;
        }

        // Обновляем метки диапазонов
        this.updateRangeLabels();

        // Цвета
        if (colorSelect) {
            colorSelect.innerHTML = '<option value="">Все цвета</option>';
            colors.forEach(color => {
                const option = document.createElement('option');
                option.value = color;
                option.textContent = color;
                colorSelect.appendChild(option);
            });
        }
    }

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');
        this.setupNavigationListeners();
        this.setupCartListeners();
        this.setupCheckoutListeners();
        this.setupAddressListeners();
        this.setupFilterListeners();
        this.setupProductListeners();
    }

    /**
     * Обработчики навигации
     */
    setupNavigationListeners() {
        // Кнопки перехода между экранами
        const cartBtn = document.getElementById('cartBtn');
        const checkoutBtn = document.getElementById('checkoutBtn');
        const favoritesBtn = document.getElementById('favoritesBtn');
        const profileBtn = document.getElementById('profileBtn');
        const backFromCheckout = document.getElementById('backFromCheckout');
        const backFromCart = document.getElementById('backFromCart');
        const backFromFavorites = document.getElementById('backFromFavorites');
        const backFromProfile = document.getElementById('backFromProfile');

        if (cartBtn) cartBtn.addEventListener('click', () => this.showCartScreen());
        if (checkoutBtn) checkoutBtn.addEventListener('click', () => this.showCheckoutScreen());
        if (favoritesBtn) favoritesBtn.addEventListener('click', () => this.showFavoritesScreen());
        if (profileBtn) profileBtn.addEventListener('click', () => this.showProfileScreen());
        if (backFromCheckout) backFromCheckout.addEventListener('click', () => this.showCartScreen());
        if (backFromCart) backFromCart.addEventListener('click', () => this.showCatalogScreen());
        if (backFromFavorites) backFromFavorites.addEventListener('click', () => this.showCatalogScreen());
        if (backFromProfile) backFromProfile.addEventListener('click', () => this.showCatalogScreen());
        
        // Выбор способа доставки
        document.querySelectorAll('input[name="delivery"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.deliveryMethod = e.target.value;
                this.toggleAddressSection();
            });
        });

        // Выбор способа оплаты
        document.querySelectorAll('input[name="payment"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.paymentMethod = e.target.value;
            });
        });

        // Подтверждение заказа
        const confirmOrderBtn = document.getElementById('confirmOrderBtn');
        if (confirmOrderBtn) {
            confirmOrderBtn.addEventListener('click', () => this.confirmOrder());
        }

        // Вкладки профиля
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                this.switchProfileTab(tab);
            });
        });
    }

    /**
     * Обработчики корзины
     */
    setupCartListeners() {
        const cartItems = document.getElementById('cartItems');
        if (cartItems) {
            cartItems.addEventListener('click', (e) => {
                if (e.target.classList.contains('decrease-btn')) {
                    this.updateCartQuantity(e.target.getAttribute('data-id'), 'decrease');
                } else if (e.target.classList.contains('increase-btn')) {
                    this.updateCartQuantity(e.target.getAttribute('data-id'), 'increase');
                } else if (e.target.classList.contains('remove-btn')) {
                    this.removeFromCart(e.target.getAttribute('data-id'));
                }
            });
        }
    }

    /**
     * Обработчики товаров
     */
    setupProductListeners() {
        const productsContainer = document.getElementById('productsContainer');
        if (productsContainer) {
            productsContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('add-to-cart')) {
                    const productId = e.target.getAttribute('data-id');
                    this.addToCart(productId);
                } else if (e.target.classList.contains('favorite-btn')) {
                    const productId = e.target.getAttribute('data-id');
                    this.toggleFavorite(productId);
                } else if (e.target.classList.contains('catalog-quantity-btn')) {
                    const productId = e.target.getAttribute('data-id');
                    const action = e.target.classList.contains('increase-btn') ? 'increase' : 'decrease';
                    this.updateCartQuantity(productId, action);
                }
            });
        }
    }

    /**
     * Обработчики оформления заказа
     */
    setupCheckoutListeners() {
        const selectAddressBtn = document.getElementById('selectAddressBtn');
        if (selectAddressBtn) {
            selectAddressBtn.addEventListener('click', () => {
                this.showAddressModal();
            });
        }
    }

    /**
     * Обработчики системы адресов
     */
    setupAddressListeners() {
        const addressModal = document.getElementById('addressModal');
        const newAddressModal = document.getElementById('newAddressModal');
        const addNewAddressBtn = document.getElementById('addNewAddressBtn');
        const cancelAddressBtn = document.getElementById('cancelAddressBtn');
        const newAddressForm = document.getElementById('newAddressForm');

        // Закрытие модальных окон
        window.addEventListener('click', (e) => {
            if (e.target === addressModal) this.hideAddressModal();
            if (e.target === newAddressModal) this.hideNewAddressModal();
        });

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.hideAddressModal();
                this.hideNewAddressModal();
            });
        });

        // Добавление нового адреса
        if (addNewAddressBtn) {
            addNewAddressBtn.addEventListener('click', () => this.showNewAddressModal());
        }

        if (cancelAddressBtn) {
            cancelAddressBtn.addEventListener('click', () => {
                this.hideNewAddressModal();
                this.showAddressModal();
            });
        }

        // Сохранение нового адреса
        if (newAddressForm) {
            newAddressForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(newAddressForm);
                const addressData = {
                    city: formData.get('city'),
                    street: formData.get('street'),
                    house: formData.get('house'),
                    apartment: formData.get('apartment'),
                    deliveryCompany: formData.get('deliveryCompany')
                };
                this.saveNewAddress(addressData);
            });
        }
    }

    /**
     * Обработчики фильтров
     */
    setupFilterListeners() {
        const applyFiltersBtn = document.getElementById('applyFilters');
        const resetFiltersBtn = document.getElementById('resetFilters');
        const filterToggle = document.getElementById('filterToggle');
        const filterSidebar = document.getElementById('filterSidebar');
        const closeFilters = document.getElementById('closeFilters');

        // Кнопка применения фильтров
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                this.getFilterValues();
                this.applyFilters();
                if (window.innerWidth <= 900) {
                    filterSidebar.classList.remove('active');
                }
            });
        }

        // Кнопка сброса фильтров
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => this.resetFilters());
        }

        // Переключение фильтров на мобильных
        if (filterToggle && filterSidebar) {
            filterToggle.addEventListener('click', () => {
                filterSidebar.classList.add('active');
            });
        }

        if (closeFilters && filterSidebar) {
            closeFilters.addEventListener('click', () => {
                filterSidebar.classList.remove('active');
            });
        }

        // Закрытие фильтров при клике вне области
        document.addEventListener('click', (e) => {
            if (filterSidebar && filterSidebar.classList.contains('active') &&
                !filterSidebar.contains(e.target) && 
                !e.target.closest('#filterToggle')) {
                filterSidebar.classList.remove('active');
            }
        });

        // Обновление значений ползунков
        const lengthMinInput = document.getElementById('lengthMin');
        const lengthMaxInput = document.getElementById('lengthMax');
        const priceMinInput = document.getElementById('priceMin');
        const priceMaxInput = document.getElementById('priceMax');

        [lengthMinInput, lengthMaxInput, priceMinInput, priceMaxInput].forEach(input => {
            if (input) {
                input.addEventListener('input', () => this.updateRangeLabels());
            }
        });
    }

    /**
     * Обновляет текстовые метки для текущих значений ползунков.
     */
    updateRangeLabels() {
        const lengthMinInput = document.getElementById('lengthMin');
        const lengthMaxInput = document.getElementById('lengthMax');
        const priceMinInput = document.getElementById('priceMin');
        const priceMaxInput = document.getElementById('priceMax');

        const lengthValue = document.getElementById('lengthValue');
        const priceValue = document.getElementById('priceValue');

        // Обновление меток текущих значений
        if (lengthMinInput && lengthMaxInput && lengthValue) {
            const lengthMin = parseInt(lengthMinInput.value);
            const lengthMax = parseInt(lengthMaxInput.value);

            // Убеждаемся, что min не больше max
            if (lengthMin > lengthMax) {
                lengthMinInput.value = lengthMax;
            }

            lengthValue.textContent = `${Math.min(lengthMin, lengthMax)}-${Math.max(lengthMin, lengthMax)} см`;
        }

        if (priceMinInput && priceMaxInput && priceValue) {
            const priceMin = parseInt(priceMinInput.value);
            const priceMax = parseInt(priceMaxInput.value);

            if (priceMin > priceMax) {
                priceMinInput.value = priceMax;
            }

            priceValue.textContent = `${Math.min(priceMin, priceMax)}-${Math.max(priceMin, priceMax)} ₽`;
        }

        // Обновление минимальных и максимальных меток
        const lengthMinLabel = document.getElementById('lengthMinLabel');
        const lengthMaxLabel = document.getElementById('lengthMaxLabel');
        const priceMinLabel = document.getElementById('priceMinLabel');
        const priceMaxLabel = document.getElementById('priceMaxLabel');

        if (this.filterRanges) {
            if (lengthMinLabel) lengthMinLabel.textContent = `${this.filterRanges.length.min} см`;
            if (lengthMaxLabel) lengthMaxLabel.textContent = `${this.filterRanges.length.max} см`;
            if (priceMinLabel) priceMinLabel.textContent = `${this.filterRanges.price.min} ₽`;
            if (priceMaxLabel) priceMaxLabel.textContent = `${this.filterRanges.price.max} ₽`;
        }
    }

    /**
     * Собирает текущие значения фильтров из элементов управления.
     */
    getFilterValues() {
        const lengthMinInput = document.getElementById('lengthMin');
        const lengthMaxInput = document.getElementById('lengthMax');
        const priceMinInput = document.getElementById('priceMin');
        const priceMaxInput = document.getElementById('priceMax');
        const colorFilter = document.getElementById('colorFilter');

        const selectedColors = colorFilter ? Array.from(colorFilter.selectedOptions)
                                   .filter(option => option.value !== '')
                                   .map(option => option.value) : [];

        this.filters = {
            minLength: lengthMinInput ? parseInt(lengthMinInput.value) : this.filters.minLength,
            maxLength: lengthMaxInput ? parseInt(lengthMaxInput.value) : this.filters.maxLength,
            minPrice: priceMinInput ? parseInt(priceMinInput.value) : this.filters.minPrice,
            maxPrice: priceMaxInput ? parseInt(priceMaxInput.value) : this.filters.maxPrice,
            colors: selectedColors
        };

        console.log('🔍 Текущие фильтры:', this.filters);
    }

    /**
     * Рендеринг списка товаров в контейнере.
     */
    renderProducts(products) {
        const container = document.getElementById('productsContainer');
        if (!container) return;

        if (products.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 50px; color: #ffc400;">По вашим критериям товары не найдены.</div>';
            return;
        }

        container.innerHTML = products.map(product => this.createProductCard(product)).join('');
    }

    /**
     * Создает HTML-разметку для одной карточки товара.
     */
   createProductCard(product) {
    const hasDiscount = product.oldPrice && product.oldPrice > product.price;
    const priceDisplay = hasDiscount 
        ? `<span class="product-price">${product.price.toLocaleString()} ₽</span>
           <span class="product-old-price">${product.oldPrice.toLocaleString()} ₽</span>`
        : `<span class="product-price">${product.price.toLocaleString()} ₽</span>`;

    const isInCart = this.cart.some(item => item.id == product.id);
    const cartItem = this.cart.find(item => item.id == product.id);
    const quantity = cartItem ? cartItem.quantity : 0;
    const isFavorite = this.favorites.some(item => item.id == product.id);

    // Проверяем и корректируем URL изображения
    let imageUrl = product.imageUrl || '';
    
    // Если URL относительный или неправильный, попробуем исправить
    if (imageUrl && !imageUrl.startsWith('http')) {
        // Если это просто имя файла, добавим базовый путь
        imageUrl = `https://drive.google.com/uc?export=view&id=${imageUrl}`;
    }

    return `
        <div class="product-card" data-id="${product.id}">
            <div class="product-image">
                ${imageUrl ? `
                    <img src="${imageUrl}" alt="${product.name}" 
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                         onload="this.style.display='block'; this.nextElementSibling.style.display='none';">
                ` : ''}
                <div class="image-placeholder" style="display: ${imageUrl ? 'none' : 'flex'};">
                    📷
                </div>
                <button class="favorite-btn ${isFavorite ? 'active' : ''}" data-id="${product.id}">
                    ${isFavorite ? '❤️' : '🤍'}
                </button>
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <div class="product-meta">
                    <span>Длина: ${product.length} см</span>
                    <span>Цвет: ${product.color}</span>
                </div>
                ${priceDisplay}
                ${isInCart ? `
                    <div class="catalog-quantity-controls">
                        <button class="catalog-quantity-btn decrease-btn" data-id="${product.id}">-</button>
                        <span class="catalog-quantity">${quantity}</span>
                        <button class="catalog-quantity-btn increase-btn" data-id="${product.id}">+</button>
                    </div>
                ` : `
                    <button class="btn-primary add-to-cart" data-id="${product.id}">
                        Добавить в корзину
                    </button>
                `}
            </div>
        </div>
    `;
}

    /**
     * Применяет текущие фильтры к списку товаров и обновляет отображение.
     */
    applyFilters() {
        const filteredProducts = this.products.filter(product => {
            const lengthMatch = product.length >= this.filters.minLength && 
                              product.length <= this.filters.maxLength;
            
            const priceMatch = product.price >= this.filters.minPrice && 
                             product.price <= this.filters.maxPrice;
            
            const colorMatch = this.filters.colors.length === 0 || 
                             this.filters.colors.includes(product.color);
            
            return lengthMatch && priceMatch && colorMatch;
        });
        
        this.renderProducts(filteredProducts);
        console.log(`🔍 Отображено ${filteredProducts.length} из ${this.products.length} товаров`);
    }

    /**
     * Сброс всех фильтров к начальным значениям.
     */
    resetFilters() {
        if (this.filterRanges) {
            this.filters = {
                minLength: this.filterRanges.length.min,
                maxLength: this.filterRanges.length.max,
                minPrice: this.filterRanges.price.min,
                maxPrice: this.filterRanges.price.max,
                colors: []
            };
            
            // Сброс визуальных элементов
            const lengthMinInput = document.getElementById('lengthMin');
            const lengthMaxInput = document.getElementById('lengthMax');
            const priceMinInput = document.getElementById('priceMin');
            const priceMaxInput = document.getElementById('priceMax');
            const colorFilter = document.getElementById('colorFilter');
            
            if (lengthMinInput) lengthMinInput.value = this.filters.minLength;
            if (lengthMaxInput) lengthMaxInput.value = this.filters.maxLength;
            if (priceMinInput) priceMinInput.value = this.filters.minPrice;
            if (priceMaxInput) priceMaxInput.value = this.filters.maxPrice;
            if (colorFilter) colorFilter.selectedIndex = 0;
            
            this.updateRangeLabels();
            this.applyFilters();
            
            console.log('✅ Фильтры сброшены');
        }
    }

    /**
     * Переключение экранов
     */
    showCatalogScreen() {
        document.getElementById('catalogScreen').classList.add('active');
        document.getElementById('cartScreen').classList.remove('active');
        document.getElementById('favoritesScreen').classList.remove('active');
        document.getElementById('profileScreen').classList.remove('active');
        document.getElementById('checkoutScreen').classList.remove('active');
    }

    showCartScreen() {
        if (this.cart.length === 0) {
            this.showNotification('🛒 Корзина пуста');
            return;
        }

        document.getElementById('catalogScreen').classList.remove('active');
        document.getElementById('cartScreen').classList.add('active');
        document.getElementById('favoritesScreen').classList.remove('active');
        document.getElementById('profileScreen').classList.remove('active');
        document.getElementById('checkoutScreen').classList.remove('active');
        this.renderCart();
    }

    showFavoritesScreen() {
        document.getElementById('catalogScreen').classList.remove('active');
        document.getElementById('cartScreen').classList.remove('active');
        document.getElementById('favoritesScreen').classList.add('active');
        document.getElementById('profileScreen').classList.remove('active');
        document.getElementById('checkoutScreen').classList.remove('active');
        this.renderFavorites();
    }

    showProfileScreen() {
        document.getElementById('catalogScreen').classList.remove('active');
        document.getElementById('cartScreen').classList.remove('active');
        document.getElementById('favoritesScreen').classList.remove('active');
        document.getElementById('profileScreen').classList.add('active');
        document.getElementById('checkoutScreen').classList.remove('active');
        this.renderProfile();
    }

    showCheckoutScreen() {
        if (this.cart.length === 0) {
            this.showNotification('🛒 Корзина пуста');
            return;
        }

        document.getElementById('catalogScreen').classList.remove('active');
        document.getElementById('cartScreen').classList.remove('active');
        document.getElementById('favoritesScreen').classList.remove('active');
        document.getElementById('profileScreen').classList.remove('active');
        document.getElementById('checkoutScreen').classList.add('active');
        
        this.renderCheckoutItems();
        this.toggleAddressSection();
        this.updateCheckoutAddressDisplay();
    }

    /**
     * Переключение вкладок профиля
     */
    switchProfileTab(tab) {
        // Обновляем активные кнопки
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

        // Обновляем активные панели
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`${tab}Tab`).classList.add('active');

        if (tab === 'favorites') {
            this.renderProfileFavorites();
        } else if (tab === 'purchases') {
            this.renderPurchases();
        }
    }

    /**
     * Рендеринг избранного
     */
    renderFavorites() {
        const favoritesContainer = document.getElementById('favoritesContainer');
        
        if (this.favorites.length === 0) {
            favoritesContainer.innerHTML = '<div class="empty-state">❤️ В избранном пока ничего нет</div>';
            return;
        }

        favoritesContainer.innerHTML = this.favorites.map(product => this.createProductCard(product)).join('');
    }

    /**
     * Рендеринг профиля
     */
    renderProfile() {
        // Обновляем информацию пользователя
        if (this.telegramUser) {
            const profileName = document.getElementById('profileName');
            const profileUsername = document.getElementById('profileUsername');
            const profilePhoto = document.getElementById('profilePhoto');
            const profileInitials = document.getElementById('profileInitials');

            const userName = `${this.telegramUser.first_name} ${this.telegramUser.last_name || ''}`.trim();
            const userInitials = this.getUserInitials(userName);

            if (profileName) profileName.textContent = userName;
            if (profileUsername) {
                if (this.telegramUser.username) {
                    profileUsername.textContent = `@${this.telegramUser.username}`;
                    profileUsername.href = `https://t.me/${this.telegramUser.username}`;
                    profileUsername.style.display = 'block';
                } else {
                    profileUsername.style.display = 'none';
                }
            }

            if (this.telegramUser.photo_url) {
                profilePhoto.src = this.telegramUser.photo_url;
                profilePhoto.style.display = 'block';
                profileInitials.style.display = 'none';
            } else {
                profilePhoto.style.display = 'none';
                profileInitials.style.display = 'flex';
                profileInitials.textContent = userInitials;
            }
        }

        // Рендерим вкладки
        this.renderProfileFavorites();
        this.renderPurchases();
    }

    /**
     * Получает инициалы пользователя
     */
    getUserInitials(userName) {
        return userName.split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }

    /**
     * Рендеринг избранного в профиле
     */
    renderProfileFavorites() {
        const profileFavorites = document.getElementById('profileFavorites');
        
        if (this.favorites.length === 0) {
            profileFavorites.innerHTML = '<div class="empty-state">❤️ В избранном пока ничего нет</div>';
            return;
        }

        profileFavorites.innerHTML = this.favorites.map(product => this.createProductCard(product)).join('');
    }

    /**
     * Рендеринг истории покупок
     */
    renderPurchases() {
        const purchasesList = document.getElementById('purchasesTab');
        
        if (this.purchases.length === 0) {
            purchasesList.innerHTML = '<div class="empty-state">📦 У вас пока нет покупок</div>';
            return;
        }

        // Сортируем покупки по дате (новые сверху)
        const sortedPurchases = [...this.purchases].sort((a, b) => new Date(b.date) - new Date(a.date));

        purchasesList.innerHTML = `
            <div class="purchases-list">
                ${sortedPurchases.map(purchase => `
                    <div class="purchase-item">
                        <div class="purchase-header">
                            <strong>Заказ #${purchase.id}</strong>
                            <span class="purchase-date">${new Date(purchase.date).toLocaleDateString('ru-RU')}</span>
                        </div>
                        <div class="purchase-items">
                            ${purchase.items.map(item => `
                                <div class="purchase-item-info">
                                    <span>${item.name}</span>
                                    <span>${item.quantity} × ${item.price.toLocaleString()} ₽</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="purchase-total">
                            Итого: ${purchase.total.toLocaleString()} ₽
                        </div>
                        <div class="purchase-delivery">
                            ${purchase.delivery === 'delivery' ? '🚚 Доставка' : '🏪 Самовывоз'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Переключение секции адреса
     */
    toggleAddressSection() {
        const addressSection = document.getElementById('addressSection');
        if (this.deliveryMethod === 'delivery') {
            addressSection.style.display = 'block';
        } else {
            addressSection.style.display = 'none';
        }
    }

    /**
     * Показывает модальное окно выбора адреса
     */
    showAddressModal() {
        document.getElementById('addressModal').style.display = 'block';
        this.renderSavedAddresses();
    }

    /**
     * Скрывает модальное окно выбора адреса
     */
    hideAddressModal() {
        document.getElementById('addressModal').style.display = 'none';
    }

    /**
     * Показывает модальное окно добавления адреса
     */
    showNewAddressModal() {
        this.hideAddressModal();
        document.getElementById('newAddressModal').style.display = 'block';
    }

    /**
     * Скрывает модальное окно добавления адреса
     */
    hideNewAddressModal() {
        document.getElementById('newAddressModal').style.display = 'none';
    }

    /**
     * Рендерит список сохраненных адресов
     */
    renderSavedAddresses() {
        const container = document.getElementById('savedAddresses');
        
        if (this.userAddresses.length === 0) {
            container.innerHTML = '<div class="empty-addresses">🏠 У вас пока нет сохраненных адресов</div>';
            return;
        }

        container.innerHTML = this.userAddresses.map((address, index) => `
            <div class="address-item ${this.selectedAddress === index ? 'selected' : ''}" 
                 data-index="${index}">
                <div class="address-main">
                    ${address.city}, ул. ${address.street}, д. ${address.house}
                    ${address.apartment ? `, кв. ${address.apartment}` : ''}
                </div>
                <div class="address-details">
                    ${this.getDeliveryCompanyName(address.deliveryCompany)}
                </div>
            </div>
        `).join('');

        // Обработчики выбора адреса
        container.addEventListener('click', (e) => {
            const addressItem = e.target.closest('.address-item');
            if (addressItem) {
                const index = parseInt(addressItem.getAttribute('data-index'));
                this.selectAddress(index);
            }
        });
    }

    /**
     * Выбирает адрес доставки
     */
    selectAddress(index) {
        this.selectedAddress = index;
        this.renderSavedAddresses();
        this.updateCheckoutAddressDisplay();
        this.hideAddressModal();
    }

    /**
     * Сохраняет новый адрес
     */
    saveNewAddress(formData) {
        const newAddress = {
            id: Date.now(),
            city: formData.city.trim(),
            street: formData.street.trim(),
            house: formData.house.trim(),
            apartment: formData.apartment ? formData.apartment.trim() : '',
            deliveryCompany: formData.deliveryCompany,
            createdAt: new Date().toISOString()
        };

        this.userAddresses.push(newAddress);
        localStorage.setItem(this.addressesKey, JSON.stringify(this.userAddresses));
        this.selectedAddress = this.userAddresses.length - 1;
        this.hideNewAddressModal();
        this.showNotification('✅ Адрес успешно сохранен!');
        this.updateCheckoutAddressDisplay();
    }

    /**
     * Обновляет отображение адреса на странице оформления заказа
     */
    updateCheckoutAddressDisplay() {
        const addressElement = document.getElementById('selectedAddress');
        if (addressElement && this.selectedAddress !== null) {
            const address = this.userAddresses[this.selectedAddress];
            addressElement.innerHTML = `
                <div class="address-main">
                    ${address.city}, ул. ${address.street}, д. ${address.house}
                    ${address.apartment ? `, кв. ${address.apartment}` : ''}
                </div>
                <div class="address-details">
                    ${this.getDeliveryCompanyName(address.deliveryCompany)}
                </div>
            `;
            addressElement.classList.remove('empty');
        }
    }

    /**
     * Получает название транспортной компании
     */
    getDeliveryCompanyName(code) {
        const companies = {
            'cdek': 'СДЭК',
            'boxberry': 'Boxberry',
            'russian_post': 'Почта России',
            'dhl': 'DHL',
            'dpd': 'DPD',
            'yandex': 'Яндекс Доставка'
        };
        return companies[code] || code;
    }

    /**
     * Рендерит товары на странице оформления заказа
     */
    renderCheckoutItems() {
        const container = document.getElementById('orderItems');
        const totalElement = document.getElementById('checkoutTotalAmount');
        
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        totalElement.textContent = `${total.toLocaleString()} ₽`;

        container.innerHTML = this.cart.map(item => `
            <div class="order-item">
                <div class="order-item-image">
                    <div class="image-placeholder-small">
                        ${item.name.charAt(0).toUpperCase()}
                    </div>
                </div>
                <div class="order-item-info">
                    <div class="order-item-name">${item.name}</div>
                    <div class="order-item-meta">
                        <span>${item.length} см • ${item.color}</span>
                        <span class="order-item-quantity">${item.quantity} шт</span>
                    </div>
                </div>
                <div class="order-item-price">
                    ${(item.price * item.quantity).toLocaleString()} ₽
                </div>
            </div>
        `).join('');
    }

    /**
     * Подтверждение заказа
     */
    confirmOrder() {
        if (this.deliveryMethod === 'delivery' && this.selectedAddress === null) {
            this.showNotification('🚚 Пожалуйста, выберите адрес доставки');
            return;
        }

        const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const orderDetails = this.cart.map(item => 
            `• ${item.name} - ${item.quantity} × ${item.price.toLocaleString()} ₽`
        ).join('\n');

        const deliveryInfo = this.deliveryMethod === 'delivery' ? 
            `🏠 Адрес доставки: ${this.userAddresses[this.selectedAddress].city}, ул. ${this.userAddresses[this.selectedAddress].street}, д. ${this.userAddresses[this.selectedAddress].house}` :
            '🏪 Самовывоз из магазина';

        const paymentMethods = {
            'cash': 'Наличными',
            'card': 'Перевод на карту',
            'online': 'Онлайн оплата',
            'sbp': 'СБП'
        };

        const message = `🛍️ Заказ подтвержден!\n\n` +
                       `👤 Покупатель: ${this.telegramUser?.first_name || 'Неизвестно'}\n` +
                       `🚚 Способ получения: ${this.deliveryMethod === 'delivery' ? 'Доставка' : 'Самовывоз'}\n` +
                       `${deliveryInfo}\n` +
                       `💳 Способ оплаты: ${paymentMethods[this.paymentMethod]}\n\n` +
                       `📦 Товары:\n${orderDetails}\n\n` +
                       `💎 Итого: ${total.toLocaleString()} ₽\n\n` +
                       `🕐 Время: ${new Date().toLocaleString()}`;

        // Сохраняем покупку
        const newPurchase = {
            id: Date.now(),
            date: new Date(),
            items: [...this.cart],
            total: total,
            delivery: this.deliveryMethod,
            payment: this.paymentMethod,
            address: this.deliveryMethod === 'delivery' ? this.userAddresses[this.selectedAddress] : null
        };

        this.purchases.push(newPurchase);
        this.savePurchases();

        alert(message);
        
        // Очищаем корзину
        this.cart = [];
        this.saveCart();
        this.updateCartCount();
        this.showCatalogScreen();
        this.products.forEach(product => this.updateProductCard(product.id));
    }

    /**
     * Добавление товара в корзину
     */
    addToCart(productId) {
        const product = this.products.find(p => p.id == productId);
        if (product) {
            this.cart.push({
                ...product,
                quantity: 1
            });
            this.saveCart();
            this.updateCartCount();
            this.updateProductCard(productId);
            this.showNotification(`Товар "${product.name}" добавлен в корзину!`);
        }
    }

    /**
     * Обновление количества товара в корзине
     */
    updateCartQuantity(productId, action) {
        const cartItem = this.cart.find(item => item.id == productId);
        if (cartItem) {
            if (action === 'increase') {
                cartItem.quantity += 1;
            } else if (action === 'decrease') {
                if (cartItem.quantity > 1) {
                    cartItem.quantity -= 1;
                } else {
                    this.removeFromCart(productId);
                    return;
                }
            }
            this.saveCart();
            this.updateCartCount();
            this.updateProductCard(productId);
            
            // Если мы на экране корзины, обновляем его
            if (document.getElementById('cartScreen').classList.contains('active')) {
                this.renderCart();
            }
        }
    }

    /**
     * Удаляет товар из корзины
     */
    removeFromCart(productId) {
        const itemIndex = this.cart.findIndex(item => item.id == productId);
        if (itemIndex > -1) {
            const item = this.cart[itemIndex];
            this.cart.splice(itemIndex, 1);
            this.saveCart();
            this.updateCartCount();
            this.updateProductCard(productId);
            if (document.getElementById('cartScreen').classList.contains('active')) {
                this.renderCart();
            }
            this.showNotification(`Товар "${item.name}" удален из корзины`);
        }
    }

    /**
     * Обновляет карточку товара
     */
    updateProductCard(productId) {
        const product = this.products.find(p => p.id == productId);
        if (product) {
            const productCard = document.querySelector(`.product-card[data-id="${productId}"]`);
            if (productCard) {
                const newCard = this.createProductCard(product);
                productCard.outerHTML = newCard;
            }
        }
    }

    /**
     * Обновляет счетчик корзины
     */
    updateCartCount() {
        const cartCount = document.getElementById('cartCount');
        if (cartCount) {
            const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
            cartCount.textContent = totalItems;
            cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
        }
    }

    /**
     * Переключение избранного
     */
    toggleFavorite(productId) {
        const product = this.products.find(p => p.id == productId);
        if (product) {
            const existingIndex = this.favorites.findIndex(item => item.id == productId);
            
            if (existingIndex > -1) {
                // Удаляем из избранного
                this.favorites.splice(existingIndex, 1);
                this.saveFavorites();
                this.showNotification(`Товар "${product.name}" удален из избранного`);
            } else {
                // Добавляем в избранное
                this.favorites.push(product);
                this.saveFavorites();
                this.showNotification(`Товар "${product.name}" добавлен в избранное!`);
            }
            
            this.updateFavoritesCount();
            this.updateProductCard(productId);
        }
    }

    /**
     * Обновляет счетчик избранного
     */
    updateFavoritesCount() {
        const favoritesCount = document.getElementById('favoritesCount');
        if (favoritesCount) {
            const totalItems = this.favorites.length;
            favoritesCount.textContent = totalItems;
            favoritesCount.style.display = totalItems > 0 ? 'flex' : 'none';
        }
    }

    /**
     * Рендеринг корзины
     */
    renderCart() {
        const cartItems = document.getElementById('cartItems');
        const totalAmount = document.getElementById('totalAmount');
        
        if (this.cart.length === 0) {
            cartItems.innerHTML = '<div class="empty-cart">🛒 Корзина пуста</div>';
            totalAmount.textContent = '0';
            return;
        }

        const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        totalAmount.textContent = total.toLocaleString();

        cartItems.innerHTML = this.cart.map(item => `
            <div class="cart-item" data-id="${item.id}">
                <div class="cart-item-image">
                    <div class="image-placeholder-small">
                        ${item.name.charAt(0).toUpperCase()}
                    </div>
                </div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-meta">
                        <span>Длина: ${item.length} см</span>
                        <span>Цвет: ${item.color}</span>
                    </div>
                    <div class="cart-item-price">${(item.price * item.quantity).toLocaleString()} ₽</div>
                </div>
                <div class="cart-item-controls">
                    <div class="quantity-controls">
                        <button class="quantity-btn decrease-btn" data-id="${item.id}">-</button>
                        <span class="quantity">${item.quantity}</span>
                        <button class="quantity-btn increase-btn" data-id="${item.id}">+</button>
                    </div>
                    <button class="remove-btn" data-id="${item.id}">Удалить</button>
                </div>
            </div>
        `).join('');

        // Добавляем обработчики для кнопок в корзине
        cartItems.addEventListener('click', (e) => {
            if (e.target.classList.contains('decrease-btn')) {
                this.updateCartQuantity(e.target.getAttribute('data-id'), 'decrease');
            } else if (e.target.classList.contains('increase-btn')) {
                this.updateCartQuantity(e.target.getAttribute('data-id'), 'increase');
            } else if (e.target.classList.contains('remove-btn')) {
                this.removeFromCart(e.target.getAttribute('data-id'));
            }
        });
    }

    /**
     * Показывает уведомление
     */
    showNotification(message) {
        // Создаем элемент уведомления
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ffc400;
            color: #000;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(255, 204, 0, 0.3);
            z-index: 10000;
            font-weight: 600;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Анимация появления
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Автоматическое скрытие через 3 секунды
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Запускаем каталог при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 DOM loaded, initializing catalog...');
    window.catalog = new HairShopCatalog();
});
