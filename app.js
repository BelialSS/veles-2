/**
 * Класс HairShopCatalog управляет загрузкой данных, фильтрацией и отображением товаров.
 */
class HairShopCatalog {
    constructor() {
        // URL Google Таблицы для экспорта в CSV. 
        // Важно: Таблица должна быть опубликована в Интернете (Файл -> Поделиться -> Опубликовать).
        this.CSV_URL = "https://docs.google.com/spreadsheets/d/15KZ6DHJD4zin2nATxLG-xBGx-BClYWUDAY_mW0VIwoM/export?format=csv&gid=0";
        
        this.products = [];
        this.filterRanges = null; // Для хранения минимальных/максимальных значений, определенных после загрузки
        this.filters = {
            // Начальные значения, будут обновлены после загрузки данных
            minLength: 14, 
            maxLength: 30,
            minPrice: 1000,
            maxPrice: 10000,
            colors: []
        };
        
        // **ИСПРАВЛЕНО:** Используем новое, переименованное имя файла.
        this.PLACEHOLDER_LOGO = 'veles-logo.jpeg'; 

        this.init();
    }

    /**
     * Инициализация приложения: показывает загрузку, загружает данные и настраивает события.
     */
    async init() {
        this.renderLoading();
        await this.loadProductsFromCSV();
        this.setupEventListeners();
        console.log('✅ Catalog ready for Telegram WebApp');
    }

    /**
     * Отображает индикатор загрузки.
     */
    renderLoading() {
        const container = document.getElementById('productsContainer');
        if (container) {
            container.innerHTML = '<div style="text-align: center; padding: 50px;">Загрузка данных...</div>';
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
            console.log(`app.js:${this.products.length} Products loaded!`);
        } catch (error) {
            console.error("Error loading products:", error);
            const container = document.getElementById('productsContainer');
            if (container) {
                container.innerHTML = `<div style="text-align: center; color: red; padding: 50px;">
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
            const values = lines[i].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
            if (!values) continue;

            const product = {};
            headers.forEach((header, index) => {
                let value = values[index] ? values[index].trim().replace(/"/g, '') : '';
                
                // Приведение типов для числовых полей
                if (header === 'id' || header === 'price' || header === 'oldprice' || header === 'length') {
                    value = parseFloat(value) || 0;
                }
                
                // Приводим URL к стандартному виду, если он есть
                if (header === 'imageurl' && value && !value.startsWith('http')) {
                    // Здесь может быть логика для относительных путей, если это необходимо
                }
                
                product[header] = value;
            });

            // Маппинг заголовков (пример, если они другие в таблице)
            products.push({
                id: product.id,
                name: product.name,
                price: product.price,
                oldPrice: product.oldprice,
                length: product.length,
                color: product.color,
                imageUrl: product.imageurl // URL изображения
            });
        }
        return products;
    }

    /**
     * Определяет минимальные и максимальные значения для фильтров.
     */
    initializeFilterRanges() {
        if (this.products.length === 0) return;

        const allLengths = this.products.map(p => p.length).filter(l => l > 0);
        const allPrices = this.products.map(p => p.price).filter(p => p > 0);
        const allColors = [...new Set(this.products.map(p => p.color).filter(c => c && c.trim() !== ''))];

        const minLength = Math.floor(Math.min(...allLengths) / 10) * 10 || 10;
        const maxLength = Math.ceil(Math.max(...allLengths) / 10) * 10 || 50;
        const minPrice = Math.floor(Math.min(...allPrices) / 1000) * 1000 || 1000;
        const maxPrice = Math.ceil(Math.max(...allPrices) / 1000) * 1000 || 20000;

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
        const lengthMinInput = document.getElementById('lengthMin');
        const lengthMaxInput = document.getElementById('lengthMax');
        const priceMinInput = document.getElementById('priceMin');
        const priceMaxInput = document.getElementById('priceMax');
        const colorSelect = document.getElementById('colorFilter');

        if (this.filterRanges) {
            // Длина
            lengthMinInput.min = lengthMaxInput.min = this.filterRanges.length.min;
            lengthMinInput.max = lengthMaxInput.max = this.filterRanges.length.max;
            lengthMinInput.value = this.filters.minLength;
            lengthMaxInput.value = this.filters.maxLength;

            // Цена
            priceMinInput.min = priceMaxInput.min = this.filterRanges.price.min;
            priceMinInput.max = priceMaxInput.max = this.filterRanges.price.max;
            priceMinInput.value = this.filters.minPrice;
            priceMaxInput.value = this.filters.maxPrice;

            // Обновляем метки (label) в HTML
            document.querySelector('.filter-group:nth-child(1) .range-labels span:first-child').textContent = `${this.filterRanges.length.min} см`;
            document.querySelector('.filter-group:nth-child(1) .range-labels span:last-child').textContent = `${this.filterRanges.length.max} см`;
            document.querySelector('.filter-group:nth-child(2) .range-labels span:first-child').textContent = `${this.filterRanges.price.min} ₽`;
            document.querySelector('.filter-group:nth-child(2) .range-labels span:last-child').textContent = `${this.filterRanges.price.max} ₽`;
            
            this.updateRangeLabels();
        }

        // Цвета
        if (colorSelect) {
            colorSelect.innerHTML = '';
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
        const productsContainer = document.getElementById('productsContainer');
        const applyFiltersBtn = document.getElementById('applyFilters');
        const resetFiltersBtn = document.getElementById('resetFilters');

        const lengthMinInput = document.getElementById('lengthMin');
        const lengthMaxInput = document.getElementById('lengthMax');
        const priceMinInput = document.getElementById('priceMin');
        const priceMaxInput = document.getElementById('priceMax');
        const colorFilter = document.getElementById('colorFilter');

        // События для обновления значений при движении ползунков
        [lengthMinInput, lengthMaxInput, priceMinInput, priceMaxInput].forEach(input => {
            input.addEventListener('input', () => this.updateRangeLabels());
        });

        // Событие для кнопки "Применить фильтры"
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                this.getFilterValues();
                this.applyFilters();
            });
        }

        // Событие для кнопки "Сбросить"
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => this.resetFilters());
        }

        // Событие для добавления в корзину (используем делегирование)
        if (productsContainer) {
            productsContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('add-to-cart')) {
                    const productId = e.target.getAttribute('data-id');
                    this.addToCart(productId);
                }
            });
        }

        // Настройка мультиселекта цвета
        if (colorFilter) {
            colorFilter.addEventListener('change', () => {
                // При изменении цвета не применяем фильтры сразу, ждем кнопку "Применить"
                console.log('Цвет изменен, нажмите "Применить фильтры"');
            });
        }
    }

    /**
     * Обновляет текстовые метки для текущих значений ползунков.
     */
    updateRangeLabels() {
        const lengthMin = parseInt(document.getElementById('lengthMin').value);
        const lengthMax = parseInt(document.getElementById('lengthMax').value);
        const priceMin = parseInt(document.getElementById('priceMin').value);
        const priceMax = parseInt(document.getElementById('priceMax').value);

        // Убеждаемся, что min не больше max
        if (lengthMin > lengthMax) document.getElementById('lengthMin').value = lengthMax;
        if (priceMin > priceMax) document.getElementById('priceMin').value = priceMax;

        document.getElementById('lengthValue').textContent = `${Math.min(lengthMin, lengthMax)}-${Math.max(lengthMin, lengthMax)} см`;
        document.getElementById('priceValue').textContent = `${Math.min(priceMin, priceMax)}-${Math.max(priceMin, priceMax)} ₽`;
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

        const selectedColors = Array.from(colorFilter.options)
                                   .filter(option => option.selected)
                                   .map(option => option.value);

        this.filters = {
            minLength: Math.min(parseInt(lengthMinInput.value), parseInt(lengthMaxInput.value)),
            maxLength: Math.max(parseInt(lengthMinInput.value), parseInt(lengthMaxInput.value)),
            minPrice: Math.min(parseInt(priceMinInput.value), parseInt(priceMaxInput.value)),
            maxPrice: Math.max(parseInt(priceMinInput.value), parseInt(priceMaxInput.value)),
            colors: selectedColors
        };

        console.log('Текущие фильтры:', this.filters);
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
        // Проверяем, есть ли старая цена для отображения скидки
        const hasDiscount = product.oldPrice && product.oldPrice > product.price;
        const priceDisplay = hasDiscount 
            ? `<span class="product-price">${product.price.toLocaleString()} ₽</span>
               <span class="product-old-price">${product.oldPrice.toLocaleString()} ₽</span>`
            : `<span class="product-price">${product.price.toLocaleString()} ₽</span>`;

        // **ИСПРАВЛЕНИЕ: Используем константу PLACEHOLDER_LOGO, которая теперь содержит корректное имя файла.**
        // Устанавливаем заглушку, если product.imageUrl пуст
        const imageUrl = product.imageUrl && product.imageUrl.trim() !== '' ? product.imageUrl : this.PLACEHOLDER_LOGO;
        
        // Определяем класс для изображения. Если это логотип-заглушка, используем logo-placeholder
        const imageClass = imageUrl === this.PLACEHOLDER_LOGO ? 'logo-placeholder' : '';

        return `
            <div class="product-card" data-id="${product.id}">
                <div class="product-image">
                    <!-- Используем либо изображение товара, либо логотип -->
                    <!-- onerror: Если изображение не загрузилось, показываем заглушку -->
                    <img src="${imageUrl}" 
                         alt="${product.name}" 
                         class="${imageClass}"
                         onerror="this.onerror=null; this.src='${this.PLACEHOLDER_LOGO}'; this.classList.add('logo-placeholder');">
                </div>
                <div class="product-info">
                    <h3>${product.name || 'Название не указано'}</h3>
                    <div class="product-meta">
                        <span>Длина: ${product.length || 'N/A'} см</span>
                        <span>Цвет: ${product.color || 'N/A'}</span>
                    </div>
                    ${priceDisplay}
                    <button class="btn-primary add-to-cart" data-id="${product.id}">
                        Добавить в корзину
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
            // Фильтр по длине
            const lengthMatch = product.length >= this.filters.minLength && 
                              product.length <= this.filters.maxLength;
            
            // Фильтр по цене
            const priceMatch = product.price >= this.filters.minPrice && 
                             product.price <= this.filters.maxPrice;
            
            // Фильтр по цвету
            // Если массив filters.colors пуст, считаем совпадением (true)
            const colorMatch = this.filters.colors.length === 0 || 
                             this.filters.colors.includes(product.color);
            
            return lengthMatch && priceMatch && colorMatch;
        });
        
        this.renderProducts(filteredProducts);
    }

    /**
     * Сброс всех фильтров к начальным значениям.
     */
    resetFilters() {
        if (this.filterRanges) {
            // Сброс числовых фильтров к крайним значениям диапазона
            this.filters = {
                minLength: this.filterRanges.length.min,
                maxLength: this.filterRanges.length.max,
                minPrice: this.filterRanges.price.min,
                maxPrice: this.filterRanges.price.max,
                colors: [] // Сброс цвета
            };
            
            // Сброс визуальных элементов
            document.getElementById('colorFilter').selectedIndex = -1; // Сброс выбора цвета
            
            // Применяем новые значения к ползункам и меткам
            document.getElementById('lengthMin').value = this.filters.minLength;
            document.getElementById('lengthMax').value = this.filters.maxLength;
            document.getElementById('priceMin').value = this.filters.minPrice;
            document.getElementById('priceMax').value = this.filters.maxPrice;
            
            this.updateRangeLabels();
            this.applyFilters();
            
            console.log('✅ Фильтры сброшены к начальным значениям.');
        }
    }

    /**
     * Имитация добавления товара в корзину (заменено на console.log).
     */
    addToCart(productId) {
        console.log(`🛒 Товар #${productId} добавлен в корзину!`);
    }
}

// Запускаем каталог при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    // Используем setTimeout, чтобы быть уверенным, что DOM готов
    setTimeout(() => {
        window.catalog = new HairShopCatalog();
    }, 0);
});