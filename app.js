class HairShopCatalog {
    constructor() {
        // !! ИСПОЛЬЗУЕМ CORS-ПРОКСИ С ПРЯМОЙ ОПУБЛИКОВАННОЙ CSV-ССЫЛКОЙ
        this.CSV_URL = "https://corsproxy.io/?https://docs.google.com/spreadsheets/d/e/2PACX-1vS800Y_zN10Ys9uQfkEB67ZqlWMobbZTAkIu4l4X-a2rp1e80jlrFfhQV1m18n5hHCBANXc7VjRhIo5/pub?output=csv";
        
        this.products = [];
        this.filterRanges = null; 
        this.filters = {
            minLength: 14,
            maxLength: 30,
            minPrice: 1000,
            maxPrice: 10000,
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
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing HairShopCatalog...');
        try {
            this.initTelegram();
            this.initAddressSystem();
            this.renderLoading();
            await this.loadProductsFromCSV();
            this.setupEventListeners();
            this.setupNavigationListeners();
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
    initTelegram() {
        if (window.Telegram && Telegram.WebApp) {
            this.telegramUser = Telegram.WebApp.initDataUnsafe?.user;
            Telegram.WebApp.expand();
            Telegram.WebApp.enableClosingConfirmation();
            console.log('✅ Telegram WebApp initialized');
        } else {
            console.log('⚠️ Telegram WebApp not detected, running in standalone mode');
            // Для тестирования вне Telegram
            this.telegramUser = {
                first_name: "Тестовый",
                last_name: "Пользователь",
                username: "test_user"
            };
        }
    }

    /**
     * Инициализация системы адресов
     */
    initAddressSystem() {
        // Загрузка сохраненных адресов из localStorage
        const savedAddresses = localStorage.getItem('userAddresses');
        if (savedAddresses) {
            this.userAddresses = JSON.parse(savedAddresses);
        }
        
        // Загрузка выбранного адреса
        const savedSelectedAddress = localStorage.getItem('selectedAddress');
        if (savedSelectedAddress) {
            this.selectedAddress = JSON.parse(savedSelectedAddress);
        }
    }

    /**
     * Загружает данные с помощью fetch и CORS-прокси
     */
    async loadProductsFromCSV() {
        try {
            console.log('📥 Загрузка из (CORS Proxy):', this.CSV_URL);
            const response = await fetch(this.CSV_URL);
            
            if (!response.ok) {
                throw new Error(`HTTP ошибка! Статус: ${response.status}. Возможно, corsproxy.io заблокирован или ссылка неверна.`);
            }
            
            const csvText = await response.text();
            console.log('📄 CSV контент загружен.');
            
            this.products = this.parseCSV(csvText); 
            console.log('✅ Разобрано продуктов:', this.products.length);

            if (this.products.length === 0) {
                 this.renderError('Не удалось разобрать товары из CSV. Проверьте заголовки (id, price, length, color и т.д.) и данные в таблице.');
                 return;
            }

            // Настраиваем все элементы UI
            this.determineFilterRanges();
            this.updateRangeValues();
            this.updateRangeSliders();
            this.renderProducts(this.products);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки или парсинга CSV:', error);
            this.renderError(`Не удалось загрузить данные каталога: ${error.message}. Пожалуйста, проверьте консоль (F12) для деталей.`);
        }
    }

    /**
     * УМНЫЙ ПАРСЕР CSV
     * Ищет столбцы по названию заголовка (русскому или английскому), а не по порядку.
     */
    parseCSV(csvText) {
        // Удаляем пустые строки и строки с лишними пробелами
        const lines = csvText.split('\n').filter(line => line.trim() !== ''); 
        if (lines.length < 2) return []; 

        // Парсинг заголовков (очищаем от кавычек, лишних пробелов и переводим в нижний регистр)
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, '')); 
        console.log('Обнаруженные заголовки:', headers);
        const products = [];

        // Находим индексы по заголовкам (проверка на русские/английские варианты)
        const colIndices = {
            id: headers.indexOf('id'),
            name: headers.indexOf('name') > -1 ? headers.indexOf('name') : headers.indexOf('название'),
            length: headers.indexOf('length') > -1 ? headers.indexOf('length') : headers.indexOf('длина'),
            price: headers.indexOf('price') > -1 ? headers.indexOf('price') : headers.indexOf('цена'),
            oldPrice: headers.indexOf('old_price') > -1 ? headers.indexOf('old_price') : headers.indexOf('стараяцена'),
            color: headers.indexOf('color') > -1 ? headers.indexOf('color') : headers.indexOf('цвет'),
            imageUrl: headers.indexOf('images') > -1 ? headers.indexOf('images') : headers.indexOf('imageurl'),
            description: headers.indexOf('description') > -1 ? headers.indexOf('description') : headers.indexOf('описание'),
        };
        
        // Проверка, найдены ли ключевые столбцы
        if (colIndices.id === -1 || colIndices.price === -1 || colIndices.length === -1) {
            console.error(`Критическая ошибка: В CSV отсутствуют обязательные заголовки: 'id', 'price' (или 'цена'), 'length' (или 'длина'). Обнаруженные заголовки: [${headers.join(', ')}]`);
            return []; 
        }

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(','); 
            const product = {};

            // Функция для безопасного получения значения и удаления кавычек
            const getValue = (index) => (index !== -1 && values[index] !== undefined) ? values[index].trim().replace(/"/g, '') : null;

            product.id = getValue(colIndices.id);
            product.name = getValue(colIndices.name) || 'Без названия';
            product.length = parseInt(getValue(colIndices.length)) || 0;
            product.price = parseInt(getValue(colIndices.price)) || 0;
            product.oldPrice = parseInt(getValue(colIndices.oldPrice)) || 0;
            product.color = getValue(colIndices.color) || 'Неизвестный';
            product.imageUrl = getValue(colIndices.imageUrl) || '';
            product.description = getValue(colIndices.description) || 'Нет описания.';

            if (product.id && product.price > 0 && product.length > 0) {
                products.push(product);
            }
        }
        return products;
    }
    
    determineFilterRanges() {
        if (this.products.length === 0) return;

        const allLengths = this.products.map(p => p.length).filter(l => l > 0);
        const allPrices = this.products.map(p => p.price).filter(p => p > 0);
        // Создаем массив уникальных цветов, исключая пустые/неизвестные
        const allColors = [...new Set(this.products.map(p => p.color))].filter(c => c && c.trim() !== '' && c !== 'Неизвестный'); 

        const minLength = Math.min(...allLengths);
        const maxLength = Math.max(...allLengths);
        const minPrice = Math.min(...allPrices);
        const maxPrice = Math.max(...allPrices);

        this.filterRanges = {
            length: { min: minLength, max: maxLength },
            price: { min: minPrice, max: maxPrice },
            colors: allColors.sort()
        };
        
        // Устанавливаем текущие фильтры в границы диапазона
        this.filters.minLength = minLength;
        this.filters.maxLength = maxLength;
        this.filters.minPrice = minPrice;
        this.filters.maxPrice = maxPrice;
        
        this.setupColorFilter(allColors);
    }
    
    setupColorFilter(colors) {
        const select = document.getElementById('colorFilter');
        if (!select) return;
        select.innerHTML = '';
        
        // Создаем опцию для сброса фильтра, которая не будет добавляться в this.filters.colors
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '— Выберите цвет(а) —';
        select.appendChild(defaultOption);

        colors.forEach(color => {
            const option = document.createElement('option');
            option.value = color;
            option.textContent = color;
            select.appendChild(option);
        });
    }

    renderLoading() {
        const container = document.getElementById('productsContainer');
        if (container) {
            container.innerHTML = `
                <div id="loadingIndicator" class="loading-indicator">
                    <h2>Загрузка каталога... 💇‍♀️</h2>
                    <div class="spinner"></div>
                    <p>Пожалуйста, подождите, идет загрузка данных из Google Таблицы.</p>
                </div>
            `;
        }
    }
    
    renderError(message) {
        const container = document.getElementById('productsContainer');
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }

        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <h3>❌ Ошибка загрузки данных</h3>
                    <p>${message}</p>
                    <p>Проверьте, что таблица опубликована в формат CSV и адрес верен.</p>
                </div>
            `;
        }
    }

    renderProducts(products) {
        const container = document.getElementById('productsContainer');
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        
        if (!container) return;

        if (products.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <h3>Нет товаров по заданным фильтрам 😔</h3>
                    <p>Попробуйте сбросить фильтры.</p>
                    <button class="reset-button" onclick="window.catalog.resetFilters()">Сбросить фильтры</button>
                </div>
            `;
            return;
        }

        container.innerHTML = products.map(product => this.createProductCard(product)).join('');
    }

    /**
     * Создает карточку товара
     */
    createProductCard(product) {
        const isFavorite = this.favorites.some(fav => fav.id === product.id);
        
        return `
            <div class="product-card">
                <div class="product-image-container">
                    <img src="${product.imageUrl || 'https://placehold.co/400x200/cccccc/333333?text=Нет+Фото'}" 
                         alt="${product.name}" class="product-image" 
                         onerror="this.onerror=null;this.src='https://placehold.co/400x200/cccccc/333333?text=Нет+Фото';">
                    <button class="favorite-btn ${isFavorite ? 'active' : ''}" 
                            onclick="window.catalog.toggleFavorite('${product.id}')">
                        ${isFavorite ? '❤️' : '🤍'}
                    </button>
                </div>
                <div class="product-info">
                    <h4 class="product-name">${product.name}</h4>
                    <p class="product-description">${product.description.substring(0, 100)}...</p>
                    <div class="product-specs">
                        <span>📏 ${product.length} см</span>
                        <span>🎨 ${product.color}</span>
                    </div>
                    <div class="price-section">
                        ${product.oldPrice > product.price ? 
                            `<span class="product-old-price">${product.oldPrice.toLocaleString('ru-RU')} ₽</span>` : ''}
                        <span class="product-price">${product.price.toLocaleString('ru-RU')} ₽</span>
                    </div>
                    <button class="add-to-cart-button" onclick="window.catalog.addToCart('${product.id}')">
                        🛍️ Добавить в корзину
                    </button>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        const lengthMinSlider = document.getElementById('lengthMin');
        const lengthMaxSlider = document.getElementById('lengthMax');
        const priceMinSlider = document.getElementById('priceMin');
        const priceMaxSlider = document.getElementById('priceMax');
        const colorFilter = document.getElementById('colorFilter');
        const resetButton = document.getElementById('resetFilters');

        // Устанавливаем min/max значения для ползунков на основе реальных данных
        if(this.filterRanges) {
            if (lengthMinSlider) {
                lengthMinSlider.min = this.filterRanges.length.min;
                lengthMinSlider.max = this.filterRanges.length.max;
            }
            if (lengthMaxSlider) {
                lengthMaxSlider.min = this.filterRanges.length.min;
                lengthMaxSlider.max = this.filterRanges.length.max;
            }
            if (priceMinSlider) {
                priceMinSlider.min = this.filterRanges.price.min;
                priceMinSlider.max = this.filterRanges.price.max;
            }
            if (priceMaxSlider) {
                priceMaxSlider.min = this.filterRanges.price.min;
                priceMaxSlider.max = this.filterRanges.price.max;
            }
        }

        // Слушатели событий для ползунков
        [lengthMinSlider, lengthMaxSlider, priceMinSlider, priceMaxSlider].forEach(slider => {
            if (slider) slider.addEventListener('input', (e) => this.handleSliderInput(e.target));
        });

        // Слушатель для фильтра по цвету
        if (colorFilter) colorFilter.addEventListener('change', this.handleColorFilterChange.bind(this));
        // Слушатель для кнопки сброса
        if (resetButton) resetButton.addEventListener('click', this.resetFilters.bind(this));
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
    
    handleColorFilterChange(event) {
        // Получаем все выбранные опции и фильтруем пустые значения (опция "— Выберите цвет(а) —")
        this.filters.colors = Array.from(event.target.selectedOptions)
                                 .map(option => option.value)
                                 .filter(value => value !== ''); 
        this.applyFilters();
    }

    updateRangeValues() {
        const lengthMin = this.filters.minLength;
        const lengthMax = this.filters.maxLength;
        const priceMin = this.filters.minPrice;
        const priceMax = this.filters.maxPrice;

        const lengthValueSpan = document.getElementById('lengthValue');
        const priceValueSpan = document.getElementById('priceValue');
        
        if (lengthValueSpan) lengthValueSpan.textContent = `${lengthMin}-${lengthMax} см`;
        // Используем форматирование для валюты
        if (priceValueSpan) priceValueSpan.textContent = `${priceMin.toLocaleString('ru-RU')}-${priceMax.toLocaleString('ru-RU')} ₽`;
    }
    
    updateRangeSliders() {
        const lengthMinSlider = document.getElementById('lengthMin');
        const lengthMaxSlider = document.getElementById('lengthMax');
        const priceMinSlider = document.getElementById('priceMin');
        const priceMaxSlider = document.getElementById('priceMax');

        // Обновляем позицию ползунков
        if (lengthMinSlider) lengthMinSlider.value = this.filters.minLength;
        if (lengthMaxSlider) lengthMaxSlider.value = this.filters.maxLength;
        if (priceMinSlider) priceMinSlider.value = this.filters.minPrice;
        if (priceMaxSlider) priceMaxSlider.value = this.filters.maxPrice;
        
        this.updateRangeValues();
    }
    
    handleSliderInput(slider) {
        const currentId = slider.id;
        let value = parseInt(slider.value);

        if (currentId === 'lengthMin') {
            if (value > this.filters.maxLength) value = this.filters.maxLength;
            this.filters.minLength = value;
        } else if (currentId === 'lengthMax') {
            if (value < this.filters.minLength) value = this.filters.minLength;
            this.filters.maxLength = value;
        } else if (currentId === 'priceMin') {
            if (value > this.filters.maxPrice) value = this.filters.maxPrice;
            this.filters.minPrice = value;
        } else if (currentId === 'priceMax') {
            if (value < this.filters.minPrice) value = this.filters.minPrice;
            this.filters.maxPrice = value;
        }
        
        this.updateRangeValues();
        this.applyFilters();
    }

    applyFilters() {
        const filteredProducts = this.products.filter(product => {
            const lengthMatch = product.length >= this.filters.minLength && 
                              product.length <= this.filters.maxLength;
            
            const priceMatch = product.price >= this.filters.minPrice && 
                             product.price <= this.filters.maxPrice;
            
            // Если массив цветов пуст (нет выбранных фильтров), то цвет подходит (true)
            const colorMatch = this.filters.colors.length === 0 || 
                             this.filters.colors.includes(product.color);
            
            return lengthMatch && priceMatch && colorMatch;
        });
        
        this.renderProducts(filteredProducts);
    }

    resetFilters() {
        if (this.filterRanges) {
            // Восстанавливаем фильтры до исходных границ диапазона
            this.filters = {
                minLength: this.filterRanges.length.min,
                maxLength: this.filterRanges.length.max,
                minPrice: this.filterRanges.price.min,
                maxPrice: this.filterRanges.price.max,
                colors: [] // Сбрасываем выбранные цвета
            };
            
            const colorFilter = document.getElementById('colorFilter');
            // Сброс выбранных опций в UI
            if(colorFilter) Array.from(colorFilter.options).forEach(option => option.selected = false);
            
            this.updateRangeSliders();
            this.applyFilters();
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
        const activeBtn = document.querySelector(`[data-tab="${tab}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // Обновляем активные панели
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        const activePane = document.getElementById(`${tab}Tab`);
        if (activePane) activePane.classList.add('active');

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
        if (!favoritesContainer) return;
        
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
                } else {
                    profileUsername.style.display = 'none';
                }
            }

            if (profilePhoto && this.telegramUser.photo_url) {
                profilePhoto.src = this.telegramUser.photo_url;
                profilePhoto.style.display = 'block';
                if (profileInitials) profileInitials.style.display = 'none';
            } else if (profileInitials) {
                if (profilePhoto) profilePhoto.style.display = 'none';
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
        if (!profileFavorites) return;
        
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
        if (!purchasesList) return;
        
        if (this.purchases.length === 0) {
            purchasesList.innerHTML = '<div class="empty-state">📦 У вас пока нет покупок</div>';
            return;
        }

        purchasesList.innerHTML = `
            <div class="purchases-list">
                ${this.purchases.map(purchase => `
                    <div class="purchase-item">
                        <div class="purchase-header">
                            <strong>Заказ #${purchase.id}</strong>
                            <span class="purchase-date">${new Date(purchase.date).toLocaleDateString()}</span>
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
                    </div>
                `).join('')}
            </div>
        `;
    }

    addToCart(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        const existingItem = this.cart.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.cart.push({
                ...product,
                quantity: 1
            });
        }

        this.updateCartCount();
        this.showNotification(`✅ "${product.name}" добавлен в корзину`);
    }

    updateCartCount() {
        const cartCount = document.getElementById('cartCount');
        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        
        if (cartCount) {
            cartCount.textContent = totalItems;
            cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
        }
    }

    updateFavoritesCount() {
        const favoritesCount = document.getElementById('favoritesCount');
        if (favoritesCount) {
            favoritesCount.textContent = this.favorites.length;
            favoritesCount.style.display = this.favorites.length > 0 ? 'flex' : 'none';
        }
    }

    toggleFavorite(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        const existingIndex = this.favorites.findIndex(fav => fav.id === productId);
        
        if (existingIndex > -1) {
            this.favorites.splice(existingIndex, 1);
            this.showNotification(`❌ "${product.name}" удален из избранного`);
        } else {
            this.favorites.push(product);
            this.showNotification(`❤️ "${product.name}" добавлен в избранное`);
        }

        this.updateFavoritesCount();
        this.applyFilters(); // Обновляем отображение для обновления состояния кнопок избранного
    }

    renderCart() {
        const cartContainer = document.getElementById('cartContainer');
        const cartTotal = document.getElementById('cartTotal');
        
        if (!cartContainer) return;

        if (this.cart.length === 0) {
            cartContainer.innerHTML = '<div class="empty-state">🛒 Корзина пуста</div>';
            if (cartTotal) cartTotal.textContent = '0 ₽';
            return;
        }

        const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        if (cartTotal) {
            cartTotal.textContent = `${total.toLocaleString('ru-RU')} ₽`;
        }

        cartContainer.innerHTML = this.cart.map(item => `
            <div class="cart-item">
                <img src="${item.imageUrl || 'https://placehold.co/100x100/cccccc/333333?text=Нет+Фото'}" 
                     alt="${item.name}" class="cart-item-image">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p>${item.length} см • ${item.color}</p>
                    <div class="cart-item-price">${item.price.toLocaleString('ru-RU')} ₽</div>
                </div>
                <div class="cart-item-controls">
                    <button class="quantity-btn" onclick="window.catalog.updateCartQuantity('${item.id}', ${item.quantity - 1})">-</button>
                    <span class="quantity">${item.quantity}</span>
                    <button class="quantity-btn" onclick="window.catalog.updateCartQuantity('${item.id}', ${item.quantity + 1})">+</button>
                    <button class="remove-btn" onclick="window.catalog.removeFromCart('${item.id}')">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    updateCartQuantity(productId, newQuantity) {
        if (newQuantity < 1) {
            this.removeFromCart(productId);
            return;
        }

        const item = this.cart.find(item => item.id === productId);
        if (item) {
            item.quantity = newQuantity;
            this.renderCart();
            this.updateCartCount();
        }
    }

    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.id !== productId);
        this.renderCart();
        this.updateCartCount();
    }

    renderCheckoutItems() {
        const checkoutItems = document.getElementById('checkoutItems');
        const checkoutTotal = document.getElementById('checkoutTotal');
        
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        if (checkoutTotal) {
            checkoutTotal.textContent = `${total.toLocaleString('ru-RU')} ₽`;
        }

        if (checkoutItems) {
            checkoutItems.innerHTML = this.cart.map(item => `
                <div class="checkout-item">
                    <span>${item.name} × ${item.quantity}</span>
                    <span>${(item.price * item.quantity).toLocaleString('ru-RU')} ₽</span>
                </div>
            `).join('');
        }
    }

    toggleAddressSection() {
        const addressSection = document.getElementById('addressSection');
        if (addressSection) {
            addressSection.style.display = this.deliveryMethod === 'delivery' ? 'block' : 'none';
        }
    }

    updateCheckoutAddressDisplay() {
        const addressDisplay = document.getElementById('selectedAddressDisplay');
        if (addressDisplay) {
            if (this.selectedAddress) {
                addressDisplay.textContent = `${this.selectedAddress.street}, ${this.selectedAddress.house}${this.selectedAddress.apartment ? `, кв. ${this.selectedAddress.apartment}` : ''}`;
            } else {
                addressDisplay.textContent = 'Адрес не выбран';
            }
        }
    }

    confirmOrder() {
        if (this.cart.length === 0) {
            this.showNotification('🛒 Корзина пуста');
            return;
        }

        if (this.deliveryMethod === 'delivery' && !this.selectedAddress) {
            this.showNotification('📫 Пожалуйста, выберите адрес доставки');
            return;
        }

        // Создаем заказ
        const order = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            items: [...this.cart],
            total: this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            delivery: this.deliveryMethod,
            payment: this.paymentMethod,
            address: this.deliveryMethod === 'delivery' ? this.selectedAddress : null,
            status: 'pending'
        };

        // Добавляем в историю покупок
        this.purchases.unshift(order);
        
        // Очищаем корзину
        this.cart = [];
        this.updateCartCount();
        
        // Показываем уведомление
        this.showNotification('✅ Заказ оформлен! Спасибо за покупку!');
        
        // Возвращаемся в каталог
        this.showCatalogScreen();
    }

    showNotification(message) {
        // Простая реализация уведомления
        alert(message);
    }
}

// Запускаем каталог при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 DOM loaded, initializing catalog...');
    window.catalog = new HairShopCatalog();
});