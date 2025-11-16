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
        this.telegramUser = null;
        
        this.init();
    }

    /**
     * Инициализация приложения: показывает загрузку, загружает данные и настраивает события.
     */
    async init() {
        this.initTelegram();
        this.renderLoading();
        await this.loadProductsFromCSV();
        this.setupEventListeners();
        this.updateCartCount();
        console.log('✅ Catalog ready for Telegram WebApp');
    }

    /**
     * Инициализация Telegram WebApp
     */
    initTelegram() {
        if (window.Telegram && Telegram.WebApp) {
            this.telegramUser = Telegram.WebApp.initDataUnsafe?.user;
            Telegram.WebApp.expand();
            Telegram.WebApp.ready();
            
            console.log('✅ Telegram WebApp initialized');
            console.log('👤 User:', this.telegramUser);
            
            // Обновляем информацию профиля
            this.updateProfileInfo();
        } else {
            console.log('⚠️ Telegram WebApp not detected, running in browser mode');
            // Заглушка для тестирования в браузере
            this.telegramUser = {
                first_name: 'Тестовый',
                last_name: 'Пользователь',
                username: 'test_user'
            };
        }
    }

    /**
     * Обновляет информацию профиля
     */
    updateProfileInfo() {
        const profileBtn = document.getElementById('profileBtn');
        if (profileBtn && this.telegramUser) {
            // Можно добавить аватар или другую информацию
            if (this.telegramUser.first_name) {
                profileBtn.title = `${this.telegramUser.first_name} ${this.telegramUser.last_name || ''}`.trim();
            }
        }
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
     * Загрузка и парсинг данных из Google Таблицы в формате CSV.
     */
    async loadProductsFromCSV() {
        try {
            const response = await fetch(this.CSV_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const csvText = await response.text();
            this.products = this.parseCSV(csvText);

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

            products.push({
                id: product.id || i,
                name: product.name || 'Без названия',
                price: product.price || 0,
                oldPrice: product.oldprice || 0,
                length: product.length || 0,
                color: product.color || 'Не указан',
                imageUrl: product.imageurl || ''
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
     * Обновляет интерфейс фильтров (ползунки, метки, список цветов)
     */
    updateFilterUI(colors) {
        // Безопасное получение элементов
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
     * Настройка обработчиков событий для элементов управления.
     */
    setupEventListeners() {
        // Кнопка переключения фильтров
        const filterToggle = document.getElementById('filterToggle');
        const filterSidebar = document.getElementById('filterSidebar');
        const closeFilters = document.getElementById('closeFilters');

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

        // Кнопка профиля
        const profileBtn = document.getElementById('profileBtn');
        if (profileBtn) {
            profileBtn.addEventListener('click', () => {
                this.showProfile();
            });
        }

        // Кнопка корзины
        const cartBtn = document.getElementById('cartBtn');
        if (cartBtn) {
            cartBtn.addEventListener('click', () => {
                this.showCartScreen();
            });
        }

        // Кнопка назад из корзины
        const backFromCart = document.getElementById('backFromCart');
        if (backFromCart) {
            backFromCart.addEventListener('click', () => {
                this.showCatalogScreen();
            });
        }

        // Кнопка оформления заказа
        const checkoutBtn = document.getElementById('checkoutBtn');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => {
                this.checkout();
            });
        }

        const applyFiltersBtn = document.getElementById('applyFilters');
        const resetFiltersBtn = document.getElementById('resetFilters');

        const lengthMinInput = document.getElementById('lengthMin');
        const lengthMaxInput = document.getElementById('lengthMax');
        const priceMinInput = document.getElementById('priceMin');
        const priceMaxInput = document.getElementById('priceMax');

        // События для обновления значений при движении ползунков
        [lengthMinInput, lengthMaxInput, priceMinInput, priceMaxInput].forEach(input => {
            if (input) {
                input.addEventListener('input', () => this.updateRangeLabels());
            }
        });

        // Событие для кнопки "Применить фильтры"
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                this.getFilterValues();
                this.applyFilters();
                // Закрываем фильтры на мобильных после применения
                if (window.innerWidth <= 900) {
                    filterSidebar.classList.remove('active');
                }
            });
        }

        // Событие для кнопки "Сбросить"
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => this.resetFilters());
        }

        // Событие для добавления в корзину (используем делегирование)
        const productsContainer = document.getElementById('productsContainer');
        if (productsContainer) {
            productsContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('add-to-cart') || 
                    e.target.classList.contains('remove-from-cart')) {
                    const productId = e.target.getAttribute('data-id');
                    this.toggleCart(productId);
                }
            });
        }
    }

    /**
     * Переключение экранов
     */
    showCatalogScreen() {
        document.getElementById('catalogScreen').classList.add('active');
        document.getElementById('cartScreen').classList.remove('active');
    }

    showCartScreen() {
        document.getElementById('catalogScreen').classList.remove('active');
        document.getElementById('cartScreen').classList.add('active');
        this.renderCart();
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

        const imageUrl = product.imageUrl && product.imageUrl.trim() !== '' ? product.imageUrl : '';
        const imageClass = imageUrl === '' ? 'no-image' : '';

        const isInCart = this.cart.some(item => item.id == product.id);
        const buttonText = isInCart ? 'В корзине' : 'Добавить в корзину';
        const buttonClass = isInCart ? 'btn-primary btn-in-cart remove-from-cart' : 'btn-primary add-to-cart';

        return `
            <div class="product-card" data-id="${product.id}">
                <div class="product-image ${imageClass}">
                    ${imageUrl ? 
                        `<img src="${imageUrl}" alt="${product.name}" onerror="this.style.display='none'; this.parentElement.classList.add('no-image');">` : 
                        '📷 Нет фото'
                    }
                </div>
                <div class="product-info">
                    <h3>${product.name}</h3>
                    <div class="product-meta">
                        <span>Длина: ${product.length} см</span>
                        <span>Цвет: ${product.color}</span>
                    </div>
                    ${priceDisplay}
                    <button class="${buttonClass}" data-id="${product.id}">
                        ${buttonText}
                    </button>
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
     * Переключение товара в корзине
     */
    toggleCart(productId) {
        const product = this.products.find(p => p.id == productId);
        if (product) {
            const existingIndex = this.cart.findIndex(item => item.id == productId);
            
            if (existingIndex > -1) {
                // Удаляем из корзины
                this.cart.splice(existingIndex, 1);
                this.showNotification(`Товар "${product.name}" удален из корзины`);
            } else {
                // Добавляем в корзину
                this.cart.push({
                    ...product,
                    quantity: 1
                });
                this.showNotification(`Товар "${product.name}" добавлен в корзину!`);
            }
            
            this.updateCartCount();
            this.updateProductButton(productId);
            
            // Если мы на экране корзины, обновляем его
            if (document.getElementById('cartScreen').classList.contains('active')) {
                this.renderCart();
            }
        }
    }

    /**
     * Обновляет кнопку товара
     */
    updateProductButton(productId) {
        const productCard = document.querySelector(`.product-card[data-id="${productId}"]`);
        if (productCard) {
            const button = productCard.querySelector('button');
            const isInCart = this.cart.some(item => item.id == productId);
            
            if (isInCart) {
                button.textContent = 'В корзине';
                button.className = 'btn-primary btn-in-cart remove-from-cart';
                button.setAttribute('data-id', productId);
            } else {
                button.textContent = 'Добавить в корзину';
                button.className = 'btn-primary add-to-cart';
                button.setAttribute('data-id', productId);
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
                    ${item.imageUrl ? 
                        `<img src="${item.imageUrl}" alt="${item.name}">` : 
                        '📷'
                    }
                </div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-meta">
                        <span>Длина: ${item.length} см</span>
                        <span>Цвет: ${item.color}</span>
                    </div>
                    <div class="cart-item-price">${item.price.toLocaleString()} ₽</div>
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
                this.decreaseQuantity(e.target.getAttribute('data-id'));
            } else if (e.target.classList.contains('increase-btn')) {
                this.increaseQuantity(e.target.getAttribute('data-id'));
            } else if (e.target.classList.contains('remove-btn')) {
                this.removeFromCart(e.target.getAttribute('data-id'));
            }
        });
    }

    /**
     * Увеличивает количество товара
     */
    increaseQuantity(productId) {
        const item = this.cart.find(item => item.id == productId);
        if (item) {
            item.quantity += 1;
            this.updateCartCount();
            this.renderCart();
        }
    }

    /**
     * Уменьшает количество товара
     */
    decreaseQuantity(productId) {
        const item = this.cart.find(item => item.id == productId);
        if (item) {
            if (item.quantity > 1) {
                item.quantity -= 1;
            } else {
                this.removeFromCart(productId);
                return;
            }
            this.updateCartCount();
            this.renderCart();
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
            this.updateCartCount();
            this.updateProductButton(productId);
            this.renderCart();
            this.showNotification(`Товар "${item.name}" удален из корзины`);
        }
    }

    /**
     * Показывает профиль
     */
    showProfile() {
        if (this.telegramUser) {
            const userName = `${this.telegramUser.first_name} ${this.telegramUser.last_name || ''}`.trim();
            const userInfo = this.telegramUser.username ? 
                `@${this.telegramUser.username}` : 'Имя пользователя не указано';
            
            alert(`👤 Ваш профиль:\n\n${userName}\n${userInfo}\n\n💎 Товаров в корзине: ${this.cart.length}`);
        } else {
            alert('👤 Профиль Telegram не доступен');
        }
    }

    /**
     * Оформление заказа
     */
    checkout() {
        if (this.cart.length === 0) {
            alert('🛒 Корзина пуста');
            return;
        }

        const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const orderDetails = this.cart.map(item => 
            `• ${item.name} - ${item.quantity} × ${item.price.toLocaleString()} ₽`
        ).join('\n');

        const message = `🛍️ Новый заказ!\n\n` +
                       `👤 Покупатель: ${this.telegramUser?.first_name || 'Неизвестно'}\n` +
                       `📦 Товары:\n${orderDetails}\n\n` +
                       `💎 Итого: ${total.toLocaleString()} ₽\n\n` +
                       `🕐 Время: ${new Date().toLocaleString()}`;

        // В реальном приложении здесь будет отправка на сервер
        alert(`✅ Заказ оформлен!\n\n${message}\n\nС вами свяжутся для подтверждения заказа.`);
        
        // Очищаем корзину после заказа
        this.cart = [];
        this.updateCartCount();
        this.renderCart();
        this.showCatalogScreen();
        
        // Обновляем кнопки товаров
        this.products.forEach(product => this.updateProductButton(product.id));
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
    window.catalog = new HairShopCatalog();
});